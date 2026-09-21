import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => {
    class TreeItem {
        label?: string;
        collapsibleState?: number;
        contextValue?: string;
        iconPath?: any;
        tooltip?: any;
        resourceUri?: any;
        command?: any;
        constructor(label: string, collapsibleState: number) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    }
    class ThemeIcon {
        id: string;
        constructor(id: string) {
            this.id = id;
        }
    }
    class MarkdownString {
        private parts: string[] = [];
        appendMarkdown(s: string) {
            this.parts.push(s);
        }
        get value() {
            return this.parts.join('');
        }
    }
    class EventEmitter<T = any> {
        private listeners: ((e: T) => void)[] = [];
        readonly event: (listener: (e: T) => void) => { dispose: () => void } = (listener) => {
            this.listeners.push(listener);
            return { dispose: () => {} };
        };
        fire(data: T) {
            for (const l of this.listeners) l(data);
        }
        dispose() {
            this.listeners = [];
        }
    }
    return {
        TreeItem,
        TreeItemCollapsibleState: { None: 0, Expanded: 1, Collapsed: 2 },
        ThemeIcon,
        MarkdownString,
        EventEmitter,
        Uri: {
            file: (p: string) => ({ fsPath: p }),
            parse: (s: string) => ({ fsPath: s }),
            from: (o: { scheme: string; path: string }) => ({ scheme: o.scheme, path: o.path })
        },
        workspace: { textDocuments: [] as any[] },
        window: { activeTextEditor: undefined as any }
    };
});

vi.mock('../utils/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import * as vscode from 'vscode';
import { CommentTreeProvider, CommentTreeItem } from './commentTreeProvider';
import type { LocalComment } from '../managers/commentTypes';

const FILE_PATH = '/project/main.ts';

function makeComment(over: Partial<LocalComment> = {}): LocalComment {
    return {
        id: 'c1',
        line: 5,
        content: 'note',
        timestamp: 1000,
        originalLine: 5,
        lineContent: 'const x = 1;',
        isShared: false,
        ...over
    };
}

interface ProviderOpts {
    /** getAllComments() 返回的注释映射 */
    allComments: Record<string, LocalComment[]>;
    /** getComments(uri) 返回值；默认返回 []（模拟文档关闭） */
    getComments?: (uri: { fsPath: string }) => any[];
}

function makeProvider(opts: ProviderOpts): CommentTreeProvider {
    const commentManager = {
        getAllComments: () => opts.allComments,
        getComments: (uri: { fsPath: string }) => (opts.getComments ? opts.getComments(uri) : [])
    } as any;
    return new CommentTreeProvider(commentManager, undefined, undefined);
}

async function getCommentNodes(provider: CommentTreeProvider, filePath: string): Promise<CommentTreeItem[]> {
    const fileNode = new CommentTreeItem('f', vscode.TreeItemCollapsibleState.Expanded, 'file');
    fileNode.filePath = filePath;
    const nodes = await provider.getChildren(fileNode);
    return nodes.filter((n: any) => n.contextValue === 'comment' || n.contextValue === 'hidden-comment') as CommentTreeItem[];
}

describe('CommentTreeProvider isMatchable 判定源', () => {
    it('文档关闭 + isMatched=true：应判定为可匹配（彩色 comment），不再误暗', async () => {
        // 回归：旧逻辑用 getComments 是否返回该注释判定，文档关闭 getComments 返回 [] → 误判 unresolved
        const comment = makeComment({ isMatched: true });
        const provider = makeProvider({ allComments: { [FILE_PATH]: [comment] } });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('comment');
        expect((nodes[0].iconPath as vscode.ThemeIcon).id).toBe('comment');
        expect(nodes[0].resourceUri).toBeUndefined();
    });

    it('文档关闭 + isMatched=false：应判定为未匹配（暗色 hidden-comment）', async () => {
        const comment = makeComment({ isMatched: false });
        const provider = makeProvider({ allComments: { [FILE_PATH]: [comment] } });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('hidden-comment');
        expect((nodes[0].iconPath as vscode.ThemeIcon).id).toBe('comment-unresolved');
        expect(nodes[0].resourceUri).toBeDefined();
    });

    it('文档关闭 + isMatched=undefined（导入/迁移的旧注释）：乐观视为可匹配', async () => {
        const comment = makeComment({}); // 不设 isMatched
        expect(comment.isMatched).toBeUndefined();
        const provider = makeProvider({ allComments: { [FILE_PATH]: [comment] } });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('comment');
        expect((nodes[0].iconPath as vscode.ThemeIcon).id).toBe('comment');
    });

    it('文档打开 + getComments 返回匹配（行号已更新）：label 用 matchedComment.line', async () => {
        const stored = makeComment({ id: 'c1', line: 5, isMatched: true });
        const matched = makeComment({ id: 'c1', line: 8, isMatched: true }); // 匹配后行号变 8
        const provider = makeProvider({
            allComments: { [FILE_PATH]: [stored] },
            getComments: () => [matched]
        });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('comment');
        // matchedComment.line=8 → "第9行"
        expect(nodes[0].label).toBe('第9行: note');
    });

    it('文档关闭 + isMatched=true + color：应使用彩色 svg 图标（data uri）', async () => {
        const comment = makeComment({ isMatched: true, color: 'red' as any });
        const provider = makeProvider({ allComments: { [FILE_PATH]: [comment] } });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('comment');
        expect((nodes[0].iconPath as any).scheme).toBe('data');
    });

    it('共享注释（含 userId）不应出现在注释树中', async () => {
        const local = makeComment({ id: 'local', isMatched: true });
        const shared = makeComment({ id: 'shared', isMatched: true }) as any;
        shared.userId = 'u1';
        const provider = makeProvider({ allComments: { [FILE_PATH]: [local, shared] } });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect((nodes[0].comment as any).id).toBe('local');
    });

    it('真未匹配（isMatched=false）即使文档打开 getComments 返回空，仍判定为未匹配', async () => {
        // 双重确认：isMatched=false 是权威判定源，不因 getComments 返回与否而翻转
        const comment = makeComment({ isMatched: false });
        const provider = makeProvider({
            allComments: { [FILE_PATH]: [comment] },
            getComments: () => [] // 即便文档打开但匹配失败
        });

        const nodes = await getCommentNodes(provider, FILE_PATH);

        expect(nodes).toHaveLength(1);
        expect(nodes[0].contextValue).toBe('hidden-comment');
        expect((nodes[0].iconPath as vscode.ThemeIcon).id).toBe('comment-unresolved');
    });
});
