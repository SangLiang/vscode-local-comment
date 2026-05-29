import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewUtils } from '../utils/webviewUtils';
import { logger } from '../utils/logger';
import { VIEW_TYPES, IPC_MESSAGES } from '../constants';
import { EditorUtils } from '../utils/editorUtils';

export class MarkdownPreviewWebview {
    private static currentPanel: MarkdownPreviewWebview | undefined;
    private static currentFilePath: string | undefined;

    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly activeEditor: vscode.TextEditor | undefined;
    private disposable: vscode.Disposable | undefined;

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        activeEditor: vscode.TextEditor | undefined
    ) {
        this.panel = panel;
        this.context = context;
        this.activeEditor = activeEditor;

        this.panel.onDidDispose(() => this.dispose());
    }

    static createOrShow(context: vscode.ExtensionContext, content: string, fileName: string, filePath: string): MarkdownPreviewWebview {
        const activeEditor = vscode.window.activeTextEditor;

        if (MarkdownPreviewWebview.currentPanel && MarkdownPreviewWebview.currentFilePath === filePath) {
            MarkdownPreviewWebview.currentPanel.updateContent(content);
            MarkdownPreviewWebview.currentPanel.panel.reveal();
            return MarkdownPreviewWebview.currentPanel;
        }

        if (MarkdownPreviewWebview.currentPanel) {
            MarkdownPreviewWebview.currentPanel.panel.dispose();
        }

        const viewColumn = EditorUtils.smartSelectViewColumn(activeEditor);
        const panel = vscode.window.createWebviewPanel(
            VIEW_TYPES.MARKDOWN_PREVIEW,
            '预览: ' + fileName,
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'markdownPreview'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', 'common'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'lib'),
                    vscode.Uri.joinPath(context.extensionUri, 'out', 'lib')
                ],
                enableCommandUris: false,
                enableFindWidget: false
            }
        );

        const webview = new MarkdownPreviewWebview(panel, context, activeEditor);
        MarkdownPreviewWebview.currentPanel = webview;
        MarkdownPreviewWebview.currentFilePath = filePath;

        webview.initialize(content, fileName);
        return webview;
    }

    static previewFile(context: vscode.ExtensionContext): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
            return;
        }

        const document = activeEditor.document;
        const filePath = document.uri.fsPath;
        const fileName = path.basename(filePath);
        const content = document.getText();

        MarkdownPreviewWebview.createOrShow(context, content, fileName, filePath);
    }

    private initialize(content: string, fileName: string): void {
        const config = vscode.workspace.getConfiguration('local-comment');
        const highlightTheme = config.get<string>('codeHighlight.theme', 'github-dark');

        const resourceUris = WebviewUtils.buildResourceUris(this.panel.webview, this.context.extensionUri, {
            markedJs: true,
            css: 'markdownPreview/preview.css',
            js: 'markdownPreview/preview.js',
            mermaidJs: true,
            katexJs: true,
            katexCss: true,
            highlightJs: true,
            highlightCss: true,
            highlightTheme: highlightTheme,
            customResources: [
                { path: 'src/templates/common/public.js', name: 'publicJsUri' }
            ]
        });

        this.panel.webview.html = this.getWebviewContent(content, fileName, resourceUris);

        let configPostTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
            configPostTimer = undefined;
            try {
                const config = vscode.workspace.getConfiguration('local-comment');
                const mermaidTheme = config.get<string>('mermaid.theme', 'default');
                this.panel.webview.postMessage({
                    command: IPC_MESSAGES.SET_MERMAID_THEME,
                    theme: mermaidTheme
                });

                const previewFontSize = config.get<number>('markdownPreview.fontSize', 0);
                let fontSize: number;
                if (previewFontSize === 0) {
                    const editorConfig = vscode.workspace.getConfiguration('editor');
                    fontSize = editorConfig.get<number>('fontSize', 14);
                } else {
                    fontSize = previewFontSize;
                }

                this.panel.webview.postMessage({
                    command: IPC_MESSAGES.SET_PREVIEW_FONT_SIZE,
                    fontSize: fontSize
                });
            } catch (error) {
                logger.error('发送配置失败:', error);
            }
        }, 0);

        this.disposable = vscode.workspace.onDidSaveTextDocument((document) => {
            if (document.uri.fsPath === MarkdownPreviewWebview.currentFilePath) {
                const content = document.getText();
                this.updateContent(content);
            }
        });
    }

    updateContent(content: string): void {
        this.panel.webview.postMessage({
            command: IPC_MESSAGES.UPDATE_CONTENT,
            content: content
        });
    }

    private getWebviewContent(content: string, fileName: string, resourceUris: any): string {
        const nonce = WebviewUtils.getNonce();

        const publicJsUri = resourceUris?.publicJsUri || '';
        const publicJsScript = publicJsUri
            ? '<script src="' + publicJsUri + '" onerror="console.error(\'public.js 加载失败\')"></script>'
            : '';

        const templateVariables: Record<string, string> = {
            fileName: WebviewUtils.escapeHtml(fileName),
            escapedContent: WebviewUtils.escapeHtml(content || ''),
            markedJsUri: resourceUris.markedJsUri || '',
            cssUri: resourceUris.cssUri || '',
            jsUri: resourceUris.jsUri || '',
            mermaidJsUri: resourceUris.mermaidJsUri || '',
            katexJsUri: resourceUris.katexJsUri || '',
            katexCssUri: resourceUris.katexCssUri || '',
            highlightJsUri: resourceUris.highlightJsUri || '',
            highlightCssUri: resourceUris.highlightCssUri || '',
            publicJsUri: publicJsUri,
            publicJsScript: publicJsScript,
            cspSource: this.panel.webview.cspSource
        };

        const template = WebviewUtils.loadTemplate(
            this.context,
            'markdownPreview/preview.html'
        );

        return WebviewUtils.replaceTemplateVariables(template, templateVariables);
    }

    dispose(): void {
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = undefined;
        }

        MarkdownPreviewWebview.currentPanel = undefined;
        MarkdownPreviewWebview.currentFilePath = undefined;

        EditorUtils.restoreFocus(this.activeEditor);
    }
}
