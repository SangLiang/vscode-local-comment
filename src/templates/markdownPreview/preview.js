/**
 * Markdown 文件预览 Webview 脚本
 *
 * 职责：将 Markdown 渲染为 HTML（Mermaid / KaTeX / 代码高亮），支持图表缩放拖拽，以及导出自包含 HTML。
 * 渲染顺序：先异步渲染 Mermaid → KaTeX（跳过代码块）→ marked → 再把 Mermaid 占位块替换为 SVG。
 */
(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    let markedInitialized = false;
    let mermaidInitialized = false;
    let currentPreviewFontSize = null;
    /** 最近一次预览渲染的 Promise，导出前需 await，避免 Mermaid 尚未写入 DOM */
    let previewRenderPromise = Promise.resolve();

    /** 从源码中提取 ```mermaid 围栏（支持 CRLF） */
    const MERMAID_FENCE_REGEX = /```mermaid\s*\r?\n([\s\S]*?)```/gi;
    /** marked 输出的 Mermaid 占位 <pre>，用于替换为已渲染的 SVG */
    const MERMAID_CODE_BLOCK_HTML_REGEX = /<pre><code class="[^"]*\blanguage-mermaid\b[^"]*">[\s\S]*?<\/code><\/pre>/gi;
    // 等待 marked / mermaid / highlight.js 就绪后再渲染
    const initializationPromise = Promise.all([waitForMarked(), waitForMermaid(), (typeof window.waitForHighlight === 'function' ? window.waitForHighlight() : Promise.resolve())])
        .then(() => {
            console.log('所有库初始化成功');
        })
        .catch(error => {
            console.error("关键库初始化失败:", error);
            previewArea.innerHTML = '<p style="color:red;">预览组件加载失败: ' + error.message + '</p>';
            throw error;
        });

    /** 配置 marked：mermaid 块不走高亮，其余代码块走 highlight.js */
    function initializeMarked() {
        let markedObj = marked;
        if (typeof markedObj === 'undefined' && typeof window !== 'undefined') {
            markedObj = window.marked;
        }
        if (typeof markedObj === 'undefined' && typeof global !== 'undefined') {
            markedObj = global.marked;
        }

        let markdownParser = null;

        if (typeof markedObj === 'object' && markedObj !== null) {
            if (typeof markedObj.parse === 'function') {
                markdownParser = markedObj.parse;
            } else if (typeof markedObj.render === 'function') {
                markdownParser = markedObj.render;
            } else if (typeof markedObj.marked === 'function') {
                markdownParser = markedObj.marked;
            } else if (typeof markedObj.default === 'function') {
                markdownParser = markedObj.default;
            }
        }

        if (markdownParser && !markedInitialized) {
            try {
                let renderer = null;
                if (typeof markedObj.Renderer !== 'undefined') {
                    renderer = new markedObj.Renderer();
                } else if (typeof markedObj.renderer !== 'undefined') {
                    renderer = markedObj.renderer;
                }

                if (renderer) {
                    const originalCode = renderer.code || function(code, language) {
                        return '<pre><code' + (language ? ' class="language-' + language + '"' : '') + '>' + code + '</code></pre>';
                    };

                    renderer.code = function(code, language) {
                        // 保留占位结构，后续用 MERMAID_CODE_BLOCK_HTML_REGEX 整体替换为 SVG
                        if (language === 'mermaid') {
                            return '<pre><code class="language-mermaid">' + code + '</code></pre>';
                        }
                        if (typeof hljs !== 'undefined') {
                            try {
                                if (language && hljs.getLanguage(language)) {
                                    const highlighted = hljs.highlight(code, { language: language }).value;
                                    return '<pre><code class="hljs language-' + language + '">' + highlighted + '</code></pre>';
                                } else {
                                    const result = hljs.highlightAuto(code);
                                    const langClass = result.language ? ' language-' + result.language : '';
                                    return '<pre><code class="hljs' + langClass + '">' + result.value + '</code></pre>';
                                }
                            } catch (error) {
                                console.warn('代码高亮失败:', error);
                                return originalCode.call(this, code, language);
                            }
                        } else {
                            return originalCode.call(this, code, language);
                        }
                    };
                }

                const options = {
                    breaks: true,
                    gfm: true,
                    sanitize: false
                };
                if (renderer) {
                    options.renderer = renderer;
                }

                if (typeof markedObj.setOptions === 'function') {
                    markedObj.setOptions(options);
                }
                if (typeof window !== 'undefined') {
                    window.marked = markedObj;
                }
                marked = markedObj;
                window.markdownParser = markdownParser;
                markedInitialized = true;
                return true;
            } catch (error) {
                console.error('marked 初始化失败:', error);
                return false;
            }
        }
        return false;
    }

    function waitForMarked() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 50;
            let attempts = 0;

            const checkMarked = () => {
                attempts++;
                if (initializeMarked()) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('marked 库加载超时'));
                } else {
                    setTimeout(checkMarked, 100);
                }
            };
            checkMarked();
        });
    }

    /** 构建 mermaid.initialize 配置，handDrawn 对应设置项 hand-drawn */
    function buildMermaidConfig(handDrawnEnabled) {
        const config = {
            startOnLoad: false,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: handDrawnEnabled ? 'basis' : 'linear'
            },
            sequence: {
                useMaxWidth: true,
                diagramMarginX: 50,
                diagramMarginY: 10
            },
            gantt: {
                useMaxWidth: true
            },
            journey: {
                useMaxWidth: true
            },
            pie: {
                useMaxWidth: true
            },
            gitGraph: {
                useMaxWidth: true
            }
        };

        if (handDrawnEnabled) {
            config.look = 'handDrawn';
            config.handDrawn = {
                jitter: 5,
                roughness: 5,
                seed: 20
            };
        }

        return config;
    }

    function initializeMermaid(handDrawnEnabled) {
        if (typeof mermaid !== 'undefined' && typeof mermaid.initialize === 'function' && !mermaidInitialized) {
            try {
                const config = buildMermaidConfig(handDrawnEnabled);
                mermaid.initialize(config);
                mermaidInitialized = true;
                return true;
            } catch (error) {
                console.error('Mermaid初始化失败:', error);
                return false;
            }
        }
        return false;
    }

    function waitForMermaid() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 50;
            let attempts = 0;

            const checkMermaid = () => {
                attempts++;
                if (initializeMermaid()) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Mermaid 库加载超时'));
                } else {
                    setTimeout(checkMermaid, 100);
                }
            };
            checkMermaid();
        });
    }

    /** 对外入口：包装渲染任务，供导出流程等待完成 */
    async function updatePreview(content) {
        const renderTask = updatePreviewContent(content);
        previewRenderPromise = renderTask;
        return renderTask;
    }

    /** 核心预览管线 */
    async function updatePreviewContent(content) {
        if (!content || content.trim() === '') {
            previewArea.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 40px;">暂无内容</p>';
            return;
        }

        try {
            await initializationPromise;

            const tagPlaceholders = new Map();
            let processedContent = content.replace(/\$\{([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\}/g, (match, tagName) => {
                const placeholder = '__TAG_DECL_PLACEHOLDER_' + tagPlaceholders.size + '__';
                tagPlaceholders.set(placeholder, { original: match, tagName: tagName });
                return placeholder;
            });
            processedContent = processedContent.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g,
                '<span class="tag-link" data-tag="$1">@$1</span>');

            // 1. 查找并渲染所有Mermaid代码块
            MERMAID_FENCE_REGEX.lastIndex = 0;
            const mermaidBlocks = [...processedContent.matchAll(MERMAID_FENCE_REGEX)];
            console.log('找到 ' + mermaidBlocks.length + ' 个Mermaid代码块');

            const svgPromises = mermaidBlocks.map(async (match, index) => {
                const chartDefinition = match[1].trim();
                const chartId = 'mermaid-chart-' + Date.now() + '-' + index;
                try {
                    const { svg } = await mermaid.render(chartId, chartDefinition);
                    return buildMermaidChartHtml(chartId, svg);
                } catch (error) {
                    console.error('渲染Mermaid图表失败: ' + chartId, error);
                    return '<div class="mermaid-error">图表渲染失败: ' + error.message + '<pre>' + chartDefinition + '</pre></div>';
                }
            });

            const renderedSvgs = await Promise.all(svgPromises);

            // 2. 保留预处理后的 markdown，先做 LaTeX 处理（marked 不能解析 SVG 内的 <style>，故不在此处替换 Mermaid）
            let finalContent = processedContent;

            // 3. 处理 LaTeX 公式（跳过围栏/行内代码块，避免 Makefile 中 $(VAR) 被误渲染）
            if (typeof katex !== 'undefined') {
                try {
                    const maskFn = typeof window.maskMarkdownForKatex === 'function'
                        ? window.maskMarkdownForKatex
                        : null;
                    const unmaskFn = typeof window.unmaskMarkdownAfterKatex === 'function'
                        ? window.unmaskMarkdownAfterKatex
                        : null;
                    let katexInput = finalContent;
                    let codeBlocks = [];

                    if (maskFn && unmaskFn) {
                        const masked = maskFn(finalContent);
                        katexInput = masked.masked;
                        codeBlocks = masked.blocks;
                    }

                    katexInput = katexInput.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 块级公式渲染失败:', error);
                            return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                        }
                    });

                    katexInput = katexInput.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 行内公式渲染失败:', error);
                            return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                        }
                    });

                    finalContent = unmaskFn ? unmaskFn(katexInput, codeBlocks) : katexInput;
                } catch (error) {
                    console.error('LaTeX 公式处理失败:', error);
                }
            } else {
                console.warn('KaTeX 未加载，无法渲染 LaTeX 公式');
            }

            tagPlaceholders.forEach((tagInfo, placeholder) => {
                finalContent = finalContent.replace(placeholder,
                    '<span class="tag-declaration">' + tagInfo.original + '</span>');
            });

            // 4. 使用marked解析最终内容
            const finalHtml = marked.parse(finalContent);

            // 5. marked 解析后再将 Mermaid 代码块占位符替换为已渲染的 SVG
            // 避免把含 <style> 的 SVG 直接交给 marked，导致 style 内容被当成文本输出
            let svgIndex = 0;
            MERMAID_CODE_BLOCK_HTML_REGEX.lastIndex = 0;
            const finalHtmlWithSvg = finalHtml.replace(MERMAID_CODE_BLOCK_HTML_REGEX, () => {
                return renderedSvgs[svgIndex++] || '';
            });

            previewArea.innerHTML = finalHtmlWithSvg || '<p>预览生成失败</p>';
            console.log("预览区域已更新");

            if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
                window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
            }

            // 6. 绑定 Mermaid 缩放、拖拽
            initChartInteractions();

            const tagLinks = previewArea.querySelectorAll('.tag-link');
            tagLinks.forEach(link => {
                link.addEventListener('click', function(e) {
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

        } catch (error) {
            console.error('预览更新失败:', error);
            previewArea.innerHTML =
                '<div class="mermaid-error">' +
                '<p>预览渲染失败</p>' +
                '<pre>' + error.message + '</pre>' +
                '</div>';
        }
    }

    /** 生成带缩放控件的 Mermaid 图表 HTML（预览与导出共用结构） */
    function buildMermaidChartHtml(chartId, svg) {
        return '<div class="mermaid-chart" data-chart-id="' + chartId + '">' +
            '<div class="mermaid-controls">' +
            '<button type="button" class="mermaid-control-btn" title="放大" onclick="zoomChart(\'' + chartId + '\', 1.2)">+</button>' +
            '<button type="button" class="mermaid-control-btn" title="缩小" onclick="zoomChart(\'' + chartId + '\', 0.8)">−</button>' +
            '<button type="button" class="mermaid-control-btn" title="重置" onclick="resetChart(\'' + chartId + '\')">↺</button>' +
            '</div>' +
            '<div class="mermaid-zoom-info" id="zoom-info-' + chartId + '">100%</div>' +
            svg +
            '</div>';
    }

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

    // --- Mermaid 图表交互（Ctrl+滚轮缩放、拖拽平移，按钮见 window.zoomChart / resetChart）---

    function initChartInteractions() {
        const charts = document.querySelectorAll('.mermaid-chart');
        charts.forEach(chart => {
            const chartId = chart.dataset.chartId;
            if (chartId) {
                initChartState(chartId);
                setupChartWheelZoom(chartId);
                setupChartDrag(chartId);
            }
        });
    }

    function initChartState(chartId) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (chart) {
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
        }
    }

    function updateChartTransform(chartId) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (chart) {
            const scale = parseFloat(chart.dataset.scale) || 1;
            const translateX = parseFloat(chart.dataset.translateX) || 0;
            const translateY = parseFloat(chart.dataset.translateY) || 0;

            const svg = chart.querySelector('svg');
            if (svg) {
                svg.style.transformOrigin = '0 0';
                const transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
                svg.style.transform = transform;
            }

            if (scale > 1 || translateX !== 0 || translateY !== 0) {
                chart.classList.add('zoomed');
            } else {
                chart.classList.remove('zoomed');
            }
        }
    }

    function setupChartWheelZoom(chartId) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (!chart) return;

        chart.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return; // 与编辑器缩放区分，仅 Ctrl+滚轮缩放图表

            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const svg = chart.querySelector('svg');
            if (!svg) return;

            e.preventDefault();

            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomIntensity = 0.0005;
            const wheel = -e.deltaY;
            const factor = Math.exp(wheel * zoomIntensity);

            const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
            const ratio = newScale / currentScale;

            const currentTranslateX = parseFloat(chart.dataset.translateX) || 0;
            const currentTranslateY = parseFloat(chart.dataset.translateY) || 0;

            const newTranslateX = mouseX * (1 - ratio) + currentTranslateX * ratio;
            const newTranslateY = mouseY * (1 - ratio) + currentTranslateY * ratio;

            chart.dataset.scale = newScale.toString();
            chart.dataset.translateX = newTranslateX.toString();
            chart.dataset.translateY = newTranslateY.toString();

            updateChartTransform(chartId);

            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = Math.round(newScale * 100) + '%';
            }
        });
    }

    function setupChartDrag(chartId) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (!chart) return;

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startTranslateX = 0;
        let startTranslateY = 0;

        chart.addEventListener('mousedown', (e) => {
            if (e.target.closest('.mermaid-controls')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startTranslateX = parseFloat(chart.dataset.translateX) || 0;
            startTranslateY = parseFloat(chart.dataset.translateY) || 0;

            chart.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            const newTranslateX = startTranslateX + deltaX;
            const newTranslateY = startTranslateY + deltaY;

            chart.dataset.translateX = newTranslateX.toString();
            chart.dataset.translateY = newTranslateY.toString();
            updateChartTransform(chartId);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                chart.style.cursor = 'grab';
            }
        });

        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                chart.style.cursor = 'grab';
            }
        });
    }

    /** 供 Mermaid 控件按钮 onclick 调用 */
    window.resetChart = function(chartId) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (chart) {
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
            updateChartTransform(chartId);

            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = '100%';
            }
        }
    };

    window.zoomChart = function(chartId, factor) {
        const chart = document.querySelector('[data-chart-id="' + chartId + '"]');
        if (chart) {
            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const newScale = Math.max(0.1, Math.min(5, currentScale * factor));

            chart.dataset.scale = newScale.toString();
            updateChartTransform(chartId);

            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = Math.round(newScale * 100) + '%';
            }
        }
    };

    // --- 与扩展主进程通信（updateContent / 字体 / Mermaid 主题）---

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateContent':
                if (message.content !== undefined) {
                    window.markdownContent = message.content;
                    updatePreview(message.content);
                }
                break;
            case 'setPreviewFontSize':
                if (message.fontSize && message.fontSize > 0) {
                    currentPreviewFontSize = message.fontSize;
                    if (typeof window.applyPreviewFontSize === 'function') {
                        window.applyPreviewFontSize(previewArea, message.fontSize);
                    }
                }
                break;
            case 'setMermaidTheme':
                if (mermaidInitialized && typeof mermaid === 'object' && typeof mermaid.initialize === 'function') {
                    try {
                        const isHandDrawn = message.theme === 'hand-drawn';
                        const config = isHandDrawn ? buildMermaidConfig(true) : { theme: message.theme };
                        mermaid.initialize({
                            ...mermaid.defaultConfig,
                            ...config
                        });
                        if (window.markdownContent) {
                            updatePreview(window.markdownContent);
                        }
                    } catch (error) {
                        console.error('设置Mermaid主题失败:', error);
                    }
                }
                break;
        }
    });

    // --- 导出 HTML：克隆 DOM → 补渲染 → 内联样式变量 → postMessage 给扩展写盘 ---

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

            const chartId = 'mermaid-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
            try {
                const { svg } = await mermaid.render(chartId, chartDefinition);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = buildMermaidChartHtml(chartId, svg);
                const chart = wrapper.firstElementChild;
                pre.replaceWith(chart);
            } catch (error) {
                console.error('导出时渲染 Mermaid 失败:', chartId, error);
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

    /** 收集需由扩展侧 fs / axios 内联为 data URI 的图片路径 */
    function collectImagePaths(clone) {
        const localPaths = [];
        const remoteUrls = [];

        clone.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src');
            if (!src || src.startsWith('data:')) return;
            if (src.startsWith('http://') || src.startsWith('https://')) {
                remoteUrls.push(src);
            } else {
                localPaths.push(src);
            }
        });

        return { localPaths, remoteUrls };
    }

    /**
     * 准备导出：等待预览就绪 → 克隆 #previewArea → 清理/补全 Mermaid → 收集 CSS 与图片列表
     * 扩展侧收到 exportHtml 消息后负责内联资源并写文件（见 markdownPreviewWebview.ts）
     */
    async function prepareExportHtml() {
        try {
            await previewRenderPromise;
            if (window.markdownContent) {
                const hasUnrenderedMermaid = previewArea.querySelector('pre code.language-mermaid');
                if (hasUnrenderedMermaid) {
                    await updatePreview(window.markdownContent);
                    await previewRenderPromise;
                }
            }

            const clone = previewArea.cloneNode(true);
            await renderMermaidInElement(clone);
            prepareMermaidChartsForExport(clone);
            serializeMermaidSvgForExport(clone);
            resolveDomStyleVariables(clone);

            const css = collectStylesFromDocument(clone);
            const { localPaths, remoteUrls } = collectImagePaths(clone);
            const keepPrintBg = document.getElementById('keepPrintBg')?.checked ?? true;

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
        }
    }

    /** 页面加载后首次渲染（内容来自 preview.html 内嵌的 #markdownContent） */
    function initializePreview() {
        if (window.markdownContent) {
            updatePreview(window.markdownContent);
        } else {
            console.log('window.markdownContent 不存在或为空');
        }
    }

    const exportBtn = document.getElementById('exportHtmlBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            void prepareExportHtml();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePreview);
    } else {
        initializePreview();
    }
})();
