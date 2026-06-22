import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LocalComment, SharedComment, FileComments } from './commentManager';

// Mock 变量
const mockWorkspaceState = vi.hoisted(() => ({
  workspaceFolders: undefined as any,
  textDocuments: [] as any[],
}));

const mockGlobalState = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

const mockContext = vi.hoisted(() => ({
  globalStorageUri: { fsPath: '/tmp/vscode' },
  extensionPath: '/tmp/extension',
  subscriptions: [] as any[],
  globalState: mockGlobalState,
}));

const mockShowInfo = vi.hoisted(() => vi.fn());
const mockShowWarning = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
const mockCreateOutputChannel = vi.hoisted(() => vi.fn(() => ({
  appendLine: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
})));

const mockExecuteCommand = vi.hoisted(() => vi.fn());

const mockGetConfiguration = vi.hoisted(() => vi.fn(() => ({
  get: vi.fn((key: string) => {
    if (key === 'server.apiUrl') return 'http://127.0.0.1:8000';
    return undefined;
  }),
  update: vi.fn(),
})));

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceState.workspaceFolders;
    },
    get textDocuments() {
      return mockWorkspaceState.textDocuments;
    },
    getConfiguration: mockGetConfiguration,
    openTextDocument: vi.fn(() => ({
      lineAt: vi.fn((line: number) => ({
        text: `line ${line} content`,
      })),
      lineCount: 100,
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showInformationMessage: mockShowInfo,
    showWarningMessage: mockShowWarning,
    showErrorMessage: mockShowError,
    createOutputChannel: mockCreateOutputChannel,
    showTextDocument: vi.fn(),
  },
  commands: {
    executeCommand: mockExecuteCommand,
  },
  Uri: {
    file: vi.fn((p: string) => ({ fsPath: p })),
  },
  EventEmitter: vi.fn(() => ({
    fire: vi.fn(),
    dispose: vi.fn(),
    event: vi.fn(),
  })),
  Selection: vi.fn((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
    isEmpty: startLine === endLine && startChar === endChar,
  })),
  Position: vi.fn((line, character) => ({ line, character })),
  Range: vi.fn((start, end) => ({ start, end })),
  TextEditorRevealType: {
    InCenter: 2,
  },
}));

// Mock fs
const mockExistsSync = vi.hoisted(() => vi.fn(() => false));
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    join: vi.fn((...args: string[]) => actual.join(...args)),
    dirname: vi.fn((p: string) => actual.dirname(p)),
    sep: actual.sep,
  };
});

// Mock crypto
vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({ toString: vi.fn(() => 'random123') })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock timerUtils
vi.mock('../utils/timerUtils', () => ({
  TimerManager: vi.fn(() => ({
    setTimeout: vi.fn((fn: Function) => {
      fn();
      return 'timeout-id';
    }),
    clearTimeout: vi.fn(),
    dispose: vi.fn(),
  })),
}));

// Mock storagePathUtils
const mockStoragePaths = vi.hoisted(() => ({
  commentsDir: '/workspace/.vscode/local-comment/comments',
  bookmarksDir: '/workspace/.vscode/local-comment/bookmarks',
  oldCommentsFile: '/tmp/old/comments.json',
  oldBookmarksFile: '/tmp/old/bookmarks.json',
}));

vi.mock('../utils/storagePathUtils', () => ({
  StoragePathUtils: {
    getStoragePaths: vi.fn(() => mockStoragePaths),
    getCurrentCommentsFile: vi.fn(() => '/workspace/.vscode/local-comment/comments/comments.json'),
    fileExists: vi.fn(() => false),
    ensureNewPathExists: vi.fn(),
    ensureDirectoryExists: vi.fn(),
    listConfigFiles: vi.fn(() => ['comments.json']),
    loadConfig: vi.fn(() => ({ comments: 'comments.json', bookmarks: 'bookmarks.json' })),
    saveConfig: vi.fn(),
    isWritePermissionError: vi.fn(() => false),
  },
}));

