import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CommentMatcher } from './commentMatcher';
import { normalizeFilePath, toAbsolutePath, normalizeFileComments, buildExportData, remapFileCommentsToWorkspace } from '../utils/utils';
import { apiService, ApiRoutes } from '../apiService';
import { AuthManager } from './authManager';
import { logger } from '../utils/logger';
import { DELAY_TIMES, COMMANDS } from '../constants';
import { StoragePathUtils, StoragePaths, StorageConfig } from '../utils/storagePathUtils';

export interface LocalComment {
    id: string;
    line: number; // 当前行号
    content: string; // 注释内容
    timestamp: number; // 时间戳
    originalLine: number; // 原始行号，用于跟踪位置变化
    lineContent: string; // 该行的内容，用于智能定位和作为代码快照
    isMatched?: boolean; // 标记注释是否匹配到代码
    isShared?: boolean; // 标记注释是否是共享的
}

export interface SharedComment extends LocalComment {
    userId: string; // 用户ID
    userAvatar?: string; // 用户头像URL
    username?: string; // 用户名
}

// 项目共享注释的接口 
export interface ProjectSharedComment {
    content: LocalComment; // 注释内容 - 使用 LocalComment 类型
    file_path: string; // 文件路径
    project_id: number; // 项目ID
    is_public: boolean; // 是否公开
    id: number; // 注释ID
    user_id: number; // 用户ID
    user_avatar?: string; // 用户头像URL
    username?: string; // 用户名
    created_at: string; // 创建时间
    updated_at: string; // 更新时间
}

export interface FileComments {
    [filePath: string]: (LocalComment | SharedComment)[];
}

export class CommentManager {
    private comments: FileComments = {};
    private shareComments: FileComments = {};
    private storageFile: string;
    private context: vscode.ExtensionContext;
    private authManager?: AuthManager; // 认证管理器
    private _hasKeyboardActivity = false; // 记录键盘活动状态，用于区分用户编辑和Git分支切换
    private commentMatcher: CommentMatcher; // 注释匹配器
    
    // 事件发射器，用于通知注释变化
    private _onDidChangeComments: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeComments: vscode.Event<void> = this._onDidChangeComments.event;

    // 事件发射器，用于通知共享注释变化
    private _onDidChangeSharedComments: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeSharedComments: vscode.Event<void> = this._onDidChangeSharedComments.event;

