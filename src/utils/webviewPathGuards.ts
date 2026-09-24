import * as path from 'path';

/**
 * Resolve and validate a workspace-relative file path from untrusted Webview input.
 * Returns null when the path is missing, non-string, empty, outside all workspace folders,
 * or when no workspace folders are available.
 */
export function resolveSafeWorkspacePath(
    raw: unknown,
    workspaceFolders: readonly { fsPath: string }[]
): string | null {
    if (typeof raw !== 'string' || raw.length === 0) {
        return null;
    }
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return null;
    }

    const resolved = path.resolve(raw);
    const resolvedKey = normalizePathKey(resolved);

    for (const folder of workspaceFolders) {
        const folderResolved = path.resolve(folder.fsPath);
        const folderKey = normalizePathKey(folderResolved);
        if (isUnderOrEqual(resolvedKey, folderKey)) {
            return resolved;
        }
    }
    return null;
}

/**
 * Parse a 0-based line number from untrusted Webview input.
 * Missing/null/undefined or invalid values return undefined (open file without selection).
 */
export function parseSafeLine(raw: unknown): number | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }

    let numeric: number;
    if (typeof raw === 'number') {
        numeric = raw;
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed === '') {
            return undefined;
        }
        numeric = Number(trimmed);
    } else {
        return undefined;
    }

    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
        return undefined;
    }
    return numeric;
}

function normalizePathKey(p: string): string {
    const normalized = path.normalize(p);
    // Windows compares case-insensitively. Also lowercase Win-style drive paths in tests on any OS.
    if (process.platform === 'win32' || /^[a-zA-Z]:/.test(normalized) || normalized.includes('\\')) {
        return normalized.toLowerCase();
    }
    return normalized;
}

function isUnderOrEqual(childKey: string, parentKey: string): boolean {
    if (childKey === parentKey) {
        return true;
    }
    const sep = path.sep;
    const prefix = parentKey.endsWith(sep) ? parentKey : parentKey + sep;
    const altPrefix = parentKey.endsWith('/') ? parentKey : parentKey + '/';
    return childKey.startsWith(prefix) || childKey.startsWith(altPrefix);
}