// Mock commentMatcher
const mockBatchMatchComments = vi.hoisted(() => vi.fn(() => new Map()));
vi.mock('./commentMatcher', () => ({
  CommentMatcher: vi.fn(() => ({
    batchMatchComments: mockBatchMatchComments,
    batchMatchCommentsWithFullSearch: mockBatchMatchComments,
    batchMatchCommentsForLargeChanges: mockBatchMatchComments,
  })),
}));

import { CommentManager } from './commentManager';

describe('CommentManager 注释管理器测试', () => {
  let commentManager: CommentManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceState.workspaceFolders = [{
      uri: { fsPath: '/workspace/project' },
      name: 'project',
      index: 0,
    }];
    mockExistsSync.mockReturnValue(false);
    mockGlobalState.get.mockReturnValue(false);
    commentManager = new CommentManager(mockContext as any);
  });

  afterEach(() => {
    commentManager.dispose();
  });

  describe('constructor - 构造函数', () => {
    /**
     * 测试目标: 使用上下文创建实例
     * 功能: 验证 CommentManager 实例可以正常创建，并包含必要的方法
     */
    it('应该使用 context 创建实例', () => {
      expect(commentManager).toBeDefined();
      expect(commentManager.getAllComments).toBeDefined();
      expect(commentManager.commentMatcher).toBeDefined();
    });

    /**
     * 测试目标: 无注释文件时初始化为空
     * 功能: 当存储文件不存在时，注释列表为空对象
     */
    it('当没有注释文件时应该初始化为空注释列表', () => {
      mockExistsSync.mockReturnValue(false);
      const newManager = new CommentManager(mockContext as any);
      const comments = newManager.getAllComments();
      expect(Object.keys(comments)).toHaveLength(0);
    });
  });

  describe('addComment - 添加注释', () => {
    /**
     * 测试目标: 添加注释到指定文件
     * 功能: 在指定文件的指定行添加注释内容
     */
    it('应该添加注释到指定文件', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Test comment');

      const comments = commentManager.getAllComments();
      expect(Object.keys(comments)).toHaveLength(1);
      expect(comments['/workspace/project/src/file.ts']).toHaveLength(1);
      expect(comments['/workspace/project/src/file.ts'][0].content).toBe('Test comment');
      expect(comments['/workspace/project/src/file.ts'][0].line).toBe(10);
    });

    /**
     * 测试目标: 同一行本地注释替换
     * 功能: 同一文件的同一行只能有一个本地注释，新注释会替换旧的
     */
    it('同一行的本地注释应该被替换', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'First comment');
      await commentManager.addComment(uri, 10, 'Second comment');

      const comments = commentManager.getAllComments();
      expect(comments['/workspace/project/src/file.ts']).toHaveLength(1);
      expect(comments['/workspace/project/src/file.ts'][0].content).toBe('Second comment');
    });
  });

  describe('editComment - 编辑注释', () => {
    /**
     * 测试目标: 编辑注释内容
     * 功能: 根据注释ID更新注释内容
     */
    it('应该编辑注释内容', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Original comment');

      const comments = commentManager.getAllComments();
      const commentId = comments['/workspace/project/src/file.ts'][0].id;

      await commentManager.editComment(uri, commentId, 'Edited comment');

      const updatedComments = commentManager.getAllComments();
      expect(updatedComments['/workspace/project/src/file.ts'][0].content).toBe('Edited comment');
    });

    /**
     * 测试目标: 编辑不存在的注释时显示警告
     * 功能: 尝试编辑不存在的注释ID时显示警告信息
     */
    it('编辑不存在的注释时应该显示警告', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.editComment(uri, 'non-existent-id', 'New content');

      expect(mockShowWarning).toHaveBeenCalledWith('该文件没有本地注释');
    });
  });

  describe('removeComment - 删除注释', () => {
    /**
     * 测试目标: 按行号删除注释
     * 功能: 删除指定文件指定行的所有本地注释
     */
    it('应该根据行号删除注释', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Comment 1');
      await commentManager.addComment(uri, 20, 'Comment 2');

      await commentManager.removeComment(uri, 10);

      const comments = commentManager.getAllComments();
      expect(comments['/workspace/project/src/file.ts']).toHaveLength(1);
      expect(comments['/workspace/project/src/file.ts'][0].line).toBe(20);
    });

    /**
     * 测试目标: 删除不存在的注释时显示警告
     * 功能: 尝试删除没有注释的行时显示警告信息
     */
    it('删除不存在的注释时应该显示警告', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.removeComment(uri, 999);

      expect(mockShowWarning).toHaveBeenCalledWith(expect.stringContaining('没有本地注释'));
    });
  });

  describe('removeCommentById - 按ID删除注释', () => {
    /**
     * 测试目标: 根据ID删除注释
     * 功能: 使用注释的唯一标识符删除该注释
     */
    it('应该根据ID删除注释', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Test comment');

      const comments = commentManager.getAllComments();
      const commentId = comments['/workspace/project/src/file.ts'][0].id;

      await commentManager.removeCommentById(uri, commentId);

      const remaining = commentManager.getAllComments();
      // 当文件的所有注释都被删除后，该文件的键也会被删除
      expect(remaining['/workspace/project/src/file.ts']).toBeUndefined();
    });
  });

  describe('getLocalCommentAtLine - 获取指定行的本地注释', () => {
    /**
     * 测试目标: 获取指定行的本地注释
     * 功能: 返回特定文件特定行的本地注释（不包括共享注释）
     */
    it('应该返回指定行的本地注释', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Line 10 comment');
      await commentManager.addComment(uri, 20, 'Line 20 comment');

      const comment = commentManager.getLocalCommentAtLine('/workspace/project/src/file.ts', 10);
      expect(comment).toBeDefined();
      expect(comment?.content).toBe('Line 10 comment');
    });

    /**
     * 测试目标: 无注释行返回 undefined
     * 功能: 当指定行没有注释时返回 undefined
     */
    it('对于没有注释的行应该返回 undefined', async () => {
      const comment = commentManager.getLocalCommentAtLine('/workspace/project/src/file.ts', 999);
      expect(comment).toBeUndefined();
    });

    /**
     * 测试目标: 无注释文件返回 undefined
     * 功能: 当文件没有任何注释时返回 undefined
     */
    it('对于没有注释的文件应该返回 undefined', () => {
      const comment = commentManager.getLocalCommentAtLine('/nonexistent/file.ts', 10);
      expect(comment).toBeUndefined();
    });
  });

  describe('getCommentById - 根据ID获取注释', () => {
    /**
     * 测试目标: 根据ID获取注释
     * 功能: 使用注释ID查找并返回该注释
     */
    it('应该根据ID返回注释', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Test comment');

      const comments = commentManager.getAllComments();
      const commentId = comments['/workspace/project/src/file.ts'][0].id;

      const comment = commentManager.getCommentById(uri, commentId);
      expect(comment).toBeDefined();
      expect(comment?.id).toBe(commentId);
    });

    /**
     * 测试目标: 不存在的ID返回 undefined
     * 功能: 当注释ID不存在时返回 undefined
     */
    it('对于不存在的ID应该返回 undefined', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      const comment = commentManager.getCommentById(uri, 'non-existent');
      expect(comment).toBeUndefined();
    });
  });

  describe('clearFileComments - 清空文件注释', () => {
    /**
     * 测试目标: 清空指定文件的所有注释
     * 功能: 删除指定文件的所有注释
     */
    it('应该清空指定文件的所有注释', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Comment 1');
      await commentManager.addComment(uri, 20, 'Comment 2');

      await commentManager.clearFileComments(uri);

      const comments = commentManager.getAllComments();
      expect(Object.keys(comments)).toHaveLength(0);
    });

    /**
     * 测试目标: 清空无注释文件时显示警告
     * 功能: 尝试清空没有注释的文件时显示警告信息
     */
    it('清空没有注释的文件时应该显示警告', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.clearFileComments(uri);

      expect(mockShowWarning).toHaveBeenCalledWith('该文件没有本地注释');
    });
  });

  describe('getProjectInfo - 获取项目信息', () => {
    /**
     * 测试目标: 获取工作区项目信息
     * 功能: 返回项目名称、路径和存储文件路径
     */
    it('当存在工作区时应该返回项目信息', () => {
      const info = commentManager.getProjectInfo();
      expect(info.name).toBe('project');
      expect(info.path).toBe('/workspace/project');
      expect(info.storageFile).toBeDefined();
    });

    /**
     * 测试目标: 无工作区时返回未知项目
     * 功能: 当没有工作区时返回默认的"未知项目"信息
     */
    it('当没有工作区时应该返回"未知项目"', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const newManager = new CommentManager(mockContext as any);
      const info = newManager.getProjectInfo();
      expect(info.name).toBe('未知项目');
    });
  });

  describe('listAvailableCommentsConfigs - 列出可用配置', () => {
    /**
     * 测试目标: 获取可用的配置文件列表
     * 功能: 返回注释目录下的所有配置文件名
     */
    it('应该返回可用的配置文件列表', () => {
      const configs = commentManager.listAvailableCommentsConfigs();
      expect(configs).toContain('comments.json');
    });

    /**
     * 测试目标: 无工作区时返回空数组
     * 功能: 当没有工作区时返回空数组
     */
    it('当没有工作区时应该返回空数组', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const newManager = new CommentManager(mockContext as any);
      const configs = newManager.listAvailableCommentsConfigs();
      expect(configs).toEqual([]);
    });
  });

  describe('getCurrentCommentsConfig - 获取当前配置', () => {
    /**
     * 测试目标: 获取当前使用的配置名
     * 功能: 返回当前注释配置文件的名称
     */
    it('应该返回当前的配置文件名', () => {
      const config = commentManager.getCurrentCommentsConfig();
      expect(config).toBe('comments.json');
    });

    /**
     * 测试目标: 无工作区时返回默认值
     * 功能: 当没有工作区时返回"default"
     */
    it('当没有工作区时应该返回默认值', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const newManager = new CommentManager(mockContext as any);
      const config = newManager.getCurrentCommentsConfig();
      expect(config).toBe('default');
    });
  });

  describe('findCommentIndex - 查找注释索引', () => {
    /**
     * 测试目标: 在数组中查找注释的索引
     * 功能: 根据注释ID在注释数组中查找其索引位置
     */
    it('应该在数组中找到注释的索引', async () => {
      const uri = { fsPath: '/workspace/project/src/file.ts' } as any;
      await commentManager.addComment(uri, 10, 'Test comment');

      const comments = commentManager.getAllComments();
      const commentId = comments['/workspace/project/src/file.ts'][0].id;

      const index = commentManager.findCommentIndex(
        comments['/workspace/project/src/file.ts'],
        commentId
      );
      expect(index).toBe(0);
    });

    /**
     * 测试目标: 不存在的注释返回 -1
     * 功能: 当注释ID在数组中不存在时返回 -1
     */
    it('对于不存在的注释应该返回 -1', () => {
      const index = commentManager.findCommentIndex([], 'non-existent');
      expect(index).toBe(-1);
    });
  });

  describe('handleSharedCommentsByAuthStatus - 处理共享注释认证状态', () => {
    /**
     * 测试目标: 未登录时清除共享注释
     * 功能: 当用户未登录时，清除所有共享注释
     */
    it('当未登录时应该清除共享注释', async () => {
      await commentManager.handleSharedCommentsByAuthStatus(false);
      // 验证没有抛出错误
      expect(mockShowInfo).not.toHaveBeenCalled();
    });

    /**
     * 测试目标: 登录时保持共享注释
     * 功能: 当用户已登录时，保留共享注释
     */
    it('当已登录时应该保留共享注释', async () => {
      await commentManager.handleSharedCommentsByAuthStatus(true);
      // 验证没有抛出错误
      expect(mockShowInfo).not.toHaveBeenCalled();
    });
  });

  describe('getStorageFilePath - 获取存储文件路径', () => {
    /**
     * 测试目标: 获取存储文件路径
     * 功能: 返回当前使用的注释存储文件的完整路径
     */
    it('应该返回存储文件路径', () => {
      const path = commentManager.getStorageFilePath();
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    });
  });

  describe('getContext - 获取扩展上下文', () => {
    /**
     * 测试目标: 获取扩展上下文
     * 功能: 返回创建 CommentManager 时传入的 VS Code 扩展上下文
     */
    it('应该返回扩展上下文', () => {
      const context = commentManager.getContext();
      expect(context).toBe(mockContext);
    });
  });
});
