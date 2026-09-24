import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import type { LocalComment } from '../managers/commentTypes';
import type { CommentManager } from '../managers/commentManager';
import { TagManager } from '../managers/tagManager';
import {
    buildPanelRootGraph,
    expandTagRelationNode,
    goToTagRelationDefinition,
    navigateCommentTagGraphBack,
    navigateCommentTagGraphToLevel,
    navigatePanelToLevel,
    type CommentTagGraphStack,
    type TagRelationGraphHost
} from './tagRelationGraphHandlers';

vi.mock('vscode', () => ({
    Uri: { file: (fsPath: string) => ({ fsPath }) }
}));

function comment(partial: Partial<LocalComment> & { content: string }): LocalComment {
    return {
        id: partial.id ?? 'c1',
        line: partial.line ?? 0,
        originalLine: partial.originalLine ?? 0,
        lineContent: partial.lineContent ?? '',
        timestamp: partial.timestamp ?? 1,
        content: partial.content
    };
}

function mockManager(all: Record<string, LocalComment[]>): CommentManager {
    return {
        getAllComments: () => all,
        getComments: (uri: { fsPath: string }) => all[uri.fsPath] ?? []
    } as unknown as CommentManager;
}

function buildTagManager(commentManager: CommentManager): TagManager {
    const tm = new TagManager();
    tm.updateTags(commentManager.getAllComments());
    return tm;
}

const workspaceRoot = path.resolve('/workspace/project');
const authPath = path.join(workspaceRoot, 'auth.ts');
const sessionPath = path.join(workspaceRoot, 'session.ts');
const outsidePath = path.resolve('/other/secret.ts');

function declaredComments() {
    return {
        [authPath]: [comment({
            id: 'auth',
            line: 10,
            content: '${configLoader} entry\n@see @sessionStore'
        })],
        [sessionPath]: [comment({
            id: 'sess',
            line: 3,
            content: '${sessionStore} store'
        })]
    };
}

function createHost(overrides?: Partial<TagRelationGraphHost>): TagRelationGraphHost & { openFileAt: ReturnType<typeof vi.fn> } {
    const openFileAt = (overrides?.openFileAt as ReturnType<typeof vi.fn> | undefined) ?? vi.fn(async () => undefined);
    return {
        getWorkspaceFolders: () => [{ fsPath: workspaceRoot }],
        logWarn: vi.fn(),
        ...overrides,
        openFileAt
    } as TagRelationGraphHost & { openFileAt: ReturnType<typeof vi.fn> };
}

describe('expandTagRelationNode', () => {
    it('builds children for a safe workspace path', () => {
        const commentManager = mockManager(declaredComments());
        const host = createHost();
        const result = expandTagRelationNode(host, {
            nodeId: 'n1',
            label: '@sessionStore',
            filePath: authPath,
            commentManager,
            tagManager: buildTagManager(commentManager)
        });
        expect(result).not.toBeNull();
        expect(result!.parentId).toBe('n1');
        expect(Array.isArray(result!.children.nodes)).toBe(true);
    });

    it('returns null and does not throw for an unsafe path', () => {
        const commentManager = mockManager(declaredComments());
        const host = createHost();
        const result = expandTagRelationNode(host, {
            nodeId: 'n1',
            label: '@sessionStore',
            filePath: outsidePath,
            commentManager,
            tagManager: buildTagManager(commentManager)
        });
        expect(result).toBeNull();
        expect(host.logWarn).toHaveBeenCalled();
    });

    it('falls back to fallbackFilePath when filePath missing', () => {
        const commentManager = mockManager(declaredComments());
        const host = createHost();
        const result = expandTagRelationNode(host, {
            nodeId: 'n1',
            label: '@sessionStore',
            fallbackFilePath: authPath,
            commentManager,
            tagManager: buildTagManager(commentManager)
        });
        expect(result).not.toBeNull();
    });

    it('returns null when nodeId or label missing', () => {
        const commentManager = mockManager(declaredComments());
        const host = createHost();
        expect(expandTagRelationNode(host, {
            label: '@x',
            filePath: authPath,
            commentManager,
            tagManager: buildTagManager(commentManager)
        })).toBeNull();
        expect(expandTagRelationNode(host, {
            nodeId: 'n1',
            filePath: authPath,
            commentManager,
            tagManager: buildTagManager(commentManager)
        })).toBeNull();
    });
});

