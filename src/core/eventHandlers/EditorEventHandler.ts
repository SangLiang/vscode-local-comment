import * as vscode from 'vscode';
import { ExtensionContainer } from '../ExtensionContainer';

/**
 * 编辑器事件处理器 - 处理编辑器相关事件
 */
export class EditorEventHandler {
    constructor(
        private container: ExtensionContainer,
        private context: vscode.ExtensionContext
    ) {}

    /**
     * 注册所有编辑器相关事件监听器
     * @returns 所有事件监听器的 Disposable 数组
     */
    register(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 监听编辑器切换事件
        const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                // 编辑器切换时刷新注释装饰器
                this.container.commentProvider.refresh();
                // 切换到的文件 document 已打开，getComments 可匹配；
                // 防抖刷新注释树，让匹配状态（图标颜色）及时更新
                this.container.commentTreeProvider.refreshDebounced();
            }
        });
        disposables.push(onDidChangeActiveTextEditor);

        return disposables;
    }
}
