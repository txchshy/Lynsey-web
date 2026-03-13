/**
 * 数字孪生仿真沙盒 - 前端逻辑
 */

// ── 全局状态 ──
let selectedLat = null;
let selectedLng = null;
let simulationTimer = null;
let _baiduAk = null;
let _currentSimulationId = null;
let _isPaused = false;
let _timerStartTime = 0;
let _timerElapsed = 0;
let _sseMessageIndex = 0;  // 断线重连时的消息索引
const _groupDetailCache = {};

const TWIN_API = LEVIATHAN_CONFIG.TWIN_API;
const CONFIG_API = LEVIATHAN_CONFIG.CONFIG_API;

// ── 初始化 ──
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);
    loadBaiduMapKey();
    initRegionSelector();
    loadCuisineTypes();
    initCuisineSelector();
    initFormValidation();
    initButtons();
    // 检查是否有正在运行的后台任务
    checkActiveSimulation();
});

function updateTime() {
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleString('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
}

// ── 百度地图（仅Geocoder） ──
async function loadBaiduMapKey() {
    try {
        const resp = await fetch(`${CONFIG_API}/baidu-map-key`);
        const data = await resp.json();
        _baiduAk = data.ak || null;
        if (_baiduAk) {
            const script = document.createElement('script');
            script.src = `https://api.map.baidu.com/api?v=3.0&ak=${_baiduAk}&callback=onBaiduMapReady`;
            document.head.appendChild(script);
        }
    } catch (_) { /* geocode不可用时提交仍可由后端兜底 */ }
}

window.onBaiduMapReady = function () { /* SDK就绪，Geocoder可用 */ };

function geocodeAddress() {
    if (typeof BMap === 'undefined') return;
    const city = document.getElementById('city-select').value;
    const district = document.getElementById('district-input').value;
    const address = document.getElementById('address-input').value;
    if (!city || !address) return;
    const fullAddr = `${city}${district}${address}`;
    const geocoder = new BMap.Geocoder();
    geocoder.getPoint(fullAddr, function (point) {
        if (point) {
            selectedLat = point.lat;
            selectedLng = point.lng;
            validateForm();
        }
    }, city);
}

// ── 表单验证 ──
function initFormValidation() {
    const inputs = ['province-select', 'city-select', 'district-input', 'address-input', 'restaurant-name', 'cuisine-category-select', 'cuisine-select', 'avg-price'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', validateForm);
            el.addEventListener('change', validateForm);
        }
    });
    document.getElementById('address-input').addEventListener('blur', geocodeAddress);
}

function validateForm() {
    const province = document.getElementById('province-select').value;
    const city = document.getElementById('city-select').value;
    const district = document.getElementById('district-input').value;
    const address = document.getElementById('address-input').value.trim();
    const name = document.getElementById('restaurant-name').value.trim();
    const category = document.getElementById('cuisine-category-select').value;
    const cuisine = document.getElementById('cuisine-select').value;
    const price = document.getElementById('avg-price').value;

    const valid = province && city && district && address && name && category && cuisine && price;
    document.getElementById('start-simulation').disabled = !valid;
    return valid;
}

// ── 省市区三级联动 ──
function initRegionSelector() {
    loadProvinces();

    const provinceSelect = document.getElementById('province-select');
    const citySelect = document.getElementById('city-select');
    const districtSelect = document.getElementById('district-input');

    provinceSelect.addEventListener('change', function () {
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
        validateForm();
    });

    citySelect.addEventListener('change', function () {
        const city = this.value;
        if (city) {
            loadDistricts(city);
            districtSelect.disabled = false;
        } else {
            districtSelect.disabled = true;
            districtSelect.innerHTML = '<option value="">请先选择城市</option>';
        }
        validateForm();
    });

    districtSelect.addEventListener('change', function () {
        validateForm();
        geocodeAddress();
    });
}

function loadProvinces() {
    const provinces = [
        '北京市', '天津市', '上海市', '重庆市',
        '河北省', '山西省', '辽宁省', '吉林省', '黑龙江省',
        '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省',
        '河南省', '湖北省', '湖南省', '广东省', '海南省',
        '四川省', '贵州省', '云南省', '陕西省', '甘肃省', '青海省', '台湾省',
        '内蒙古自治区', '广西壮族自治区', '西藏自治区', '宁夏回族自治区', '新疆维吾尔自治区',
        '香港特别行政区', '澳门特别行政区'
    ];
    const el = document.getElementById('province-select');
    provinces.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        el.appendChild(opt);
    });
}

function loadCities(province) {
    const citySelect = document.getElementById('city-select');
    citySelect.innerHTML = '<option value="">请选择城市</option>';
    getCitiesByProvince(province).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        citySelect.appendChild(opt);
    });
}

function loadDistricts(city) {
    const districtSelect = document.getElementById('district-input');
    districtSelect.innerHTML = '<option value="">请选择区域</option>';
    const districts = getDistrictsByCity(city);
    if (districts.length > 0) {
        districts.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = d;
            districtSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = '市辖区';
        opt.textContent = '市辖区';
        districtSelect.appendChild(opt);
    }
}

