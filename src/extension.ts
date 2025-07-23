import * as vscode from 'vscode';
import { CommentManager } from './managers/commentManager';
import { CommentProvider } from './providers/commentProvider';
import { CommentTreeProvider } from './providers/commentTreeProvider';
import { TagManager } from './managers/tagManager';
import { TagCompletionProvider } from './providers/tagCompletionProvider';
import { TagDefinitionProvider } from './providers/tagDefinitionProvider';
import { FileHeatManager } from './managers/fileHeatManager';
import { BookmarkManager } from './managers/bookmarkManager';
import { BookmarkDecorationProvider } from './providers/bookmarkDecorationProvider';
import * as path from 'path';
import * as fs from 'fs';
import { registerCommands } from './modules/commands';

let commentManager: CommentManager;
let commentProvider: CommentProvider;
let commentTreeProvider: CommentTreeProvider;
let tagManager: TagManager;
let fileHeatManager: FileHeatManager;
let bookmarkManager: BookmarkManager;
let bookmarkDecorationProvider: BookmarkDecorationProvider;

// 全局变量，用于跟踪最后一次键盘活动时间
let lastKeyboardActivity = Date.now();
const KEYBOARD_ACTIVITY_THRESHOLD = 1000; // 1秒内有键盘活动才视为手动编辑

// 添加防抖定时器用于优化刷新频率
let refreshTimer: NodeJS.Timeout | null = null;
const REFRESH_DEBOUNCE_DELAY = 150; // 150ms防抖延迟

export function activate(context: vscode.ExtensionContext) {
    console.log('本地注释插件已激活');

    // 初始化管理器
    commentManager = new CommentManager(context);
    commentProvider = new CommentProvider(commentManager);
    fileHeatManager = new FileHeatManager(context);
    bookmarkManager = new BookmarkManager(context);
    bookmarkDecorationProvider = new BookmarkDecorationProvider(bookmarkManager);
    commentTreeProvider = new CommentTreeProvider(commentManager, fileHeatManager, bookmarkManager);
    tagManager = new TagManager();

    // 初始化标签数据
    tagManager.updateTags(commentManager.getAllComments());

    // 注册命令
    const commandDisposables = registerCommands(context, commentManager, tagManager, commentProvider, commentTreeProvider, bookmarkManager);

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

    // 初始化时等待编辑器准备就绪
    if (vscode.window.activeTextEditor) {
        // 如果已经有活动的编辑器，立即刷新
        commentProvider.refresh();
        commentTreeProvider.refresh(); // 初始化时可以完整刷新
    }

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
        commentProvider,
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
    
    console.log('✅ 本地注释插件停用完成');
}
