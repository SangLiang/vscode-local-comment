(function() {
    const vscode = acquireVsCodeApi();
    const previewArea = document.getElementById('previewArea');
    const toggleSizeBtn = document.getElementById('toggle-preview-size-btn');
    let markedInitialized = false;
    let mermaidInitialized = false;
    let isMaximized = false;

    // 全局、一次性的初始化任务
    const initializationPromise = Promise.all([waitForMarked(), waitForMermaid()])
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
                // 设置 marked 选项
                if (typeof markedObj.setOptions === 'function') {
                    markedObj.setOptions({
                        breaks: true,
                        gfm: true,
                        sanitize: false
                    });
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

            // 再次检查 marked 是否可用
            let markedObj = marked;
            if (typeof markedObj === 'undefined' && typeof window !== 'undefined') {
                markedObj = window.marked;
            }
            
            // 获取 markdown 解析函数
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
            
            // 如果全局有保存的解析函数，使用它
            if (!markdownParser && typeof window.markdownParser === 'function') {
                markdownParser = window.markdownParser;
            }
            
            if (typeof markdownParser !== 'function') {
                throw new Error('markdown 解析函数不可用，请检查库是否正确加载');
            }

            // 渲染Markdown
            let html = markdownParser(content);

            // 处理Mermaid图表
            html = await processMermaidCharts(html);

            // 更新预览区域
            previewArea.innerHTML = html;

            // 初始化图表交互
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

    // 处理Mermaid图表
    async function processMermaidCharts(html) {
        if (!mermaidInitialized || typeof mermaid !== 'object' || typeof mermaid.render !== 'function') {
            return html;
        }

        // 查找所有Mermaid代码块
        const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
        let match;
        let chartIndex = 0;

        while ((match = mermaidRegex.exec(html)) !== null) {
            const mermaidCode = match[1].trim();
            const chartId = `mermaid-chart-${chartIndex}`;
            
            try {
                // 渲染Mermaid图表
                const { svg } = await mermaid.render(chartId, mermaidCode);
                
                // 替换代码块为渲染后的图表
                const chartHtml = `
                    <div class="mermaid-chart" data-chart-id="${chartId}">
                        <div class="mermaid-controls">
                            <button class="mermaid-control-btn" onclick="resetChart('${chartId}')" title="重置">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                                </svg>
                            </button>
                            <button class="mermaid-control-btn" onclick="toggleChartZoom('${chartId}')" title="全屏">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 2h-2v3h-3v2h5v-5zm-2-4h2V5h-5v2h3v3z"/>
                                </svg>
                            </button>
                        </div>
                        <div class="mermaid-zoom-info">滚轮缩放，拖拽移动</div>
                        ${svg}
                    </div>
                `;
                
                html = html.replace(match[0], chartHtml);
                chartIndex++;
                
            } catch (error) {
                console.error('Mermaid图表渲染失败:', error);
                const errorHtml = `
                    <div class="mermaid-error">
                        <p>Mermaid图表渲染失败</p>
                        <pre>${error.message}</pre>
                        <p>代码:</p>
                        <pre>${mermaidCode}</pre>
                    </div>
                `;
                html = html.replace(match[0], errorHtml);
            }
        }

        return html;
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
                svg.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
            }
        }
    }

    // 设置滚轮缩放
    function setupChartWheelZoom(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (!chart) return;

        chart.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const newScale = Math.max(0.1, Math.min(5, currentScale * delta));
            
            chart.dataset.scale = newScale.toString();
            updateChartTransform(chartId);
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
    }

    // 重置图表
    window.resetChart = function(chartId) {
        const chart = document.querySelector(`[data-chart-id="${chartId}"]`);
        if (chart) {
            chart.dataset.scale = '1';
            chart.dataset.translateX = '0';
            chart.dataset.translateY = '0';
            updateChartTransform(chartId);
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

    // 切换预览大小
    toggleSizeBtn.addEventListener('click', () => {
        const container = document.querySelector('.container');
        if (isMaximized) {
            container.classList.remove('maximized');
            isMaximized = false;
            toggleSizeBtn.title = '最大化预览';
        } else {
            container.classList.add('maximized');
            isMaximized = true;
            toggleSizeBtn.title = '最小化预览';
        }
    });

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
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
