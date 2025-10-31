import * as vscode from 'vscode';
// 类型导入（用于全局变量类型声明）
import { CommentManager } from './managers/commentManager';
import { CommentProvider } from './providers/commentProvider';
import { SharedCommentProvider } from './providers/sharedCommentProvider';
import { CommentTreeProvider } from './providers/commentTreeProvider';
import { SharedCommentTreeProvider } from './providers/sharedCommentTreeProvider';
import { TagManager } from './managers/tagManager';
import { FileHeatManager } from './managers/fileHeatManager';
import { BookmarkManager } from './managers/bookmarkManager';
import { BookmarkDecorationProvider } from './providers/bookmarkDecorationProvider';
import { AuthManager } from './managers/authManager';
import { ProjectManager } from './managers/projectManager';
// 核心模块导入
import { ExtensionContainer } from './core/ExtensionContainer';
import { ExtensionLifecycle } from './core/ExtensionLifecycle';

// 全局变量（供其他文件使用，向后兼容）
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

// 生命周期管理器（用于停用时清理资源）
let lifecycle: ExtensionLifecycle | undefined;

export async function activate(context: vscode.ExtensionContext) {
    // 创建扩展容器（用于统一管理组件实例）
    const container = new ExtensionContainer(context);
    
    // 创建生命周期管理器（用于统一管理激活和停用流程）
    lifecycle = new ExtensionLifecycle(container, context);
    
    // 使用生命周期管理器激活扩展
    await lifecycle.activate();
    
    // 为了向后兼容，将 container 中的组件实例赋值给全局变量，供其他文件使用
    authManager = container.authManager;
    commentManager = container.commentManager;
    commentProvider = container.commentProvider;
    sharedCommentProvider = container.sharedCommentProvider;
    fileHeatManager = container.fileHeatManager;
    bookmarkManager = container.bookmarkManager;
    bookmarkDecorationProvider = container.bookmarkDecorationProvider;
    commentTreeProvider = container.commentTreeProvider;
    sharedCommentTreeProvider = container.sharedCommentTreeProvider;
    tagManager = container.tagManager;
    projectManager = container.projectManager;
}

export function deactivate() {
    // 使用生命周期管理器停用扩展
    if (lifecycle) {
        lifecycle.deactivate();
    }
}
