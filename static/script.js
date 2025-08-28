document.addEventListener('DOMContentLoaded', function() {
    const loginSection = document.getElementById('login-section');
    const mainSection = document.getElementById('main-section');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const loginStatus = document.getElementById('login-status');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const tokenStatus = document.getElementById('token-status');
    const refreshTokenBtn = document.getElementById('refresh-token-btn');
    const deleteAllTokensBtn = document.getElementById('delete-all-tokens-btn');
    const refreshStatus = document.getElementById('refresh-status');
    const messageInput = document.getElementById('message');
    const modelSelect = document.getElementById('model');
    const sendBtn = document.getElementById('send-btn');
    const apiStatus = document.getElementById('api-status');
    const apiResponse = document.getElementById('api-response');
    const responseContent = document.getElementById('response-content');
    const statusContainer = document.getElementById('status-container');
    
    const oauthLoginBtn = document.getElementById('oauth-login-btn');
    const oauthStatus = document.getElementById('oauth-status');
    const oauthDetails = document.getElementById('oauth-details');
    const oauthInstructions = document.getElementById('oauth-instructions');
    const oauthCancelBtn = document.getElementById('oauth-cancel-btn');
    
    let userPassword = '';
    let oauthStateId = null;
    let oauthPollTimer = null;
    let oauthStartTime = null;
    let oauthCountdownTimer = null;
    let oauthExpiresAt = null;
    
    // 检查 localStorage 中是否有保存的密码
    const savedPassword = localStorage.getItem('API_PASSWORD');
    if (savedPassword) {
        // 自动登录验证
        autoLogin(savedPassword);
    }
    
    // 登录功能
    loginBtn.addEventListener('click', async function() {
        const password = passwordInput.value;
        
        if (!password) {
            showStatus(loginStatus, '请输入密码', 'error');
            return;
        }
        
        loginBtn.disabled = true;
        loginBtn.textContent = '登录中...';
        showStatus(loginStatus, '正在登录，请稍候...', 'info');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showStatus(loginStatus, '登录成功', 'success');
                userPassword = password;
                // 保存密码到 localStorage
                localStorage.setItem('API_PASSWORD', password);
                loginSection.classList.add('hidden');
                mainSection.classList.remove('hidden');
                checkTokenStatus();
                setTimeout(() => {
                    loginStatus.style.display = 'none';
                }, 3000);
            } else {
                showStatus(loginStatus, data.error || '登录失败', 'error');
                // 登录失败时清除保存的密码
                localStorage.removeItem('API_PASSWORD');
            }
        } catch (error) {
            showStatus(loginStatus, '网络错误: ' + error.message, 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
        }
    });
    
    // 文件上传功能
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', function() { fileInput.click(); });
        
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', function() {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            if (e.dataTransfer.files.length) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
    
    // OAuth 登录按钮事件
    if (oauthLoginBtn) {
        oauthLoginBtn.addEventListener('click', startOAuthLogin);
    }
    
    if (oauthCancelBtn) {
        oauthCancelBtn.addEventListener('click', cancelOAuthLogin);
    }
    
    const manualOpenBtn = document.getElementById('manual-open-btn');
    if (manualOpenBtn) {
        manualOpenBtn.disabled = true;
    }
    
    // 处理文件上传
    async function handleFileUpload(file) {
        if (!uploadStatus) return;
        
        if (file.name !== 'oauth_creds.json') {
            showStatus(uploadStatus, '请上传 oauth_creds.json 文件', 'error');
            resetFileInput();
            return;
        }
        
        try {
            const content = await file.text();
            const creds = JSON.parse(content);
            
            if (!creds.access_token || !creds.refresh_token) {
                showStatus(uploadStatus, '文件格式不正确，缺少access_token或refresh_token', 'error');
                resetFileInput();
                return;
            }
            
            const response = await fetch('/api/upload-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                },
                body: JSON.stringify(creds),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showStatus(uploadStatus, '凭证上传成功', 'success');
                checkTokenStatus();
            } else {
                showStatus(uploadStatus, data.error || '上传失败', 'error');
            }
        } catch (error) {
            showStatus(uploadStatus, '文件处理错误: ' + error.message, 'error');
        } finally {
            // 无论成功还是失败，都重置文件输入
            resetFileInput();
        }
    }
    
    // 重置文件输入元素
    function resetFileInput() {
        if (fileInput) {
            // 方法1: 清空值
            fileInput.value = '';
            
            // 强制触发重新渲染，确保状态完全重置
            fileInput.blur();
            fileInput.focus();
        }
    }
    
    // 重新绑定文件输入事件（解决某些浏览器中的问题）
    function rebindFileInputEvents() {
        if (fileInput) {
            // 移除旧的事件监听器（如果存在）
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            
            // 更新引用
            window.fileInput = newFileInput;
            
            // 重新绑定事件
            newFileInput.addEventListener('change', function(e) {
                if (e.target.files.length) {
                    handleFileUpload(e.target.files[0]);
                }
            });
        }
    }
    
    // 开始 OAuth 登录流程
    async function startOAuthLogin() {
        if (!oauthLoginBtn || !oauthStatus || !oauthDetails || !oauthInstructions) return;
        
        try {
            oauthLoginBtn.disabled = true;
            oauthLoginBtn.textContent = '正在初始化...';
            
            showStatus(oauthStatus, '正在初始化 OAuth 认证...', 'info');
            
            const response = await fetch('/api/oauth-init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                }
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                oauthStateId = data.stateId;
                oauthExpiresAt = data.expiresAt;
                oauthStartTime = Date.now();
                
                oauthLoginBtn.textContent = '⏳ 等待授权...';
                
                try {
                    window.open(data.verificationUriComplete, '_blank');
                } catch (e) {
                    // 自动打开授权页面失败
                }
                
                const expiresAt = new Date(oauthExpiresAt);
                const totalSeconds = Math.floor((oauthExpiresAt - oauthStartTime) / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                oauthInstructions.innerHTML = 
                    '<div style="text-align: center; margin-bottom: 20px;">' +
                        '<p style="margin-bottom: 15px; color: #666;">' + 
                            '如授权页面未自动打开，请点击下方按钮' +
                        '</p>' +
                        '<p style="margin-top: 15px; font-size: 12px; color: #999;">' +
                            '授权完成后将自动获取 Token' +
                        '</p>' +
                        '<p style="margin-top: 5px; font-size: 12px; color: #999;">' +
                            '⏰ 过期时间: ' + expiresAt.toLocaleString() + ' (' + minutes + '分钟)' +
                        '</p>' +
                    '</div>';
                
                oauthDetails.classList.remove('hidden');
                showStatus(oauthStatus, '⏳ 等待授权完成...', 'info');
                
                const manualOpenBtn = document.getElementById('manual-open-btn');
                if (manualOpenBtn) {
                    manualOpenBtn.disabled = false;
                    manualOpenBtn.replaceWith(manualOpenBtn.cloneNode(true));
                    const newManualOpenBtn = document.getElementById('manual-open-btn');
                    if (newManualOpenBtn) {
                        newManualOpenBtn.addEventListener('click', () => {
                            window.open(data.verificationUriComplete, '_blank');
                        });
                    }
                }
                
                startOAuthPolling();
                startOAuthCountdown();
                
            } else {
                showStatus(oauthStatus, data.error || 'OAuth 初始化失败', 'error');
                resetOAuthLogin();
            }
        } catch (error) {
            showStatus(oauthStatus, '网络错误: ' + error.message, 'error');
            resetOAuthLogin();
        }
    }
    
    // 开始轮询 OAuth 状态
    function startOAuthPolling() {
        if (!oauthStateId) return;
        
        pollOAuthStatus();
        oauthPollTimer = setInterval(pollOAuthStatus, 3000);
    }
    
    // 开始倒计时
    function startOAuthCountdown() {
        if (!oauthExpiresAt || !oauthStatus) return;
        
        updateCountdown();
        oauthCountdownTimer = setInterval(updateCountdown, 1000);
    }
    
    // 更新倒计时显示
    function updateCountdown() {
        if (!oauthExpiresAt || !oauthStatus) return;
        
        const now = Date.now();
        const remainingTime = Math.max(0, Math.floor((oauthExpiresAt - now) / 1000));
        const totalTime = Math.floor((oauthExpiresAt - oauthStartTime) / 1000);
        const timeRatio = remainingTime / totalTime;
        
        if (remainingTime > 0) {
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            const timeString = minutes + ':' + seconds.toString().padStart(2, '0');
            
            let statusMessage = '⏳ 等待授权完成... 剩余时间: ' + timeString;
            let statusType = 'info';
            
            if (timeRatio < 0.2) {
                statusMessage = '⚠️ 授权即将过期! 剩余时间: ' + timeString;
                statusType = 'error';
            } else if (timeRatio < 0.5) {
                statusMessage = '⏰ 请尽快完成授权! 剩余时间: ' + timeString;
                statusType = 'info';
            }
            
            showStatus(oauthStatus, statusMessage, statusType);
        } else {
            showStatus(oauthStatus, '⏰ 授权码已过期，请重新获取', 'error');
            stopOAuthCountdown();
        }
    }
    
    // 停止倒计时
    function stopOAuthCountdown() {
        if (oauthCountdownTimer) {
            clearInterval(oauthCountdownTimer);
            oauthCountdownTimer = null;
        }
    }
    
    // 轮询 OAuth 状态
    async function pollOAuthStatus() {
        if (!oauthStateId || !oauthStatus) return;
        
        try {
            const response = await fetch('/api/oauth-poll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                },
                body: JSON.stringify({ stateId: oauthStateId })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                if (data.success) {
                    showStatus(oauthStatus, '🎉 OAuth 认证成功！Token 已自动保存', 'success');
                    resetOAuthLogin();
                    // 延迟500ms再检查token状态，确保数据库已更新
                    setTimeout(checkTokenStatus, 500);
                } else if (data.status === 'pending') {
                    if (data.warning) {
                        showStatus(oauthStatus, '⚠️ ' + data.warning, 'info');
                    }
                    if (!oauthCountdownTimer && oauthExpiresAt) {
                        startOAuthCountdown();
                    }
                } else {
                    showStatus(oauthStatus, data.error || 'OAuth 认证失败', 'error');
                    resetOAuthLogin();
                }
            } else {
                showStatus(oauthStatus, data.error || '轮询失败', 'error');
                resetOAuthLogin();
            }
        } catch (error) {
            // OAuth 轮询错误
        }
    }
    
    // 重置 OAuth 登录状态
    function resetOAuthLogin() {
        if (oauthPollTimer) {
            clearInterval(oauthPollTimer);
            oauthPollTimer = null;
        }
        
        stopOAuthCountdown();
        
        oauthStateId = null;
        oauthExpiresAt = null;
        oauthStartTime = null;
        
        if (oauthLoginBtn) {
            oauthLoginBtn.disabled = false;
            oauthLoginBtn.textContent = '🔑 OAuth 登录获取 Token';
        }
        
        const manualOpenBtn = document.getElementById('manual-open-btn');
        if (manualOpenBtn) {
            manualOpenBtn.disabled = true;
        }
        
        if (oauthDetails) {
            oauthDetails.classList.add('hidden');
        }
    }
    
    // 取消 OAuth 登录
    async function cancelOAuthLogin() {
        if (!oauthStateId) {
            resetOAuthLogin();
            return;
        }
        
        try {
            await fetch('/api/oauth-cancel', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                },
                body: JSON.stringify({ stateId: oauthStateId })
            });
        } catch (error) {
            // 取消 OAuth 登录失败
        } finally {
            if (oauthStatus) {
                showStatus(oauthStatus, 'OAuth 授权已取消', 'info');
            }
            resetOAuthLogin();
        }
    }
    
    // 确认对话框函数
    function showConfirmDialog(message, onConfirm, onCancel, title = "确认删除") {
        const modal = document.createElement('div');
        modal.style.cssText = 
            'position: fixed;' +
            'top: 0;' +
            'left: 0;' +
            'width: 100%;' +
            'height: 100%;' +
            'background-color: rgba(0, 0, 0, 0.5);' +
            'display: flex;' +
            'justify-content: center;' +
            'align-items: center;' +
            'z-index: 1000;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 
            'background-color: white;' +
            'padding: 20px;' +
            'border-radius: 8px;' +
            'box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);' +
            'max-width: 400px;' +
            'width: 90%;';
        
        dialog.innerHTML = 
            '<h3 style="margin-top: 0; color: #e74c3c;">⚠️ ' + title + '</h3>' +
            '<p style="margin-bottom: 20px;">' + message + '</p>' +
            '<div style="display: flex; gap: 10px; justify-content: flex-end;">' +
            '<button id="confirm-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background-color: #f8f9fa; border-radius: 4px; cursor: pointer; color: #333; font-weight: 500;">取消</button>' +
            '<button id="confirm-ok" style="padding: 8px 16px; border: none; background-color: #e74c3c; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">确认删除</button>' +
            '</div>';
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        document.getElementById('confirm-ok').onclick = function() {
            document.body.removeChild(modal);
            if (onConfirm) onConfirm();
        };
        
        document.getElementById('confirm-cancel').onclick = function() {
            document.body.removeChild(modal);
            if (onCancel) onCancel();
        };
        
        modal.onclick = function(e) {
            if (e.target === modal) {
                document.body.removeChild(modal);
                if (onCancel) onCancel();
            }
        };
    }
    
    // 事件委托处理token按钮点击
    document.addEventListener('click', function(e) {
        const target = e.target;
        if (target.classList.contains('btn-refresh')) {
            const tokenId = decodeURIComponent(target.getAttribute('data-token-id') || '');
            if (tokenId) {
                e.preventDefault();
                refreshSingleToken(tokenId);
            }
        } else if (target.classList.contains('btn-delete')) {
            const tokenId = decodeURIComponent(target.getAttribute('data-token-id') || '');
            if (tokenId) {
                e.preventDefault();
                showConfirmDialog(
                    '确定要删除Token "' + tokenId + '" 吗?此操作不可撤销。',
                    function() {
                        deleteSingleToken(tokenId);
                    },
                    null,
                    "删除单个Token"
                );
            }
        }
    });
    
    // 检查token状态
    async function checkTokenStatus() {
        if (!tokenStatus || !refreshTokenBtn) return;
        
        try {
            const response = await fetch('/api/token-status', {
                headers: {
                    'Authorization': 'Bearer ' + userPassword
                }
            });
            const data = await response.json();
            
            if (response.ok && data.hasToken) {
                let tokenListHtml = '';
                if (data.tokens && data.tokens.length > 0) {
                    tokenListHtml = '<div class="token-list-wrapper"><div class="token-list">';
                    data.tokens.forEach(function(token) {
                        const expiresAt = token.expiresAt ? new Date(token.expiresAt).toLocaleString() : '未知';
                        const status = token.isExpired ? '已过期' : '有效';
                        const statusClass = token.isExpired ? 'status-expired' : 'status-valid';
                        const refreshInfo = token.wasRefreshed ? ' (已自动刷新)' : (token.refreshFailed ? ' (刷新失败)' : '');
                        tokenListHtml += '<div class="token-card" data-token-id="' + encodeURIComponent(token.id) + '">';
                        tokenListHtml += '<div class="token-header">';
                        tokenListHtml += '<div class="token-id">🔑 ' + token.id + '</div>';
                        tokenListHtml += '<div class="token-status ' + statusClass + '">' + status + '</div>';
                        tokenListHtml += '</div>';
                        tokenListHtml += '<div class="token-details">';
                        tokenListHtml += '<div><strong>过期时间:</strong> ' + expiresAt + '</div>';
                        tokenListHtml += '<div><strong>上传时间:</strong> ' + new Date(token.uploadedAt).toLocaleString() + '</div>';
                        if (refreshInfo) {
                            tokenListHtml += '<div><strong>状态:</strong> ' + refreshInfo + '</div>';
                        }
                        tokenListHtml += '</div>';
                        tokenListHtml += '<div class="token-actions">';
                        tokenListHtml += '<button class="btn-refresh" data-token-id="' + encodeURIComponent(token.id) + '">刷新</button>';
                        tokenListHtml += '<button class="btn-delete" data-token-id="' + encodeURIComponent(token.id) + '">删除</button>';
                        tokenListHtml += '</div>';
                        tokenListHtml += '</div>';
                    });
                    tokenListHtml += '</div></div>';
                }
                
                tokenStatus.innerHTML = '<div class="token-info"><strong>🔢 Token总数:</strong> ' + data.tokenCount + '<br><strong>📊 Token状态:</strong> 有效</div>' + tokenListHtml;
                tokenStatus.style.display = 'block';
                
                const tokenStatusButtons = document.querySelector('.token-status-buttons');
                if (tokenStatusButtons) {
                    tokenStatusButtons.style.display = 'flex';
                }
            } else {
                tokenStatus.innerHTML = '<div class="error">尚未上传凭证文件或Token已失效</div>';
                tokenStatus.style.display = 'block';
                
                const tokenStatusButtons = document.querySelector('.token-status-buttons');
                if (tokenStatusButtons) {
                    tokenStatusButtons.style.display = 'none';
                }
            }
        } catch (error) {
            addStatusMessage('获取Token状态失败: ' + error.message, 'error', 5000);
            tokenStatus.innerHTML = '<div class="error">获取Token状态失败: ' + error.message + '</div>';
            tokenStatus.style.display = 'block';
            
            const tokenStatusButtons = document.querySelector('.token-status-buttons');
            if (tokenStatusButtons) {
                tokenStatusButtons.style.display = 'none';
            }
        }
    }
    
    // 刷新token
    if (refreshTokenBtn && refreshStatus) {
        refreshTokenBtn.addEventListener('click', async function() {
            addStatusMessage('正在强制刷新所有Token...', 'info', 5000);
            try {
                const response = await fetch('/api/refresh-token', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + userPassword,
                    },
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    addStatusMessage('强制刷新完成！成功: ' + data.refreshResults.filter(r => r.success).length + '，失败: ' + data.refreshResults.filter(r => !r.success).length, 'success', 5000);
                    checkTokenStatus();
                } else {
                    addStatusMessage(data.error || '强制刷新失败', 'error', 5000);
                }
            } catch (error) {
                addStatusMessage('网络错误: ' + error.message, 'error', 5000);
            }
        });
    }
    
    // 删除所有Token
    if (deleteAllTokensBtn) {
        deleteAllTokensBtn.addEventListener('click', async function() {
            showConfirmDialog(
                '确定要删除所有Token吗?这将清除数据库中的所有Token数据，此操作不可撤销。',
                async function() {
                    addStatusMessage('正在删除所有Token...', 'info', 5000);
                    try {
                        const response = await fetch('/api/delete-all-tokens', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + userPassword,
                            },
                        });
                        
                        const data = await response.json();
                        
                        if (response.ok) {
                            addStatusMessage(data.message || '删除成功', 'success', 5000);
                            checkTokenStatus();
                        } else {
                            addStatusMessage(data.error || '删除失败', 'error', 5000);
                        }
                    } catch (error) {
                        addStatusMessage('网络错误: ' + error.message, 'error', 5000);
                    }
                },
                null,
                "删除所有Token"
            );
        });
    }
    
    // 发送API请求
    if (sendBtn && apiStatus && apiResponse && responseContent && messageInput && modelSelect) {
        sendBtn.addEventListener('click', async function() {
            const message = messageInput.value.trim();
            const model = modelSelect.value;
            
            if (!message) {
                showStatus(apiStatus, '请输入消息', 'error');
                return;
            }
            
            showStatus(apiStatus, '正在发送请求...', 'info');
            apiResponse.classList.add('hidden');
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + userPassword,
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                role: "user",
                                content: message
                            }
                        ],
                        model
                    }),
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showStatus(apiStatus, '请求成功', 'success');
                    responseContent.textContent = JSON.stringify(data, null, 2);
                    apiResponse.classList.remove('hidden');
                } else {
                    showStatus(apiStatus, data.error || '请求失败', 'error');
                }
            } catch (error) {
                showStatus(apiStatus, '网络错误: ' + error.message, 'error');
            }
        });
    }
    
    // 刷新单个token
    async function refreshSingleToken(tokenId) {
        const card = document.querySelector('[data-token-id="' + encodeURIComponent(tokenId) + '"]');
        if (!card) return;
        
        const refreshBtn = card.querySelector('.btn-refresh');
        const deleteBtn = card.querySelector('.btn-delete');
        
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = '刷新中...';
        }
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/refresh-single-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                },
                body: JSON.stringify({ tokenId }),
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                addStatusMessage('Token ' + tokenId + ' 刷新成功', 'success', 5000);
                checkTokenStatus();
            } else {
                addStatusMessage('Token ' + tokenId + ' 刷新失败: ' + (data.error || '未知错误'), 'error', 5000);
                checkTokenStatus();
            }
        } catch (error) {
            addStatusMessage('Token ' + tokenId + ' 刷新失败: ' + error.message, 'error', 5000);
            checkTokenStatus();
        } finally {
            const updatedCard = document.querySelector('[data-token-id="' + encodeURIComponent(tokenId) + '"]');
            if (updatedCard) {
                const updatedRefreshBtn = updatedCard.querySelector('.btn-refresh');
                const updatedDeleteBtn = updatedCard.querySelector('.btn-delete');
                
                if (updatedRefreshBtn) {
                    updatedRefreshBtn.disabled = false;
                    updatedRefreshBtn.textContent = '刷新';
                }
                if (updatedDeleteBtn) {
                    updatedDeleteBtn.disabled = false;
                }
            }
        }
    }
    
    // 删除单个token
    async function deleteSingleToken(tokenId) {
        const card = document.querySelector('[data-token-id="' + encodeURIComponent(tokenId) + '"]');
        if (!card) return;
        
        const refreshBtn = card.querySelector('.btn-refresh');
        const deleteBtn = card.querySelector('.btn-delete');
        
        if (refreshBtn) {
            refreshBtn.disabled = true;
        }
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = '删除中...';
        }
        
        try {
            const response = await fetch('/api/delete-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + userPassword,
                },
                body: JSON.stringify({ tokenId }),
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                addStatusMessage('Token ' + tokenId + ' 删除成功', 'success', 5000);
                checkTokenStatus();
            } else {
                addStatusMessage('Token ' + tokenId + ' 删除失败: ' + (data.error || '未知错误'), 'error', 5000);
            }
        } catch (error) {
            addStatusMessage('Token ' + tokenId + ' 删除失败: ' + error.message, 'error', 5000);
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
            }
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '删除';
            }
        }
    }
    
    // 状态消息队列管理
    const statusQueue = [];
    let statusTimeouts = new Map();
    
    // 显示状态信息
    function showStatus(element, message, type) {
        if (!element) return;
        
        // 处理需要显示为浮动状态的消息
        if ((element.id === 'token-status' || element.id === 'refresh-status') && 
            (message.includes('刷新') || message.includes('删除') || message.includes('成功') || message.includes('失败'))) {
            addStatusMessage(message, type, 5000);
            return;
        }
        
        // 处理普通状态元素
        if (element.hideTimeout) {
            clearTimeout(element.hideTimeout);
        }
        
        if (element.id === 'token-status' || element.id === 'refresh-status') {
            element.className = 'status ' + type;
        } else {
            element.className = 'status floating ' + type;
        }
        element.textContent = message;
        element.style.display = 'block';
        
        if (!message.includes('等待授权完成') && !message.includes('剩余时间')) {
            element.hideTimeout = setTimeout(() => {
                element.style.display = 'none';
                element.hideTimeout = null;
            }, 5000);
        }
    }
    
    // 添加状态消息到队列
    function addStatusMessage(message, type, duration = 5000) {
        if (!statusContainer) return;
        
        // 显示容器
        statusContainer.style.display = 'flex';
        
        // 创建新的状态元素
        const statusElement = document.createElement('div');
        statusElement.className = 'status floating ' + type;
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        
        // 添加到容器
        statusContainer.appendChild(statusElement);
        
        // 添加到队列
        const messageId = Date.now() + Math.random();
        statusQueue.push({ id: messageId, element: statusElement });
        
        // 设置超时自动移除
        const timeoutId = setTimeout(() => {
            removeStatusMessage(messageId);
        }, duration);
        
        statusTimeouts.set(messageId, timeoutId);
    }
    
    // 移除状态消息
    function removeStatusMessage(messageId) {
        const messageIndex = statusQueue.findIndex(msg => msg.id === messageId);
        if (messageIndex === -1) return;
        
        const message = statusQueue[messageIndex];
        
        // 清除超时
        if (statusTimeouts.has(messageId)) {
            clearTimeout(statusTimeouts.get(messageId));
            statusTimeouts.delete(messageId);
        }
        
        // 添加移除动画
        message.element.classList.add('removing');
        
        // 动画完成后移除元素
        setTimeout(() => {
            if (message.element.parentNode) {
                message.element.parentNode.removeChild(message.element);
            }
            
            // 从队列中移除
            statusQueue.splice(messageIndex, 1);
            
            // 如果队列为空，隐藏容器
            if (statusQueue.length === 0) {
                statusContainer.style.display = 'none';
            }
        }, 300);
    }
    
    // 自动登录函数
    async function autoLogin(password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 自动登录成功
                userPassword = password;
                loginSection.classList.add('hidden');
                mainSection.classList.remove('hidden');
                checkTokenStatus();
            } else {
                // 自动登录失败，清除保存的密码
                localStorage.removeItem('API_PASSWORD');
                showStatus(loginStatus, '自动登录失败，请重新登录', 'error');
            }
        } catch (error) {
            // 网络错误，清除保存的密码
            localStorage.removeItem('API_PASSWORD');
            showStatus(loginStatus, '自动登录失败: ' + error.message, 'error');
        }
    }
    
    // 添加退出登录功能（可选）
    window.logout = function() {
        localStorage.removeItem('API_PASSWORD');
        userPassword = '';
        loginSection.classList.remove('hidden');
        mainSection.classList.add('hidden');
        passwordInput.value = '';
        showStatus(loginStatus, '已退出登录', 'info');
    };
});