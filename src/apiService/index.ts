import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosHeaders } from 'axios';
import { logger } from '../utils/logger';

interface CustomAxiosRequestConfig extends AxiosRequestConfig {
    skipAuth?: boolean;
}

const VERSION = 'v1';
const BASE_URL = `/api/${VERSION}`;

export const ApiRoutes = {
    auth: {
        login: `${BASE_URL}/auth/login`, // 用户登录
        me: `${BASE_URL}/auth/me`, // 获取用户信息
        refreshToken: '/auth/refresh-token', // 刷新token
    },
    comment: {
        uploadComments: `${BASE_URL}/comments`, // 上传注释
        importComments: `${BASE_URL}/comments/me`, // 导入注释
        getSharedComments: (comment_shared_id: string) => `${BASE_URL}/comment-shared/${comment_shared_id}`, // 获取共享注释
        sharedComments: `${BASE_URL}/comment-shared`, // 共享注释
        getProjectSharedComments: (project_id: number) => `${BASE_URL}/comment-shared/project/${project_id}`, // 获取项目共享注释
    },
    project: {
        getMyProject: `${BASE_URL}/projects/me`, // 获取当前用户所属的项目信息
    },
};

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: unknown;
}

type RequestData = object | unknown[] | string | number | boolean | null;

type ApiErrorData = {
    message?: string;
};

// 请求配置接口
export interface RequestConfig extends AxiosRequestConfig {
    skipAuth?: boolean; // 是否跳过认证
    retryCount?: number; // 重试次数
    retryDelay?: number; // 重试延迟（毫秒）
}

export class ApiService {
    private static instance: ApiService;
    private axiosInstance: AxiosInstance;
    private authManager?: import('../managers/authManager').AuthManager; // 使用具体的 AuthManager 类型

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
                if ((config as CustomAxiosRequestConfig).skipAuth) {
                    return config;
                }

                if (this.authManager && this.authManager.getAuthToken()) {
                    const token = this.authManager.getAuthToken();
                    if (!config.headers) {
                        config.headers = new AxiosHeaders();
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
                        logger.error('刷新token失败:', refreshError);
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
    public setAuthManager(authManager: import('../managers/authManager').AuthManager): void {
        this.authManager = authManager;
    }

    /**
     * 通用GET请求
     */
    public async get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'GET', url });
    }

    /**
     * 通用POST请求
     */
    public async post<T = unknown>(url: string, data?: RequestData, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'POST', url, data });
    }

    /**
     * 通用PUT请求
     */
    public async put<T = unknown>(url: string, data?: RequestData, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'PUT', url, data });
    }

    /**
     * 通用DELETE请求
     */
    public async delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'DELETE', url });
    }

    /**
     * 通用PATCH请求
     */
    public async patch<T = unknown>(url: string, data?: RequestData, config?: RequestConfig): Promise<T> {
        return this.request<T>({ ...config, method: 'PATCH', url, data });
    }

    /**
     * 核心请求方法
     */
    private async request<T = unknown>(config: RequestConfig): Promise<T> {
        const { retryCount = 0, retryDelay = 1000, ...axiosConfig } = config;
        let lastError: unknown;

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
    private handleError(error: unknown): Error {
        if (axios.isAxiosError<ApiErrorData>(error)) {
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

        return error instanceof Error
            ? new Error(`网络错误: ${error.message}`)
            : new Error('网络错误: 未知错误');
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
    logger.debug('用户信息:', user);
} catch (error) {
    logger.error('获取用户信息失败:', error.message);
}

// 2. POST请求（带认证）- 使用预定义的路由
try {
    const result = await apiService.post(ApiRoutes.comment.uploadComments, {
        content: '这是一条注释',
        filePath: '/path/to/file.ts',
        line: 10
    });
    logger.debug('创建注释成功:', result);
} catch (error) {
    logger.error('创建注释失败:', error.message);
}

// 3. 跳过认证的请求（如登录）- 使用预定义的路由
try {
    const loginResult = await apiService.post(ApiRoutes.auth.login, {
        username: 'user',
        password: 'password'
    }, { skipAuth: true });
    logger.debug('登录成功:', loginResult);
} catch (error) {
    logger.error('登录失败:', error.message);
}

// 4. 带参数的GET请求 - 使用函数式路由
try {
    const commentId = '12345';
    const sharedComments = await apiService.get(ApiRoutes.comment.getSharedComments(commentId));
    logger.debug('获取共享注释成功:', sharedComments);
} catch (error) {
    logger.error('获取共享注释失败:', error.message);
}

// 5. 带重试的请求 - 使用预定义的路由
try {
    const projects = await apiService.get(ApiRoutes.project.getMyProject, { 
        retryCount: 3, 
        retryDelay: 1000 
    });
    logger.debug('获取项目成功:', projects);
} catch (error) {
    logger.error('获取项目失败:', error.message);
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