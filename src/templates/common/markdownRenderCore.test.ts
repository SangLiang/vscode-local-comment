import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const marked = require('marked');

const CORE_PATH = path.resolve(__dirname, 'markdownRenderCore.js');

function loadMarkdownRenderCore(sandboxExtras: Record<string, unknown> = {}) {
    const code = fs.readFileSync(CORE_PATH, 'utf8');
    const sandbox: Record<string, unknown> = {
        console,
        setTimeout,
        clearTimeout,
        marked,
        ...sandboxExtras,
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.runInNewContext(code, sandbox, { filename: CORE_PATH });
    return sandbox.MarkdownRenderCore as {
        create: (options?: { handDrawnEnabled?: boolean }) => {
            applyTagLinksInHtml: (html: string, tagNames?: string[]) => string;
            splitHtmlPreservingCodeBlocks: (html: string) => Array<{ preserved: boolean; html: string }>;
            renderMarkdownToHtml: (
                content: string,
                availableTagNames?: string[],
                options?: { sourceLines?: boolean }
            ) => Promise<string>;
            waitForLibs: () => Promise<void>;
            waitForMarked: () => Promise<void>;
            waitForMermaid: () => Promise<void>;
            [key: string]: unknown;
        };
    };
}

describe('MarkdownRenderCore HTML helpers (Phase 1)', () => {
    let core: ReturnType<ReturnType<typeof loadMarkdownRenderCore>['create']>;

    beforeAll(() => {
        const MarkdownRenderCore = loadMarkdownRenderCore();
        core = MarkdownRenderCore.create();
    });

    it('create() 暴露 applyTagLinksInHtml 与 splitHtmlPreservingCodeBlocks', () => {
        expect(typeof core.applyTagLinksInHtml).toBe('function');
        expect(typeof core.splitHtmlPreservingCodeBlocks).toBe('function');
    });

    it('applyTagLinksInHtml：仅白名单标签可点', () => {
        const html = '<p>见 @known 与 @unknown 标签</p>';
        const result = core.applyTagLinksInHtml(html, ['known']);
        expect(result).toContain('data-tag="known"');
        expect(result).toContain('class="tag-link"');
        expect(result).toContain('@known');
        expect(result).not.toMatch(/data-tag="unknown"/);
        expect(result).toContain('@unknown');
    });

    it('applyTagLinksInHtml：代码块内的 @tag 不链接', () => {
        const html = '<p>外 @known</p><pre><code>@known inside</code></pre>';
        const result = core.applyTagLinksInHtml(html, ['known']);
        expect(result).toMatch(/<p>[\s\S]*tag-link[\s\S]*@known/);
        const codeSection = result.slice(result.indexOf('<pre>'));
        expect(codeSection).not.toContain('tag-link');
        expect(codeSection).toContain('@known inside');
    });

    it('splitHtmlPreservingCodeBlocks：保留 pre/code 段', () => {
        const html = '<p>a</p><pre><code>x</code></pre><p>b</p>';
        const parts = core.splitHtmlPreservingCodeBlocks(html);
        expect(parts.some(p => p.preserved && p.html.includes('<pre>'))).toBe(true);
        expect(parts.filter(p => !p.preserved).map(p => p.html).join('')).toContain('<p>a</p>');
        expect(parts.filter(p => !p.preserved).map(p => p.html).join('')).toContain('<p>b</p>');
        const rejoined = parts.map(p => p.html).join('');
        expect(rejoined).toBe(html);
    });
});

describe('MarkdownRenderCore preview path (Phase 2 sourceLines)', () => {
    let core: ReturnType<ReturnType<typeof loadMarkdownRenderCore>['create']>;

    beforeAll(() => {
        // stub mermaid so waitForLibs / preview mermaid step do not hang
        const mermaidStub = {
            initialize: () => {},
            render: async (id: string) => ({ svg: '<svg data-testid="mermaid">' + id + '</svg>' }),
        };
        const katex = require('katex');
        const MarkdownRenderCore = loadMarkdownRenderCore({ mermaid: mermaidStub, katex });
        core = MarkdownRenderCore.create();
    });

    it('sourceLines: true 时标题带 0-based data-source-line', async () => {
        const html = await core.renderMarkdownToHtml('# Hello', [], { sourceLines: true });
        expect(html).toMatch(/<h1[^>]*data-source-line="0"[^>]*>/);
        expect(html).toContain('Hello');
    });

    it('sourceLines 省略时不注入 data-source-line（兼容 commentInput）', async () => {
        const html = await core.renderMarkdownToHtml('# Hello');
        expect(html).not.toContain('data-source-line');
        expect(html).toMatch(/<h1[^>]*>Hello<\/h1>/);
    });

    it('sourceLines: true 时段落行号与多行源对应', async () => {
        const md = '# Title\n\nParagraph here.';
        const html = await core.renderMarkdownToHtml(md, [], { sourceLines: true });
        expect(html).toMatch(/data-source-line="0"/);
        expect(html).toMatch(/<p[^>]*data-source-line="2"[^>]*>/);
    });

    it('sourceLines: true 时白名单 @tag 可点且代码块内不链', async () => {
        const md = ['See @known and @unknown', '', '```', '@known', '```'].join('\n');
        const html = await core.renderMarkdownToHtml(md, ['known'], { sourceLines: true });
        expect(html).toContain('data-tag="known"');
        expect(html).not.toMatch(/data-tag="unknown"/);
        const pre = html.match(/<pre[\s\S]*?<\/pre>/)?.[0] || '';
        expect(pre).toContain('@known');
        expect(pre).not.toContain('tag-link');
    });
});
