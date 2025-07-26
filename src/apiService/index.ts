const VERSION = 'v1';
const BASE_URL = `/api/${VERSION}`;

export const ApiRoutes = {
    auth: {
        login: `${BASE_URL}/auth/login`,
        logout: '/auth/logout',
        refreshToken: '/auth/refresh-token',
        me: `${BASE_URL}/auth/me`,
    },
}; 