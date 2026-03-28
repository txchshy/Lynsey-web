/**
 * Leviathan 前端公共工具函数
 *
 * 所有页面共享的通用逻辑
 */

/**
 * 封装fetch请求，自动处理错误和JSON解析
 */
async function apiRequest(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    const config = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    };

    const response = await fetch(url, config);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.detail || error.message || `HTTP ${response.status}`);
    }
    return response.json();
}

/**
 * 格式化日期时间
 */
function formatDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    });
}

/**
 * 生成店铺名称（主标题）
 * 规则：有店铺名用店铺名，否则用"餐饮大类+菜系类型+省份+城市"
 */
function buildRestaurantTitle({ restaurantName = '', cuisineCategory = '', cuisineType = '', province = '', city = '' } = {}) {
    const clean = (value) => `${value || ''}`.trim();
    const name = clean(restaurantName);
    if (name) return name;

    // 自动生成：餐饮大类+菜系类型+省份+城市
    const parts = [cuisineCategory, cuisineType, province, city].map(clean).filter(Boolean);
    return parts.join('') || '未命名店铺';
}

/**
 * 生成报告名称（副标题）
 * 格式：省份+城市+市区+定位方式+序号
 */
function buildReportName({ province = '', city = '', district = '', locationType = '', reportNumber = '' } = {}) {
    const clean = (value) => `${value || ''}`.trim();
    const parts = [province, city, district, locationType, reportNumber].map(clean).filter(Boolean);
    return parts.join('') || '';
}

/**
 * 显示全局提示消息
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        padding: 12px 24px; border-radius: 8px; color: #fff;
        font-size: 14px; opacity: 0; transition: opacity 0.3s;
        background: ${type === 'error' ? '#ff4d4f' : type === 'success' ? '#52c41a' : '#1890ff'};
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
