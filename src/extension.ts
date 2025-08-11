import * as vscode from 'vscode';
import { CommentManager } from './managers/commentManager';
import { CommentProvider } from './providers/commentProvider';
import { SharedCommentProvider } from './providers/sharedCommentProvider';
import { CommentTreeProvider } from './providers/commentTreeProvider';
import { SharedCommentTreeProvider } from './providers/sharedCommentTreeProvider';
import { TagManager } from './managers/tagManager';
import { TagCompletionProvider } from './providers/tagCompletionProvider';
import { TagDefinitionProvider } from './providers/tagDefinitionProvider';
import { FileHeatManager } from './managers/fileHeatManager';
import { BookmarkManager } from './managers/bookmarkManager';
import { BookmarkDecorationProvider } from './providers/bookmarkDecorationProvider';
import * as path from 'path';
import * as fs from 'fs';
import { registerCommands } from './modules/command/commands';
import { AuthManager } from './managers/authManager';
import { ProjectManager } from './managers/projectManager';
import { UserInfoWebview } from './modules/userInfoWebview';

let commentManager: CommentManager;
let commentProvider: CommentProvider;
let sharedCommentProvider: SharedCommentProvider;
let commentTreeProvider: CommentTreeProvider;
let sharedCommentTreeProvider: SharedCommentTreeProvider;
let tagManager: TagManager;
let fileHeatManager: FileHeatManager;
let bookmarkManager: BookmarkManager;
let bookmarkDecorationProvider: BookmarkDecorationProvider;
let authManager: AuthManager;
let projectManager: ProjectManager;

// 全局变量，用于跟踪最后一次键盘活动时间
let lastKeyboardActivity = Date.now();
const KEYBOARD_ACTIVITY_THRESHOLD = 1000; // 1秒内有键盘活动才视为手动编辑

// 添加防抖定时器用于优化刷新频率
let refreshTimer: NodeJS.Timeout | null = null;
const REFRESH_DEBOUNCE_DELAY = 150; // 150ms防抖延迟
let statusBarItem: vscode.StatusBarItem;

    // 更新状态栏和上下文变量
    function updateStatusAndContext() {
        // 更新登录状态
        const isLoggedIn = authManager && authManager.isLoggedIn();
        vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', isLoggedIn);

        // 更新共享注释状态
        const hasSharedComments = commentManager && Object.values(commentManager.getAllSharedComments()).some(comments => comments.length > 0);
        vscode.commands.executeCommand('setContext', 'localComment.hasSharedComments', hasSharedComments);

        // 更新状态栏
        if (isLoggedIn) {
            const user = authManager.getCurrentUser();
            statusBarItem.text = `$(account) ${user?.username || '已登录'}`;
            statusBarItem.tooltip = '点击查看用户信息';
            statusBarItem.command = 'localComment.showUserInfo';
        } else {
            statusBarItem.text = '$(sign-in) 未登录';
            statusBarItem.tooltip = '点击登录或查看用户信息';
            statusBarItem.command = 'localComment.showUserInfo';
        }
    }

