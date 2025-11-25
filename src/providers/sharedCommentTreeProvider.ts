import * as vscode from 'vscode';
import * as path from 'path';
import { CommentManager, SharedComment } from '../managers/commentManager';
import { logger } from '../utils/logger';
import { COMMANDS, CONTEXT_KEYS } from '../constants';

export class SharedCommentTreeProvider implements vscode.TreeDataProvider<SharedCommentTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData: vscode.EventEmitter<SharedCommentTreeItem | undefined | null | void> = new vscode.EventEmitter<SharedCommentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SharedCommentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private disposables: vscode.Disposable[] = [];
    
    constructor(private commentManager: CommentManager) {
        // 监听注释管理器变化事件
        const commentUpdateDisposable = this.commentManager.onDidChangeComments(() => {
            logger.debug('🔄 [SharedCommentTreeProvider] 注释变化，触发树刷新');
            this.refresh();
        });
        
        // 监听共享注释变化事件
        const sharedCommentUpdateDisposable = this.commentManager.onDidChangeSharedComments(() => {
            logger.debug('🔄 [SharedCommentTreeProvider] 共享注释变化，触发树刷新和上下文更新');
            this.refresh();
            this.updateContext();
        });
        
        this.disposables.push(commentUpdateDisposable, sharedCommentUpdateDisposable);
    }

    refresh(): void {
        logger.debug('🔄 [SharedCommentTreeProvider] 执行完整刷新 - 触发树数据变更事件');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SharedCommentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SharedCommentTreeItem): Thenable<SharedCommentTreeItem[]> {
        if (!element) {
            // 根节点，返回所有有共享注释的文件
            return Promise.resolve(this.getFileNodes());
        } else if (element.contextValue === 'file') {
            // 文件节点，返回该文件的所有共享注释
            return Promise.resolve(this.getSharedCommentNodes(element.filePath!));
        }
        return Promise.resolve([]);
    }

    private getFileNodes(): SharedCommentTreeItem[] {
        const allSharedComments = this.commentManager.getAllSharedComments();
        const fileNodes: SharedCommentTreeItem[] = [];

        // 获取所有有共享注释的文件
        const allFiles = Object.keys(allSharedComments);

        for (const filePath of allFiles) {
            const sharedComments = allSharedComments[filePath] || [];
            
            if (sharedComments.length > 0) {
                const fileName = path.basename(filePath);
                
                // 创建文件节点的显示名称
                const displayName = `${fileName} (${sharedComments.length})`;
                
                let tooltip = filePath;
                
                // 添加共享注释统计信息到tooltip
                const uniqueUsers = new Set(sharedComments.map(c => c.username || c.userId));
                tooltip += `\n\n共享注释统计:\n` +
                          `总数量: ${sharedComments.length}\n` +
                          `贡献用户: ${uniqueUsers.size}人`;
                
                const fileNode = new SharedCommentTreeItem(
                    displayName,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'file'
                );
                fileNode.filePath = filePath;
                fileNode.tooltip = tooltip;
                fileNode.iconPath = new vscode.ThemeIcon('cloud');
                
                fileNodes.push(fileNode);
            }
        }

        if (fileNodes.length === 0) {
            const emptyNode = new SharedCommentTreeItem(
                '暂无共享注释',
                vscode.TreeItemCollapsibleState.None,
                'empty'
            );
            emptyNode.iconPath = new vscode.ThemeIcon('info');
            return [emptyNode];
        }

        // 按文件名排序
        return fileNodes.sort((a, b) => {
            const nameA = path.basename(a.filePath || '');
            const nameB = path.basename(b.filePath || '');
            return nameA.localeCompare(nameB);
        });
    }

    private getSharedCommentNodes(filePath: string): SharedCommentTreeItem[] {
        const sharedComments = this.commentManager.getAllSharedComments()[filePath] || [];
        const commentNodes: SharedCommentTreeItem[] = [];

        for (const comment of sharedComments) {
            // 检查注释是否匹配到本地代码
            const isMatched = comment.isMatched !== false; // 默认为true，只有明确设置为false时才为未匹配
            
            // 构建标签，包含用户信息和注释内容
            let label = `第${comment.line + 1}行: `;
            
            // 添加用户信息
            if (comment.username) {
                label += `[${comment.username}] `;
            } else if (comment.userId) {
                label += `[用户${comment.userId}] `;
            }
            
            // 添加注释内容（截断过长的内容）
            const maxLength = 50;
            const content = comment.content.length > maxLength 
                ? comment.content.substring(0, maxLength) + '...'
                : comment.content;
            label += content;
            
            const commentNode = new SharedCommentTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                isMatched ? 'shared-comment' : 'shared-comment-unmatched' // 使用不同的contextValue来区分匹配和未匹配的注释
            );
            
            commentNode.filePath = filePath;
            commentNode.sharedComment = comment;
            
            // 设置图标和样式
            if (isMatched) {
                // 匹配的注释使用正常图标
                commentNode.iconPath = new vscode.ThemeIcon('comment');
            } else {
                // 未匹配的注释使用暗色主题图标，模仿本地注释的隐藏状态
                commentNode.iconPath = new vscode.ThemeIcon('comment-unresolved');
                
                // 为未匹配的注释设置描述和特殊的tooltip
                commentNode.description = '⚠️ 未匹配';
                commentNode.tooltip = new vscode.MarkdownString(`**⚠️ 未匹配的共享注释**\n\n此注释在当前代码中找不到对应的内容，可能是代码已被修改或删除。\n\n**用户**: ${comment.username || `用户${comment.userId}`}\n\n**原始位置**: 第 ${comment.line + 1} 行\n\n**内容**:\n${comment.content}\n\n**原始代码**:\n\`${comment.lineContent || '无代码快照'}\``);
                
                // 应用特殊CSS类，模仿本地注释的隐藏状态处理
                commentNode.resourceUri = vscode.Uri.parse(`hidden-shared-comment:${comment.id}`);
            }
            
            // 创建Markdown格式的tooltip（如果还没有设置的话）
            if (!commentNode.tooltip) {
                const markdownTooltip = new vscode.MarkdownString();
                markdownTooltip.appendMarkdown(`**共享注释**\n\n`);
                
                // 显示用户信息
                if (comment.username) {
                    markdownTooltip.appendMarkdown(`**用户**: ${comment.username}\n\n`);
                } else if (comment.userId) {
                    markdownTooltip.appendMarkdown(`**用户ID**: ${comment.userId}\n\n`);
                }
                
                markdownTooltip.appendMarkdown(`**位置**: 第 ${comment.line + 1} 行\n\n`);
                markdownTooltip.appendMarkdown(`**内容**:\n${comment.content}\n\n`);
                
                if (comment.lineContent) {
                    markdownTooltip.appendMarkdown(`**代码**: \`${comment.lineContent}\`\n\n`);
                }
                
                markdownTooltip.appendMarkdown(`**创建时间**: ${new Date(comment.timestamp).toLocaleString()}`);
                
                commentNode.tooltip = markdownTooltip;
            }
            
            // 小箭头图标通过 package.json 中的 menus 配置自动显示
            
            // 添加命令，点击时跳转到对应位置（通过右键菜单或双击）
            commentNode.command = {
                command: COMMANDS.GO_TO_COMMENT,
                title: '跳转到共享注释',
                arguments: [filePath, comment.line]
            };
            
            commentNodes.push(commentNode);
        }

        // 按行号排序
        return commentNodes.sort((a, b) => {
            const lineA = a.sharedComment?.line ?? Number.MAX_SAFE_INTEGER;
            const lineB = b.sharedComment?.line ?? Number.MAX_SAFE_INTEGER;
            return lineA - lineB;
        });
    }

    /**
     * 更新共享注释相关的上下文变量
     */
    private updateContext(): void {
        // 检查是否有共享注释
        const allSharedComments = this.commentManager.getAllSharedComments();
        const hasSharedComments = Object.values(allSharedComments).some(comments => comments.length > 0);
        
        // 更新上下文变量
        vscode.commands.executeCommand('setContext', CONTEXT_KEYS.HAS_SHARED_COMMENTS, hasSharedComments);
    }

    dispose(): void {
        // 清理所有disposables
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

export class SharedCommentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
    }

    filePath?: string;
    sharedComment?: SharedComment;
}

