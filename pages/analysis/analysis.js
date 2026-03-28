/**
 * 历史记录分析对比 - 前端逻辑
 */
const API = LEVIATHAN_CONFIG.ANALYSIS_API;
const PAGE_MODE = new URLSearchParams(window.location.search).get('mode') || 'full';
const IS_LOCATION_ONLY_PAGE = PAGE_MODE === 'location';
let allGroups = [];
let currentMode = 'single-location'; // single-location | single-twin | comprehensive
let selectedIds = { location: new Set(), twin: new Set() };

function getAuthHeaders() {
    return (typeof AUTH !== 'undefined' && AUTH.getToken())
        ? { 'Authorization': `Bearer ${AUTH.getToken()}` }
        : {};
}

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', () => {
    applyPageMode();
    initModeTabs();
    loadReports();
    document.getElementById('btn-compare').addEventListener('click', runCompare);
});

function applyPageMode() {
    if (!IS_LOCATION_ONLY_PAGE) return;

    const modeTabs = document.querySelector('.mode-tabs');
    if (modeTabs) modeTabs.style.display = 'none';

    document.title = '选址分析对比';

    const navTitle = document.querySelector('.nav-title');
    if (navTitle) navTitle.title = '选址分析对比';
}

// ── 模式切换 ──
function initModeTabs() {
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            selectedIds = { location: new Set(), twin: new Set() };
            renderGroupList();
            updateSelectedCount();
            document.getElementById('panel-result').innerHTML = `
                <div class="result-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path>
                    </svg>
                    <span>在左侧选择 2 个以上报告，点击"开始对比分析"</span>
                </div>`;
        });
    });
}

// ── 加载报告 ──
async function loadReports() {
    try {
        const resp = await fetch(`${API}/reports`, { headers: getAuthHeaders() });
        if (!resp.ok) throw new Error(resp.status === 401 ? '未登录或登录已失效' : `HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.status === 'success') {
            allGroups = data.groups;
            document.getElementById('total-badge').textContent = `${data.total_groups} 个地址`;
            renderGroupList();
        } else {
            document.getElementById('group-list').innerHTML = `<div class="loading-overlay">${data.detail || '暂无历史报告'}</div>`;
        }
    } catch (e) {
        document.getElementById('group-list').innerHTML = `<div class="loading-overlay">加载失败: ${e.message}</div>`;
    }
}

// ── 渲染报告列表 ──
function renderGroupList() {
    const container = document.getElementById('group-list');
    if (!allGroups.length) {
        container.innerHTML = '<div class="loading-overlay">暂无历史报告</div>';
        return;
    }

    let html = '';
    
    // 按店铺名重新分组
    const shopGroups = {};
    for (const group of allGroups) {
        const locReports = group.location_reports || [];
        const twinReports = group.twin_reports || [];
        
        // 根据模式过滤
        const showLoc = currentMode !== 'single-twin';
        const showTwin = currentMode !== 'single-location';
        
        const reportsToProcess = [
            ...(showLoc ? locReports.map(r => ({ ...r, type: 'location' })) : []),
            ...(showTwin ? twinReports.map(r => ({ ...r, type: 'twin' })) : [])
        ];
        
        for (const r of reportsToProcess) {
            // 生成店铺名
            const shopName = r.restaurant_name || 
                `${r.cuisine_category || ''}${r.cuisine_type || ''}${r.province || ''}${r.city || ''}` || 
                '未命名店铺';
            
            if (!shopGroups[shopName]) {
                shopGroups[shopName] = [];
            }
            shopGroups[shopName].push(r);
        }
    }

    // 渲染按店铺名分组的列表
    for (const [shopName, reports] of Object.entries(shopGroups)) {
        if (reports.length === 0) continue;

        html += `<div class="address-group open">
            <div class="address-group-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="arrow">▶</span>
                <span style="font-weight: 600;">${shopName}</span>
                <span class="count">${reports.length} 条</span>
            </div>
            <div class="report-items">`;

        for (const r of reports) {
            const isLocation = r.type === 'location';
            const id = isLocation ? r.report_id : r.simulation_id;
            const checked = selectedIds[r.type].has(id) ? 'checked' : '';
            const sel = checked ? 'selected' : '';
            const date = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '';
            
            // 副标题：报告名称（省份+城市+市区+定位方式+序号）
            const locationType = isLocation ? (r.location_type || 'AI选址') : '数字孪生';
            const reportName = `${r.province || ''}${r.city || ''}${r.district || ''}${locationType}${id ? '#' + id.slice(-6) : ''}`;
            
            const tagClass = isLocation ? 'tag-location' : 'tag-twin';
            const tagText = isLocation ? '选址' : '孪生';
            
            html += `<label class="report-item ${sel}" data-type="${r.type}" data-id="${id}">
                <input type="checkbox" ${checked} onchange="toggleSelect(this,'${r.type}','${id}')">
                <span class="${tagClass}">${tagText}</span>
                <div style="display: flex; flex-direction: column; gap: 2px; flex: 1;">
                    <span class="report-name" style="font-size: 13px; color: #ffffff;">${reportName}</span>
                    <span class="report-date" style="font-size: 11px; color: #cbd5e1;">${date}</span>
                </div>
            </label>`;
        }

        html += '</div></div>';
    }
    
    container.innerHTML = html || '<div class="loading-overlay">当前模式下暂无报告</div>';
}

// ── 勾选逻辑 ──
function toggleSelect(checkbox, type, id) {
    if (checkbox.checked) {
        selectedIds[type].add(id);
    } else {
        selectedIds[type].delete(id);
    }
    const item = checkbox.closest('.report-item');
    item.classList.toggle('selected', checkbox.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const total = selectedIds.location.size + selectedIds.twin.size;
    document.getElementById('selected-count').textContent = total;
    document.getElementById('btn-compare').disabled = total < 2;
}

// ── 执行对比 ──
async function runCompare() {
    const btn = document.getElementById('btn-compare');
    const panel = document.getElementById('panel-result');
    btn.disabled = true;
    btn.textContent = '分析中...';
    panel.innerHTML = '<div class="loading-overlay"><div class="spinner"></div>正在分析对比...</div>';

    try {
        const resp = await fetch(`${API}/compare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
                location_ids: [...selectedIds.location],
                twin_ids: [...selectedIds.twin],
            }),
        });
        if (!resp.ok) throw new Error(resp.status === 401 ? '未登录或登录已失效' : `HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.status === 'success') {
            renderCompareResult(data);
        } else {
            panel.innerHTML = `<div class="loading-overlay">分析失败</div>`;
        }
    } catch (e) {
        panel.innerHTML = `<div class="loading-overlay">请求失败: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '开始对比分析';
        updateSelectedCount();
    }
}

