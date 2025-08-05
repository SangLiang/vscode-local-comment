import * as vscode from 'vscode';
import { AuthManager, LoginCredentials } from '../managers/authManager';
import * as fs from 'fs';
import * as path from 'path';

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
                    vscode.Uri.joinPath(extensionUri, 'src', 'resources'),
                    vscode.Uri.joinPath(extensionUri, 'src', 'templates')
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
        const templatePath = path.join(this._extensionUri.fsPath, 'src', 'templates', 'auth');
        const htmlPath = path.join(templatePath, 'auth.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        const cssUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(templatePath, 'auth.css')
        ));
        const jsUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(templatePath, 'auth.js')
        ));

        htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
        htmlContent = htmlContent.replace('${jsUri}', jsUri.toString());

        return htmlContent;
    }
} 