function getCitiesByProvince(province) {
    const cityMap = {
        '北京市': ['北京市'], '天津市': ['天津市'], '上海市': ['上海市'], '重庆市': ['重庆市'],
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
        '香港特别行政区': ['香港'], '澳门特别行政区': ['澳门']
    };
    return cityMap[province] || [];
}

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
    return districtMap[city] || [];
}

// ── 菜系两级联动 ──
let cuisineData = null;
const LOCATION_API = LEVIATHAN_CONFIG.LOCATION_API;

async function loadCuisineTypes() {
    const categorySelect = document.getElementById('cuisine-category-select');
    const cuisineSelect = document.getElementById('cuisine-select');
    if (!categorySelect || !cuisineSelect) return;

    categorySelect.innerHTML = '<option value="">正在加载餐饮分类...</option>';
    categorySelect.disabled = true;

    try {
        const response = await fetch(`${LOCATION_API}/cuisine-types`);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.categories) {
            cuisineData = result.data;
            categorySelect.innerHTML = '<option value="">请选择餐饮大类</option>';
            Object.keys(cuisineData.categories).sort().forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = `${cat} (${cuisineData.categories[cat].length}种)`;
                categorySelect.appendChild(opt);
            });
            categorySelect.disabled = false;
        } else {
            throw new Error('菜系数据格式错误');
        }
    } catch (e) {
        console.warn('菜系API加载失败，使用预定义列表:', e);
        cuisineData = {
            categories: {
                "中餐馆": ["川菜", "粤菜", "湘菜", "鲁菜", "苏菜", "浙菜", "闽菜", "徽菜", "火锅店", "烧烤店", "海鲜餐厅", "特色菜", "家常菜", "私房菜", "北京菜", "上海菜", "东北菜", "西北菜", "云南菜", "贵州菜", "江浙菜"],
                "外国餐厅": ["日本料理", "韩国料理", "西餐厅", "东南亚菜", "铁板烧", "法国菜", "意大利菜", "美式餐厅"],
                "快餐店": ["中式快餐", "西式快餐", "汉堡店", "炸鸡店", "披萨店"],
                "小吃快餐店": ["小吃", "面馆", "米粉店", "饺子馆", "包子铺", "生煎/锅贴"],
                "烤肉店": ["韩式烤肉", "日式烤肉", "巴西烤肉"],
                "自助餐": ["自助餐"],
                "甜品店": ["甜品店", "冰淇淋店", "奶茶店"],
                "咖啡厅": ["咖啡厅", "茶馆"]
            }
        };
        categorySelect.innerHTML = '<option value="">请选择餐饮大类</option>';
        Object.keys(cuisineData.categories).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = `${cat} (${cuisineData.categories[cat].length}种)`;
            categorySelect.appendChild(opt);
        });
        categorySelect.disabled = false;
    }
}

function initCuisineSelector() {
    const categorySelect = document.getElementById('cuisine-category-select');
    const cuisineSelect = document.getElementById('cuisine-select');
    if (!categorySelect || !cuisineSelect) return;

    categorySelect.addEventListener('change', function () {
        const category = this.value;
        if (!category || !cuisineData) {
            cuisineSelect.disabled = true;
            cuisineSelect.innerHTML = '<option value="">请先选择餐饮大类</option>';
            validateForm();
            return;
        }
        cuisineSelect.innerHTML = '<option value="">请选择菜系</option>';
        (cuisineData.categories[category] || []).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            cuisineSelect.appendChild(opt);
        });
        cuisineSelect.disabled = false;
        validateForm();
    });
}

// ── 按钮绑定 ──
function initButtons() {
    document.getElementById('start-simulation').addEventListener('click', startSimulation);
    document.getElementById('pause-simulation').addEventListener('click', togglePause);
    document.getElementById('stop-simulation').addEventListener('click', stopSimulation);
    document.getElementById('restart-simulation').addEventListener('click', () => {
        document.getElementById('simulation-result').style.display = 'none';
        document.getElementById('result-placeholder').style.display = 'flex';
    });
    document.getElementById('download-report').addEventListener('click', downloadReport);
    document.getElementById('btn-history').addEventListener('click', openHistory);
    document.getElementById('close-history').addEventListener('click', () => {
        document.getElementById('history-modal').style.display = 'none';
    });
    document.getElementById('history-modal').addEventListener('click', (e) => {
        if (e.target.id === 'history-modal') e.target.style.display = 'none';
    });
}

