/**
 * 公共工具函数模块
 * 用于在多个 webview 模板之间共享代码
 */

/**
 * HTML转义函数（与 webviewUtils.ts 中的实现保持一致）
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 等待 highlight.js 加载完成（可选，不阻塞）
 * @returns {Promise} 当 highlight.js 加载完成或超时时 resolve
 */
function waitForHighlight() {
    return new Promise((resolve) => {
        if (typeof hljs !== 'undefined') {
            resolve();
            return;
        }
        let attempts = 0;
        const maxAttempts = 50; // 最多等待5秒
        
        const checkHighlight = () => {
            if (typeof hljs !== 'undefined') {
                resolve();
                return;
            }
            attempts++;
            if (attempts >= maxAttempts) {
                // highlight.js 未加载，但不阻塞，继续执行
                console.warn('highlight.js 加载超时，代码高亮可能不可用');
                resolve();
            } else {
                setTimeout(checkHighlight, 100);
            }
        };
        checkHighlight();
    });
}

/**
 * 应用预览字体大小的辅助函数
 * @param {HTMLElement} previewArea - 预览区域元素
 * @param {number} fontSize - 字体大小（像素值，不包含单位）
 */
function applyPreviewFontSize(previewArea, fontSize) {
    if (!previewArea || !fontSize || fontSize <= 0) {
        return;
    }
    
    const fontSizeStr = fontSize + 'px';
    previewArea.style.fontSize = fontSizeStr;
    
    // 同时设置代码区域的字体大小
    const codeElements = previewArea.querySelectorAll('pre code, code, .hljs');
    codeElements.forEach(el => {
        el.style.fontSize = fontSizeStr;
    });
    
    // 设置 KaTeX (LaTeX) 公式的字体大小
    const katexElements = previewArea.querySelectorAll('.katex, .katex-display, .katex-error');
    katexElements.forEach(el => {
        el.style.fontSize = fontSizeStr;
    });
    
    console.log('预览字体大小已设置为:', fontSizeStr);
}

/**
 * 在 KaTeX 处理前屏蔽代码块，避免 Makefile 等代码中的 $(VAR) 被误识别为公式
 * @param {string} content
 * @returns {{ masked: string, blocks: string[] }}
 */
function maskMarkdownForKatex(content) {
    const blocks = [];
    let masked = content.replace(/```[\s\S]*?```/g, (match) => {
        blocks.push(match);
        return `__LC_KATEX_MASK_${blocks.length - 1}__`;
    });
    masked = masked.replace(/`[^`\n]+`/g, (match) => {
        blocks.push(match);
        return `__LC_KATEX_MASK_${blocks.length - 1}__`;
    });
    return { masked, blocks };
}

/**
 * @param {string} content
 * @param {string[]} blocks
 * @returns {string}
 */
function unmaskMarkdownAfterKatex(content, blocks) {
    return content.replace(/__LC_KATEX_MASK_(\d+)__/g, (_, index) => blocks[Number(index)] ?? '');
}

/** Mermaid 竖向图默认适配：高度不超过约 70vh，宽度不超过容器 */
var MERMAID_MAX_HEIGHT_VH = 0.7;

function parseSvgLength(value) {
    if (value == null || value === '') {
        return NaN;
    }
    var n = parseFloat(String(value).replace(/px$/i, ''));
    return isFinite(n) && n > 0 ? n : NaN;
}

function getMermaidSvgIntrinsicSize(svg) {
    var vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
        return { width: vb.width, height: vb.height };
    }
    var w = parseSvgLength(svg.getAttribute('width'));
    var h = parseSvgLength(svg.getAttribute('height'));
    if (isFinite(w) && isFinite(h)) {
        return { width: w, height: h };
    }
    try {
        var bbox = svg.getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
            return { width: bbox.width, height: bbox.height };
        }
    } catch (e) { /* ignore */ }
    return null;
}

/**
 * 将单个 Mermaid 图表适配到容器宽与视口高度
 * @param {HTMLElement} chart
 * @param {boolean} [retried]
 */
function fitMermaidChart(chart, retried) {
    if (!chart) {
        return;
    }
    var svg = chart.querySelector('svg');
    if (!svg) {
        return;
    }

    var size = getMermaidSvgIntrinsicSize(svg);
    if (!size) {
        return;
    }

    var containerWidth = chart.clientWidth;
    if (!(containerWidth > 0)) {
        if (!retried) {
            requestAnimationFrame(function() {
                fitMermaidChart(chart, true);
            });
        }
        return;
    }

    var maxHeight = window.innerHeight * MERMAID_MAX_HEIGHT_VH;
    var fitScale = Math.min(1, containerWidth / size.width, maxHeight / size.height);
    if (!(fitScale > 0) || !isFinite(fitScale)) {
        return;
    }
    fitScale = Math.max(0.1, Math.min(1, fitScale));

    svg.style.setProperty('width', (size.width * fitScale) + 'px', 'important');
    svg.style.setProperty('height', (size.height * fitScale) + 'px', 'important');
    svg.style.setProperty('max-width', '100%', 'important');
    chart.dataset.fitScale = String(fitScale);
}

/** 适配页面内全部 .mermaid-chart */
function fitAllMermaidCharts() {
    document.querySelectorAll('.mermaid-chart').forEach(function(chart) {
        fitMermaidChart(chart);
    });
}

// 如果在浏览器环境中，将函数暴露到全局作用域
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.debounce = debounce;
    window.waitForHighlight = waitForHighlight;
    window.applyPreviewFontSize = applyPreviewFontSize;
    window.maskMarkdownForKatex = maskMarkdownForKatex;
    window.unmaskMarkdownAfterKatex = unmaskMarkdownAfterKatex;
    window.fitMermaidChart = fitMermaidChart;
    window.fitAllMermaidCharts = fitAllMermaidCharts;
}
