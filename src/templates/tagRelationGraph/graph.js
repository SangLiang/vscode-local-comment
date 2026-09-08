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
    let onReset = null;
    let cy = null;
    let breadcrumbPath = [];
    let chromeBound = false;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function applyLayout() {
        if (!cy) {
            return;
        }
        cy.layout({
            name: 'cose',
            padding: 20,
            animate: true,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            gravity: 80
        }).run();
    }

    function showEmptyState(message) {
        if (!containerEl) {
            return;
        }
        if (cy) {
            cy.destroy();
            cy = null;
        }
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
        containerEl.innerHTML = '';

        const elements = [
            ...data.nodes.map(n => ({
                data: {
                    id: n.id,
                    label: n.label,
                    type: n.type,
                    filePath: n.filePath,
                    line: n.line,
                    hasChildren: n.hasChildren
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
            const hasChildren = node.data('hasChildren');
            const id = node.data('id');
            const label = node.data('label');

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
                if (hasChildren) {
                    vscodeApi.postMessage({
                        command: commands.expandNode,
                        nodeId: id,
                        filePath: filePath,
                        label: label
                    });
                } else {
                    vscodeApi.postMessage({
                        command: commands.goToDefinition,
                        filePath: filePath,
                        line: line
                    });
                }
            }
        });

        applyLayout();
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
        onReset = options.onReset;
        chromeBound = false;
        bindChrome();
    }

    window.TagRelationGraphView = {
        init: init,
        render: render,
        resize: resize,
        showError: showEmptyState
    };
})();
