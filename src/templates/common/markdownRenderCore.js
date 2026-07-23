/**
 * Markdown 渲染核心（Webview 共用）
 *
 * 供 commentInput / shareComment 等页面调用：只负责 Markdown → HTML 字符串，
 * 不负责写入 DOM、IPC、滚动同步或 Mermaid 缩放交互（zoomChart 仍由各页面挂载）。
 *
 * 依赖（须先于本脚本加载）：marked、mermaid、katex；highlight 可选（via waitForHighlight）。
 *
 * 用法：
 *   var core = window.MarkdownRenderCore.create({ handDrawnEnabled: false });
 *   await core.waitForLibs();
 *   var html = await core.renderMarkdownToHtml(markdownText);
 *   // 主题切换：core.reinitializeMermaid({ handDrawnEnabled: true })
 *
 * 渲染顺序（勿随意调换）：
 *   1. ${标签} 占位（避免被 KaTeX 的 $ 正则误伤）
 *   2. @标签 → span.tag-link
 *   3. 提取 ```mermaid，并行 mermaid.render，控件 HTML 暂存
 *   4. KaTeX $$ / $
 *   5. 恢复标签声明 HTML
 *   6. marked.parse
 *   7. 将 language-mermaid 代码块换为已渲染 SVG（避免 SVG 内 <style> 被 marked 当文本）
 */