// ── 检查后台活跃任务（页面重载/切回时） ──
async function checkActiveSimulation() {
    const saved = localStorage.getItem('twin_active_simulation');
    if (!saved) return;

    try {
        const info = JSON.parse(saved);
        const simId = info.simulation_id;
        if (!simId) return;

        // 查询后端任务状态
        const resp = await fetch(`${TWIN_API}/simulate/${simId}/status`);
        if (!resp.ok) { localStorage.removeItem('twin_active_simulation'); return; }
        const data = await resp.json();

        if (data.status === 'running') {
            // 任务仍在运行，自动重连 SSE
            _currentSimulationId = data.simulation_id;
            _sseMessageIndex = 0;
            const btn = document.getElementById('start-simulation');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> 仿真中...';
            document.getElementById('result-placeholder').style.display = 'none';
            const progressEl = document.getElementById('simulation-progress');
            progressEl.style.display = 'block';
            document.querySelector('.progress-header').style.display = '';
            document.querySelector('.progress-bar-wrapper').style.display = '';
            document.getElementById('progress-text').style.display = '';
            document.getElementById('progress-groups').style.display = '';
            const histTitle = document.getElementById('history-title');
            if (histTitle) histTitle.style.display = 'none';
            // 使用后端返回的真实已运行时间
            _timerElapsed = (data.elapsed_seconds || 0) * 1000;
            _timerStartTime = Date.now();
            // 恢复暂停状态
            if (data.is_paused) {
                _isPaused = true;
                const pauseBtn = document.getElementById('pause-simulation');
                pauseBtn.style.display = 'inline-flex';
                pauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 继续';
                pauseBtn.classList.add('paused');
                document.getElementById('stop-simulation').style.display = 'inline-flex';
                // 暂停状态下计时器不动
                simulationTimer = setInterval(() => {
                    const elapsed = (_timerElapsed / 1000).toFixed(1);
                    document.getElementById('progress-timer').textContent = `${elapsed}s`;
                }, 100);
            } else {
                _isPaused = false;
                simulationTimer = setInterval(() => {
                    if (!_isPaused) {
                        const elapsed = ((_timerElapsed + Date.now() - _timerStartTime) / 1000).toFixed(1);
                        document.getElementById('progress-timer').textContent = `${elapsed}s`;
                    }
                }, 100);
            }
            // 更新 localStorage 为后端返回的真实 simulation_id
            localStorage.setItem('twin_active_simulation', JSON.stringify({
                simulation_id: data.simulation_id
            }));
            showToast('检测到正在运行的仿真任务，已自动重连', 'info');
            connectToStream(data.simulation_id, 0);
        } else if (data.status === 'completed') {
            localStorage.removeItem('twin_active_simulation');
            showToast('后台仿真任务已完成，可在历史记录中查看结果', 'success');
        } else {
            localStorage.removeItem('twin_active_simulation');
        }
    } catch (e) {
        localStorage.removeItem('twin_active_simulation');
    }
}

async function togglePause() {
    if (!_currentSimulationId) return;
    const btn = document.getElementById('pause-simulation');
    try {
        if (_isPaused) {
            await fetch(`${TWIN_API}/resume/${_currentSimulationId}`, { method: 'POST' });
            _timerStartTime = Date.now();
            _isPaused = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> 暂停';
            btn.classList.remove('paused');
            // 替换定时器为动态计时
            clearInterval(simulationTimer);
            simulationTimer = setInterval(() => {
                if (!_isPaused) {
                    const elapsed = ((_timerElapsed + Date.now() - _timerStartTime) / 1000).toFixed(1);
                    document.getElementById('progress-timer').textContent = `${elapsed}s`;
                }
            }, 100);
        } else {
            await fetch(`${TWIN_API}/pause/${_currentSimulationId}`, { method: 'POST' });
            _timerElapsed += Date.now() - _timerStartTime;
            _isPaused = true;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 继续';
            btn.classList.add('paused');
        }
    } catch (e) {
        showToast(`操作失败: ${e.message}`, 'error');
    }
}

