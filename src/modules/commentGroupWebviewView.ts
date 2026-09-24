import * as vscode from 'vscode';
import { CommentManager } from '../managers/commentManager';
import { ProjectManager } from '../managers/projectManager';
import { AuthManager } from '../managers/authManager';
import { TagManager } from '../managers/tagManager';
import { WebviewUtils } from '../utils/webviewUtils';
import { IPC_MESSAGES } from '../constants';
import { CommentManageWebviewPanel } from './commentManageWebview';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/utils';
import {
    formatGroupDisplayName,
    normalizeGroupConfigFileName,
    validateNewGroupName,
} from '../utils/commentManageUtils';

export class CommentGroupWebviewViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _viewingGroupFileName?: string;

    constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _extensionUri: vscode.Uri,
        private readonly _commentManager: CommentManager,
        private readonly _projectManager: ProjectManager,
        private readonly _authManager: AuthManager,
        private readonly _tagManager: TagManager,
        private readonly _refreshCommentUi: () => void
    ) {}

    
    /** IPC 传入的分组文件名必须可规范为 stem.json，否则拒绝 */
    private _requireSafeGroupFileName(raw: string | undefined): string | null {
        if (!raw) {
            return null;
        }
        const safe = normalizeGroupConfigFileName(raw);
        if (!safe) {
            vscode.window.showWarningMessage('非法的分组配置文件名');
            return null;
        }
        return safe;
    }

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
                logger.error('comment group webview message failed', error);
                this._post(IPC_MESSAGES.COMMENT_GROUP_ERROR, { message: getErrorMessage(error) });
            }
        });
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._openSelectedGroupInEditor();
            }
        });
        if (webviewView.visible) {
            this._openSelectedGroupInEditor();
        } else {
            this.refreshGroups();
        }
    }

    refreshGroups(): void {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders?.length) {
            this._post(IPC_MESSAGES.COMMENT_GROUPS_RESULT, { groups: [], current: '', viewing: '', noWorkspace: true });
            return;
        }
        const groups = this._commentManager.listAvailableCommentsConfigs();
        const current = this._commentManager.getCurrentCommentsConfig();
        const viewing = this._viewingGroupFileName ?? '';
        this._post(IPC_MESSAGES.COMMENT_GROUPS_RESULT, { groups, current, viewing, noWorkspace: false });
    }

    notifyGroupApplied(): void {
        this._viewingGroupFileName = this._commentManager.getCurrentCommentsConfig();
        this.refreshGroups();
    }

    private _openManagePanel(groupFileName: string): void {
        CommentManageWebviewPanel.createOrShow(
            this._context,
            this._extensionUri,
            this._commentManager,
            this._projectManager,
            this._authManager,
            this._tagManager,
            groupFileName
        );
    }

    private _openSelectedGroupInEditor(): void {
        if (vscode.workspace.workspaceFolders?.length) {
            const groups = this._commentManager.listAvailableCommentsConfigs();
            const current = this._commentManager.getCurrentCommentsConfig();
            const fileName = this._viewingGroupFileName && groups.includes(this._viewingGroupFileName)
                ? this._viewingGroupFileName
                : current;
            if (fileName && groups.includes(fileName)) {
                this._viewingGroupFileName = fileName;
                this._openManagePanel(fileName);
            }
        }
        this.refreshGroups();
    }

    private async _promptNewGroupName(title: string, value = ''): Promise<string | undefined> {
        const existing = this._commentManager.listAvailableCommentsConfigs();
        return vscode.window.showInputBox({
            title,
            prompt: '请输入分组名称（不需要 .json 后缀）',
            placeHolder: '例如: feature-a',
            value,
            validateInput: (input) => validateNewGroupName(input, existing),
        });
    }

    private async _handleMessage(message: { command: string; fileName?: string; newFileName?: string }): Promise<void> {
        switch (message.command) {
            case IPC_MESSAGES.GET_COMMENT_GROUPS:
                this.refreshGroups();
                return;
            case IPC_MESSAGES.REFRESH_COMMENT_GROUPS:
                await this._commentManager.reloadFromDisk();
                this._refreshCommentUi();
                this.refreshGroups();
                CommentManageWebviewPanel.currentPanel?.refreshRows();
                vscode.window.showInformationMessage('注释分组已刷新');
                return;
            case IPC_MESSAGES.SELECT_COMMENT_GROUP: {
                const safeSelect = this._requireSafeGroupFileName(message.fileName);
                if (!safeSelect) {
                    return;
                }
                this._viewingGroupFileName = safeSelect;
                this._openManagePanel(safeSelect);
                this.refreshGroups();
                return;
            }
            case IPC_MESSAGES.CREATE_COMMENT_GROUP: {
                let fileName = message.fileName?.trim();
                if (!fileName) {
                    fileName = await this._promptNewGroupName('新建注释分组');
                    if (!fileName) {
                        return;
                    }
                }
                const validationError = validateNewGroupName(fileName, this._commentManager.listAvailableCommentsConfigs());
                if (validationError) {
                    vscode.window.showWarningMessage(validationError);
                    return;
                }
                const safeCreate = normalizeGroupConfigFileName(fileName);
                if (!safeCreate) {
                    vscode.window.showWarningMessage('非法的分组配置文件名');
                    return;
                }
                await this._commentManager.createCommentsConfig(safeCreate);
                const createdFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
                this._viewingGroupFileName = createdFileName;
                this._openManagePanel(createdFileName);
                this.refreshGroups();
                return;
            }
            case IPC_MESSAGES.APPLY_COMMENT_GROUP: {
                const safeApply = this._requireSafeGroupFileName(message.fileName);
                if (!safeApply) {
                    return;
                }
                await this._commentManager.switchCommentsConfig(safeApply);
                this._viewingGroupFileName = safeApply;
                CommentManageWebviewPanel.currentPanel?.onGroupApplied(safeApply);
                this.refreshGroups();
                return;
            }
            case IPC_MESSAGES.RENAME_COMMENT_GROUP: {
                const safeOld = this._requireSafeGroupFileName(message.fileName);
                if (!safeOld) {
                    return;
                }
                const existingForRename = this._commentManager
                    .listAvailableCommentsConfigs()
                    .filter((f) => f !== safeOld);
                const newFileName = await vscode.window.showInputBox({
                    title: '重命名注释分组',
                    prompt: '请输入新分组名称（不需要 .json 后缀）',
                    value: formatGroupDisplayName(safeOld),
                    validateInput: (input) => validateNewGroupName(input, existingForRename),
                });
                if (!newFileName) {
                    return;
                }
                const ok = await this._commentManager.renameCommentsConfig(safeOld, newFileName);
                if (!ok) {
                    this._post(IPC_MESSAGES.COMMENT_GROUP_ERROR, {
                        message: '重命名失败，请检查名称是否合法或目标分组是否已存在',
                    });
                }
                this.refreshGroups();
                return;
            }
            case IPC_MESSAGES.DELETE_COMMENT_GROUP: {
                const safeDelete = this._requireSafeGroupFileName(message.fileName);
                if (!safeDelete) {
                    return;
                }
                const displayName = formatGroupDisplayName(safeDelete);
                const choice = await vscode.window.showWarningMessage(
                    `确定删除空分组「${displayName}」？`,
                    { modal: true },
                    '删除',
                    '取消'
                );
                if (choice !== '删除') {
                    return;
                }
                const ok = await this._commentManager.deleteCommentsConfig(safeDelete);
                if (!ok) {
                    this._post(IPC_MESSAGES.COMMENT_GROUP_ERROR, {
                        message: '删除失败，仅可删除空分组且不能删除当前分组',
                    });
                }
                this.refreshGroups();
                return;
            }
        }
    }

    private _post(command: string, payload: unknown): void {
        this._view?.webview.postMessage({ command, ...(payload as object) });
    }

    private _getHtml(webview: vscode.Webview): string {
        const resourceUris = WebviewUtils.buildResourceUris(webview, this._extensionUri, {
            css: 'comment-group/comment-group.css',
            js: 'comment-group/comment-group.js',
        });

        const nonce = WebviewUtils.getNonce();
        const template = WebviewUtils.loadTemplate(
            this._commentManager.getContext(),
            'comment-group/comment-group.html'
        );

        return WebviewUtils.replaceTemplateVariables(template, {
            cspSource: webview.cspSource,
            cssUri: resourceUris.cssUri || '',
            jsUri: resourceUris.jsUri || '',
            nonce: nonce,
        });
    }
}
