import * as vscode from 'vscode';
import * as path from 'path';
import { CommentManager } from '../../managers/commentManager';
import { TagManager } from '../../managers/tagManager';
import { TagRelationGraphWebview, TagRelationGraphMessage } from '../tagRelationGraphWebview';
import { COMMANDS, IPC_MESSAGES } from '../../constants';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/utils';
import {
    buildPanelRootGraph,
    createVscodeTagRelationGraphHost,
    expandTagRelationNode,
    goToTagRelationDefinition,
    navigatePanelToLevel
} from '../../utils/tagRelationGraphHandlers';

function createHost() {
    return createVscodeTagRelationGraphHost({
        getWorkspaceFolders: () =>
            vscode.workspace.workspaceFolders?.map(folder => ({ fsPath: folder.uri.fsPath })),
        openFileAt: async (filePath, line) => {
            const uri = vscode.Uri.file(filePath);
            const showOptions: vscode.TextDocumentShowOptions = {
                viewColumn: vscode.ViewColumn.One
            };
            if (line !== undefined) {
                const position = new vscode.Position(line, 0);
                showOptions.selection = new vscode.Range(position, position);
            }
            await vscode.window.showTextDocument(uri, showOptions);
        },
        logWarn: (message, detail) => logger.warn(message, detail)
    });
}

export function registerTagRelationGraphCommands(
    context: vscode.ExtensionContext,
    commentManager: CommentManager,
    tagManager: TagManager
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    const showGraphCommand = vscode.commands.registerCommand(
        COMMANDS.SHOW_TAG_RELATION_GRAPH,
        async (uri?: vscode.Uri) => {
            try {
                let filePath: string;
                let fileName: string;

                if (uri) {
                    filePath = uri.fsPath;
                    fileName = path.basename(filePath);
                } else {
                    const activeEditor = vscode.window.activeTextEditor;
                    if (!activeEditor) {
                        vscode.window.showWarningMessage('请先打开一个文件');
                        return;
                    }
                    filePath = activeEditor.document.uri.fsPath;
                    fileName = path.basename(filePath);
                }

                TagRelationGraphWebview.setRootItem({
                    id: 'root',
                    label: fileName,
                    filePath
                });

                const webview = TagRelationGraphWebview.createOrShow(
                    context,
                    filePath,
                    fileName,
                    async (message) => {
                        await handleMessage(message, commentManager, tagManager, webview);
                    }
                );

                const data = buildPanelRootGraph(
                    TagRelationGraphWebview.getRootItem(),
                    commentManager,
                    tagManager
                );
                if (data) {
                    webview.updateGraph(data);
                }
            } catch (error) {
                logger.error('显示 Tag 关系图失败', error);
                vscode.window.showErrorMessage(`显示关系图失败: ${getErrorMessage(error)}`);
            }
        }
    );

    disposables.push(showGraphCommand);
    return disposables;
}

async function handleMessage(
    message: TagRelationGraphMessage,
    commentManager: CommentManager,
    tagManager: TagManager,
    webview: TagRelationGraphWebview
): Promise<void> {
    const host = createHost();

    switch (message.command) {
        case IPC_MESSAGES.TAG_GRAPH_EXPAND_NODE: {
            const result = expandTagRelationNode(host, {
                nodeId: message.nodeId,
                label: message.label,
                filePath: message.filePath,
                fallbackFilePath: TagRelationGraphWebview.getRootItem()?.filePath,
                commentManager,
                tagManager
            });
            if (result) {
                webview.appendChildren(result.parentId, result.children);
            }
            break;
        }
        case IPC_MESSAGES.TAG_GRAPH_GO_TO_DEFINITION:
            await goToTagRelationDefinition(host, message);
            break;
        case IPC_MESSAGES.TAG_GRAPH_NAVIGATE_BACK:
        case IPC_MESSAGES.TAG_GRAPH_RESET_TO_ROOT:
        case IPC_MESSAGES.TAG_GRAPH_REFRESH: {
            const data = buildPanelRootGraph(
                TagRelationGraphWebview.getRootItem(),
                commentManager,
                tagManager
            );
            if (data) {
                webview.updateGraph(data);
            }
            break;
        }
        case IPC_MESSAGES.TAG_GRAPH_NAVIGATE_TO_LEVEL: {
            const data = navigatePanelToLevel(
                message.level,
                TagRelationGraphWebview.getRootItem(),
                commentManager,
                tagManager
            );
            if (data) {
                webview.updateGraph(data);
            }
            break;
        }
    }
}
