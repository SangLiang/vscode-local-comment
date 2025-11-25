import * as vscode from 'vscode';
import { ExtensionContainer } from './ExtensionContainer';
import { COMMANDS, CONTEXT_KEYS } from '../constants';

/**
 * 状态栏管理器 - 管理状态栏显示和上下文变量
 */
export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        private container: ExtensionContainer,
        private context: vscode.ExtensionContext
    ) {
        // 创建状态栏项
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = COMMANDS.SHOW_USER_INFO;
    }

    /**
     * 初始化状态栏和上下文变量
     */
    initialize(): void {
        // 初始化上下文变量
        this.updateContextVariables();
        
        // 更新状态栏显示
        this.updateStatus();
        
        // 显示状态栏
        this.statusBarItem.show();
        
        // 注册到上下文订阅中
        this.context.subscriptions.push(this.statusBarItem);
    }

    /**
     * 更新状态栏显示
     */
    updateStatus(): void {
        const isLoggedIn = this.container.authManager && this.container.authManager.isLoggedIn();
        
        if (isLoggedIn) {
            const user = this.container.authManager.getCurrentUser();
            this.statusBarItem.text = `$(account) ${user?.username || '已登录'}`;
            this.statusBarItem.tooltip = '点击查看用户信息';
            this.statusBarItem.command = COMMANDS.SHOW_USER_INFO;
        } else {
            this.statusBarItem.text = '$(sign-in) 未登录';
            this.statusBarItem.tooltip = '点击登录或查看用户信息';
            this.statusBarItem.command = COMMANDS.SHOW_USER_INFO;
        }
    }

    /**
     * 更新上下文变量
     */
    updateContextVariables(): void {
        // 更新登录状态
        const isLoggedIn = this.container.authManager && this.container.authManager.isLoggedIn();
        vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_LOGGED_IN, isLoggedIn);

        // 更新共享注释状态
        const hasSharedComments = this.container.commentManager && 
            Object.values(this.container.commentManager.getAllSharedComments())
                .some(comments => comments.length > 0);
        vscode.commands.executeCommand('setContext', CONTEXT_KEYS.HAS_SHARED_COMMENTS, hasSharedComments);
    }

    /**
     * 更新状态栏和上下文变量（同时更新）
     */
    updateStatusAndContext(): void {
        this.updateContextVariables();
        this.updateStatus();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}