    constructor(context: vscode.ExtensionContext, authManager?: AuthManager) {
        this.context = context;
        this.authManager = authManager;
        this.storageFile = this.getProjectStorageFile(context);
        this.commentMatcher = new CommentMatcher(); // 实例化注释匹配器
        this.loadComments();

        // 监听配置变更
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('local-comment.storage.commentsConfig')) {
                this.loadComments().catch(error => {
                    logger.error('配置变更后重新加载失败:', error);
                });
                logger.info('注释配置文件已切换');
            }
        });
        context.subscriptions.push(configWatcher);
        
        // 监听工作区变化，重新加载注释数据
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.handleWorkspaceChange();
        });
        
        context.subscriptions.push(workspaceWatcher);
    }

    /**
     * 查找注释在数组中的索引
     * @param comments 注释数组
     * @param commentId 注释ID
     * @returns 注释的索引，如果未找到则返回-1
     */
    public findCommentIndex(comments: (LocalComment | SharedComment)[], commentId: string): number {
        return comments.findIndex(c => c.id === commentId);
    }

    /**
     * 获取指定行号的本地注释
     * @param filePath 文件路径
     * @param line 行号
     * @returns 本地注释对象，如果未找到则返回undefined
     */
    public getLocalCommentAtLine(filePath: string, line: number): LocalComment | undefined {
        const fileComments = this.comments[filePath];
        if (!fileComments) {
            return undefined;
        }
        
        // 查找指定行的本地注释（排除共享注释）
        return fileComments.find(c => c.line === line && !('userId' in c)) as LocalComment | undefined;
    }

    /**
     * 处理工作区变化
     */
    private async handleWorkspaceChange(): Promise<void> {
        // 保存当前注释数据
        await this.saveComments();
        
        // 更新存储文件路径
        this.storageFile = this.getProjectStorageFile(this.context);
        
        // 重新加载新工作区的注释数据
        await this.loadComments();
        
        logger.info('工作区已切换，注释数据已重新加载');
    }

    /**
     * 根据当前工作区生成项目特定的存储文件路径（当前选择的注释配置文件）
     */
    private getProjectStorageFile(context: vscode.ExtensionContext): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const paths = StoragePathUtils.getStoragePaths(context, workspacePath);
            const currentFile = StoragePathUtils.getCurrentCommentsFile(paths, workspacePath);
            return currentFile || (context.globalStorageUri?.fsPath || context.extensionPath) + path.sep + 'local-comments.json';
        }
        const globalStorageDir = context.globalStorageUri?.fsPath || context.extensionPath;
        return path.join(globalStorageDir, 'local-comments.json');
    }

    private async loadComments(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                await this.loadCommentsFromPath(this.storageFile);
                return;
            }

            const workspacePath = workspaceFolders[0].uri.fsPath;
            const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);

            try {
                StoragePathUtils.ensureNewPathExists(paths);
            } catch (err) {
                if (StoragePathUtils.isWritePermissionError(err)) {
                    logger.warn('无法创建新路径目录（只读或权限不足），使用旧路径', err);
                } else {
                    throw err;
                }
            }

            const currentCommentsFile = StoragePathUtils.getCurrentCommentsFile(paths, workspacePath);

            if (currentCommentsFile) {
                try {
                    await this.loadCommentsFromPath(currentCommentsFile);
                    await this.checkAndPromptMigration(paths);
                } catch (error) {
                    return;
                }
            } else if (StoragePathUtils.fileExists(paths.oldCommentsFile)) {
                await this.loadCommentsFromPath(paths.oldCommentsFile);
            } else {
                // 新项目目录：直接创建项目下的默认配置文件，不弹窗
                try {
                    StoragePathUtils.ensureNewPathExists(paths);
                    const defaultFile = path.join(paths.commentsDir, 'comments.json');
                    const defaultData = { comments: {}, shareComments: {} };
                    fs.writeFileSync(defaultFile, JSON.stringify(defaultData, null, 2));
                    const config = StoragePathUtils.loadConfig(workspacePath);
                    config.comments = 'comments.json';
                    await StoragePathUtils.saveConfig(config);
                } catch (err) {
                    if (StoragePathUtils.isWritePermissionError(err)) {
                        logger.warn('无法创建默认配置（只读或权限不足）', err);
                    } else {
                        throw err;
                    }
                }
                this.comments = {};
                this.shareComments = {};
            }
        } catch (error) {
            logger.error('加载注释失败:', error);
            this.comments = {};
            this.shareComments = {};
        }
    }

    private async loadCommentsFromPath(filePath: string): Promise<void> {
        const storageDir = path.dirname(filePath);
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }

        if (fs.existsSync(filePath)) {
            try {
                const data = fs.readFileSync(filePath, 'utf8');
                const parsedData = JSON.parse(data);

                if (typeof parsedData !== 'object' || parsedData === null) {
                    throw new Error('配置文件格式错误：根对象必须是对象类型');
                }

                if (parsedData.comments && parsedData.shareComments) {
                    this.comments = parsedData.comments;
                    this.shareComments = parsedData.shareComments;
                } else if (parsedData.comments || Object.keys(parsedData).length > 0) {
                    this.comments = parsedData.comments || parsedData;
                    this.shareComments = parsedData.shareComments || {};
                } else {
                    this.comments = {};
                    this.shareComments = {};
                }
                // 将存储中的路径重映射到当前工作区，解决拷贝 .vscode 到另一台电脑后无法跳转的问题
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const workspacePath = workspaceFolder.uri.fsPath;
                    this.comments = remapFileCommentsToWorkspace(this.comments, workspacePath);
                    this.shareComments = remapFileCommentsToWorkspace(this.shareComments, workspacePath);
                }
            } catch (parseError) {
                logger.error('配置文件格式错误:', parseError);
                const errorMessage = `配置文件格式错误: ${filePath}\n请检查文件是否为有效的 JSON 格式。`;
                vscode.window.showErrorMessage(errorMessage, '打开文件').then(choice => {
                    if (choice === '打开文件') {
                        vscode.workspace.openTextDocument(filePath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
                this.comments = {};
                this.shareComments = {};
                throw parseError;
            }
        } else {
            this.comments = {};
            this.shareComments = {};
        }
    }

    private async migrateToNewPath(paths: StoragePaths, workspacePath: string): Promise<void> {
        try {
            StoragePathUtils.ensureNewPathExists(paths);
            if (StoragePathUtils.fileExists(paths.oldCommentsFile)) {
                const oldData = fs.readFileSync(paths.oldCommentsFile, 'utf8');
                const defaultCommentsFile = path.join(paths.commentsDir, 'comments.json');
                fs.writeFileSync(defaultCommentsFile, oldData);
                const currentConfig = StoragePathUtils.loadConfig(workspacePath);
                const config: StorageConfig = {
                    comments: 'comments.json',
                    bookmarks: currentConfig.bookmarks || 'bookmarks.json'
                };
                await StoragePathUtils.saveConfig(config);
                this.comments = {};
                this.shareComments = {};
                await this.loadCommentsFromPath(defaultCommentsFile);
                logger.info('注释数据已迁移到默认配置文件: comments.json');
            }
        } catch (error) {
            if (StoragePathUtils.isWritePermissionError(error)) {
                vscode.window.showErrorMessage('迁移失败：无法写入 .vscode/local-comment（只读或权限不足）');
            } else {
                logger.error('迁移注释数据失败:', error);
                vscode.window.showErrorMessage('迁移注释数据失败，请手动迁移');
            }
        }
    }

    private async checkAndPromptMigration(paths: StoragePaths): Promise<void> {
        if (StoragePathUtils.fileExists(paths.oldCommentsFile)) {
            const migrationKey = `migration_checked_${paths.oldCommentsFile}`;
            const alreadyChecked = this.context.globalState.get<boolean>(migrationKey, false);
            if (!alreadyChecked) {
                logger.info('检测到旧路径仍有数据，新路径数据已优先使用');
                this.context.globalState.update(migrationKey, true);
            }
        }
    }

    /**
     * 公开的迁移方法，供命令调用
     */
    public async migrateOldData(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('没有打开的工作区');
            return;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);
        await this.migrateToNewPath(paths, workspacePath);
    }

    private async saveComments(): Promise<void> {
        try {
            const dataToSave = {
                comments: this.comments,
                shareComments: this.shareComments
            };

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);

                try {
                    StoragePathUtils.ensureNewPathExists(paths);
                } catch (err) {
                    if (StoragePathUtils.isWritePermissionError(err)) {
                        if (StoragePathUtils.fileExists(paths.oldCommentsFile)) {
                            fs.writeFileSync(paths.oldCommentsFile, JSON.stringify(dataToSave, null, 2));
                        } else {
                            vscode.window.showErrorMessage('无法写入项目目录（只读或权限不足），请检查 .vscode 目录权限');
                        }
                        this._onDidChangeComments.fire();
                        this._onDidChangeSharedComments.fire();
                        return;
                    }
                    throw err;
                }

                const currentCommentsFile = StoragePathUtils.getCurrentCommentsFile(paths, workspacePath);

                if (currentCommentsFile) {
                    try {
                        fs.writeFileSync(currentCommentsFile, JSON.stringify(dataToSave, null, 2));
                    } catch (err) {
                        if (StoragePathUtils.isWritePermissionError(err) && StoragePathUtils.fileExists(paths.oldCommentsFile)) {
                            fs.writeFileSync(paths.oldCommentsFile, JSON.stringify(dataToSave, null, 2));
                        } else {
                            throw err;
                        }
                    }
                } else if (StoragePathUtils.fileExists(paths.oldCommentsFile)) {
                    fs.writeFileSync(paths.oldCommentsFile, JSON.stringify(dataToSave, null, 2));
                } else {
                    const defaultFile = path.join(paths.commentsDir, 'comments.json');
                    fs.writeFileSync(defaultFile, JSON.stringify(dataToSave, null, 2));
                    const config = StoragePathUtils.loadConfig(workspacePath);
                    config.comments = 'comments.json';
                    await StoragePathUtils.saveConfig(config);
                }
            } else {
                const storageDir = path.dirname(this.storageFile);
                if (!fs.existsSync(storageDir)) {
                    fs.mkdirSync(storageDir, { recursive: true });
                }
                fs.writeFileSync(this.storageFile, JSON.stringify(dataToSave, null, 2));
            }

            this.storageFile = this.getProjectStorageFile(this.context);
            this._onDidChangeComments.fire();
            this._onDidChangeSharedComments.fire();
        } catch (error) {
            logger.error('保存注释失败:', error);
        }
    }

    public async addComment(uri: vscode.Uri, line: number, content: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            this.comments[filePath] = [];
        }

        // 获取当前行的内容用于智能定位
        const document = await vscode.workspace.openTextDocument(uri);
        const lineContent = document.lineAt(line).text;

        const comment: LocalComment = {
            id: this.generateId(),
            line: line,
            content: content,
            timestamp: Date.now(),
            originalLine: line,
            lineContent: lineContent.trim(),
            isShared: false
        };

        // 检查是否已存在该行的本地注释，如果存在则替换
        const existingLocalIndex = this.comments[filePath].findIndex(c => 
            c.line === line && !('userId' in c) // 只检查本地注释
        );
        
        if (existingLocalIndex >= 0) {
            // 替换现有的本地注释
            this.comments[filePath][existingLocalIndex] = comment;
        } else {
            // 检查是否有共享注释在同一行
            const allSharedComments = this.shareComments[filePath] || [];
            const existingSharedComments = allSharedComments.filter((comment): comment is SharedComment => 
                'userId' in comment && comment.line === line
            );
            
            if (existingSharedComments.length > 0) {
            }
            
            // 添加新的本地注释
            this.comments[filePath].push(comment);
        }

        await this.saveComments();
    }

    public async editComment(uri: vscode.Uri, commentId: string, newContent: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        const commentIndex = this.findCommentIndex(this.comments[filePath], commentId);
        if (commentIndex === -1) {
            vscode.window.showWarningMessage('找不到指定的注释');
            return;
        }

        this.comments[filePath][commentIndex].content = newContent;
        this.comments[filePath][commentIndex].timestamp = Date.now(); // 更新时间戳

        await this.saveComments();
    }

    /**
     * 更新注释的行号和相关内容
     * 
     * 当文件内容发生变化（如插入、删除行）导致注释原本所在的行号发生变化时，
     * 此函数可以重新定位注释到新的行号，确保注释与代码行的对应关系保持同步。
     * 
     * @param uri - 文件URI，指定要更新注释的文件
     * @param commentId - 注释的唯一标识符
     * @param newLine - 新的行号（从0开始计数）
     * @param newLineContent - 新行号对应的行内容
     * @returns Promise<void> - 异步操作完成
     * 
     * @example
     * // 将注释从第5行移动到第8行
     * await commentManager.updateCommentLine(
     *     fileUri, 
     *     'comment-123', 
     *     7, // 第8行（从0开始计数）
     *     'const newCode = "example";'
     * );
     */
    public async updateCommentLine(uri: vscode.Uri, commentId: string, newLine: number, newLineContent: string): Promise<void> {
        const filePath = uri.fsPath;
        
        // 检查文件是否存在本地注释
        if (!this.comments[filePath]) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        // 根据注释ID查找注释在数组中的索引
        const commentIndex = this.findCommentIndex(this.comments[filePath], commentId);
        if (commentIndex === -1) {
            vscode.window.showWarningMessage('找不到指定的注释');
            return;
        }

        // 更新注释的行号、行内容和时间戳
        this.comments[filePath][commentIndex].line = newLine;
        this.comments[filePath][commentIndex].lineContent = newLineContent;
        this.comments[filePath][commentIndex].timestamp = Date.now(); // 更新时间戳

        // 将更新后的注释保存到持久化存储
        await this.saveComments();
    }

    public getCommentById(uri: vscode.Uri, commentId: string): LocalComment | undefined {
        const filePath = uri.fsPath;
        const fileComments = this.comments[filePath];
        
        if (!fileComments) {
            return undefined;
        }

        return fileComments.find(c => c.id === commentId);
    }

    public async removeComment(uri: vscode.Uri, line: number): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        // 只删除本地注释，保留共享注释
        const initialLength = this.comments[filePath].length;
        this.comments[filePath] = this.comments[filePath].filter(c => 
            !(c.line === line && !('userId' in c)) // 只过滤掉本地注释
        );

        if (this.comments[filePath].length === initialLength) {
            vscode.window.showWarningMessage(`第 ${line + 1} 行没有本地注释`);
            return;
        }

        // 如果该文件没有注释了，删除该文件的记录
        if (this.comments[filePath].length === 0) {
            delete this.comments[filePath];
        }

        await this.saveComments();
    }

    public async removeCommentById(uri: vscode.Uri, commentId: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        const commentToRemove = this.comments[filePath].find(c => c.id === commentId);
        
        if (!commentToRemove) {
            vscode.window.showWarningMessage('找不到指定的注释');
            return;
        }

        this.comments[filePath] = this.comments[filePath].filter(c => c.id !== commentId);

        // 如果该文件没有注释了，删除该文件的记录
        if (this.comments[filePath].length === 0) {
            delete this.comments[filePath];
        }

        await this.saveComments();
    }

    public async clearFileComments(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath] || this.comments[filePath].length === 0) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        const commentCount = this.comments[filePath].length;
        
        // 删除该文件的所有注释记录
        delete this.comments[filePath];

        await this.saveComments();
        // vscode.window.showInformationMessage(`已清除该文件的所有本地注释，共删除 ${commentCount} 条注释`);
    }

    /**
     * 清空所有共享注释
     * @returns 清空的共享注释数量
     */
    public async clearAllSharedComments(): Promise<number> {
        let totalRemoved = 0;

        // 遍历所有文件，移除共享注释
        for (const [filePath, allComments] of Object.entries(this.shareComments)) {
            if (!Array.isArray(allComments)) continue;

            // 过滤出只有SharedComment类型的数据
            const sharedComments = allComments.filter((comment): comment is SharedComment => 
                'userId' in comment
            );

            totalRemoved += sharedComments.length;
        }

        // 清空所有共享注释
        this.shareComments = {};

        if (totalRemoved > 0) {
            await this.saveComments();
            this._onDidChangeSharedComments.fire(); // 触发共享注释变化事件
            vscode.window.showInformationMessage(`已清空所有共享注释，共删除 ${totalRemoved} 条共享注释`);
        } else {
            // 只有登录用户才显示"没有找到共享注释"提示
            if (this.authManager && this.authManager.isLoggedIn()) {
                vscode.window.showInformationMessage('没有找到共享注释');
            }
        }

        return totalRemoved;
    }

    /**
     * 根据登录状态处理共享注释
     * 当用户未登录时，清除所有共享注释
     * @param isLoggedIn 用户是否已登录
     */
    public async handleSharedCommentsByAuthStatus(isLoggedIn: boolean): Promise<void> {
        if (!isLoggedIn) {
            await this.clearAllSharedComments();
        } 
    }

    /**
     * 清空指定文件的共享注释
     * @param uri 文件URI
     * @returns 清空的共享注释数量
     */
    public async clearFileSharedComments(uri: vscode.Uri): Promise<number> {
        const filePath = uri.fsPath;
        
        const allComments = this.shareComments[filePath] || [];
        // 过滤出只有SharedComment类型的数据
        const sharedComments = allComments.filter((comment): comment is SharedComment => 
            'userId' in comment
        );
        
        if (sharedComments.length === 0) {
            vscode.window.showWarningMessage('该文件没有共享注释');
            return 0;
        }

        const removedCount = sharedComments.length;

        // 删除该文件的共享注释
        delete this.shareComments[filePath];

        await this.saveComments();
        vscode.window.showInformationMessage(`已清空文件的所有共享注释，共删除 ${removedCount} 条共享注释`);
        
        return removedCount;
    }

    /**
     * 获取指定文件中所有可以匹配到代码的注释
     * 
     * 该方法会重新扫描文件内容，重新计算每个注释的匹配状态。
     * 与getAllComments不同，这个方法只返回当前能够匹配到代码的注释。
     * 用于确保注释树视图(CommentTreeView)能正确显示注释的匹配状态。
     * 
     * @param uri - VSCode的Uri对象，指向要获取注释的文件
     * @returns 返回文件中所有能够匹配到代码的注释数组
     * 
     * @example
     * const uri = vscode.Uri.file(filePath);
     * const matchedComments = commentManager.getComments(uri);
     * // matchedComments只包含能够匹配到当前代码的注释
     */
    public getComments(uri: vscode.Uri): (LocalComment | SharedComment)[] {
        const filePath = uri.fsPath;
        const localComments = this.comments[filePath] || [];
        
        // 从shareComments中过滤出只有SharedComment类型的数据
        const allSharedComments = this.shareComments[filePath] || [];
        const sharedComments = allSharedComments.filter((comment): comment is SharedComment => 
            'userId' in comment
        );
        
        // 合并本地注释和共享注释
        const allComments = [...localComments, ...sharedComments];

        // 获取当前文档内容进行智能匹配
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
        if (!document) {
            // 如果文档未打开，返回空数组（暂时隐藏注释）
            return [];
        }

        // 检查第一行是否有注释，如果没有则创建默认的文件注释
        const hasFirstLineComment = allComments.some(comment => comment.line === 0);

        if (allComments.length === 0) {
            return [];
        }

        // 文件首次加载场景：使用支持全文搜索的批量匹配功能
        logger.debug(`🔍 文件首次加载场景，使用全文搜索进行智能匹配 (本地: ${localComments.length}, 共享: ${sharedComments.length})`);
        const matchResults = this.commentMatcher.batchMatchCommentsWithFullSearch(document, allComments);
        
        const matchedComments: (LocalComment | SharedComment)[] = [];
        let needsSave = false;

        for (const comment of allComments) {
            // 对于默认文件注释（第一行），直接添加到匹配结果中
            if (comment.line === 0) {
                matchedComments.push(comment);
                continue;
            }

            const matchedLine = matchResults.get(comment.id) ?? -1;
            
            if (matchedLine !== -1) {
                // 记录匹配状态为true
                comment.isMatched = true;
                
                // 创建一个新的注释对象，更新行号但保持原有信息
                let matchedComment: LocalComment | SharedComment;
                
                // 检查是否为共享注释，保持类型信息
                if ('userId' in comment) {
                    const sharedComment = comment as SharedComment;
                    matchedComment = {
                        ...sharedComment,
                        line: matchedLine,
                        isMatched: true // 确保复制的对象也有匹配状态
                    } as SharedComment;
                    
                } else {
                    matchedComment = {
                        ...comment,
                        line: matchedLine,
                        isMatched: true // 确保复制的对象也有匹配状态
                    };
                }
                matchedComments.push(matchedComment);
                
                // 如果位置发生了变化，更新存储的注释
                if (comment.line !== matchedLine) {
                    comment.line = matchedLine;
                    needsSave = true;
                }
            } else {
                // 标记为未匹配
                comment.isMatched = false;
            }
        }

        // 如果有位置更新，保存到文件
        if (needsSave) {
            this.saveCommentsAsync();
        }

        return matchedComments;
    }

    public async handleDocumentChange(event: vscode.TextDocumentChangeEvent, hasRecentKeyboardActivity: boolean = true): Promise<void> {
        const filePath = event.document.uri.fsPath;
        const fileComments = this.comments[filePath];
        
        if (!fileComments || fileComments.length === 0) {
            return;
        }

        // 记录键盘活动状态
        this._hasKeyboardActivity = hasRecentKeyboardActivity;

        // 如果没有键盘活动，可能是Git分支切换，需要立即执行智能匹配
        if (!hasRecentKeyboardActivity) {
            logger.debug('⚠️ 检测到Git分支切换，立即执行智能匹配');
            await this.performSmartMatchingForFile(event.document);
            
            // 刷新注释显示
            setTimeout(() => {
                vscode.commands.executeCommand(COMMANDS.REFRESH_COMMENTS);
            }, DELAY_TIMES.REFRESH_COMMENTS);
            return;
        }

        // 检测是否为多行变化或大块操作
        let isMultiLineChange = false;
        let totalLinesChanged = 0;
        let affectedLineCount = 0;
        
        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesSpanned = endLine - startLine;
            
            // 检测多行变化的条件：
            // 1. 跨越多行的变化（起始行和结束行不同）
            // 2. 插入的内容包含换行符
            // 3. 单次变化影响的行数超过阈值
            const newLineCount = (change.text.match(/\n/g) || []).length;
            
            if (linesSpanned > 0 || newLineCount > 0 || change.text.length > 100) {
                isMultiLineChange = true;
                totalLinesChanged += Math.max(linesSpanned, newLineCount);
                affectedLineCount += linesSpanned + newLineCount + 1;
            }
        }

        // 如果检测到多行变化（复制粘贴大块代码），立即执行智能匹配
        if (isMultiLineChange) {
            logger.debug(`🔄 检测到多行变化操作 (影响${affectedLineCount}行，变化${totalLinesChanged}行)，立即执行扩展范围智能匹配`);
            await this.performSmartMatchingForFileWithExtendedRange(event.document);
            
            // 刷新注释显示
            setTimeout(() => {
                vscode.commands.executeCommand(COMMANDS.REFRESH_COMMENTS);
            }, DELAY_TIMES.REFRESH_COMMENTS);
            return;
        }

        // 如果是单行编辑，只检查是否直接编辑了有注释的行
        let hasDirectLineEdit = false;
        let directUpdates = 0;
        
        for (const change of event.contentChanges) {
            const changedLine = change.range.start.line;
            
            // 查找这一行是否有注释
            const commentOnLine = fileComments.find(comment => comment.line === changedLine);
            if (commentOnLine) {
                try {
                    const currentLineContent = event.document.lineAt(changedLine).text.trim();
                    if (currentLineContent !== (commentOnLine.lineContent || '').trim()) {
                        commentOnLine.lineContent = currentLineContent;
                        directUpdates++;
                        hasDirectLineEdit = true;
                    }
                } catch (error) {
                    logger.warn(`⚠️ 更新注释内容快照失败:`, error);
                }
            }
        }

        // 如果有直接编辑，保存更改
        if (hasDirectLineEdit) {
            await this.saveComments();
            logger.debug(`✅ 直接更新完成，共更新 ${directUpdates} 个注释`);
        }
    }

    /**
     * 处理文档保存事件，执行智能匹配更新注释位置
     */
    public async handleDocumentSave(document: vscode.TextDocument): Promise<void> {
        const filePath = document.uri.fsPath;
        const fileComments = this.comments[filePath];
        
        if (!fileComments || fileComments.length === 0) {
            return;
        }

        logger.debug(`💾 文件保存，开始智能匹配更新注释位置: ${path.basename(filePath)}`);
        
        // 执行智能匹配
        let fileUpdates = 0;
        
        // 文件保存场景：使用常规匹配，确保不会有多个注释匹配到同一行
        const matchResults = this.commentMatcher.batchMatchComments(document, fileComments);
        
        for (const comment of fileComments) {
            const matchedLine = matchResults.get(comment.id) ?? -1;
            
            if (matchedLine !== -1) {
                // 注释找到了匹配位置，检查是否需要更新
                try {
                    const currentLineContent = document.lineAt(matchedLine).text.trim();
                    const storedLineContent = (comment.lineContent || '').trim();
                    
                    // 更新行号和代码快照
                    if (currentLineContent !== storedLineContent && currentLineContent.length > 0) {
                        comment.lineContent = currentLineContent;
                        comment.line = matchedLine;
                        fileUpdates++;
                    } else if (comment.line !== matchedLine) {
                        // 只是位置变化，代码内容没变
                        comment.line = matchedLine;
                        fileUpdates++;
                    }
                } catch (error) {
                    logger.warn(`⚠️ 无法更新注释 ${comment.id}:`, error);
                }
            }
        }
        
        if (fileUpdates > 0) {
            await this.saveComments();
            logger.debug(`✅ 智能匹配完成，更新了 ${fileUpdates} 个注释`);
        } else {
            logger.debug(`✅ 智能匹配完成，注释位置无需更新`);
        }
        
                // 更新完成后刷新注释树显示
        setTimeout(() => {
            vscode.commands.executeCommand(COMMANDS.REFRESH_COMMENTS);
        }, 10);
    }

    /**
     * 为单个文件执行智能匹配（用于Git分支切换等场景）
     */
    private async performSmartMatchingForFile(document: vscode.TextDocument): Promise<void> {
        const filePath = document.uri.fsPath;
        const fileComments = this.comments[filePath];
        
        if (!fileComments || fileComments.length === 0) {
            return;
        }

        let fileUpdates = 0;
        
        // Git分支切换场景：使用支持全文搜索的批量匹配功能
        logger.debug(`🔍 Git分支切换场景，使用全文搜索进行智能匹配`);
        const matchResults = this.commentMatcher.batchMatchCommentsWithFullSearch(document, fileComments);
        
        for (const comment of fileComments) {
            const matchedLine = matchResults.get(comment.id) ?? -1;
            
            if (matchedLine !== -1) {
                // 注释找到了匹配位置，检查是否需要更新
                try {
                    const currentLineContent = document.lineAt(matchedLine).text.trim();
                    const storedLineContent = (comment.lineContent || '').trim();
                    
                    // 更新行号和代码快照
                    if (currentLineContent !== storedLineContent && currentLineContent.length > 0) {
                        comment.lineContent = currentLineContent;
                        comment.line = matchedLine;
                        fileUpdates++;
                    } else if (comment.line !== matchedLine) {
                        // 只是位置变化，代码内容没变
                        comment.line = matchedLine;
                        fileUpdates++;
                    }
                } catch (error) {
                    logger.warn(`⚠️ Git分支切换时无法更新注释 ${comment.id}:`, error);
                }
            }
        }
        
        if (fileUpdates > 0) {
            await this.saveComments();
            logger.debug(`✅ Git分支切换智能匹配完成，更新了 ${fileUpdates} 个注释`);
        } else {
            logger.debug(`✅ Git分支切换智能匹配完成，注释位置无需更新`);
        }
    }

    /**
     * 为单个文件执行智能匹配（专门用于大块代码插入场景，使用扩展搜索范围）
     */
    private async performSmartMatchingForFileWithExtendedRange(document: vscode.TextDocument): Promise<void> {
        const filePath = document.uri.fsPath;
        const fileComments = this.comments[filePath];
        
        if (!fileComments || fileComments.length === 0) {
            return;
        }

        let fileUpdates = 0;
        
        // 使用专门的大块变化匹配功能，使用扩展搜索范围
        const matchResults = this.commentMatcher.batchMatchCommentsForLargeChanges(document, fileComments);
        
        for (const comment of fileComments) {
            const matchedLine = matchResults.get(comment.id) ?? -1;
            
            if (matchedLine !== -1) {
                // 注释找到了匹配位置，检查是否需要更新
                try {
                    const currentLineContent = document.lineAt(matchedLine).text.trim();
                    const storedLineContent = (comment.lineContent || '').trim();
                    
                    // 更新行号和代码快照
                    if (currentLineContent !== storedLineContent && currentLineContent.length > 0) {
                        comment.lineContent = currentLineContent;
                        comment.line = matchedLine;
                        fileUpdates++;
                    } else if (comment.line !== matchedLine) {
                        // 只是位置变化，代码内容没变
                        comment.line = matchedLine;
                        fileUpdates++;
                    }
                } catch (error) {
                    logger.warn(`⚠️ 大块代码变化时无法更新注释 ${comment.id}:`, error);
                }
            }
        }
        
        if (fileUpdates > 0) {
            await this.saveComments();
            logger.debug(`✅ 大块代码变化智能匹配完成，更新了 ${fileUpdates} 个注释`);
        } else {
            logger.debug(`✅ 大块代码变化智能匹配完成，注释位置无需更新`);
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    public getAllComments(): FileComments {
        // 合并本地注释和共享注释
        const allComments: FileComments = {};
        
        // 获取所有文件路径（本地注释和共享注释的并集）
        const allFilePaths = new Set([
            ...Object.keys(this.comments),
            ...Object.keys(this.shareComments)
        ]);
        
        for (const filePath of allFilePaths) {
            const localComments = this.comments[filePath] || [];
            
            // 从shareComments中过滤出只有SharedComment类型的数据
            const allSharedComments = this.shareComments[filePath] || [];
            const sharedComments = allSharedComments.filter((comment): comment is SharedComment => 
                'userId' in comment
            );
            
            allComments[filePath] = [...localComments, ...sharedComments];
        }
        
        return allComments;
    }

    /**
     * 获取所有共享注释
     */
    public getAllSharedComments(): { [filePath: string]: SharedComment[] } {
        // 确保只返回SharedComment类型的数据
        const result: { [filePath: string]: SharedComment[] } = {};
        
        for (const [filePath, comments] of Object.entries(this.shareComments)) {
            // 过滤出只有SharedComment类型的数据
            const sharedComments = comments.filter((comment): comment is SharedComment => 
                'userId' in comment
            );
            
            if (sharedComments.length > 0) {
                result[filePath] = sharedComments;
            }
        }
        
        return result;
    }

    public getStorageFilePath(): string {
        return this.storageFile;
    }

    /**
     * 获取当前项目信息
     */
    public getProjectInfo(): { name: string; path: string; storageFile: string } {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const projectName = path.basename(workspacePath);
            return {
                name: projectName,
                path: workspacePath,
                storageFile: this.storageFile
            };
        } else {
            return {
                name: '未知项目',
                path: '无工作区',
                storageFile: this.storageFile
            };
        }
    }

    /**
     * 获取扩展上下文
     */
    public getContext(): vscode.ExtensionContext {
        return this.context;
    }

    /**
     * 切换到指定的注释配置文件
     */
    public async switchCommentsConfig(configFileName: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('没有打开的工作区');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);
        const configFile = path.join(paths.commentsDir, configFileName);

        if (!StoragePathUtils.fileExists(configFile)) {
            const choice = await vscode.window.showWarningMessage(
                `配置文件不存在: ${configFileName}\n是否创建新的配置文件？`,
                '创建',
                '取消'
            );
            if (choice === '创建') {
                StoragePathUtils.ensureNewPathExists(paths);
                const defaultData = { comments: {}, shareComments: {} };
                fs.writeFileSync(configFile, JSON.stringify(defaultData, null, 2));
            } else {
                return;
            }
        }

        await this.saveComments();
        const config = StoragePathUtils.loadConfig(workspacePath);
        config.comments = configFileName;
        await StoragePathUtils.saveConfig(config);
        await this.loadComments();
        vscode.window.showInformationMessage(`已切换到注释配置: ${configFileName}`);
    }

    /**
     * 列出所有可用的注释配置文件
     */
    public listAvailableCommentsConfigs(): string[] {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return [];
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);
        StoragePathUtils.ensureDirectoryExists(paths.commentsDir);
        return StoragePathUtils.listConfigFiles(paths.commentsDir);
    }

    /**
     * 创建新的注释配置文件
     */
    public async createCommentsConfig(configFileName: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('没有打开的工作区');
            return;
        }
        if (!configFileName.endsWith('.json')) {
            configFileName += '.json';
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);
        const configFile = path.join(paths.commentsDir, configFileName);
        if (fs.existsSync(configFile)) {
            vscode.window.showWarningMessage(`配置文件已存在: ${configFileName}`);
            return;
        }
        StoragePathUtils.ensureNewPathExists(paths);
        const defaultData = { comments: {}, shareComments: {} };
        fs.writeFileSync(configFile, JSON.stringify(defaultData, null, 2));
        vscode.window.showInformationMessage(`已创建注释配置文件: ${configFileName}`);
    }

    /**
     * 获取当前使用的注释配置文件名
     */
    public getCurrentCommentsConfig(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return 'default';
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const paths = StoragePathUtils.getStoragePaths(this.context, workspacePath);
        const config = StoragePathUtils.loadConfig(workspacePath);
        return config.comments || 'comments.json';
    }

    /**
     * 将选中的文字转换为本地注释
     * @param uri 文件URI
     * @param selection 选中的文字范围
     * @param selectedText 选中的文字内容
     */
    public async convertSelectionToComment(uri: vscode.Uri, selection: vscode.Selection, selectedText: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            this.comments[filePath] = [];
        }

        // 获取选中文字所在的行号（使用起始行）
        let line = selection.start.line;
        
        // 删除选中的文字
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === filePath) {
            await editor.edit(editBuilder => {
                editBuilder.delete(selection);
            });
            
            // 检查删除文字后，当前行是否为空行
            const document = editor.document;
            const currentLineText = document.lineAt(line).text.trim();
            
            // 如果当前行变成了空行，向下查找第一个非空行
            if (currentLineText === '') {
                let nextNonEmptyLine = -1;
                
                // 从当前行向下查找第一个非空行
                for (let i = line + 1; i < document.lineCount; i++) {
                    if (document.lineAt(i).text.trim() !== '') {
                        nextNonEmptyLine = i;
                        break;
                    }
                }
                
                // 如果找到了非空行，更新line值
                if (nextNonEmptyLine !== -1) {
                    line = nextNonEmptyLine;
                    vscode.window.showInformationMessage(`已将注释移动到第 ${line + 1} 行（当前行为空）`);
                }
            }
        
        // 获取当前行的内容用于智能定位
        const lineContent = document.lineAt(line).text;

        // 创建本地注释
        const comment: LocalComment = {
            id: this.generateId(),
            line: line,
            content: selectedText.trim(), // 使用选中的文字作为注释内容
            timestamp: Date.now(),
            originalLine: line,
            lineContent: lineContent.trim(),
            isShared: false
        };

        // 检查是否已存在该行的本地注释，如果存在则替换
        const existingLocalIndex = this.comments[filePath].findIndex(c => 
            c.line === line && !('userId' in c) // 只检查本地注释
        );
        
        if (existingLocalIndex >= 0) {
            // 替换现有的本地注释
            this.comments[filePath][existingLocalIndex] = comment;
        } else {
            // 检查是否有共享注释在同一行
            const existingSharedComments = this.shareComments[filePath]?.filter(c => 
                c.line === line
            ) || [];
            
            
            // 添加新的本地注释
            this.comments[filePath].push(comment);
        }

        // 保存注释
        await this.saveComments();

        vscode.window.showInformationMessage(`已将选中文字转换为第 ${line + 1} 行的本地注释`);
        } else {
            vscode.window.showErrorMessage('无法访问活动编辑器');
        }
    }

    /**
     * 异步保存注释，避免阻塞UI
     */
    private async saveCommentsAsync(): Promise<void> {
        try {
            setTimeout(async () => {
                await this.saveComments();
                this._onDidChangeSharedComments.fire(); // 触发共享注释变化事件
            }, DELAY_TIMES.ASYNC_SAVE);
        } catch (error) {
            logger.error('异步保存注释失败:', error);
        }
    }



    /**
     * 导出注释数据到指定文件
     * @param exportPath 导出文件路径
     * @returns 导出是否成功
     */
    public async exportComments(exportPath: string): Promise<boolean> {
        try {
            const projectInfo = this.getProjectInfo();
            const totalComments = Object.values(this.comments).reduce((sum, comments) => sum + comments.length, 0);
            
            // 构建导出数据
            const exportData = buildExportData(projectInfo, this.comments, totalComments);

            // 确保导出目录存在
            const exportDir = path.dirname(exportPath);
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            // 写入导出文件
            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
            
            logger.info(`✅ 注释数据已导出到: ${exportPath}`);
            return true;
        } catch (error) {
            logger.error('导出注释数据失败:', error);
            return false;
        }
    }

    /**
     * 从指定文件导入注释数据
     * @param importPath 导入文件路径
     * @param mergeMode 导入模式：'replace' 替换现有数据，'merge' 合并数据
     * @param crossProjectMode 跨项目导入模式：'direct' 直接导入，'remap' 路径重映射
     * @param pathMapping 路径映射配置，用于跨项目导入
     * @returns 导入结果信息
     */
    public async importComments(
        importPath: string,
        mergeMode: 'replace' | 'merge' = 'merge',
        pathMapping?: { oldBasePath: string; newBasePath: string }
    ): Promise<{
        success: boolean;
        message: string;
        importedFiles?: number;
        importedComments?: number;
        skippedComments?: number;
        remappedFiles?: number;
    }> {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(importPath)) {
                return {
                    success: false,
                    message: '导入文件不存在'
                };
            }

            // 读取导入文件
            const importDataStr = fs.readFileSync(importPath, 'utf8');
            const importData = JSON.parse(importDataStr);

            // 验证导入数据格式
            if (!importData.comments || typeof importData.comments !== 'object') {
                return {
                    success: false,
                    message: '导入文件格式不正确，缺少注释数据'
                };
            }

            let importedFiles = 0;
            let importedComments = 0;
            let skippedComments = 0;
            let remappedFiles = 0;

            if (mergeMode === 'replace') {
                // 替换模式：清空现有数据
                this.comments = {};
            }

            // 处理导入的注释数据
            for (const [originalFilePath, comments] of Object.entries(importData.comments)) {
                if (!Array.isArray(comments)) {
                    continue;
                }

                let targetFilePath = originalFilePath;

                // 处理跨项目路径重映射
                if (pathMapping) {
                    const { oldBasePath, newBasePath } = pathMapping;
                    
                    // 确保路径是绝对路径，以便进行正确的相对路径计算
                    const oldFullPath = path.resolve(oldBasePath, originalFilePath);
                    
                    // 计算相对于旧基础路径的相对路径
                    const relativePath = path.relative(oldBasePath, oldFullPath);
                    
                    // 构建新的绝对路径
                    targetFilePath = path.join(newBasePath, relativePath);
                    
                    if (originalFilePath !== targetFilePath) {
                        remappedFiles++;
                        logger.debug(`🔄 路径重映射: ${originalFilePath} -> ${targetFilePath}`);
                    }
                } else {
                    // 如果没有路径映射，尝试将标准化路径转换为当前系统路径
                    // 假设导入的路径是相对于项目根目录的标准化路径
                    targetFilePath = toAbsolutePath(originalFilePath);
                }

                if (!this.comments[targetFilePath]) {
                    this.comments[targetFilePath] = [];
                    importedFiles++;
                }

                for (const comment of comments as (LocalComment | SharedComment)[]) {
                    // 验证注释数据完整性
                    if (!comment.id || typeof comment.line !== 'number' || !comment.content) {
                        skippedComments++;
                        continue;
                    }

                    if (mergeMode === 'merge') {
                        // 合并模式：检查是否已存在相同ID的注释
                        const existingIndex = this.findCommentIndex(this.comments[targetFilePath], comment.id);
                        if (existingIndex >= 0) {
                            // 如果存在相同ID，跳过或更新（这里选择跳过避免冲突）
                            skippedComments++;
                            continue;
                        }
                    }

                    // 添加注释，确保必要字段存在
                    const importedComment: LocalComment = {
                        id: comment.id || this.generateId(),
                        line: comment.line,
                        content: comment.content,
                        timestamp: comment.timestamp || Date.now(),
                        originalLine: comment.originalLine || comment.line,
                        lineContent: comment.lineContent || '',
                        isMatched: comment.isMatched
                    };

                    this.comments[targetFilePath].push(importedComment);
                    importedComments++;
                }
            }

            // 保存导入的数据
            await this.saveComments();

            let message = `导入完成！导入了 ${importedFiles} 个文件的 ${importedComments} 条注释`;
            if (skippedComments > 0) {
                message += `，跳过 ${skippedComments} 条注释`;
            }
            if (remappedFiles > 0) {
                message += `，重映射了 ${remappedFiles} 个文件路径`;
            }

            logger.info(`✅ ${message}`);
            
            return {
                success: true,
                message,
                importedFiles,
                importedComments,
                skippedComments,
                remappedFiles
            };

        } catch (error) {
            logger.error('导入注释数据失败:', error);
            return {
                success: false,
                message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 分析导入文件中的文件路径，用于跨项目导入时的路径分析
     * @param importPath 导入文件路径
     * @returns 路径分析结果
     */
    public async analyzeImportPaths(importPath: string): Promise<{
        success: boolean;
        message: string;
        filePaths?: string[];
        commonBasePath?: string;
        projectName?: string;
    }> {
        try {
            if (!fs.existsSync(importPath)) {
                return {
                    success: false,
                    message: '文件不存在'
                };
            }

            const importDataStr = fs.readFileSync(importPath, 'utf8');
            const importData = JSON.parse(importDataStr);

            if (!importData.comments || typeof importData.comments !== 'object') {
                return {
                    success: false,
                    message: '文件格式不正确'
                };
            }

            const filePaths = Object.keys(importData.comments);
            
            if (filePaths.length === 0) {
                return {
                    success: false,
                    message: '没有找到文件路径'
                };
            }

            // 查找公共基础路径
            let commonBasePath = '';
            if (filePaths.length > 0) {
                // 标准化所有路径
                const normalizedPaths = filePaths.map(p => p.replace(/\\/g, '/'));
                
                // 找到最短路径作为基础
                const shortestPath = normalizedPaths.reduce((a, b) => a.length <= b.length ? a : b);
                
                // 逐字符比较找到公共前缀
                for (let i = 0; i < shortestPath.length; i++) {
                    const char = shortestPath[i];
                    if (normalizedPaths.every(path => path[i] === char)) {
                        commonBasePath += char;
                    } else {
                        break;
                    }
                }
                
                // 确保公共路径以目录分隔符结尾
                const lastSlashIndex = commonBasePath.lastIndexOf('/');
                if (lastSlashIndex > 0) {
                    commonBasePath = commonBasePath.substring(0, lastSlashIndex + 1);
                }
            }

            return {
                success: true,
                message: '路径分析完成',
                filePaths,
                commonBasePath,
                projectName: importData.projectInfo?.name || '未知项目'
            };

        } catch (error) {
            return {
                success: false,
                message: `路径分析失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 验证导入文件的格式和内容
     * @param importPath 导入文件路径
     * @returns 验证结果
     */
    public async validateImportFile(importPath: string): Promise<{
        valid: boolean;
        message: string;
        fileCount?: number;
        commentCount?: number;
        projectName?: string;
        exportTime?: string;
    }> {
        try {
            if (!fs.existsSync(importPath)) {
                return {
                    valid: false,
                    message: '文件不存在'
                };
            }

            const importDataStr = fs.readFileSync(importPath, 'utf8');
            const importData = JSON.parse(importDataStr);

            // 检查基本结构
            if (!importData.comments || typeof importData.comments !== 'object') {
                return {
                    valid: false,
                    message: '文件格式不正确，缺少注释数据'
                };
            }

            // 统计信息
            const fileCount = Object.keys(importData.comments).length;
            const commentCount = Object.values(importData.comments).reduce((sum: number, comments: any) => {
                return sum + (Array.isArray(comments) ? comments.length : 0);
            }, 0);

            return {
                valid: true,
                message: '文件格式正确',
                fileCount,
                commentCount,
                projectName: importData.projectInfo?.name || '未知项目',
                exportTime: importData.exportTime || '未知时间'
            };

        } catch (error) {
            return {
                valid: false,
                message: `文件解析失败: ${error instanceof Error ? error.message : '未知错误'}`
            };
        }
    }

    /**
     * 将共享注释转换为本地注释（保留原始的lineContent）
     * @param filePath 文件路径
     * @param line 行号
     * @param content 注释内容
     * @param lineContent 原始行内容
     * @param originalLine 原始行号
     * @param isMatched 是否匹配
     * @param forceOverwrite 是否强制覆盖（不显示确认对话框）
     */
    public async addCommentFromShared(
        filePath: string,
        line: number,
        content: string,
        lineContent: string,
        originalLine: number,
        isMatched: boolean = true,
        forceOverwrite: boolean = false
    ): Promise<void> {
        try {
            if (!this.comments[filePath]) {
                this.comments[filePath] = [];
            }

            // 创建本地注释，保留共享注释的原始lineContent
            const comment: LocalComment = {
                id: this.generateId(),
                line: line,
                content: content,
                timestamp: Date.now(),
                originalLine: originalLine,
                lineContent: lineContent.trim(),
                isMatched: isMatched,
                isShared: false
            };

            // 检查是否已存在该行的本地注释，如果存在则替换
            const existingLocalIndex = this.comments[filePath].findIndex(c => 
                c.line === line && !('userId' in c)
            );
            
            if (existingLocalIndex >= 0) {
                // 替换现有的本地注释
                this.comments[filePath][existingLocalIndex] = comment;
            } else {
                // 添加新的本地注释
                this.comments[filePath].push(comment);
            }

            await this.saveComments();
        } catch (error) {
            logger.error('从共享注释添加本地注释失败:', error);
            throw error;
        }
    }

    /**
     * 将共享注释保存到本地
     * @param sharedComment 共享注释
     */
    private async saveSharedCommentToLocal(sharedComment: SharedComment): Promise<void> {
        try {
            // 由于 SharedComment 没有 filePath 属性，我们需要通过其他方式确定文件路径
            // 这里我们可以通过当前活动文档或者让用户选择文件
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                logger.warn('没有活动的文本编辑器，无法确定文件路径');
                vscode.window.showWarningMessage('请先打开一个文件，然后重试');
                return;
            }

            const filePath = activeEditor.document.uri.fsPath;
            
            // 确保文件注释数组存在
            if (!this.comments[filePath]) {
                this.comments[filePath] = [];
            }

            // 检查是否已存在相同的共享注释（只检查ID，避免覆盖localComment）
            const existingSharedIndex = this.comments[filePath].findIndex(c => 
                c.id === sharedComment.id && c.isShared === true
            );

            // 转换为本地注释格式
            const localComment: LocalComment = {
                id: sharedComment.id,
                line: sharedComment.line,
                content: sharedComment.content,
                timestamp: sharedComment.timestamp,
                originalLine: sharedComment.originalLine,
                lineContent: sharedComment.lineContent,
                isMatched: sharedComment.isMatched,
                isShared: true // 标记为共享注释
            };

            if (existingSharedIndex >= 0) {
                // 更新现有的共享注释
                this.comments[filePath][existingSharedIndex] = localComment;
            } else {
                // 检查是否在同一行有localComment
                const existingLocalIndex = this.comments[filePath].findIndex(c => 
                    c.line === sharedComment.line && c.isShared !== true
                );

                
                
                // 添加新的共享注释（无论是否有localComment都添加）
                this.comments[filePath].push(localComment);
            }

            // 保存到本地存储
            await this.saveComments();
            
        } catch (error) {
            logger.error('保存共享注释到本地失败:', error);
            vscode.window.showErrorMessage(`保存共享注释到本地失败: ${error}`);
        }
    }

    /**
     * 获取项目中的所有共享注释
     * @param projectId 项目ID
     * @returns 项目共享注释数组的Promise
     */
    public async getProjectSharedComments(
        projectId: number, 
        pathMapping?: { oldBasePath: string; newBasePath: string }
    ): Promise<ProjectSharedComment[] | null> {
        try {
            const response = await apiService.get<ProjectSharedComment[]>(
                ApiRoutes.comment.getProjectSharedComments(projectId)
            );
            
            if (response && response.length > 0) {
                // 将项目共享注释转换为本地注释格式并存储
                await this.saveProjectSharedCommentsToLocal(response, pathMapping);
            }
            
            return response;
        } catch (error) {
            logger.error('获取项目共享注释失败:', error);
            vscode.window.showErrorMessage(`获取项目共享注释失败: ${error}`);
            return null;
        }
    }

    /**
     * 将项目共享注释数组保存到本地
     * @param projectSharedComments 项目共享注释数组
     * @param pathMapping 路径映射配置，用于跨项目路径重映射
     */
    private async saveProjectSharedCommentsToLocal(
        projectSharedComments: ProjectSharedComment[], 
        pathMapping?: { oldBasePath: string; newBasePath: string }
    ): Promise<void> {
        try {
            let savedCount = 0;
            let skippedCount = 0;
            let remappedCount = 0;

            for (const projectComment of projectSharedComments) {
                try {
                    let targetFilePath = projectComment.file_path;
                    const originalFilePath = projectComment.file_path;
                    
                    // 使用与导入功能相同的路径重映射逻辑
                    if (pathMapping) {
                        const { oldBasePath, newBasePath } = pathMapping;
                        
                        // 确保路径是绝对路径，以便进行正确的相对路径计算
                        const oldFullPath = path.resolve(oldBasePath, originalFilePath);
                        
                        // 计算相对于旧基础路径的相对路径
                        const relativePath = path.relative(oldBasePath, oldFullPath);
                        
                        // 构建新的绝对路径
                        targetFilePath = path.join(newBasePath, relativePath);
                        
                        if (originalFilePath !== targetFilePath) {
                            remappedCount++;
                        }
                    } else {
                        // 如果没有路径映射，尝试将标准化路径转换为当前系统路径
                        // 假设服务器返回的路径是相对于项目根目录的标准化路径
                        targetFilePath = toAbsolutePath(originalFilePath);
                        
                        // 如果转换后的路径与原始路径不同，记录重映射
                        if (originalFilePath !== targetFilePath) {
                            remappedCount++;
                        }
                    }
                    
                    // 检查文件是否存在
                    if (!fs.existsSync(targetFilePath)) {
                        logger.warn(`文件不存在，跳过共享注释: ${targetFilePath} (原始路径: ${originalFilePath})`);
                        skippedCount++;
                        continue;
                    }

                    // 确保文件共享注释数组存在
                    if (!this.shareComments[targetFilePath]) {
                        this.shareComments[targetFilePath] = [];
                    }


                    // 将 ProjectSharedComment 转换为 SharedComment
                    const sharedComment: SharedComment = {
                        id: projectComment.id.toString(), // 转换为字符串ID
                        line: projectComment.content.line,
                        content: projectComment.content.content,
                        timestamp: projectComment.content.timestamp,
                        originalLine: projectComment.content.originalLine,
                        lineContent: projectComment.content.lineContent,
                        isMatched: projectComment.content.isMatched,
                        isShared: true, // 标记为共享注释
                        userId: projectComment.user_id.toString(), // 用户ID
                        userAvatar: projectComment.user_avatar, // 从API返回数据中获取用户头像
                        username: projectComment.username // 从API返回数据中获取用户名
                    };

                    // 检查是否已存在相同的共享注释
                    const existingSharedIndex = this.findCommentIndex(this.shareComments[targetFilePath], sharedComment.id);

                    if (existingSharedIndex >= 0) {
                        // 更新现有的共享注释
                        this.shareComments[targetFilePath][existingSharedIndex] = sharedComment;
                    } else {
                        // 添加新的共享注释
                        this.shareComments[targetFilePath].push(sharedComment);
                    }

                    savedCount++;
                } catch (error) {
                    logger.error(`处理项目共享注释失败: ${projectComment.id}`, error);
                    skippedCount++;
                }
            }

            // 保存到本地存储
            await this.saveComments();
            
            logger.info(`项目共享注释处理完成: 保存 ${savedCount} 个，跳过 ${skippedCount} 个，重映射 ${remappedCount} 个路径`);
            
            if (savedCount > 0) {
                vscode.window.showInformationMessage(`已保存 ${savedCount} 个共享注释到本地`);
            }
        } catch (error) {
            logger.error('保存项目共享注释到本地失败:', error);
            vscode.window.showErrorMessage(`保存项目共享注释到本地失败: ${error}`);
        }
    }


}