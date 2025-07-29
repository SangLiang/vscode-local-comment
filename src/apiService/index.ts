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
    },
    project: {
        getMyProject: `${BASE_URL}/projects/me`, // 获取当前用户所属的项目信息
    },
}; 