async function stopSimulation() {
    if (!_currentSimulationId) return;
    if (!confirm('确认终止当前仿真？已完成的组结果不会丢失。')) return;
    try {
        await fetch(`${TWIN_API}/stop/${_currentSimulationId}`, { method: 'POST' });
        showToast('仿真已终止', 'info');
        clearInterval(simulationTimer);
        localStorage.removeItem('twin_active_simulation');
        document.getElementById('pause-simulation').style.display = 'none';
        document.getElementById('stop-simulation').style.display = 'none';
        document.getElementById('simulation-progress').style.display = 'none';
        document.getElementById('result-placeholder').style.display = 'flex';
        const btn = document.getElementById('start-simulation');
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 启动数字孪生仿真`;
        _currentSimulationId = null;
        _isPaused = false;
    } catch (e) {
        showToast(`终止失败: ${e.message}`, 'error');
    }
}

// ── 启动仿真 ──
async function startSimulation() {
    // 付费检查（管理员免费）
    if (typeof AUTH !== 'undefined') {
        if (!AUTH.isLoggedIn()) { window.location.href = '/pages/auth/login.html'; return; }
        const user = AUTH.getUser();
        if (user && user.role !== 'admin') {
            const price = 299;
            if (user.balance < price) {
                showToast(`余额不足，数字孪生仿真需要${price}元，当前余额${user.balance.toFixed(2)}元`, 'error');
                return;
            }
            if (!confirm(`本次仿真将扣费${price}元，当前余额${user.balance.toFixed(2)}元，确认继续？`)) return;
        }
    }

    const btn = document.getElementById('start-simulation');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> 仿真中...';

    document.getElementById('result-placeholder').style.display = 'none';
    document.getElementById('simulation-result').style.display = 'none';
    document.getElementById('category-boxes').innerHTML = '';
    Object.keys(_groupDetailCache).forEach(k => delete _groupDetailCache[k]);
    const progressEl = document.getElementById('simulation-progress');
    progressEl.style.display = 'block';
    document.querySelector('.progress-header').style.display = '';
    document.querySelector('.progress-bar-wrapper').style.display = '';
    document.getElementById('progress-text').style.display = '';
    document.getElementById('progress-groups').style.display = '';
    const histTitle = document.getElementById('history-title');
    if (histTitle) histTitle.style.display = 'none';

    _timerStartTime = Date.now();
    _timerElapsed = 0;
    _isPaused = false;
    _sseMessageIndex = 0;
    simulationTimer = setInterval(() => {
        if (!_isPaused) {
            const elapsed = ((_timerElapsed + Date.now() - _timerStartTime) / 1000).toFixed(1);
            document.getElementById('progress-timer').textContent = `${elapsed}s`;
        }
    }, 100);

    const payload = {
        restaurant_name: document.getElementById('restaurant-name').value.trim(),
        city: document.getElementById('city-select').value,
        district: document.getElementById('district-input').value.trim(),
        address: document.getElementById('address-input').value.trim(),
        latitude: selectedLat,
        longitude: selectedLng,
        cuisine_type: document.getElementById('cuisine-select').value,
        avg_price: parseFloat(document.getElementById('avg-price').value),
    };

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof AUTH !== 'undefined' && AUTH.getToken()) {
            headers['Authorization'] = `Bearer ${AUTH.getToken()}`;
        }
        // 第一步：POST 启动后台任务，立即返回 simulation_id
        const response = await fetch(`${TWIN_API}/simulate`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        if (result.status === 'busy') {
            // 已有任务在运行，自动切换到该任务的流
            _currentSimulationId = result.simulation_id;
            localStorage.setItem('twin_active_simulation', JSON.stringify({
                simulation_id: result.simulation_id
            }));
            showToast('已有仿真任务在运行，正在连接...', 'info');
            connectToStream(result.simulation_id, 0);
            return;
        }

        _currentSimulationId = result.simulation_id;
        // 保存到 localStorage，离开页面后可恢复
        localStorage.setItem('twin_active_simulation', JSON.stringify({
            simulation_id: result.simulation_id
        }));

        // 第二步：连接 SSE 流接收实时进度
        connectToStream(result.simulation_id, 0);

    } catch (e) {
        showToast(`仿真启动失败: ${e.message}`, 'error');
        progressEl.style.display = 'none';
        document.getElementById('result-placeholder').style.display = 'flex';
        clearInterval(simulationTimer);
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 启动数字孪生仿真`;
    }
}

