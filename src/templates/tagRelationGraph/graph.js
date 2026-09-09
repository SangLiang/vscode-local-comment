(function() {
    const DEFAULT_COMMANDS = {
        expandNode: 'expandNode',
        goToDefinition: 'goToDefinition',
        navigateBack: 'navigateBack',
        resetToRoot: 'resetToRoot',
        navigateToLevel: 'navigateToLevel',
        refresh: 'refresh'
    };

    let vscodeApi = null;
    let containerEl = null;
    let chrome = {};
    let commands = Object.assign({}, DEFAULT_COMMANDS);
    let skipCenterJump = false;
    let expandInPlace = false;
    let onReset = null;
    let cy = null;
    let breadcrumbPath = [];
    let chromeBound = false;
    let currentLevel = 0;
    let rootNodeIds = {};
    let expandedChildren = {};
    let graphLoading = false;
    let loadingShownAt = 0;
    let hideLoadingTimer = null;
    const LOADING_MIN_MS = 400;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function applyLayout(hideLoading) {
        if (!cy) {
            if (hideLoading) {
                hideGraphLoading();
            }
            return;
        }
        const layout = cy.layout({
            name: 'cose',
            padding: 28,
            animate: true,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            gravity: 80
        });
        layout.one('layoutstop', function() {
            rebuildNodeToggles();
            if (hideLoading) {
                hideGraphLoading();
            }
        });
        layout.run();
    }

    function finishLocalUpdate(hideLoading) {
        rebuildNodeToggles();
        if (hideLoading) {
            hideGraphLoading();
        }
    }

    function pickExpandPosition(origin, index, total) {
        const zoom = Math.max(cy.zoom() || 1, 0.15);
        const radius = 210 / zoom;
        const angle = total <= 1 ? 0 : (index / total) * Math.PI * 2 - Math.PI / 2;
        return {
            x: origin.x + radius * Math.cos(angle),
            y: origin.y + radius * Math.sin(angle)
        };
    }

    function revealAround(eles) {
        if (!cy || !eles || eles.empty()) {
            return;
        }
        const ext = cy.extent();
        const bb = eles.boundingBox({ includeLabels: true });
        const margin = 40 / Math.max(cy.zoom() || 1, 0.15);
        const clipped = bb.x1 < ext.x1 + margin ||
            bb.x2 > ext.x2 - margin ||
            bb.y1 < ext.y1 + margin ||
            bb.y2 > ext.y2 - margin;
        if (clipped) {
            cy.animate({
                center: { eles: eles },
                duration: 180
            });
        }
    }

    function getLoadingOverlay() {
        if (!containerEl || !containerEl.parentElement) {
            return null;
        }
        return containerEl.parentElement.querySelector(':scope > .graph-loading');
    }

    function showGraphLoading() {
        if (hideLoadingTimer) {
            clearTimeout(hideLoadingTimer);
            hideLoadingTimer = null;
        }
        const overlay = getLoadingOverlay();
        if (!overlay) {
            return;
        }
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        loadingShownAt = Date.now();
        graphLoading = true;
    }

    function hideGraphLoadingNow() {
        if (hideLoadingTimer) {
            clearTimeout(hideLoadingTimer);
            hideLoadingTimer = null;
        }
        const overlay = getLoadingOverlay();
        if (overlay) {
            overlay.classList.remove('visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
        graphLoading = false;
        loadingShownAt = 0;
    }

    function hideGraphLoading(immediate) {
        if (immediate || !loadingShownAt) {
            hideGraphLoadingNow();
            return;
        }
        const remain = LOADING_MIN_MS - (Date.now() - loadingShownAt);
        if (remain <= 0) {
            hideGraphLoadingNow();
            return;
        }
        if (hideLoadingTimer) {
            clearTimeout(hideLoadingTimer);
        }
        hideLoadingTimer = setTimeout(hideGraphLoadingNow, remain);
    }

    function ensureToggleLayer() {
        if (!containerEl) {
            return null;
        }
        let layer = containerEl.querySelector('.graph-node-toggles');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'graph-node-toggles';
            containerEl.appendChild(layer);
        }
        return layer;
    }

    function positionToggleButton(btn, node) {
        const bb = node.renderedBoundingBox({ includeLabels: false });
        btn.style.left = (bb.x2 + 4) + 'px';
        btn.style.top = ((bb.y1 + bb.y2) / 2 - 9) + 'px';
    }

    function createToggleButton(symbol, title, onClick, node) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'graph-node-toggle';
        btn.textContent = symbol;
        btn.title = title;
        btn.dataset.nodeId = node.id();
        positionToggleButton(btn, node);
        btn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    function rebuildNodeToggles() {
        const layer = ensureToggleLayer();
        if (!cy || !layer) {
            return;
        }
        layer.innerHTML = '';
        cy.nodes().forEach(function(node) {
            const type = node.data('type');
            if (type === 'tag' && node.data('hasChildren')) {
                if (node.data('expanded')) {
                    layer.appendChild(createToggleButton('-', '收起子节点', function() {
                        if (graphLoading) {
                            return;
                        }
                        collapseChildren(node.id());
                    }, node));
                } else {
                    layer.appendChild(createToggleButton('+', '展开子节点', function() {
                        if (graphLoading) {
                            return;
                        }
                        showGraphLoading();
                        vscodeApi.postMessage({
                            command: commands.expandNode,
                            nodeId: node.id(),
                            filePath: node.data('filePath'),
                            label: node.data('label')
                        });
                    }, node));
                }
            }
        });
    }

    function repositionNodeToggles() {
        const layer = containerEl && containerEl.querySelector('.graph-node-toggles');
        if (!cy || !layer) {
            return;
        }
        layer.querySelectorAll('.graph-node-toggle').forEach(function(btn) {
            const node = cy.getElementById(btn.dataset.nodeId);
            if (node && node.length) {
                positionToggleButton(btn, node);
            }
        });
    }

    function showEmptyState(message) {
        if (!containerEl) {
            return;
        }
        if (cy) {
            cy.destroy();
            cy = null;
        }
        currentLevel = 0;
        rootNodeIds = {};
        expandedChildren = {};
        hideGraphLoading(true);
        containerEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <div>${escapeHtml(message)}</div>
            </div>
        `;
    }

    function updateStatus(data) {
        if (!chrome.status) {
            return;
        }
        const levelText = data.level === 0 ? '当前层' : `第 ${data.level} 层`;
        const countText = data.nodes ? `共 ${data.nodes.length - 1} 个引用` : '';
        chrome.status.textContent = `${levelText} ${countText}`;
    }

    function updateBreadcrumb() {
        const breadcrumb = chrome.breadcrumb;
        if (!breadcrumb) {
            return;
        }
        if (!breadcrumbPath.length) {
            breadcrumb.innerHTML = '';
            if (chrome.btnBack) {
                chrome.btnBack.disabled = true;
            }
            return;
        }

        const html = breadcrumbPath.map((item, index) => {
            const isLast = index === breadcrumbPath.length - 1;
            const span = `<span class="breadcrumb-item ${isLast ? 'current' : ''}" data-index="${index}">${escapeHtml(item.label)}</span>`;
            if (isLast) {
                return span;
            }
            return span + '<span class="breadcrumb-separator">></span>';
        }).join('');
        breadcrumb.innerHTML = html;

        breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                vscodeApi.postMessage({
                    command: commands.navigateToLevel,
                    level: index
                });
            });
        });

        if (chrome.btnBack) {
            chrome.btnBack.disabled = breadcrumbPath.length <= 1;
        }
    }

    function bindChrome() {
        if (chromeBound) {
            return;
        }
        chromeBound = true;
        if (chrome.btnRefresh) {
            chrome.btnRefresh.addEventListener('click', () => {
                vscodeApi.postMessage({ command: commands.refresh });
            });
        }
        if (chrome.btnBack) {
            chrome.btnBack.addEventListener('click', () => {
                vscodeApi.postMessage({ command: commands.navigateBack });
            });
        }
        if (chrome.btnReset) {
            chrome.btnReset.addEventListener('click', () => {
                if (typeof onReset === 'function') {
                    onReset();
                    return;
                }
                vscodeApi.postMessage({ command: commands.resetToRoot });
            });
        }
    }

    function render(data) {
        breadcrumbPath = data && data.breadcrumb ? data.breadcrumb : [];
        currentLevel = data && typeof data.level === 'number' ? data.level : 0;
        updateBreadcrumb();
        updateStatus(data || {});

        if (!data || !data.nodes || data.nodes.length === 0) {
            showEmptyState('当前文件未引用任何 tag');
            return;
        }

        if (!containerEl) {
            return;
        }
        if (cy) {
            cy.destroy();
            cy = null;
        }
        rootNodeIds = {};
        expandedChildren = {};
        hideGraphLoading(true);
        containerEl.innerHTML = '';

        const elements = [
            ...data.nodes.map(n => ({
                data: {
                    id: n.id,
                    label: n.label,
                    type: n.type,
                    filePath: n.filePath,
                    line: n.line,
                    hasChildren: n.hasChildren,
                    expanded: false
                },
                classes: n.type
            })),
            ...data.edges.map(e => ({
                data: {
                    id: e.id,
                    source: e.source,
                    target: e.target
                }
            }))
        ];

        cy = cytoscape({
            container: containerEl,
            elements: elements,
            maxZoom: 1.5,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#999',
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '11px',
                        'color': 'var(--vscode-editor-foreground)',
                        'shape': 'roundrectangle',
                        'text-wrap': 'wrap',
                        'text-max-width': '120px',
                        'width': 'label',
                        'height': 'label',
                        'min-width': 48,
                        'min-height': 28,
                        'padding': '10px',
                        'text-margin-y': 0
                    }
                },
                {
                    selector: 'node.center',
                    style: {
                        'background-color': '#4285F4',
                        'font-size': '12px',
                        'font-weight': 'bold',
                        'color': '#ffffff',
                        'text-max-width': '150px',
                        'padding': '15px'
                    }
                },
                {
                    selector: 'node.tag',
                    style: {
                        'background-color': (ele) => ele.data('hasChildren') ? '#FF9800' : '#34A853',
                        'border-width': 2,
                        'border-color': (ele) => ele.data('hasChildren') ? '#F57C00' : '#2E7D32',
                        'color': '#ffffff',
                        'text-max-width': '120px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#999',
                        'target-arrow-color': '#999',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }
                }
            ],
            layout: { name: 'cose' }
        });

        cy.on('tap', 'node', (evt) => {
            const node = evt.target;
            const type = node.data('type');
            const filePath = node.data('filePath');
            const line = node.data('line');

            if (type === 'center') {
                if (skipCenterJump) {
                    return;
                }
                vscodeApi.postMessage({
                    command: commands.goToDefinition,
                    filePath: filePath,
                    line: line
                });
                return;
            }

            if (type === 'tag') {
                vscodeApi.postMessage({
                    command: commands.goToDefinition,
                    filePath: filePath,
                    line: line
                });
            }
        });

        cy.on('pan zoom resize', repositionNodeToggles);
        cy.on('drag position', 'node', repositionNodeToggles);
        data.nodes.forEach(function(n) {
            rootNodeIds[n.id] = true;
        });
        applyLayout();
        updateInPlaceStatus();
    }

    function nodeExists(id) {
        return !!(cy && cy.getElementById(id).length);
    }

    function appendChildren(parentId, payload) {
        if (!cy || !parentId) {
            hideGraphLoading();
            return;
        }
        const parent = cy.getElementById(parentId);
        if (!parent.length) {
            hideGraphLoading();
            return;
        }
        const nodes = (payload && payload.nodes) || [];
        const parentPos = parent.position();
        const addedChildIds = [];
        const newNodes = [];

        nodes.forEach(function(n) {
            if (!n || !n.id) {
                return;
            }
            addedChildIds.push(n.id);
            if (nodeExists(n.id)) {
                return;
            }
            newNodes.push(n);
        });

        let added = cy.collection();
        newNodes.forEach(function(n, index) {
            const pos = pickExpandPosition(parentPos, index, newNodes.length);
            added = added.union(cy.add({
                group: 'nodes',
                data: {
                    id: n.id,
                    label: n.label,
                    type: n.type,
                    filePath: n.filePath,
                    line: n.line,
                    hasChildren: n.hasChildren,
                    expanded: false
                },
                classes: n.type,
                position: pos
            }));
        });

        addedChildIds.forEach(function(childId) {
            if (!nodeExists(parentId) || !nodeExists(childId)) {
                return;
            }
            const edgeId = 'edge-' + parentId + '-' + childId;
            if (nodeExists(edgeId)) {
                return;
            }
            cy.add({
                group: 'edges',
                data: {
                    id: edgeId,
                    source: parentId,
                    target: childId
                }
            });
        });

        expandedChildren[parentId] = addedChildIds;
        parent.data('expanded', true);
        finishLocalUpdate(true);
        updateInPlaceStatus();
        if (added && !added.empty()) {
            revealAround(parent.union(added));
        }
    }

    function childStillNeeded(childId, exceptParentId) {
        if (rootNodeIds[childId]) {
            return true;
        }
        for (const parentId of Object.keys(expandedChildren)) {
            if (parentId === exceptParentId) {
                continue;
            }
            const kids = expandedChildren[parentId] || [];
            if (kids.indexOf(childId) !== -1) {
                return true;
            }
        }
        return false;
    }

    function collapseSubtree(parentId) {
        const kids = expandedChildren[parentId];
        if (!kids) {
            const parent = cy.getElementById(parentId);
            if (parent.length) {
                parent.data('expanded', false);
            }
            return;
        }

        kids.forEach(function(childId) {
            if (expandedChildren[childId]) {
                collapseSubtree(childId);
            }
        });

        const toRemove = [];
        cy.edges().forEach(function(edge) {
            if (edge.source().id() === parentId && kids.indexOf(edge.target().id()) !== -1) {
                toRemove.push(edge);
            }
        });
        toRemove.forEach(function(edge) {
            cy.remove(edge);
        });

        kids.forEach(function(childId) {
            if (childStillNeeded(childId, parentId)) {
                return;
            }
            const leftover = cy.edges().filter(function(edge) {
                return edge.target().id() === childId;
            });
            if (leftover.length === 0) {
                const node = cy.getElementById(childId);
                if (node.length) {
                    cy.remove(node);
                }
            }
        });

        delete expandedChildren[parentId];
        const parent = cy.getElementById(parentId);
        if (parent.length) {
            parent.data('expanded', false);
        }
    }

    function collapseChildren(parentId) {
        if (!cy) {
            return;
        }
        if (!expandedChildren[parentId]) {
            const parent = cy.getElementById(parentId);
            if (parent.length) {
                parent.data('expanded', false);
                rebuildNodeToggles();
            }
            return;
        }
        collapseSubtree(parentId);
        finishLocalUpdate(true);
        updateInPlaceStatus();
    }

    function updateInPlaceStatus() {
        if (!expandInPlace || !chrome.status || !cy) {
            return;
        }
        chrome.status.textContent = '共 ' + cy.nodes().length + ' 个节点';
    }

    function resize() {
        if (!cy) {
            return;
        }
        cy.resize();
        applyLayout();
    }

    function init(options) {
        vscodeApi = options.vscode;
        containerEl = options.container;
        chrome = options.chrome || {};
        commands = Object.assign({}, DEFAULT_COMMANDS, options.commands || {});
        skipCenterJump = options.skipCenterJump === true;
        expandInPlace = options.expandInPlace !== false;
        onReset = options.onReset;
        chromeBound = false;
        bindChrome();
    }

    window.TagRelationGraphView = {
        init: init,
        render: render,
        appendChildren: appendChildren,
        resize: resize,
        showError: showEmptyState
    };
})();
