(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    let markedInitialized = false;
    let mermaidInitialized = false;
    let currentPreviewFontSize = null; // 保存当前预览字体大小

    // 全局、一次性的初始化任务
    const initializationPromise = Promise.all([waitForMarked(), waitForMermaid(), (typeof window.waitForHighlight === 'function' ? window.waitForHighlight() : Promise.resolve())])
        .then(() => {
            console.log('所有库初始化成功');
        })
        .catch(error => {
            console.error("关键库初始化失败:", error);
            previewArea.innerHTML = `<p style="color:red;">预览组件加载失败: ${error.message}</p>`;
            throw error;
        });

    // 初始化marked
    function initializeMarked() {
        // 尝试多种方式获取 marked
        let markedObj = marked;
        if (typeof markedObj === 'undefined' && typeof window !== 'undefined') {
            markedObj = window.marked;
        }
        if (typeof markedObj === 'undefined' && typeof global !== 'undefined') {
            markedObj = global.marked;
        }
        
        // 检查 marked 库的不同 API 结构
        let markdownParser = null;
        
        if (typeof markedObj === 'object' && markedObj !== null) {
            // 尝试不同的可能属性名
            if (typeof markedObj.parse === 'function') {
                markdownParser = markedObj.parse;
            } else if (typeof markedObj.render === 'function') {
                markdownParser = markedObj.render;
            } else if (typeof markedObj.marked === 'function') {
                markdownParser = markedObj.marked;
            } else if (typeof markedObj.default === 'function') {
                markdownParser = markedObj.default;
            } else {
                // 检查对象的所有属性，寻找函数
                for (const key in markedObj) {
                    if (typeof markedObj[key] === 'function') {
                    }
                }
            }
        }
        
        if (markdownParser && !markedInitialized) {
            try {
                // 配置代码高亮渲染器
                let renderer = null;
                if (typeof markedObj.Renderer !== 'undefined') {
                    renderer = new markedObj.Renderer();
                } else if (typeof markedObj.renderer !== 'undefined') {
                    renderer = markedObj.renderer;
                }
                
                if (renderer) {
                    const originalCode = renderer.code || function(code, language) {
                        return `<pre><code${language ? ` class="language-${language}"` : ''}>${code}</code></pre>`;
                    };
                    
                    renderer.code = function(code, language) {
                        // 如果没有指定语言，使用原始渲染
                        if (!language) {
                            return originalCode.call(this, code, language);
                        }
                        
                        // 如果 highlight.js 已加载，使用它进行高亮
                        if (typeof hljs !== 'undefined') {
                            try {
                                const highlighted = hljs.highlight(code, { language: language }).value;
                                return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
                            } catch (error) {
                                // 如果高亮失败，使用原始渲染
                                console.warn('代码高亮失败:', error);
                                return originalCode.call(this, code, language);
                            }
                        } else {
                            // highlight.js 未加载，使用原始渲染
                            return originalCode.call(this, code, language);
                        }
                    };
                }
                
                // 设置 marked 选项
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
                // 确保全局变量可用
                if (typeof window !== 'undefined') {
                    window.marked = markedObj;
                }
                marked = markedObj;
                // 保存解析函数引用
                window.markdownParser = markdownParser;
                markedInitialized = true;
                return true;
            } catch (error) {
                console.error('marked 初始化失败:', error);
                return false;
            }
        } else {
        }
        return false;
    }

    // 等待marked库加载完成
    function waitForMarked() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 50; // 最多等待5秒
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

    // 构建Mermaid配置
    function buildMermaidConfig(handDrawnEnabled = false) {
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
            config.theme = 'hand-drawn';
        }

        return config;
    }

    // 初始化Mermaid
    function initializeMermaid(handDrawnEnabled = false) {
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
        } else {
        }
        return false;
    }

    // 等待Mermaid库加载完成
    function waitForMermaid() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 50; // 最多等待5秒
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

    // 更新预览内容
    async function updatePreview(content) {
        if (!content || content.trim() === '') {
            previewArea.innerHTML = '<p style="color: var(--vscode-descriptionForeground); text-align: center; margin-top: 40px;">暂无内容</p>';
            return;
        }

        try {
            // 等待库初始化完成
            await initializationPromise;

            // 1. 预处理Markdown，先处理标签声明 ${标签名}（必须在 LaTeX 处理之前）
            // 将 ${标签名} 替换为占位符，避免被 LaTeX 正则误匹配
            const tagPlaceholders = new Map();
            let processedContent = content.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, tagName) => {
                const placeholder = `__TAG_DECL_PLACEHOLDER_${tagPlaceholders.size}__`;
                tagPlaceholders.set(placeholder, { original: match, tagName: tagName });
                return placeholder;
            });

            // 2. 处理 @标签引用
            processedContent = processedContent.replace(/@([\u4e00-\u9fa5a-zA-Z0-9_]+)/g, '<span style="color: var(--vscode-symbolIcon-functionForeground); font-weight: bold;">@$1</span>');

            // 3. 查找所有的Mermaid代码块
            const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
            const mermaidBlocks = [...processedContent.matchAll(mermaidRegex)];
            console.log(`找到 ${mermaidBlocks.length} 个Mermaid代码块`);

            // 3. 异步渲染所有的Mermaid图表为SVG字符串
            const svgPromises = mermaidBlocks.map(async (match, index) => {
                const chartDefinition = match[1].trim();
                const chartId = `mermaid-chart-${Date.now()}-${index}`;
                try {
                    console.log(`开始在内存中渲染图表: ${chartId}`);
                    const { svg } = await mermaid.render(chartId, chartDefinition);
                    console.log(`成功渲染图表: ${chartId}`);
                    // 将SVG包裹在一个div中，添加控制按钮和交互功能
                    return `<div class="mermaid-chart" data-chart-id="${chartId}">
                        <div class="mermaid-controls">
                            <button class="mermaid-control-btn" title="放大" onclick="zoomChart('${chartId}', 1.2)">+</button>
                            <button class="mermaid-control-btn" title="缩小" onclick="zoomChart('${chartId}', 0.8)">−</button>
                            <button class="mermaid-control-btn" title="重置" onclick="resetChart('${chartId}')">↺</button>
                        </div>
                        <div class="mermaid-zoom-info" id="zoom-info-${chartId}">100%</div>
                        ${svg}
                    </div>`;
                } catch (error) {
                    console.error(`渲染Mermaid图表失败: ${chartId}`, error);
                    return `<div class="mermaid-error">图表渲染失败: ${error.message}<pre>${chartDefinition}</pre></div>`;
                }
            });

            const renderedSvgs = await Promise.all(svgPromises);

            // 4. 将渲染好的SVG替换回Markdown内容中
            let finalContent = processedContent;
            let svgIndex = 0;
            finalContent = finalContent.replace(mermaidRegex, () => {
                return renderedSvgs[svgIndex++];
            });

            // 5. 处理 LaTeX 公式（在 marked.parse 之前，此时 ${标签名} 已被占位符替换）
            if (typeof katex !== 'undefined') {
                try {
                    // 先处理块级公式 $$...$$（避免被行内公式正则误匹配）
                    finalContent = finalContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 块级公式渲染失败:', error);
                            return `<span class="katex-error">公式渲染失败: ${formula}</span>`;
                        }
                    });

                    // 再处理行内公式 $...$（使用负向前瞻/后顾避免匹配 $$）
                    finalContent = finalContent.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g, (match, formula) => {
                        try {
                            return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
                        } catch (error) {
                            console.error('KaTeX 行内公式渲染失败:', error);
                            return `<span class="katex-error">公式渲染失败: ${formula}</span>`;
                        }
                    });
                } catch (error) {
                    console.error('LaTeX 公式处理失败:', error);
                }
            } else {
                console.warn('KaTeX 未加载，无法渲染 LaTeX 公式');
            }

            // 6. 恢复标签声明占位符为 HTML 格式（在 marked.parse 之前）
            tagPlaceholders.forEach((tagInfo, placeholder) => {
                finalContent = finalContent.replace(placeholder, `<span class="tag-declaration" style="color: var(--vscode-symbolIcon-variableForeground); font-weight: bold;">${tagInfo.original}</span>`);
            });

            // 7. 使用marked将整个内容（包括已插入的SVG和LaTeX公式）转换为HTML
            const finalHtml = marked.parse(finalContent);
            
            // 8. 一次性更新DOM
            previewArea.innerHTML = finalHtml || '<p>预览生成失败</p>';
            console.log("预览区域已使用包含SVG的完整HTML更新。");
            
            // 应用字体大小（如果有设置）
            if (currentPreviewFontSize && typeof window.applyPreviewFontSize === 'function') {
                window.applyPreviewFontSize(previewArea, currentPreviewFontSize);
            }

            // 7. 检查最终结果
            const allMermaidCharts = previewArea.querySelectorAll('.mermaid-chart');
            console.log(`最终在DOM中找到 ${allMermaidCharts.length} 个Mermaid图表容器`);
            allMermaidCharts.forEach((chart, index) => {
                const rect = chart.getBoundingClientRect();
                console.log(`图表 ${index + 1} (${chart.id}) 尺寸: width=${rect.width}, height=${rect.height}`);
            });

            // 8. 初始化图表交互
            initChartInteractions();

        } catch (error) {
            console.error('预览更新失败:', error);
            previewArea.innerHTML = `
                <div class="mermaid-error">
                    <p>预览渲染失败</p>
                    <pre>${error.message}</pre>
                </div>
            `;
        }
    }

    // 初始化图表交互
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

    // 初始化图表状态
    function initChartState(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
        }
    }

    // 更新图表变换
    function updateChartTransform(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            const scale = parseFloat(chart.dataset.scale) || 1;
            const translateX = parseFloat(chart.dataset.translateX) || 0;
            const translateY = parseFloat(chart.dataset.translateY) || 0;
            
            const svg = chart.querySelector('svg');
            if (svg) {
                // 使用以左上角为原点的缩放，便于基于鼠标位置的缩放计算
                svg.style.transformOrigin = '0 0';
                // 变换顺序：translate 后 scale（右到左应用），确保 p' = S * p + T，其中 T 为屏幕像素位移
                const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
                svg.style.transform = transform;
            }
            
            // 更新容器状态
            if (scale > 1 || translateX !== 0 || translateY !== 0) {
                chart.classList.add('zoomed');
            } else {
                chart.classList.remove('zoomed');
            }
        }
    }

    // 设置滚轮缩放
    function setupChartWheelZoom(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (!chart) return;

        chart.addEventListener('wheel', (e) => {
            // 只有在按下 Ctrl 键时才进行缩放
            if (!e.ctrlKey) return;

            const chartId = chart.getAttribute('data-chart-id');
            if (!chartId) return;

            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const svg = chart.querySelector('svg');
            if (!svg) return;

            // 阻止页面滚动，专注于图表缩放
            e.preventDefault();

            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 使用指数缩放使触控板/高分辨率滚轮更平滑
            const zoomIntensity = 0.0005; // 减小缩放灵敏度（约每档 7-8%）
            const wheel = -e.deltaY; // 向下滚动缩小，向上放大
            const factor = Math.exp(wheel * zoomIntensity);

            const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
            const ratio = newScale / currentScale;

            // 调整平移量以保持鼠标下的点在屏幕位置不变
            const currentTranslateX = parseFloat(chart.dataset.translateX) || 0;
            const currentTranslateY = parseFloat(chart.dataset.translateY) || 0;
            
            const newTranslateX = mouseX * (1 - ratio) + currentTranslateX * ratio;
            const newTranslateY = mouseY * (1 - ratio) + currentTranslateY * ratio;
            
            chart.dataset.scale = newScale.toString();
            chart.dataset.translateX = newTranslateX.toString();
            chart.dataset.translateY = newTranslateY.toString();
            
            updateChartTransform(chartId);
            
            // 更新缩放信息显示
            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = `${Math.round(newScale * 100)}%`;
            }
        });
    }

    // 设置拖拽移动
    function setupChartDrag(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
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

        // 鼠标离开窗口时停止拖拽
        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                chart.style.cursor = 'grab';
            }
        });
    }

    // 重置图表
    window.resetChart = function(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
            updateChartTransform(chartId);
            
            // 更新缩放信息显示
            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = '100%';
            }
        }
    };

    // 缩放图表
    window.zoomChart = function(chartId, factor) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
            
            chart.dataset.scale = newScale.toString();
            updateChartTransform(chartId);
            
            // 更新缩放信息显示
            const zoomInfo = chart.querySelector('.mermaid-zoom-info');
            if (zoomInfo) {
                zoomInfo.textContent = `${Math.round(newScale * 100)}%`;
            }
        }
    };

    // 切换图表全屏
    window.toggleChartZoom = function(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            if (chart.classList.contains('zoomed')) {
                chart.classList.remove('zoomed');
                chart.style.cursor = 'grab';
            } else {
                chart.classList.add('zoomed');
                chart.style.cursor = 'grab';
            }
        }
    };

    // 关闭预览
    window.closePreview = function() {
        vscode.postMessage({
            command: 'close'
        });
    };

    // 导出为本地注释
    window.exportToLocalComment = function() {
        vscode.postMessage({
            command: 'exportToLocalComment'
        });
    };

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'setPreviewFontSize':
                // 设置预览区域字体大小
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
                        mermaid.initialize({
                            ...mermaid.defaultConfig,
                            theme: message.theme
                        });
                        // 重新渲染预览以应用新主题
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

    // 初始化预览
    function initializePreview() {
        if (window.markdownContent) {
            updatePreview(window.markdownContent);
        } else {
            console.log('window.markdownContent 不存在或为空');
        }
    }

    // 等待DOM加载完成后再初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePreview);
    } else {
        // DOM已经加载完成，直接初始化
        initializePreview();
    }
})();