(function (global) {
    'use strict';

    /** @param {boolean} handDrawnEnabled */
    function buildMermaidConfig(handDrawnEnabled) {
        var config = {
            startOnLoad: false,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true
            },
            gantt: {
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

    /**
     * 包装 Mermaid SVG；缩放按钮依赖页面全局 zoomChart / resetChart。
     * @param {string} chartId
     * @param {string} svg
     */
    function wrapMermaidSvg(chartId, svg) {
        return '<div class="mermaid-chart" data-chart-id="' + chartId + '">' +
            '<div class="mermaid-controls">' +
            '<button class="mermaid-control-btn" title="放大" onclick="zoomChart(\'' + chartId + '\', 1.2)">+</button>' +
            '<button class="mermaid-control-btn" title="缩小" onclick="zoomChart(\'' + chartId + '\', 0.8)">−</button>' +
            '<button class="mermaid-control-btn" title="重置" onclick="resetChart(\'' + chartId + '\')">↺</button>' +
            '</div>' +
            '<div class="mermaid-zoom-info" id="zoom-info-' + chartId + '">100%</div>' +
            svg +
            '</div>';
    }

    /**
     * 创建渲染实例（每 Webview 面板一个，避免初始化状态互相覆盖）。
     * @param {{ handDrawnEnabled?: boolean }} [options]
     * @returns {{
     *   waitForLibs: () => Promise<void>,
     *   renderMarkdownToHtml: (content: string) => Promise<string>,
     *   reinitializeMermaid: (opts?: { handDrawnEnabled?: boolean }) => boolean
     * }}
     */
    function create(options) {
        options = options || {};
        var markedInitialized = false;
        var mermaidInitialized = false;
        var handDrawnEnabled = !!options.handDrawnEnabled;
        /** 缓存首次 waitForLibs，避免重复轮询 */
        var libsPromise = null;

        function initializeMarked() {
            if (typeof marked === 'undefined' || markedInitialized) {
                return markedInitialized;
            }
            var renderer = new marked.Renderer();
            var originalCode = renderer.code;
            renderer.code = function (code, language) {
                // mermaid 不交给 highlight.js，否则 language-mermaid 会被覆盖，后续无法替换 SVG
                if (language === 'mermaid') {
                    return '<pre><code class="language-mermaid">' + code + '</code></pre>';
                }
                if (!language) {
                    return originalCode.call(this, code, language);
                }
                if (typeof hljs !== 'undefined') {
                    try {
                        if (hljs.getLanguage(language)) {
                            var highlighted = hljs.highlight(code, { language: language }).value;
                            return '<pre><code class="hljs language-' + language + '">' + highlighted + '</code></pre>';
                        }
                        var result = hljs.highlightAuto(code);
                        return '<pre><code class="hljs language-' + result.language + '">' + result.value + '</code></pre>';
                    } catch (error) {
                        console.warn('代码高亮失败:', error);
                        return originalCode.call(this, code, language);
                    }
                }
                return originalCode.call(this, code, language);
            };
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false,
                renderer: renderer
            });
            markedInitialized = true;
            return true;
        }

        function waitForMarked() {
            return new Promise(function (resolve) {
                function check() {
                    if (initializeMarked()) {
                        resolve();
                    } else {
                        setTimeout(check, 100);
                    }
                }
                check();
            });
        }

        /**
         * @param {boolean} [handDrawn] 传入则更新手绘开关后再 initialize
         */
        function initializeMermaid(handDrawn) {
            if (typeof handDrawn === 'boolean') {
                handDrawnEnabled = handDrawn;
            }
            if (typeof mermaid === 'undefined') {
                return false;
            }
            mermaid.initialize(buildMermaidConfig(handDrawnEnabled));
            mermaidInitialized = true;
            return true;
        }

        function waitForMermaid() {
            return new Promise(function (resolve, reject) {
                var attempts = 0;
                var maxAttempts = 50; // 约 5s
                function check() {
                    attempts++;
                    if (typeof mermaid !== 'undefined') {
                        if (initializeMermaid()) {
                            resolve();
                            return;
                        }
                    }
                    if (attempts >= maxAttempts) {
                        reject(new Error('mermaid库加载超时'));
                    } else {
                        setTimeout(check, 100);
                    }
                }
                check();
            });
        }

        /** 等待 marked / mermaid / highlight 就绪（可重复调用，共用同一 Promise） */
        function waitForLibs() {
            if (!libsPromise) {
                libsPromise = Promise.all([
                    waitForMarked(),
                    waitForMermaid(),
                    typeof global.waitForHighlight === 'function'
                        ? global.waitForHighlight()
                        : Promise.resolve()
                ]);
            }
            return libsPromise;
        }

        /**
         * 在 marked.parse 之前处理 LaTeX：先块级 $$，再行内 $，避免互相误匹配。
         * @param {string} finalContent
         */
        function applyKatex(finalContent) {
            if (typeof katex === 'undefined') {
                console.warn('KaTeX 未加载，无法渲染 LaTeX 公式');
                return finalContent;
            }
            try {
                finalContent = finalContent.replace(/\$\$([\s\S]*?)\$\$/g, function (match, formula) {
                    try {
                        return katex.renderToString(formula.trim(), {
                            displayMode: true,
                            throwOnError: false
                        });
                    } catch (error) {
                        console.error('KaTeX 块级公式渲染失败:', error);
                        return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                    }
                });
                finalContent = finalContent.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, function (match, formula) {
                    try {
                        return katex.renderToString(formula.trim(), {
                            displayMode: false,
                            throwOnError: false
                        });
                    } catch (error) {
                        console.error('KaTeX 行内公式渲染失败:', error);
                        return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                    }
                });
            } catch (error) {
                console.error('LaTeX 公式处理失败:', error);
            }
            return finalContent;
        }

        /**
         * Markdown → HTML（含标签、KaTeX、Mermaid）。单块 Mermaid 失败不阻断整页。
         * @param {string} content
         * @returns {Promise<string>}
         */
        async function renderMarkdownToHtml(content) {
            await waitForLibs();

            // ${标签} 先占位，支持中文标签名
            var tagPlaceholders = new Map();
            var processedContent = String(content).replace(
                /\$\{([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\}/g,
                function (match, tagName) {
                    var placeholder = '__TAG_DECL_PLACEHOLDER_' + tagPlaceholders.size + '__';
                    tagPlaceholders.set(placeholder, { original: match, tagName: tagName });
                    return placeholder;
                }
            );

            // @引用；点击跳转由页面绑定 .tag-link
            processedContent = processedContent.replace(
                /@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g,
                '<span class="tag-link" data-tag="$1" style="color: var(--vscode-symbolIcon-functionForeground); font-weight: bold; cursor: pointer; text-decoration: underline;">@$1</span>'
            );

            // Mermaid：先渲染 SVG，围栏原文留给 marked，解析后再替换
            var mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
            var mermaidBlocks = Array.from(processedContent.matchAll(mermaidRegex));
            var renderedSvgs = await Promise.all(mermaidBlocks.map(async function (match, index) {
                var chartDefinition = match[1].trim();
                var chartId = 'mermaid-chart-' + Date.now() + '-' + index;
                try {
                    var result = await mermaid.render(chartId, chartDefinition);
                    return wrapMermaidSvg(chartId, result.svg);
                } catch (error) {
                    console.error('渲染Mermaid图表失败: ' + chartId, error);
                    return '<div class="mermaid-error">图表渲染失败: ' + error.message +
                        '<pre>' + chartDefinition + '</pre></div>';
                }
            }));

            var finalContent = applyKatex(processedContent);
            tagPlaceholders.forEach(function (tagInfo, placeholder) {
                finalContent = finalContent.replace(
                    placeholder,
                    '<span class="tag-declaration" style="color: var(--vscode-symbolIcon-variableForeground); font-weight: bold;">' +
                        tagInfo.original + '</span>'
                );
            });

            var finalHtml = marked.parse(finalContent);
            var svgIndex = 0;
            var mermaidCodeBlockRegex = /<pre><code class="language-mermaid">[\s\S]*?<\/code><\/pre>/g;
            return finalHtml.replace(mermaidCodeBlockRegex, function () {
                return renderedSvgs[svgIndex++] || '';
            });
        }

        /**
         * 切换手绘/主题后调用；会清空 libsPromise，下次 waitForLibs / render 可重新走初始化。
         * @param {{ handDrawnEnabled?: boolean }} [opts]
         */
        function reinitializeMermaid(opts) {
            opts = opts || {};
            libsPromise = null;
            mermaidInitialized = false;
            return initializeMermaid(!!opts.handDrawnEnabled);
        }

        return {
            waitForLibs: waitForLibs,
            renderMarkdownToHtml: renderMarkdownToHtml,
            reinitializeMermaid: reinitializeMermaid
        };
    }

    global.MarkdownRenderCore = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
