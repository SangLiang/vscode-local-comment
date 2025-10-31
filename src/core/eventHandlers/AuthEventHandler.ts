import * as vscode from 'vscode';
import { ExtensionContainer } from '../ExtensionContainer';
import { StatusBarManager } from '../StatusBarManager';

/**
 * 认证事件处理器 - 处理认证相关事件（登录、登出、初始化）
 */
export class AuthEventHandler {
    constructor(
        private container: ExtensionContainer,
        private context: vscode.ExtensionContext,
        private statusBarManager: StatusBarManager
    ) {}

    /**
     * 注册所有认证相关事件监听器
     * @returns 所有事件监听器的 Disposable 数组
     */
    register(): vscode.Disposable[] {
        const disposables: vscode.Disposable[] = [];

        // 订阅认证管理器初始化完成事件
        this.container.authManager.onInitialized(async () => {
            console.log('✅ 认证管理器初始化完成，开始处理共享注释');
            await this.handleSharedCommentsAfterInit();
        });

        // 监听登录状态变化
        const onUserLogin = vscode.commands.registerCommand('localComment.onUserLogin', async (user: any) => {
            await this.handleUserLogin(user);
        });
        disposables.push(onUserLogin);

        const onUserLogout = vscode.commands.registerCommand('localComment.onUserLogout', async () => {
            await this.handleUserLogout();
        });
        disposables.push(onUserLogout);

        return disposables;
    }

    /**
     * 处理用户登录事件
     */
    private async handleUserLogin(user: any): Promise<void> {
        // 更新登录状态上下文变量
        vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', true);
        this.statusBarManager.updateStatusAndContext();
        vscode.window.showInformationMessage(`欢迎回来，${user.username}！`);
        
        // 用户登录后，处理共享注释（保留现有共享注释）
        try {
            await this.container.commentManager.handleSharedCommentsByAuthStatus(true);
            // 刷新注释显示
            this.container.commentProvider.refresh();
            this.container.commentTreeProvider.refresh();
            this.container.sharedCommentTreeProvider.refresh();
            this.statusBarManager.updateStatusAndContext(); // 再次更新状态以反映共享注释的变化
        } catch (error) {
            console.error('处理登录后的共享注释失败:', error);
        }
        
        // 登录成功后自动打开用户信息界面
        setTimeout(() => {
            vscode.commands.executeCommand('localComment.showUserInfo');
        }, 300); // 延迟300ms，让用户看到欢迎消息
    }

    /**
     * 处理用户登出事件
     */
    private async handleUserLogout(): Promise<void> {
        // 更新登录状态上下文变量
        vscode.commands.executeCommand('setContext', 'localComment.isLoggedIn', false);
        this.statusBarManager.updateStatusAndContext();
        vscode.window.showInformationMessage('您已成功登出');
        
        // 用户登出后，清除所有共享注释
        try {
            await this.container.commentManager.handleSharedCommentsByAuthStatus(false);
            // 刷新注释显示
            this.container.commentProvider.refresh();
            this.container.commentTreeProvider.refresh();
            this.container.sharedCommentTreeProvider.refresh();
            this.statusBarManager.updateStatusAndContext(); // 再次更新状态以反映共享注释的变化
        } catch (error) {
            console.error('处理登出后的共享注释失败:', error);
        }
    }

    /**
     * 处理认证管理器初始化完成后的共享注释处理
     */
    private async handleSharedCommentsAfterInit(): Promise<void> {
        const isLoggedIn = this.container.authManager.isLoggedIn();
        if (!isLoggedIn) {
            console.log('用户未登录，某些功能可能受限');
            // 用户未登录时，清除所有共享注释
            try {
                await this.container.commentManager.handleSharedCommentsByAuthStatus(false);
                // 刷新注释显示
                this.container.commentProvider.refresh();
                this.container.sharedCommentProvider.refresh();
                this.container.commentTreeProvider.refresh();
                this.container.sharedCommentTreeProvider.refresh();
            } catch (error) {
                console.error('清除共享注释失败:', error);
            }
        } else {
            const user = this.container.authManager.getCurrentUser();
            console.log(`用户已登录: ${user?.username}`);
            
            // 如果用户已登录，尝试自动加载共享注释
            try {
                const associatedProjectId = this.container.projectManager.getAssociatedProject();
                if (associatedProjectId) {
                    const projectId = parseInt(associatedProjectId, 10);
                    if (!isNaN(projectId)) {
                        console.log(`🔄 自动加载项目 ${projectId} 的共享注释...`);
                        const sharedComments = await this.container.commentManager.getProjectSharedComments(projectId);
                        if (sharedComments && sharedComments.length > 0) {
                            console.log(`✅ 自动加载了 ${sharedComments.length} 条共享注释`);
                            // 刷新注释显示
                            this.container.commentProvider.refresh();
                            this.container.sharedCommentProvider.refresh();
                            this.container.commentTreeProvider.refresh();
                            this.container.sharedCommentTreeProvider.refresh();
                        } else {
                            console.log('ℹ️ 项目中没有共享注释');
                        }
                    }
                } else {
                    console.log('ℹ️ 用户未关联项目，跳过自动加载共享注释');
                }
            } catch (error) {
                console.error('自动加载共享注释失败:', error);
            }
        }
    }
}

