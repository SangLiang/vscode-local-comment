import * as vscode from 'vscode';
import { DELAY_TIMES } from '../constants';

/**
 * 编辑器工具类
 * 提供编辑器相关的工具方法
 */
export class EditorUtils {
    /**
     * 智能选择 WebView 面板的列
     * 在第一列和第二列之间切换，避免覆盖当前编辑器
     * @param activeEditor 可选的编辑器实例
     * @returns 应该在哪个列打开面板
     */
    static smartSelectViewColumn(activeEditor: vscode.TextEditor | undefined): vscode.ViewColumn {
        if (!activeEditor) {
            return vscode.ViewColumn.One;
        }
        return activeEditor.viewColumn === vscode.ViewColumn.One
            ? vscode.ViewColumn.Two
            : vscode.ViewColumn.One;
    }

    /**
     * 恢复编辑器焦点
     * @param editor 可选的编辑器实例，如果不提供则使用当前活动编辑器
     * @param delay 延迟时间（毫秒），默认为 DELAY_TIMES.RESTORE_EDITOR_FOCUS
     */
    static restoreFocus(editor?: vscode.TextEditor, delay: number = DELAY_TIMES.RESTORE_EDITOR_FOCUS): void {
        const targetEditor = editor || vscode.window.activeTextEditor;
        if (targetEditor) {
            setTimeout(() => {
                vscode.window.showTextDocument(targetEditor.document, {
                    viewColumn: targetEditor.viewColumn,
                    selection: targetEditor.selection,
                    preserveFocus: false
                }).then(() => {
                    // 确保焦点真正回到编辑器
                    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
                });
            }, delay);
        } else {
            // 如果没有编辑器，只是确保焦点回到编辑器组
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
            }, delay);
        }
    }
}
