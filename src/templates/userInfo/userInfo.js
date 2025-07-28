// VS Code WebView API
const vscode = acquireVsCodeApi();

// DOM元素
const loadingEl = document.getElementById('loading');
const userProfileEl = document.getElementById('user-profile');
const errorMessageEl = document.getElementById('error-message');
const errorTextEl = document.getElementById('error-text');

// 用户信息元素
const userAvatarEl = document.getElementById('user-avatar');
const avatarPlaceholderEl = document.getElementById('avatar-placeholder');
const avatarInitialEl = document.getElementById('avatar-initial');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const userIdEl = document.getElementById('user-id');
const userCreatedAtEl = document.getElementById('user-created-at');
const userLastLoginEl = document.getElementById('user-last-login');

// 项目信息元素
const projectNameEl = document.getElementById('project-name');
const projectPathEl = document.getElementById('project-path');

// 统计信息元素
const commentsCountEl = document.getElementById('comments-count');
const bookmarksCountEl = document.getElementById('bookmarks-count');
const tagsCountEl = document.getElementById('tags-count');

// 按钮元素
const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const retryBtn = document.getElementById('retry-btn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    requestUserInfo();
    setupEventListeners();
});

// 设置事件监听器
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => {
        requestUserInfo();
    });
    
    logoutBtn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
            vscode.postMessage({
                command: 'logout'
            });
        }
    });
    
    retryBtn.addEventListener('click', () => {
        requestUserInfo();
    });
}

// 请求用户信息
function requestUserInfo() {
    showLoading();
    vscode.postMessage({
        command: 'getUserInfo'
    });
}

// 显示加载状态
function showLoading() {
    loadingEl.style.display = 'block';
    userProfileEl.style.display = 'none';
    errorMessageEl.style.display = 'none';
}

// 显示用户信息
function showUserInfo(data) {
    loadingEl.style.display = 'none';
    userProfileEl.style.display = 'block';
    errorMessageEl.style.display = 'none';
    
    populateUserInfo(data.user);
    populateProjectInfo(data.project);
    populateStats(data.stats);
}

// 显示错误信息
function showError(message) {
    loadingEl.style.display = 'none';
    userProfileEl.style.display = 'none';
    errorMessageEl.style.display = 'block';
    errorTextEl.textContent = message;
}

// 填充用户信息
function populateUserInfo(user) {
    if (!user) return;
    
    // 设置头像
    if (user.avatar) {
        userAvatarEl.src = user.avatar;
        userAvatarEl.style.display = 'block';
        avatarPlaceholderEl.style.display = 'none';
    } else {
        // 使用用户名首字母作为头像
        const initial = user.username ? user.username.charAt(0).toUpperCase() : '?';
        avatarInitialEl.textContent = initial;
        userAvatarEl.style.display = 'none';
        avatarPlaceholderEl.style.display = 'flex';
    }
    
    // 设置基本信息
    userNameEl.textContent = user.username || '未知用户';
    userEmailEl.textContent = user.email || '未设置邮箱';
    userIdEl.textContent = user.id || '--';
    
    // 格式化时间
    if (user.createdAt) {
        userCreatedAtEl.textContent = formatDate(user.createdAt);
    } else {
        userCreatedAtEl.textContent = '--';
    }
    
    if (user.lastLoginAt) {
        userLastLoginEl.textContent = formatDate(user.lastLoginAt);
    } else {
        userLastLoginEl.textContent = '--';
    }
}

// 填充项目信息
function populateProjectInfo(project) {
    if (!project) return;
    
    projectNameEl.textContent = project.name || '未知项目';
    projectPathEl.textContent = project.path || '无路径';
}

// 填充统计信息
function populateStats(stats) {
    if (!stats) {
        commentsCountEl.textContent = '--';
        bookmarksCountEl.textContent = '--';
        tagsCountEl.textContent = '--';
        return;
    }
    
    commentsCountEl.textContent = stats.comments || '0';
    bookmarksCountEl.textContent = stats.bookmarks || '0';
    tagsCountEl.textContent = stats.tags || '0';
}

// 格式化日期
function formatDate(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '无效日期';
    }
}

// 监听来自扩展的消息
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.command) {
        case 'userInfoResult':
            if (message.success) {
                showUserInfo(message.data);
            } else {
                showError(message.message || '获取用户信息失败');
            }
            break;
        case 'logoutResult':
            if (message.success) {
                // 关闭webview或返回登录界面
                vscode.postMessage({
                    command: 'close'
                });
            }
            break;
    }
}); 