// ── 渲染对比结果 ──
function renderCompareResult(data) {
    const panel = document.getElementById('panel-result');
    let html = '';

    // 推荐卡片
    const rec = data.recommendation;
    const best = rec.best_overall || rec.best_location || rec.best_twin;
    if (best) {
        html += `<div class="recommendation-card">
            <h3>🏆 最佳选址推荐</h3>
            <div class="best-label">${best.label}</div>
            <div class="best-score">综合评分 ${best.score} 分
                ${best.location_score !== undefined ? ` | 选址 ${best.location_score}` : ''}
                ${best.twin_score !== undefined ? ` | 孪生 ${best.twin_score}` : ''}
            </div>
        </div>`;
    }

    // 图表
    html += '<div class="charts-grid">';

    if (data.location_reports && data.location_reports.length) {
        const filterHtml = _buildChartFilterHtml(data.location_reports, 'loc');
        html += `<div class="chart-card full-width"><div class="chart-card-header"><h4>选址分析 - 雷达图对比</h4>${filterHtml}</div><div class="chart-container radar-full" id="chart-radar-loc"></div></div>`;
        const filterHtml2 = _buildChartFilterHtml(data.location_reports, 'invest');
        html += `<div class="chart-card full-width"><div class="chart-card-header"><h4>投资回报对比</h4>${filterHtml2}</div><div class="chart-container invest-full" id="chart-invest"></div></div>`;
        html += `<div class="chart-card full-width"><h4>选址分析详细数据</h4><div id="table-location"></div></div>`;
    }
    if (data.twin_reports && data.twin_reports.length) {
        html += `<div class="chart-card"><h4>数字孪生 - 市场接受度</h4><div class="chart-container" id="chart-twin-bar"></div></div>`;
        html += `<div class="chart-card"><h4>数字孪生 - 评分对比</h4><div class="chart-container" id="chart-twin-score"></div></div>`;
        html += `<div class="chart-card full-width"><h4>数字孪生详细数据</h4><div id="table-twin"></div></div>`;
    }
    html += '</div>';

    panel.innerHTML = html;

    // 渲染图表
    if (data.location_reports && data.location_reports.length) {
        _bindChartFilter(data.location_reports, 'loc', true);
        _bindChartFilter(data.location_reports, 'invest', false);
        const visRadar = _getVisibleReports(data.location_reports, 'loc');
        const visInvest = _getVisibleReports(data.location_reports, 'invest');
        renderLocationRadar(visRadar);
        renderInvestChart(visInvest);
        renderLocationTable(data.location_reports);
    }
    if (data.twin_reports && data.twin_reports.length) {
        renderTwinBar(data.twin_reports);
        renderTwinScore(data.twin_reports);
        renderTwinTable(data.twin_reports);
    }
}

