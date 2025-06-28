import * as vscode from 'vscode';
import * as path from 'path';
import { CommentManager, LocalComment, FileComments } from '../commentManager';
import { FileHeatManager } from '../fileHeatManager';

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData: vscode.EventEmitter<CommentTreeItem | undefined | null | void> = new vscode.EventEmitter<CommentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private disposables: vscode.Disposable[] = [];

    constructor(private commentManager: CommentManager, private fileHeatManager?: FileHeatManager) {
        // 监听文件热度更新事件，只有在热度更新时才刷新排序
        if (this.fileHeatManager) {
            const heatUpdateDisposable = this.fileHeatManager.onDidUpdateHeat(() => {
                this.refresh();
            });
            this.disposables.push(heatUpdateDisposable);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommentTreeItem): Thenable<CommentTreeItem[]> {
        if (!element) {
            // 根节点，返回所有有注释的文件
            return Promise.resolve(this.getFileNodes());
        } else if (element.contextValue === 'file') {
            // 文件节点，返回该文件的所有注释
            return Promise.resolve(this.getCommentNodes(element.filePath!));
        }
        return Promise.resolve([]);
    }

    private getFileNodes(): CommentTreeItem[] {
        const allComments = this.commentManager.getAllComments();
        const fileNodes: CommentTreeItem[] = [];

        for (const [filePath, comments] of Object.entries(allComments)) {
            if (comments.length > 0) {
                const fileName = path.basename(filePath);
                
                // 创建文件节点的显示名称，包含热度信息
                let displayName = `${fileName} (${comments.length})`;
                let tooltip = filePath;
                
                // 如果有文件热度管理器，添加热度信息
                if (this.fileHeatManager) {
                    const heatInfo = this.fileHeatManager.getFileHeatInfo(filePath);
                    const heatScore = this.fileHeatManager.calculateHeatScore(filePath);
                    
                    if (heatInfo && heatScore > 0) {
                        // 在tooltip中显示详细的热度信息
                        const lastAccessTime = new Date(heatInfo.lastAccessTime).toLocaleString();
                        const lastEditTime = heatInfo.lastEditTime > 0 ? 
                            new Date(heatInfo.lastEditTime).toLocaleString() : '未编辑';
                        const activeMinutes = Math.round(heatInfo.totalActiveTime / (60 * 1000));
                        
                        tooltip = `${filePath}\n\n📊 文件热度信息:\n` +
                                `🔥 热度分数: ${heatScore.toFixed(1)}\n` +
                                `👁️ 访问次数: ${heatInfo.accessCount}\n` +
                                `✏️ 编辑次数: ${heatInfo.editCount}\n` +
                                `🕒 最后访问: ${lastAccessTime}\n` +
                                `📝 最后编辑: ${lastEditTime}\n` +
                                `⏱️ 活跃时间: ${activeMinutes}分钟`;
                        
                        // 给当前正在编辑的文件添加特殊标识
                        const currentEditor = vscode.window.activeTextEditor;
                        if (currentEditor && currentEditor.document.uri.fsPath === filePath) {
                            displayName = `🔥 ${displayName}`;
                        }
                    }
                }
                
                const fileNode = new CommentTreeItem(
                    displayName,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'file'
                );
                fileNode.filePath = filePath;
                fileNode.tooltip = tooltip;
                fileNode.iconPath = new vscode.ThemeIcon('file-code');
                fileNodes.push(fileNode);
            }
        }

        if (fileNodes.length === 0) {
            const emptyNode = new CommentTreeItem(
                '暂无本地注释',
                vscode.TreeItemCollapsibleState.None,
                'empty'
            );
            emptyNode.iconPath = new vscode.ThemeIcon('info');
            return [emptyNode];
        }

        // 按文件热度排序
        if (this.fileHeatManager) {
            const filePaths = fileNodes.map(node => node.filePath!);
            const sortedFilePaths = this.fileHeatManager.getFilesByHeat(filePaths);
            
            // 重新排序文件节点
            const sortedFileNodes: CommentTreeItem[] = [];
            for (const filePath of sortedFilePaths) {
                const node = fileNodes.find(n => n.filePath === filePath);
                if (node) {
                    sortedFileNodes.push(node);
                }
            }
            return sortedFileNodes;
        }

        // 如果没有热度管理器，按文件名排序
        return fileNodes.sort((a, b) => {
            const nameA = path.basename(a.filePath || '');
            const nameB = path.basename(b.filePath || '');
            return nameA.localeCompare(nameB);
        });
    }

    private getCommentNodes(filePath: string): CommentTreeItem[] {
        // 使用getComments方法获取最新的注释状态
        const uri = vscode.Uri.file(filePath);
        const matchedComments = this.commentManager.getComments(uri);
        const commentNodes: CommentTreeItem[] = [];

        // 获取所有注释（包括未匹配的）
        const allComments = this.commentManager.getAllComments()[filePath] || [];

        // 创建匹配注释的Map，提高查找效率
        const matchedCommentsMap = new Map(
            matchedComments.map(comment => [comment.id, comment])
        );

        // 处理所有注释，包括未匹配的
        for (const comment of allComments) {
            // 使用Map快速查找匹配的注释
            const matchedComment = matchedCommentsMap.get(comment.id);
            const isMatchable = matchedComment !== undefined;
            
            const label = `第${(matchedComment?.line || comment.line) + 1}行: ${comment.content}`;
            
            const commentNode = new CommentTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                isMatchable ? 'comment' : 'hidden-comment'
            );
            
            commentNode.filePath = filePath;
            commentNode.comment = matchedComment || comment;
            
            // 创建Markdown格式的tooltip
            const markdownTooltip = new vscode.MarkdownString();
            markdownTooltip.appendMarkdown(comment.content);
            
            if (!isMatchable) {
                // 添加隐藏状态的提示
                markdownTooltip.appendMarkdown('\n\n*注释当前无法匹配到代码，已被隐藏*');
                // 使用暗色主题图标
                commentNode.iconPath = new vscode.ThemeIcon('comment-unresolved');
                // 应用特殊CSS类
                commentNode.resourceUri = vscode.Uri.parse(`hidden-comment:${comment.id}`);
            } else {
                commentNode.iconPath = new vscode.ThemeIcon('comment');
            }
            
            commentNode.tooltip = markdownTooltip;
            
            // 添加命令，点击时跳转到对应位置
            // 即使是隐藏注释也可以尝试跳转，用户可能想手动查找
            commentNode.command = {
                command: 'localComment.goToComment',
                title: '跳转到注释',
                arguments: [filePath, matchedComment?.line || comment.line]
            };

            commentNodes.push(commentNode);
        }

        // 按行号排序
        return commentNodes.sort((a, b) => {
            const lineA = a.comment?.line ?? Number.MAX_SAFE_INTEGER;
            const lineB = b.comment?.line ?? Number.MAX_SAFE_INTEGER;
            return lineA - lineB;
        });
    }

    dispose(): void {
        // 清理所有disposables
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

export class CommentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string
    ) {
        super(label, collapsibleState);
    }

    filePath?: string;
    comment?: LocalComment;
}

// 为CommentTreeProvider添加dispose方法
export interface CommentTreeProviderDisposable {
    dispose(): void;
}