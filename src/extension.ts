import * as vscode from 'vscode';
import { CommentManager } from './commentManager';
import { CommentProvider } from './providers/commentProvider';
import { CommentTreeProvider } from './providers/commentTreeProvider';
import { TagManager } from './tagManager';
import { TagCompletionProvider } from './providers/tagCompletionProvider';
import { TagDefinitionProvider } from './providers/tagDefinitionProvider';
import { FileHeatManager } from './fileHeatManager';
import * as path from 'path';
import * as fs from 'fs';
import { registerCommands } from './modules/commands';

let commentManager: CommentManager;
let commentProvider: CommentProvider;
let commentTreeProvider: CommentTreeProvider;
let tagManager: TagManager;
let fileHeatManager: FileHeatManager;

// 全局变量，用于跟踪最后一次键盘活动时间
let lastKeyboardActivity = Date.now();
const KEYBOARD_ACTIVITY_THRESHOLD = 1000; // 1秒内有键盘活动才视为手动编辑

export function activate(context: vscode.ExtensionContext) {
    console.log('本地注释插件已激活');

    // 初始化管理器
    commentManager = new CommentManager(context);
    commentProvider = new CommentProvider(commentManager);
    fileHeatManager = new FileHeatManager(context);
    commentTreeProvider = new CommentTreeProvider(commentManager, fileHeatManager);
    tagManager = new TagManager();

    // 初始化标签数据
    tagManager.updateTags(commentManager.getAllComments());

    // 注册命令
    const commandDisposables = registerCommands(context, commentManager, tagManager, commentProvider, commentTreeProvider);

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
        commentTreeProvider.refresh();
    }

    // 监听编辑器变化
    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            // 编辑器切换时刷新注释显示，但不刷新注释树排序
            commentProvider.refresh();
            // 注释树只刷新内容，不刷新排序（排序由热度更新事件触发）
            commentTreeProvider.refresh();
        }
    });

    // 监听文档打开
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(() => {
        // 文档打开时刷新注释显示，但不刷新注释树排序
        commentProvider.refresh();
        // 注释树只刷新内容，不刷新排序
        commentTreeProvider.refresh();
    });

    // 监听文档变化
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        // 获取当前时间
        const now = Date.now();
        // 只有在最近有键盘活动的情况下才更新代码快照
        const hasRecentKeyboardActivity = (now - lastKeyboardActivity < KEYBOARD_ACTIVITY_THRESHOLD);
        
        // 传递键盘活动信息给commentManager
        commentManager.handleDocumentChange(event, hasRecentKeyboardActivity);
        tagManager.updateTags(commentManager.getAllComments());
        commentProvider.refresh();
        // 文档变化时只刷新注释内容，不刷新排序（排序由热度更新事件触发）
        commentTreeProvider.refresh();
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
        commentProvider,
        commentTreeProvider,
        treeView,
        completionDisposable,
        definitionDisposable,
        hoverDisposable,
        fileHeatManager
    );
    
    console.log('✅ 本地注释插件激活完成');
}

export function deactivate() {
    console.log('本地注释插件正在停用');
    
    // 保存文件热度数据
    if (fileHeatManager) {
        fileHeatManager.dispose();
    }
    
    // 释放注释提供器
    if (commentProvider) {
        commentProvider.dispose();
    }
    
    console.log('✅ 本地注释插件停用完成');
}