// ── SSE 流连接 ──
async function connectToStream(simulationId, fromIndex) {
    const btn = document.getElementById('start-simulation');
    try {
        const response = await fetch(`${TWIN_API}/simulate/${simulationId}/stream?from_index=${fromIndex}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const msg = JSON.parse(line.slice(6));
                    if (msg._index !== undefined) _sseMessageIndex = msg._index + 1;
                    handleSSEMessage(msg);
                } catch (_) { /* skip */ }
            }
        }
    } catch (e) {
        // SSE 断线：如果任务仍在运行则不清理 UI，提示用户
        if (_currentSimulationId) {
            showToast('连接中断，刷新页面可自动重连', 'warning');
            return;
        }
        showToast(`仿真连接失败: ${e.message}`, 'error');
        document.getElementById('simulation-progress').style.display = 'none';
        document.getElementById('result-placeholder').style.display = 'flex';
    } finally {
        clearInterval(simulationTimer);
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> 启动数字孪生仿真`;
    }
}

function handleSSEMessage(msg) {
    switch (msg.type) {
        case 'init':
            _currentSimulationId = msg.simulation_id;
            // 更新 localStorage 为真实 simulation_id
            localStorage.setItem('twin_active_simulation', JSON.stringify({
                simulation_id: msg.simulation_id
            }));
            document.getElementById('pause-simulation').style.display = 'inline-flex';
            document.getElementById('stop-simulation').style.display = 'inline-flex';
            break;
        case 'group_result':
            updateProgress(msg);
            appendLiveFeedback(msg);
            break;
        case 'progress':
            updateProgress(msg);
            break;
        case 'complete':
            document.getElementById('progress-bar').style.width = '100%';
            document.getElementById('progress-text').textContent = '仿真完成';
            document.getElementById('pause-simulation').style.display = 'none';
            document.getElementById('stop-simulation').style.display = 'none';
            document.getElementById('simulation-result').style.display = 'block';
            localStorage.removeItem('twin_active_simulation');
            _currentSimulationId = null;
            _isPaused = false;
            renderCategoryStats();
            renderResult(msg.result);
            break;
        case 'error':
            showToast(msg.message, 'error');
            document.getElementById('simulation-progress').style.display = 'none';
            document.getElementById('result-placeholder').style.display = 'flex';
            document.getElementById('pause-simulation').style.display = 'none';
            document.getElementById('stop-simulation').style.display = 'none';
            localStorage.removeItem('twin_active_simulation');
            _currentSimulationId = null;
            _isPaused = false;
            break;
        case 'stopped':
            showToast('仿真已被终止', 'info');
            document.getElementById('simulation-progress').style.display = 'none';
            document.getElementById('result-placeholder').style.display = 'flex';
            document.getElementById('pause-simulation').style.display = 'none';
            document.getElementById('stop-simulation').style.display = 'none';
            localStorage.removeItem('twin_active_simulation');
            _currentSimulationId = null;
            _isPaused = false;
            break;
    }
}

const CATEGORY_ORDER = ['年轻白领', '学生群体', '家庭消费者', '美食达人', '随机低频用户'];

function _getCategoryFromLabel(label) {
    const idx = label.lastIndexOf('-G');
    return idx > 0 ? label.substring(0, idx) : label;
}

function _ensureCategoryBox(category) {
    const container = document.getElementById('category-boxes');
    let box = document.getElementById(`cat-box-${category}`);
    if (box) return box.querySelector('tbody');

    box = document.createElement('div');
    box.id = `cat-box-${category}`;
    box.className = 'category-box';
    box.innerHTML = `
        <div class="cat-box-header">
            <span class="cat-box-title">${category}</span>
            <span class="cat-box-count" id="cat-count-${category}">0/0</span>
        </div>
        <div class="cat-box-table-wrap">
            <table class="live-table">
                <thead><tr>
                    <th>组</th><th>模型</th><th>状态</th>
                    <th>查看</th><th>分享</th><th>评分</th><th>评论</th>
                    <th>会去吃</th><th>会推荐</th><th>均分</th>
                </tr></thead>
                <tbody></tbody>
            </table>
        </div>
    `;
    // 按固定顺序插入
    const orderIdx = CATEGORY_ORDER.indexOf(category);
    const children = Array.from(container.children);
    let inserted = false;
    for (const child of children) {
        const childCat = child.id.replace('cat-box-', '');
        if (CATEGORY_ORDER.indexOf(childCat) > orderIdx) {
            container.insertBefore(box, child);
            inserted = true;
            break;
        }
    }
    if (!inserted) container.appendChild(box);
    return box.querySelector('tbody');
}

function appendLiveFeedback(msg) {
    const category = _getCategoryFromLabel(msg.group_label);
    const tbody = _ensureCategoryBox(category);
    const opinions = msg.opinions || {};
    const actions = msg.actions || {};
    const statusCls = msg.status === 'success' ? 'status-ok' : 'status-fail';
    const statusText = msg.status === 'success' ? '✓' : '✗';
    const rating = msg.avg_rating != null ? msg.avg_rating.toFixed(1) : '-';
    const groupShort = msg.group_label.split('-').pop();

    // 缓存agent详情
    if (msg.agent_results) _groupDetailCache[msg.group_label] = msg;

    const row = document.createElement('tr');
    row.className = 'live-row-enter clickable-row';
    row.dataset.group = msg.group_label;
    row.addEventListener('click', () => showGroupDetail(msg.group_label));
    row.innerHTML = `
        <td>${groupShort}</td>
        <td>${msg.model}</td>
        <td><span class="${statusCls}">${statusText}</span></td>
        <td>${actions.view || 0}</td>
        <td>${actions.share || 0}</td>
        <td>${actions.rate || 0}</td>
        <td>${actions.comment || 0}</td>
        <td>${opinions['会去吃'] || 0}</td>
        <td>${opinions['会推荐'] || 0}</td>
        <td>${rating}</td>
    `;
    tbody.appendChild(row);

    const countEl = document.getElementById(`cat-count-${category}`);
    if (countEl) {
        const done = tbody.rows.length;
        countEl.textContent = `${done}组已完成`;
    }
}

function showGroupDetail(groupLabel) {
    const data = _groupDetailCache[groupLabel];
    if (!data || !data.agent_results) { showToast('无该组详情数据', 'warning'); return; }
    const agents = data.agent_results;
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');
    modal.style.display = 'flex';
    document.querySelector('.modal-header h2').textContent = `组详情 - ${groupLabel} (${data.model})`;
    list.innerHTML = agents.map(a => {
        if (!a || typeof a !== 'object') return '';
        const acts = a.actions || {};
        const p = a.persona || {};
        const cuisines = (p.cuisine_pref || []).join('、');
        const personaHtml = p.gender ? `
            <div class="agent-persona">
                <span>${p.gender}/${p.age || '?'}岁</span>
                <span>${p.occupation || '-'}</span>
                <span>${p.personality || '-'}</span>
                <span>收入:${p.income || '-'}</span>
                <span>消费力:${p.spending_power || '-'}</span>
                <span>价格敏感:${p.price_sensitivity || '-'}</span>
                <span>探店:${p.exploration || '-'}</span>
                <span>用餐:${p.dining_freq || '-'}</span>
                <span>菜系:${cuisines || '-'}</span>
                <span>历史均分:${p.avg_rating || '-'}</span>
                <span>社交:${p.social_influence || '-'}</span>
                <span>满意阈值:${p.satisfaction_threshold || '-'}</span>
            </div>` : '';
        return `
        <div class="history-item" style="cursor:default">
            <div class="history-item-header">
                <span class="history-name">${a.nickname || a.agent_id || '?'}</span>
                <span class="history-time">${a.opinion || '-'}</span>
            </div>
            ${personaHtml}
            <div class="agent-divider"></div>
            <div class="history-item-meta">
                <span>查看:${acts.view||0}</span>
                <span>分享:${acts.share||0}</span>
                <span>评分:${a.rating != null ? a.rating : '-'}</span>
                <span>就餐频率:${a.dining_out_frequency||"-"}次/月</span>
                <span>可接受:${a.acceptable_spend||"-"}元</span>
                <span>到访:${a.visit_frequency||"-"}</span>
                <span>价格:${a.price_acceptance||"-"}</span>
            </div>
            ${a.comment_text ? `<div style="margin-top:6px;font-size:12px;color:var(--text-secondary);line-height:1.6">“${a.comment_text}”</div>` : ''}
        </div>`;
    }).join('');
}

function renderCategoryStats() {
    for (const cat of CATEGORY_ORDER) {
        const box = document.getElementById(`cat-box-${cat}`);
        if (!box) continue;
        // 收集该大类所有agent结果
        const allAgents = [];
        for (const [label, data] of Object.entries(_groupDetailCache)) {
            if (_getCategoryFromLabel(label) === cat && data.agent_results) {
                allAgents.push(...data.agent_results);
            }
        }
        if (!allAgents.length) continue;
        const total = allAgents.length;

        // 统计维度
        const opinions = {}; const priceAcc = {}; const visitFreq = {};
        let ratingSum = 0, ratingCount = 0, viewSum = 0, shareSum = 0;
        const comments = [];
        for (const a of allAgents) {
            if (!a || typeof a !== 'object') continue;
            opinions[a.opinion] = (opinions[a.opinion] || 0) + 1;
            priceAcc[a.price_acceptance] = (priceAcc[a.price_acceptance] || 0) + 1;
            visitFreq[a.visit_frequency] = (visitFreq[a.visit_frequency] || 0) + 1;
            if (a.rating) { ratingSum += parseInt(a.rating); ratingCount++; }
            const acts = a.actions || {};
            viewSum += parseInt(acts.view || 0);
            shareSum += parseInt(acts.share || 0);
            if (a.comment_text) comments.push(a.comment_text);
        }
        const interested = (opinions['会去吃']||0) + (opinions['会推荐']||0);
        const intPct = (interested / total * 100).toFixed(1);
        const avgRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : '-';
        const expensivePct = ((priceAcc['太贵了']||0) / total * 100).toFixed(1);
        const noVisitPct = ((visitFreq['不会去']||0) / total * 100).toFixed(1);

        // 渲染统计摘要
        let existing = box.querySelector('.cat-stats');
        if (existing) existing.remove();
        const statsDiv = document.createElement('div');
        statsDiv.className = 'cat-stats';
        statsDiv.innerHTML = `
            <div class="cat-stats-row">
                <span>兴趣度 <b>${intPct}%</b></span>
                <span>均分 <b>${avgRating}</b></span>
                <span>嫌贵 <b>${expensivePct}%</b></span>
                <span>不会去 <b>${noVisitPct}%</b></span>
                <span>关注率 <b>${(viewSum/total*100).toFixed(0)}%</b></span>
                <span>分享率 <b>${(shareSum/total*100).toFixed(0)}%</b></span>
            </div>
            ${comments.length ? `<div class="cat-stats-comments">${comments.length}条评论</div>` : ''}
        `;
        box.appendChild(statsDiv);
    }
}

function updateProgress(msg) {
    const pct = msg.percent || 0;
    document.getElementById('progress-bar').style.width = `${pct}%`;
    if (msg.message) document.getElementById('progress-text').textContent = msg.message;

    if (msg.groups) {
        const container = document.getElementById('progress-groups');
        container.innerHTML = msg.groups.map(g => {
            const cls = g.status === 'done' ? 'done' : g.status === 'active' ? 'active' : '';
            return `<div class="progress-group-item ${cls}">${g.label}</div>`;
        }).join('');
    }
}

// ── 渲染结果 ──
function renderResult(result) {
    _lastSimulationId = result.simulation_id || null;
    document.getElementById('result-duration').textContent = `耗时 ${result.duration_seconds.toFixed(1)}s`;
    document.getElementById('result-agents').textContent = `${result.total_agents} Agents`;

    renderStatCards(result);
    renderChartOpinion(result.opinion_distribution);
    renderChartActions(result.action_stats);
    renderChartFrequency(result.dining_frequency);
    renderChartBudget(result.budget_distribution);
    renderChartVisit(result.visit_willingness);
    renderChartPriceAccept(result.price_acceptance);
    renderWordCloud(result.all_comments || []);
    document.getElementById('ai-advice').textContent = result.ai_advice || '';
}

function renderStatCards(r) {
    const cards = [
        { value: r.action_stats.view, label: '查看人数' },
        { value: r.action_stats.share, label: '分享人数' },
        { value: r.action_stats.rate, label: '评分人数' },
        { value: r.action_stats.comment, label: '评论人数' },
    ];
    document.getElementById('stat-cards').innerHTML = cards.map(c =>
        `<div class="stat-card"><div class="stat-value">${c.value}</div><div class="stat-label">${c.label}</div></div>`
    ).join('');
}

function makePie(elId, data) {
    const chart = echarts.init(document.getElementById(elId));
    chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        color: ['#7c3aed', '#00f2fe', '#52c41a', '#faad14', '#ff4d4f', '#f472b6'],
        series: [{
            type: 'pie', radius: ['40%', '70%'],
            label: { color: '#8b9cc7', fontSize: 11 },
            data: data,
        }],
    });
    window.addEventListener('resize', () => chart.resize());
}

