import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface Bookmark {
    id: string;
    line: number; // 书签所在行号
    timestamp: number; // 创建时间戳
    filePath: string; // 文件路径
    label?: string; // 可选的书签标签
    lineContent?: string; // 该行的代码内容
}

export interface FileBookmarks {
    [filePath: string]: Bookmark[];
}

export class BookmarkManager {
    private bookmarks: FileBookmarks = {};
    private storageFile: string;
    private context: vscode.ExtensionContext;
    private _onDidChangeBookmarks: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeBookmarks: vscode.Event<void> = this._onDidChangeBookmarks.event;
    
    // 性能优化：缓存排序后的书签列表
    private _sortedBookmarksCache: Bookmark[] | null = null;
    private _cacheInvalidated = true;
    
    // 防抖保存
    private _saveTimeout: NodeJS.Timeout | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storageFile = this.getProjectStorageFile(context);
        this.loadBookmarks();
        
        // 监听工作区变化，重新加载书签数据
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.handleWorkspaceChange();
        });
        
        context.subscriptions.push(workspaceWatcher);
    }

    /**
     * 处理工作区变化
     */
    private async handleWorkspaceChange(): Promise<void> {
        // 保存当前书签数据
        await this.saveBookmarks();
        
        // 更新存储文件路径
        this.storageFile = this.getProjectStorageFile(this.context);
        
        // 重新加载新工作区的书签数据
        await this.loadBookmarks();
        
        this._onDidChangeBookmarks.fire();
        logger.info('工作区已切换，书签数据已重新加载');
    }

    /**
     * 根据当前工作区生成项目特定的存储文件路径
     */
    private getProjectStorageFile(context: vscode.ExtensionContext): string {
        const globalStorageDir = context.globalStorageUri?.fsPath || context.extensionPath;
        
        // 获取当前工作区的根路径
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // 使用第一个工作区文件夹路径
            const workspacePath = workspaceFolders[0].uri.fsPath;
            
            // 创建工作区路径的哈希值作为文件名
            const pathHash = crypto.createHash('md5').update(workspacePath).digest('hex');
            const projectName = path.basename(workspacePath);
            
            // 确保项目存储目录存在
            const projectStorageDir = path.join(globalStorageDir, 'projects');
            if (!fs.existsSync(projectStorageDir)) {
                fs.mkdirSync(projectStorageDir, { recursive: true });
            }
            
            return path.join(projectStorageDir, `${projectName}-${pathHash}-bookmarks.json`);
        } else {
            // 如果没有工作区，使用默认的全局存储（向后兼容）
            return path.join(globalStorageDir, 'local-bookmarks.json');
        }
    }

    private async loadBookmarks(): Promise<void> {
        try {
            // 确保存储目录存在
            const storageDir = path.dirname(this.storageFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf8');
                this.bookmarks = JSON.parse(data);
                
                // 为现有书签添加行内容（迁移逻辑）
                await this.migrateBookmarksWithLineContent();
            } else {
                this.bookmarks = {};
            }
        } catch (error) {
            logger.error('加载书签失败:', error);
            this.bookmarks = {};
        }
    }

    /**
     * 为现有书签添加行内容（迁移逻辑）
     */
    private async migrateBookmarksWithLineContent(): Promise<void> {
        let hasChanges = false;
        
        for (const [filePath, bookmarks] of Object.entries(this.bookmarks)) {
            for (const bookmark of bookmarks) {
                // 如果书签没有行内容，尝试获取
                if (!bookmark.lineContent) {
                    try {
                        const uri = vscode.Uri.file(filePath);
                        const document = await vscode.workspace.openTextDocument(uri);
                        if (bookmark.line >= 0 && bookmark.line < document.lineCount) {
                            bookmark.lineContent = document.lineAt(bookmark.line).text.trim();
                            hasChanges = true;
                        }
                    } catch (error) {
                        // 文件可能不存在或无法访问，跳过
                        logger.warn(`无法获取书签行内容: ${filePath}:${bookmark.line + 1}`);
                    }
                }
            }
        }
        
        // 如果有变化，保存
        if (hasChanges) {
            await this.saveBookmarks();
        }
    }

    private async saveBookmarks(): Promise<void> {
        try {
            const storageDir = path.dirname(this.storageFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            
            fs.writeFileSync(this.storageFile, JSON.stringify(this.bookmarks, null, 2));
        } catch (error) {
            logger.error('保存书签失败:', error);
        }
    }

    /**
     * 添加书签
     */
    public async addBookmark(uri: vscode.Uri, line: number, label?: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.bookmarks[filePath]) {
            this.bookmarks[filePath] = [];
        }

        // 检查是否已存在该行的书签，如果存在则不重复添加
        const existingBookmark = this.bookmarks[filePath].find(b => b.line === line);
        if (existingBookmark) {
            return;
        }

        // 获取该行的代码内容
        let lineContent = '';
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            if (line >= 0 && line < document.lineCount) {
                lineContent = document.lineAt(line).text.trim();
            }
        } catch (error) {
            logger.error('获取行内容失败:', error);
        }

        const bookmark: Bookmark = {
            id: this.generateId(),
            line: line,
            timestamp: Date.now(),
            filePath: filePath,
            label: label,
            lineContent: lineContent // 添加行内容
        };

        this.bookmarks[filePath].push(bookmark);
        this._invalidateCache();
        await this.saveBookmarks();
        this._onDidChangeBookmarks.fire();
    }

    /**
     * 删除书签
     */
    public async removeBookmark(uri: vscode.Uri, line: number): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.bookmarks[filePath]) {
            return;
        }

        const initialLength = this.bookmarks[filePath].length;
        this.bookmarks[filePath] = this.bookmarks[filePath].filter(b => b.line !== line);

        if (this.bookmarks[filePath].length === 0) {
            delete this.bookmarks[filePath];
        }

        if (this.bookmarks[filePath]?.length !== initialLength || !this.bookmarks[filePath]) {
            this._invalidateCache();
            await this.saveBookmarks();
            this._onDidChangeBookmarks.fire();
        } else {
        }
    }

    /**
     * 根据ID删除书签
     */
    public async removeBookmarkById(bookmarkId: string): Promise<void> {
        for (const [filePath, bookmarks] of Object.entries(this.bookmarks)) {
            const initialLength = bookmarks.length;
            this.bookmarks[filePath] = bookmarks.filter(b => b.id !== bookmarkId);

            if (this.bookmarks[filePath].length === 0) {
                delete this.bookmarks[filePath];
            }

            if (this.bookmarks[filePath]?.length !== initialLength || !this.bookmarks[filePath]) {
                this._invalidateCache();
                await this.saveBookmarks();
                this._onDidChangeBookmarks.fire();
                return;
            }
        }
    }

    /**
     * 切换书签（如果存在则删除，不存在则添加）
     */
    public async toggleBookmark(uri: vscode.Uri, line: number): Promise<void> {
        const filePath = uri.fsPath;
        
        if (this.bookmarks[filePath]) {
            const existingBookmark = this.bookmarks[filePath].find(b => b.line === line);
            if (existingBookmark) {
                await this.removeBookmark(uri, line);
                return;
            }
        }
        
        await this.addBookmark(uri, line);
    }

    /**
     * 获取文件的所有书签
     */
    public getBookmarks(uri: vscode.Uri): Bookmark[] {
        const filePath = uri.fsPath;
        return this.bookmarks[filePath] || [];
    }

    /**
     * 获取所有书签
     */
    public getAllBookmarks(): FileBookmarks {
        return { ...this.bookmarks };
    }

    /**
     * 清除文件的所有书签
     */
    public async clearFileBookmarks(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        
        if (this.bookmarks[filePath] && this.bookmarks[filePath].length > 0) {
            const count = this.bookmarks[filePath].length;
            delete this.bookmarks[filePath];
            this._invalidateCache();
            await this.saveBookmarks();
            this._onDidChangeBookmarks.fire();
            vscode.window.showInformationMessage(`已清除 ${count} 个书签`);
        } else {
            vscode.window.showInformationMessage('该文件没有书签');
        }
    }

    /**
     * 清除项目的所有书签
     */
    public async clearAllBookmarks(): Promise<void> {
        // 计算当前总书签数
        const totalCount = Object.values(this.bookmarks).reduce((sum, bookmarks) => sum + bookmarks.length, 0);
        
        if (totalCount === 0) {
            vscode.window.showInformationMessage('项目中没有书签');
            return;
        }

        // 清空所有书签
        this.bookmarks = {};
        this._invalidateCache();
        await this.saveBookmarks();
        this._onDidChangeBookmarks.fire();
        vscode.window.showInformationMessage(`已清除项目中的所有书签，共删除 ${totalCount} 个书签`);
    }

    /**
     * 跳转到书签
     */
    public async goToBookmark(filePath: string, line: number): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document, { preview: false });
            
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            logger.error('跳转到书签失败:', error);
        }
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * 获取项目信息
     */
    public getProjectInfo(): { name: string; path: string; storageFile: string } {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            return {
                name: path.basename(workspacePath),
                path: workspacePath,
                storageFile: this.storageFile
            };
        }
        
        return {
            name: '未知项目',
            path: '',
            storageFile: this.storageFile
        };
    }

    /**
     * 获取存储文件路径
     */
    public getStorageFilePath(): string {
        return this.storageFile;
    }

    /**
     * 处理文档变化 - 书签保持静态，不做任何更新
     */
    public handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // 书签不需要任何更新操作，保持静态即可
    }

    /**
     * 跳转到下一个书签（支持跨文件）- 优化版本
     */
    public async goToNextBookmark(): Promise<void> {
        const allBookmarks = this.getAllBookmarksForNavigation();
        
        if (allBookmarks.length === 0) {
            return;
        }

        const currentEditor = vscode.window.activeTextEditor;
        let targetBookmark: Bookmark;

        if (currentEditor) {
            const currentFilePath = currentEditor.document.uri.fsPath;
            const currentLine = currentEditor.selection.active.line;
            
            // 查找当前位置之后的下一个书签
            const nextBookmark = this.findNextBookmarkAfterPosition(allBookmarks, currentFilePath, currentLine);
            targetBookmark = nextBookmark || allBookmarks[0]; // 循环到第一个
        } else {
            targetBookmark = allBookmarks[0];
        }

        // 跳转到目标书签
        await this.goToBookmark(targetBookmark.filePath, targetBookmark.line);
    }

    /**
     * 跳转到上一个书签（支持跨文件）- 优化版本
     */
    public async goToPreviousBookmark(): Promise<void> {
        const allBookmarks = this.getAllBookmarksForNavigation();
        
        if (allBookmarks.length === 0) {
            return;
        }

        const currentEditor = vscode.window.activeTextEditor;
        let targetBookmark: Bookmark;

        if (currentEditor) {
            const currentFilePath = currentEditor.document.uri.fsPath;
            const currentLine = currentEditor.selection.active.line;
            
            // 查找当前位置之前的上一个书签
            const prevBookmark = this.findPreviousBookmarkBeforePosition(allBookmarks, currentFilePath, currentLine);
            targetBookmark = prevBookmark || allBookmarks[allBookmarks.length - 1]; // 循环到最后一个
        } else {
            targetBookmark = allBookmarks[allBookmarks.length - 1];
        }

        // 跳转到目标书签
        await this.goToBookmark(targetBookmark.filePath, targetBookmark.line);
    }

    /**
     * 让缓存失效
     */
    private _invalidateCache(): void {
        this._cacheInvalidated = true;
        this._sortedBookmarksCache = null;
    }

    /**
     * 防抖保存书签 - 用于用户手动操作后的保存
     */
    private _debouncedSave(): void {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        
        this._saveTimeout = setTimeout(() => {
            this.saveBookmarks();
            this._onDidChangeBookmarks.fire();
            this._saveTimeout = null;
        }, 100); // 用户手动操作后的保存延迟
    }

    /**
     * 比较两个书签位置
     * 返回值: < 0 表示 a 在 b 之前, > 0 表示 a 在 b 之后, 0 表示相同位置
     */
    private compareBookmarkPositions(a: { filePath: string; line: number }, b: { filePath: string; line: number }): number {
        // 首先比较文件路径
        const fileCompare = a.filePath.localeCompare(b.filePath);
        if (fileCompare !== 0) {
            return fileCompare;
        }
        // 然后比较行号
        return a.line - b.line;
    }

    /**
     * 获取所有书签并按位置排序（用于导航）- 带缓存优化
     */
    private getAllBookmarksForNavigation(): Bookmark[] {
        // 如果缓存有效，直接返回缓存结果
        if (!this._cacheInvalidated && this._sortedBookmarksCache) {
            return this._sortedBookmarksCache;
        }

        const allBookmarks: Bookmark[] = [];
        
        for (const [filePath, bookmarks] of Object.entries(this.bookmarks)) {
            allBookmarks.push(...bookmarks);
        }
        
        // 按文件路径和行号排序
        const sortedBookmarks = allBookmarks.sort((a, b) => {
            // 首先按文件路径排序
            const fileCompare = a.filePath.localeCompare(b.filePath);
            if (fileCompare !== 0) {
                return fileCompare;
            }
            // 然后按行号排序
            return a.line - b.line;
        });

        // 缓存结果
        this._sortedBookmarksCache = sortedBookmarks;
        this._cacheInvalidated = false;
        
        return sortedBookmarks;
    }

    /**
     * 查找当前位置之后的下一个书签 - 优化版本
     */
    private findNextBookmarkAfterPosition(allBookmarks: Bookmark[], currentFilePath: string, currentLine: number): Bookmark | null {
        // 使用二分查找优化性能
        const currentPosition = { filePath: currentFilePath, line: currentLine };
        
        for (let i = 0; i < allBookmarks.length; i++) {
            const bookmark = allBookmarks[i];
            
            // 比较当前位置和书签位置
            if (this.compareBookmarkPositions(currentPosition, bookmark) < 0) {
                return bookmark;
            }
        }
        return null;
    }

    /**
     * 查找当前位置之前的上一个书签 - 优化版本
     */
    private findPreviousBookmarkBeforePosition(allBookmarks: Bookmark[], currentFilePath: string, currentLine: number): Bookmark | null {
        const currentPosition = { filePath: currentFilePath, line: currentLine };
        
        // 从后往前查找，找到第一个位置小于当前位置的书签
        for (let i = allBookmarks.length - 1; i >= 0; i--) {
            const bookmark = allBookmarks[i];
            
            if (this.compareBookmarkPositions(bookmark, currentPosition) < 0) {
                return bookmark;
            }
        }
        return null;
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        this._onDidChangeBookmarks.dispose();
    }
} 