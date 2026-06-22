import * as vscode from 'vscode';
import * as fs from 'fs';
import { CommentManager } from '../../managers/commentManager';
import { TagManager, TagDeclaration } from '../../managers/tagManager';
import { TagRelationGraphWebview, GraphData, GraphNode, GraphEdge, BreadcrumbItem, TagRelationGraphMessage } from '../tagRelationGraphWebview';
import { COMMANDS } from '../../constants';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/utils';

// 路径堆栈用于导航
interface NavigationStack {
    items: BreadcrumbItem[];
    visitedNodes: Set<string>;
}

let navigationStack: NavigationStack = {
    items: [],
    visitedNodes: new Set()
};

const tagReferenceRegex = /\@([\u4e00-\u9fa5a-zA-Z_][\u4e00-\u9fa5a-zA-Z0-9_]*)/g;

function checkHasChildren(content: string): boolean {
    tagReferenceRegex.lastIndex = 0;
    return tagReferenceRegex.test(content);
}

function extractTagReferences(content: string): string[] {
    const references: string[] = [];
    let match;
    tagReferenceRegex.lastIndex = 0;
    while ((match = tagReferenceRegex.exec(content)) !== null) {
        references.push(match[1]);
    }
    return [...new Set(references)];
}

async function buildGraphData(
    context: vscode.ExtensionContext,
    centerFilePath: string,
    centerLabel: string,
    level: number
): Promise<GraphData | null> {
    try {
        const commentManager = new CommentManager(context);
        const tagManager = new TagManager();
        tagManager.updateTags(commentManager.getAllComments());

        let content: string;
        let references: string[] = [];

        if (level === 0) {
            // 第一层：从文件内容中提取
            if (!fs.existsSync(centerFilePath)) {
                return null;
            }
            content = fs.readFileSync(centerFilePath, 'utf8');
            references = extractTagReferences(content);
        } else {
            // 第二层及以上：从 tag 定义的注释内容中提取
            const tagName = centerLabel.replace('@', '');
            const declaration = tagManager.getTagDeclaration(tagName);
            if (declaration) {
                references = extractTagReferences(declaration.content);
            }
        }

        if (references.length === 0) {
            return {
                nodes: [{
                    id: 'center',
                    label: centerLabel,
                    type: 'center',
                    filePath: centerFilePath,
                    color: '#4285F4',
                    hasChildren: false
                }],
                edges: [],
                level: level,
                centerNode: {
                    id: 'center',
                    filePath: centerFilePath,
                    label: centerLabel
                },
                breadcrumb: navigationStack.items
            };
        }

        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const fileColorMap = new Map<string, string>();
        const fileColors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#00BCD4', '#FF9800', '#795548'];
        let colorIndex = 0;

        // 中心节点
        const centerNodeId = 'center';
        nodes.push({
            id: centerNodeId,
            label: centerLabel,
            type: 'center',
            filePath: centerFilePath,
            color: '#4285F4',
            hasChildren: false
        });

        // 为每个引用的 tag 创建节点
        for (let i = 0; i < references.length; i++) {
            const tagName = references[i];
            const declaration = tagManager.getTagDeclaration(tagName);
            
            if (!declaration) {
                continue;
            }

            const tagFilePath = declaration.filePath;
            if (!fileColorMap.has(tagFilePath)) {
                fileColorMap.set(tagFilePath, fileColors[colorIndex % fileColors.length]);
                colorIndex++;
            }

            const hasChildren = checkHasChildren(declaration.content);
            const nodeId = `tag-${i}`;
            const fileName = require('path').basename(tagFilePath);
            const label = `@${tagName}\n${fileName}:${declaration.line + 1}`;

            nodes.push({
                id: nodeId,
                label: label,
                type: 'tag',
                filePath: tagFilePath,
                line: declaration.line,
                color: fileColorMap.get(tagFilePath) || '#999',
                hasChildren: hasChildren
            });

            edges.push({
                id: `edge-${i}`,
                source: centerNodeId,
                target: nodeId
            });
        }

        return {
            nodes,
            edges,
            level,
            centerNode: {
                id: centerNodeId,
                filePath: centerFilePath,
                label: centerLabel
            },
            breadcrumb: navigationStack.items
        };
    } catch (error) {
        logger.error('构建图数据失败:', error);
        throw error;
    }
}