function makeBar(elId, categories, values, color) {
    const chart = echarts.init(document.getElementById(elId));
    chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 50, right: 16, top: 16, bottom: 30 },
        xAxis: { type: 'category', data: categories, axisLabel: { color: '#8b9cc7', fontSize: 11 }, axisLine: { lineStyle: { color: '#1a3a6a' } } },
        yAxis: { type: 'value', axisLabel: { color: '#8b9cc7', fontSize: 11 }, splitLine: { lineStyle: { color: '#1a3a6a' } } },
        series: [{ type: 'bar', data: values, barWidth: '50%', itemStyle: { color: color || '#7c3aed', borderRadius: [4, 4, 0, 0] } }],
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderChartOpinion(data) {
    if (!data) return;
    makePie('chart-opinion', [
        { name: '不感兴趣', value: data.not_interested },
        { name: '略有兴趣', value: data.slight_interest },
        { name: '会去吃', value: data.will_visit },
        { name: '会推荐', value: data.will_recommend },
    ]);
}

function renderChartActions(data) {
    if (!data) return;
    makeBar('chart-actions', ['查看', '分享', '评分', '评论'],
        [data.view, data.share, data.rate, data.comment], '#00d4ff');
}

function renderChartFrequency(data) {
    if (!data) return;
    const keys = Object.keys(data);
    makeBar('chart-frequency', keys, keys.map(k => data[k]), '#7c3aed');
}

