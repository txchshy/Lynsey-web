/**
 * 餐饮视频生成前端模块
 * 与后端API交互，提供视频生成界面
 */

class VideoGenerator {
    constructor() {
        this.apiBase = '/api/marketing/video';
        this.currentTask = null;
        this.templates = [];
        this.history = [];
        
        this.init();
    }

    async init() {
        await this.loadTemplates();
        await this.loadHistory();
        this.bindEvents();
        this.setupUI();
    }

    async loadTemplates() {
        try {
            const response = await fetch(`${this.apiBase}/templates`);
            const data = await response.json();
            
            if (data.success) {
                this.templates = data.templates;
                this.populateTemplateSelector();
            }
        } catch (error) {
            console.error('加载模板失败:', error);
            this.showError('加载视频模板失败');
        }
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.apiBase}/history`);
            const data = await response.json();
            
            if (data.success) {
                this.history = data.history;
                this.updateHistoryDisplay();
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
        }
    }

    populateTemplateSelector() {
        const selector = document.getElementById('video-template');
        if (!selector) return;

        selector.innerHTML = '<option value="">选择视频模板</option>';
        
        Object.entries(this.templates).forEach(([key, template]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${template.name} - ${template.description}`;
            selector.appendChild(option);
        });
    }

    bindEvents() {
        // 生成视频按钮
        const generateBtn = document.getElementById('generate-video-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateVideo());
        }

        // 生成菜单视频按钮
        const generateMenuBtn = document.getElementById('generate-menu-video-btn');
        if (generateMenuBtn) {
            generateMenuBtn.addEventListener('click', () => this.generateMenuVideo());
        }

        // 模板选择变化
        const templateSelector = document.getElementById('video-template');
        if (templateSelector) {
            templateSelector.addEventListener('change', (e) => {
                this.updateTemplatePreview(e.target.value);
            });
        }

        // 文件上传
        const fileInput = document.getElementById('restaurant-image-upload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }

        // 表单验证
        const form = document.getElementById('video-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.generateVideo();
            });
        }
    }

    setupUI() {
        // 设置默认值
        const durationInput = document.getElementById('video-duration');
        if (durationInput) {
            durationInput.value = 30;
        }

        const aspectRatioSelect = document.getElementById('aspect-ratio');
        if (aspectRatioSelect) {
            aspectRatioSelect.value = '9:16';
        }

        // 初始化进度条
        this.updateProgress(0, '准备就绪');
    }

    async generateVideo() {
        if (!this.validateForm()) return;

        const formData = this.getFormData();
        this.showLoading(true);
        this.updateProgress(10, '正在生成视频脚本...');

        try {
            const response = await fetch(`${this.apiBase}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            this.updateProgress(50, '正在生成视频...');

            const result = await response.json();

            if (result.success) {
                this.updateProgress(100, '视频生成完成！');
                this.showSuccess(result);
                await this.loadHistory(); // 刷新历史记录
            } else {
                throw new Error(result.error || '生成失败');
            }
        } catch (error) {
            console.error('视频生成失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async generateMenuVideo() {
        if (!this.validateMenuForm()) return;

        const formData = this.getMenuFormData();
        this.showLoading(true);
        this.updateProgress(10, '正在分析菜单...');

        try {
            const response = await fetch(`${this.apiBase}/generate-menu`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            this.updateProgress(50, '正在生成菜单视频...');

            const result = await response.json();

            if (result.success) {
                this.updateProgress(100, '菜单视频生成完成！');
                this.showSuccess(result);
                await this.loadHistory();
            } else {
                throw new Error(result.error || '生成失败');
            }
        } catch (error) {
            console.error('菜单视频生成失败:', error);
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    validateForm() {
        const restaurantName = document.getElementById('restaurant-name').value.trim();
        const location = document.getElementById('restaurant-location').value.trim();
        const cuisine = document.getElementById('restaurant-cuisine').value.trim();

        if (!restaurantName) {
            this.showError('请输入餐厅名称');
            return false;
        }

        if (!location) {
            this.showError('请输入餐厅位置');
            return false;
        }

        if (!cuisine) {
            this.showError('请选择菜系类型');
            return false;
        }

        return true;
    }

    validateMenuForm() {
        const restaurantName = document.getElementById('menu-restaurant-name').value.trim();
        const menuItems = this.getMenuItems();

        if (!restaurantName) {
            this.showError('请输入餐厅名称');
            return false;
        }

        if (menuItems.length === 0) {
            this.showError('请至少添加一道菜品');
            return false;
        }

        return true;
    }

    getFormData() {
        return {
            restaurant_info: {
                name: document.getElementById('restaurant-name').value.trim(),
                location: document.getElementById('restaurant-location').value.trim(),
                cuisine: document.getElementById('restaurant-cuisine').value.trim(),
                atmosphere: document.getElementById('restaurant-atmosphere').value.trim(),
                price_range: document.getElementById('price-range').value.trim(),
                specialties: document.getElementById('specialties').value.trim(),
                signature_dishes: this.getSignatureDishes()
            },
            template: document.getElementById('video-template').value || 'modern',
            duration: parseInt(document.getElementById('video-duration').value) || 30,
            include_menu: document.getElementById('include-menu').checked,
            custom_script: document.getElementById('custom-script').value.trim(),
            aspect_ratio: document.getElementById('aspect-ratio').value
        };
    }

    getMenuFormData() {
        return {
            restaurant_info: {
                name: document.getElementById('menu-restaurant-name').value.trim(),
                location: document.getElementById('menu-restaurant-location').value.trim(),
                cuisine: document.getElementById('menu-restaurant-cuisine').value.trim(),
                atmosphere: document.getElementById('menu-restaurant-atmosphere').value.trim(),
                price_range: document.getElementById('menu-price-range').value.trim(),
                specialties: document.getElementById('menu-specialties').value.trim()
            },
            menu_items: this.getMenuItems(),
            template: document.getElementById('menu-video-template').value || 'modern',
            duration: parseInt(document.getElementById('menu-video-duration').value) || 45
        };
    }

    getSignatureDishes() {
        const input = document.getElementById('signature-dishes').value.trim();
        return input ? input.split(/[,，、]/).map(item => item.trim()).filter(item => item) : [];
    }

    getMenuItems() {
        const items = [];
        const container = document.getElementById('menu-items-container');
        if (!container) return items;

        const itemElements = container.querySelectorAll('.menu-item');
        itemElements.forEach(element => {
            const name = element.querySelector('.item-name')?.value.trim();
            const description = element.querySelector('.item-description')?.value.trim();
            const price = parseFloat(element.querySelector('.item-price')?.value) || 0;
            const category = element.querySelector('.item-category')?.value.trim();

            if (name && description) {
                items.push({ name, description, price, category });
            }
        });

        return items;
    }

    updateTemplatePreview(templateKey) {
        const template = this.templates[templateKey];
        if (!template) return;

        const preview = document.getElementById('template-preview');
        if (preview) {
            preview.innerHTML = `
                <h4>${template.name}</h4>
                <p>${template.description}</p>
                <div class="style-tags">
                    ${template.style_tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;
        }
    }

    updateProgress(percent, message) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (progressText) {
            progressText.textContent = message;
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const generateBtn = document.getElementById('generate-video-btn');

        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }

        if (generateBtn) {
            generateBtn.disabled = show;
            generateBtn.textContent = show ? '生成中...' : '生成视频';
        }
    }

    showSuccess(result) {
        // 显示成功消息
        this.showNotification('视频生成成功！', 'success');

        // 显示视频预览
        this.displayVideo(result);

        // 重置表单
        this.resetForm();
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        // 添加到页面
        document.body.appendChild(notification);

        // 自动移除
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    displayVideo(result) {
        const container = document.getElementById('video-result');
        if (!container) return;

        container.innerHTML = `
            <div class="video-result-card">
                <h3>视频生成成功</h3>
                <div class="video-preview">
                    <video controls width="300" height="533">
                        <source src="${result.video_url}" type="video/mp4">
                        您的浏览器不支持视频播放。
                    </video>
                </div>
                <div class="video-info">
                    <p><strong>视频路径:</strong> ${result.video_path}</p>
                    <p><strong>生成时间:</strong> ${new Date().toLocaleString()}</p>
                    <div class="video-actions">
                        <button onclick="window.open('${result.video_url}', '_blank')" class="btn btn-primary">
                            在新窗口打开
                        </button>
                        <button onclick="videoGenerator.downloadVideo('${result.video_url}')" class="btn btn-secondary">
                            下载视频
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.style.display = 'block';
    }

    downloadVideo(url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `restaurant-video-${Date.now()}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    updateHistoryDisplay() {
        const container = document.getElementById('video-history');
        if (!container) return;

        if (this.history.length === 0) {
            container.innerHTML = '<p class="no-history">暂无视频生成历史</p>';
            return;
        }

        const historyHTML = this.history.map(video => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${video.restaurant_name}</h4>
                    <p class="history-meta">
                        模板: ${video.template} | 
                        时长: ${video.duration}秒 | 
                        时间: ${new Date(video.generated_at).toLocaleString()}
                    </p>
                </div>
                <div class="history-actions">
                    <button onclick="videoGenerator.playVideo('${video.video_path}')" class="btn btn-sm btn-primary">
                        播放
                    </button>
                    <button onclick="videoGenerator.deleteVideo('${Path(video.video_path).name}')" class="btn btn-sm btn-danger">
                        删除
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = historyHTML;
    }

    playVideo(videoPath) {
        const url = `/api/files/videos/${Path(videoPath).name}`;
        window.open(url, '_blank');
    }

    async deleteVideo(videoName) {
        if (!confirm('确定要删除这个视频吗？')) return;

        try {
            const response = await fetch(`${this.apiBase}/videos/${videoName}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('视频删除成功', 'success');
                await this.loadHistory();
            } else {
                throw new Error(result.error || '删除失败');
            }
        } catch (error) {
            this.showError(`删除失败: ${error.message}`);
        }
    }

    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        
        const restaurantName = document.getElementById('restaurant-name')?.value.trim() || 'restaurant';
        formData.append('restaurant_name', restaurantName);

        try {
            const response = await fetch(`${this.apiBase}/upload-image`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('图片上传成功', 'success');
                // 可以在这里显示上传的图片预览
                this.displayUploadedImages(result.file_url);
            } else {
                throw new Error(result.error || '上传失败');
            }
        } catch (error) {
            this.showError(`图片上传失败: ${error.message}`);
        }
    }

    displayUploadedImages(imageUrl) {
        const container = document.getElementById('uploaded-images');
        if (!container) return;

        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'uploaded-image';
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.margin = '5px';
        img.style.borderRadius = '8px';
        img.style.cursor = 'pointer';

        img.onclick = () => window.open(imageUrl, '_blank');

        container.appendChild(img);
    }

    addMenuItem() {
        const container = document.getElementById('menu-items-container');
        if (!container) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'menu-item';
        itemDiv.innerHTML = `
            <div class="menu-item-form">
                <input type="text" class="item-name" placeholder="菜品名称" required>
                <textarea class="item-description" placeholder="菜品描述" rows="2" required></textarea>
                <input type="number" class="item-price" placeholder="价格" step="0.01" min="0" required>
                <select class="item-category">
                    <option value="冷菜">冷菜</option>
                    <option value="热菜">热菜</option>
                    <option value="主食">主食</option>
                    <option value="汤品">汤品</option>
                    <option value="饮品">饮品</option>
                    <option value="甜点">甜点</option>
                </select>
                <button type="button" onclick="this.closest('.menu-item').remove()" class="btn btn-danger btn-sm">
                    删除
                </button>
            </div>
        `;

        container.appendChild(itemDiv);
    }

    resetForm() {
        const form = document.getElementById('video-form');
        if (form) {
            form.reset();
        }
        
        // 重置进度条
        this.updateProgress(0, '准备就绪');
        
        // 清空视频结果
        const resultContainer = document.getElementById('video-result');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
    }
}

// 全局实例
let videoGenerator;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    videoGenerator = new VideoGenerator();
    
    // 添加全局函数供HTML调用
    window.videoGenerator = videoGenerator;
    window.addMenuItem = () => videoGenerator.addMenuItem();
});

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoGenerator;
}
