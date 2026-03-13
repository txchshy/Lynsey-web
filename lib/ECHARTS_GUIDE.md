# lib 目录说明

## 📋 概述

lib目录包含ECharts图表库文件，用于系统中的数据可视化功能。

## 🗂️ 文件列表

```
lib/
├── echarts.min.js              # ECharts核心库 (压缩版)
├── echarts-gl.min.js           # ECharts 3D扩展
└── echarts-wordcloud.min.js    # ECharts词云扩展
```

## 📦 库说明

### echarts.min.js - 核心库
**版本**: 5.4.3  
**大小**: ~1MB

**功能**:
- 折线图、柱状图、饼图
- 散点图、雷达图
- 地图、热力图
- 仪表盘、漏斗图
- 关系图、树图

**使用示例**:
```javascript
// 初始化图表
const chart = echarts.init(document.getElementById('chart'));

// 配置选项
const option = {
    title: { text: '诈骗类型分布' },
    tooltip: {},
    xAxis: { data: ['电信', '网络', '金融'] },
    yAxis: {},
    series: [{
        type: 'bar',
        data: [120, 200, 150]
    }]
};

// 渲染
chart.setOption(option);
```

### echarts-gl.min.js - 3D扩展
**版本**: 2.0.9  
**大小**: ~800KB

**功能**:
- 3D柱状图
- 3D散点图
- 3D曲面图
- 地球可视化
- 3D飞线图

**使用示例**:
```javascript
const option = {
    series: [{
        type: 'bar3D',
        data: [[0, 0, 100], [1, 0, 200], [0, 1, 150]]
    }]
};
```

### echarts-wordcloud.min.js - 词云扩展
**版本**: 2.1.0  
**大小**: ~50KB

**功能**:
- 词云图
- 自定义形状
- 颜色渐变
- 旋转角度

**使用示例**:
```javascript
const option = {
    series: [{
        type: 'wordCloud',
        data: [
            { name: '诈骗', value: 1000 },
            { name: '防范', value: 800 },
            { name: '安全', value: 600 }
        ],
        shape: 'circle',
        textStyle: {
            fontFamily: 'sans-serif',
            fontWeight: 'bold',
            color: function() {
                return 'rgb(' + [
                    Math.round(Math.random() * 160),
                    Math.round(Math.random() * 160),
                    Math.round(Math.random() * 160)
                ].join(',') + ')';
            }
        }
    }]
};
```

## 🎨 使用场景

### 群众端
- **PublicHome**: 案件统计图表
- **Insight**: 数据洞察可视化
- **Report**: 举报趋势分析

### 民警端
- **PoliceHome**: 仪表盘统计
- **CloudData**: 云图数据展示
- **ShiheziMap**: 地图热力图

### 管理员端
- **AdminHome**: 用户统计图表
- **SystemConfig**: 性能监控图表

## 🔧 引用方式

### HTML引用
```html
<!-- 核心库 -->
<script src="{{ url_for('static', filename='lib/echarts.min.js') }}"></script>

<!-- 3D扩展 -->
<script src="{{ url_for('static', filename='lib/echarts-gl.min.js') }}"></script>

<!-- 词云扩展 -->
<script src="{{ url_for('static', filename='lib/echarts-wordcloud.min.js') }}"></script>
```

### 加载顺序
1. 先加载echarts.min.js（核心库）
2. 再加载扩展库（gl、wordcloud）
3. 最后加载业务脚本

## 📊 常用图表配置

### 柱状图
```javascript
{
    xAxis: { type: 'category', data: ['A', 'B', 'C'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [10, 20, 30] }]
}
```

### 饼图
```javascript
{
    series: [{
        type: 'pie',
        data: [
            { value: 335, name: '电信诈骗' },
            { value: 234, name: '网络诈骗' }
        ]
    }]
}
```

### 折线图
```javascript
{
    xAxis: { type: 'category', data: ['1月', '2月', '3月'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [100, 200, 150] }]
}
```

### 地图
```javascript
{
    series: [{
        type: 'map',
        map: 'china',
        data: [
            { name: '北京', value: 100 },
            { name: '上海', value: 200 }
        ]
    }]
}
```

## 🎯 性能优化

### 按需加载
```javascript
// 只在需要时加载扩展
if (need3D) {
    loadScript('lib/echarts-gl.min.js');
}
```

### 数据采样
```javascript
// 大数据量时使用采样
series: [{
    type: 'line',
    sampling: 'average',  // 平均采样
    data: largeDataArray
}]
```

### 懒加载
```javascript
// 图表懒加载
const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        initChart();
    }
});
observer.observe(chartContainer);
```

## 🐛 常见问题

**Q: 图表不显示？**
- 检查容器是否有宽高
- 确认ECharts已加载
- 查看控制台错误

**Q: 图表模糊？**
```javascript
// 设置devicePixelRatio
const chart = echarts.init(dom, null, {
    devicePixelRatio: window.devicePixelRatio
});
```

**Q: 响应式问题？**
```javascript
// 监听窗口大小变化
window.addEventListener('resize', () => {
    chart.resize();
});
```

## 📚 参考资料

- [ECharts官方文档](https://echarts.apache.org/zh/index.html)
- [ECharts示例](https://echarts.apache.org/examples/zh/index.html)
- [ECharts配置项手册](https://echarts.apache.org/zh/option.html)

---

**维护者**: Anti-Fraud System 开发团队  
**最后更新**: 2024-12-19
