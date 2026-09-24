import type { CommentManager } from '../managers/commentManager';
import type { TagManager } from '../managers/tagManager';
import {
    buildTagRelationChildNodes,
    buildTagRelationGraphData,
    type BreadcrumbItem,
    type GraphData
} from './tagRelationGraphData';
import { parseSafeLine, resolveSafeWorkspacePath } from './webviewPathGuards';

export type TagRelationGraphHost = {
    getWorkspaceFolders(): readonly { fsPath: string }[];
    openFileAt(filePath: string, line?: number): Promise<void>;
    logWarn?(message: string, detail?: unknown): void;
};

export type ExpandNodeInput = {
    nodeId?: unknown;
    label?: unknown;
    filePath?: unknown;
    fallbackFilePath?: string;
    commentManager: CommentManager;
    tagManager: TagManager;
};

export type ExpandNodeResult = {
    parentId: string;
    children: ReturnType<typeof buildTagRelationChildNodes>;
};

/**
 * Validate expand payload, resolve a safe center file path, and build child nodes.
 * Returns null on invalid input or unsafe path (no-op for callers).
 */
export function expandTagRelationNode(
    host: TagRelationGraphHost,
    input: ExpandNodeInput
): ExpandNodeResult | null {
    if (typeof input.nodeId !== 'string' || input.nodeId.length === 0) {
        return null;
    }
    if (typeof input.label !== 'string' || input.label.length === 0) {
        return null;
    }

    const candidate =
        typeof input.filePath === 'string' && input.filePath.length > 0
            ? input.filePath
            : input.fallbackFilePath;

    const safePath = resolveSafeWorkspacePath(candidate, host.getWorkspaceFolders());
    if (!safePath) {
        host.logWarn?.('expandTagRelationNode: rejected unsafe or missing filePath', candidate);
        return null;
    }

    const children = buildTagRelationChildNodes({
        commentManager: input.commentManager,
        tagManager: input.tagManager,
        parentId: input.nodeId,
        centerLabel: input.label,
        centerFilePath: safePath
    });

    return { parentId: input.nodeId, children };
}

/**
 * Open a definition target after path/line guards. Invalid path → no-op.
 * Invalid line → open file without selection.
 */
export async function goToTagRelationDefinition(
    host: TagRelationGraphHost,
    input: { filePath?: unknown; line?: unknown }
): Promise<boolean> {
    const safePath = resolveSafeWorkspacePath(input.filePath, host.getWorkspaceFolders());
    if (!safePath) {
        host.logWarn?.('goToTagRelationDefinition: rejected unsafe or missing filePath', input.filePath);
        return false;
    }
    const line = parseSafeLine(input.line);
    await host.openFileAt(safePath, line);
    return true;
}

/**
 * Rebuild the panel root graph from a stored root breadcrumb item.
 */
export function buildPanelRootGraph(
    rootItem: BreadcrumbItem | undefined,
    commentManager: CommentManager,
    tagManager: TagManager
): GraphData | null {
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

/**
 * Panel navigateToLevel: only level 0 resets to root (matches prior behavior).
 */
export function navigatePanelToLevel(
    level: unknown,
    rootItem: BreadcrumbItem | undefined,
    commentManager: CommentManager,
    tagManager: TagManager
): GraphData | null {
    if (level !== 0 && level !== '0') {
        return null;
    }
    return buildPanelRootGraph(rootItem, commentManager, tagManager);
}

export type CommentTagGraphStack = {
    items: BreadcrumbItem[];
    visitedNodes: Set<string>;
};

/**
 * Pop one breadcrumb level for the embedded comment tag graph.
 * Returns null when already at root (no-op).
 */
export function navigateCommentTagGraphBack(
    stack: CommentTagGraphStack,
    rootContent: string,
    commentManager: CommentManager,
    tagManager: TagManager
): GraphData | null {
    if (stack.items.length <= 1) {
        return null;
    }
    const removed = stack.items.pop();
    if (removed) {
        stack.visitedNodes.delete(removed.id);
    }
    return buildStackedCommentTagGraph(stack, rootContent, commentManager, tagManager, stack.items.length - 1);
}

/**
 * Slice breadcrumb to the requested level for the embedded comment tag graph.
 */
export function navigateCommentTagGraphToLevel(
    level: unknown,
    stack: CommentTagGraphStack,
    rootContent: string,
    commentManager: CommentManager,
    tagManager: TagManager
): GraphData | null {
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level >= stack.items.length) {
        return null;
    }
    const newItems = stack.items.slice(0, level + 1);
    stack.items = newItems;
    stack.visitedNodes = new Set(newItems.map(item => item.id));
    return buildStackedCommentTagGraph(stack, rootContent, commentManager, tagManager, level);
}

export function buildStackedCommentTagGraph(
    stack: CommentTagGraphStack,
    rootContent: string,
    commentManager: CommentManager,
    tagManager: TagManager,
    level: number
): GraphData {
    const item = stack.items[level];
    if (level === 0) {
        return buildTagRelationGraphData({
            commentManager,
            tagManager,
            centerFilePath: item.filePath,
            centerLabel: item.label,
            centerContent: rootContent,
            level: 0,
            breadcrumb: stack.items
        });
    }
    return buildTagRelationGraphData({
        commentManager,
        tagManager,
        centerFilePath: item.filePath,
        centerLabel: item.label,
        level,
        breadcrumb: stack.items
    });
}

/**
 * Create a vscode-backed host for production wiring.
 * Kept free of vscode imports in this module's tests via injection.
 */
export function createVscodeTagRelationGraphHost(deps: {
    getWorkspaceFolders: () => readonly { fsPath: string }[] | undefined;
    openFileAt: (filePath: string, line?: number) => Promise<void>;
    logWarn?: (message: string, detail?: unknown) => void;
}): TagRelationGraphHost {
    return {
        getWorkspaceFolders: () => deps.getWorkspaceFolders() ?? [],
        openFileAt: deps.openFileAt,
        logWarn: deps.logWarn
    };
}
