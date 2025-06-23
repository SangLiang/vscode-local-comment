import * as vscode from 'vscode';
import { CommentManager } from './commentManager';
import { CommentProvider } from './providers/commentProvider';
import { CommentTreeProvider } from './providers/commentTreeProvider';
import { TagManager } from './tagManager';
import { TagCompletionProvider } from './providers/tagCompletionProvider';
import { TagDefinitionProvider } from './providers/tagDefinitionProvider';
import * as path from 'path';
import * as fs from 'fs';
import { registerCommands } from './modules/commands';

let commentManager: CommentManager;
let commentProvider: CommentProvider;
let commentTreeProvider: CommentTreeProvider;
let tagManager: TagManager;

// 全局变量，用于跟踪最后一次键盘活动时间
let lastKeyboardActivity = Date.now();
const KEYBOARD_ACTIVITY_THRESHOLD = 1000; // 1秒内有键盘活动才视为手动编辑

export function activate(context: vscode.ExtensionContext) {
    console.log('本地注释插件已激活');

    // 初始化管理器
    commentManager = new CommentManager(context);
    commentProvider = new CommentProvider(commentManager);
    commentTreeProvider = new CommentTreeProvider(commentManager);
    tagManager = new TagManager();

    // 初始化标签数据
    tagManager.updateTags(commentManager.getAllComments());

    // 注册命令
    const commandDisposables = registerCommands(context, commentManager, tagManager, commentProvider, commentTreeProvider);

    // 注册用于修改树视图样式的CSS
    const decorationProvider = vscode.window.registerFileDecorationProvider({
        provideFileDecoration: (uri) => {
            if (uri.scheme === 'hidden-comment') {
                return {
                    propagate: true,
                    color: new vscode.ThemeColor('descriptionForeground'),
                    tooltip: '此注释当前无法匹配到代码'
                };
            }
            return undefined;
        }
    });
    context.subscriptions.push(decorationProvider);

    // 注册自动补全和定义提供器
    const completionProvider = new TagCompletionProvider(tagManager, commentManager);
    const definitionProvider = new TagDefinitionProvider(tagManager, commentManager);

    const completionDisposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file' },
        completionProvider,
        '@'
    );

    const definitionDisposable = vscode.languages.registerDefinitionProvider(
        { scheme: 'file' },
        definitionProvider
    );

    // 注册树视图
    const treeView = vscode.window.createTreeView('localComments', {
        treeDataProvider: commentTreeProvider,
        showCollapseAll: true
    });

    // 初始化时等待编辑器准备就绪
    if (vscode.window.activeTextEditor) {
        // 如果已经有活动的编辑器，立即刷新
        commentProvider.refresh();
        commentTreeProvider.refresh();
    }

    // 监听编辑器变化
    const onDidChangeActiveTextEditor = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            // 编辑器切换时刷新
            commentProvider.refresh();
            commentTreeProvider.refresh();
        }
    });

    // 监听文档打开
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(() => {
        // 文档打开时刷新
        commentProvider.refresh();
        commentTreeProvider.refresh();
    });

    // 监听文档变化
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        // 获取当前时间
        const now = Date.now();
        // 只有在最近有键盘活动的情况下才更新代码快照
        const hasRecentKeyboardActivity = (now - lastKeyboardActivity < KEYBOARD_ACTIVITY_THRESHOLD);
        
        // 传递键盘活动信息给commentManager
        commentManager.handleDocumentChange(event, hasRecentKeyboardActivity);
        tagManager.updateTags(commentManager.getAllComments());
        commentProvider.refresh();
        commentTreeProvider.refresh();
    });

    // 添加键盘事件监听
    const onDidChangeTextEditorSelection = vscode.window.onDidChangeTextEditorSelection(() => {
        // 更新最后一次键盘活动时间
        lastKeyboardActivity = Date.now();
    });

    // 添加键盘输入事件监听（更全面的键盘活动捕获）
    const onDidChangeTextEditorVisibleRanges = vscode.window.onDidChangeTextEditorVisibleRanges(() => {
        // 更新最后一次键盘活动时间
        lastKeyboardActivity = Date.now();
    });

    // 在注册自动补全和定义提供器的部分后添加
    const hoverDisposable = vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        commentProvider
    );

    context.subscriptions.push(
        ...commandDisposables,
        onDidChangeTextDocument,
        onDidChangeActiveTextEditor,
        onDidChangeTextEditorSelection,
        onDidChangeTextEditorVisibleRanges,
        onDidOpenTextDocument,
        commentProvider,
        treeView,
        completionDisposable,
        definitionDisposable,
        hoverDisposable
    );
    
    console.log('✅ 本地注释插件激活完成');
}

export function deactivate() {
    if (commentProvider) {
        commentProvider.dispose();
    }
}

// 注意：showQuickInputWithTagCompletion 函数已移动到 src/quickInput.ts 中统一管理

// 在文件末尾添加WebView多行输入函数
async function showWebViewInput(
    context: vscode.ExtensionContext,
    prompt: string, 
    placeholder: string = '', 
    existingContent: string = '',
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        selectedText?: string;
    },
    markedJsUri: string = ''
): Promise<string | undefined> {
    // 保存当前活动编辑器的引用，以便稍后恢复焦点
    const activeEditor = vscode.window.activeTextEditor;
    
    return new Promise((resolve) => {
        // 创建WebView面板
        const panel = vscode.window.createWebviewPanel(
            'localCommentInput',
            '本地注释输入',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: false,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'src')]
            }
        );

        // 获取marked.js的本地路径
        const markedJsPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'lib', 'marked.min.js');
        const markedJsUri = panel.webview.asWebviewUri(markedJsPath);

        // 修复：使用正确的方法名获取标签
        const allTags = tagManager.getAvailableTagNames();
        const tagSuggestions = allTags.map(tag => `@${tag}`).join(',');

        // HTML内容
        panel.webview.html = getWebviewContent(prompt, placeholder, existingContent, tagSuggestions, contextInfo, markedJsUri.toString());

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
        });
    }
}

function getWebviewContent(
    prompt: string,
    placeholder: string,
    existingContent: string,
    tagSuggestions: string,
    contextInfo?: {
        fileName?: string;
        lineNumber?: number;
        lineContent?: string;
        selectedText?: string;
    },
    markedJsUri: string = ''
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
        } else if (contextInfo.lineContent) {
            contextHtml += `<div class="context-item">
                <span class="context-label">代码:</span>
                <div class="context-value">
                    <div class="code-preview">${escapeHtml(contextInfo.lineContent)}</div>
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
        tagSuggestions,
        markedJsUri: markedJsUri || ''
    };

    // 读取模板文件
    const templatePath = path.join(__dirname, '..', 'src', 'templates', 'commentInput.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // 使用正则表达式一次性替换所有变量
    template = template.replace(/\${(\w+)}/g, (match, key: string) => {
        return templateVariables[key] || '';
    });

    return template;
}
