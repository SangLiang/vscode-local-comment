import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { resolveSafeWorkspacePath, parseSafeLine } from './webviewPathGuards';

describe('resolveSafeWorkspacePath', () => {
    const workspaceRoot = path.resolve('/workspace/project');
    const folders = [{ fsPath: workspaceRoot }];

    it('returns resolved path when inside a workspace folder', () => {
        const raw = path.join(workspaceRoot, 'src', 'file.ts');
        expect(resolveSafeWorkspacePath(raw, folders)).toBe(path.resolve(raw));
    });

    it('allows the workspace folder path itself (inclusive)', () => {
        expect(resolveSafeWorkspacePath(workspaceRoot, folders)).toBe(path.resolve(workspaceRoot));
    });

    it('returns null when path is outside every workspace folder', () => {
        const outside = path.resolve('/other/place/secret.ts');
        expect(resolveSafeWorkspacePath(outside, folders)).toBeNull();
    });

    it('blocks .. escape outside the workspace', () => {
        const escaped = path.join(workspaceRoot, '..', 'outside.ts');
        expect(resolveSafeWorkspacePath(escaped, folders)).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(resolveSafeWorkspacePath('', folders)).toBeNull();
    });

    it('returns null for non-string values', () => {
        expect(resolveSafeWorkspacePath(undefined, folders)).toBeNull();
        expect(resolveSafeWorkspacePath(null, folders)).toBeNull();
        expect(resolveSafeWorkspacePath(123, folders)).toBeNull();
        expect(resolveSafeWorkspacePath({ fsPath: workspaceRoot }, folders)).toBeNull();
    });

    it('returns null when workspace folders array is empty', () => {
        const absoluteInside = path.join(workspaceRoot, 'a.ts');
        expect(resolveSafeWorkspacePath(absoluteInside, [])).toBeNull();
    });

    it('compares workspace membership case-insensitively on Windows-style paths', () => {
        const winRoot = 'C:\\Work\\Project';
        const winFolders = [{ fsPath: winRoot }];
        const mixedCase = 'c:\\work\\project\\src\\App.ts';
        const resolved = resolveSafeWorkspacePath(mixedCase, winFolders);
        expect(resolved).not.toBeNull();
        expect(resolved!.toLowerCase()).toBe(path.resolve(mixedCase).toLowerCase());
    });
});

describe('parseSafeLine', () => {
    it('returns undefined for missing / null / undefined', () => {
        expect(parseSafeLine(undefined)).toBeUndefined();
        expect(parseSafeLine(null)).toBeUndefined();
    });

    it('accepts finite non-negative integers', () => {
        expect(parseSafeLine(0)).toBe(0);
        expect(parseSafeLine(12)).toBe(12);
    });

    it('accepts numeric strings that parse to non-negative integers', () => {
        expect(parseSafeLine('0')).toBe(0);
        expect(parseSafeLine('42')).toBe(42);
    });

    it('returns undefined for negative numbers', () => {
        expect(parseSafeLine(-1)).toBeUndefined();
        expect(parseSafeLine('-3')).toBeUndefined();
    });

    it('returns undefined for non-integers / non-finite / non-numeric', () => {
        expect(parseSafeLine(1.5)).toBeUndefined();
        expect(parseSafeLine('1.5')).toBeUndefined();
        expect(parseSafeLine(Number.NaN)).toBeUndefined();
        expect(parseSafeLine(Number.POSITIVE_INFINITY)).toBeUndefined();
        expect(parseSafeLine('abc')).toBeUndefined();
        expect(parseSafeLine('')).toBeUndefined();
        expect(parseSafeLine({})).toBeUndefined();
        expect(parseSafeLine(true)).toBeUndefined();
    });
});
