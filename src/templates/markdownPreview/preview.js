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
    /** 可用的标签名列表，用于精确识别真实标签（而非所有 @xxx 格式） */
    let availableTagNames = [];
    let currentMermaidTheme = null;

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

    function createSourceLineRenderer(markedObj, sourceContent) {
        const sourceLines = sourceContent.split(/\r?\n/);
        let currentLineIndex = 0;
        let lastLine = 0;

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
            const checkbox = task
                ? '<input type="checkbox" disabled' + (checked ? ' checked' : '') + '> '
                : '';
            return '<li data-source-line="' + line + '">' + checkbox + text + '</li>';
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
            let markdownInput = content.replace(/\$\{([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)\}/g, function(match, tagName) {
                const placeholder = '__TAG_DECL_PLACEHOLDER_' + tagPlaceholders.size + '__';
                tagPlaceholders.set(placeholder, { original: match, tagName: tagName });
                return placeholder;
            });

            // 1. 先对纯 Markdown 解析并注入行号（不在此步注入 @tag / KaTeX HTML，避免 marked 调用顺序错位）
            let finalHtml = parseMarkdownWithSourceLines(markdownInput, content);

            tagPlaceholders.forEach(function(tagInfo, placeholder) {
                finalHtml = finalHtml.split(placeholder).join(
                    '<span class="tag-declaration">' + tagInfo.original + '</span>'
                );
            });

            finalHtml = applyTagLinksInHtml(finalHtml);
            finalHtml = applyKatexInHtml(finalHtml);

            // 2. 从 HTML 中提取 Mermaid 块并异步渲染
            const mermaidBlockInfos = extractMermaidBlocksFromHtml(finalHtml);
            console.log('找到 ' + mermaidBlockInfos.length + ' 个Mermaid代码块');

            const svgPromises = mermaidBlockInfos.map(async function(blockInfo, index) {
                const chartId = 'mermaid-chart-' + Date.now() + '-' + index;
                try {
                    const { svg } = await mermaid.render(chartId, blockInfo.definition);
                    return {
                        fullMatch: blockInfo.fullMatch,
                        sourceLine: blockInfo.sourceLine,
                        html: buildMermaidChartHtml(chartId, svg)
                    };
                } catch (error) {
                    console.error('渲染Mermaid图表失败: ' + chartId, error);
                    return {
                        fullMatch: blockInfo.fullMatch,
                        sourceLine: blockInfo.sourceLine,
                        html: '<div class="mermaid-error">图表渲染失败: ' + error.message +
                            '<pre>' + blockInfo.definition + '</pre></div>'
                    };
                }
            });

            const renderedMermaidBlocks = await Promise.all(svgPromises);

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
                }
                break;
            case 'setMermaidTheme':
                if (message.theme === currentMermaidTheme) {
                    break;
                }
                if (mermaidInitialized && typeof mermaid === 'object' && typeof mermaid.initialize === 'function') {
                    try {
                        const isHandDrawn = message.theme === 'hand-drawn';
                        const config = isHandDrawn ? buildMermaidConfig(true) : { theme: message.theme };
                        mermaid.initialize({
                            ...mermaid.defaultConfig,
                            ...config
                        });
                        currentMermaidTheme = message.theme;
                        if (window.markdownContent) {
                            updatePreview(window.markdownContent);
                        }
                    } catch (error) {
                        console.error('设置Mermaid主题失败:', error);
                    }
                } else {
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
                handleExportComplete(message.success, message.error);
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
     * 导出前清理标签链接
     * @param clone 克隆的预览区域 DOM
     * @param hideTags 是否完全隐藏标签（true=完全删除，false=转为纯文本）
     * 导出的 HTML 在独立浏览器中无法使用 VS Code 的跳转功能，因此需要清理链接样式
     */
    function cleanTagLinksForExport(clone, hideTags = false) {
        // 处理标签引用（如 @标签名）- 通常是蓝色可点击链接
        clone.querySelectorAll('.tag-link').forEach(link => {
            if (hideTags) {
                // 完全删除标签引用
                link.remove();
            } else {
                // 转为纯文本（保留 @标签名 文本，但去掉链接样式）
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

    /** 导出按钮元素和原始文本缓存 */
    let exportBtnElement = null;
    let exportBtnOriginalText = '导出 HTML';
    let exportInProgress = false;

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
            // 强制重绘以确保动画启动
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
        // 如果导出已在进行中，阻止重复点击
        if (exportInProgress) return;

        // 记录开始时间用于计算最小加载时间
        window.exportStartTime = Date.now();

        try {
            // 设置按钮加载状态
            setExportBtnLoading(true);

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

            // 读取导出选项
            const keepPrintBg = document.getElementById('keepPrintBg')?.checked ?? true;

            // 导出时自动清理标签链接（完全删除，因为独立 HTML 中无法跳转）
            // 注意：由于现在使用精确标签白名单，不会误伤普通文本中的 @xxx
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

            // 注意：按钮状态将在收到 exportHtmlComplete 消息后恢复
        } catch (error) {
            console.error('准备导出 HTML 失败:', error);
            // 发生错误时恢复按钮状态（确保至少显示500ms）
            const MIN_LOADING_TIME = 500;
            const elapsed = Date.now() - (window.exportStartTime || 0);
            const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);
            setTimeout(() => setExportBtnLoading(false), remainingDelay);
        }
    }

    /**
     * 处理导出完成消息
     */
    function handleExportComplete(success, error) {
        // 确保至少显示最小加载时间，避免闪烁
        const MIN_LOADING_TIME = 500;
        const elapsed = Date.now() - (window.exportStartTime || 0);
        const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);

        setTimeout(() => {
            setExportBtnLoading(false);
            if (error) {
                console.error('导出失败:', error);
            }
        }, remainingDelay);
    }

    function isSourceJumpBlockedTarget(element) {
        return element.closest('.mermaid-controls')
            || element.closest('.export-actions')
            || element.closest('button');
    }

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
