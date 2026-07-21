/**
 * 导出 HTML 中的 Mermaid 图表交互（缩放按钮、Ctrl+滚轮、拖拽）
 * 依赖同页先内联的 public.js（window.fitMermaidChart）
 */
(function() {
    function getChart(chartId) {
        return document.querySelector('[data-chart-id="' + chartId + '"]');
    }

    function initChartState(chart) {
        chart.dataset.scale = '1';
        chart.dataset.translateX = '0';
        chart.dataset.translateY = '0';
    }

    function updateChartTransform(chart) {
        const scale = parseFloat(chart.dataset.scale) || 1;
        const translateX = parseFloat(chart.dataset.translateX) || 0;
        const translateY = parseFloat(chart.dataset.translateY) || 0;
        const svg = chart.querySelector('svg');
        if (svg) {
            svg.style.transformOrigin = '0 0';
            svg.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
        }
        if (scale > 1 || translateX !== 0 || translateY !== 0) {
            chart.classList.add('zoomed');
        } else {
            chart.classList.remove('zoomed');
        }
    }

    function updateZoomInfo(chart) {
        const zoomInfo = chart.querySelector('.mermaid-zoom-info');
        if (zoomInfo) {
            const scale = parseFloat(chart.dataset.scale) || 1;
            zoomInfo.textContent = Math.round(scale * 100) + '%';
        }
    }

    window.zoomChart = function(chartId, factor) {
        const chart = getChart(chartId);
        if (!chart) return;
        const currentScale = parseFloat(chart.dataset.scale) || 1;
        const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
        chart.dataset.scale = String(newScale);
        updateChartTransform(chart);
        updateZoomInfo(chart);
    };

    window.resetChart = function(chartId) {
        const chart = getChart(chartId);
        if (!chart) return;
        initChartState(chart);
        updateChartTransform(chart);
        updateZoomInfo(chart);
    };

    function setupChartWheelZoom(chart) {
        const chartId = chart.dataset.chartId;
        if (!chartId) return;

        chart.addEventListener('wheel', function(e) {
            if (!e.ctrlKey) return;

            const currentScale = parseFloat(chart.dataset.scale) || 1;
            const svg = chart.querySelector('svg');
            if (!svg) return;

            e.preventDefault();

            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const zoomIntensity = 0.0005;
            const factor = Math.exp(-e.deltaY * zoomIntensity);
            const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
            const ratio = newScale / currentScale;
            const currentTranslateX = parseFloat(chart.dataset.translateX) || 0;
            const currentTranslateY = parseFloat(chart.dataset.translateY) || 0;

            chart.dataset.scale = String(newScale);
            chart.dataset.translateX = String(mouseX * (1 - ratio) + currentTranslateX * ratio);
            chart.dataset.translateY = String(mouseY * (1 - ratio) + currentTranslateY * ratio);
            updateChartTransform(chart);
            updateZoomInfo(chart);
        });
    }

    function setupChartDrag(chart) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startTranslateX = 0;
        let startTranslateY = 0;

        chart.addEventListener('mousedown', function(e) {
            if (e.target.closest('.mermaid-controls')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startTranslateX = parseFloat(chart.dataset.translateX) || 0;
            startTranslateY = parseFloat(chart.dataset.translateY) || 0;
            chart.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            chart.dataset.translateX = String(startTranslateX + e.clientX - startX);
            chart.dataset.translateY = String(startTranslateY + e.clientY - startY);
            updateChartTransform(chart);
        });

        document.addEventListener('mouseup', function() {
            if (!isDragging) return;
            isDragging = false;
            chart.style.cursor = 'grab';
        });
    }

    function initChart(chart) {
        if (!chart.dataset.chartId) {
            chart.dataset.chartId = 'mermaid-export-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        }
        chart.style.cursor = 'grab';
        if (typeof window.fitMermaidChart === 'function') {
            window.fitMermaidChart(chart);
        }
        initChartState(chart);
        updateChartTransform(chart);
        updateZoomInfo(chart);
        setupChartWheelZoom(chart);
        setupChartDrag(chart);
    }

    function initAllCharts() {
        document.querySelectorAll('.mermaid-chart').forEach(initChart);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllCharts);
    } else {
        initAllCharts();
    }
})();
