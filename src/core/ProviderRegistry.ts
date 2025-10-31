import * as vscode from 'vscode';
import { ExtensionContainer } from './ExtensionContainer';
import { TagCompletionProvider } from '../providers/tagCompletionProvider';
import { TagDefinitionProvider } from '../providers/tagDefinitionProvider';
import { UserInfoWebview } from '../modules/userInfoWebview';

/**
 * 提供器注册表 - 注册所有语言服务提供器、树视图和文件装饰器
 */
export class ProviderRegistry {
    private treeView?: vscode.TreeView<any>;
    private sharedTreeView?: vscode.TreeView<any>;

    constructor(
        private container: ExtensionContainer,
        private context: vscode.ExtensionContext
    ) {}

    /**
     * 注册所有提供器
     * @returns 所有提供器的 Disposable 数组
     */
    register(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 注册语言服务提供器
        const languageProviderDisposables = this.registerLanguageProviders();
        disposables.push(...languageProviderDisposables);

        // 注册树视图
        const treeViewDisposables = this.registerTreeViews();
        disposables.push(...treeViewDisposables);

        // 注册文件装饰器
        const decorationDisposable = this.registerFileDecorations();
        disposables.push(decorationDisposable);

        return disposables;
    }

    /**
     * 注册语言服务提供器（Completion、Definition、Hover）
     */
    private registerLanguageProviders(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 注册自动补全和定义提供器
        const completionProvider = new TagCompletionProvider(
            this.container.tagManager,
            this.container.commentManager
        );
        const definitionProvider = new TagDefinitionProvider(
            this.container.tagManager,
            this.container.commentManager
        );

        const completionDisposable = vscode.languages.registerCompletionItemProvider(
            { scheme: 'file' },
            completionProvider,
            '@'
        );
        disposables.push(completionDisposable);

        const definitionDisposable = vscode.languages.registerDefinitionProvider(
            { scheme: 'file' },
            definitionProvider
        );
        disposables.push(definitionDisposable);

        // 注册本地注释的hover提供器
        const hoverDisposable = vscode.languages.registerHoverProvider(
            { scheme: 'file' },
            this.container.commentProvider
        );
        disposables.push(hoverDisposable);

        // 注册共享注释的hover提供器
        const sharedHoverDisposable = vscode.languages.registerHoverProvider(
            { scheme: 'file' },
            this.container.sharedCommentProvider
        );
        disposables.push(sharedHoverDisposable);

        return disposables;
    }

    /**
     * 注册树视图
     */
    private registerTreeViews(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 注册本地注释树视图
        this.treeView = vscode.window.createTreeView('localComments', {
            treeDataProvider: this.container.commentTreeProvider,
            showCollapseAll: true
        });
        disposables.push(this.treeView);

        // 注册共享注释树视图
        this.sharedTreeView = vscode.window.createTreeView('sharedComments', {
            treeDataProvider: this.container.sharedCommentTreeProvider,
            showCollapseAll: true
        });
        disposables.push(this.sharedTreeView);

        return disposables;
    }

    /**
     * 注册文件装饰器
     */
    private registerFileDecorations(): vscode.Disposable {
        const decorationProvider = vscode.window.registerFileDecorationProvider({
            provideFileDecoration: (uri) => {
                if (uri.scheme === 'hidden-comment') {
                    return {
                        propagate: true,
                        color: new vscode.ThemeColor('descriptionForeground'),
                        tooltip: '此注释当前无法匹配到代码'
                    };
                }
                if (uri.scheme === 'hidden-shared-comment') {
                    return {
                        propagate: true,
                        color: new vscode.ThemeColor('descriptionForeground'),
                        tooltip: '此共享注释当前无法匹配到代码'
                    };
                }
                return undefined;
            }
        });

        return decorationProvider;
    }

    /**
     * 初始化提供器（在编辑器准备就绪后刷新）
     */
    initialize(): void {
        // 初始化时等待编辑器准备就绪
        if (vscode.window.activeTextEditor) {
            // 如果已经有活动的编辑器，立即刷新
            this.container.commentProvider.refresh();
            this.container.sharedCommentProvider.refresh();
            this.container.commentTreeProvider.refresh(); // 初始化时可以完整刷新
            this.container.sharedCommentTreeProvider.refresh(); // 初始化共享注释树视图
        }
    }

    /**
     * 注册用户信息Webview的序列化器
     */
    registerUserInfoWebviewSerializer(): void {
        const container = this.container;
        const context = this.context;
        
        vscode.window.registerWebviewPanelSerializer(UserInfoWebview.viewType, {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
                // 恢复webview时也需要检查认证状态
                if (!container.authManager) {
                    console.error('认证管理器未初始化，无法恢复用户信息面板');
                    webviewPanel.dispose();
                    return;
                }
                
                // 如果用户已登录，恢复用户信息面板
                if (container.authManager.isLoggedIn()) {
                    UserInfoWebview.revive(
                        webviewPanel,
                        context.extensionUri,
                        container.authManager,
                        container.projectManager,
                        container.commentManager,
                        container.bookmarkManager,
                        container.tagManager
                    );
                } else {
                    // 如果用户未登录，关闭面板
                    webviewPanel.dispose();
                }
            }
        });
    }
}

