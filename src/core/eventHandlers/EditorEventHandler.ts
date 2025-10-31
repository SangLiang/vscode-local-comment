import * as vscode from 'vscode';
import { ExtensionContainer } from '../ExtensionContainer';

/**
 * 编辑器事件处理器 - 处理编辑器相关事件和键盘活动跟踪
 */
export class EditorEventHandler {
    // 全局变量，用于跟踪最后一次键盘活动时间
    private lastKeyboardActivity = Date.now();
    private readonly KEYBOARD_ACTIVITY_THRESHOLD = 1000; // 1秒内有键盘活动才视为手动编辑

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
                // 编辑器切换时只刷新注释装饰器
                this.container.commentProvider.refresh();
                // 注释树在编辑器切换时不需要刷新，因为内容没有变化
            }
        });
        disposables.push(onDidChangeActiveTextEditor);

        // 添加键盘事件监听
        const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(() => {
            // 更新最后一次键盘活动时间
            this.lastKeyboardActivity = Date.now();
        });
        disposables.push(onDidChangeTextEditorSelection);

        // 添加键盘输入事件监听（更全面的键盘活动捕获）
        const onDidChangeTextEditorVisibleRanges = vscode.window.onDidChangeTextEditorVisibleRanges(() => {
            // 更新最后一次键盘活动时间
            this.lastKeyboardActivity = Date.now();
        });
        disposables.push(onDidChangeTextEditorVisibleRanges);

        return disposables;
    }

    /**
     * 获取最后一次键盘活动时间
     */
    getLastKeyboardActivity(): number {
        return this.lastKeyboardActivity;
    }

    /**
     * 更新键盘活动时间（用于文档变化时）
     */
    updateKeyboardActivity(): void {
        this.lastKeyboardActivity = Date.now();
    }

    /**
     * 检查是否有最近的键盘活动
     */
    hasRecentKeyboardActivity(): boolean {
        const now = Date.now();
        return (now - this.lastKeyboardActivity < this.KEYBOARD_ACTIVITY_THRESHOLD);
    }
}

