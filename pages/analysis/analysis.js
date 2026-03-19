/**
 * 历史记录分析对比 - 前端逻辑
 */
const API = LEVIATHAN_CONFIG.ANALYSIS_API;
let allGroups = [];
let currentMode = 'single-location'; // single-location | single-twin | comprehensive
let selectedIds = { location: new Set(), twin: new Set() };

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', () => {
    initModeTabs();
    loadReports();
    document.getElementById('btn-compare').addEventListener('click', runCompare);
});

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
        const resp = await fetch(`${API}/reports`);
        const data = await resp.json();
        if (data.status === 'success') {
            allGroups = data.groups;
            document.getElementById('total-badge').textContent = `${data.total_groups} 个地址`;
            renderGroupList();
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
    for (const group of allGroups) {
        const locReports = group.location_reports || [];
        const twinReports = group.twin_reports || [];

        // 根据模式过滤
        const showLoc = currentMode !== 'single-twin';
        const showTwin = currentMode !== 'single-location';
        const totalVisible = (showLoc ? locReports.length : 0) + (showTwin ? twinReports.length : 0);
        if (totalVisible === 0) continue;

        html += `<div class="address-group open">
            <div class="address-group-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="arrow">▶</span>
                <span>${group.address || '未知地址'}</span>
                ${group.business_area ? `<span style="color:var(--text-dim);font-size:11px">${group.business_area}</span>` : ''}
                <span class="count">${totalVisible} 条</span>
            </div>
            <div class="report-items">`;

        if (showLoc) {
            for (const r of locReports) {
                const checked = selectedIds.location.has(r.report_id) ? 'checked' : '';
                const sel = checked ? 'selected' : '';
                const date = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '';
                html += `<label class="report-item ${sel}" data-type="location" data-id="${r.report_id}">
                    <input type="checkbox" ${checked} onchange="toggleSelect(this,'location','${r.report_id}')">
                    <span class="tag-location">选址</span>
                    <span class="report-meta">${r.cuisine_type} ¥${r.avg_price_per_person}</span>
                    <span class="report-date">${date}</span>
                </label>`;
            }
        }
        if (showTwin) {
            for (const r of twinReports) {
                const checked = selectedIds.twin.has(r.simulation_id) ? 'checked' : '';
                const sel = checked ? 'selected' : '';
                const date = r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : '';
                html += `<label class="report-item ${sel}" data-type="twin" data-id="${r.simulation_id}">
                    <input type="checkbox" ${checked} onchange="toggleSelect(this,'twin','${r.simulation_id}')">
                    <span class="tag-twin">孪生</span>
                    <span class="report-meta">${r.restaurant_name || r.cuisine_type} ¥${r.avg_price || '-'}</span>
                    <span class="report-date">${date}</span>
                </label>`;
            }
        }

        html += '</div></div>';
    }
    container.innerHTML = html;
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location_ids: [...selectedIds.location],
                twin_ids: [...selectedIds.twin],
            }),
        });
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
        html += `<div class="chart-card"><h4>选址分析 - 雷达图对比</h4><div class="chart-container radar" id="chart-radar-loc"></div></div>`;
        html += `<div class="chart-card"><h4>投资回报对比</h4><div class="chart-container" id="chart-invest"></div></div>`;
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
        renderLocationRadar(data.location_reports);
        renderInvestChart(data.location_reports);
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
    const chart = echarts.init(el);
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
        legend: { ...CHART_THEME.legend, data: reports.map(r => r.label) },
        radar: {
            indicator: dims.map(d => ({ name: d.name, max: d.max })),
            shape: 'polygon',
            axisName: { color: '#94a3b8', fontSize: 10 },
            splitArea: { areaStyle: { color: ['rgba(0,180,255,0.02)', 'rgba(0,180,255,0.04)'] } },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        },
        series: [{
            type: 'radar',
            data: reports.map((r, i) => ({
                name: r.label,
                value: dims.map(d => r.metrics[d.key] || 0),
                lineStyle: { color: COLORS[i % COLORS.length] },
                itemStyle: { color: COLORS[i % COLORS.length] },
                areaStyle: { color: COLORS[i % COLORS.length], opacity: 0.1 },
            })),
        }],
    });
}

function renderInvestChart(reports) {
    const el = document.getElementById('chart-invest');
    if (!el) return;
    const chart = echarts.init(el);
    const labels = reports.map(r => r.label.length > 10 ? r.label.slice(0, 10) + '…' : r.label);
    chart.setOption({
        ...CHART_THEME,
        tooltip: { trigger: 'axis' },
        legend: { ...CHART_THEME.legend, data: ['总投入(万)', '月营收(万)', '回报周期(月)'] },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 15 } },
        yAxis: [
            { type: 'value', name: '万元', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } } },
            { type: 'value', name: '月', axisLabel: { color: '#94a3b8', fontSize: 10 }, splitLine: { show: false } },
        ],
        series: [
            { name: '总投入(万)', type: 'bar', data: reports.map(r => Math.round((r.metrics.total_investment || 0) / 10000)), itemStyle: { color: COLORS[0] } },
            { name: '月营收(万)', type: 'bar', data: reports.map(r => Math.round((r.metrics.monthly_revenue || 0) / 10000)), itemStyle: { color: COLORS[2] } },
            { name: '回报周期(月)', type: 'line', yAxisIndex: 1, data: reports.map(r => r.metrics.payback_months || 0), itemStyle: { color: COLORS[3] }, lineStyle: { width: 2 } },
        ],
    });
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
    let html = '<table class="compare-table"><thead><tr><th class="metric-name">指标</th>';
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
