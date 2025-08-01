import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const VERSION = 'v1';
const BASE_URL = `/api/${VERSION}`;

export const ApiRoutes = {
    auth: {
        login: `${BASE_URL}/auth/login`, // 用户登录
        me: `${BASE_URL}/auth/me`, // 获取用户信息
        logout: '/auth/logout', // 用户退出
        refreshToken: '/auth/refresh-token', // 刷新token
    },
    comment: {
        uploadComments: `${BASE_URL}/comments`, // 上传注释
        importComments: `${BASE_URL}/comments/me`, // 导入注释
        getSharedComments: (comment_shared_id: string) => `${BASE_URL}/comment-shared/${comment_shared_id}`, // 获取共享注释
        sharedCommnets: `${BASE_URL}/comment-shared`, // 共享注释
    },
    project: {
        getMyProject: `${BASE_URL}/projects/me`, // 获取当前用户所属的项目信息
    },
};

// 请求响应接口 - 暂时注释掉，因为服务端返回格式不同
// export interface ApiResponse<T = any> {
//     success: boolean;
//     data?: T;
//     message?: string;
//     error?: any;
// }

// 请求配置接口
export interface RequestConfig extends AxiosRequestConfig {
    skipAuth?: boolean; // 是否跳过认证
    retryCount?: number; // 重试次数
    retryDelay?: number; // 重试延迟（毫秒）
}

export class ApiService {
    private static instance: ApiService;
    private axiosInstance: AxiosInstance;
    private authManager: any; // 这里应该注入AuthManager实例

    private constructor() {
        const config = vscode.workspace.getConfiguration('local-comment');
        const apiUrl = config.get<string>('server.apiUrl') || 'http://localhost:3000';

        this.axiosInstance = axios.create({
            baseURL: apiUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    /**
     * 设置请求和响应拦截器
     */
    private setupInterceptors(): void {
        // 请求拦截器 - 自动添加认证token
        this.axiosInstance.interceptors.request.use(
            (config) => {
                // 如果配置中指定跳过认证，则不添加token
                if ((config as any).skipAuth) {
                    return config;
                }

                // 从AuthManager获取token
                if (this.authManager && this.authManager.getAuthToken()) {
                    const token = this.authManager.getAuthToken();
                    // 确保headers对象存在
                    if (!config.headers) {
                        (config as any).headers = {};
                    }
                    config.headers.Authorization = `Bearer ${token}`;
                }

                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // 响应拦截器 - 统一错误处理
        this.axiosInstance.interceptors.response.use(
            (response: AxiosResponse) => {
                return response;
            },
            async (error) => {
                const originalRequest = error.config;

                // 如果是401错误且不是重试请求，尝试刷新token
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        if (this.authManager) {
                            const refreshed = await this.authManager.refreshSession();
                            if (refreshed) {
                                // 重新设置token
                                const newToken = this.authManager.getAuthToken();
                                if (newToken) {
                                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                                    return this.axiosInstance(originalRequest);
                                }
                            }
                        }
                    } catch (refreshError) {
                        console.error('刷新token失败:', refreshError);
                        // 刷新失败，清除会话
                        if (this.authManager) {
                            await this.authManager.logout();
                        }
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    /**
     * 设置AuthManager实例
     */
    public setAuthManager(authManager: any): void {
        this.authManager = authManager;
    }

    /**
     * 通用GET请求
     */
    public async get<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    /**
     * 通用POST请求
     */
    public async post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'POST', url, data });
    }

    /**
     * 通用PUT请求
     */
    public async put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'PUT', url, data });
    }

    /**
     * 通用DELETE请求
     */
    public async delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'DELETE', url });
    }

    /**
     * 通用PATCH请求
     */
    public async patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'PATCH', url, data });
    }

    /**
     * 核心请求方法
     */
    private async request<T = any>(config: RequestConfig): Promise<T> {
        const { retryCount = 0, retryDelay = 1000, ...axiosConfig } = config;
        let lastError: any;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const response = await this.axiosInstance.request<T>(axiosConfig);
                return response.data;
            } catch (error) {
                lastError = error;
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt < retryCount) {
                    await this.delay(retryDelay);
                    continue;
                }
            }
        }

        // 所有重试都失败了，抛出错误
        throw this.handleError(lastError);
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 统一错误处理
     */
    private handleError(error: any): Error {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;

            switch (status) {
                case 400:
                    return new Error(`请求参数错误: ${message}`);
                case 401:
                    return new Error('认证失败，请重新登录');
                case 403:
                    return new Error('权限不足');
                case 404:
                    return new Error('请求的资源不存在');
                case 500:
                    return new Error('服务器内部错误');
                default:
                    return new Error(`请求失败: ${message}`);
            }
        }

        return new Error(`网络错误: ${error.message}`);
    }

    /**
     * 更新API基础URL
     */
    public updateBaseURL(newBaseURL: string): void {
        this.axiosInstance.defaults.baseURL = newBaseURL;
    }
}

// 导出单例实例
export const apiService = ApiService.getInstance();

/*
使用示例：

// 1. 基本GET请求 - 使用预定义的路由
try {
    const user = await apiService.get<UserInfo>(ApiRoutes.auth.me);
    console.log('用户信息:', user);
} catch (error) {
    console.error('获取用户信息失败:', error.message);
}

// 2. POST请求（带认证）- 使用预定义的路由
try {
    const result = await apiService.post(ApiRoutes.comment.uploadComments, {
        content: '这是一条注释',
        filePath: '/path/to/file.ts',
        line: 10
    });
    console.log('创建注释成功:', result);
} catch (error) {
    console.error('创建注释失败:', error.message);
}

// 3. 跳过认证的请求（如登录）- 使用预定义的路由
try {
    const loginResult = await apiService.post(ApiRoutes.auth.login, {
        username: 'user',
        password: 'password'
    }, { skipAuth: true });
    console.log('登录成功:', loginResult);
} catch (error) {
    console.error('登录失败:', error.message);
}

// 4. 带参数的GET请求 - 使用函数式路由
try {
    const commentId = '12345';
    const sharedComments = await apiService.get(ApiRoutes.comment.getSharedComments(commentId));
    console.log('获取共享注释成功:', sharedComments);
} catch (error) {
    console.error('获取共享注释失败:', error.message);
}

// 5. 带重试的请求 - 使用预定义的路由
try {
    const projects = await apiService.get(ApiRoutes.project.getMyProject, { 
        retryCount: 3, 
        retryDelay: 1000 
    });
    console.log('获取项目成功:', projects);
} catch (error) {
    console.error('获取项目失败:', error.message);
}

特性：
- 自动添加认证token到请求头
- 自动处理401错误，尝试刷新token
- 统一的错误处理
- 支持请求重试
- 支持跳过认证的请求
- 单例模式，全局共享
- 使用预定义的API路由，避免硬编码URL
- 函数式路由支持动态参数
*/ 