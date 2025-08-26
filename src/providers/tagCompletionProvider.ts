import * as vscode from 'vscode';
import { TagManager } from '../managers/tagManager';
import { getFileNameFromPath } from '../utils/pathUtils';
import { CommentManager } from '../managers/commentManager';

export class TagCompletionProvider implements vscode.CompletionItemProvider {
    constructor(
        private tagManager: TagManager,
        private commentManager: CommentManager
    ) {}

    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        
        // 检查当前位置是否在注释中
        const comments = this.commentManager.getComments(document.uri);
        const currentComment = comments.find(c => c.line === position.line);
        
        if (!currentComment) {
            return [];
        }

        // 获取当前行的文本
        const lineText = document.lineAt(position.line).text;
        const lineLength = lineText.length;
        
        // 注释内容的起始位置：行末 + 4个字符 
        const contentStart = lineLength + 4;
        
        // 检查光标是否在注释区域内
        if (position.character < contentStart) {
            return [];
        }

        // 计算在注释内容中的相对位置
        const relativePosition = position.character - contentStart;
        const commentContent = currentComment.content;
        
        if (relativePosition < 0 || relativePosition > commentContent.length) {
            return [];
        }

        // 检查光标前的字符是否是 @
        const textBeforeCursor = commentContent.substring(0, relativePosition);
        const atMatch = textBeforeCursor.match(/@([a-zA-Z_][a-zA-Z0-9_]*)$/);
        
        if (!atMatch && !textBeforeCursor.endsWith('@')) {
            return [];
        }

        // 获取可用的标签
        const availableTags = this.tagManager.getAvailableTagNames();
        const completionItems: vscode.CompletionItem[] = [];

        for (const tagName of availableTags) {
            const declaration = this.tagManager.getTagDeclaration(tagName);
            if (declaration) {
                const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Reference);
                item.detail = `标签引用: $${tagName}`;
                item.documentation = new vscode.MarkdownString(
                    `**标签声明位置:**\n\n` +
                    `文件: ${getFileNameFromPath(declaration.filePath)}\n\n` +
                    `行号: ${declaration.line + 1}\n\n` +
                    `内容: ${declaration.content}`
                );
                
                // 设置插入文本
                if (textBeforeCursor.endsWith('@')) {
                    item.insertText = tagName;
                } else {
                    // 替换已经输入的部分
                    const partialTag = atMatch![1];
                    item.insertText = tagName;
                    item.range = new vscode.Range(
                        position.line,
                        position.character - partialTag.length,
                        position.line,
                        position.character
                    );
                }
                
                item.sortText = `0${tagName}`; // 确保标签补全排在前面
                completionItems.push(item);
            }
        }

        return completionItems;
    }
} 