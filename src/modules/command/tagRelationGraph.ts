import * as vscode from 'vscode';
import * as path from 'path';
import { CommentManager } from '../../managers/commentManager';
import { TagRelationGraphWebview, BreadcrumbItem, TagRelationGraphMessage } from '../tagRelationGraphWebview';
import { COMMANDS } from '../../constants';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/utils';
import { buildTagRelationGraphData } from '../../utils/tagRelationGraphData';

interface NavigationStack {
    items: BreadcrumbItem[];
    visitedNodes: Set<string>;
}

let navigationStack: NavigationStack = {
    items: [],
    visitedNodes: new Set()
};

function buildStandaloneGraph(
    commentManager: CommentManager,
    centerFilePath: string,
    centerLabel: string,
    level: number
) {
    return buildTagRelationGraphData({
        commentManager,
        centerFilePath,
        centerLabel,
        level,
        breadcrumb: navigationStack.items
    });
}

export function registerTagRelationGraphCommands(
    context: vscode.ExtensionContext,
    commentManager: CommentManager
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

                navigationStack = {
                    items: [{
                        id: 'root',
                        label: fileName,
                        filePath: filePath
                    }],
                    visitedNodes: new Set()
                };

                const webview = TagRelationGraphWebview.createOrShow(
                    context,
                    filePath,
                    fileName,
                    async (message) => {
                        await handleMessage(message, commentManager, webview);
                    }
                );

                const data = buildStandaloneGraph(commentManager, filePath, fileName, 0);
                webview.updateGraph(data);
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
    webview: TagRelationGraphWebview
): Promise<void> {
    switch (message.command) {
        case 'expandNode':
            handleExpandNode(message, commentManager, webview);
            break;
        case 'goToDefinition':
            await handleGoToDefinition(message);
            break;
        case 'navigateBack':
            handleNavigateBack(commentManager, webview);
            break;
        case 'resetToRoot':
            handleResetToRoot(commentManager, webview);
            break;
        case 'navigateToLevel':
            if (message.level !== undefined) {
                handleNavigateToLevel(message.level, commentManager, webview);
            }
            break;
        case 'refresh':
            handleRefresh(commentManager, webview);
            break;
    }
}

function handleExpandNode(
    message: TagRelationGraphMessage,
    commentManager: CommentManager,
    webview: TagRelationGraphWebview
): void {
    const nodeId = message.nodeId;
    const filePath = message.filePath;
    const label = message.label;

    if (!nodeId || !filePath || !label) {
        return;
    }

    if (navigationStack.visitedNodes.has(nodeId)) {
        vscode.window.showInformationMessage('已访问过此节点，避免循环');
        return;
    }

    navigationStack.items.push({
        id: nodeId,
        label: label,
        filePath: filePath
    });
    navigationStack.visitedNodes.add(nodeId);

    const data = buildStandaloneGraph(
        commentManager,
        filePath,
        label,
        navigationStack.items.length - 1
    );
    webview.updateGraph(data);
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

function handleNavigateBack(
    commentManager: CommentManager,
    webview: TagRelationGraphWebview
): void {
    if (navigationStack.items.length <= 1) {
        return;
    }

    const removed = navigationStack.items.pop();
    if (removed) {
        navigationStack.visitedNodes.delete(removed.id);
    }

    const parentItem = navigationStack.items[navigationStack.items.length - 1];
    const data = buildStandaloneGraph(
        commentManager,
        parentItem.filePath,
        parentItem.label,
        navigationStack.items.length - 1
    );
    webview.updateGraph(data);
}

function handleResetToRoot(
    commentManager: CommentManager,
    webview: TagRelationGraphWebview
): void {
    if (navigationStack.items.length === 0) {
        return;
    }

    const rootItem = navigationStack.items[0];
    navigationStack = {
        items: [rootItem],
        visitedNodes: new Set()
    };

    const data = buildStandaloneGraph(commentManager, rootItem.filePath, rootItem.label, 0);
    webview.updateGraph(data);
}

function handleNavigateToLevel(
    level: number,
    commentManager: CommentManager,
    webview: TagRelationGraphWebview
): void {
    if (level < 0 || level >= navigationStack.items.length) {
        return;
    }

    const newItems = navigationStack.items.slice(0, level + 1);
    const newVisited = new Set(newItems.map(item => item.id));

    navigationStack.items = newItems;
    navigationStack.visitedNodes = newVisited;

    const item = navigationStack.items[level];
    const data = buildStandaloneGraph(commentManager, item.filePath, item.label, level);
    webview.updateGraph(data);
}

function handleRefresh(
    commentManager: CommentManager,
    webview: TagRelationGraphWebview
): void {
    if (navigationStack.items.length === 0) {
        return;
    }

    const currentItem = navigationStack.items[navigationStack.items.length - 1];
    const level = navigationStack.items.length - 1;
    const data = buildStandaloneGraph(commentManager, currentItem.filePath, currentItem.label, level);
    webview.updateGraph(data);
}
