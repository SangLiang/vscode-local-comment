/**
 * Markdown 文件预览 Webview 脚本
 *
 * 职责：将 Markdown 渲染为 HTML（Mermaid / KaTeX / 代码高亮）；
 * TOC 委托 previewToc.js；Mermaid 缩放拖拽委托 mermaidChartInteract.js；
 * 全文搜索委托 previewFind.js；导出委托 previewExport.js。
 * 渲染顺序：marked 注入 data-source-line → @tag / KaTeX（跳过代码块）→ 异步渲染 Mermaid 并替换占位。
 */
(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    const previewActionMenu = document.getElementById('previewActionMenu');
    const previewActionMenuToggle = document.getElementById('previewActionMenuToggle');
    const previewActionMenuPanel = document.getElementById('previewActionMenuPanel');
    let actionMenuOpen = false;
    let markedInitialized = false;
    let currentPreviewFontSize = null;
    /** 最近一次预览渲染的 Promise，导出前需 await，避免 Mermaid 尚未写入 DOM */
    let previewRenderPromise = Promise.resolve();
    /** 可用的标签名列表，用于精确识别真实标签（而非所有 @xxx 格式） */
    let availableTagNames = [];
    let currentMermaidTheme = null;

    const renderCore = window.MarkdownRenderCore.create();

    // --- 源码行号锚定：token 定位、Renderer 注入 data-source-line ---

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

    /**
     * 检查指定偏移位置是否在代码块（围栏代码块或行内代码）内
     * 用于避免在示例代码中错误渲染标签链接
     */
    function isInsideCodeBlock(content, offset) {
        // 检查是否在围栏代码块 ```...``` 内
        const fenceRegex = /```[\s\S]*?```/g;
        let match;
        while ((match = fenceRegex.exec(content)) !== null) {
            if (offset >= match.index && offset < match.index + match[0].length) {
                return true;
            }
        }

        // 检查是否在行内代码 `...` 内
        // 使用非贪婪匹配，但要处理转义的反引号
        const inlineCodeRegex = /(?<!\\)`[^`\n]*?(?<!\\)`/g;
        while ((match = inlineCodeRegex.exec(content)) !== null) {
            if (offset >= match.index && offset < match.index + match[0].length) {
                return true;
            }
        }

        return false;
    }

    /** 0-based 行号：offset 所在行 */
    function offsetToLine(content, offset) {
        if (offset <= 0) {
            return 0;
        }
        const text = content.substring(0, offset);
        return (text.match(/\r?\n/g) || []).length;
    }

    /** 自 startIndex 起查找 token.raw，返回 index；找不到返回 -1 */
    function findTokenRawIndex(content, raw, startIndex) {
        if (!raw) {
            return -1;
        }
        let idx = content.indexOf(raw, startIndex);
        if (idx !== -1) {
            return idx;
        }
        const crlfRaw = raw.replace(/\n/g, '\r\n');
        if (crlfRaw !== raw) {
            idx = content.indexOf(crlfRaw, startIndex);
            if (idx !== -1) {
                return idx;
            }
        }
        const lfRaw = raw.replace(/\r\n/g, '\n');
        if (lfRaw !== raw) {
            idx = content.indexOf(lfRaw, startIndex);
            if (idx !== -1) {
                return idx;
            }
        }
        return -1;
    }

    /** 查找 token 在源码中的起始位置，失败时使用类型相关兜底 */
    function getTokenStartIndex(sourceContent, token, searchStart) {
        let idx = findTokenRawIndex(sourceContent, token.raw, searchStart);
        if (idx !== -1) {
            return idx;
        }
        if (token.type === 'list_item' && token.raw) {
            const trimmed = token.raw.trim();
            idx = sourceContent.indexOf(trimmed, searchStart);
            if (idx !== -1) {
                return idx;
            }
        }
        if (token.type === 'blockquote') {
            const slice = sourceContent.slice(searchStart);
            const match = slice.match(/^ *> ?/m);
            if (match) {
                return searchStart + match.index;
            }
        }
        return -1;
    }

    /** 判断 html 渲染器输出是否为开/闭标签片段（预处理注入的行内 HTML） */
    function isHtmlFragment(html) {
        const trimmed = (html || '').trim();
        if (!trimmed.startsWith('<')) {
            return false;
        }
        if (/^<\/[\w-]+>\s*$/.test(trimmed)) {
            return true;
        }
        if (/^<[\w-]+[^>]*>\s*$/.test(trimmed)) {
            return true;
        }
        return false;
    }

    /** 按 marked Renderer 调用顺序收集块级 token */
    function collectRenderOrderTokens(tokens, result) {
        if (!tokens) {
            return;
        }
        for (const token of tokens) {
            switch (token.type) {
                case 'space':
                    break;
                case 'blockquote':
                    collectRenderOrderTokens(token.tokens, result);
                    result.push(token);
                    break;
                case 'list':
                    for (const item of token.items || []) {
                        collectRenderOrderTokens(item.tokens, result);
                        result.push(item);
                    }
                    break;
                case 'heading':
                case 'paragraph':
                case 'code':
                case 'hr':
                case 'html':
                case 'table':
                    result.push(token);
                    break;
                default:
                    if (token.tokens) {
                        collectRenderOrderTokens(token.tokens, result);
                    }
                    break;
            }
        }
    }

    /** 基于原始 Markdown 构建块级起始行号队列（顺序与 Renderer 调用一致） */
    function buildSourceLineQueue(sourceContent) {
        const markedObj = getMarkedObject();
        if (!sourceContent || !markedObj || typeof markedObj.lexer !== 'function') {
            return [];
        }
        const tokens = markedObj.lexer(sourceContent);
        const blockTokens = [];
        collectRenderOrderTokens(tokens, blockTokens);

        const queue = [];
        let searchStart = 0;
        for (const token of blockTokens) {
            const idx = getTokenStartIndex(sourceContent, token, searchStart);
            if (idx === -1) {
                queue.push(queue.length > 0 ? queue[queue.length - 1] : 0);
                continue;
            }
            queue.push(offsetToLine(sourceContent, idx));
            searchStart = idx + (token.raw ? token.raw.length : 0);
        }
        return queue;
    }

    /** 包装 marked code renderer：mermaid 保留原样，其余走 highlight.js */
    function createHighlightCodeRenderer(originalCode) {
        return function(code, language) {
            if (language === 'mermaid') {
                return '<pre><code class="language-mermaid">' + code + '</code></pre>';
            }
            if (typeof hljs !== 'undefined') {
                try {
                    if (language && hljs.getLanguage(language)) {
                        const highlighted = hljs.highlight(code, { language: language }).value;
                        return '<pre><code class="hljs language-' + language + '">' + highlighted + '</code></pre>';
                    }
                    const result = hljs.highlightAuto(code);
                    const langClass = result.language ? ' language-' + result.language : '';
                    return '<pre><code class="hljs' + langClass + '">' + result.value + '</code></pre>';
                } catch (error) {
                    console.warn('代码高亮失败:', error);
                    return originalCode.call(this, code, language);
                }
            }
            return originalCode.call(this, code, language);
        };
    }

    /**
     * 自定义 marked Renderer：为块级元素写入 data-source-line（0-based）。
     * 按渲染顺序在源码中向前匹配文本；匹配失败时沿用 lastLine，保证 Alt+单击仍可近似跳转。
     */
    function createSourceLineRenderer(markedObj, sourceContent) {
        const sourceLines = sourceContent.split(/\r?\n/);
        let currentLineIndex = 0;
        let lastLine = 0;

        /** 去掉 HTML/Markdown 标记后做模糊行匹配 */
        function normalizeForMatch(text) {
            return (text || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/^#+\s+/, '')
                .replace(/^(\s*[-*+]|\s*\d+\.)\s+/, '')
                .replace(/\*\*/g, '')
                .replace(/`/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function findLineByText(hintHtml) {
            const probe = normalizeForMatch(hintHtml);
            if (probe.length < 2) {
                return lastLine;
            }
            const shortProbe = probe.slice(0, Math.min(probe.length, 48));

        function lineMatches(lineText, preferListMarker) {
                const linePlain = normalizeForMatch(lineText);
                if (linePlain.length < 2) {
                    return false;
                }
                if (preferListMarker && !/^(\s*[-*+]|\s*\d+\.)\s/.test(lineText)) {
                    return false;
                }
                const head = shortProbe.slice(0, Math.min(shortProbe.length, 20));
                if (head.length >= 8 && linePlain.startsWith(head)) {
                    return true;
                }
                if (linePlain.length >= 8 && shortProbe.startsWith(linePlain.slice(0, Math.min(linePlain.length, 20)))) {
                    return true;
                }
                let common = 0;
                for (let j = 0; j < Math.min(linePlain.length, shortProbe.length); j++) {
                    if (linePlain[j] === shortProbe[j]) {
                        common++;
                    } else {
                        break;
                    }
                }
                return common >= 10;
            }

            function scanLines(preferListMarker) {
                for (let i = currentLineIndex; i < sourceLines.length; i++) {
                    if (lineMatches(sourceLines[i], preferListMarker)) {
                        currentLineIndex = i + 1;
                        lastLine = i;
                        return i;
                    }
                }
                for (let i = 0; i < currentLineIndex; i++) {
                    if (lineMatches(sourceLines[i], preferListMarker)) {
                        currentLineIndex = i + 1;
                        lastLine = i;
                        return i;
                    }
                }
                return null;
            }

            let matched = scanLines(false);
            if (matched === null && probe.length >= 4) {
                matched = scanLines(true);
            }
            if (matched !== null) {
                return matched;
            }
            return lastLine;
        }

        function assignLineForCode(code, language) {
            const lang = language || '';
            for (let i = currentLineIndex; i < sourceLines.length; i++) {
                const trimmed = sourceLines[i].trim();
                if (trimmed.startsWith('```')) {
                    if (!lang || trimmed === '```' + lang || trimmed.startsWith('```' + lang)) {
                        currentLineIndex = i + 1;
                        lastLine = i;
                        return i;
                    }
                }
            }
            return findLineByText(code);
        }

        function wrapBlockTag(tagName, innerHtml, line) {
            return '<' + tagName + ' data-source-line="' + line + '">' + innerHtml + '</' + tagName + '>';
        }

        const renderer = new markedObj.Renderer();
        const originalCode = renderer.code || function(code, language) {
            return '<pre><code' + (language ? ' class="language-' + language + '"' : '') + '>' + code + '</code></pre>';
        };

        renderer.heading = function(text, level) {
            const line = findLineByText(text);
            return wrapBlockTag('h' + level, text, line);
        };

        renderer.paragraph = function(text) {
            const line = findLineByText(text);
            return wrapBlockTag('p', text, line);
        };

        renderer.blockquote = function(quote) {
            const line = findLineByText(quote);
            return wrapBlockTag('blockquote', quote, line);
        };

        renderer.code = function(code, language) {
            const line = assignLineForCode(code, language);
            const highlighted = createHighlightCodeRenderer(originalCode).call(this, code, language);
            if (highlighted.indexOf('<pre') === 0) {
                return highlighted.replace('<pre', '<pre data-source-line="' + line + '"');
            }
            const lang = language || '';
            const cls = lang ? ' class="language-' + lang + '"' : '';
            return '<pre data-source-line="' + line + '"><code' + cls + '>' + code + '</code></pre>';
        };

        renderer.list = function(body, ordered, start) {
            const tag = ordered ? 'ol' : 'ul';
            const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : '';
            return '<' + tag + startAttr + '>' + body + '</' + tag + '>';
        };

        renderer.listitem = function(text, task, checked) {
            let line = null;
            const probe = normalizeForMatch(text);
            if (probe.length >= 2) {
                const head = probe.slice(0, Math.min(probe.length, 20));
                for (let i = currentLineIndex; i < sourceLines.length; i++) {
                    if (!/^(\s*[-*+]|\s*\d+\.)\s/.test(sourceLines[i])) {
                        continue;
                    }
                    const linePlain = normalizeForMatch(sourceLines[i]);
                    if (linePlain.startsWith(head) || (head.length >= 8 && head.startsWith(linePlain.slice(0, 20)))) {
                        line = i;
                        currentLineIndex = i + 1;
                        lastLine = i;
                        break;
                    }
                }
            }
            if (line === null) {
                line = findLineByText(text);
            }
            // marked(GFM) 已在 text 内注入 checkbox，此处勿再拼接，否则会重复
            const attrs = ' data-source-line="' + line + '"' + (task ? ' class="task-list-item"' : '');
            return '<li' + attrs + '>' + text + '</li>';
        };

        renderer.table = function(header, body) {
            const line = findLineByText(header + body);
            return '<table data-source-line="' + line + '"><thead>' + header + '</thead><tbody>' + body + '</tbody></table>';
        };

        renderer.hr = function() {
            const line = findLineByText('---');
            return '<hr data-source-line="' + line + '">';
        };

        renderer.html = function(html) {
            if (isHtmlFragment(html)) {
                return html;
            }
            const line = findLineByText(html);
            return '<div data-source-line="' + line + '">' + html + '</div>';
        };

        return renderer;
    }

    /** 兼容 marked 全局 / window.marked / global.marked 多种加载方式 */
    function getMarkedObject() {
        let markedObj = typeof marked !== 'undefined' ? marked : undefined;
        if (typeof markedObj === 'undefined' && typeof window !== 'undefined') {
            markedObj = window.marked;
        }
        if (typeof markedObj === 'undefined' && typeof global !== 'undefined') {
            markedObj = global.marked;
        }
        return markedObj;
    }

    /** 将 HTML 按 pre/code 块拆段，便于在块外做后处理 */
    function splitHtmlPreservingCodeBlocks(html) {
        const parts = [];
        const regex = /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>)/gi;
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(html)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ preserved: false, html: html.slice(lastIndex, match.index) });
            }
            parts.push({ preserved: true, html: match[0] });
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < html.length) {
            parts.push({ preserved: false, html: html.slice(lastIndex) });
        }
        return parts;
    }

    /** 在 HTML 中（跳过 pre/code）将 @tag 替换为可点击链接 */
    function applyTagLinksInHtml(html) {
        return splitHtmlPreservingCodeBlocks(html).map(function(part) {
            if (part.preserved) {
                return part.html;
            }
            let segment = part.html;
            if (availableTagNames && availableTagNames.length > 0) {
                const tagPattern = availableTagNames.map(function(name) {
                    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }).join('|');
                const tagRegex = new RegExp('@(' + tagPattern + ')', 'g');
                segment = segment.replace(tagRegex, function(match, tagName) {
                    return '<span class="tag-link" data-tag="' + tagName + '">' + match + '</span>';
                });
            } else {
                segment = segment.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, function(match, tagName) {
                    return '<span class="tag-link" data-tag="' + tagName + '">' + match + '</span>';
                });
            }
            return segment;
        }).join('');
    }

    /** 临时屏蔽 pre/code，避免 KaTeX 误处理代码中的 $ */
    function maskHtmlForKatex(html) {
        const blocks = [];
        let masked = html.replace(/<pre[\s\S]*?<\/pre>/gi, function(match) {
            blocks.push(match);
            return '__LC_HTML_KATEX_MASK_' + (blocks.length - 1) + '__';
        });
        masked = masked.replace(/<code[\s\S]*?<\/code>/gi, function(match) {
            blocks.push(match);
            return '__LC_HTML_KATEX_MASK_' + (blocks.length - 1) + '__';
        });
        return { masked: masked, blocks: blocks };
    }

    /** 还原 maskHtmlForKatex 屏蔽的 pre/code 块 */
    function unmaskHtmlAfterKatex(html, blocks) {
        return html.replace(/__LC_HTML_KATEX_MASK_(\d+)__/g, function(_, index) {
            return blocks[Number(index)] ?? '';
        });
    }

    /** 在 HTML 中（跳过 pre/code）渲染 KaTeX */
    function applyKatexInHtml(html) {
        if (typeof katex === 'undefined') {
            return html;
        }
        const masked = maskHtmlForKatex(html);
        let processed = masked.masked;
        try {
            processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
                try {
                    return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
                } catch (error) {
                    console.error('KaTeX 块级公式渲染失败:', error);
                    return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                }
            });
            processed = processed.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, function(match, formula) {
                try {
                    return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
                } catch (error) {
                    console.error('KaTeX 行内公式渲染失败:', error);
                    return '<span class="katex-error">公式渲染失败: ' + formula + '</span>';
                }
            });
        } catch (error) {
            console.error('LaTeX 公式处理失败:', error);
            return html;
        }
        return unmaskHtmlAfterKatex(processed, masked.blocks);
    }

    /** 用原始 Markdown 解析 HTML 并注入 data-source-line（不在此步注入 @tag/KaTeX HTML） */
    function parseMarkdownWithSourceLines(markdownInput, sourceContent) {
        const markedObj = getMarkedObject();
        if (!markedObj || typeof markedObj.parse !== 'function' || typeof markedObj.Renderer === 'undefined') {
            return marked.parse(markdownInput);
        }
        const sourceLineRenderer = createSourceLineRenderer(markedObj, sourceContent);
        return markedObj.parse(markdownInput, {
            breaks: true,
            gfm: true,
            renderer: sourceLineRenderer
        });
    }

    /** 从已渲染 HTML 中提取 Mermaid 图表定义 */
    function extractMermaidBlocksFromHtml(html) {
        const blocks = [];
        const regex = /<pre[^>]*data-source-line="(\d+)"[^>]*><code class="[^"]*\blanguage-mermaid\b[^"]*">([\s\S]*?)<\/code><\/pre>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            blocks.push({
                fullMatch: match[0],
                sourceLine: match[1],
                definition: match[2].trim()
            });
        }
        if (blocks.length > 0) {
            return blocks;
        }
        MERMAID_CODE_BLOCK_HTML_REGEX.lastIndex = 0;
        while ((match = MERMAID_CODE_BLOCK_HTML_REGEX.exec(html)) !== null) {
            const lineMatch = match[0].match(/data-source-line="(\d+)"/);
            const codeMatch = match[0].match(/<code[^>]*>([\s\S]*?)<\/code>/);
            blocks.push({
                fullMatch: match[0],
                sourceLine: lineMatch ? lineMatch[1] : '',
                definition: codeMatch ? codeMatch[1].trim() : ''
            });
        }
        return blocks;
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

    /** 从源码中提取 ```mermaid 围栏（支持 CRLF） */
    const MERMAID_FENCE_REGEX = /```mermaid\s*\r?\n([\s\S]*?)```/gi;
    /** marked 输出的 Mermaid 占位 <pre>，用于替换为已渲染的 SVG */
    const MERMAID_CODE_BLOCK_HTML_REGEX = /<pre[^>]*><code class="[^"]*\blanguage-mermaid\b[^"]*">[\s\S]*?<\/code><\/pre>/gi;
    // marked 仍由本页初始化（含行号 Renderer）；Mermaid 走共享 core
    const initializationPromise = Promise.all([
        waitForMarked(),
        renderCore.waitForMermaid(),
        (typeof window.waitForHighlight === 'function' ? window.waitForHighlight() : Promise.resolve())
    ])
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
        const markedObj = getMarkedObject();

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

                    renderer.code = createHighlightCodeRenderer(originalCode);
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

    /** 轮询直至 marked 可用（最多约 5s），失败则拒绝 initializationPromise */
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

    /**
     * 核心预览管线：
     * 1) 占位保护 ${标签} → 2) marked 注入 data-source-line → 3) @tag / KaTeX
     * → 4) 异步渲染 Mermaid 并替换占位 → 5) 写入 DOM、绑定交互与 TOC
     */
    async function updatePreviewContent(content) {
        if (!content || content.trim() === '') {
            previewArea.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 40px;">暂无内容</p>';
            rebuildToc();
            return;
        }

        try {
            await initializationPromise;

            // ${标签名} 先换成占位符，避免 marked 破坏声明语法；解析后再还原为 .tag-declaration
            const tagPlaceholders = new Map();
            let markdownInput = content.replace(/\$\{([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\}/g, function(match, tagName) {
                const placeholder = '__TAG_DECL_PLACEHOLDER_' + tagPlaceholders.size + '__';
                tagPlaceholders.set(placeholder, { original: match, tagName: tagName });
                return placeholder;
            });

            // 1. marked 解析并注入行号（此步不注入 @tag / KaTeX HTML，避免 Renderer 调用顺序错位）
            let finalHtml = parseMarkdownWithSourceLines(markdownInput, content);

            tagPlaceholders.forEach(function(tagInfo, placeholder) {
                finalHtml = finalHtml.split(placeholder).join(
                    '<span class="tag-declaration">' + tagInfo.original + '</span>'
                );
            });

            // 2. 块外后处理：标签链接与公式
            finalHtml = applyTagLinksInHtml(finalHtml);
            finalHtml = applyKatexInHtml(finalHtml);

            // 3. 提取 Mermaid 占位块并异步渲染为 SVG（definition 未变则走缓存，跳过 mermaid.render）
            const mermaidBlockInfos = extractMermaidBlocksFromHtml(finalHtml);
            let mermaidCacheHits = 0;

            const svgPromises = mermaidBlockInfos.map(async function(blockInfo, index) {
                try {
                    const rendered = await renderCore.renderMermaidDefinition(blockInfo.definition, index);
                    if (rendered.fromCache) {
                        mermaidCacheHits++;
                    }
                    if (rendered.error || !rendered.svg) {
                        return {
                            fullMatch: blockInfo.fullMatch,
                            sourceLine: blockInfo.sourceLine,
                            html: '<div class="mermaid-error">图表渲染失败: ' + (rendered.error || 'unknown') +
                                '<pre>' + blockInfo.definition + '</pre></div>'
                        };
                    }
                    return {
                        fullMatch: blockInfo.fullMatch,
                        sourceLine: blockInfo.sourceLine,
                        html: renderCore.wrapMermaidChartHtml(rendered.chartId, rendered.svg)
                    };
                } catch (error) {
                    console.error('渲染Mermaid图表失败:', error);
                    return {
                        fullMatch: blockInfo.fullMatch,
                        sourceLine: blockInfo.sourceLine,
                        html: '<div class="mermaid-error">图表渲染失败: ' + error.message +
                            '<pre>' + blockInfo.definition + '</pre></div>'
                    };
                }
            });

            const renderedMermaidBlocks = await Promise.all(svgPromises);
            console.log(
                '找到 ' + mermaidBlockInfos.length + ' 个Mermaid代码块，缓存命中 ' +
                mermaidCacheHits + ' / ' + mermaidBlockInfos.length
            );

            let finalHtmlWithSvg = finalHtml;
            for (const block of renderedMermaidBlocks) {
                let replacement = block.html;
                if (block.sourceLine && replacement.indexOf('class="mermaid-chart"') !== -1) {
                    replacement = replacement.replace(
                        'class="mermaid-chart"',
                        'class="mermaid-chart" data-source-line="' + block.sourceLine + '"'
                    );
                }
                finalHtmlWithSvg = finalHtmlWithSvg.replace(block.fullMatch, replacement);
            }

            // 4. 写入 DOM 并绑定交互
            previewArea.innerHTML = finalHtmlWithSvg || '<p>预览生成失败</p>';
            console.log("预览区域已更新");

            if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
                window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
            }

            // 5. Mermaid 缩放/拖拽、标签跳转、搜索状态、TOC
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