function renderChartBudget(data) {
    if (!data) return;
    const keys = Object.keys(data);
    makeBar('chart-budget', keys, keys.map(k => data[k]), '#52c41a');
}

function renderChartVisit(data) {
    if (!data) return;
    const keys = Object.keys(data);
    makePie('chart-visit', keys.map(k => ({ name: k, value: data[k] })));
}

function renderChartPriceAccept(data) {
    if (!data) return;
    const keys = Object.keys(data);
    makePie('chart-price-accept', keys.map(k => ({ name: k, value: data[k] })));
}

function renderWordCloud(comments) {
    const section = document.getElementById('wordcloud-section');
    if (!comments || !comments.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const freq = {};
    const stopwords = new Set(['的','了','是','在','我','有','和','就','不','人','都','一','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','他','她','们','那','被','从','把','比','但','还','可以','这个','什么','而','吃','来','做','让','等','能','对','里','多','又','没','以','只','过','家','得','个','更','吧','啊','呢','太','真']);
    for (const c of comments) {
        const words = c.replace(/[，。！？、；：""''（）\s]/g, ' ').split(' ');
        for (const w of words) {
            if (w.length >= 2 && !stopwords.has(w)) freq[w] = (freq[w] || 0) + 1;
        }
    }
    const data = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 80)
        .map(([name, value]) => ({ name, value }));
    if (!data.length) { section.style.display = 'none'; return; }
    const chart = echarts.init(document.getElementById('chart-wordcloud'));
    chart.setOption({
        series: [{
            type: 'wordCloud',
            shape: 'circle',
            gridSize: 8,
            sizeRange: [14, 48],
            rotationRange: [-30, 30],
            textStyle: { fontFamily: 'sans-serif', color: () => {
                const palette = ['#7c3aed','#00f2fe','#52c41a','#faad14','#00d4ff','#f472b6','#ff4d4f'];
                return palette[Math.floor(Math.random() * palette.length)];
            }},
            data: data,
        }],
    });
    window.addEventListener('resize', () => chart.resize());
}

// ── 下载报告 ──
let _lastSimulationId = null;

