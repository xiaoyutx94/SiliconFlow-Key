document.addEventListener('DOMContentLoaded', function() {
    // --- DOM 元素获取 ---
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    const viewToggle = document.getElementById('viewToggle');
    const viewModeText = document.getElementById('viewModeText');
    const maskToggle = document.getElementById('maskToggle');
    const apiKeysInput = document.getElementById('apiKeysInput');
    const checkButtonCn = document.getElementById('checkButtonCn');
    const checkButtonCom = document.getElementById('checkButtonCom');
    const copyAllNormalKeysBtn = document.getElementById('copyAllNormalKeysBtn');
    const loader = document.getElementById('loader');
    const resultsSection = document.getElementById('resultsSection');
    
    // --- 状态变量 ---
    let resultsData = [];
    
    // --- 初始化 ---
    (function init() {
        // 初始化主题
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeUI(savedTheme);

        // 初始化视图
        const savedView = localStorage.getItem('viewMode') || 'card';
        viewToggle.checked = savedView === 'table';
        updateViewUI(savedView);

        // 初始化Key隐藏选项
        const savedMask = localStorage.getItem('maskMode');
        maskToggle.checked = savedMask !== 'false'; // 默认开启

        // 绑定事件监听器
        themeToggle.addEventListener('click', handleThemeToggle);
        viewToggle.addEventListener('change', handleViewToggle);
        maskToggle.addEventListener('change', () => renderResults(resultsData));
        checkButtonCn.addEventListener('click', () => handleCheckBalance('cn'));
        checkButtonCom.addEventListener('click', () => handleCheckBalance('com'));
        copyAllNormalKeysBtn.addEventListener('click', handleCopyAllNormalKeys);
        resultsSection.addEventListener('click', handleCopyKey);
    })();

    // --- 事件处理函数 ---
    function handleThemeToggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeUI(newTheme);
    }

    function handleViewToggle() {
        const newView = viewToggle.checked ? 'table' : 'card';
        localStorage.setItem('viewMode', newView);
        updateViewUI(newView);
        renderResults(resultsData);
    }

    async function handleCheckBalance(apiType = 'cn') {
        const keys = apiKeysInput.value.split('\n').map(k => k.trim()).filter(Boolean);
        if (keys.length === 0) {
            alert('请输入至少一个 API Key。');
            return;
        }

        loader.style.display = 'block';
        checkButtonCn.disabled = true;
        checkButtonCom.disabled = true;
        resultsSection.innerHTML = '';
        
        const API_URL = apiType === 'com' 
            ? 'https://api.siliconflow.com/v1/user/info'
            : 'https://api.siliconflow.cn/v1/user/info';

        const results = await Promise.all(keys.map(key => checkApiKey(key, API_URL)));
        
        resultsData = results;
        renderResults(resultsData);
        
        // 显示/隐藏复制全部按钮
        const normalKeys = results.filter(r => !r.isError && r.status === 'normal');
        copyAllNormalKeysBtn.style.display = normalKeys.length > 0 ? 'inline-block' : 'none';

        loader.style.display = 'none';
        checkButtonCn.disabled = false;
        checkButtonCom.disabled = false;
    }

    function handleCopyAllNormalKeys() {
        const normalKeys = resultsData
            .filter(result => !result.isError && result.status === 'normal')
            .map(result => result.key);
        
        if (normalKeys.length === 0) {
            alert('没有找到正常状态的API Key');
            return;
        }
        
        const keysText = normalKeys.join('\n');
        navigator.clipboard.writeText(keysText).then(() => {
            // 显示复制成功提示
            const originalText = copyAllNormalKeysBtn.textContent;
            copyAllNormalKeysBtn.textContent = `✅ 已复制 ${normalKeys.length} 个Key`;
            copyAllNormalKeysBtn.disabled = true;
            
            setTimeout(() => {
                copyAllNormalKeysBtn.textContent = originalText;
                copyAllNormalKeysBtn.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error('复制失败: ', err);
            alert('复制失败，请重试');
        });
    }

    function handleCopyKey(e) {
        const keyElem = e.target.closest('.masked-key');
        if (!keyElem) return;

        const fullKey = keyElem.dataset.fullKey;
        if (!fullKey) return;

        navigator.clipboard.writeText(fullKey).then(() => {
            showCopyTooltip(keyElem);
        }).catch(err => {
            console.error('复制失败: ', err);
        });
    }

    // --- API 调用 ---
    async function checkApiKey(apiKey, apiUrl) {
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP 错误: ${response.status}` }));
                throw new Error(errorData.message || '查询失败');
            }
            
            const data = await response.json();
            return { key: apiKey, data: data.data, isError: false, status: determineStatus(data.data) };
        } catch (error) {
            return { key: apiKey, message: error.message, isError: true, status: 'error' };
        }
    }

    // --- UI 更新函数 ---
    function updateThemeUI(theme) {
        if (theme === 'dark') {
            themeIcon.textContent = '☀️';
            themeText.textContent = '浅色模式';
        } else {
            themeIcon.textContent = '🌙';
            themeText.textContent = '深色模式';
        }
    }

    function updateViewUI(view) {
        resultsSection.className = `results-section ${view}-view`;
        viewModeText.textContent = view === 'table' ? '表格' : '卡片';
    }

    function renderResults(results) {
        resultsSection.innerHTML = '';
        if (results.length === 0) return;

        if (viewToggle.checked) {
            renderTableView(results);
        } else {
            renderCardView(results);
        }
    }

    function renderCardView(results) {
        results.forEach(result => {
            const card = document.createElement('div');
            card.className = 'key-card';
            const { key, isError, data, message, status } = result;

            if (isError) {
                card.innerHTML = `
                    <div class="key-header">
                        <div class="masked-key" data-full-key="${key}">${maskApiKey(key)}</div>
                        <span class="key-status status-error">错误</span>
                    </div>
                    <div class="key-detail"><span>信息:</span> <span>${message}</span></div>`;
            } else {
                const totalBalanceClass = status === 'warning' ? 'low-balance' : 'balance-highlight';
                const chargeBalanceClass = (data.chargeBalance && parseFloat(data.chargeBalance) > 0) ? 'charge-balance-highlight' : '';

                card.innerHTML = `
                    <div class="key-header">
                        <div class="masked-key" data-full-key="${key}">${maskApiKey(key)}</div>
                        <span class="key-status status-${status}">${status === 'warning' ? '余额不足' : '正常'}</span>
                    </div>
                    <div class="key-detail"><span>用户:</span> <span>${data.name || 'N/A'}</span></div>
                    <div class="key-detail"><span>邮箱:</span> <span>${maskEmail(data.email)}</span></div>
                    <div class="key-detail"><span>赠送余额:</span> <span>${data.balance || '0.00'}</span></div>
                    <div class="key-detail"><span>充值余额:</span> <span class="${chargeBalanceClass}">${data.chargeBalance || '0.00'}</span></div>
                    <div class="key-detail"><span>总余额:</span> <span class="${totalBalanceClass}">${data.totalBalance || '0.00'}</span></div>`;
            }
            resultsSection.appendChild(card);
        });
    }

    function renderTableView(results) {
        const table = document.createElement('table');
        table.className = 'results-table';
        table.innerHTML = `<thead><tr><th>API Key</th><th>用户</th><th>邮箱</th><th>赠送余额</th><th>充值余额</th><th>总余额</th><th>状态</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        
        results.forEach(result => {
            const row = document.createElement('tr');
            const { key, isError, data, message, status } = result;

            if (isError) {
                row.innerHTML = `
                    <td><div class="masked-key" data-full-key="${key}">${maskApiKey(key)}</div></td>
                    <td colspan="5">${message}</td>
                    <td><span class="key-status status-error">错误</span></td>`;
            } else {
                const totalBalanceClass = status === 'warning' ? 'low-balance' : 'balance-highlight';
                const chargeBalanceClass = (data.chargeBalance && parseFloat(data.chargeBalance) > 0) ? 'charge-balance-highlight' : '';
                row.innerHTML = `
                    <td><div class="masked-key" data-full-key="${key}">${maskApiKey(key)}</div></td>
                    <td>${data.name || 'N/A'}</td>
                    <td>${maskEmail(data.email)}</td>
                    <td>${data.balance || '0.00'}</td>
                    <td class="${chargeBalanceClass}">${data.chargeBalance || '0.00'}</td>
                    <td class="${totalBalanceClass}">${data.totalBalance || '0.00'}</td>
                    <td><span class="key-status status-${status}">${status === 'warning' ? '余额不足' : '正常'}</span></td>`;
            }
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        resultsSection.appendChild(table);
    }

    // --- 辅助函数 ---
    function determineStatus(userData) {
        if (!userData || userData.status !== 'normal') return 'error';
        if (parseFloat(userData.totalBalance) < 5) return 'warning';
        return 'normal';
    }

    function maskApiKey(apiKey) {
        if (!maskToggle.checked || !apiKey) return apiKey;
        return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
    }
    
    function maskEmail(email) {
        if (!maskToggle.checked || !email) return email || 'N/A';
        const parts = email.split('@');
        if (parts.length !== 2) return email;
        return `${parts[0].substring(0, 3)}***@${parts[1]}`;
    }

    function showCopyTooltip(element) {
        const existingTooltip = document.querySelector('.copy-tooltip');
        if (existingTooltip) existingTooltip.remove();

        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = '已复制!';
        element.appendChild(tooltip);

        requestAnimationFrame(() => {
            tooltip.classList.add('visible');
        });

        setTimeout(() => {
            tooltip.classList.remove('visible');
            tooltip.addEventListener('transitionend', () => tooltip.remove());
        }, 1000);
    }
});