describe('goToTagRelationDefinition', () => {
    it('opens a safe path with a valid line', async () => {
        const host = createHost();
        const ok = await goToTagRelationDefinition(host, { filePath: authPath, line: 10 });
        expect(ok).toBe(true);
        expect(host.openFileAt).toHaveBeenCalledWith(path.resolve(authPath), 10);
    });

    it('does not call openFileAt for an unsafe path', async () => {
        const host = createHost();
        const ok = await goToTagRelationDefinition(host, { filePath: outsidePath, line: 1 });
        expect(ok).toBe(false);
        expect(host.openFileAt).not.toHaveBeenCalled();
    });

    it('opens safe path without selection when line is invalid', async () => {
        const host = createHost();
        const ok = await goToTagRelationDefinition(host, { filePath: authPath, line: 'nope' });
        expect(ok).toBe(true);
        expect(host.openFileAt).toHaveBeenCalledWith(path.resolve(authPath), undefined);
    });
});

describe('panel navigation helpers', () => {
    it('buildPanelRootGraph returns null without rootItem', () => {
        const commentManager = mockManager(declaredComments());
        expect(buildPanelRootGraph(undefined, commentManager, buildTagManager(commentManager))).toBeNull();
    });

    it('buildPanelRootGraph builds from rootItem', () => {
        const commentManager = mockManager(declaredComments());
        const root = { id: 'root', label: 'auth.ts', filePath: authPath };
        const data = buildPanelRootGraph(root, commentManager, buildTagManager(commentManager));
        expect(data).not.toBeNull();
        expect(data!.breadcrumb[0]).toEqual(root);
    });

    it('navigatePanelToLevel only resets at level 0', () => {
        const commentManager = mockManager(declaredComments());
        const tm = buildTagManager(commentManager);
        const root = { id: 'root', label: 'auth.ts', filePath: authPath };
        expect(navigatePanelToLevel(0, root, commentManager, tm)).not.toBeNull();
        expect(navigatePanelToLevel(1, root, commentManager, tm)).toBeNull();
    });
});

describe('embedded comment tag graph navigation', () => {
    function makeStack(): CommentTagGraphStack {
        return {
            items: [
                { id: 'root', label: 'current', filePath: authPath },
                { id: 'child', label: '@sessionStore', filePath: sessionPath }
            ],
            visitedNodes: new Set(['root', 'child'])
        };
    }

    it('navigateCommentTagGraphBack pops and rebuilds', () => {
        const commentManager = mockManager(declaredComments());
        const stack = makeStack();
        const data = navigateCommentTagGraphBack(stack, 'root body', commentManager, buildTagManager(commentManager));
        expect(data).not.toBeNull();
        expect(stack.items).toHaveLength(1);
        expect(stack.visitedNodes.has('child')).toBe(false);
    });

    it('navigateCommentTagGraphBack is no-op at root', () => {
        const commentManager = mockManager(declaredComments());
        const stack = {
            items: [{ id: 'root', label: 'current', filePath: authPath }],
            visitedNodes: new Set(['root'])
        };
        expect(navigateCommentTagGraphBack(stack, 'x', commentManager, buildTagManager(commentManager))).toBeNull();
    });

    it('navigateCommentTagGraphToLevel slices the stack', () => {
        const commentManager = mockManager(declaredComments());
        const stack = makeStack();
        const data = navigateCommentTagGraphToLevel(0, stack, 'root body', commentManager, buildTagManager(commentManager));
        expect(data).not.toBeNull();
        expect(stack.items).toHaveLength(1);
    });
});