async function downloadReport() {
    if (!_lastSimulationId) {
        showToast('暂无仿真结果，请先运行仿真', 'warning');
        return;
    }
    try {
        const resp = await fetch(`${TWIN_API}/download/${_lastSimulationId}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const cd = resp.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename\*=UTF-8''(.+)/);
        a.download = match ? decodeURIComponent(match[1]) : '数字孪生仿真报告.pdf';
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
        showToast('报告下载成功', 'success');
    } catch (e) {
        showToast(`下载失败: ${e.message}`, 'error');
    }
}

// ── 历史记录 ──
async function openHistory() {
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');
    modal.style.display = 'flex';
    list.innerHTML = '<div class="history-loading">加载中...</div>';

    try {
        const resp = await fetch(`${TWIN_API}/history?page=1&page_size=30`);
        const data = await resp.json();
        if (data.status !== 'success' || !data.items.length) {
            list.innerHTML = '<div class="history-empty">暂无历史记录</div>';
            return;
        }
        list.innerHTML = data.items.map(item => `
            <div class="history-item">
                <div class="history-item-header" onclick="loadHistoryDetail('${item.simulation_id}')">
                    <span class="history-name">${item.restaurant_name || '未命名'}</span>
                    <span class="history-time">${item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : ''}</span>
                </div>
                <div class="history-item-meta" onclick="loadHistoryDetail('${item.simulation_id}')">
                    <span>${item.city || ''} ${item.district || ''}</span>
                    <span>${item.cuisine_type || ''}</span>
                    <span>客单价 ${item.avg_price || '-'}元</span>
                    <span>均分 ${item.avg_score ? item.avg_score.toFixed(1) : '-'}</span>
                    <span>兴趣度 ${item.interested_pct}%</span>
                    <span>耗时 ${item.duration_seconds ? item.duration_seconds.toFixed(1) + 's' : '-'}</span>
                </div>
                <button class="btn-delete-history" onclick="event.stopPropagation();deleteHistory('${item.simulation_id}',this)">&times; 删除</button>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="history-empty">加载失败: ${e.message}</div>`;
    }
}

async function deleteHistory(simulationId, btnEl) {
    if (!confirm('确定删除该仿真记录？此操作不可撤销。')) return;
    try {
        const resp = await fetch(`${TWIN_API}/history/${simulationId}`, { method: 'DELETE' });
        const data = await resp.json();
        if (data.status === 'success') {
            btnEl.closest('.history-item').remove();
            showToast('已删除', 'success');
        } else {
            showToast(data.detail || '删除失败', 'error');
        }
    } catch (e) {
        showToast(`删除失败: ${e.message}`, 'error');
    }
}

async function loadHistoryDetail(simulationId) {
    document.getElementById('history-modal').style.display = 'none';
    try {
        const [detailResp, groupsResp] = await Promise.all([
            fetch(`${TWIN_API}/history/${simulationId}`),
            fetch(`${TWIN_API}/history/${simulationId}/groups`),
        ]);
        const detail = await detailResp.json();
        const groupsData = await groupsResp.json();

        // 渲染分组实时过程
        document.getElementById('result-placeholder').style.display = 'none';
        document.getElementById('category-boxes').innerHTML = '';
        Object.keys(_groupDetailCache).forEach(k => delete _groupDetailCache[k]);
        const progressEl = document.getElementById('simulation-progress');
        progressEl.style.display = 'block';
        // 历史模式：隐藏进度条/计时器，显示标题
        document.querySelector('.progress-header').style.display = 'none';
        document.querySelector('.progress-bar-wrapper').style.display = 'none';
        document.getElementById('progress-text').style.display = 'none';
        document.getElementById('progress-groups').style.display = 'none';
        document.getElementById('pause-simulation').style.display = 'none';
        // 插入历史标题
        let histTitle = document.getElementById('history-title');
        if (!histTitle) {
            histTitle = document.createElement('h2');
            histTitle.id = 'history-title';
            histTitle.className = 'history-detail-title';
            progressEl.insertBefore(histTitle, document.getElementById('live-feedback'));
        }
        histTitle.style.display = 'block';
        const restName = (detail.status === 'success' && detail.data?.restaurant?.name) || '';
        histTitle.textContent = restName ? `历史仿真记录 - ${restName}` : '历史仿真记录';

        if (groupsData.status === 'success' && groupsData.groups) {
            for (const g of groupsData.groups) {
                const msg = {
                    group_label: g.group_label,
                    model: g.model_name,
                    status: g.status,
                    agent_results: g.agent_results,
                    opinions: {},
                    actions: { view: 0, share: 0, rate: 0, comment: 0 },
                    avg_rating: null,
                };
                const ratings = [];
                for (const ar of (g.agent_results || [])) {
                    if (!ar || typeof ar !== 'object') continue;
                    msg.opinions[ar.opinion] = (msg.opinions[ar.opinion] || 0) + 1;
                    const acts = ar.actions || {};
                    for (const k of ['view','share','rate','comment']) msg.actions[k] += parseInt(acts[k] || 0);
                    if (ar.rating) ratings.push(parseInt(ar.rating));
                }
                if (ratings.length) msg.avg_rating = ratings.reduce((a,b)=>a+b,0) / ratings.length;
                appendLiveFeedback(msg);
            }
            renderCategoryStats();
        }

        // 渲染汇总结果
        if (detail.status === 'success' && detail.data) {
            document.getElementById('simulation-result').style.display = 'block';
            renderResult(detail.data);
        }
        showToast('已加载历史仿真结果', 'success');
    } catch (e) {
        showToast(`加载详情失败: ${e.message}`, 'error');
    }
}
