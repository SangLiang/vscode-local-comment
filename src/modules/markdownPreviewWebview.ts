import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewUtils, ResourceUris } from '../utils/webviewUtils';
import { logger } from '../utils/logger';
import { VIEW_TYPES, IPC_MESSAGES, COMMANDS } from '../constants';
import { EditorUtils } from '../utils/editorUtils';
import { getErrorMessage } from '../utils/utils';

export class MarkdownPreviewWebview {
    private static currentPanel: MarkdownPreviewWebview | undefined;
    private static currentFilePath: string | undefined;
    private static _isReplacing: boolean = false;

    private readonly panel: vscode.WebviewPanel;
    private readonly context: vscode.ExtensionContext;
    private readonly activeEditor: vscode.TextEditor | undefined;
    private disposable: vscode.Disposable | undefined;
    private availableTagNames: string[] = [];

    private constructor(
        panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        activeEditor: vscode.TextEditor | undefined,
        availableTagNames?: string[]
    ) {
        this.panel = panel;
        this.context = context;
        this.activeEditor = activeEditor;
        this.availableTagNames = availableTagNames || [];

        this.panel.onDidDispose(() => this.dispose());
    }

    static createOrShow(context: vscode.ExtensionContext, content: string, fileName: string, filePath: string, availableTagNames?: string[]): MarkdownPreviewWebview {
        const activeEditor = vscode.window.activeTextEditor;

        if (MarkdownPreviewWebview.currentPanel && MarkdownPreviewWebview.currentFilePath === filePath) {
            MarkdownPreviewWebview.currentPanel.updateContent(content, availableTagNames);
            MarkdownPreviewWebview.currentPanel.panel.reveal();
            return MarkdownPreviewWebview.currentPanel;
        }

        if (MarkdownPreviewWebview.currentPanel) {
            MarkdownPreviewWebview._isReplacing = true;
            MarkdownPreviewWebview.currentPanel.panel.dispose();
            MarkdownPreviewWebview._isReplacing = false;
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

        const webview = new MarkdownPreviewWebview(panel, context, activeEditor, availableTagNames);
        MarkdownPreviewWebview.currentPanel = webview;
        MarkdownPreviewWebview.currentFilePath = filePath;

        webview.initialize(content, fileName);
        return webview;
    }

    static previewFile(context: vscode.ExtensionContext, availableTagNames?: string[]): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
            return;
        }

        const document = activeEditor.document;
        const filePath = document.uri.fsPath;
        const fileName = path.basename(filePath);
        const content = document.getText();

        MarkdownPreviewWebview.createOrShow(context, content, fileName, filePath, availableTagNames);
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

        this.registerMessageHandler();

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

