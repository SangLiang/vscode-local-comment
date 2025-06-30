import * as vscode from 'vscode';
import * as fs from 'fs';
import { TagManager } from '../tagManager';
import { CommentManager } from '../commentManager';

// 辅助函数：获取代码上下文（前后5行）
export async function getCodeContext(uri: vscode.Uri, lineNumber: number, contextLines: number = 5): Promise<{
    contextLines: string[];
    contextStartLine: number;
}> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const totalLines = document.lineCount;
        
        // 计算上下文的开始和结束行
        const startLine = Math.max(0, lineNumber - contextLines);
        const endLine = Math.min(totalLines - 1, lineNumber + contextLines);
        
        // 获取上下文行的内容
        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            try {
                const lineText = document.lineAt(i).text;
                lines.push(lineText);
            } catch (error) {
                // 如果某行无法读取，添加空行
                lines.push('');
            }
        }
        
        return {
            contextLines: lines,
            contextStartLine: startLine
        };
    } catch (error) {
        console.error('获取代码上下文失败:', error);
        return {
            contextLines: [],
            contextStartLine: 0
        };
    }
}

export async function showWebViewInput(
    context: vscode.ExtensionContext,
    prompt: string, 
    placeholder: string = '', 
    existingContent: string = '',
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string; // 当前行的实际内容
        originalLineContent?: string; // 注释保存的代码快照
        selectedText?: string;
        contextLines?: string[]; // 前后5行的代码内容
        contextStartLine?: number; // 上下文开始的行号
    },
    markedJsUri: string = ''
): Promise<string | undefined> {
    // 保存当前活动编辑器的引用，以便稍后恢复焦点
    const activeEditor = vscode.window.activeTextEditor;
    
    return new Promise((resolve) => {
        // 智能分屏：限制最多两个列，在第一列和第二列之间切换
        let viewColumn = vscode.ViewColumn.One;
        if (activeEditor) {
            if (activeEditor.viewColumn === vscode.ViewColumn.One) {
                // 如果当前在第一列，在第二列打开编辑器
                viewColumn = vscode.ViewColumn.Two;
            } else {
                // 如果当前在第二列或更高列，在第一列打开编辑器
                viewColumn = vscode.ViewColumn.One;
            }
        }
        
        // 创建WebView面板
        const panel = vscode.window.createWebviewPanel(
            'localCommentInput',
            '📝 本地注释编辑',
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src')]
            }
        );

        // 获取marked.js的本地路径
        const markedJsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'lib', 'marked.min.js');
        const markedJsUri = panel.webview.asWebviewUri(markedJsPath);

        // 获取标签建议
        const commentManager = new CommentManager(context);
        const tagManager = new TagManager();
        tagManager.updateTags(commentManager.getAllComments());
        const tagSuggestions = tagManager.getAvailableTagNames().map(tag => `@${tag}`).join(',');

        // HTML内容
        panel.webview.html = getWebviewContent(context, prompt, placeholder, existingContent, contextInfo, markedJsUri.toString(), tagSuggestions);

        // 处理WebView消息
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'save':
                        resolve(message.content);
                        panel.dispose();
                        // WebView关闭后恢复编辑器焦点
                        setTimeout(() => restoreFocus(activeEditor), 100);
                        break;
                    case 'cancel':
                        resolve(undefined);
                        panel.dispose();
                        // WebView关闭后恢复编辑器焦点
                        setTimeout(() => restoreFocus(activeEditor), 100);
                        break;
                }
            }
        );

        // 面板关闭时返回undefined
        panel.onDidDispose(() => {
            resolve(undefined);
            // WebView关闭后恢复编辑器焦点
            setTimeout(() => restoreFocus(activeEditor), 100);
        });
    });
}

// 辅助函数：恢复编辑器焦点
function restoreFocus(editor: vscode.TextEditor | undefined) {
    if (editor) {
        vscode.window.showTextDocument(editor.document, {
            viewColumn: editor.viewColumn,
            selection: editor.selection,
            preserveFocus: false
        }).then(() => {
            // 确保焦点真正回到编辑器
            vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        });
    }
}

