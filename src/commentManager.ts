import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CommentMatcher } from './commentMatcher';

export interface LocalComment {
    id: string;
    line: number;
    content: string;
    timestamp: number;
    originalLine: number; // 原始行号，用于跟踪位置变化
    lineContent: string; // 该行的内容，用于智能定位
    isMatched?: boolean; // 标记注释是否匹配到代码
}

export interface FileComments {
    [filePath: string]: LocalComment[];
}

export class CommentManager {
    private comments: FileComments = {};
    private storageFile: string;
    private context: vscode.ExtensionContext;
    private updateTimer: NodeJS.Timeout | null = null; // 防抖定时器
    private pendingUpdates: Set<string> = new Set(); // 待更新的文件路径
    private _hasKeyboardActivity = false; // 记录键盘活动状态
    private commentMatcher: CommentMatcher; // 注释匹配器

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storageFile = this.getProjectStorageFile(context);
        this.commentMatcher = new CommentMatcher(); // 实例化注释匹配器
        this.loadComments();
        
        // 监听工作区变化，重新加载注释数据
        const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.handleWorkspaceChange();
        });
        
        context.subscriptions.push(workspaceWatcher);
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
        
        console.log('工作区已切换，注释数据已重新加载');
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
            
            return path.join(projectStorageDir, `${projectName}-${pathHash}.json`);
        } else {
            // 如果没有工作区，使用默认的全局存储（向后兼容）
            return path.join(globalStorageDir, 'local-comments.json');
        }
    }

    private async loadComments(): Promise<void> {
        try {
            // 确保存储目录存在
            const storageDir = path.dirname(this.storageFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            if (fs.existsSync(this.storageFile)) {
                const data = fs.readFileSync(this.storageFile, 'utf8');
                this.comments = JSON.parse(data);
            } else {
                // 如果项目特定的文件不存在，尝试迁移旧数据
                this.comments = {};
                await this.tryMigrateOldData();
            }
        } catch (error) {
            console.error('加载注释失败:', error);
            this.comments = {};
        }
    }

    /**
     * 尝试从旧的全局存储迁移数据到项目特定存储
     */
    private async tryMigrateOldData(): Promise<void> {
        try {
            const globalStorageDir = this.context.globalStorageUri?.fsPath || this.context.extensionPath;
            const oldStorageFile = path.join(globalStorageDir, 'local-comments.json');
            
            if (!fs.existsSync(oldStorageFile)) {
                return; // 没有旧数据需要迁移
            }

            const oldData = fs.readFileSync(oldStorageFile, 'utf8');
            const allComments: FileComments = JSON.parse(oldData);
            
            // 获取当前工作区路径
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return; // 没有工作区，无法迁移
            }
            
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const projectComments: FileComments = {};
            
            // 筛选出属于当前项目的注释
            for (const [filePath, comments] of Object.entries(allComments)) {
                if (filePath.startsWith(workspacePath)) {
                    projectComments[filePath] = comments;
                }
            }
            
            // 如果有属于当前项目的注释，保存到项目特定文件
            if (Object.keys(projectComments).length > 0) {
                this.comments = projectComments;
                await this.saveComments();
                console.log(`已迁移 ${Object.keys(projectComments).length} 个文件的注释到项目存储`);
            }
            
        } catch (error) {
            console.error('迁移旧数据失败:', error);
        }
    }

    private async saveComments(): Promise<void> {
        try {
            const storageDir = path.dirname(this.storageFile);
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }
            
            fs.writeFileSync(this.storageFile, JSON.stringify(this.comments, null, 2));
        } catch (error) {
            console.error('保存注释失败:', error);
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
            lineContent: lineContent.trim()
        };

        // 检查是否已存在该行的注释，如果存在则替换
        const existingIndex = this.comments[filePath].findIndex(c => c.line === line);
        if (existingIndex >= 0) {
            this.comments[filePath][existingIndex] = comment;
        } else {
            this.comments[filePath].push(comment);
        }

        await this.saveComments();
        vscode.window.showInformationMessage(`已添加本地注释到第 ${line + 1} 行`);
    }

    public async editComment(uri: vscode.Uri, commentId: string, newContent: string): Promise<void> {
        const filePath = uri.fsPath;
        
        if (!this.comments[filePath]) {
            vscode.window.showWarningMessage('该文件没有本地注释');
            return;
        }

        const commentIndex = this.comments[filePath].findIndex(c => c.id === commentId);
        if (commentIndex === -1) {
            vscode.window.showWarningMessage('找不到指定的注释');
            return;
        }

        this.comments[filePath][commentIndex].content = newContent;
        this.comments[filePath][commentIndex].timestamp = Date.now(); // 更新时间戳

        await this.saveComments();
        vscode.window.showInformationMessage('注释已更新');
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

        const initialLength = this.comments[filePath].length;
        this.comments[filePath] = this.comments[filePath].filter(c => c.line !== line);

        if (this.comments[filePath].length === initialLength) {
            vscode.window.showWarningMessage(`第 ${line + 1} 行没有本地注释`);
            return;
        }

        // 如果该文件没有注释了，删除该文件的记录
        if (this.comments[filePath].length === 0) {
            delete this.comments[filePath];
        }

        await this.saveComments();
        vscode.window.showInformationMessage(`已删除第 ${line + 1} 行的本地注释`);
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
        vscode.window.showInformationMessage(`已删除第 ${commentToRemove.line + 1} 行的本地注释`);
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
    public getComments(uri: vscode.Uri): LocalComment[] {
        const filePath = uri.fsPath;
        const fileComments = this.comments[filePath] || [];
        
        if (fileComments.length === 0) {
            return [];
        }

        // 获取当前文档内容进行智能匹配
        const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
        if (!document) {
            // 如果文档未打开，返回空数组（暂时隐藏注释）
            return [];
        }

        // 使用批量匹配功能，确保不会有多个注释匹配到同一行
        const matchResults = this.commentMatcher.batchMatchComments(document, fileComments);
        
        const matchedComments: LocalComment[] = [];
        let needsSave = false;

        for (const comment of fileComments) {
            const matchedLine = matchResults.get(comment.id) ?? -1;
            
            if (matchedLine !== -1) {
                // 记录匹配状态为true
                comment.isMatched = true;
                
                // 创建一个新的注释对象，更新行号但保持原有信息
                const matchedComment: LocalComment = {
                    ...comment,
                    line: matchedLine,
                    isMatched: true // 确保复制的对象也有匹配状态
                };
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

        // 只有在有最近键盘活动时才处理直接编辑注释所在行的情况
        // 这可以避免Git分支切换等非用户编辑操作触发代码快照更新
        if (!hasRecentKeyboardActivity) {
            // 如果没有键盘活动，可能是Git分支切换等操作导致的文件变化
            console.log('⏭️ 未检测到键盘活动，可能是Git分支切换，跳过代码快照更新');
            return;
        }

        // 检查是否有直接编辑注释所在行的情况
        let hasDirectLineEdit = false;
        let directUpdates = 0;
        
        // 检查是否有可能影响行号的操作（添加行或删除行）
        let hasLineNumberChanges = false;
        
        // 先检查是否有影响行号的变更
        for (const change of event.contentChanges) {
            // 检查是否有添加或删除行的操作
            const hasLineBreaks = change.text.includes('\n'); // 添加行的特征
            const spanMultipleLines = change.range.end.line > change.range.start.line; // 跨多行的特征
            
            if (hasLineBreaks || spanMultipleLines) {
                hasLineNumberChanges = true;
                console.log(`⚠️ 检测到可能影响行号的操作: ${spanMultipleLines ? '删除多行' : '添加行'}`);
                break;
            }
        }
        
        // 如果有可能影响行号的操作，直接走智能匹配流程，不立即更新内容快照
        if (hasLineNumberChanges) {
            console.log(`⚠️ 检测到行号变化，跳过直接更新内容快照，进入智能匹配流程`);
            
            // 将文件标记为需要智能更新
            this.pendingUpdates.add(filePath);
            
            // 记录键盘活动状态
            this._hasKeyboardActivity = hasRecentKeyboardActivity;
            
            // 立即执行智能更新（缩短延迟时间）
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
            }
            
            this.updateTimer = setTimeout(async () => {
                console.log('🧠 检测到行号变化，立即开始智能更新...');
                await this.performSmartUpdates();
                this.updateTimer = null;
                
                // 智能更新完成后再触发注释重新渲染
                setTimeout(() => {
                    vscode.commands.executeCommand('localComment.refreshComments');
                }, 10);
            }, 100); // 缩短延迟以更快响应行号变化
            
            return; // 提前返回，避免走直接更新的逻辑
        }
        
        // 如果没有行号变化，正常处理直接编辑
        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            
            // 检查变化范围内是否有注释
            for (const comment of fileComments) {
                if (comment.line >= startLine && comment.line <= endLine) {
                    // 用户直接编辑了注释所在的行，立即更新代码快照
                    try {
                        const currentLineContent = event.document.lineAt(comment.line).text.trim();
                        if (currentLineContent !== (comment.lineContent || '').trim()) {
                            comment.lineContent = currentLineContent;
                            directUpdates++;
                            hasDirectLineEdit = true;
                            console.log(`⚡ 检测到直接编辑注释行 ${comment.line + 1}，立即更新代码快照`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ 无法立即更新注释 ${comment.id}:`, error);
                    }
                }
            }
        }

        // 如果有直接编辑，立即保存并刷新
        if (hasDirectLineEdit) {
            await this.saveComments();
            console.log(`⚡ 立即更新完成，共更新 ${directUpdates} 个注释`);
            
            // 立即刷新注释显示
            setTimeout(() => {
                vscode.commands.executeCommand('localComment.refreshComments');
            }, 10);
            
            // 如果只是直接编辑，不需要执行智能匹配
            const needsSmartUpdate = fileComments.some(comment => {
                // 检查是否有注释可能需要智能匹配（不在编辑范围内的注释）
                return !event.contentChanges.some(change => 
                    comment.line >= change.range.start.line && 
                    comment.line <= change.range.end.line
                );
            });
            
            if (!needsSmartUpdate) {
                console.log(`✅ 所有注释都通过直接编辑更新，跳过智能匹配`);
                return;
            }
        }

        // 将这个文件标记为需要智能更新（处理可能需要重新匹配的注释）
        this.pendingUpdates.add(filePath);
        
        // 记录键盘活动状态
        this._hasKeyboardActivity = hasRecentKeyboardActivity;

        // 使用防抖机制：清除之前的定时器，设置新的定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        // 延迟300ms后执行智能更新（减少延迟，但仍然防抖）
        this.updateTimer = setTimeout(async () => {
            console.log('🧠 开始智能更新注释代码快照...');
            await this.performSmartUpdates();
            this.updateTimer = null;
            
            // 智能更新完成后再触发注释重新渲染
            setTimeout(() => {
                vscode.commands.executeCommand('localComment.refreshComments');
            }, 10);
        }, 300);
    }

    /**
     * 执行智能更新：只有当注释确实匹配到正确位置时，才更新代码快照
     */
    private async performSmartUpdates(): Promise<void> {
        // 如果没有键盘活动，可能是Git分支切换，跳过智能更新
        if (!this._hasKeyboardActivity) {
            console.log('⏭️ 未检测到键盘活动，跳过智能更新');
            this.pendingUpdates.clear();
            return;
        }

        let totalUpdates = 0;
        
        for (const filePath of this.pendingUpdates) {
            const fileComments = this.comments[filePath];
            if (!fileComments) continue;

            // 获取当前文档
            const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === filePath);
            if (!document) continue;

            let fileUpdates = 0;
            
            // 使用批量匹配功能，确保不会有多个注释匹配到同一行
            const matchResults = this.commentMatcher.batchMatchComments(document, fileComments);
            
            for (const comment of fileComments) {
                const matchedLine = matchResults.get(comment.id) ?? -1;
                
                if (matchedLine !== -1) {
                    // 注释找到了匹配位置，检查是否需要更新代码快照
                    try {
                        const currentLineContent = document.lineAt(matchedLine).text.trim();
                        const storedLineContent = (comment.lineContent || '').trim();
                        
                        // 情况1：注释匹配到了原位置，但代码内容发生了变化（用户编辑）
                        // 情况2：注释匹配到了新位置，需要更新行号和代码快照
                        if (currentLineContent !== storedLineContent && currentLineContent.length > 0) {
                            comment.lineContent = currentLineContent;
                            comment.line = matchedLine; // 同时更新行号
                            fileUpdates++;
                            totalUpdates++;
                        } else if (comment.line !== matchedLine) {
                            // 只是位置变化，代码内容没变
                            comment.line = matchedLine;
                            fileUpdates++;
                            totalUpdates++;
                        }
                    } catch (error) {
                        console.warn(`⚠️ 无法智能更新注释 ${comment.id}:`, error);
                    }
                } else {
                    // 如果找不到匹配位置，检查是否是在原位置直接修改
                    try {
                        if (comment.line >= 0 && comment.line < document.lineCount) {
                            const currentLineContent = document.lineAt(comment.line).text.trim();
                            
                            // 如果原位置有新内容（不是空行），且与存储的内容有明显差异
                            // 可能是用户直接修改了注释所在的行，应该更新代码快照
                            if (currentLineContent.length > 0 && 
                                currentLineContent !== (comment.lineContent || '').trim()) {
                                
                                // 使用相似度检查，如果修改不是太大，认为是同一行的修改
                                const similarity = this.commentMatcher.calculateSimilarity(currentLineContent, comment.lineContent || '');
                                if (similarity > 0.4) { // 相似度超过40%认为是同一行的修改
                                    comment.lineContent = currentLineContent;
                                    fileUpdates++;
                                    totalUpdates++;
                                    console.log(`🔄 检测到原位置代码修改，更新注释 ${comment.id} 的代码快照`);
                                }
                            }
                        }
                    } catch (error) {
                        console.warn(`⚠️ 无法检查原位置修改 ${comment.id}:`, error);
                    }
                }
            }

            if (fileUpdates > 0) {
                console.log(`✅ 文件 ${path.basename(filePath)} 更新了 ${fileUpdates} 个注释`);
            }
        }

        // 清空待更新列表
        this.pendingUpdates.clear();

        // 如果有更新，保存到文件
        if (totalUpdates > 0) {
            await this.saveComments();
            console.log(`✅ 智能更新完成，共更新 ${totalUpdates} 个注释`);
        }
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    public getAllComments(): FileComments {
        return this.comments;
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
            lineContent: lineContent.trim()
        };

        // 检查是否已存在该行的注释，如果存在则替换
        const existingIndex = this.comments[filePath].findIndex(c => c.line === line);
        if (existingIndex >= 0) {
            this.comments[filePath][existingIndex] = comment;
        } else {
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
            }, 100);
        } catch (error) {
            console.error('异步保存注释失败:', error);
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
            const exportData = {
                version: '1.0.0',
                exportTime: new Date().toISOString(),
                projectInfo: {
                    name: projectInfo.name,
                    path: projectInfo.path
                },
                comments: this.comments,
                metadata: {
                    totalFiles: Object.keys(this.comments).length,
                    totalComments: Object.values(this.comments).reduce((sum, comments) => sum + comments.length, 0)
                }
            };

            // 确保导出目录存在
            const exportDir = path.dirname(exportPath);
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }

            // 写入导出文件
            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');
            
            console.log(`✅ 注释数据已导出到: ${exportPath}`);
            return true;
        } catch (error) {
            console.error('导出注释数据失败:', error);
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
        crossProjectMode: 'direct' | 'remap' = 'direct',
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
                if (crossProjectMode === 'remap' && pathMapping) {
                    const { oldBasePath, newBasePath } = pathMapping;
                    
                    // 标准化路径分隔符
                    const normalizedOldPath = originalFilePath.replace(/\\/g, '/');
                    const normalizedOldBase = oldBasePath.replace(/\\/g, '/');
                    const normalizedNewBase = newBasePath.replace(/\\/g, '/');
                    
                    if (normalizedOldPath.startsWith(normalizedOldBase)) {
                        // 计算相对路径
                        const relativePath = normalizedOldPath.substring(normalizedOldBase.length);
                        // 构建新的完整路径
                        targetFilePath = path.join(normalizedNewBase, relativePath).replace(/\\/g, '/');
                        
                        // 转换回系统路径格式
                        targetFilePath = path.resolve(targetFilePath);
                        remappedFiles++;
                        
                        console.log(`🔄 路径重映射: ${originalFilePath} -> ${targetFilePath}`);
                    }
                }

                if (!this.comments[targetFilePath]) {
                    this.comments[targetFilePath] = [];
                    importedFiles++;
                }

                for (const comment of comments as LocalComment[]) {
                    // 验证注释数据完整性
                    if (!comment.id || typeof comment.line !== 'number' || !comment.content) {
                        skippedComments++;
                        continue;
                    }

                    if (mergeMode === 'merge') {
                        // 合并模式：检查是否已存在相同ID的注释
                        const existingIndex = this.comments[targetFilePath].findIndex(c => c.id === comment.id);
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

            console.log(`✅ ${message}`);
            
            return {
                success: true,
                message,
                importedFiles,
                importedComments,
                skippedComments,
                remappedFiles
            };

        } catch (error) {
            console.error('导入注释数据失败:', error);
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
} 