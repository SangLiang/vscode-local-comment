import * as vscode from 'vscode';

/**
 * 对话框工具类
 * 统一管理各种对话框的显示逻辑
 */
export class DialogUtils {
    /**
     * 显示确认对话框
     * @param message 提示消息
     * @param confirmText 确认按钮文本，默认为'确定'
     * @param cancelText 取消按钮文本，默认为'取消'
     * @param options 选项
     * @param options.modal 是否模态对话框
     * @param options.onConfirm 确认后的回调函数
     * @returns 如果用户点击确认按钮返回 true，否则返回 false
     */
    static async showConfirmDialog(
        message: string,
        confirmText: string = '确定',
        cancelText: string = '取消',
        options?: { modal?: boolean; onConfirm?: () => void | Promise<void> }
    ): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            message,
            { modal: options?.modal ?? false },
            confirmText,
            cancelText
        );
        
        const confirmed = result === confirmText;
        
        // 如果用户确认且提供了回调函数，则执行回调
        if (confirmed && options?.onConfirm) {
            await options.onConfirm();
        }
        
        return confirmed;
    }

    /**
     * 显示多选对话框（信息类）
     * @param message 提示消息
     * @param choices 按钮文本列表，如 ['立即迁移', '稍后提醒', '不再提醒']
     * @param options 选项
     * @param options.modal 是否模态对话框
     * @returns 用户点击的按钮文本，若关闭或 Esc 则返回 undefined
     */
    static async showChoiceDialog<T extends string>(
        message: string,
        choices: readonly T[],
        options?: { modal?: boolean }
    ): Promise<T | undefined> {
        const result = await vscode.window.showInformationMessage(
            message,
            { modal: options?.modal ?? false },
            ...choices
        );
        return result as T | undefined;
    }
}