function getWebviewContent(
    context: vscode.ExtensionContext,
    prompt: string,
    placeholder: string,
    existingContent: string,
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string; // 当前行的实际内容
        originalLineContent?: string; // 注释保存的代码快照
        selectedText?: string;
        contextLines?: string[]; // 前后5行的代码内容
        contextStartLine?: number; // 上下文开始的行号
    },
    markedJsUri: string = '',
    tagSuggestions: string = ''
): string {
    // HTML转义函数
    const escapeHtml = (text: string): string => {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    // 构建上下文信息HTML
    let contextHtml = '';
    if (contextInfo) {
        contextHtml = '<div class="context-info">';
        contextHtml += '<div class="context-title">📍 代码上下文</div>';
        
        if (contextInfo.fileName) {
            contextHtml += `<div class="context-item">
                <span class="context-label">文件:</span>
                <span class="context-value">${escapeHtml(contextInfo.fileName)}</span>
            </div>`;
        }
        
        if (contextInfo.lineNumber !== undefined) {
            contextHtml += `<div class="context-item">
                <span class="context-label">行号:</span>
                <span class="context-value">第 ${contextInfo.lineNumber + 1} 行</span>
            </div>`;
        }
        
        if (contextInfo.selectedText) {
            contextHtml += `<div class="context-item">
                <span class="context-label">选中:</span>
                <div class="context-value">
                    <div class="code-preview">${escapeHtml(contextInfo.selectedText)}</div>
                </div>
            </div>`;
        } else if (contextInfo.contextLines && contextInfo.contextLines.length > 0) {
            // 显示扩展的上下文信息（前后5行） - 仅当注释能匹配到代码时
            contextHtml += `<div class="context-item">
                <span class="context-label">代码上下文:</span>
                <div class="context-value">
                    <div class="code-context-preview">`;
            
            contextInfo.contextLines.forEach((line, index) => {
                const currentLineNumber = (contextInfo.contextStartLine || 0) + index;
                const isTargetLine = currentLineNumber === contextInfo.lineNumber;
                const lineClass = isTargetLine ? 'target-line' : 'context-line';
                const lineNumberDisplay = currentLineNumber + 1;
                
                contextHtml += `<div class="code-line ${lineClass}">
                    <span class="line-number">${lineNumberDisplay}</span>
                    <span class="line-content">${escapeHtml(line)}</span>
                </div>`;
            });
            
            contextHtml += `    </div>
                </div>
            </div>`;
            
            // 如果当前代码与快照不同，额外显示当前代码
            if (contextInfo.lineContent && contextInfo.lineContent !== contextInfo.originalLineContent) {
                contextHtml += `<div class="context-item">
                    <span class="context-label">当前代码:</span>
                    <div class="context-value">
                        <div class="code-preview current-code">${escapeHtml(contextInfo.lineContent)}</div>
                    </div>
                </div>`;
            }
        } else if (contextInfo.lineContent && !contextInfo.originalLineContent) {
            // 如果没有快照但有当前内容，显示当前内容（新注释场景）
            contextHtml += `<div class="context-item">
                <span class="context-label">当前代码:</span>
                <div class="context-value">
                    <div class="code-preview current-code">${escapeHtml(contextInfo.lineContent)}</div>
                </div>
            </div>`;
        } else if (contextInfo.originalLineContent && !contextInfo.contextLines) {
            // 注释无法匹配到代码时，只显示注释保存的代码快照
            contextHtml += `<div class="context-item">
                <span class="context-label">注释快照:</span>
                <div class="context-value">
                    <div class="code-preview original-code">${escapeHtml(contextInfo.originalLineContent)}</div>
                </div>
            </div>`;
        }
        
        contextHtml += '</div>';
    }

    // 准备模板变量
    const templateVariables: Record<string, string> = {
        contextHtml,
        escapedPrompt: escapeHtml(prompt),
        escapedPlaceholder: escapeHtml(placeholder),
        escapedContent: escapeHtml(existingContent || ''),
        markedJsUri: markedJsUri || '',
        tagSuggestions: tagSuggestions
    };

    // 读取模板文件
    const templatePath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'commentInput.html');
    let template = fs.readFileSync(templatePath.fsPath, 'utf8');

    // 使用正则表达式一次性替换所有变量
    template = template.replace(/\${(\w+)}/g, (match, key: string) => {
        return templateVariables[key] || '';
    });

    return template;
} 