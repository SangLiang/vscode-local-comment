import * as vscode from 'vscode';
import { CommentManager } from '../managers/commentManager';
import { CommentProvider } from '../providers/commentProvider';
import { SharedCommentProvider } from '../providers/sharedCommentProvider';
import { CommentTreeProvider } from '../providers/commentTreeProvider';
import { SharedCommentTreeProvider } from '../providers/sharedCommentTreeProvider';
import { TagManager } from '../managers/tagManager';
import { FileHeatManager } from '../managers/fileHeatManager';
import { BookmarkManager } from '../managers/bookmarkManager';
import { BookmarkDecorationProvider } from '../providers/bookmarkDecorationProvider';
import { CommentCodeLensProvider } from '../providers/commentCodeLensProvider';
import { AuthManager } from '../managers/authManager';
import { ProjectManager } from '../managers/projectManager';
import { setCommentManager } from '../modules/shareCommentWebview';

/**
 * 扩展容器 - 管理所有组件实例和依赖关系
 */
export class ExtensionContainer {
    // 核心管理器
    readonly authManager: AuthManager;
    readonly commentManager: CommentManager;
    readonly bookmarkManager: BookmarkManager;
    readonly tagManager: TagManager;
    readonly fileHeatManager: FileHeatManager;
    readonly projectManager: ProjectManager;
    
    // 提供器
    readonly commentProvider: CommentProvider;
    readonly sharedCommentProvider: SharedCommentProvider;
    readonly commentTreeProvider: CommentTreeProvider;
    readonly sharedCommentTreeProvider: SharedCommentTreeProvider;
    readonly bookmarkDecorationProvider: BookmarkDecorationProvider;
    readonly commentCodeLensProvider: CommentCodeLensProvider;

    constructor(context: vscode.ExtensionContext) {
        // 初始化管理器（按依赖顺序）
        this.authManager = new AuthManager(context);
        this.commentManager = new CommentManager(context, this.authManager);
        this.fileHeatManager = new FileHeatManager(context);
        this.bookmarkManager = new BookmarkManager(context);
        this.tagManager = new TagManager();
        this.projectManager = new ProjectManager(context);

        // 初始化提供器
        this.commentProvider = new CommentProvider(this.commentManager);
        this.sharedCommentProvider = new SharedCommentProvider(this.commentManager);
        this.bookmarkDecorationProvider = new BookmarkDecorationProvider(this.bookmarkManager);
        this.commentCodeLensProvider = new CommentCodeLensProvider(this.commentManager);
        this.commentTreeProvider = new CommentTreeProvider(
            this.commentManager,
            this.fileHeatManager,
            this.bookmarkManager
        );
        this.sharedCommentTreeProvider = new SharedCommentTreeProvider(this.commentManager);

        // 设置本地注释提供器的刷新回调，以便同步更新共享注释装饰器和 CodeLens
        this.commentProvider.setRefreshCallback(() => {
            if (this.sharedCommentProvider) {
                this.sharedCommentProvider.refresh();
            }
            if (this.commentCodeLensProvider) {
                this.commentCodeLensProvider.refresh();
            }
        });

        // 设置共享注释webview的全局注释管理器引用
        setCommentManager(this.commentManager);

        // 初始化标签数据
        this.tagManager.updateTags(this.commentManager.getAllComments());
    }

    /**
     * 释放所有资源
     */
    dispose(): void {
        // 释放各个管理器
        if (this.fileHeatManager) {
            this.fileHeatManager.dispose();
        }
        
        if (this.bookmarkManager) {
            this.bookmarkManager.dispose();
        }
        
        if (this.bookmarkDecorationProvider) {
            this.bookmarkDecorationProvider.dispose();
        }
        
        if (this.commentProvider) {
            this.commentProvider.dispose();
        }
        
        if (this.sharedCommentProvider) {
            this.sharedCommentProvider.dispose();
        }
        if (this.commentCodeLensProvider) {
            this.commentCodeLensProvider.dispose();
        }
    }
}

