import * as vscode from 'vscode';
import { CommentManager, LocalComment } from '../managers/commentManager';
import { createDataUri } from '../utils/utils';

export class CommentProvider implements vscode.Disposable {
    private decorationType: vscode.TextEditorDecorationType;
    private tagDecorationType: vscode.TextEditorDecorationType;
    private commentManager: CommentManager;
    private isVisible: boolean = true;
    private disposables: vscode.Disposable[] = [];
    private updateTimer: NodeJS.Timeout | null = null; // 防抖定时器
    
    // 预加载的图标URIs
    private commentIconUri: string | null = null;
    private editIconUri: string | null = null;
    private deleteIconUri: string | null = null;
    private markdownIconUri: string | null = null;

    constructor(commentManager: CommentManager) {
        this.commentManager = commentManager;
        
        // 初始创建装饰类型（先不设置图标）
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 行内显示注释内容（不包含图标）
            after: {
                color: '#888888',
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        // 标签装饰器（当前未使用，但保留以避免错误）
        this.tagDecorationType = vscode.window.createTextEditorDecorationType({});

        // 监听编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations()),
            vscode.window.onDidChangeTextEditorSelection(() => this.debouncedUpdateDecorations())
        );

        // 异步加载图标，加载完成后重新创建装饰类型
        this.loadAllIcons().then(() => {
            this.recreateDecorationType();
            this.updateDecorations();
        });

        this.updateDecorations();
    }

    // 异步加载所有图标
    private async loadAllIcons(): Promise<void> {
        try {
            const context = this.commentManager.getContext();
            const [commentIcon, editIcon, deleteIcon, markdownIcon] = await Promise.all([
                createDataUri(context, 'src/resources/pin.svg'), // 注释图标
                createDataUri(context, 'src/resources/edit.svg'), // 编辑图标
                createDataUri(context, 'src/resources/delete.svg'), // 删除图标
                createDataUri(context, 'src/resources/markdown.svg') // Markdown图标
            ]);

            this.commentIconUri = commentIcon;
            this.editIconUri = editIcon;
            this.deleteIconUri = deleteIcon;
            this.markdownIconUri = markdownIcon;
        } catch (error) {
            console.error('加载图标失败:', error);
        }
    }

    // 重新创建装饰类型（加载图标后）
    private recreateDecorationType(): void {
        // 先释放旧的装饰类型
        this.decorationType.dispose();
        
        // 创建新的装饰类型，包含图标
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 在行号区域显示注释图标
            gutterIconPath: this.commentIconUri ? vscode.Uri.parse(this.commentIconUri) : undefined,
            gutterIconSize: 'contain', // 使图标适应行号区域大小
            
            // 行内显示注释内容（不包含图标）
            after: {
                color: '#888888',
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    public refresh(): void {
        this.updateDecorations();
    }

    public toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.updateDecorations();
            vscode.window.showInformationMessage('本地注释已显示');
        } else {
            this.clearDecorations();
            vscode.window.showInformationMessage('本地注释已隐藏');
        }
    }

    private updateDecorations(): void {
        if (!this.isVisible) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const comments = this.commentManager.getComments(editor.document.uri);
        
        const normalDecorations: vscode.DecorationOptions[] = [];
        const tagDecorations: vscode.DecorationOptions[] = [];

        for (const comment of comments) {
            // 确保行号在有效范围内
            if (comment.line >= 0 && comment.line < editor.document.lineCount) {
                const line = editor.document.lineAt(comment.line);
                
                // 创建分段装饰
                const decorations = this.createSegmentedDecorations(comment, line, editor);
                normalDecorations.push(...decorations.normal);
                tagDecorations.push(...decorations.tags);
            }
        }

        editor.setDecorations(this.decorationType, normalDecorations);
        editor.setDecorations(this.tagDecorationType, tagDecorations);
    }

    private createSegmentedDecorations(comment: LocalComment, line: vscode.TextLine, editor: vscode.TextEditor): {normal: vscode.DecorationOptions[], tags: vscode.DecorationOptions[]} {
        const normal: vscode.DecorationOptions[] = [];
        const tags: vscode.DecorationOptions[] = [];
        const lineLength = line.text.length;
        
        // 创建装饰选项
        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(comment.line, lineLength, comment.line, lineLength),
            renderOptions: {
                after: {
                    contentText: ` ${comment.content}`, // 显示注释内容
                    color: '#6B7283', // 灰蓝色
                    fontStyle: 'italic',
                    margin: '0 0 0 0.8em' 
                }
            }
        };
        
        // 所有注释都放到normal数组中
        normal.push(decoration);
        
