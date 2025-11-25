/**
 * 项目常量配置
 * 统一管理延迟时间、命令ID、ViewType、IPC消息等常量
 */

/**
 * 延迟时间常量（毫秒）
 * 用于统一管理各种延迟操作的时间配置
 */
export const DELAY_TIMES = {
    /**
     * 项目关联/取消关联后刷新项目列表的延迟时间
     * 用于等待前端动画完成（前端按钮状态更新300ms + CSS过渡动画200ms + 300ms缓冲）
     */
    PROJECT_REFRESH_AFTER_ANIMATION: 800,

    /**
     * 异步保存操作的延迟时间
     * 用于避免阻塞UI线程
     */
    ASYNC_SAVE: 100,

    /**
     * 刷新注释显示的延迟时间
     * 用于确保DOM更新完成后再刷新
     */
    REFRESH_COMMENTS: 10,

    /**
     * 恢复编辑器焦点的延迟时间
     * 用于WebView关闭后恢复编辑器焦点
     */
    RESTORE_EDITOR_FOCUS: 100,

    /**
     * 登录后打开用户信息界面的延迟时间
     * 用于让用户看到欢迎消息后再打开界面
     */
    SHOW_USER_INFO_AFTER_LOGIN: 300,

    /**
     * 模拟上传操作的延迟时间
     * 用于模拟网络请求延迟（仅用于开发/测试）
     */
    MOCK_UPLOAD: 1000,
} as const;

/**
 * 命令ID常量
 * 统一管理所有VS Code命令ID，避免拼写错误
 */
export const COMMANDS = {
    // 注释相关命令
    ADD_COMMENT: 'localComment.addComment',
    ADD_MARKDOWN_COMMENT: 'localComment.addMarkdownComment',
    CONVERT_SELECTION_TO_COMMENT: 'localComment.convertSelectionToComment',
    EDIT_COMMENT_FROM_HOVER: 'localComment.editCommentFromHover',
    EDIT_COMMENT_FROM_TREE: 'localComment.editCommentFromTree',
    REMOVE_COMMENT: 'localComment.removeComment',
    REMOVE_COMMENT_FROM_HOVER: 'localComment.removeCommentFromHover',
    TOGGLE_COMMENTS: 'localComment.toggleComments',
    GO_TO_COMMENT: 'localComment.goToComment',
    GO_TO_TAG_DECLARATION: 'localComment.goToTagDeclaration',
    REFRESH_COMMENTS: 'localComment.refreshComments',
    REFRESH_TREE: 'localComment.refreshTree',
    DELETE_COMMENT_FROM_TREE: 'localComment.deleteCommentFromTree',
    CLEAR_FILE_COMMENTS: 'localComment.clearFileComments',
    CLEAR_ALL_SHARED_COMMENTS: 'localComment.clearAllSharedComments',
    CLEAR_FILE_SHARED_COMMENTS: 'localComment.clearFileSharedComments',
    FUZZY_MATCH_COMMENT: 'localComment.fuzzyMatchComment',
    GO_TO_FILE: 'localComment.goToFile',
    UPDATE_COMMENT_LINE: 'localComment.updateCommentLine',
    PREVIEW_SHARED_COMMENT: 'localComment.previewSharedComment',
    
    // 书签相关命令
    ADD_BOOKMARK: 'localComment.addBookmark',
    TOGGLE_BOOKMARK: 'localComment.toggleBookmark',
    GO_TO_BOOKMARK: 'localComment.goToBookmark',
    DELETE_BOOKMARK_FROM_TREE: 'localComment.deleteBookmarkFromTree',
    CLEAR_FILE_BOOKMARKS: 'localComment.clearFileBookmarks',
    CLEAR_ALL_BOOKMARKS: 'localComment.clearAllBookmarks',
    GO_TO_NEXT_BOOKMARK: 'localComment.goToNextBookmark',
    GO_TO_PREVIOUS_BOOKMARK: 'localComment.goToPreviousBookmark',
    SHOW_CURRENT_FILE_BOOKMARKS: 'localComment.showCurrentFileBookmarks',
    
    // 存储和管理相关命令
    SHOW_STORAGE_LOCATION: 'localComment.showStorageLocation',
    SHOW_STORAGE_STATS: 'localComment.showStorageStats',
    MANAGE_PROJECTS: 'localComment.manageProjects',
    EXPORT_COMMENTS: 'localComment.exportComments',
    IMPORT_COMMENTS: 'localComment.importComments',
    
    // 认证相关命令
    LOGOUT: 'localComment.logout',
    SHOW_USER_INFO: 'localComment.showUserInfo',
    ON_USER_LOGIN: 'localComment.onUserLogin',
    ON_USER_LOGOUT: 'localComment.onUserLogout',
    
    // 共享注释相关命令
    REFRESH_SHARED_COMMENTS: 'localComment.refreshSharedComments',
    SHOW_SHARE_COMMENT: 'localComment.showShareComment',
} as const;

/**
 * Webview ViewType 常量
 * 统一管理所有Webview面板的类型标识
 */
export const VIEW_TYPES = {
    AUTH: 'localComment.auth',
    USER_INFO: 'localComment.userInfo',
    SHARE_COMMENT_PREVIEW: 'shareCommentPreview',
} as const;

/**
 * IPC 消息常量
 * 统一管理Webview与扩展之间的消息类型
 */
export const IPC_MESSAGES = {
    // 用户信息相关消息
    GET_USER_INFO: 'getUserInfo',
    GET_PROJECTS: 'getProjects',
    LOGOUT: 'logout',
    ASSOCIATE_PROJECT: 'associateProject',
    DISASSOCIATE_PROJECT: 'disassociateProject',
    FETCH_SHARED_COMMENTS: 'fetchSharedComments',
    UPLOAD_AVATAR: 'uploadAvatar',
    CLOSE: 'close',
    
    // 认证相关消息
    LOGIN: 'login',
    
    // Markdown编辑器相关消息
    SAVE: 'save',
    SAVE_AND_CONTINUE: 'saveAndContinue',
    UPDATE_SELECTED_LINE: 'updateSelectedLine',
    SHARE: 'share',
    GO_TO_TAG_DECLARATION: 'goToTagDeclaration',
    CANCEL: 'cancel',
    UPDATE_TAG_SUGGESTIONS: 'updateTagSuggestions',
    UPDATE_CODE_CONTEXT: 'updateCodeContext',
    UPDATE_CURRENT_LINE_CONTENT: 'updateCurrentLineContent',
    SET_MERMAID_THEME: 'setMermaidTheme',
    
    // 共享注释相关消息
    EXPORT_TO_LOCAL_COMMENT: 'exportToLocalComment',
    
    // 结果消息
    LOGIN_RESULT: 'loginResult',
    USER_INFO_RESULT: 'userInfoResult',
    PROJECTS_RESULT: 'projectsResult',
    ASSOCIATE_PROJECT_RESULT: 'associateProjectResult',
    DISASSOCIATE_PROJECT_RESULT: 'disassociateProjectResult',
    FETCH_SHARED_COMMENTS_RESULT: 'fetchSharedCommentsResult',
    LOGOUT_RESULT: 'logoutResult',
    UPLOAD_AVATAR_RESULT: 'uploadAvatarResult',
    SHARE_SUCCESS: 'shareSuccess',
    SHARE_ERROR: 'shareError',
} as const;

/**
 * 上下文键常量
 * 统一管理VS Code上下文变量键名
 */
export const CONTEXT_KEYS = {
    IS_LOGGED_IN: 'localComment.isLoggedIn',
    HAS_SHARED_COMMENTS: 'localComment.hasSharedComments',
} as const;

