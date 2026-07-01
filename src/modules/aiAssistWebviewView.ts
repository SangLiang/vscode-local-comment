import * as os from 'os';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewUtils } from '../utils/webviewUtils';
import { IPC_MESSAGES } from '../constants';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/utils';

export interface AiAssistPrompt {
    text: string;
}

const BUNDLED_SKILL_REL = 'src/templates/ai-assist/SKILL.md';
const WORKSPACE_SKILL_PATH_KEY = 'localComment.aiAssistSkillPath';

export class AiAssistWebviewViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _extensionUri: vscode.Uri
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'templates')],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                await this._handleMessage(message);
            } catch (error) {
                logger.error('ai assist webview message failed', error);
            }
        });
        this._sendContent();
    }

    private _sendContent(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const relativeFile = this._getActiveRelativeFilePath(workspaceFolder);
        const savedSkillPath = this._getSavedSkillPath();
        const skillSaved = !!savedSkillPath && fs.existsSync(savedSkillPath);
        const skillDisplayPath = savedSkillPath
            ? this._toDisplayPath(savedSkillPath, workspaceFolder)
            : '';

        this._post(IPC_MESSAGES.AI_ASSIST_CONTENT_RESULT, {
            prompt: this._buildPrompt(relativeFile, skillDisplayPath),
            skillSaved,
            skillDisplayPath,
        });
    }

    private _getBundledSkillPath(): string {
        return path.join(this._context.extensionPath, ...BUNDLED_SKILL_REL.split('/'));
    }

    private _loadBundledSkillContent(): string {
        const skillPath = this._getBundledSkillPath();
        if (!fs.existsSync(skillPath)) {
            throw new Error('内置 Skill 文件缺失');
        }
        return fs.readFileSync(skillPath, 'utf8');
    }

    private _getSavedSkillPath(): string | undefined {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const fromWorkspace = workspaceFolder
            ? this._context.workspaceState.get<string>(WORKSPACE_SKILL_PATH_KEY)
            : undefined;
        if (fromWorkspace) {
            return fromWorkspace;
        }
        return this._context.globalState.get<string>(WORKSPACE_SKILL_PATH_KEY);
    }

    private async _rememberSavedSkillPath(filePath: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            await this._context.workspaceState.update(WORKSPACE_SKILL_PATH_KEY, filePath);
        } else {
            await this._context.globalState.update(WORKSPACE_SKILL_PATH_KEY, filePath);
        }
    }

    private _toDisplayPath(
        absolutePath: string,
        workspaceFolder?: vscode.WorkspaceFolder
    ): string {
        if (!workspaceFolder) {
            return absolutePath;
        }
        const relative = path.relative(workspaceFolder.uri.fsPath, absolutePath);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
            return relative.split(path.sep).join('/');
        }
        return absolutePath;
    }

    private _getActiveRelativeFilePath(workspaceFolder?: vscode.WorkspaceFolder): string {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !workspaceFolder) {
            return 'src/example.ts';
        }
        const docPath = editor.document.uri.fsPath;
        if (editor.document.uri.scheme !== 'file') {
            return 'src/example.ts';
        }
        const relative = path.relative(workspaceFolder.uri.fsPath, docPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return 'src/example.ts';
        }
        return relative.split(path.sep).join('/');
    }

    private _buildPrompt(relativeFile: string, skillDisplayPath: string): AiAssistPrompt {
        if (skillDisplayPath) {
            return {
                text: `请读取 ${skillDisplayPath} 并按其中规则，为 ${relativeFile} 生成本地注释。\n新建独立分组，不要修改已有分组，不要写进源码。`,
            };
        }
        return {
            text: `请阅读 Local Comment AI 写入 skill 中的规则，为 ${relativeFile} 生成本地注释。\n新建独立分组，不要修改已有分组，不要写进源码。`,
        };
    }

    private async _saveSkillWithPicker(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultFileName = 'local-comment-ai-write-SKILL.md';
        const defaultUri = workspaceFolder
            ? vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, defaultFileName))
            : vscode.Uri.file(path.join(os.homedir(), defaultFileName));

        const targetUri = await vscode.window.showSaveDialog({
            title: '保存 Local Comment AI Skill',
            defaultUri,
            filters: { Markdown: ['md'] },
            saveLabel: '保存',
        });
        if (!targetUri) {
            return;
        }

        try {
            const content = this._loadBundledSkillContent();
            fs.mkdirSync(path.dirname(targetUri.fsPath), { recursive: true });
            fs.writeFileSync(targetUri.fsPath, content, 'utf8');
            await this._rememberSavedSkillPath(targetUri.fsPath);
            const display = this._toDisplayPath(targetUri.fsPath, workspaceFolder);
            vscode.window.showInformationMessage(`Skill 已保存到 ${display}`);
            this._sendContent();
        } catch (error) {
            logger.error('save ai skill failed', error);
            vscode.window.showErrorMessage(`保存 Skill 失败: ${getErrorMessage(error)}`);
        }
    }

    private async _handleMessage(message: { command: string; text?: string }): Promise<void> {
        switch (message.command) {
            case IPC_MESSAGES.GET_AI_ASSIST_CONTENT:
                this._sendContent();
                return;
            case IPC_MESSAGES.INSTALL_AI_SKILL:
                await this._saveSkillWithPicker();
                return;
            case IPC_MESSAGES.COPY_AI_PROMPT:
                if (message.text) {
                    await vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('提示词已复制到剪贴板');
                }
                return;
            case IPC_MESSAGES.OPEN_AI_SKILL_FILE: {
                const savedPath = this._getSavedSkillPath();
                if (savedPath && fs.existsSync(savedPath)) {
                    const doc = await vscode.workspace.openTextDocument(savedPath);
                    await vscode.window.showTextDocument(doc, { preview: true });
                    return;
                }
                const bundledPath = this._getBundledSkillPath();
                const doc = await vscode.workspace.openTextDocument(bundledPath);
                await vscode.window.showTextDocument(doc, { preview: true });
                vscode.window.showInformationMessage(
                    '当前打开的是扩展内置 Skill；如需给 AI 使用，请先「另存 Skill 文件」到自选路径。'
                );
                return;
            }
        }
    }

    private _post(command: string, payload: unknown): void {
        this._view?.webview.postMessage({ command, ...(payload as object) });
    }

    private _getHtml(webview: vscode.Webview): string {
        const resourceUris = WebviewUtils.buildResourceUris(webview, this._extensionUri, {
            css: 'ai-assist/ai-assist.css',
            js: 'ai-assist/ai-assist.js',
        });

        const nonce = WebviewUtils.getNonce();
        const template = WebviewUtils.loadTemplate(this._context, 'ai-assist/ai-assist.html');

        return WebviewUtils.replaceTemplateVariables(template, {
            cspSource: webview.cspSource,
            cssUri: resourceUris.cssUri || '',
            jsUri: resourceUris.jsUri || '',
            nonce,
        });
    }
}
