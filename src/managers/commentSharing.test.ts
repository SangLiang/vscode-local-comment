import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace/project' } }],
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() }))
  },
  window: {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn()
  },
  EventEmitter: vi.fn(() => ({
    event: vi.fn(),
    fire: vi.fn(),
    dispose: vi.fn()
  }))
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn()
}));

// Mock path
vi.mock('path', () => ({
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/') || '/'),
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
  join: vi.fn((...args: string[]) => args.join('/').replace(/\/+/g, '/')),
  resolve: vi.fn((...args: string[]) => args.join('/').replace(/\/+/g, '/')),
  relative: vi.fn((from: string, to: string) => {
    if (to.startsWith(from)) {
      return to.slice(from.length).replace(/^\//, '');
    }
    return to;
  })
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock storagePathUtils
vi.mock('../utils/storagePathUtils', () => ({
  StoragePathUtils: {
    getStoragePaths: vi.fn(() => ({
      commentsDir: '/workspace/project/.vscode/local-comment/comments',
      bookmarksDir: '/workspace/project/.vscode/local-comment/bookmarks',
      oldCommentsFile: '/global/storage/local-comments.json',
      oldBookmarksFile: '/global/storage/local-bookmarks.json'
    })),
    getCurrentCommentsFile: vi.fn(() => '/workspace/project/.vscode/local-comment/comments/comments.json'),
    fileExists: vi.fn(() => true),
    ensureNewPathExists: vi.fn(),
    ensureDirectoryExists: vi.fn(),
    listConfigFiles: vi.fn(() => ['comments.json']),
    loadConfig: vi.fn(() => ({ comments: 'comments.json' })),
    saveConfig: vi.fn(),
    isWritePermissionError: vi.fn(() => false)
  }
}));

// Mock utils
vi.mock('../utils/utils', () => ({
  toAbsolutePath: vi.fn((p: string) => p),
  getErrorMessage: vi.fn((err: any) => err?.message || String(err)),
  getFirstWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace/project' } })),
  getFirstWorkspacePathOrWarn: vi.fn(() => '/workspace/project')
}));

// Mock apiService
vi.mock('../apiService', () => ({
  apiService: {
    get: vi.fn()
  },
  ApiRoutes: {
    comment: {
      getProjectSharedComments: (id: number) => `/comments/project/${id}`
    }
  }
}));

// Import after mocks
import { CommentSharing } from './commentSharing';
import { CommentStorage } from './commentStorage';
import * as fs from 'fs';

describe('CommentSharing', () => {
  let sharing: CommentSharing;
  let storage: CommentStorage;
  let mockAuthManager: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      globalStorageUri: { fsPath: '/global/storage' },
      globalState: { get: vi.fn(), update: vi.fn() },
      extensionPath: '/extension/path',
      subscriptions: []
    };

    storage = new CommentStorage(mockContext as any);

    // 创建符合 AuthManager 接口的 mock
    mockAuthManager = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      getCurrentUser: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      onDidChangeLoginState: { event: vi.fn() }
    };

    sharing = new CommentSharing(storage, mockAuthManager as any);
  });

  describe('clearAllSharedComments', () => {
    it('应该清空所有共享注释', async () => {
      const shareComments = storage.getShareCommentsRef();
      shareComments['/test/file.ts'] = [
        {
          id: 'shared-1',
          line: 10,
          content: 'shared comment',
          timestamp: Date.now(),
          originalLine: 10,
          lineContent: 'code',
          userId: 'user-1'
        }
      ];

      const count = await sharing.clearAllSharedComments();

      expect(count).toBe(1);
      expect(Object.keys(shareComments)).toHaveLength(0);
    });

    it('应该在共享列表为空时返回0', async () => {
      const count = await sharing.clearAllSharedComments();
      expect(count).toBe(0);
    });

    it('应该只统计有userId的共享注释', async () => {
      const shareComments = storage.getShareCommentsRef();
      shareComments['/test/file.ts'] = [
        {
          id: 'shared-1',
          line: 10,
          content: 'shared comment',
          timestamp: Date.now(),
          originalLine: 10,
          lineContent: 'code',
          userId: 'user-1'
        },
        {
          id: 'local-1',
          line: 20,
          content: 'local comment',
          timestamp: Date.now(),
          originalLine: 20,
          lineContent: 'code'
        }
      ];

      const count = await sharing.clearAllSharedComments();

      expect(count).toBe(1); // 只有带 userId 的被统计
    });
  });

  describe('clearFileSharedComments', () => {
    it('应该清空指定文件的共享注释', async () => {
      const shareComments = storage.getShareCommentsRef();
      shareComments['/test/file.ts'] = [
        {
          id: 'shared-1',
          line: 10,
          content: 'shared comment',
          timestamp: Date.now(),
          originalLine: 10,
          lineContent: 'code',
          userId: 'user-1'
        }
      ];

      const count = await sharing.clearFileSharedComments('/test/file.ts');

      expect(count).toBe(1);
      expect(shareComments['/test/file.ts']).toBeUndefined();
    });

    it('应该在文件没有共享注释时返回0', async () => {
      const count = await sharing.clearFileSharedComments('/nonexistent/file.ts');
      expect(count).toBe(0);
    });
  });

  describe('addCommentFromShared', () => {
    it('应该从共享注释创建本地注释', async () => {
      await sharing.addCommentFromShared(
        '/test/file.ts',
        10,
        'shared content',
        'const x = 1;',
        10,
        true
      );

      const comments = storage.getCommentsRef();
      expect(comments['/test/file.ts']).toHaveLength(1);
      expect(comments['/test/file.ts'][0].content).toBe('shared content');
      expect(comments['/test/file.ts'][0].lineContent).toBe('const x = 1;');
    });

    it('应该保留原始行内容', async () => {
      await sharing.addCommentFromShared(
        '/test/file.ts',
        20,
        'comment',
        'original line content',
        20,
        true
      );

      const comments = storage.getCommentsRef();
      expect(comments['/test/file.ts'][0].lineContent).toBe('original line content');
    });
  });

  describe('getProjectSharedComments', () => {
    it('应该从API获取共享注释', async () => {
      const { apiService } = await import('../apiService');
      const mockComments = [
        {
          id: 1,
          content: {
            id: 'api-1',
            line: 10,
            content: 'api comment',
            timestamp: Date.now(),
            originalLine: 10,
            lineContent: 'code'
          },
          file_path: '/test/file.ts',
          project_id: 123,
          is_public: true,
          user_id: 1,
          username: 'testuser',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      vi.mocked(apiService.get).mockResolvedValue(mockComments);

      const result = await sharing.getProjectSharedComments(123);

      expect(result).toHaveLength(1);
      expect(result![0].id).toBe(1);
      expect(result![0].content.content).toBe('api comment');
    });

    it('应该在API失败时返回null', async () => {
      const { apiService } = await import('../apiService');
      vi.mocked(apiService.get).mockRejectedValue(new Error('API Error'));

      const result = await sharing.getProjectSharedComments(123);

      expect(result).toBeNull();
    });

    it('应该处理空响应', async () => {
      const { apiService } = await import('../apiService');
      vi.mocked(apiService.get).mockResolvedValue([]);

      const result = await sharing.getProjectSharedComments(123);

      expect(result).toEqual([]);
    });
  });
});
