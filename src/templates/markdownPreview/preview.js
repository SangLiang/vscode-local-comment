/**
 * Markdown 文件预览 Webview 脚本
 *
 * 职责：将 Markdown 渲染为 HTML（Mermaid / KaTeX / 代码高亮）；
 * TOC 委托 previewToc.js；Mermaid 缩放拖拽委托 mermaidChartInteract.js；
 * 全文搜索委托 previewFind.js；导出委托 previewExport.js。
 * 主渲染经 markdownRenderCore.renderMarkdownToHtml(..., { sourceLines: true })；本文件负责 DOM/IPC/菜单/TOC/查找接线。
 */
(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    const previewActionMenu = document.getElementById('previewActionMenu');
    const previewActionMenuToggle = document.getElementById('previewActionMenuToggle');
    const previewActionMenuPanel = document.getElementById('previewActionMenuPanel');
    let actionMenuOpen = false;
    let currentPreviewFontSize = null;
    /** 最近一次预览渲染的 Promise，导出前需 await，避免 Mermaid 尚未写入 DOM */
    let previewRenderPromise = Promise.resolve();
    /** 可用的标签名列表，用于精确识别真实标签（而非所有 @xxx 格式） */
    let availableTagNames = [];
    let currentMermaidTheme = null;

    const renderCore = window.MarkdownRenderCore.create();

    // --- 源码跳转辅助（行号注入已在 markdownRenderCore sourceLines 路径）---

    /** 浅比较标签名列表，避免 setAvailableTags 重复触发整页重渲 */
    function tagsEqual(left, right) {
        if (!Array.isArray(left) || !Array.isArray(right)) {
            return false;
        }
        if (left.length !== right.length) {
            return false;
        }
        for (let i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) {
                return false;
            }
        }
        return true;
    }

    /** 0-based 行号：offset 所在行 */
    function offsetToLine(content, offset) {
        if (offset <= 0) {
            return 0;
        }
        const text = content.substring(0, offset);
        return (text.match(/\r?\n/g) || []).length;
    }

    /** 去掉 HTML 标签并规整空白，便于在源码中搜索 */
    function stripHtmlTags(html) {
        return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /** Alt+单击时解析源文件行号：优先 data-source-line，否则用块文本在源码中搜索 */
    function resolveSourceLine(blockElement) {
        const attr = blockElement.getAttribute('data-source-line');
        if (attr !== null && attr !== '') {
            const line = parseInt(attr, 10);
            if (!Number.isNaN(line) && line >= 0) {
                return line;
            }
        }
        const source = window.markdownContent;
        if (!source || !blockElement.textContent) {
            return null;
        }
        const plain = stripHtmlTags(blockElement.textContent);
        if (plain.length < 2) {
            return null;
        }
        const sourceLines = source.split(/\r?\n/);
        const probe = plain.slice(0, Math.min(plain.length, 48));
        const head = probe.slice(0, Math.min(probe.length, 16));

        for (let i = 0; i < sourceLines.length; i++) {
            const linePlain = sourceLines[i]
                .replace(/^#+\s+/, '')
                .replace(/^(\s*[-*+]|\s*\d+\.)\s+/, '')
                .replace(/\*\*/g, '')
                .replace(/`/g, '')
                .trim();
            if (linePlain.length < 2) {
                continue;
            }
            if (linePlain.includes(head) || probe.includes(linePlain.slice(0, 16))) {
                return i;
            }
        }

        const idx = source.indexOf(probe.slice(0, Math.min(probe.length, 32)));
        if (idx !== -1) {
            return offsetToLine(source, idx);
        }
        return null;
    }

    // marked / mermaid / highlight 均由 renderCore.waitForLibs 初始化；行号 Renderer 在 sourceLines 路径内按次挂载
    const initializationPromise = renderCore.waitForLibs()
        .then(() => {
            console.log('所有库初始化成功');
        })
        .catch(error => {
            console.error("关键库初始化失败:", error);
            previewArea.innerHTML = '<p style="color:red;">预览组件加载失败: ' + error.message + '</p>';
            throw error;
        });

    // --- 预览更新入口 ---

    /** 对外入口：包装渲染任务，供导出流程等待完成 */
    async function updatePreview(content) {
        const renderTask = updatePreviewContent(content);
        previewRenderPromise = renderTask;
        return renderTask;
    }

    // --- 右上角操作菜单（导出等）---

    function applyActionMenuVisibility() {
        if (!previewActionMenu || !previewActionMenuToggle || !previewActionMenuPanel) {
            return;
        }
        previewActionMenuToggle.setAttribute('aria-expanded', actionMenuOpen ? 'true' : 'false');
        if (actionMenuOpen) {
            previewActionMenu.classList.add('is-open');
            previewActionMenuPanel.removeAttribute('hidden');
        } else {
            previewActionMenu.classList.remove('is-open');
            previewActionMenuPanel.setAttribute('hidden', '');
        }
    }

    function setActionMenuOpen(open) {
        actionMenuOpen = !!open;
        applyActionMenuVisibility();
    }

    /** 切换菜单；点击外部区域关闭 */
    function initActionMenuControls() {
        if (!previewActionMenuToggle || !previewActionMenuPanel) {
            return;
        }
        applyActionMenuVisibility();
        previewActionMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            setActionMenuOpen(!actionMenuOpen);
        });
        document.addEventListener('mousedown', function(e) {
            if (!actionMenuOpen || !previewActionMenu) {
                return;
            }
            if (previewActionMenu.contains(e.target)) {
                return;
            }
            setActionMenuOpen(false);
        });
    }

    function rebuildToc() {
        if (window.PreviewToc) {
            window.PreviewToc.rebuild();
        }
    }

    /** 更新操作菜单中的字号数值显示 */
    function updateFontSizeValueDisplay(fontSize) {
        const valueEl = document.getElementById('fontSizeValue');
        if (valueEl && fontSize && fontSize > 0) {
            valueEl.textContent = fontSize + 'px';
        }
    }

    /** 绑定字号调节按钮：A−/A+/重置，请求扩展更新配置并回推实际字号 */
    function initFontSizeControls() {
        const decBtn = document.getElementById('fontSizeDec');
        const incBtn = document.getElementById('fontSizeInc');
        const resetBtn = document.getElementById('fontSizeReset');
        if (!decBtn || !incBtn || !resetBtn) {
            return;
        }
        decBtn.addEventListener('click', function() {
            vscode.postMessage({ command: 'changePreviewFontSize', delta: -1 });
        });
        incBtn.addEventListener('click', function() {
            vscode.postMessage({ command: 'changePreviewFontSize', delta: 1 });
        });
        resetBtn.addEventListener('click', function() {
            vscode.postMessage({ command: 'changePreviewFontSize', reset: true });
        });
    }

    /** 绑定刷新预览按钮：请求扩展重新从磁盘读取文件并强制重渲染 */
    function initRefreshPreviewControl() {
        const refreshBtn = document.getElementById('refreshPreviewBtn');
        if (!refreshBtn) {
            return;
        }
        refreshBtn.addEventListener('click', function() {
            refreshBtn.disabled = true;
            // 显示全屏加载遮罩，给用户「正在刷新」的视觉反馈；渲染完成后由 updatePreviewContent 的 finally 隐藏
            if (window.PageLoading) {
                window.PageLoading.show();
            }
            vscode.postMessage({ command: 'refreshPreview' });
            // 兜底：若扩展侧读取失败未回推 updateContent，400ms 后恢复按钮可点；遮罩由渲染流程隐藏
            setTimeout(function() { refreshBtn.disabled = false; }, 400);
        });
    }

    /**
     * 核心预览编排：调用 renderCore.renderMarkdownToHtml(..., { sourceLines: true })
     * 后写入 DOM，并绑定 Mermaid 交互 / 标签跳转 / 查找恢复 / TOC。
     */
    async function updatePreviewContent(content) {
        if (!content || content.trim() === '') {
            previewArea.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 40px;">暂无内容</p>';
            rebuildToc();
            if (window.PageLoading) {
                window.PageLoading.hide();
            }
            return;
        }

        try {
            await initializationPromise;

            // 主管线已下沉至 markdownRenderCore（preview 顺序 + data-source-line）
            const finalHtmlWithSvg = await renderCore.renderMarkdownToHtml(
                content,
                availableTagNames,
                { sourceLines: true }
            );

            // 写入 DOM 并绑定交互
            previewArea.innerHTML = finalHtmlWithSvg || '<p>预览生成失败</p>';
            console.log("预览区域已更新");

            if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
                window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
            }

            // Mermaid 缩放/拖拽、标签跳转、搜索状态、TOC
            if (window.MermaidChartInteract) {
                window.MermaidChartInteract.initAll(previewArea, { fit: true, ensureId: false });
            }

            const tagLinks = previewArea.querySelectorAll('.tag-link');
            tagLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    if (e.altKey) {
                        return;
                    }
                    e.preventDefault();
                    const tagName = this.getAttribute('data-tag');
                    if (tagName) {
                        vscode.postMessage({
                            command: 'goToTagDeclaration',
                            tagName: tagName
                        });
                    }
                });
            });

            if (window.PreviewFind) {
                window.PreviewFind.restoreAfterRender();
            }
            rebuildToc();

        } catch (error) {
            console.error('预览更新失败:', error);
            previewArea.innerHTML =
                '<div class="mermaid-error">' +
                '<p>预览渲染失败</p>' +
                '<pre>' + error.message + '</pre>' +
                '</div>';
            rebuildToc();
        } finally {
            if (window.PageLoading) {
                window.PageLoading.notifyFirstRenderComplete();
            }
        }
    }

    // Mermaid 缩放/拖拽见 common/mermaidChartInteract.js（window.zoomChart / resetChart）
    // 全文搜索见 previewFind.js（window.PreviewFind）
    // 导出 HTML 见 previewExport.js（window.PreviewExport）

    // --- 与扩展主进程通信（updateContent / 字体 / Mermaid 主题）---

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateContent':
                if (message.content !== undefined) {
                    if (message.content === window.markdownContent && message.tagNames === undefined) {
                        break;
                    }
                    window.markdownContent = message.content;
                    // 如果消息中包含更新的标签列表，一并更新
                    if (message.tagNames && Array.isArray(message.tagNames)) {
                        availableTagNames = message.tagNames;
                    }
                    updatePreview(message.content);
                }
                break;
            case 'setPreviewFontSize':
                if (message.fontSize && message.fontSize > 0) {
                    currentPreviewFontSize = message.fontSize;
                    if (typeof window.applyPreviewFontSize === 'function') {
                        window.applyPreviewFontSize(previewArea, message.fontSize);
                    }
                    updateFontSizeValueDisplay(message.fontSize);
                }
                break;
            case 'setMermaidTheme':
                if (message.theme === currentMermaidTheme) {
                    break;
                }
                try {
                    const isHandDrawn = message.theme === 'hand-drawn';
                    if (renderCore.reinitializeMermaid({
                        handDrawnEnabled: isHandDrawn,
                        theme: isHandDrawn ? undefined : message.theme
                    })) {
                        currentMermaidTheme = message.theme;
                        if (window.markdownContent) {
                            updatePreview(window.markdownContent);
                        }
                    } else {
                        currentMermaidTheme = message.theme;
                    }
                } catch (error) {
                    console.error('设置Mermaid主题失败:', error);
                    currentMermaidTheme = message.theme;
                }
                break;
            case 'setAvailableTags':
                if (message.tagNames && Array.isArray(message.tagNames)) {
                    if (tagsEqual(message.tagNames, availableTagNames)) {
                        break;
                    }
                    availableTagNames = message.tagNames;
                    if (window.markdownContent) {
                        updatePreview(window.markdownContent);
                    }
                }
                break;
            case 'exportHtmlComplete':
                if (window.PreviewExport) {
                    window.PreviewExport.handleExportComplete(message.success, message.error);
                }
                break;
        }
    });

    /** Alt+单击跳源码时忽略控件/按钮，避免误触缩放与菜单 */
    function isSourceJumpBlockedTarget(element) {
        return element.closest('.mermaid-controls')
            || element.closest('.preview-action-menu')
            || element.closest('.export-actions')
            || element.closest('button');
    }

    // Alt+单击带 data-source-line 的块 → 扩展侧跳转到对应源码行
    previewArea.addEventListener('click', function(e) {
        if (!e.altKey) {
            return;
        }
        if (isSourceJumpBlockedTarget(e.target)) {
            return;
        }
        const el = e.target.closest('[data-source-line]');
        if (!el) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const line = resolveSourceLine(el);
        if (line === null || line < 0) {
            return;
        }
        vscode.postMessage({
            command: 'goToSourceLine',
            line: line
        });
    });

    /** 页面加载后首次渲染（内容来自 preview.html 内嵌的 #markdownContent） */
    function initializePreview() {
        if (window.markdownContent) {
            updatePreview(window.markdownContent);
        } else {
            console.log('window.markdownContent 不存在或为空');
            if (window.PageLoading) {
                window.PageLoading.notifyFirstRenderComplete();
            }
        }
    }

    // --- 启动：导出、菜单、TOC、搜索、首次渲染 ---
    if (window.PreviewExport) {
        window.PreviewExport.init({
            vscode: vscode,
            previewArea: previewArea,
            renderCore: renderCore,
            getPreviewFontSize: function() { return currentPreviewFontSize; },
            getRenderPromise: function() { return previewRenderPromise; },
            updatePreview: updatePreview
        });
    }

    initActionMenuControls();
    initFontSizeControls();
    initRefreshPreviewControl();
    // 主动请求配置推送，兜底扩展侧 setTimeout(0) 推送时 webview 尚未就绪导致字号等丢失
    vscode.postMessage({ command: 'requestPreviewConfig' });
    if (currentPreviewFontSize) {
        updateFontSizeValueDisplay(currentPreviewFontSize);
    }
    if (window.PreviewToc) {
        window.PreviewToc.init({ previewArea: previewArea, vscode: vscode });
    }
    if (window.PreviewFind) {
        window.PreviewFind.init({ previewArea: previewArea });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePreview);
    } else {
        initializePreview();
    }
})();