export function registerTagRelationGraphCommands(
    context: vscode.ExtensionContext,
    commentManager: CommentManager
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // 从文件资源管理器或编辑器触发
    const showGraphCommand = vscode.commands.registerCommand(
        COMMANDS.SHOW_TAG_RELATION_GRAPH,
        async (uri?: vscode.Uri) => {
            try {
                let filePath: string;
                let fileName: string;

                if (uri) {
                    // 从资源管理器右键触发
                    filePath = uri.fsPath;
                    fileName = require('path').basename(filePath);
                } else {
                    // 从编辑器右键触发
                    const activeEditor = vscode.window.activeTextEditor;
                    if (!activeEditor) {
                        vscode.window.showWarningMessage('请先打开一个文件');
                        return;
                    }
                    filePath = activeEditor.document.uri.fsPath;
                    fileName = require('path').basename(filePath);
                }

                // 重置导航栈
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
                        await handleMessage(message, context, webview);
                    }
                );

                // 初始加载
                const data = await buildGraphData(context, filePath, fileName, 0);
                if (data) {
                    webview.updateGraph(data);
                } else {
                    webview.showError('无法读取文件或文件不存在');
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
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    switch (message.command) {
        case 'expandNode':
            await handleExpandNode(message, context, webview);
            break;
        case 'goToDefinition':
            await handleGoToDefinition(message);
            break;
        case 'navigateBack':
            await handleNavigateBack(context, webview);
            break;
        case 'resetToRoot':
            await handleResetToRoot(context, webview);
            break;
        case 'navigateToLevel':
            if (message.level !== undefined) {
                await handleNavigateToLevel(message.level, context, webview);
            }
            break;
        case 'refresh':
            await handleRefresh(context, webview);
            break;
    }
}

async function handleExpandNode(
    message: TagRelationGraphMessage,
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    const nodeId = message.nodeId;
    const filePath = message.filePath;
    const label = message.label;

    if (!nodeId || !filePath || !label) {
        return;
    }

    // 检测循环引用
    if (navigationStack.visitedNodes.has(nodeId)) {
        vscode.window.showInformationMessage('已访问过此节点，避免循环');
        return;
    }

    // 添加到导航栈
    navigationStack.items.push({
        id: nodeId,
        label: label,
        filePath: filePath
    });
    navigationStack.visitedNodes.add(nodeId);

    // 构建新层级的图数据
    const data = await buildGraphData(context, filePath, label, navigationStack.items.length - 1);
    if (data) {
        webview.updateGraph(data);
    }
}

async function handleGoToDefinition(message: TagRelationGraphMessage): Promise<void> {
    const filePath = message.filePath;
    const line = message.line;

    if (!filePath || line === undefined) {
        return;
    }

    const uri = vscode.Uri.file(filePath);
    const position = new vscode.Position(line, 0);

    await vscode.window.showTextDocument(uri, {
        selection: new vscode.Range(position, position),
        viewColumn: vscode.ViewColumn.One
    });
}

async function handleNavigateBack(
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    if (navigationStack.items.length <= 1) {
        return;
    }

    // 移除当前层级
    const removed = navigationStack.items.pop();
    if (removed) {
        navigationStack.visitedNodes.delete(removed.id);
    }

    // 获取上一层级的数据
    const parentItem = navigationStack.items[navigationStack.items.length - 1];
    const data = await buildGraphData(
        context,
        parentItem.filePath,
        parentItem.label,
        navigationStack.items.length - 1
    );
    if (data) {
        webview.updateGraph(data);
    }
}

async function handleResetToRoot(
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    if (navigationStack.items.length === 0) {
        return;
    }

    // 重置导航栈
    const rootItem = navigationStack.items[0];
    navigationStack = {
        items: [rootItem],
        visitedNodes: new Set()
    };

    const data = await buildGraphData(context, rootItem.filePath, rootItem.label, 0);
    if (data) {
        webview.updateGraph(data);
    }
}

async function handleNavigateToLevel(
    level: number,
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    if (level < 0 || level >= navigationStack.items.length) {
        return;
    }

    // 截断导航栈到指定层级
    const newItems = navigationStack.items.slice(0, level + 1);
    const newVisited = new Set(newItems.map(item => item.id));

    navigationStack.items = newItems;
    navigationStack.visitedNodes = newVisited;

    const item = navigationStack.items[level];
    const data = await buildGraphData(context, item.filePath, item.label, level);
    if (data) {
        webview.updateGraph(data);
    }
}

async function handleRefresh(
    context: vscode.ExtensionContext,
    webview: TagRelationGraphWebview
): Promise<void> {
    if (navigationStack.items.length === 0) {
        return;
    }

    const currentItem = navigationStack.items[navigationStack.items.length - 1];
    const level = navigationStack.items.length - 1;

    const data = await buildGraphData(context, currentItem.filePath, currentItem.label, level);
    if (data) {
        webview.updateGraph(data);
    }
}
