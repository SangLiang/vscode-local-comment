import * as vscode from 'vscode';
import { ExtensionContainer } from '../ExtensionContainer';
import { EditorEventHandler } from './EditorEventHandler';

/**
 * 文档事件处理器 - 处理文档相关事件（变化、保存、打开）
 */
export class DocumentEventHandler {
    // 添加防抖定时器用于优化刷新频率
    private refreshTimer: NodeJS.Timeout | null = null;
    private readonly REFRESH_DEBOUNCE_DELAY = 150; // 150ms防抖延迟

    constructor(
        private container: ExtensionContainer,
        private context: vscode.ExtensionContext,
        private editorEventHandler: EditorEventHandler
    ) {}

    /**
     * 注册所有文档相关事件监听器
     * @returns 所有事件监听器的 Disposable 数组
     */
    register(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 监听文档打开
        const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(() => {
            // 文档打开时只刷新注释装饰器
            this.container.commentProvider.refresh();
            // 注释树在文档打开时不需要刷新，因为内容没有变化
        });
        disposables.push(onDidOpenTextDocument);

        // 监听文档保存事件，执行智能匹配
        const onDidSaveTextDocument = vscode.workspace.onDidSaveTextDocument((document) => {
            this.container.commentManager.handleDocumentSave(document);
        });
        disposables.push(onDidSaveTextDocument);

        // 监听文档变化
        const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
            this.handleDocumentChange(event);
        });
        disposables.push(onDidChangeTextDocument);

        return disposables;
    }

    /**
     * 处理文档变化事件
     */
    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // 文档变化时更新键盘活动时间（确保复制粘贴等操作被识别为用户活动）
        this.editorEventHandler.updateKeyboardActivity();
        
        // 只有在最近有键盘活动的情况下才更新代码快照
        const hasRecentKeyboardActivity = this.editorEventHandler.hasRecentKeyboardActivity();
        
        // 传递键盘活动信息给commentManager
        this.container.commentManager.handleDocumentChange(event, hasRecentKeyboardActivity);
        
        // 处理书签的文档变化
        this.container.bookmarkManager.handleDocumentChange(event);
        
        // 更新标签
        this.container.tagManager.updateTags(this.container.commentManager.getAllComments());
        
        // 使用防抖机制减少频繁刷新
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = setTimeout(() => {
            // 只刷新注释装饰器，不刷新注释树
            // 注释树会在注释管理器的智能更新完成后自动刷新
            this.container.commentProvider.refresh();
            this.refreshTimer = null;
        }, this.REFRESH_DEBOUNCE_DELAY);
    }

    /**
     * 清理资源
     */
    dispose(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}

