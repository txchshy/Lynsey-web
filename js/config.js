/**
 * Leviathan 前端全局配置
 *
 * 开发环境：API_BASE 指向本地后端
 * 生产环境：替换为字节云部署域名
 */
const LEVIATHAN_CONFIG = (() => {
    const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const API_HOST = isDev
        ? `${window.location.protocol}//${window.location.hostname}:8000`
        : '';  // 生产环境同域部署时留空，跨域时填写后端域名

    return Object.freeze({
        API_HOST,
        API_V1: `${API_HOST}/api/v1`,
        LOCATION_API: `${API_HOST}/api/v1/location`,
        TWIN_API: `${API_HOST}/api/v1/twin`,
        DECISION_API: `${API_HOST}/api/v1/decision`,
        MARKETING_API: `${API_HOST}/api/v1/marketing`,
        CONFIG_API: `${API_HOST}/api/config`,
        // 旧接口兼容（过渡期）
        LEGACY_API: `${API_HOST}/api/location-analysis`,
    });
})();
