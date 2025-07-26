import * as vscode from 'vscode';
import { AuthManager, LoginCredentials } from '../managers/authManager';

export class AuthWebview {
    private static readonly viewType = 'localComment.auth';
    private readonly _panel: vscode.WebviewPanel | undefined;
    private readonly _extensionUri: vscode.Uri;
    private readonly _authManager: AuthManager;

    public static currentPanel: AuthWebview | undefined;

    public static createOrShow(extensionUri: vscode.Uri, authManager: AuthManager): AuthWebview {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经有面板，显示它
        if (AuthWebview.currentPanel) {
            AuthWebview.currentPanel._panel!.reveal(column);
            return AuthWebview.currentPanel;
        }

        // 否则，创建一个新面板
        const panel = vscode.window.createWebviewPanel(
            AuthWebview.viewType,
            '用户登录',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'resources')
                ]
            }
        );

        AuthWebview.currentPanel = new AuthWebview(panel, extensionUri, authManager);
        return AuthWebview.currentPanel;
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, authManager: AuthManager) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._authManager = authManager;

        // 设置初始HTML内容
        this._update();

        // 监听面板关闭
        this._panel.onDidDispose(() => this.dispose(), null, authManager.context.subscriptions);

        // 处理来自webview的消息
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'login':
                        await this.handleLogin(message.credentials);
                        break;
                    case 'logout':
                        await this.handleLogout();
                        break;
                }
            },
            undefined,
            authManager.context.subscriptions
        );
    }

    public dispose() {
        AuthWebview.currentPanel = undefined;

        // 清理资源
        if (this._panel) {
            this._panel.dispose();
        }
    }

    private async _update() {
        if (this._panel) {
            this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        }
    }

    private async handleLogin(credentials: LoginCredentials) {
        try {
            const result = await this._authManager.login(credentials);
            
            if (result.success) {
                vscode.window.showInformationMessage(`登录成功！欢迎 ${result.user?.username}`);
                this.dispose();
                
                // 通知其他组件用户已登录
                vscode.commands.executeCommand('localComment.onUserLogin', result.user);
            } else {
                this._panel?.webview.postMessage({
                    command: 'loginResult',
                    success: false,
                    message: result.message
                });
            }
        } catch (error) {
            this._panel?.webview.postMessage({
                command: 'loginResult',
                success: false,
                message: '登录失败: ' + (error as Error).message
            });
        }
    }

    private async handleLogout() {
        try {
            await this._authManager.logout();
            vscode.window.showInformationMessage('已成功登出');
            this.dispose();
            
            // 通知其他组件用户已登出
            vscode.commands.executeCommand('localComment.onUserLogout');
        } catch (error) {
            vscode.window.showErrorMessage('登出失败: ' + (error as Error).message);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'resources', 'style.css'));
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>用户登录</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: var(--vscode-panel-background);
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .header h1 {
            margin: 0;
            color: var(--vscode-editor-foreground);
            font-size: 24px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: var(--vscode-editor-foreground);
            font-weight: 500;
        }
        
        .form-group input {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 14px;
            box-sizing: border-box;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            margin-top: 10px;
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .message {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
        }
        
        .message.error {
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        
        .message.success {
            background: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }
        
        .loading {
            display: none;
            text-align: center;
            margin: 10px 0;
        }
        
        .spinner {
            border: 2px solid var(--vscode-input-border);
            border-top: 2px solid var(--vscode-focusBorder);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>本地注释插件</h1>
            <p>请登录以使用完整功能</p>
        </div>
        
        <div id="login-content">
            <div id="login-message" class="message"></div>
            <div id="login-loading" class="loading">
                <div class="spinner"></div>
                <p>正在登录...</p>
            </div>
            
            <form id="login-form">
                <div class="form-group">
                    <label for="login-username">用户名</label>
                    <input type="text" id="login-username" required>
                </div>
                <div class="form-group">
                    <label for="login-password">密码</label>
                    <input type="password" id="login-password" required>
                </div>
                <button type="submit" class="btn btn-primary">登录</button>
            </form>
            
            <div style="margin-top: 20px; text-align: center; font-size: 12px; color: var(--vscode-descriptionForeground);">
                <p>演示账号: demo / password</p>
            </div>
        </div>

    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function switchTab(tabName) {
            // 现在只有一个标签页，不需要切换逻辑
        }
        
        function showMessage(elementId, message, type) {
            const element = document.getElementById(elementId);
            element.textContent = message;
            element.className = 'message ' + type;
            element.style.display = 'block';
        }
        
        function hideMessage(elementId) {
            document.getElementById(elementId).style.display = 'none';
        }
        
        function showLoading(elementId) {
            document.getElementById(elementId).style.display = 'block';
        }
        
        function hideLoading(elementId) {
            document.getElementById(elementId).style.display = 'none';
        }
        
        // 登录表单处理
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            
            hideMessage('login-message');
            showLoading('login-loading');
            
            vscode.postMessage({
                command: 'login',
                credentials: { username, password }
            });
        });
        
        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'loginResult':
                    hideLoading('login-loading');
                    if (message.success) {
                        showMessage('login-message', message.message, 'success');
                    } else {
                        showMessage('login-message', message.message, 'error');
                    }
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
} 