                // 发送可用的标签名列表，用于精确渲染标签链接
                this.panel.webview.postMessage({
                    command: IPC_MESSAGES.SET_AVAILABLE_TAGS,
                    tagNames: this.availableTagNames
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

    updateContent(content: string, availableTagNames?: string[]): void {
        // 更新标签名列表（如果提供了）
        if (availableTagNames) {
            this.availableTagNames = availableTagNames;
        }
        this.panel.webview.postMessage({
            command: IPC_MESSAGES.UPDATE_CONTENT,
            content: content,
            tagNames: this.availableTagNames
        });
    }

    private registerMessageHandler(): void {
        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === IPC_MESSAGES.GO_TO_SOURCE_LINE) {
                await this.handleGoToSourceLine(message.line);
                return;
            }

            if (message.command === IPC_MESSAGES.GO_TO_TAG_DECLARATION && message.tagName) {
                try {
                    await vscode.commands.executeCommand(
                        COMMANDS.GO_TO_TAG_DECLARATION,
                        { tagName: message.tagName }
                    );
                } catch (error) {
                    logger.error('跳转到标签声明失败:', error);
                    vscode.window.showErrorMessage(`跳转失败: ${getErrorMessage(error)}`);
                }
                return;
            }

            if (message.command !== IPC_MESSAGES.EXPORT_HTML || !message.html) return;

            let exportSuccess = false;
            let exportError = '';

            try {
                let html = message.html;
                let css = message.css || '';

                if (message.localImagePaths?.length) {
                    html = this.inlineLocalImages(html, message.localImagePaths);
                }

                if (message.remoteImageUrls?.length) {
                    html = await this.inlineRemoteImages(html, message.remoteImageUrls);
                }

                if (message.hasKatex) {
                    css = this.inlineKatexFonts(css);
                }

                const fullHtml = this.buildExportHtml(
                    html,
                    css,
                    message.fileName,
                    message.keepPrintBg,
                    !!message.hasMermaid
                );
                exportSuccess = await this.saveExportHtml(fullHtml, message.fileName);
            } catch (error) {
                exportError = getErrorMessage(error);
                vscode.window.showErrorMessage(`导出失败: ${exportError}`);
            } finally {
                // 通知 Webview 导出完成（成功、失败或用户取消）
                this.panel.webview.postMessage({
                    command: IPC_MESSAGES.EXPORT_HTML_COMPLETE,
                    success: exportSuccess,
                    error: exportError
                });
            }
        });
    }

    private async handleGoToSourceLine(line: number): Promise<void> {
        const filePath = MarkdownPreviewWebview.currentFilePath;
        if (!filePath) {
            return;
        }
        if (typeof line !== 'number' || line < 0 || !Number.isFinite(line)) {
            return;
        }

        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);

            const existingEditor = vscode.window.visibleTextEditors.find(
                (editor) => editor.document.uri.fsPath === filePath
                    || editor.document.uri.fsPath.toLowerCase() === filePath.toLowerCase()
            );
            const viewColumn = existingEditor?.viewColumn
                ?? vscode.ViewColumn.One;

            const targetLine = Math.min(Math.max(0, Math.floor(line)), Math.max(0, document.lineCount - 1));
            const position = new vscode.Position(targetLine, 0);

            const editor = await vscode.window.showTextDocument(document, {
                viewColumn,
                preserveFocus: false,
                selection: new vscode.Range(position, position)
            });

            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
            await vscode.commands.executeCommand('revealLine', {
                lineNumber: targetLine + 1,
                at: 'center'
            });
        } catch (error) {
            logger.error('跳转到源文件失败:', error);
            vscode.window.showErrorMessage(`跳转失败: ${getErrorMessage(error)}`);
        }
    }

    private inlineLocalImages(html: string, paths: string[]): string {
        for (const imgPath of paths) {
            try {
                const buf = fs.readFileSync(imgPath);
                const ext = path.extname(imgPath).slice(1);
                const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
                html = html.split(imgPath).join(dataUri);
            } catch {
            }
        }
        return html;
    }

    private async inlineRemoteImages(html: string, urls: string[]): Promise<string> {
        const axios = (await import('axios')).default;
        for (const url of urls) {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
                const contentType = response.headers['content-type'] || 'image/png';
                const base64 = Buffer.from(response.data).toString('base64');
                const dataUri = `data:${contentType};base64,${base64}`;
                html = html.split(url).join(dataUri);
            } catch {
            }
        }
        return html;
    }

    private inlineKatexFonts(cssText: string): string {
        const fontsDir = this.getKatexFontsDir();
        if (!fs.existsSync(fontsDir)) return cssText;

        return cssText.replace(/url\((?:'")?fonts\/([^)'"]+)(?:'")?\)/g, (match, fontFile) => {
            const fontPath = path.join(fontsDir, fontFile);
            try {
                const buf = fs.readFileSync(fontPath);
                const ext = fontFile.split('.').pop();
                const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/ttf';
                return `url("data:${mime};base64,${buf.toString('base64')}")`;
            } catch {
                return match;
            }
        });
    }

    private getKatexFontsDir(): string {
        const outFonts = path.join(this.context.extensionUri.fsPath, 'out', 'lib', 'fonts');
        if (fs.existsSync(outFonts)) return outFonts;
        return path.join(this.context.extensionUri.fsPath, 'node_modules', 'katex', 'dist', 'fonts');
    }

    private getMermaidExportScript(): string {
        const scriptPath = path.join(
            this.context.extensionUri.fsPath,
            'src',
            'templates',
            'markdownPreview',
            'mermaidExport.js'
        );
        if (fs.existsSync(scriptPath)) {
            return fs.readFileSync(scriptPath, 'utf8');
        }
        return '';
    }

    private buildExportHtml(
        previewHtml: string,
        css: string,
        fileName: string,
        keepPrintBg: boolean = true,
        hasMermaid: boolean = false
    ): string {
        const safeName = fileName ? fileName.replace(/\.md$/i, '') : 'export';
        // 仅影响「打印」时是否保留背景色，与屏幕浏览时的表格边框无关
        const printStyles = keepPrintBg
            ? `@media print {
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
}`
            : '';
        const mermaidScript = hasMermaid
            ? `<script>\n${this.getMermaidExportScript()}\n</script>`
            : '';
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeName}</title>
    <style>
${css}
${printStyles}
    </style>
</head>
<body>
    <div class="container">
        <div class="content-area">
${previewHtml}
        </div>
    </div>
${mermaidScript}
</body>
</html>`;
    }

    private async saveExportHtml(html: string, fileName: string): Promise<boolean> {
        const defaultName = (fileName || 'export').replace(/\.md$/i, '.html');
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(defaultName),
            filters: { 'HTML': ['html'] }
        });
        if (uri) {
            fs.writeFileSync(uri.fsPath, html, 'utf8');
            vscode.window.showInformationMessage(`已导出到 ${uri.fsPath}`);
            return true;
        }
        return false; // 用户取消保存
    }

    private getWebviewContent(content: string, fileName: string, resourceUris: ResourceUris): string {
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

        if (!MarkdownPreviewWebview._isReplacing) {
            EditorUtils.restoreFocus(this.activeEditor);
        }
    }
}