// ── ECharts 图表 ──
const CHART_THEME = {
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8', fontSize: 11 },
    legend: { textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0 },
};
const COLORS = ['#00b4ff', '#a855f7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

function renderLocationRadar(reports) {
    const el = document.getElementById('chart-radar-loc');
    if (!el) return;
    const chart = echarts.getInstanceByDom(el) || echarts.init(el);
    const dims = [
        { key: 'grading_score', name: '商圈评分', max: 100 },
        { key: 'investment_score', name: '投资评分', max: 100 },
        { key: 'foot_traffic', name: '人流量', max: 80000 },
        { key: 'daily_revenue', name: '日均流水', max: 50000 },
        { key: 'sqm_revenue', name: '坪效', max: 2000 },
        { key: 'turnover_rate', name: '翻台率', max: 5 },
    ];
    chart.setOption({
        ...CHART_THEME,
        legend: {
            ...CHART_THEME.legend,
            data: reports.map(r => r.label),
            type: 'scroll',
            orient: 'vertical',
            left: 0,
            top: 'middle',
            width: 220,
            itemGap: 14,
            pageTextStyle: { color: '#94a3b8' },
            pageIconColor: '#00b4ff',
            pageIconInactiveColor: '#334155',
            textStyle: { color: '#94a3b8', fontSize: 11, width: 200, overflow: 'break' },
            tooltip: { show: true },
            formatter: function (name) {
                return name.length > 18 ? name.slice(0, 18) + '\n' + name.slice(18) : name;
            },
        },
        radar: {
            indicator: dims.map(d => ({ name: d.name, max: d.max })),
            shape: 'polygon',
            center: ['55%', '50%'],
            radius: '65%',
            axisName: { color: '#94a3b8', fontSize: 10 },
            splitArea: { areaStyle: { color: ['rgba(0,180,255,0.02)', 'rgba(0,180,255,0.04)'] } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        },
        series: [{
            type: 'radar',
            data: reports.map((r) => {
                const ci = (r._origIdx !== undefined ? r._origIdx : 0) % COLORS.length;
                return {
                    name: r.label,
                    value: dims.map(d => r.metrics[d.key] || 0),
                    lineStyle: { color: COLORS[ci] },
                    itemStyle: { color: COLORS[ci] },
                    areaStyle: { color: COLORS[ci], opacity: 0.1 },
                };
            }),
        }],
    }, true);
}

function renderInvestChart(reports) {
    const el = document.getElementById('chart-invest');
    if (!el) return;
    const chart = echarts.getInstanceByDom(el) || echarts.init(el);
    // 标签换行：每10字换一行，完整显示
    const labels = reports.map(r => {
        const lbl = r.label;
        if (lbl.length <= 10) return lbl;
        const lines = [];
        for (let i = 0; i < lbl.length; i += 10) lines.push(lbl.slice(i, i + 10));
        return lines.join('\n');
    });
    // 超过8个时启用水平拖拽滚动
    const needZoom = reports.length > 8;
    const zoomCfg = needZoom ? [
        { type: 'slider', xAxisIndex: 0, bottom: 0, height: 18, start: 0, end: Math.min(100, Math.round(800 / reports.length)), borderColor: 'rgba(0,180,255,0.2)', fillerColor: 'rgba(0,180,255,0.1)', handleStyle: { color: '#00b4ff' }, textStyle: { color: '#94a3b8', fontSize: 10 } },
        { type: 'inside', xAxisIndex: 0 },
    ] : [];
    chart.setOption({
        ...CHART_THEME,
        tooltip: { trigger: 'axis' },
        legend: { ...CHART_THEME.legend, data: ['总投入(万)', '月营收(万)', '回报周期(月)'] },
        grid: { bottom: needZoom ? 80 : 60, left: 60, right: 60 },
        dataZoom: zoomCfg,
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 10, interval: 0 } },
        yAxis: [
            { type: 'value', name: '万元', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
            { type: 'value', name: '月', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { show: false } },
        ],
        series: [
            { name: '总投入(万)', type: 'bar', data: reports.map(r => Math.round((r.metrics.total_investment || 0) / 10000)), itemStyle: { color: COLORS[0] } },
            { name: '月营收(万)', type: 'bar', data: reports.map(r => Math.round((r.metrics.monthly_revenue || 0) / 10000)), itemStyle: { color: COLORS[2] } },
            { name: '回报周期(月)', type: 'line', yAxisIndex: 1, data: reports.map(r => r.metrics.payback_months || 0), itemStyle: { color: COLORS[3] }, lineStyle: { width: 2 } },
        ],
    }, true);
}

function renderTwinBar(reports) {
    const el = document.getElementById('chart-twin-bar');
    if (!el) return;
    const chart = echarts.init(el);
    const labels = reports.map(r => r.label.length > 12 ? r.label.slice(0, 12) + '…' : r.label);
    chart.setOption({
        ...CHART_THEME,
        tooltip: { trigger: 'axis' },
        legend: { ...CHART_THEME.legend, data: ['兴趣度%', '查看%', '分享%'] },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 15 } },
        yAxis: { type: 'value', name: '%', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
        series: [
            { name: '兴趣度%', type: 'bar', data: reports.map(r => r.metrics.interest_pct), itemStyle: { color: COLORS[1] } },
            { name: '查看%', type: 'bar', data: reports.map(r => r.metrics.view_pct), itemStyle: { color: COLORS[0] } },
            { name: '分享%', type: 'bar', data: reports.map(r => r.metrics.share_pct), itemStyle: { color: COLORS[2] } },
        ],
    });
}

