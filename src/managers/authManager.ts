import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios, { AxiosInstance } from 'axios';
import { ApiRoutes } from '../apiService';

export interface UserInfo {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    createdAt: number;
    lastLoginAt: number;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthSession {
    token: string;
    user: UserInfo;
    expiresAt: number;
}

export class AuthManager {
    public context: vscode.ExtensionContext;
    private sessionFile: string;
    private currentSession: AuthSession | null = null;
    private isAuthenticated = false;
    private apiClient: AxiosInstance;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.sessionFile = path.join(context.globalStorageUri?.fsPath || context.extensionPath, 'auth-session.json');

        const config = vscode.workspace.getConfiguration('local-comment');
        const apiUrl = config.get<string>('server.apiUrl');

        this.apiClient = axios.create({
            baseURL: apiUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.loadSession();

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('local-comment.server.apiUrl')) {
                const newApiUrl = vscode.workspace.getConfiguration('local-comment').get<string>('server.apiUrl');
                if (this.apiClient) {
                    this.apiClient.defaults.baseURL = newApiUrl;
                    console.log(`API URL updated to: ${newApiUrl}`);
                }
            }
        });
    }

    /**
     * 加载已保存的会话
     */
    private async loadSession(): Promise<void> {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const data = fs.readFileSync(this.sessionFile, 'utf8');
                const session: AuthSession = JSON.parse(data);
                
                // 检查会话是否过期
                if (session.expiresAt > Date.now()) {
                    this.currentSession = session;
                    this.isAuthenticated = true;
                    this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${session.token}`;
                    
                    // 验证用户信息是否仍然有效
                    try {
                        const userResponse = await this.apiClient.get<UserInfo>(ApiRoutes.auth.me);
                        // 更新用户信息
                        this.currentSession.user = userResponse.data;
                        await this.saveSession(this.currentSession);
                        console.log('已加载有效会话');
                    } catch (error) {
                        console.error('验证用户信息失败:', error);
                        this.clearSession();
                    }
                } else {
                    // 会话过期，清除
                    this.clearSession();
                }
            }
        } catch (error) {
            console.error('加载会话失败:', error);
            this.clearSession();
        }
    }

    /**
     * 保存会话到本地
     */
    private async saveSession(session: AuthSession): Promise<void> {
        try {
            const storageDir = path.dirname(this.sessionFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2));
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }

    /**
     * 清除会话
     */
    private clearSession(): void {
        this.currentSession = null;
        this.isAuthenticated = false;
        delete this.apiClient.defaults.headers.common['Authorization'];
        if (fs.existsSync(this.sessionFile)) {
            fs.unlinkSync(this.sessionFile);
        }
    }

    /**
     * 用户登录
     */
    public async login(credentials: LoginCredentials): Promise<{ success: boolean; message: string; user?: UserInfo }> {
        try {
            // 调用实际的登录API
            const response = await this.apiClient.post<{ access_token: string; token_type: string }>(
                ApiRoutes.auth.login, 
                credentials,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                }
            );
            
            const { access_token, token_type } = response.data;

            // 设置认证头
            this.apiClient.defaults.headers.common['Authorization'] = `${token_type} ${access_token}`;
            
            // 获取用户信息
            const userResponse = await this.apiClient.get<UserInfo>(ApiRoutes.auth.me);
            const user = userResponse.data;

            const session: AuthSession = {
                token: access_token,
                user,
                expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 默认24小时过期
            };
            
            this.currentSession = session;
            this.isAuthenticated = true;
            await this.saveSession(session);
            
            return { success: true, message: '登录成功', user };
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                return { success: false, message: error.response.data.message || '用户名或密码错误' };
            }
            return { success: false, message: '登录失败: ' + (error as Error).message };
        }
    }



    /**
     * 用户登出
     */
    public async logout(): Promise<void> {
        try {
            // 调用登出API
            if (this.currentSession) {
                await this.apiClient.post(ApiRoutes.auth.logout);
            }
        } catch (error) {
            console.error('登出API调用失败:', error);
        } finally {
            this.clearSession();
        }
    }

    /**
     * 检查用户是否已登录
     */
    public isLoggedIn(): boolean {
        return this.isAuthenticated && this.currentSession !== null;
    }

    /**
     * 获取当前用户信息
     */
    public getCurrentUser(): UserInfo | null {
        return this.currentSession?.user || null;
    }

    /**
     * 获取认证token
     */
    public getAuthToken(): string | null {
        return this.currentSession?.token || null;
    }

    /**
     * 刷新会话
     */
    public async refreshSession(): Promise<boolean> {
        if (!this.currentSession) {
            return false;
        }

        try {
            // 调用刷新token的API
            const response = await this.apiClient.post<{ access_token: string; token_type: string }>(ApiRoutes.auth.refreshToken);
            const { access_token, token_type } = response.data;

            this.currentSession.token = access_token;
            this.currentSession.expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 默认24小时过期
            this.apiClient.defaults.headers.common['Authorization'] = `${token_type} ${access_token}`;
            
            // 更新用户信息
            try {
                const userResponse = await this.apiClient.get<UserInfo>(ApiRoutes.auth.me);
                this.currentSession.user = userResponse.data;
            } catch (error) {
                console.error('获取用户信息失败:', error);
            }
            
            await this.saveSession(this.currentSession);
            return true;
        } catch (error) {
            console.error('刷新会话失败:', error);
            await this.logout();
            return false;
        }
    }
} 