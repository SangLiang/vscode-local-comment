import * as vscode from 'vscode';
import * as path from 'path';
import { CommentManager } from '../../managers/commentManager';
import { TagManager } from '../../managers/tagManager';
import { TagRelationGraphWebview, BreadcrumbItem, TagRelationGraphMessage } from '../tagRelationGraphWebview';
import { COMMANDS } from '../../constants';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/utils';
import { buildTagRelationGraphData, buildTagRelationChildNodes } from '../../utils/tagRelationGraphData';

let rootItem: BreadcrumbItem | undefined;

function buildRootGraph(commentManager: CommentManager, tagManager: TagManager) {
    if (!rootItem) {
        return null;
    }
    return buildTagRelationGraphData({
        commentManager,
        tagManager,
        centerFilePath: rootItem.filePath,
        centerLabel: rootItem.label,
        level: 0,
        breadcrumb: [rootItem]
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

                rootItem = {
                    id: 'root',
                    label: fileName,
                    filePath
                };

                const webview = TagRelationGraphWebview.createOrShow(
                    context,
                    filePath,
                    fileName,
                    async (message) => {
                        await handleMessage(message, commentManager, tagManager, webview);
                    }
                );

                const data = buildRootGraph(commentManager, tagManager);
                if (data) {
                    webview.updateGraph(data);
                }
            } catch (error) {
                logger.error('显示 Tag 关系图失败:', error);
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
    switch (message.command) {
        case 'expandNode':
            handleExpandNode(message, commentManager, tagManager, webview);
            break;
        case 'goToDefinition':
            await handleGoToDefinition(message);
            break;
        case 'navigateBack':
        case 'resetToRoot':
        case 'refresh':
            handleResetToRoot(commentManager, tagManager, webview);
            break;
        case 'navigateToLevel':
            if (message.level === 0) {
                handleResetToRoot(commentManager, tagManager, webview);
            }
            break;
    }
}

function handleExpandNode(
    message: TagRelationGraphMessage,
    commentManager: CommentManager,
    tagManager: TagManager,
    webview: TagRelationGraphWebview
): void {
    const nodeId = message.nodeId;
    const label = message.label;
    if (!nodeId || !label) {
        return;
    }

    const children = buildTagRelationChildNodes({
        commentManager,
        tagManager,
        parentId: nodeId,
        centerLabel: label,
        centerFilePath: message.filePath || rootItem?.filePath || ''
    });
    webview.appendChildren(nodeId, children);
}

async function handleGoToDefinition(message: TagRelationGraphMessage): Promise<void> {
    const filePath = message.filePath;
    if (!filePath) {
        return;
    }

    const uri = vscode.Uri.file(filePath);
    const showOptions: vscode.TextDocumentShowOptions = {
        viewColumn: vscode.ViewColumn.One
    };
    if (message.line !== undefined) {
        const position = new vscode.Position(message.line, 0);
        showOptions.selection = new vscode.Range(position, position);
    }

    await vscode.window.showTextDocument(uri, showOptions);
}

function handleResetToRoot(
    commentManager: CommentManager,
    tagManager: TagManager,
    webview: TagRelationGraphWebview
): void {
    const data = buildRootGraph(commentManager, tagManager);
    if (data) {
        webview.updateGraph(data);
    }
}