function renderTwinScore(reports) {
    const el = document.getElementById('chart-twin-score');
    if (!el) return;
    const chart = echarts.init(el);
    const labels = reports.map(r => r.label.length > 12 ? r.label.slice(0, 12) + '…' : r.label);
    chart.setOption({
        ...CHART_THEME,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 15 } },
        yAxis: { type: 'value', name: '评分', max: 5, axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
        series: [{
            type: 'bar',
            data: reports.map((r, i) => ({ value: r.metrics.avg_score, itemStyle: { color: COLORS[i % COLORS.length] } })),
            label: { show: true, position: 'top', color: '#e2e8f0', fontSize: 11, formatter: '{c}' },
        }],
    });
}

// ── 对比表格 ──
function renderLocationTable(reports) {
    const el = document.getElementById('table-location');
    if (!el) return;
    const metrics = [
        { key: 'grading_score', name: '商圈评分', unit: '分', better: 'high' },
        { key: 'competitors', name: '竞品数', unit: '家', better: 'low' },
        { key: 'foot_traffic', name: '日均人流', unit: '人', better: 'high' },
        { key: 'metro_distance', name: '地铁距离', unit: 'm', better: 'low' },
        { key: 'daily_revenue', name: '日均流水', unit: '元', better: 'high' },
        { key: 'turnover_rate', name: '翻台率', unit: '', better: 'high' },
        { key: 'sqm_revenue', name: '坪效', unit: '元/㎡', better: 'high' },
        { key: 'total_investment', name: '总投入', unit: '元', better: 'low' },
        { key: 'monthly_revenue', name: '月营收', unit: '元', better: 'high' },
        { key: 'monthly_profit', name: '月毛利', unit: '元', better: 'high' },
        { key: 'payback_months', name: '回报周期', unit: '月', better: 'low' },
        { key: 'investment_score', name: '投资评分', unit: '分', better: 'high' },
    ];
    el.innerHTML = buildCompareTable(reports, metrics);
}

