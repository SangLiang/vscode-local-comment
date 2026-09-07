/**
 * Markdown 预览页导出 HTML
 * 依赖页面已有 #previewArea / #exportHtmlBtn；由 preview.js 注入 vscode、renderCore 与渲染 Promise。
 * 导出 HTML 通过 mermaidExport.js 恢复图表交互。
 */
(function(global) {
    let vscode = null;
    let previewArea = null;
    let renderCore = null;
    let getPreviewFontSize = function() { return null; };
    let getRenderPromise = function() { return Promise.resolve(); };
    let updatePreview = async function() {};
    let initialized = false;
    let exportStartTime = 0;
    let exportBtnElement = null;
    let exportBtnOriginalText = '导出 HTML';
    let exportInProgress = false;

    /** 生成带缩放控件的 Mermaid 图表 HTML（委托共享 core） */
    function buildMermaidChartHtml(chartId, svg) {
        return renderCore.wrapMermaidChartHtml(chartId, svg);
    }

    /** 导出克隆节点上若缺少缩放控件则补齐（交互由导出页 mermaidExport.js 接管） */
    function appendMermaidControlsToChart(chart) {
        if (chart.querySelector('.mermaid-controls')) {
            return;
        }
        const chartId = chart.dataset.chartId || ('mermaid-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
        chart.dataset.chartId = chartId;

        const controls = document.createElement('div');
        controls.className = 'mermaid-controls';
        controls.innerHTML =
            '<button type="button" class="mermaid-control-btn" title="放大" onclick="zoomChart(\'' + chartId + '\', 1.2)">+</button>' +
            '<button type="button" class="mermaid-control-btn" title="缩小" onclick="zoomChart(\'' + chartId + '\', 0.8)">−</button>' +
            '<button type="button" class="mermaid-control-btn" title="重置" onclick="resetChart(\'' + chartId + '\')">↺</button>';

        const zoomInfo = document.createElement('div');
        zoomInfo.className = 'mermaid-zoom-info';
        zoomInfo.id = 'zoom-info-' + chartId;
        zoomInfo.textContent = '100%';

        chart.insertBefore(controls, chart.firstChild);
        chart.insertBefore(zoomInfo, controls.nextSibling);
    }

    /**
     * 导出兜底：克隆节点上若仍有未替换的 language-mermaid 代码块，在此补渲染为 SVG
     */
    async function renderMermaidInElement(root) {
        if (typeof mermaid === 'undefined' || typeof mermaid.render !== 'function') {
            return;
        }

        const codeBlocks = root.querySelectorAll('pre > code.language-mermaid');
        for (const codeEl of codeBlocks) {
            const pre = codeEl.closest('pre');
            if (!pre) continue;

            const chartDefinition = codeEl.textContent.trim();
            if (!chartDefinition) continue;

            try {
                const rendered = await renderCore.renderMermaidDefinition(chartDefinition, 'export');
                if (rendered.error || !rendered.svg) {
                    console.error('导出时渲染 Mermaid 失败:', rendered.error);
                    continue;
                }
                const wrapper = document.createElement('div');
                wrapper.innerHTML = buildMermaidChartHtml(rendered.chartId, rendered.svg);
                const chart = wrapper.firstElementChild;
                pre.replaceWith(chart);
            } catch (error) {
                console.error('导出时渲染 Mermaid 失败:', error);
            }
        }
    }

    /** 独立 HTML 文件中 SVG 需显式 xmlns，否则部分浏览器无法绘制 */
    function serializeMermaidSvgForExport(clone) {
        clone.querySelectorAll('.mermaid-chart svg').forEach(svg => {
            if (!svg.getAttribute('xmlns')) {
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            }
        });
    }

    /**
     * 导出前重置图表变换，保留缩放按钮；导出 HTML 通过 mermaidExport.js 恢复交互
     */
    function prepareMermaidChartsForExport(clone) {
        clone.querySelectorAll('.mermaid-chart').forEach(chart => {
            appendMermaidControlsToChart(chart);
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
            chart.style.cursor = 'grab';
            const svg = chart.querySelector('svg');
            if (svg) {
                svg.style.transform = '';
                svg.style.transformOrigin = '';
            }
            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = '100%';
            }
        });
    }

    /**
     * 导出前清理标签链接
     * @param clone 克隆的预览区域 DOM
     * @param hideTags 是否完全隐藏标签（true=完全删除，false=转为纯文本）
     * 导出的 HTML 在独立浏览器中无法使用 VS Code 的跳转功能，因此需要清理链接样式
     */
    function cleanTagLinksForExport(clone, hideTags = false) {
        clone.querySelectorAll('.tag-link').forEach(link => {
            if (hideTags) {
                link.remove();
            } else {
                const textNode = document.createTextNode(link.textContent);
                link.parentNode.replaceChild(textNode, link);
            }
        });
    }

    /**
     * 导出配色优先级（亮/暗均适用）：
     * 1. 预览 DOM 的 getComputedStyle（th/td/body，与肉眼所见一致）
     * 2. VS Code 注入的 --vscode-* 变量
     * 3. 按当前预览推断亮/暗后，选用下方 LIGHT / DARK 回退表
     */

    /** 亮色主题下 CSS 变量读不到时的回退（仅最后兜底，正常走 VS Code 注入值） */
    const VSCODE_CSS_VAR_FALLBACKS_LIGHT = {
        '--vscode-panel-border': '#c8c8c8',
        '--vscode-editorWidget-border': '#c8c8c8',
        '--vscode-textBlockQuote-border': '#c8c8c8',
        '--vscode-editor-inactiveSelectionBackground': '#f0f0f0',
        '--vscode-foreground': '#333333',
        '--vscode-editor-foreground': '#333333',
        '--vscode-editor-background': '#ffffff',
        '--vscode-descriptionForeground': '#717171',
        '--vscode-textLink-foreground': '#006ab1',
        '--vscode-textBlockQuote-foreground': '#717171',
        '--vscode-editor-font-family': 'Consolas, "Courier New", monospace',
        '--vscode-editor-font-size': '14px'
    };

    /** 暗色主题下 CSS 变量读不到时的回退 */
    const VSCODE_CSS_VAR_FALLBACKS_DARK = {
        '--vscode-panel-border': '#454545',
        '--vscode-editorWidget-border': '#454545',
        '--vscode-textBlockQuote-border': '#454545',
        '--vscode-editor-inactiveSelectionBackground': '#3a3d41',
        '--vscode-foreground': '#cccccc',
        '--vscode-editor-foreground': '#cccccc',
        '--vscode-editor-background': '#1e1e1e',
        '--vscode-descriptionForeground': '#999999',
        '--vscode-textLink-foreground': '#3794ff',
        '--vscode-textBlockQuote-foreground': '#999999',
        '--vscode-editor-font-family': 'Consolas, "Courier New", monospace',
        '--vscode-editor-font-size': '14px'
    };

    const EXPORT_TABLE_FALLBACKS_LIGHT = {
        thBackground: '#f0f0f0',
        borderColor: '#c8c8c8'
    };

    const EXPORT_TABLE_FALLBACKS_DARK = {
        thBackground: '#3a3d41',
        borderColor: '#454545'
    };

    function parseCssColorToRgb(color) {
        if (!color) return null;
        const trimmed = color.trim();
        const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        }
        const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgbMatch) {
            return {
                r: Number(rgbMatch[1]),
                g: Number(rgbMatch[2]),
                b: Number(rgbMatch[3])
            };
        }
        return null;
    }

    function isColorDark(color) {
        const rgb = parseCssColorToRgb(color);
        if (!rgb) return false;
        const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
        return luminance < 0.5;
    }

    /**
     * 判断当前预览是否为暗色主题：优先 color-scheme，再根据编辑器背景亮度推断
     */
    function isPreviewDarkTheme() {
        const colorScheme = getComputedStyle(document.body).colorScheme ||
            getComputedStyle(document.documentElement).colorScheme;
        if (colorScheme === 'dark') return true;
        if (colorScheme === 'light') return false;

        const editorBgVar = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() ||
            getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background').trim();
        const editorBgComputed = getComputedStyle(document.body).backgroundColor;
        const probe = editorBgVar || editorBgComputed;
        return isColorDark(probe);
    }

    function getVscodeCssVarFallbacks() {
        return isPreviewDarkTheme() ? VSCODE_CSS_VAR_FALLBACKS_DARK : VSCODE_CSS_VAR_FALLBACKS_LIGHT;
    }

    function getExportTableFallbacks() {
        return isPreviewDarkTheme() ? EXPORT_TABLE_FALLBACKS_DARK : EXPORT_TABLE_FALLBACKS_LIGHT;
    }

    /** 读取当前预览 Webview 中的 VS Code 主题色（与预览一致），读不到再按亮/暗主题回退 */
    function resolveThemeColor(varName, hardFallback) {
        let value = getComputedStyle(document.body).getPropertyValue(varName).trim() ||
            getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        const themeFallbacks = getVscodeCssVarFallbacks();
        if (!value && themeFallbacks[varName]) {
            value = themeFallbacks[varName];
        }
        return value || hardFallback;
    }

    /** 将 var(--vscode-*) 替换为 getComputedStyle 的实际值，便于脱离 VS Code 打开 */
    function resolveCssVariables(cssText) {
        const themeFallbacks = getVscodeCssVarFallbacks();
        return cssText.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (match, varName, fallbackInVar) => {
            let value = getComputedStyle(document.body).getPropertyValue(varName).trim() ||
                getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            if (!value && fallbackInVar) {
                value = fallbackInVar.trim();
            }
            if (!value && themeFallbacks[varName]) {
                value = themeFallbacks[varName];
            }
            return value || match;
        });
    }

    /**
     * 导出兜底：用预览时的主题色写死边框/表头背景，避免独立浏览器中 var() 失效。
     * 优先读预览 DOM 上 th/td 的 getComputedStyle，与肉眼所见一致。
     */
    function getExportTableStyles(clone) {
        if (!clone.querySelector('table')) {
            return '';
        }

        const sampleTh = previewArea.querySelector('th') || clone.querySelector('th');
        const sampleTd = previewArea.querySelector('td') || clone.querySelector('td');

        let thBackground = resolveThemeColor('--vscode-editor-inactiveSelectionBackground', '');
        if (sampleTh) {
            const computedBg = getComputedStyle(sampleTh).backgroundColor;
            if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
                thBackground = computedBg;
            }
        }
        const tableFallbacks = getExportTableFallbacks();
        if (!thBackground) {
            thBackground = tableFallbacks.thBackground;
        }

        let borderColor = resolveThemeColor('--vscode-panel-border', '');
        if (sampleTd) {
            const computedBorder = getComputedStyle(sampleTd).borderTopColor;
            if (computedBorder) {
                borderColor = computedBorder;
            }
        }
        if (!borderColor) {
            borderColor = tableFallbacks.borderColor;
        }

        return `
#previewArea table, table {
    border-collapse: collapse;
    width: 100%;
}
#previewArea th, #previewArea td, th, td {
    border: 1px solid ${borderColor};
    padding: 6px 12px;
}
#previewArea th, th {
    background-color: ${thBackground};
}
`;
    }

    /**
     * 导出兜底：从 #previewArea 读取当前计算后的字体/颜色（与预览、编辑器主题一致），
     * 写入独立 HTML，避免 var(--vscode-*) 在外部浏览器失效。
     */
    function getExportTypographyStyles() {
        const currentPreviewFontSize = getPreviewFontSize();
        if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
            window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
        }

        const areaStyle = getComputedStyle(previewArea);
        const sampleHeading = previewArea.querySelector('h1,h2,h3,h4,h5,h6');
        const sampleLink = previewArea.querySelector('a');
        const sampleBlockquote = previewArea.querySelector('blockquote');
        const sampleCode = previewArea.querySelector('pre code, pre, code.hljs');

        const fontFamily = areaStyle.fontFamily;
        const fontSize = areaStyle.fontSize;
        const color = areaStyle.color;
        const backgroundColor = areaStyle.backgroundColor;
        const lineHeight = areaStyle.lineHeight;
        const borderColor = resolveThemeColor('--vscode-panel-border', getExportTableFallbacks().borderColor);

        const headingColor = sampleHeading
            ? getComputedStyle(sampleHeading).color
            : resolveThemeColor('--vscode-editor-foreground', color);
        const linkColor = sampleLink
            ? getComputedStyle(sampleLink).color
            : resolveThemeColor('--vscode-textLink-foreground', isPreviewDarkTheme() ? '#3794ff' : '#006ab1');
        const blockquoteColor = sampleBlockquote
            ? getComputedStyle(sampleBlockquote).color
            : resolveThemeColor('--vscode-textBlockQuote-foreground', color);
        const codeFontFamily = sampleCode ? getComputedStyle(sampleCode).fontFamily : fontFamily;

        return `
body {
    font-family: ${fontFamily};
    font-size: ${fontSize};
    color: ${color};
    background-color: ${backgroundColor};
    line-height: ${lineHeight};
    margin: 0;
    padding: 0;
}
.container, .content-area {
    background-color: ${backgroundColor};
}
#previewArea, .preview-area {
    font-family: ${fontFamily};
    font-size: ${fontSize};
    color: ${color};
    background-color: ${backgroundColor};
    line-height: ${lineHeight};
    padding: 20px;
    border: 1px solid ${borderColor};
    border-radius: 4px;
    word-wrap: break-word;
}
#previewArea h1, #previewArea h2, #previewArea h3, #previewArea h4, #previewArea h5, #previewArea h6 {
    color: ${headingColor};
}
#previewArea a {
    color: ${linkColor};
}
#previewArea blockquote {
    color: ${blockquoteColor};
}
#previewArea code, #previewArea pre, #previewArea pre code {
    font-family: ${codeFontFamily};
}
`;
    }

    /** 处理克隆节点上的内联 style 及嵌入的 <style> 标签中的 CSS 变量 */
    function resolveDomStyleVariables(clone) {
        clone.querySelectorAll('[style]').forEach(el => {
            el.setAttribute('style', resolveCssVariables(el.getAttribute('style')));
        });
        clone.querySelectorAll('style').forEach(tag => {
            tag.textContent = resolveCssVariables(tag.textContent);
        });
    }

    /**
     * 收集当前页已加载的样式表文本；按 DOM 内容按需跳过 KaTeX / hljs / mermaid 相关表以减小体积
     */
    function shouldIncludeStylesheet(raw, clone) {
        if (raw.includes('.katex') && !clone.querySelector('.katex')) return false;
        if (raw.includes('.hljs') && !clone.querySelector('.hljs')) return false;
        if (raw.includes('.mermaid-chart') && !clone.querySelector('.mermaid-chart')) return false;
        return true;
    }

    function appendStylesheetRules(sheet, clone, parts, visited) {
        if (!sheet || visited.has(sheet)) return;
        visited.add(sheet);

        try {
            const rules = sheet.cssRules;
            for (let i = 0; i < rules.length; i++) {
                const imported = rules[i].styleSheet;
                if (imported) {
                    appendStylesheetRules(imported, clone, parts, visited);
                }
            }

            const raw = Array.from(rules).map(r => r.cssText).join('\n');
            if (raw && shouldIncludeStylesheet(raw, clone)) {
                parts.push(resolveCssVariables(raw));
            }
        } catch {
            // 跨域 <link> 无法读取 cssRules，忽略
        }
    }

    function collectStylesFromDocument(clone) {
        const parts = [];
        const visited = new Set();

        for (const sheet of document.styleSheets) {
            appendStylesheetRules(sheet, clone, parts, visited);
        }

        parts.push(getExportTypographyStyles());

        const tableStyles = getExportTableStyles(clone);
        if (tableStyles) {
            parts.push(tableStyles);
        }

        return parts.join('\n');
    }

    /**
     * 判断是否为 VS Code webview 资源 URI。
     * 新版 asWebviewUri 生成 `https://file%2B.vscode-resource.vscode-cdn.net/...`，
     * 以 https 开头但并非真实可远程访问的 URL，导出时须按本地文件内联为 base64。
     */
    function isVscodeResourceUri(src) {
        return src.startsWith('vscode-webview-resource:')
            || src.startsWith('vscode-resource:')
            || /^https?:\/\/[^/]*vscode-resource[^/]*\//i.test(src);
    }

    /** 收集需由扩展侧 fs / axios 内联为 data URI 的图片路径 */
    function collectImagePaths(clone) {
        const localPaths = [];
        const remoteUrls = [];

        clone.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (!src || src.startsWith('data:')) return;
            if (isVscodeResourceUri(src)) {
                localPaths.push(src);
            } else if (src.startsWith('http://') || src.startsWith('https://')) {
                remoteUrls.push(src);
            } else {
                localPaths.push(src);
            }
        });

        return { localPaths, remoteUrls };
    }

    /**
     * 设置导出按钮加载状态
     */
    function setExportBtnLoading(isLoading) {
        const exportBtn = document.getElementById('exportHtmlBtn');
        if (!exportBtn) return;

        if (isLoading) {
            exportBtnElement = exportBtn;
            exportBtnOriginalText = exportBtn.textContent.trim() || '导出 HTML';
            exportInProgress = true;
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="loading-spinner"></span> 导出中...';
            exportBtn.offsetHeight;
        } else {
            exportInProgress = false;
            exportBtn.disabled = false;
            exportBtn.textContent = exportBtnOriginalText;
        }
    }

    /**
     * 准备导出：等待预览就绪 → 克隆 #previewArea → 清理/补全 Mermaid → 收集 CSS 与图片列表
     * 扩展侧收到 exportHtml 消息后负责内联资源并写文件（见 markdownPreviewWebview.ts）
     */
    async function prepareExportHtml() {
        if (exportInProgress) return;

        exportStartTime = Date.now();

        try {
            setExportBtnLoading(true);

            await getRenderPromise();
            if (window.markdownContent) {
                const hasUnrenderedMermaid = previewArea.querySelector('pre code.language-mermaid');
                if (hasUnrenderedMermaid) {
                    await updatePreview(window.markdownContent);
                    await getRenderPromise();
                }
            }

            const clone = previewArea.cloneNode(true);
            if (global.PreviewFind && typeof global.PreviewFind.unwrapMarks === 'function') {
                global.PreviewFind.unwrapMarks(clone);
            }
            await renderMermaidInElement(clone);
            prepareMermaidChartsForExport(clone);
            serializeMermaidSvgForExport(clone);

            const keepPrintBg = document.getElementById('keepPrintBg')?.checked ?? true;

            cleanTagLinksForExport(clone, true);
            resolveDomStyleVariables(clone);

            const css = collectStylesFromDocument(clone);
            const { localPaths, remoteUrls } = collectImagePaths(clone);

            vscode.postMessage({
                command: 'exportHtml',
                html: clone.outerHTML,
                css: css,
                localImagePaths: localPaths,
                remoteImageUrls: remoteUrls,
                hasKatex: !!clone.querySelector('.katex'),
                hasMermaid: !!clone.querySelector('.mermaid-chart'),
                fileName: document.querySelector('.title')?.textContent || 'export',
                keepPrintBg: keepPrintBg
            });
        } catch (error) {
            console.error('准备导出 HTML 失败:', error);
            const MIN_LOADING_TIME = 500;
            const elapsed = Date.now() - (exportStartTime || 0);
            const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);
            setTimeout(() => setExportBtnLoading(false), remainingDelay);
        }
    }

    /**
     * 处理导出完成消息
     */
    function handleExportComplete(success, error) {
        const MIN_LOADING_TIME = 500;
        const elapsed = Date.now() - (exportStartTime || 0);
        const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);

        setTimeout(() => {
            setExportBtnLoading(false);
            if (error) {
                console.error('导出失败:', error);
            }
        }, remainingDelay);
    }

    function bindExportButton() {
        const exportBtn = document.getElementById('exportHtmlBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                void prepareExportHtml();
            });
        }
    }

    /**
     * @param {{
     *   vscode?: { postMessage: Function },
     *   previewArea?: HTMLElement,
     *   renderCore?: { wrapMermaidChartHtml: Function, renderMermaidDefinition: Function },
     *   getPreviewFontSize?: Function,
     *   getRenderPromise?: Function,
     *   updatePreview?: Function
     * }} options
     */
    function init(options) {
        if (initialized) {
            return;
        }
        const opts = options || {};
        vscode = opts.vscode || null;
        previewArea = opts.previewArea || document.getElementById('previewArea');
        renderCore = opts.renderCore || (global.MarkdownRenderCore ? global.MarkdownRenderCore.create() : null);
        if (typeof opts.getPreviewFontSize === 'function') {
            getPreviewFontSize = opts.getPreviewFontSize;
        }
        if (typeof opts.getRenderPromise === 'function') {
            getRenderPromise = opts.getRenderPromise;
        }
        if (typeof opts.updatePreview === 'function') {
            updatePreview = opts.updatePreview;
        }
        bindExportButton();
        initialized = true;
    }

    global.PreviewExport = {
        init: init,
        handleExportComplete: handleExportComplete
    };
})(typeof window !== 'undefined' ? window : this);
