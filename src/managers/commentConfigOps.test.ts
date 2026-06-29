import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const mockState = vi.hoisted(() => ({
  workspacePath: '',
  currentCommentsConfig: 'comments.json',
}));

const mockConfigUpdate = vi.hoisted(() => vi.fn(async (key: string, value: string) => {
  if (key === 'storage.commentsConfig') {
    mockState.currentCommentsConfig = value;
  }
}));

const mockShowInfo = vi.hoisted(() => vi.fn());
const mockShowWarning = vi.hoisted(() => vi.fn());

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      if (!mockState.workspacePath) return undefined;
      return [{ uri: { fsPath: mockState.workspacePath } }];
    },
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => {
        if (key === 'storage.commentsConfig') return mockState.currentCommentsConfig;
        if (key === 'storage.bookmarksConfig') return 'bookmarks.json';
        return undefined;
      }),
      update: mockConfigUpdate,
    })),
  },
  window: {
    showInformationMessage: mockShowInfo,
    showWarningMessage: mockShowWarning,
    showErrorMessage: vi.fn(),
    showTextDocument: vi.fn(),
  },
  ConfigurationTarget: {
    Workspace: 1,
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { CommentStorage } from './commentStorage';

describe('CommentStorage config ops', () => {
  let tempRoot: string;
  let commentsDir: string;
  let storage: CommentStorage;
  const mockContext = {
    globalStorageUri: { fsPath: path.join(os.tmpdir(), 'vscode-local-comment-test-global') },
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
    },
  };

  function writeConfigFile(fileName: string, data: object): void {
    fs.writeFileSync(path.join(commentsDir, fileName), JSON.stringify(data, null, 2));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'comment-config-ops-'));
    commentsDir = path.join(tempRoot, '.vscode', 'local-comment', 'comments');
    fs.mkdirSync(commentsDir, { recursive: true });
    mockState.workspacePath = tempRoot;
    mockState.currentCommentsConfig = 'comments.json';
    writeConfigFile('comments.json', { comments: {}, shareComments: {} });
    storage = new CommentStorage(mockContext as any);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('重命名当前分组应同步更新 workspace 配置', async () => {
    writeConfigFile('comments.json', { comments: {}, shareComments: {} });

    const ok = await storage.renameCommentsConfig('comments.json', 'renamed.json');

    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(commentsDir, 'renamed.json'))).toBe(true);
    expect(fs.existsSync(path.join(commentsDir, 'comments.json'))).toBe(false);
    expect(mockConfigUpdate).toHaveBeenCalledWith(
      'storage.commentsConfig',
      'renamed.json',
      1
    );
    expect(mockState.currentCommentsConfig).toBe('renamed.json');
    expect(mockShowInfo).toHaveBeenCalledWith('已重命名: comments.json → renamed.json');
  });

  it('删除空分组应成功', async () => {
    writeConfigFile('empty-group.json', { comments: {}, shareComments: {} });

    const ok = await storage.deleteCommentsConfig('empty-group.json');

    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(commentsDir, 'empty-group.json'))).toBe(false);
    expect(mockShowInfo).toHaveBeenCalledWith('已删除分组: empty-group.json');
  });

  it('删除非空分组应失败', async () => {
    writeConfigFile('non-empty.json', {
      comments: {
        '/workspace/file.ts': [
          {
            id: 'c1',
            line: 1,
            content: 'test',
            timestamp: 1,
            originalLine: 1,
            lineContent: 'code',
          },
        ],
      },
      shareComments: {},
    });

    const ok = await storage.deleteCommentsConfig('non-empty.json');

    expect(ok).toBe(false);
    expect(fs.existsSync(path.join(commentsDir, 'non-empty.json'))).toBe(true);
    expect(mockShowWarning).toHaveBeenCalledWith('分组内还有 1 条注释，请先清空后再删除');
  });

  it('删除当前分组应失败', async () => {
    const ok = await storage.deleteCommentsConfig('comments.json');

    expect(ok).toBe(false);
    expect(fs.existsSync(path.join(commentsDir, 'comments.json'))).toBe(true);
    expect(mockShowWarning).toHaveBeenCalledWith('不能删除当前正在使用的分组');
  });

  it('countLocalCommentsInConfigFile 只统计本地注释', () => {
    writeConfigFile('mixed.json', {
      comments: {
        '/workspace/file.ts': [
          {
            id: 'local-1',
            line: 1,
            content: 'local',
            timestamp: 1,
            originalLine: 1,
            lineContent: 'code',
          },
        ],
      },
      shareComments: {
        '/workspace/file.ts': [
          {
            id: 'shared-1',
            line: 2,
            content: 'shared',
            timestamp: 1,
            originalLine: 2,
            lineContent: 'code',
            userId: 'user-1',
          },
        ],
      },
    });

    expect(storage.countLocalCommentsInConfigFile('mixed.json', tempRoot)).toBe(1);
    expect(storage.countLocalCommentsInConfigFile('missing.json', tempRoot)).toBe(0);
  });
});
