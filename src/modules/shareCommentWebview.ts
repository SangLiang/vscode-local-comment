import * as vscode from 'vscode';
import * as fs from 'fs';
import { CommentManager } from '../managers/commentManager';

// 模板缓存，避免重复读取文件
let templateCache: string | null = null;

// 全局注释管理器引用
let globalCommentManager: CommentManager | null = null;

// 设置全局注释管理器引用
export function setCommentManager(commentManager: CommentManager) {
    globalCommentManager = commentManager;
}

export async function showShareCommentWebview(
    context: vscode.ExtensionContext,
    markdownContent: string,
    title: string = '注释预览',
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        originalLineContent?: string;
        selectedText?: string;
        contextLines?: string[];
        contextStartLine?: number;
        filePath?: string;
        sharedCommentId?: string; // 新增：共享注释ID
        userId?: string; // 新增：用户ID
        username?: string; // 新增：用户名
        timestamp?: number; // 新增：时间戳
    }
): Promise<void> {
    // 保存当前活动编辑器的引用，以便稍后恢复焦点
    const activeEditor = vscode.window.activeTextEditor;
    
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
        'shareCommentPreview',
        title,
        viewColumn,
        {
            enableScripts: true,
            retainContextWhenHidden: true,  // 用户切换tab时，保留状态
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'shareComment'),
                vscode.Uri.joinPath(context.extensionUri, 'src', 'lib')
            ],
            enableCommandUris: false,
            enableFindWidget: false
        }
    );

    // 获取资源文件的本地路径
    const markedJsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'lib', 'marked.min.js');
    const markedJsUri = panel.webview.asWebviewUri(markedJsPath);
    
    const cssPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'shareComment', 'shareComment.css');
    const cssUri = panel.webview.asWebviewUri(cssPath);
    
    const jsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'shareComment', 'shareComment.js');
    const jsUri = panel.webview.asWebviewUri(jsPath);
    
    const mermaidJsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'lib', 'mermaid.min.js');
    const mermaidJsUri = panel.webview.asWebviewUri(mermaidJsPath);

    // HTML内容
    panel.webview.html = getShareCommentWebviewContent(
        context, 
        markdownContent, 
        contextInfo, 
        markedJsUri.toString(), 
        cssUri.toString(), 
        jsUri.toString(), 
        mermaidJsUri.toString(), 
        panel.webview
    );

    // 异步发送Mermaid主题配置
    setTimeout(() => {
        try {
            const config = vscode.workspace.getConfiguration('local-comment');
            const mermaidTheme = config.get<string>('mermaid.theme', 'default');
            panel.webview.postMessage({
                command: 'setMermaidTheme',
                theme: mermaidTheme
            });
        } catch (error) {
            console.error('发送Mermaid主题配置失败:', error);
        }
    }, 0);

    // 处理WebView消息
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'close':
                    panel.dispose();
                    // WebView关闭后恢复编辑器焦点
                    setTimeout(() => restoreFocus(activeEditor), 100);
                    break;
                case 'exportToLocalComment':
                    // 处理导出为本地注释的请求
                    await handleExportToLocalComment(context, contextInfo);
                    break;
            }
        }
    );

    // 面板关闭时恢复编辑器焦点
    panel.onDidDispose(() => {
        // WebView关闭后恢复编辑器焦点
        setTimeout(() => restoreFocus(activeEditor), 100);
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

// 处理导出为本地注释的请求
async function handleExportToLocalComment(
    context: vscode.ExtensionContext,
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        originalLineContent?: string;
        selectedText?: string;
        contextLines?: string[];
        contextStartLine?: number;
        filePath?: string;
        sharedCommentId?: string;
        userId?: string;
        username?: string;
        timestamp?: number;
        commentContent?: string; // 新增：注释内容
    }
): Promise<void> {
    try {
        if (!contextInfo?.filePath || contextInfo.lineNumber === undefined) {
            vscode.window.showErrorMessage('无法导出：缺少必要的文件信息');
            return;
        }

        // 获取注释内容
        const commentContent = contextInfo.commentContent;
        if (!commentContent) {
            vscode.window.showErrorMessage('无法获取注释内容');
            return;
        }

        // 创建本地注释
        const localComment = {
            id: generateCommentId(),
            line: contextInfo.lineNumber,
            content: commentContent,
            timestamp: Date.now(),
            originalLine: contextInfo.lineNumber,
            lineContent: contextInfo.lineContent || '',
            isMatched: true,
            isShared: false
        };

        // 获取注释管理器并添加注释
        const commentManager = getCommentManager(context);
        if (commentManager) {
            // 检查该行是否已有本地注释
            const existingLocalComment = commentManager.getLocalCommentAtLine(contextInfo.filePath, contextInfo.lineNumber);
            
            if (existingLocalComment) {
                // 该行已有本地注释，询问是否覆盖
                const overwriteChoice = await vscode.window.showWarningMessage(
                    `第 ${contextInfo.lineNumber + 1} 行已有本地注释：\n"${existingLocalComment.content}"\n\n是否要覆盖为新的注释？`,
                    { modal: true },
                    '覆盖',
                    '取消'
                );
                
                if (overwriteChoice !== '覆盖') {
                    return; // 用户选择取消
                }
            }
            
            // 使用专门的方法添加注释，保留共享注释的原始lineContent
            await commentManager.addCommentFromShared(
                contextInfo.filePath,
                localComment.line,
                localComment.content,
                localComment.lineContent,
                localComment.originalLine,
                localComment.isMatched,
                true // 强制覆盖，因为用户已经确认
            );

            vscode.window.showInformationMessage(
                `已成功将共享注释导出为本地注释！\n文件：${contextInfo.fileName || '未知文件'}\n行号：第${contextInfo.lineNumber + 1}行`
            );

            // 刷新注释显示
            vscode.commands.executeCommand('localComment.refreshComments');
        } else {
            vscode.window.showErrorMessage('无法获取注释管理器');
        }
    } catch (error) {
        console.error('导出为本地注释失败:', error);
        vscode.window.showErrorMessage(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
}

// 从webview获取注释内容
async function getCommentContentFromWebview(): Promise<string | null> {
    try {
        // 这里我们需要从webview获取当前显示的注释内容
        // 由于webview已经关闭，我们需要从contextInfo中获取原始内容
        // 或者通过其他方式获取内容
        return null; // 暂时返回null，需要实现具体逻辑
    } catch (error) {
        console.error('获取注释内容失败:', error);
        return null;
    }
}

// 获取注释管理器
function getCommentManager(context: vscode.ExtensionContext): CommentManager | null {
    // 返回全局注释管理器引用
    return globalCommentManager;
}

// 生成注释ID
function generateCommentId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getShareCommentWebviewContent(
    context: vscode.ExtensionContext,
    markdownContent: string,
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        originalLineContent?: string;
        selectedText?: string;
        contextLines?: string[];
        contextStartLine?: number;
        filePath?: string;
    },
    markedJsUri: string = '',
    cssUri: string = '',
    jsUri: string = '',
    mermaidJsUri: string = '',
    webview?: vscode.Webview
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

    // 生成nonce用于CSP
    const nonce = getNonce();

    // 构建上下文信息HTML
    let contextHtml = '';
    if (contextInfo) {
        contextHtml = '<div class="context-info">';
        contextHtml += '<div class="context-title">代码上下文</div>';
        
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
        }
        
        contextHtml += '</div>';
    }

    // 准备模板变量
    const templateVariables: Record<string, string> = {
        contextHtml,
        escapedContent: escapeHtml(markdownContent || ''),
        markedJsUri: markedJsUri || '',
        cssUri: cssUri || '',
        jsUri: jsUri || '',
        mermaidJsUri: mermaidJsUri || '',
        cspSource: webview ? webview.cspSource : "'self'"
    };

    // 优化：使用缓存避免重复读取模板文件
    if (!templateCache) {
        const templatePath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'shareComment', 'shareComment.html');
        templateCache = fs.readFileSync(templatePath.fsPath, 'utf8');
    }
    let template = templateCache;

    // 使用正则表达式一次性替换所有变量
    template = template.replace(/\${(\w+)}/g, (match, key: string) => {
        return templateVariables[key] || '';
    });

    return template;
}

// 添加getNonce函数
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
