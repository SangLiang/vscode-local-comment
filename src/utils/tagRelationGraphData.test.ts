import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import { LocalComment } from '../managers/commentTypes';
import type { CommentManager } from '../managers/commentManager';
import { TagManager } from '../managers/tagManager';
import {
    buildTagRelationGraphData,
    buildTagRelationChildNodes,
    extractTagReferences,
    tagNameFromCenterLabel
} from './tagRelationGraphData';

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

/** 与扩展侧容器实例用法一致：基于全量注释构建一次索引后复用 */
function buildTagManager(commentManager: CommentManager): TagManager {
    const tm = new TagManager();
    tm.updateTags(commentManager.getAllComments());
    return tm;
}

const authPath = path.join('/proj', 'auth.ts');
const sessionPath = path.join('/proj', 'session.ts');

function declaredComments() {
    return {
        [authPath]: [comment({
            id: 'auth',
            line: 10,
            content: '${configLoader} 入口\n见 @sessionStore'
        })],
        [sessionPath]: [comment({
            id: 'sess',
            line: 3,
            content: '${sessionStore} 存储'
        })]
    };
}

describe('tagNameFromCenterLabel', () => {
    it('从节点 label 取出 tag 名', () => {
        expect(tagNameFromCenterLabel('@configLoader\nauth.ts:11')).toBe('configLoader');
        expect(tagNameFromCenterLabel('当前注释')).toBe('当前注释');
    });
});

describe('buildTagRelationGraphData', () => {
    const breadcrumb = [{ id: 'root', label: '当前注释', filePath: authPath }];

    it('centerContent 有已声明 @tag 时画出中心和目标节点', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '当前注释',
            centerContent: '复用 @configLoader',
            level: 0,
            breadcrumb
        });
        expect(data.nodes[0]).toMatchObject({ id: 'center', label: '当前注释', type: 'center' });
        expect(data.nodes.some(n => n.type === 'tag' && n.label.startsWith('@configLoader'))).toBe(true);
        expect(data.edges).toHaveLength(1);
        expect(data.edges[0].source).toBe('center');
    });

    it('断链不出现在图上', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '当前注释',
            centerContent: '没有 @notExist',
            level: 0,
            breadcrumb
        });
        expect(data.nodes).toHaveLength(1);
        expect(data.nodes[0].id).toBe('center');
        expect(data.edges).toHaveLength(0);
    });

    it('无 @tag 时只有中心节点', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '当前注释',
            centerContent: '普通说明',
            level: 0,
            breadcrumb
        });
        expect(data.nodes).toHaveLength(1);
        expect(data.edges).toHaveLength(0);
    });

    it('代码块内 @tag 不进入第一层', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '当前注释',
            centerContent: '```\n@configLoader\n```\n外面 @sessionStore',
            level: 0,
            breadcrumb
        });
        const tagLabels = data.nodes.filter(n => n.type === 'tag').map(n => n.label);
        expect(tagLabels.some(l => l.startsWith('@sessionStore'))).toBe(true);
        expect(tagLabels.some(l => l.startsWith('@configLoader'))).toBe(false);
    });

    it('提供 centerContent 时不合并同文件其他注释里的 @tag', () => {
        const all = {
            [authPath]: [
                comment({ id: 'other', line: 1, content: '其他注释 @sessionStore' }),
                comment({ id: 'mine', line: 2, content: '${unused}' })
            ],
            [sessionPath]: [comment({ id: 'sess', line: 3, content: '${sessionStore}' })]
        };
        const commentManager = mockManager(all);
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '当前注释',
            centerContent: '只有文字',
            level: 0,
            breadcrumb
        });
        expect(data.nodes.filter(n => n.type === 'tag')).toHaveLength(0);
    });

    it('level>=1 从声明正文展开并过滤断链', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: '@configLoader\nauth.ts:11',
            level: 1,
            breadcrumb: [
                ...breadcrumb,
                { id: 'tag-0', label: '@configLoader', filePath: authPath }
            ]
        });
        expect(data.nodes[0].type).toBe('center');
        expect(data.nodes.some(n => n.type === 'tag' && n.label.startsWith('@sessionStore'))).toBe(true);
        expect(data.nodes.some(n => n.id === 'tag-sessionStore')).toBe(true);
        expect(data.nodes.some(n => n.label.includes('notExist'))).toBe(false);
    });

    it('buildTagRelationChildNodes 把子节点挂到指定父节点', () => {
        const commentManager = mockManager(declaredComments());
        const children = buildTagRelationChildNodes({
            commentManager,
            tagManager: buildTagManager(commentManager),
            parentId: 'tag-configLoader',
            centerLabel: '@configLoader\nauth.ts:11',
            centerFilePath: authPath
        });
        expect(children.nodes.some(n => n.id === 'tag-sessionStore')).toBe(true);
        expect(children.nodes.some(n => n.id === 'center')).toBe(false);
        expect(children.edges.every(e => e.source === 'tag-configLoader')).toBe(true);
    });

    it('未提供 centerContent 的 level 0 包含文件内全部注释引用', () => {
        const commentManager = mockManager(declaredComments());
        const data = buildTagRelationGraphData({
            commentManager,
            tagManager: buildTagManager(commentManager),
            centerFilePath: authPath,
            centerLabel: 'auth.ts',
            level: 0,
            breadcrumb: [{ id: 'root', label: 'auth.ts', filePath: authPath }]
        });
        expect(data.nodes.some(n => n.type === 'tag' && n.label.startsWith('@sessionStore'))).toBe(true);
    });
});

describe('extractTagReferences', () => {
    it('去重引用名', () => {
        expect(extractTagReferences('a @foo b @foo')).toEqual(['foo']);
    });
});
