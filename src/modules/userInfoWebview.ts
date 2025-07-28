import * as vscode from 'vscode';
import * as path from 'path';
import { AuthManager } from '../managers/authManager';
import { CommentManager } from '../managers/commentManager';
import { BookmarkManager } from '../managers/bookmarkManager';
import { TagManager } from '../managers/tagManager';

export class UserInfoWebview {
    public static currentPanel: UserInfoWebview | undefined;

    public static readonly viewType = 'localComment.userInfo';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _authManager: AuthManager;
    private _commentManager?: CommentManager;
    private _bookmarkManager?: BookmarkManager;
    private _tagManager?: TagManager;

    public static createOrShow(
        extensionUri: vscode.Uri, 
        authManager: AuthManager,
        commentManager?: CommentManager,
        bookmarkManager?: BookmarkManager,
        tagManager?: TagManager
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.One
            : undefined;

        // 如果已经存在面板，则显示它
        if (UserInfoWebview.currentPanel) {
            UserInfoWebview.currentPanel._panel.reveal(column);
            UserInfoWebview.currentPanel.refreshUserInfo();
            return;
        }

        // 否则创建新面板
        const panel = vscode.window.createWebviewPanel(
            UserInfoWebview.viewType,
            '用户信息',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'src', 'templates')
                ]
            }
        );

        UserInfoWebview.currentPanel = new UserInfoWebview(
            panel, 
            extensionUri, 
            authManager,
            commentManager,
            bookmarkManager,
            tagManager
        );
    }

    public static revive(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri, 
        authManager: AuthManager,
        commentManager?: CommentManager,
        bookmarkManager?: BookmarkManager,
        tagManager?: TagManager
    ) {
        UserInfoWebview.currentPanel = new UserInfoWebview(
            panel, 
            extensionUri, 
            authManager,
            commentManager,
            bookmarkManager,
            tagManager
        );
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri, 
        authManager: AuthManager,
        commentManager?: CommentManager,
        bookmarkManager?: BookmarkManager,
        tagManager?: TagManager
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._authManager = authManager;
        this._commentManager = commentManager;
        this._bookmarkManager = bookmarkManager;
        this._tagManager = tagManager;

        // 设置初始HTML内容
        this._update();

        // 监听面板被关闭的事件
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // 处理来自webview的消息
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'getUserInfo':
                        this.handleGetUserInfo();
                        return;
                    case 'logout':
                        this.handleLogout();
                        return;
                    case 'close':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        UserInfoWebview.currentPanel = undefined;

        // 清理资源
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async handleGetUserInfo() {
        try {
            // 检查用户是否已登录
            if (!this._authManager.isLoggedIn()) {
                this._panel.webview.postMessage({
                    command: 'userInfoResult',
                    success: false,
                    message: '用户未登录'
                });
                return;
            }

            // 获取用户信息
            const user = this._authManager.getCurrentUser();
            if (!user) {
                this._panel.webview.postMessage({
                    command: 'userInfoResult',
                    success: false,
                    message: '无法获取用户信息'
                });
                return;
            }

            // 获取项目信息
            const project = this.getProjectInfo();

            // 获取统计信息
            const stats = this.getUsageStats();

            // 发送用户信息到webview
            this._panel.webview.postMessage({
                command: 'userInfoResult',
                success: true,
                data: {
                    user,
                    project,
                    stats
                }
            });
        } catch (error) {
            console.error('获取用户信息失败:', error);
            this._panel.webview.postMessage({
                command: 'userInfoResult',
                success: false,
                message: '获取用户信息时发生错误: ' + (error as Error).message
            });
        }
    }

    private async handleLogout() {
        try {
            await this._authManager.logout();
            this._panel.webview.postMessage({
                command: 'logoutResult',
                success: true
            });
            
            // 显示退出登录成功消息
            vscode.window.showInformationMessage('已成功退出登录');
            
            // 执行用户退出登录后的清理工作
            vscode.commands.executeCommand('localComment.onUserLogout');
        } catch (error) {
            console.error('退出登录失败:', error);
            this._panel.webview.postMessage({
                command: 'logoutResult',
                success: false,
                message: '退出登录失败: ' + (error as Error).message
            });
        }
    }

    private getProjectInfo() {
        // 优先使用commentManager获取项目信息
        if (this._commentManager) {
            return this._commentManager.getProjectInfo();
        } else if (this._bookmarkManager) {
            return this._bookmarkManager.getProjectInfo();
        } else {
            // 如果没有管理器，手动获取项目信息
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                return {
                    name: path.basename(workspacePath),
                    path: workspacePath,
                    storageFile: ''
                };
            }
            
            return {
                name: '未知项目',
                path: '无工作区',
                storageFile: ''
            };
        }
    }

    private getUsageStats() {
        const stats = {
            comments: 0,
            bookmarks: 0,
            tags: 0
        };

        try {
            // 获取注释数量
            if (this._commentManager) {
                const allComments = this._commentManager.getAllComments();
                stats.comments = Object.values(allComments).reduce((total, comments) => total + comments.length, 0);
            }

            // 获取书签数量
            if (this._bookmarkManager) {
                const allBookmarks = this._bookmarkManager.getAllBookmarks();
                stats.bookmarks = Object.values(allBookmarks).reduce((total, bookmarks) => total + bookmarks.length, 0);
            }

            // 获取标签数量
            if (this._tagManager) {
                const tagDeclarations = this._tagManager.getTagDeclarations();
                stats.tags = tagDeclarations.size;
            }
        } catch (error) {
            console.error('获取统计信息失败:', error);
        }

        return stats;
    }

    public refreshUserInfo() {
        // 刷新用户信息
        this.handleGetUserInfo();
    }

    private _update() {
        const webview = this._panel.webview;

        this._panel.title = '用户信息';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'src', 'templates', 'userInfo', 'userInfo.js');

        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Local path to css file
        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'src', 'templates', 'userInfo', 'userInfo.css');

        // Uri to load styles into webview
        const stylesUri = webview.asWebviewUri(stylePathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        // Read the HTML template
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'templates', 'userInfo', 'userInfo.html');
        const fs = require('fs');
        let html = fs.readFileSync(htmlPath.fsPath, 'utf8');

        // Replace placeholders
        html = html.replace(/\${cssUri}/g, stylesUri.toString());
        html = html.replace(/\${jsUri}/g, scriptUri.toString());
        html = html.replace(/\${nonce}/g, nonce);

        return html;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
} 