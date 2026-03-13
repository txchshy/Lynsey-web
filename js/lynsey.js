// ==================== 全局配置 ====================
// API地址由 config.js 中的 LEVIATHAN_CONFIG 提供
const API_BASE_URL = LEVIATHAN_CONFIG.LOCATION_API;
let BAIDU_MAP_AK = '';  // 百度地图API密钥，从后端获取

// 动态加载百度地图API
async function loadBaiduMapAPI() {
    try {
        const response = await fetch(`${LEVIATHAN_CONFIG.CONFIG_API}/baidu-map-key`);
        const data = await response.json();
        BAIDU_MAP_AK = data.ak;
        
        // 动态创建script标签加载百度地图
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `https://api.map.baidu.com/api?v=3.0&ak=${BAIDU_MAP_AK}`;
        script.onload = function() {
            console.log('百度地图API加载成功');
            // 地图加载完成后初始化中国地图
            initChinaMap();
        };
        script.onerror = function() {
            console.error('百度地图API加载失败');
        };
        document.head.appendChild(script);
    } catch (error) {
        console.error('获取百度地图API密钥失败:', error);
    }
}

// 省市区数据缓存
let provinceData = [];
let cityData = {};
let districtData = {};

// ==================== 工具函数 ====================
// 更新时间显示
function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    document.getElementById('current-time').textContent = timeStr;
}

setInterval(updateTime, 1000);
updateTime();

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', function() {
    // 优化背景视频性能
    optimizeBackgroundVideo();
    
    // 用户菜单交互
    initUserMenu();
    
    // 动态加载百度地图API（从后端获取密钥）
    loadBaiduMapAPI();
    
    // 初始化选址运算台
    initCalculationWindow();
    
    // 初始化省市区选择器
    initRegionSelector();
    
    // 加载菜系列表
    loadCuisineTypes();
    
    // 初始化菜系选择器
    initCuisineSelector();
    
    // 窗口大小调整
    window.addEventListener('resize', function() {
        if (window.mapChart) window.mapChart.resize();
    });
});

// 优化背景视频性能
function optimizeBackgroundVideo() {
    const video = document.getElementById('myVideo');
    if (!video) return;
    
    // 检测设备性能,移动端或低性能设备使用静态背景
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isLowPerformance = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    
    if (isMobile || isLowPerformance) {
        // 暂停视频,使用静态背景
        video.pause();
        video.style.display = 'none';
        document.querySelector('.video-background').style.background = 'linear-gradient(135deg, #031842 0%, #0a2463 50%, #031842 100%)';
    } else {
        // 视频加载完成后播放
        video.addEventListener('loadeddata', function() {
            video.play().catch(e => console.log('视频自动播放失败:', e));
        });
        
        // 视频加载失败时使用静态背景
        video.addEventListener('error', function() {
            video.style.display = 'none';
            document.querySelector('.video-background').style.background = 'linear-gradient(135deg, #031842 0%, #0a2463 50%, #031842 100%)';
        });
    }
}

// 用户菜单初始化
function initUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userMenuBtn.classList.toggle('active');
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function() {
            userMenuBtn.classList.remove('active');
            userDropdown.classList.remove('show');
        });

        userDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
}

