(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    let markedInitialized = false;
    let mermaidInitialized = false;
    let currentPreviewFontSize = null;

    const initializationPromise = Promise.all([waitForMarked(), waitForMermaid(), (typeof window.waitForHighlight === 'function' ? window.waitForHighlight() : Promise.resolve())])
        .then(() => {
            console.log('所有库初始化成功');
        })
        .catch(error => {
            console.error("关键库初始化失败:", error);
            previewArea.innerHTML = '<p style="color:red;">预览组件加载失败: ' + error.message + '</p>';
            throw error;
        });

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

    async function updatePreview(content) {
        if (!content || content.trim() === '') {
            previewArea.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 40px;">暂无内容</p>';
            return;
        }

        try {
            await initializationPromise;

            // 1. 查找并渲染所有Mermaid代码块
            const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
            const mermaidBlocks = [...content.matchAll(mermaidRegex)];
            console.log('找到 ' + mermaidBlocks.length + ' 个Mermaid代码块');

            const svgPromises = mermaidBlocks.map(async (match, index) => {
                const chartDefinition = match[1].trim();
                const chartId = 'mermaid-chart-' + Date.now() + '-' + index;
                try {
                    const { svg } = await mermaid.render(chartId, chartDefinition);
                    return '<div class="mermaid-chart" data-chart-id="' + chartId + '">' +
                        '<div class="mermaid-controls">' +
                        '<button class="mermaid-control-btn" title="放大" onclick="zoomChart(\'' + chartId + '\', 1.2)">+</button>' +
                        '<button class="mermaid-control-btn" title="缩小" onclick="zoomChart(\'' + chartId + '\', 0.8)">−</button>' +
                        '<button class="mermaid-control-btn" title="重置" onclick="resetChart(\'' + chartId + '\')">↺</button>' +
                        '</div>' +
                        '<div class="mermaid-zoom-info" id="zoom-info-' + chartId + '">100%</div>' +
                        svg +
                        '</div>';
                } catch (error) {
                    console.error('渲染Mermaid图表失败: ' + chartId, error);
                    return '<div class="mermaid-error">图表渲染失败: ' + error.message + '<pre>' + chartDefinition + '</pre></div>';
                }
            });

            const renderedSvgs = await Promise.all(svgPromises);

            // 2. 替换Mermaid代码块为SVG
            let finalContent = content;
            let svgIndex = 0;
            finalContent = finalContent.replace(mermaidRegex, () => {
                return renderedSvgs[svgIndex++];
            });

            // 3. 处理 LaTeX 公式
            if (typeof katex !== 'undefined') {
                try {
                    finalContent = finalContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 块级公式渲染失败:', error);
                            return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                        }
                    });

                    finalContent = finalContent.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 行内公式渲染失败:', error);
                            return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                        }
                    });
                } catch (error) {
                    console.error('LaTeX 公式处理失败:', error);
                }
            } else {
                console.warn('KaTeX 未加载，无法渲染 LaTeX 公式');
            }

            // 4. 使用marked解析最终内容
            const finalHtml = marked.parse(finalContent);

            previewArea.innerHTML = finalHtml || '<p>预览生成失败</p>';
            console.log("预览区域已更新");

            if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
                window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
            }

            // 5. 初始化图表交互
            initChartInteractions();

        } catch (error) {
            console.error('预览更新失败:', error);
            previewArea.innerHTML =
                '<div class="mermaid-error">' +
                '<p>预览渲染失败</p>' +
                '<pre>' + error.message + '</pre>' +
                '</div>';
        }
    }

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
            if (!e.ctrlKey) return;

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

    // 监听来自扩展的消息
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

    function cleanMermaidControls(clone) {
        clone.querySelectorAll('.mermaid-controls, .mermaid-zoom-info').forEach(el => el.remove());
        clone.querySelectorAll('.mermaid-chart').forEach(chart => {
            chart.removeAttribute('data-scale');
            chart.removeAttribute('data-translate-x');
            chart.removeAttribute('data-translate-y');
            chart.style.cursor = '';
            const svg = chart.querySelector('svg');
            if (svg) {
                svg.style.transform = '';
                svg.style.transformOrigin = '';
            }
        });
    }

    function resolveCssVariables(cssText) {
        return cssText.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (match, varName, fallback) => {
            const value = getComputedStyle(document.body).getPropertyValue(varName).trim() ||
                          getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
            return value || fallback || match;
        });
    }

    function resolveDomStyleVariables(clone) {
        clone.querySelectorAll('[style]').forEach(el => {
            el.setAttribute('style', resolveCssVariables(el.getAttribute('style')));
        });
        clone.querySelectorAll('style').forEach(tag => {
            tag.textContent = resolveCssVariables(tag.textContent);
        });
    }

    function collectStylesFromDocument(clone) {
        const parts = [];

        for (const sheet of document.styleSheets) {
            try {
                const raw = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');

                if (raw.includes('.katex') && !clone.querySelector('.katex')) continue;
                if (raw.includes('.hljs') && !clone.querySelector('.hljs')) continue;

                parts.push(resolveCssVariables(raw));
            } catch {
            }
        }

        return parts.join('\n');
    }

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

    function prepareExportHtml() {
        const clone = previewArea.cloneNode(true);

        cleanMermaidControls(clone);
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
            fileName: document.querySelector('.title')?.textContent || 'export',
            keepPrintBg: keepPrintBg
        });
    }

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
            prepareExportHtml();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePreview);
    } else {
        initializePreview();
    }
})();
