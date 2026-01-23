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

// 如果在浏览器环境中，将函数暴露到全局作用域
if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.debounce = debounce;
    window.waitForHighlight = waitForHighlight;
    window.applyPreviewFontSize = applyPreviewFontSize;
}