// ==================== 中国地图初始化 ====================
function initChinaMap() {
    const mapChart = echarts.init(document.getElementById('china-map'));
    window.mapChart = mapChart;

    const geoJsonPath = 'ChinaMap/中国_省.geojson';
    
    fetch(geoJsonPath)
        .then(response => response.json())
        .then(geoJson => {
            echarts.registerMap('china', geoJson);
            
            // 餐饮饱和度数据
            const saturationData = [
                {name: '河北省', value: 2}, {name: '山西省', value: 1},
                {name: '辽宁省', value: 2}, {name: '吉林省', value: 1},
                {name: '黑龙江省', value: 1}, {name: '江苏省', value: 4},
                {name: '浙江省', value: 4}, {name: '安徽省', value: 2},
                {name: '福建省', value: 3}, {name: '江西省', value: 2},
                {name: '山东省', value: 3}, {name: '河南省', value: 2},
                {name: '湖北省', value: 2}, {name: '湖南省', value: 3},
                {name: '广东省', value: 4}, {name: '广西壮族自治区', value: 2},
                {name: '海南省', value: 2}, {name: '四川省', value: 3},
                {name: '贵州省', value: 1}, {name: '云南省', value: 2},
                {name: '陕西省', value: 2}, {name: '甘肃省', value: 1},
                {name: '青海省', value: 1}, {name: '台湾省', value: 3},
                {name: '内蒙古自治区', value: 1}, {name: '西藏自治区', value: 1},
                {name: '宁夏回族自治区', value: 1}, {name: '新疆维吾尔自治区', value: 1},
                {name: '北京市', value: 4}, {name: '天津市', value: 3},
                {name: '上海市', value: 4}, {name: '重庆市', value: 3},
                {name: '香港特别行政区', value: 4}, {name: '澳门特别行政区', value: 3}
            ];

            const mapOption = {
                backgroundColor: 'transparent',
                title: [{
                    text: '审图号：GS（2024）0650号 ©天地图',
                    left: 15, top: 15,
                    textStyle: { color: '#fff', fontSize: 11, fontWeight: 'normal' }
                }, {
                    text: '全国商圈热力态势图',
                    left: 'center', top: 15,
                    textStyle: { color: '#00f2fe', fontSize: 16, textShadow: '0 0 5px rgba(0, 242, 254, 0.7)' }
                }],
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        const levelText = ['低饱和', '较低饱和', '中等饱和', '高饱和'];
                        const level = params.data ? params.data.value - 1 : 0;
                        return `${params.name}<br/>餐饮饱和度：${levelText[level] || '未知'}`;
                    },
                    backgroundColor: 'rgba(3, 24, 66, 0.8)',
                    borderColor: 'rgba(0, 242, 254, 0.3)',
                    textStyle: { color: '#fff' },
                    extraCssText: 'backdrop-filter: blur(10px); border-radius: 8px;'
                },
                geo: {
                    map: 'china', show: true, roam: true, zoom: 1.15, center: [105, 35],
                    scaleLimit: { min: 0.8, max: 3 },
                    layoutCenter: ['50%', '52%'], layoutSize: '95%',
                    label: { show: true, fontSize: 10, color: 'rgba(0, 0, 0, 0.7)', textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)' },
                    itemStyle: { borderColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 1, areaColor: 'rgba(3, 24, 66, 0.5)' },
                    emphasis: {
                        itemStyle: { areaColor: 'rgba(0, 242, 254, 0.8)', borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.8)' },
                        label: { show: true, color: '#fff', textShadow: '0 0 3px rgba(0, 0, 0, 0.5)' }
                    }
                },
                visualMap: { show: false, min: 1, max: 4, inRange: { color: ['#C6E2FF', '#6495ED', '#4169E1', '#000080'] } },
                series: [{ name: '餐饮饱和度', type: 'map', map: 'china', geoIndex: 0, data: saturationData }]
            };

            mapChart.setOption(mapOption);
        })
        .catch(error => {
            console.error('地图数据加载失败:', error);
            document.getElementById('china-map').innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ff4d4f; font-size: 14px;">
                    <div style="text-align: center;">
                        <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
                        <div>地图数据加载失败</div>
                    </div>
                </div>`;
        });
}

// ==================== 选址运算台初始化 ====================
function initCalculationWindow() {
    const calculateButton = document.getElementById('calculate-button');
    const historyButton = document.getElementById('history-button');
    const viewProgressBtn = document.getElementById('view-progress-btn');
    
    if (calculateButton) {
        calculateButton.addEventListener('click', performCalculation);
    }
    
    if (historyButton) {
        historyButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showHistory();
        });
    }
    
    if (viewProgressBtn) {
        viewProgressBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            showProgressModal();
        });
    }
    
    // 关闭历史记录
    const closeHistoryBtn = document.getElementById('close-history-btn');
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', hideHistory);
    }
    
    // 关闭进度弹窗
    const closeProgressBtn = document.getElementById('close-progress-btn');
    if (closeProgressBtn) {
        closeProgressBtn.addEventListener('click', hideProgressModal);
    }
    
    // 点击遮罩层关闭
    const historyOverlay = document.getElementById('history-overlay');
    if (historyOverlay) {
        historyOverlay.addEventListener('click', hideHistory);
    }
    
    const progressOverlay = document.getElementById('progress-overlay');
    if (progressOverlay) {
        progressOverlay.addEventListener('click', hideProgressModal);
    }
    
    // 回车键触发运算
    const inputIds = ['city-input', 'district-input', 'street-input', 'business-area-input', 
                      'cuisine-category-input', 'cuisine-input', 'price-input', 'rent-input', 'area-input', 
                      'revenue-input', 'renovation-input', 'equipment-input', 'franchise-input',
                      'stock-promotion-input', 'brand-input', 'income-input'];
    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performCalculation();
            });
        }
    });
    
    // 查询范围按钮切换
    document.querySelectorAll('.radius-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.radius-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ==================== 省市区选择器初始化 ====================
function initRegionSelector() {
    // 加载省份数据
    loadProvinces();
    
    // 省份选择事件
    const provinceSelect = document.getElementById('province-input');
    const citySelect = document.getElementById('city-input');
    const districtSelect = document.getElementById('district-input');
    
    if (provinceSelect) {
        provinceSelect.addEventListener('change', function() {
            const province = this.value;
            if (province) {
                loadCities(province);
                citySelect.disabled = false;
                districtSelect.disabled = true;
                districtSelect.innerHTML = '<option value="">请先选择城市</option>';
            } else {
                citySelect.disabled = true;
                citySelect.innerHTML = '<option value="">请先选择省份</option>';
                districtSelect.disabled = true;
                districtSelect.innerHTML = '<option value="">请先选择城市</option>';
            }
        });
    }
    
    if (citySelect) {
        citySelect.addEventListener('change', function() {
            const city = this.value;
            if (city) {
                loadDistricts(city);
                districtSelect.disabled = false;
            } else {
                districtSelect.disabled = true;
                districtSelect.innerHTML = '<option value="">请先选择城市</option>';
            }
        });
    }
}

// 加载省份列表
function loadProvinces() {
    // 使用百度地图API获取省份列表
    const provinces = [
        '北京市', '天津市', '上海市', '重庆市',
        '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
        '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
        '河南省', '湖北省', '湖南省', '广东省', '海南省',
        '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
        '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
        '香港特别行政区', '澳门特别行政区'
    ];
    
    const provinceSelect = document.getElementById('province-input');
    if (provinceSelect) {
        provinces.forEach(province => {
            const option = document.createElement('option');
            option.value = province;
            option.textContent = province;
            provinceSelect.appendChild(option);
        });
    }
}

// 加载城市列表
function loadCities(province) {
    const citySelect = document.getElementById('city-input');
    if (!citySelect) return;
    
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    
    // 直接使用预定义的城市列表，避免CORS问题
    const cities = getCitiesByProvince(province);
    cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });
}

// 加载区县列表
function loadDistricts(city) {
    const districtSelect = document.getElementById('district-input');
    if (!districtSelect) return;
    
    districtSelect.innerHTML = '<option value="">请选择市区</option>';
    
    // 直接使用预定义的区县列表
    const districts = getDistrictsByCity(city);
    
    if (districts.length > 0) {
        districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
    } else {
        // 如果没有预定义数据，添加通用选项
        const option = document.createElement('option');
        option.value = '市辖区';
        option.textContent = '市辖区';
        districtSelect.appendChild(option);
    }
}

// 根据省份获取城市列表（简化版）
function getCitiesByProvince(province) {
    const cityMap = {
        '北京市': ['北京市'],
        '天津市': ['天津市'],
        '上海市': ['上海市'],
        '重庆市': ['重庆市'],
        '河北省': ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'],
        '山西省': ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'],
        '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'],
        '吉林省': ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'],
        '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市', '大兴安岭地区'],
        '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'],
        '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
        '安徽省': ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '六安市', '亳州市', '池州市', '宣城市'],
        '福建省': ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'],
        '江西省': ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '吉安市', '宜春市', '抚州市', '上饶市'],
        '山东省': ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'],
        '河南省': ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市'],
        '湖北省': ['武汉市', '黄石市', '十堰市', '宜昌市', '襄阳市', '鄂州市', '荆门市', '孝感市', '荆州市', '黄冈市', '咸宁市', '随州市', '恩施土家族苗族自治州'],
        '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州'],
        '广东省': ['广州市', '韶关市', '深圳市', '珠海市', '汕头市', '佛山市', '江门市', '湛江市', '茂名市', '肇庆市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'],
        '广西壮族自治区': ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'],
        '海南省': ['海口市', '三亚市', '三沙市', '儋州市'],
        '四川省': ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'],
        '贵州省': ['贵阳市', '六盘水市', '遵义市', '安顺市', '毕节市', '铜仁市', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'],
        '云南省': ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'],
        '陕西省': ['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市', '安康市', '商洛市'],
        '甘肃省': ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'],
        '青海省': ['西宁市', '海东市'],
        '内蒙古自治区': ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市'],
        '西藏自治区': ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'],
        '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'],
        '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市'],
        '台湾省': ['台北市', '高雄市', '台中市', '台南市'],
        '香港特别行政区': ['香港'],
        '澳门特别行政区': ['澳门']
    };
    
    return cityMap[province] || [];
}

// 根据城市获取区县列表（简化版）
function getDistrictsByCity(city) {
    const districtMap = {
        '北京市': ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
        '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '浦东新区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
        '广州市': ['荔湾区', '越秀区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
        '深圳市': ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区', '大鹏新区'],
        '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区'],
        '杭州市': ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区'],
        '重庆市': ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区', '梁平区', '武隆区'],
        '天津市': ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '滨海新区', '宁河区', '静海区', '蓟州区'],
        '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'],
        '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'],
        '西安市': ['新城区', '碑林区', '莲湖区', '灞桥区', '未央区', '雁塔区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区'],
        '苏州市': ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '昆山市', '太仓市', '常熟市', '张家港市'],
        '郑州市': ['中原区', '二七区', '管城回族区', '金水区', '上街区', '惠济区', '中牟县', '巩义市', '荥阳市', '新密市', '新郑市', '登封市'],
        '长沙市': ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市'],
        '永州市': ['零陵区', '冷水滩区', '祁阳市', '东安县', '双牌县', '道县', '江永县', '宁远县', '蓝山县', '新田县', '江华瑶族自治县']
    };
    
    // 如果找不到对应城市，返回空数组而不是市辖区
    return districtMap[city] || [];
}

// ==================== 加载菜系列表 ====================
let cuisineData = null; // 缓存菜系数据

async function loadCuisineTypes() {
    const categorySelect = document.getElementById('cuisine-category-input');
    const cuisineSelect = document.getElementById('cuisine-input');
    
    if (!categorySelect || !cuisineSelect) return;
    
    try {
        // 显示加载状态
        categorySelect.innerHTML = '<option value="">正在加载餐饮分类...</option>';
        categorySelect.disabled = true;
        
        // 从后端API获取层级化的菜系数据
        const response = await fetch(`${API_BASE_URL}/cuisine-types`);
        const result = await response.json();
        
        if (result.status === 'success' && result.data && result.data.categories) {
            cuisineData = result.data;
            
            // 填充餐饮大类下拉框
            categorySelect.innerHTML = '<option value="">请选择餐饮大类</option>';
            
            const categories = Object.keys(cuisineData.categories).sort();
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = `${category} (${cuisineData.categories[category].length}种)`;
                categorySelect.appendChild(option);
            });
            
            categorySelect.disabled = false;
            
            console.log(`✅ 菜系分类加载成功: ${cuisineData.total_categories}个大类, ${cuisineData.total_cuisines}种菜系`);
        } else {
            throw new Error('菜系数据格式错误');
        }
    } catch (error) {
        console.error('加载菜系列表失败:', error);
        
        // 降级方案: 使用预定义列表
        categorySelect.innerHTML = `
            <option value="">请选择餐饮大类</option>
            <option value="中餐馆">中餐馆 (31种)</option>
            <option value="外国餐厅">外国餐厅 (10种)</option>
            <option value="快餐店">快餐店 (5种)</option>
            <option value="小吃快餐店">小吃快餐店 (6种)</option>
            <option value="烤肉店">烤肉店 (3种)</option>
            <option value="自助餐">自助餐 (1种)</option>
            <option value="甜品店">甜品店 (3种)</option>
            <option value="咖啡厅">咖啡厅 (2种)</option>
        `;
        
        // 设置降级数据
        cuisineData = {
            categories: {
                "中餐馆": ["川菜", "粤菜", "湘菜", "鲁菜", "苏菜", "浙菜", "闽菜", "徽菜", "火锅店", "烧烤店", "海鲜餐厅", "特色菜", "家常菜", "私房菜", "北京菜", "上海菜", "东北菜", "西北菜", "云南菜", "贵州菜", "江浙菜", "农家菜", "官府菜", "清真菜", "素食餐厅", "融合菜", "小龙虾店", "烤鱼店", "烤鸭店", "焖锅店", "汤锅店"],
                "外国餐厅": ["日本料理", "韩国料理", "西餐厅", "东南亚菜", "铁板烧", "法国菜", "意大利菜", "美式餐厅", "墨西哥菜", "印度菜"],
                "快餐店": ["中式快餐", "西式快餐", "汉堡店", "炸鸡店", "披萨店"],
                "小吃快餐店": ["小吃", "面馆", "米粉店", "饺子馆", "包子铺", "生煎/锅贴"],
                "烤肉店": ["韩式烤肉", "日式烤肉", "巴西烤肉"],
                "自助餐": ["自助餐"],
                "甜品店": ["甜品店", "冰淇淋店", "奶茶店"],
                "咖啡厅": ["咖啡厅", "茶馆"]
            }
        };
        
        categorySelect.disabled = false;
        console.warn('⚠️ 使用预定义菜系列表');
    }
}

// 餐饮大类选择事件
function initCuisineSelector() {
    const categorySelect = document.getElementById('cuisine-category-input');
    const cuisineSelect = document.getElementById('cuisine-input');
    
    if (!categorySelect || !cuisineSelect) return;
    
    categorySelect.addEventListener('change', function() {
        const category = this.value;
        
        if (!category || !cuisineData) {
            cuisineSelect.disabled = true;
            cuisineSelect.innerHTML = '<option value="">请先选择餐饮大类</option>';
            return;
        }
        
        // 填充菜系下拉框
        cuisineSelect.innerHTML = '<option value="">请选择菜系</option>';
        
        const cuisines = cuisineData.categories[category] || [];
        cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            cuisineSelect.appendChild(option);
        });
        
        cuisineSelect.disabled = false;
    });
}

// ==================== 表单验证 ====================
function validateInput(input) {
    const errorSpan = input.parentElement.querySelector('.error-message');
    if (!errorSpan) return true;
    
    const value = input.value.trim();
    const id = input.id;
    
    // 必填字段验证
    if (input.hasAttribute('required') && !value) {
        showError(input, errorSpan, '此字段为必填项');
        return false;
    }
    
    // 数值范围验证
    if (input.type === 'number' && value) {
        const num = parseFloat(value);
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        
        if (min && num < min) {
            showError(input, errorSpan, `最小值为 ${min}`);
            return false;
        }
        if (max && num > max) {
            showError(input, errorSpan, `最大值为 ${max}`);
            return false;
        }
    }
    
    clearError(input, errorSpan);
    return true;
}

function showError(input, errorSpan, message) {
    input.classList.add('error');
    errorSpan.textContent = message;
    errorSpan.style.display = 'block';
}

function clearError(input, errorSpan) {
    input.classList.remove('error');
    errorSpan.textContent = '';
    errorSpan.style.display = 'none';
}

function validateAllInputs() {
    const inputIds = ['province-input', 'city-input', 'district-input', 'street-input', 'business-area-input', 
                      'cuisine-category-input', 'cuisine-input', 'price-input', 'rent-input', 'area-input', 
                      'revenue-input', 'brand-input', 'income-input'];
    
    let isValid = true;
    let firstInvalidInput = null;
    
    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input && !validateInput(input)) {
            isValid = false;
            if (!firstInvalidInput) {
                firstInvalidInput = input;
            }
        }
    });
    
    // 滚动到第一个错误字段
    if (firstInvalidInput) {
        firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    return isValid;
}

// 清除所有错误提示
function clearAllErrors() {
    const inputIds = ['province-input', 'city-input', 'district-input', 'street-input', 'business-area-input', 
                      'cuisine-category-input', 'cuisine-input', 'price-input', 'rent-input', 'area-input', 
                      'revenue-input', 'brand-input', 'income-input'];
    
    inputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const errorSpan = input.parentElement.querySelector('.error-message');
            if (errorSpan) {
                clearError(input, errorSpan);
            }
        }
    });
}

// ==================== 执行选址运算 ====================
async function performCalculation() {
    // 付费检查（管理员免费）
    if (typeof AUTH !== 'undefined') {
        if (!AUTH.isLoggedIn()) { window.location.href = '/pages/auth/login.html'; return; }
        const user = AUTH.getUser();
        const radius = parseInt(document.querySelector('.radius-btn.active')?.dataset.radius || '5000');
        const priceMap = { 1000: 99, 3000: 149, 5000: 199 };
        const price = priceMap[radius] || 99;
        if (user && user.role !== 'admin') {
            if (user.balance < price) {
                showMessage(`余额不足，${radius/1000}km分析需要${price}元，当前余额${user.balance.toFixed(2)}元`, 'error');
                return;
            }
            if (!confirm(`本次分析将扣费${price}元，当前余额${user.balance.toFixed(2)}元，确认继续？`)) return;
        }
    }

    // 先清除之前的错误提示
    clearAllErrors();
    
    // 验证所有输入
    if (!validateAllInputs()) {
        showMessage('请检查并填写完整信息', 'warning');
        return;
    }
    
    // 收集表单数据
    const province = document.getElementById('province-input').value.trim();
    const city = document.getElementById('city-input').value.trim();
    const district = document.getElementById('district-input').value.trim();
    
    const data = {
        city: city,
        district: district,
        street_address: document.getElementById('street-input').value.trim(),
        business_area: document.getElementById('business-area-input').value.trim(),
        cuisine_type: document.getElementById('cuisine-input').value.trim(),
        avg_price_per_person: parseFloat(document.getElementById('price-input').value),
        monthly_rent: parseFloat(document.getElementById('rent-input').value),
        area_sqm: parseFloat(document.getElementById('area-input').value),
        estimated_monthly_revenue: parseFloat(document.getElementById('revenue-input').value),
        renovation_cost: parseFloat(document.getElementById('renovation-input').value) || 0,
        equipment_cost: parseFloat(document.getElementById('equipment-input').value) || 0,
        franchise_fee: parseFloat(document.getElementById('franchise-input').value) || 0,
        initial_stock_promotion_cost: parseFloat(document.getElementById('stock-promotion-input').value) || 0,
        search_radius: parseInt(document.querySelector('.radius-btn.active')?.dataset.radius || '5000'),
        competitors_within_5km: null,
        brand_influence_score: parseInt(document.getElementById('brand-input').value),
        avg_income_within_5km: parseFloat(document.getElementById('income-input').value)
    };
    
    // 显示加载动画
    showLoading();
    disableButton('calculate-button', true);
    
    // 使用SSE接口实时获取进度
    let timeoutId = null;
    let lastProgressTime = Date.now();
    
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof AUTH !== 'undefined' && AUTH.getToken()) {
            headers['Authorization'] = `Bearer ${AUTH.getToken()}`;
        }
        const response = await fetch(`${API_BASE_URL}/analyze-stream`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error('分析请求失败');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        // 设置60秒超时检测
        const checkTimeout = () => {
            const now = Date.now();
            if (now - lastProgressTime > 60000) {
                // 超过60秒没有进度更新
                reader.cancel();
                throw new Error('分析超时，可能是数据库连接失败或服务异常');
            }
            timeoutId = setTimeout(checkTimeout, 5000); // 每5秒检查一次
        };
        timeoutId = setTimeout(checkTimeout, 5000);
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            lastProgressTime = Date.now(); // 更新最后进度时间
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    try {
                        const event = JSON.parse(jsonStr);
                        
                        if (event.type === 'start') {
                            updateLoadingStep(event.message, 0);
                        } else if (event.type === 'progress') {
                            const progress = (event.step / 6) * 100;
                            updateLoadingStep(event.message, progress);
                        } else if (event.type === 'complete') {
                            // 清除超时检测
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            // 显示报告
                            displayReport(event.result);
                            showMessage('报告生成成功', 'success');
                            clearAllErrors();
                            
                            // 延迟1.5秒后关闭进度弹窗（但保留查看进度按钮）
                            setTimeout(() => {
                                hideProgressModal();
                                // 不调用hideLoading()，保留查看进度按钮
                            }, 1500);
                        } else if (event.type === 'error') {
                            // 清除超时检测
                            if (timeoutId) clearTimeout(timeoutId);
                            throw new Error(event.message);
                        }
                    } catch (e) {
                        console.error('解析SSE消息失败:', e, jsonStr);
                    }
                }
            }
        }
        
        // 清除超时检测
        if (timeoutId) clearTimeout(timeoutId);
        
    } catch (error) {
        // 清除超时检测
        if (timeoutId) clearTimeout(timeoutId);
        
        console.error('运算失败:', error);
        hideProgressModal(); // 只关闭弹窗，不隐藏按钮
        showMessage(`运算失败: ${error.message}`, 'error');
    } finally {
        disableButton('calculate-button', false);
    }
}

// ==================== 加载动画控制（流程卡片式） ====================
let stepStartTime = {};

function updateProcessStep(step, status, message) {
    const card = document.querySelector(`.process-card[data-step="${step}"]`);
    const resultEl = document.getElementById(`result-${step}`);
    const statusEl = document.getElementById(`status-${step}`);
    
    if (!card || !resultEl || !statusEl) return;
    
    // 使用requestAnimationFrame优化DOM更新
    requestAnimationFrame(() => {
        // 移除所有状态类
        card.classList.remove('active', 'completed', 'error');
        
        // 更新状态
        if (status === 'start') {
            card.classList.add('active');
            statusEl.textContent = '⏳';
            resultEl.textContent = message;
            stepStartTime[step] = Date.now();
            
            // 如果是DeepSeek分析步骤，停止所有动画以节省CPU
            if (step === 5 || step === 6) {
                // 停止所有已完成卡片的动画
                document.querySelectorAll('.process-card.completed').forEach(c => {
                    c.querySelector('.card-status').style.animation = 'none';
                });
                // 停止进度条动画
                const progressBar = document.getElementById('progress-bar');
                if (progressBar) {
                    progressBar.style.transition = 'none';
                }
            }
        } else if (status === 'success') {
            card.classList.add('completed');
            statusEl.textContent = '✅';
            resultEl.textContent = message;
            
            // 显示耗时
            if (stepStartTime[step]) {
                const duration = ((Date.now() - stepStartTime[step]) / 1000).toFixed(1);
                resultEl.textContent += ` (${duration}s)`;
            }
            
            // 完成后停止动画
            const cardStatus = card.querySelector('.card-status');
            if (cardStatus) cardStatus.style.animation = 'none';
        } else if (status === 'error') {
            card.classList.add('error');
            statusEl.textContent = '⚠️';
            resultEl.textContent = message;
            const cardStatus = card.querySelector('.card-status');
            if (cardStatus) cardStatus.style.animation = 'none';
        }
    });
}

function updateLoadingStep(message, progress) {
    // 使用requestAnimationFrame优化性能
    requestAnimationFrame(() => {
        // 更新进度条
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = Math.round(progress) + '%';
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = Math.round(progress) + '%';
        }
    });
    
    // 解析消息,更新对应的卡片
    if (message.includes('地址解析') || message.includes('正在解析地址')) {
        if (message.includes('✅')) {
            updateProcessStep(1, 'success', message.replace('✅ ', ''));
        } else {
            updateProcessStep(1, 'start', '正在解析地址坐标...');
        }
    } else if (message.includes('地铁') || message.includes('查询最近地铁')) {
        if (message.includes('✅')) {
            updateProcessStep(2, 'success', message.replace('✅ ', ''));
        } else if (message.includes('⚠️')) {
            updateProcessStep(2, 'error', message.replace('⚠️ ', ''));
        } else {
            updateProcessStep(2, 'start', '正在查询最近地铁站...');
        }
    } else if (message.includes('POI采集') || message.includes('采集周边POI')) {
        if (message.includes('✅')) {
            updateProcessStep(3, 'success', message.replace('✅ ', ''));
        } else {
            updateProcessStep(3, 'start', '正在采集周边POI数据...');
        }
    } else if (message.includes('商圈') || message.includes('坪效')) {
        if (message.includes('✅')) {
            updateProcessStep(4, 'success', message.replace('✅ ', ''));
        } else {
            updateProcessStep(4, 'start', '商圈定级与坪效评估中...');
        }
    } else if (message.includes('DeepSeek') || message.includes('AI')) {
        if (message.includes('✅')) {
            updateProcessStep(5, 'success', message.replace('✅ ', ''));
        } else {
            updateProcessStep(5, 'start', 'DeepSeek AI深度分析中...');
        }
    } else if (message.includes('报告')) {
        if (message.includes('✅')) {
            updateProcessStep(6, 'success', message.replace('✅ ', ''));
        } else {
            updateProcessStep(6, 'start', '正在生成分析报告...');
        }
    }
}

function showLoadingWithProgress() {
    // 显示进度弹窗
    const progressModal = document.getElementById('progress-modal');
    const progressOverlay = document.getElementById('progress-overlay');
    
    if (progressModal) progressModal.style.display = 'flex';
    if (progressOverlay) progressOverlay.classList.add('show');
    
    // 显示"查看进度"按钮
    const viewProgressBtn = document.getElementById('view-progress-btn');
    if (viewProgressBtn) viewProgressBtn.style.display = 'inline-flex';
    
    // 重置所有卡片状态
    const cards = document.querySelectorAll('.process-card');
    
    cards.forEach(card => {
        card.classList.remove('active', 'completed', 'error');
        const step = card.getAttribute('data-step');
        const resultEl = document.getElementById(`result-${step}`);
        const statusEl = document.getElementById(`status-${step}`);
        if (resultEl) resultEl.textContent = '等待中...';
        if (statusEl) statusEl.textContent = '⏳';
    });
    
    // 重置进度条
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercentage) progressPercentage.textContent = '0%';
    
    // 清空计时器
    stepStartTime = {};
}

function showLoading() {
    showLoadingWithProgress();
}

function hideLoading() {
    // 报告生成完成，自动关闭进度弹窗
    hideProgressModal();
    
    // 隐藏"查看进度"按钮
    const viewProgressBtn = document.getElementById('view-progress-btn');
    if (viewProgressBtn) viewProgressBtn.style.display = 'none';
}

// ==================== 报告显示 ====================
function displayReport(result) {
    const reportDisplay = document.getElementById('report-display');
    const reportContent = document.getElementById('report-content');
    const reportTitle = document.getElementById('report-title');
    
    // 设置标题
    const address = result.report.street_address || result.report.business_area || '选址分析报告';
    reportTitle.textContent = address;
    
    // 存储当前报告ID
    window.currentReportId = result.report_id;
    
    // 构建报告HTML
    let html = `
        <div class="report-section">
            <div class="report-summary">
                <div class="summary-card">
                    <div class="card-label">竞争环境</div>
                    <div class="card-value">${result.report.competition_summary || '分析中'}</div>
                </div>
                <div class="summary-card">
                    <div class="card-label">建议客单价</div>
                    <div class="card-value highlight">¥${result.report.suggested_avg_price || 0}</div>
                </div>
                <div class="summary-card">
                    <div class="card-label">预计日均流水</div>
                    <div class="card-value highlight">¥${result.report.estimated_daily_revenue || 0}</div>
                </div>
                <div class="summary-card">
                    <div class="card-label">翻台率</div>
                    <div class="card-value">${result.report.weighted_avg_turnover_rate || 0}</div>
                </div>
                <div class="summary-card">
                    <div class="card-label">预计经营月数(P50)</div>
                    <div class="card-value">${result.report.estimated_operating_months_p50 || 0}个月</div>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4 class="section-title">核心经营指标</h4>
            <div class="metrics-grid">`;
    
    // 经营指标
    if (result.report.core_metrics && result.report.core_metrics.operating) {
        const operating = result.report.core_metrics.operating;
        html += `
            <div class="metric-category">
                <div class="category-title">经营指标</div>
                <div class="metric-item">
                    <span>日均销售额</span>
                    <span class="metric-value">¥${operating.daily_sales || 0}</span>
                </div>
                <div class="metric-item">
                    <span>店均销售额</span>
                    <span class="metric-value">¥${operating.store_avg_sales || 0}</span>
                </div>
                <div class="metric-item">
                    <span>毛利额</span>
                    <span class="metric-value">¥${operating.gross_profit || 0}</span>
                </div>
                <div class="metric-item">
                    <span>毛利率</span>
                    <span class="metric-value">${((operating.gross_profit_margin || 0) * 100).toFixed(1)}%</span>
                </div>
            </div>`;
    }
    
    // 管理指标
    if (result.report.core_metrics && result.report.core_metrics.management) {
        const mgmt = result.report.core_metrics.management;
        html += `
            <div class="metric-category">
                <div class="category-title">管理指标</div>
                <div class="metric-item">
                    <span>客单价</span>
                    <span class="metric-value">¥${mgmt.avg_price_per_person || 0}</span>
                </div>
                <div class="metric-item">
                    <span>交易次数</span>
                    <span class="metric-value">${mgmt.transaction_count || 0}</span>
                </div>
                <div class="metric-item">
                    <span>周转率</span>
                    <span class="metric-value">${mgmt.turnover_rate || 0}</span>
                </div>
                <div class="metric-item">
                    <span>坪效</span>
                    <span class="metric-value">¥${mgmt.sales_per_sqm || 0}/㎡</span>
                </div>
            </div>`;
    }
    
    // 工具类指标
    if (result.report.core_metrics && result.report.core_metrics.tools) {
        const tools = result.report.core_metrics.tools;
        html += `
            <div class="metric-category">
                <div class="category-title">工具类指标</div>
                <div class="metric-item">
                    <span>动销率</span>
                    <span class="metric-value">${((tools.sales_rate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span>存销比</span>
                    <span class="metric-value">${tools.inventory_sales_ratio || 0}</span>
                </div>
                <div class="metric-item">
                    <span>交叉比率</span>
                    <span class="metric-value">${tools.cross_ratio || 0}</span>
                </div>
                <div class="metric-item">
                    <span>投资回收期</span>
                    <span class="metric-value">${tools.payback_period_months || 0}个月</span>
                </div>
            </div>`;
    }
    
    html += `
            </div>
        </div>
        
        <div class="report-section">
            <h4 class="section-title">详细分析</h4>
            <div class="analysis-content">
                ${formatAnalysisText(result.report.detailed_analysis)}
            </div>
        </div>
        
        <div class="report-section">
            <h4 class="section-title">地理信息</h4>
            <div class="geo-info">
                <div class="info-item">
                    <span class="info-label">地铁距离</span>
                    <span class="info-value">${result.report.metro_distance_meters || 0}米</span>
                </div>
                <div class="info-item">
                    <span class="info-label">商圈等级</span>
                    <span class="info-value">${result.report.business_area_level || '未知'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">预估人流量</span>
                    <span class="info-value">${result.report.estimated_foot_traffic || 0}人/日</span>
                </div>
            </div>
        </div>
        
        <div class="report-section">
            <h4 class="section-title">投资分析</h4>
            <div class="geo-info">
                <div class="info-item">
                    <span class="info-label">总投入</span>
                    <span class="info-value highlight">¥${(result.report.total_investment || 0).toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">预估月营收</span>
                    <span class="info-value highlight">¥${(result.report.projected_monthly_revenue || 0).toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">预估月毛利</span>
                    <span class="info-value highlight">¥${(result.report.projected_monthly_profit || 0).toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">投资回报周期</span>
                    <span class="info-value">${result.report.payback_period_months || 0}个月</span>
                </div>
                <div class="info-item">
                    <span class="info-label">投资评分</span>
                    <span class="info-value">${result.report.investment_score || 0}分 (${result.report.investment_score >= 90 ? '优' : result.report.investment_score >= 80 ? '良' : '差'})</span>
                </div>
                <div class="info-item">
                    <span class="info-label">平均坪效</span>
                    <span class="info-value">¥${result.report.avg_revenue_per_sqm || 0}/㎡/月</span>
                </div>
            </div>
        </div>
    `;
    
    reportContent.innerHTML = html;
    reportDisplay.style.display = 'block';
    
    console.log('报告HTML已设置');
    console.log('reportDisplay.style.display =', reportDisplay.style.display);
    console.log('reportContent.innerHTML长度 =', reportContent.innerHTML.length);
}

// ==================== 结论性语句映射 ====================
function getConclusion(summary) {
    if (!summary) return { text: '', level: '' };
    
    const compMatch = summary.match(/竞争烈度[：:](\S+)/);
    const riskMatch = summary.match(/风险等级[：:](\S+)/);
    const comp = compMatch ? compMatch[1] : '';
    const risk = riskMatch ? riskMatch[1] : '';
    
    const isHighComp = comp.includes('高') || comp.includes('激烈');
    const isHighRisk = risk.includes('高') || risk.includes('极高');
    const isLowRisk = risk.includes('低') || risk.includes('可控');
    
    if (isHighRisk) return { text: '开店条件并不成熟，三思啊', level: 'danger' };
    if (isHighComp) return { text: '同业态同品类竞品较多，请慎重', level: 'warning' };
    if (isLowRisk) return { text: '恭喜你，完全可以开店', level: 'success' };
    return { text: '谋定而后动，行稳而致远', level: 'caution' };
}

// ==================== 历史记录 ====================
async function showHistory() {
    const historyList = document.getElementById('history-list');
    const historyContent = document.getElementById('history-content');
    const historyOverlay = document.getElementById('history-overlay');
    
    if (!historyList || !historyContent) {
        console.error('历史记录元素未找到！');
        return;
    }
    
    // 隐藏报告显示区域
    const reportDisplay = document.getElementById('report-display');
    if (reportDisplay) reportDisplay.style.display = 'none';
    
    // 显示遮罩层和历史记录
    if (historyOverlay) {
        historyOverlay.classList.add('show');
    }
    
    historyList.style.display = 'flex';
    
    historyContent.innerHTML = '<div class="loading-text">加载中...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/history?limit=50`);
        if (!response.ok) throw new Error('获取历史记录失败');
        
        const data = await response.json();
        
        if (!data.records || data.records.length === 0) {
            historyContent.innerHTML = '<div class="empty-message">暂无历史记录</div>';
            return;
        }
        
        let html = '<div class="history-items">';
        data.records.forEach(record => {
            const date = new Date(record.generated_at).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="history-item" data-report-id="${record.report_id}">
                    <div class="history-item-header">
                        <span class="history-address">${record.street_address || '未知地址'}</span>
                        <span class="history-date">${date}</span>
                    </div>
                    <div class="history-item-details">
                        <span class="detail-tag">${record.cuisine_type || '未知菜系'}</span>
                        <span class="detail-tag">客单价: ¥${record.avg_price_per_person || 0}</span>
                        <span class="detail-tag">${record.competition_summary || '查看详情'}</span>
                    </div>
                    ${(() => { const c = getConclusion(record.competition_summary); return c.text ? `<div class="history-conclusion ${c.level}">${c.text}</div>` : ''; })()}
                    <div class="history-item-actions">
                        <button class="action-btn view-btn" onclick="toggleHistoryDetail('${record.report_id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            <span class="view-text">查看</span>
                        </button>
                        <button class="action-btn download-btn" onclick="downloadReport('${record.report_id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            下载
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteReport('${record.report_id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            删除
                        </button>
                    </div>
                    <div class="history-item-detail" id="detail-${record.report_id}"></div>
                </div>`;
        });
        html += '</div>';
        
        historyContent.innerHTML = html;
        
    } catch (error) {
        console.error('获取历史记录失败:', error);
        historyContent.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
    }
}

function hideHistory() {
    const historyList = document.getElementById('history-list');
    const historyOverlay = document.getElementById('history-overlay');
    
    historyList.style.display = 'none';
    if (historyOverlay) {
        historyOverlay.classList.remove('show');
    }
}

// ==================== 进度弹窗控制 ====================
function showProgressModal() {
    const progressModal = document.getElementById('progress-modal');
    const progressOverlay = document.getElementById('progress-overlay');
    
    if (progressModal) progressModal.style.display = 'flex';
    if (progressOverlay) progressOverlay.classList.add('show');
}

function hideProgressModal() {
    const progressModal = document.getElementById('progress-modal');
    const progressOverlay = document.getElementById('progress-overlay');
    
    if (progressModal) progressModal.style.display = 'none';
    if (progressOverlay) progressOverlay.classList.remove('show');
}

// 切换历史记录详情展开/收起
window.toggleHistoryDetail = async function(reportId) {
    const historyItem = document.querySelector(`.history-item[data-report-id="${reportId}"]`);
    const detailDiv = document.getElementById(`detail-${reportId}`);
    const viewBtn = historyItem?.querySelector('.view-text');
    
    console.log('toggleHistoryDetail被调用, reportId:', reportId);
    console.log('historyItem:', historyItem);
    console.log('detailDiv:', detailDiv);
    
    if (!historyItem || !detailDiv) {
        console.error('找不到元素');
        return;
    }
    
    // 如果已经展开，则收起
    if (historyItem.classList.contains('expanded')) {
        historyItem.classList.remove('expanded');
        if (viewBtn) viewBtn.textContent = '查看';
        console.log('收起详情');
        return;
    }
    
    // 收起其他所有展开的项
    document.querySelectorAll('.history-item.expanded').forEach(item => {
        item.classList.remove('expanded');
        const btn = item.querySelector('.view-text');
        if (btn) btn.textContent = '查看';
    });
    
    // 如果详情已加载，直接展开
    if (detailDiv.innerHTML) {
        historyItem.classList.add('expanded');
        if (viewBtn) viewBtn.textContent = '收起';
        console.log('展开已加载的详情');
        return;
    }
    
    // 加载报告详情
    try {
        console.log('开始加载报告详情...');
        const response = await fetch(`${API_BASE_URL}/history/${reportId}`);
        if (!response.ok) throw new Error('获取报告详情失败');
        
        const result = await response.json();
        console.log('获取到的报告数据:', result);
        
        // 构建报告HTML
        let html = `
            <div class="report-section">
                <div class="report-summary">
                    <div class="summary-card">
                        <div class="card-label">竞争环境</div>
                        <div class="card-value">${result.report.competition_summary || '分析中'}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">建议客单价</div>
                        <div class="card-value highlight">¥${result.report.suggested_avg_price || 0}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">预计日均流水</div>
                        <div class="card-value highlight">¥${result.report.estimated_daily_revenue || 0}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">翻台率</div>
                        <div class="card-value">${result.report.weighted_avg_turnover_rate || 0}</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-label">预计经营月数(P50)</div>
                        <div class="card-value">${result.report.estimated_operating_months_p50 || 0}个月</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h4 class="section-title">详细分析</h4>
                <div class="analysis-content">
                    ${formatAnalysisText(result.report.detailed_analysis)}
                </div>
            </div>
        `;
        
        detailDiv.innerHTML = html;
        historyItem.classList.add('expanded');
        if (viewBtn) viewBtn.textContent = '收起';
        console.log('详情加载完成并展开');
        
    } catch (error) {
        console.error('获取报告详情失败:', error);
        detailDiv.innerHTML = `<div class="error-message">加载失败: ${error.message}</div>`;
    }
}

// 删除报告
window.deleteReport = async function(reportId) {
    if (!confirm('确定要删除这条报告吗？此操作不可恢复。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/history/${reportId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('删除失败');
        
        // 延迟刷新历史记录列表，避免立即重新加载
        setTimeout(() => {
            showHistory();
        }, 500);
        
    } catch (error) {
        console.error('删除报告失败:', error);
    }
}

// ==================== 报告下载 ====================
window.downloadReport = async function(reportId) {
    try {
        // 调用PDF下载接口
        const response = await fetch(`${API_BASE_URL}/download/${reportId}`);
        if (!response.ok) throw new Error('下载PDF失败');
        
        // 获取文件名（从响应头中获取）
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `选址报告_${reportId}.pdf`;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
                // 解码URL编码的文件名
                filename = decodeURIComponent(filename);
            }
        }
        
        // 下载PDF文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
    } catch (error) {
        console.error('下载失败:', error);
    }
}

// ==================== 工具函数 ====================
// 格式化详细分析文本：句号后换行，首行缩进2字符
function formatAnalysisText(text) {
    if (!text) return '暂无详细分析';
    
    // 1. 将 **文字** 转为 <strong>
    let html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 2. 按换行符分段
    const paragraphs = html.split(/\n+/);
    let formatted = '';
    
    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;
        formatted += `<p style="text-indent:2em;margin:0.5em 0;line-height:1.8">${trimmed}</p>`;
    }
    
    return formatted || `<p style="text-indent:2em;line-height:1.8">${html}</p>`;
}

function showMessage(message, type = 'info') {
    const colors = {
        info: 'rgba(33, 150, 243, 0.9)',
        success: 'rgba(76, 175, 80, 0.9)',
        warning: 'rgba(255, 152, 0, 0.9)',
        error: 'rgba(255, 77, 79, 0.9)'
    };
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${colors[type]};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease;
    `;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => document.body.removeChild(messageDiv), 300);
    }, 3000);
}

function disableButton(buttonId, disabled) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.disabled = disabled;
    
    if (disabled) {
        button.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="rotating">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            运算中...`;
        button.style.opacity = '0.7';
    } else {
        button.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            开始运算`;
        button.style.opacity = '1';
    }
}

// ==================== 动画样式 ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    @keyframes slideDown {
        from { transform: translate(-50%, -20px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, -20px); opacity: 0; }
    }
`;
document.head.appendChild(style);