        return { normal, tags };
    }

    private parseCommentIntoSegments(content: string): Array<{text: string, isTag: boolean}> {
        const segments: Array<{text: string, isTag: boolean}> = [];
        let lastIndex = 0;
        
        // 匹配所有标签（声明和引用）
        const tagRegex = /(\$[a-zA-Z_][a-zA-Z0-9_]*)|(@[a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        
        while ((match = tagRegex.exec(content)) !== null) {
            // 添加标签前的普通文本
            if (match.index > lastIndex) {
                segments.push({
                    text: content.substring(lastIndex, match.index),
                    isTag: false
                });
            }
            
            // 添加标签
            segments.push({
                text: match[0],
                isTag: true
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        // 添加剩余的普通文本
        if (lastIndex < content.length) {
            segments.push({
                text: content.substring(lastIndex),
                isTag: false
            });
        }
        
        // 如果没有找到任何标签，返回整个内容作为普通文本
        if (segments.length === 0) {
            segments.push({
                text: content,
                isTag: false
            });
        }
        
        return segments;
    }

    private extractTagsFromContent(content: string): Array<{text: string, type: 'declaration' | 'reference'}> {
        const tags: Array<{text: string, type: 'declaration' | 'reference'}> = [];
        
        // 匹配所有标签（声明和引用）
        const tagRegex = /(\$[a-zA-Z_][a-zA-Z0-9_]*)|(@[a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        
        while ((match = tagRegex.exec(content)) !== null) {
            tags.push({
                text: match[0],
                type: match[0].startsWith('$') ? 'declaration' : 'reference'
            });
        }
        
        return tags;
    }

    private clearDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
            editor.setDecorations(this.tagDecorationType, []);
        }
    }

    public dispose(): void {
        // 清理防抖定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        this.decorationType.dispose();
        this.tagDecorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }

    private processMarkdownContent(content: string): string {
        return content
            .replace(/\\n/g, '\n')      // \n -> 换行
            .replace(/\\t/g, '\t')      // \t -> 制表符  
            .replace(/\\r/g, '\r')      // \r -> 回车
            .replace(/\\\\/g, '\\')     // \\ -> \
            .replace(/\\"/g, '"')       // \" -> "
            .replace(/\\'/g, "'");      // \' -> '
    }

    // 提供悬浮提示
    public async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        if (!this.isVisible) {
            return;
        }

        const line = position.line;
        const comments = this.commentManager.getComments(document.uri);
        const comment = comments.find(c => c.line === line);

        if (comment) {
            // 使用预加载的图标URIs，如果没有加载完成则跳过图标显示
            const editIconUri = this.editIconUri || '';
            const deleteIconUri = this.deleteIconUri || '';
            const markDownIconUri = this.markdownIconUri || '';

            const markdownContent = new vscode.MarkdownString();
            markdownContent.isTrusted = true;
            markdownContent.supportHtml = true;
            
            // 处理用户输入的转义字符
            const processedContent = this.processMarkdownContent(comment.content);
            
            // 构建Markdown内容
            markdownContent.appendMarkdown(`**本地注释**\n\n`);
            
            // 将注释内容中的@标签转换为可点击的链接
            const segments = this.parseCommentIntoSegments(processedContent);
            let enhancedContent = '';
            
            for (const segment of segments) {
                if (segment.isTag && segment.text.startsWith('@')) {
                    // 提取标签名（去掉@符号）
                    const tagName = segment.text.substring(1);
                    // 创建可点击链接
                    enhancedContent += `[${segment.text}](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})`;
                } else {
                    // 普通文本直接添加
                    enhancedContent += segment.text;
                }
            }
            
            markdownContent.appendMarkdown(enhancedContent);
            markdownContent.appendMarkdown(`\n\n`);
            
            // 添加标签信息部分并进行去重
            const tags = this.extractTagsFromContent(comment.content);
            if (tags.length > 0) {
                // 使用Set进行去重
                const declarationTags = new Set<string>();
                const referenceTags = new Set<string>();
                
                // 收集唯一标签
                for (const tag of tags) {
                    if (tag.type === 'declaration') {
                        declarationTags.add(tag.text);
                    } else {
                        referenceTags.add(tag.text);
                    }
                }
                
                markdownContent.appendMarkdown(`**标签信息**\n\n`);
                
                // 处理声明标签
                for (const tagText of declarationTags) {
                    markdownContent.appendMarkdown(`️**声明**: \`${tagText}\`\n\n`);
                }
                
                // 处理引用标签
                for (const tagText of referenceTags) {
                    const tagName = tagText.substring(1);
                    markdownContent.appendMarkdown(`**引用**: \`${tagText}\` - [跳转到声明](command:localComment.goToTagDeclaration?${encodeURIComponent(JSON.stringify({tagName}))})\n\n`);
                }
            }
            
            markdownContent.appendMarkdown(`---\n`);
            markdownContent.appendMarkdown(`*${new Date(comment.timestamp).toLocaleString()}*\n\n`);
            
            // 添加操作按钮
            const editArgs = JSON.stringify({
                uri: document.uri.toString(),
                commentId: comment.id,
                line: comment.line
            });
            
            const removeArgs = JSON.stringify({
                uri: document.uri.toString(),
                commentId: comment.id,
                line: comment.line
            });

            const editIcon = `<img src="${editIconUri}" width="16" height="16" alt="编辑" style="vertical-align: middle; " />`;
            const deleteIcon = `<img src="${deleteIconUri}" width="16" height="16" alt="删除" style="vertical-align: middle;" />`;
            const markDownIcon = `<img src="${markDownIconUri}" width="16" height="16" alt="Markdown编辑" style="vertical-align: middle;" />`;

            markdownContent.appendMarkdown(`[${editIcon} 编辑](command:localComment.quickEditCommentFromHover?${encodeURIComponent(editArgs)} "快速编辑注释") | `);
            markdownContent.appendMarkdown(`[${markDownIcon} Markdown编辑](command:localComment.editCommentFromHover?${encodeURIComponent(editArgs)} "多行编辑注释") | `);
            markdownContent.appendMarkdown(`[${deleteIcon} 删除](command:localComment.removeCommentFromHover?${encodeURIComponent(removeArgs)} "删除注释")`);
            
            return new vscode.Hover(markdownContent);
        }

        return undefined;
    }

    // 防抖更新方法，避免频繁更新装饰
    private debouncedUpdateDecorations(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this.updateDecorations();
            this.updateTimer = null;
        }, 100); // 100ms防抖延迟
    }
}