function renderTwinTable(reports) {
    const el = document.getElementById('table-twin');
    if (!el) return;
    const metrics = [
        { key: 'avg_score', name: '平均评分', unit: '', better: 'high' },
        { key: 'interest_pct', name: '兴趣度', unit: '%', better: 'high' },
        { key: 'view_pct', name: '查看率', unit: '%', better: 'high' },
        { key: 'share_pct', name: '分享率', unit: '%', better: 'high' },
        { key: 'will_visit_pct', name: '会去吃', unit: '%', better: 'high' },
        { key: 'will_recommend_pct', name: '会推荐', unit: '%', better: 'high' },
    ];
    el.innerHTML = buildCompareTable(reports, metrics);
}

function buildCompareTable(reports, metrics) {
    let html = '<table class="compare-table"><thead><tr><th class="metric-name">选址</th>';
    for (const r of reports) {
        const short = r.label.length > 14 ? r.label.slice(0, 14) + '…' : r.label;
        html += `<th>${short}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const m of metrics) {
        const values = reports.map(r => r.metrics[m.key] || 0);
        const best = m.better === 'high' ? Math.max(...values) : Math.min(...values);
        const worst = m.better === 'high' ? Math.min(...values) : Math.max(...values);

        html += `<tr><td class="metric-name">${m.name}</td>`;
        for (const v of values) {
            let cls = '';
            if (values.length > 1) {
                if (v === best) cls = 'best-value';
                else if (v === worst) cls = 'worst-value';
            }
            const display = typeof v === 'number' ? v.toLocaleString() : v;
            html += `<td class="${cls}">${display}${m.unit}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// ── 图表Top5筛选 ──
let _allLocReports = [];
const MAX_DEFAULT_VISIBLE = 5;

function _getTop5Indices(reports) {
    return reports
        .map((r, i) => ({ i, score: r.metrics.grading_score || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_DEFAULT_VISIBLE)
        .map(x => x.i);
}

function _buildChartFilterHtml(reports, prefix) {
    if (reports.length <= MAX_DEFAULT_VISIBLE) return '';
    const top5 = new Set(_getTop5Indices(reports));
    let opts = '';
    reports.forEach((r, i) => {
        const short = r.label.length > 18 ? r.label.slice(0, 18) + '…' : r.label;
        const score = r.metrics.grading_score || 0;
        const checked = top5.has(i) ? 'checked' : '';
        opts += `<label class="filter-opt"><input type="checkbox" value="${i}" ${checked}><span>${short}</span><span class="filter-score">${score}分</span></label>`;
    });
    return `<div class="chart-filter" id="chart-filter-${prefix}">
        <button class="filter-toggle" onclick="this.parentElement.classList.toggle('open')">
            筛选显示 (${Math.min(reports.length, MAX_DEFAULT_VISIBLE)}/${reports.length})
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="filter-dropdown">${opts}</div>
    </div>`;
}

function _getVisibleReports(reports, prefix) {
    if (reports.length <= MAX_DEFAULT_VISIBLE) {
        return reports.map((r, i) => ({ ...r, _origIdx: i }));
    }
    const filterEl = document.getElementById(`chart-filter-${prefix}`);
    if (!filterEl) return reports.slice(0, MAX_DEFAULT_VISIBLE).map((r, i) => ({ ...r, _origIdx: i }));
    const checked = [...filterEl.querySelectorAll('input[type=checkbox]:checked')].map(cb => parseInt(cb.value));
    if (checked.length === 0) return reports.slice(0, MAX_DEFAULT_VISIBLE).map((r, i) => ({ ...r, _origIdx: i }));
    return checked.map(i => ({ ...reports[i], _origIdx: i }));
}

function _bindChartFilter(reports, prefix, isRadar) {
    _allLocReports = reports;
    const filterEl = document.getElementById(`chart-filter-${prefix}`);
    if (!filterEl) return;
    filterEl.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const checked = [...filterEl.querySelectorAll('input[type=checkbox]:checked')];
        const toggleBtn = filterEl.querySelector('.filter-toggle');
        if (toggleBtn) toggleBtn.innerHTML = `筛选显示 (${checked.length}/${reports.length}) <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
        const vis = _getVisibleReports(reports, prefix);
        if (isRadar) renderLocationRadar(vis);
        else renderInvestChart(vis);
    });
}