export function activate(context: vscode.ExtensionContext) {
    console.log('本地注释插件已激活');

    // 初始化管理器
    commentManager = new CommentManager(context);
    commentProvider = new CommentProvider(commentManager);
    sharedCommentProvider = new SharedCommentProvider(commentManager);
    
    // 设置本地注释提供器的刷新回调，以便同步更新共享注释装饰器
    commentProvider.setRefreshCallback(() => {
        if (sharedCommentProvider) {
            sharedCommentProvider.refresh();
        }
    });
    
    fileHeatManager = new FileHeatManager(context);
    bookmarkManager = new BookmarkManager(context);
    bookmarkDecorationProvider = new BookmarkDecorationProvider(bookmarkManager);
    commentTreeProvider = new CommentTreeProvider(commentManager, fileHeatManager, bookmarkManager);
    sharedCommentTreeProvider = new SharedCommentTreeProvider(commentManager);
    tagManager = new TagManager();
    authManager = new AuthManager(context);
    projectManager = new ProjectManager(context);

    // 初始化标签数据
    tagManager.updateTags(commentManager.getAllComments());

    // 注册命令
    const commandDisposables = registerCommands(context, commentManager, tagManager, commentProvider, commentTreeProvider, bookmarkManager, authManager);

    // 注册一个新命令来显示用户信息面板
    context.subscriptions.push(vscode.commands.registerCommand('localComment.showUserInfo', () => {
        if (!authManager) {
            vscode.window.showErrorMessage('认证管理器未初始化');
            return;
        }
        
        // 如果未登录，显示登录界面
        if (!authManager.isLoggedIn()) {
            const { AuthWebview } = require('./modules/authWebview');
            AuthWebview.createOrShow(context.extensionUri, authManager);
            return;
        }
        
        // 如果已登录，显示用户信息面板
        UserInfoWebview.createOrShow(context.extensionUri, authManager, projectManager, commentManager, bookmarkManager, tagManager);
    }));

    // (可选) 如果你希望在VS Code重启后能恢复用户信息面板
    vscode.window.registerWebviewPanelSerializer(UserInfoWebview.viewType, {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
            // 恢复webview时也需要检查认证状态
            if (!authManager) {
                console.error('认证管理器未初始化，无法恢复用户信息面板');
                webviewPanel.dispose();
                return;
            }
            
            // 如果用户已登录，恢复用户信息面板
            if (authManager.isLoggedIn()) {
                UserInfoWebview.revive(webviewPanel, context.extensionUri, authManager, projectManager, commentManager, bookmarkManager, tagManager);
            } else {
                // 如果用户未登录，关闭面板
                webviewPanel.dispose();
            }
        }
    });

    // 注册用于修改树视图样式的CSS
    const decorationProvider = vscode.window.registerFileDecorationProvider({
        provideFileDecoration: (uri) => {
            if (uri.scheme === 'hidden-comment') {
                return {
                    propagate: true,
                    color: new vscode.ThemeColor('descriptionForeground'),
                    tooltip: '此注释当前无法匹配到代码'
                };
            }
            return undefined;
        }
    });
    context.subscriptions.push(decorationProvider);

    // 注册自动补全和定义提供器
    const completionProvider = new TagCompletionProvider(tagManager, commentManager);
    const definitionProvider = new TagDefinitionProvider(tagManager, commentManager);

    const completionDisposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file' },
        completionProvider,
        '@'
    );

    const definitionDisposable = vscode.languages.registerDefinitionProvider(
        { scheme: 'file' },
        definitionProvider
    );

    // 注册树视图
    const treeView = vscode.window.createTreeView('localComments', {
        treeDataProvider: commentTreeProvider,
        showCollapseAll: true
    });

    // 注册共享注释树视图
    const sharedTreeView = vscode.window.createTreeView('sharedComments', {
        treeDataProvider: sharedCommentTreeProvider,
        showCollapseAll: true
    });

    // 初始化时等待编辑器准备就绪
    if (vscode.window.activeTextEditor) {
        // 如果已经有活动的编辑器，立即刷新
        commentProvider.refresh();
        sharedCommentProvider.refresh();
        commentTreeProvider.refresh(); // 初始化时可以完整刷新
        sharedCommentTreeProvider.refresh(); // 初始化共享注释树视图
    }

    // 创建状态栏项
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'localComment.showUserInfo';
    
    // 初始化上下文变量
    const isLoggedIn = authManager.isLoggedIn();
    vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', isLoggedIn);
    const hasSharedComments = Object.values(commentManager.getAllSharedComments()).some(comments => comments.length > 0);
    vscode.commands.executeCommand('setContext', 'localComment.hasSharedComments', hasSharedComments);
    
    updateStatusAndContext();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 处理共享注释的函数
    const handleSharedCommentsAfterInit = async () => {
        const isLoggedIn = authManager.isLoggedIn();
        if (!isLoggedIn) {
            console.log('用户未登录，某些功能可能受限');
            // 用户未登录时，清除所有共享注释
            try {
                await commentManager.handleSharedCommentsByAuthStatus(false);
                // 刷新注释显示
                commentProvider.refresh();
                sharedCommentProvider.refresh();
                commentTreeProvider.refresh();
                sharedCommentTreeProvider.refresh();
            } catch (error) {
                console.error('清除共享注释失败:', error);
            }
        } else {
            const user = authManager.getCurrentUser();
            console.log(`用户已登录: ${user?.username}`);
            
            // 如果用户已登录，尝试自动加载共享注释
            try {
                const associatedProjectId = projectManager.getAssociatedProject();
                if (associatedProjectId) {
                    const projectId = parseInt(associatedProjectId, 10);
                    if (!isNaN(projectId)) {
                        console.log(`🔄 自动加载项目 ${projectId} 的共享注释...`);
                        const sharedComments = await commentManager.getProjectSharedComments(projectId);
                        if (sharedComments && sharedComments.length > 0) {
                            console.log(`✅ 自动加载了 ${sharedComments.length} 条共享注释`);
                            // 刷新注释显示
                            commentProvider.refresh();
                            sharedCommentProvider.refresh();
                            commentTreeProvider.refresh();
                            sharedCommentTreeProvider.refresh();
                        } else {
                            console.log('ℹ️ 项目中没有共享注释');
                        }
                    }
                } else {
                    console.log('ℹ️ 用户未关联项目，跳过自动加载共享注释');
                }
            } catch (error) {
                console.error('自动加载共享注释失败:', error);
            }
        }
    };

    // 订阅认证管理器初始化完成事件
    authManager.onInitialized(async () => {
        console.log('✅ 认证管理器初始化完成，开始处理共享注释');
        await handleSharedCommentsAfterInit();
    });

    // 监听编辑器变化
    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            // 编辑器切换时只刷新注释装饰器
            commentProvider.refresh();
            // 注释树在编辑器切换时不需要刷新，因为内容没有变化
        }
    });

    // 监听文档打开
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(() => {
        // 文档打开时只刷新注释装饰器
        commentProvider.refresh();
        // 注释树在文档打开时不需要刷新，因为内容没有变化
    });

    // 监听文档保存事件，执行智能匹配
    const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument((document) => {
        commentManager.handleDocumentSave(document);
    });

    // 监听文档变化
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        // 文档变化时更新键盘活动时间（确保复制粘贴等操作被识别为用户活动）
        updateKeyboardActivityOnChange();
        
        // 获取当前时间
        const now = Date.now();
        // 只有在最近有键盘活动的情况下才更新代码快照
        const hasRecentKeyboardActivity = (now - lastKeyboardActivity < KEYBOARD_ACTIVITY_THRESHOLD);
        
        // 传递键盘活动信息给commentManager
        commentManager.handleDocumentChange(event, hasRecentKeyboardActivity);
        // 书签保持静态，不需要处理文档变化
        tagManager.updateTags(commentManager.getAllComments());
        
        // 使用防抖机制减少频繁刷新
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }
        
        refreshTimer = setTimeout(() => {
            // 只刷新注释装饰器，不刷新注释树
            // 注释树会在注释管理器的智能更新完成后自动刷新
            commentProvider.refresh();
            refreshTimer = null;
        }, REFRESH_DEBOUNCE_DELAY);
    });

    // 添加键盘事件监听
    const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(() => {
        // 更新最后一次键盘活动时间
        lastKeyboardActivity = Date.now();
    });

    // 添加键盘输入事件监听（更全面的键盘活动捕获）
    const onDidChangeTextEditorVisibleRanges = vscode.window.onDidChangeTextEditorVisibleRanges(() => {
        // 更新最后一次键盘活动时间
        lastKeyboardActivity = Date.now();
    });

    // 监听文档内容变化时也更新键盘活动时间（确保复制粘贴等操作被识别为用户活动）
    const updateKeyboardActivityOnChange = () => {
        lastKeyboardActivity = Date.now();
    };

    // 监听登录状态变化
    const onUserLogin = vscode.commands.registerCommand('localComment.onUserLogin', async (user) => {
        // 更新登录状态上下文变量
        vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', true);
        updateStatusAndContext();
        vscode.window.showInformationMessage(`欢迎回来，${user.username}！`);
        
        // 用户登录后，处理共享注释（保留现有共享注释）
        try {
            await commentManager.handleSharedCommentsByAuthStatus(true);
            // 刷新注释显示
            commentProvider.refresh();
            commentTreeProvider.refresh();
            sharedCommentTreeProvider.refresh();
            updateStatusAndContext(); // 再次更新状态以反映共享注释的变化
        } catch (error) {
            console.error('处理登录后的共享注释失败:', error);
        }
        
        // 登录成功后自动打开用户信息界面
        setTimeout(() => {
            vscode.commands.executeCommand('localComment.showUserInfo');
        }, 300); // 延迟300ms，让用户看到欢迎消息
    });

    const onUserLogout = vscode.commands.registerCommand('localComment.onUserLogout', async () => {
        // 更新登录状态上下文变量
        vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', false);
        updateStatusAndContext();
        vscode.window.showInformationMessage('您已成功登出');
        
        // 用户登出后，清除所有共享注释
        try {
            await commentManager.handleSharedCommentsByAuthStatus(false);
            // 刷新注释显示
            commentProvider.refresh();
            commentTreeProvider.refresh();
            sharedCommentTreeProvider.refresh();
            updateStatusAndContext(); // 再次更新状态以反映共享注释的变化
        } catch (error) {
            console.error('处理登出后的共享注释失败:', error);
        }
    });

    // 在注册自动补全和定义提供器的部分后添加
    const hoverDisposable = vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        commentProvider
    );

    context.subscriptions.push(
        ...commandDisposables,
        onDidChangeTextDocument,
        onDidChangeActiveTextEditor,
        onDidChangeTextEditorSelection,
        onDidChangeTextEditorVisibleRanges,
        onDidOpenTextDocument,
        onDidSaveTextDocument,
        onUserLogin,
        onUserLogout,
        commentProvider,
        sharedCommentProvider,
        commentTreeProvider,
        treeView,
        completionDisposable,
        definitionDisposable,
        hoverDisposable,
        fileHeatManager,
        bookmarkManager,
        bookmarkDecorationProvider
    );
    
    console.log('✅ 本地注释插件激活完成');
}

export function deactivate() {
    console.log('本地注释插件正在停用');
    
    // 保存文件热度数据
    if (fileHeatManager) {
        fileHeatManager.dispose();
    }
    
    // 释放书签管理器
    if (bookmarkManager) {
        bookmarkManager.dispose();
    }
    
    // 释放书签装饰器提供者
    if (bookmarkDecorationProvider) {
        bookmarkDecorationProvider.dispose();
    }
    
    // 释放注释提供器
    if (commentProvider) {
        commentProvider.dispose();
    }
    
    // 释放共享注释提供器
    if (sharedCommentProvider) {
        sharedCommentProvider.dispose();
    }
    
    console.log('✅ 本地注释插件停用完成');
}
