import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// 使用 vi.hoisted 来创建可以在 mock 中使用的变量
const mockWorkspaceState = vi.hoisted(() => ({
  workspaceFolders: undefined as any,
}));

const mockShowWarningMessage = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());
const mockUriFile = vi.hoisted(() => vi.fn((filePath: string) => ({ fsPath: filePath })));
const mockCreateOutputChannel = vi.hoisted(() => vi.fn(() => ({
  appendLine: vi.fn(),
  show: vi.fn(),
  dispose: vi.fn(),
})));

// Mock vscode 模块 - 必须在其他 import 之前
vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return mockWorkspaceState.workspaceFolders;
    },
    fs: {
      readFile: mockReadFile,
    },
  },
  window: {
    showWarningMessage: mockShowWarningMessage,
    createOutputChannel: mockCreateOutputChannel,
  },
  Uri: {
    file: mockUriFile,
  },
}));

// Mock fs 模块
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock logger 模块
vi.mock('./logger', async () => {
  return {
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4,
    },
  };
});

// 在 mock 之后导入被测模块
let utils: typeof import('./utils');

describe('utils 工具函数测试', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockWorkspaceState.workspaceFolders = undefined;
    // 动态导入被测模块
    utils = await import('./utils');
  });

  describe('getErrorMessage - 错误消息提取', () => {
    /**
     * 测试目标: Error 实例转换为消息字符串
     * 功能: 从 Error 对象中提取 message 属性
     */
    it('应该返回 Error 实例的 message 属性', () => {
      const error = new Error('测试错误');
      expect(utils.getErrorMessage(error)).toBe('测试错误');
    });

    /**
     * 测试目标: 非 Error 值返回"未知错误"
     * 功能: 处理非 Error 类型的值（字符串、数字、null、undefined、对象）
     */
    it('对于非 Error 值应该返回"未知错误"', () => {
      expect(utils.getErrorMessage('string error')).toBe('未知错误');
      expect(utils.getErrorMessage(123)).toBe('未知错误');
      expect(utils.getErrorMessage(null)).toBe('未知错误');
      expect(utils.getErrorMessage(undefined)).toBe('未知错误');
      expect(utils.getErrorMessage({})).toBe('未知错误');
    });
  });

  describe('getFirstWorkspaceFolder - 获取首个工作区文件夹', () => {
    /**
     * 测试目标: 无工作区时返回 null
     * 功能: 当 VS Code 没有打开任何工作区时返回 null
     */
    it('当没有工作区文件夹时应该返回 null', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      expect(utils.getFirstWorkspaceFolder()).toBeNull();
    });

    /**
     * 测试目标: 工作区数组为空时返回 null
     * 功能: 当工作区数组为空时返回 null
     */
    it('当工作区数组为空时应该返回 null', () => {
      mockWorkspaceState.workspaceFolders = [];
      expect(utils.getFirstWorkspaceFolder()).toBeNull();
    });

    /**
     * 测试目标: 存在工作区时返回第一个
     * 功能: 返回工作区数组的第一个元素
     */
    it('当存在工作区文件夹时应该返回第一个', () => {
      const mockFolder = {
        uri: { fsPath: '/test/project' },
        name: 'test',
        index: 0,
      };
      mockWorkspaceState.workspaceFolders = [mockFolder];
      expect(utils.getFirstWorkspaceFolder()).toBe(mockFolder);
    });
  });

  describe('getFirstWorkspacePathOrWarn - 获取工作区路径或警告', () => {
    /**
     * 测试目标: 无工作区时显示警告
     * 功能: 当没有工作区时显示"没有打开的工作区"警告并返回 null
     */
    it('当没有工作区时应该显示警告并返回 null', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const result = utils.getFirstWorkspacePathOrWarn();
      expect(result).toBeNull();
      expect(mockShowWarningMessage).toHaveBeenCalledWith('没有打开的工作区');
    });

    /**
     * 测试目标: 有工作区时返回路径
     * 功能: 返回第一个工作区的 fsPath，不显示警告
     */
    it('当存在工作区时应该返回路径而不显示警告', () => {
      const mockFolder = {
        uri: { fsPath: '/test/project' },
        name: 'test',
        index: 0,
      };
      mockWorkspaceState.workspaceFolders = [mockFolder];
      const result = utils.getFirstWorkspacePathOrWarn();
      expect(result).toBe('/test/project');
      expect(mockShowWarningMessage).not.toHaveBeenCalled();
    });
  });

  describe('normalizeFilePath - 标准化文件路径', () => {
    /**
     * 测试目标: Windows 路径转换为 Unix 格式
     * 功能: 将 C:\Users\test\file.ts 转换为 /Users/test/file.ts
     */
    it('当没有工作区时应该将 Windows 路径转换为 Unix 格式', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const result = utils.normalizeFilePath('C:\\Users\\test\\file.ts');
      expect(result).toBe('/Users/test/file.ts');
    });

    /**
     * 测试目标: 已标准化的路径保持不变
     * 功能: Unix 风格的路径保持不变
     */
    it('对于已标准化的路径应该保持不变', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const result = utils.normalizeFilePath('/Users/test/file.ts');
      expect(result).toBe('/Users/test/file.ts');
    });

    /**
     * 测试目标: 存在工作区时返回相对路径
     * 功能: 将绝对路径转换为相对于工作区的相对路径
     */
    it('当存在工作区时应该返回相对路径', () => {
      mockWorkspaceState.workspaceFolders = [{
        uri: { fsPath: '/workspace/project' },
        name: 'project',
        index: 0,
      }];
      const result = utils.normalizeFilePath('/workspace/project/src/file.ts');
      expect(result).toBe('src/file.ts');
    });

    /**
     * 测试目标: 路径在工作区外时返回 ../ 相对路径
     * 功能: 处理位于工作区外的路径，使用 ../ 表示
     */
    it('对于工作区外的路径应该使用 ../ 相对路径', () => {
      mockWorkspaceState.workspaceFolders = [{
        uri: { fsPath: '/workspace/project' },
        name: 'project',
        index: 0,
      }];
      const result = utils.normalizeFilePath('/other/path/file.ts');
      expect(result).toMatch(/^\.\.\//);
    });
  });

  describe('toAbsolutePath - 转换为绝对路径', () => {
    /**
     * 测试目标: 无工作区时解析为绝对路径
     * 功能: 使用 path.resolve 将相对路径解析为绝对路径
     */
    it('当没有工作区时应该使用 path.resolve 解析为绝对路径', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      const result = utils.toAbsolutePath('src/file.ts');
      // path.resolve 会返回绝对路径
      expect(path.isAbsolute(result)).toBe(true);
    });

    /**
     * 测试目标: 有工作区时拼接路径
     * 功能: 将相对路径与工作区路径拼接为绝对路径
     */
    it('当存在工作区时应该将路径与工作区路径拼接', () => {
      mockWorkspaceState.workspaceFolders = [{
        uri: { fsPath: '/workspace/project' },
        name: 'project',
        index: 0,
      }];
      const result = utils.toAbsolutePath('src/file.ts');
      expect(result).toBe(path.join('/workspace/project', 'src/file.ts'));
    });

    /**
     * 测试目标: 绝对路径保持不变
     * 功能: 输入已经是绝对路径时直接返回
     */
    it('对于绝对路径应该保持不变', () => {
      mockWorkspaceState.workspaceFolders = [{
        uri: { fsPath: '/workspace/project' },
        name: 'project',
        index: 0,
      }];
      const result = utils.toAbsolutePath('/absolute/path/file.ts');
      // path.join 的行为取决于操作系统
      // 在 Windows 上，path.join 会保留绝对路径的行为
      // 我们只需要验证结果是绝对路径即可
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('absolute');
      expect(result).toContain('file.ts');
    });
  });

  describe('normalizeFileComments - 标准化注释中的文件路径', () => {
    /**
     * 测试目标: 批量转换注释对象中的所有路径
     * 功能: 将注释对象中所有 Windows 路径转换为 Unix 格式
     */
    it('应该标准化注释对象中的所有文件路径', () => {
      mockWorkspaceState.workspaceFolders = undefined;
      
      const comments = {
        'C:\\Users\\test\\file1.ts': [{ id: '1', content: 'comment1' }],
        'C:\\Users\\test\\file2.ts': [{ id: '2', content: 'comment2' }],
      };

      const result = utils.normalizeFileComments(comments);

      expect(Object.keys(result)).toEqual(['/Users/test/file1.ts', '/Users/test/file2.ts']);
      expect(result['/Users/test/file1.ts']).toEqual([{ id: '1', content: 'comment1' }]);
    });

    /**
     * 测试目标: 空注释对象保持不变
     * 功能: 处理空的注释对象
     */
    it('对于空的注释对象应该返回空对象', () => {
      const result = utils.normalizeFileComments({});
      expect(result).toEqual({});
    });
  });

  describe('remapFileCommentsToWorkspace - 重新映射注释路径到工作区', () => {
    /**
     * 测试目标: 相对路径转换为绝对路径
     * 功能: 将相对路径（如 src/file.ts）映射为工作区下的绝对路径
     */
    it('应该将相对路径映射为绝对路径', () => {
      const comments = {
        'src/file.ts': [{ id: '1', content: 'comment1' }],
      };

      const result = utils.remapFileCommentsToWorkspace(comments, '/workspace/project');

      expect(Object.keys(result)[0]).toContain('file.ts');
      expect(result[Object.keys(result)[0]]).toEqual([{ id: '1', content: 'comment1' }]);
    });

    /**
     * 测试目标: 其他机器的绝对路径重映射
     * 功能: 处理从其他机器拷贝过来的绝对路径，映射到当前工作区
     */
    it('应该处理来自其他机器的绝对路径', () => {
      const comments = {
        '/old/workspace/project/src/file.ts': [{ id: '1', content: 'comment1' }],
      };

      const result = utils.remapFileCommentsToWorkspace(comments, '/new/workspace/project');

      // 应该将路径重映射到新工作区
      const keys = Object.keys(result);
      expect(keys.length).toBe(1);
      expect(keys[0]).toContain('file.ts');
    });

    /**
     * 测试目标: 相同目标的注释合并
     * 功能: 将指向相同目标路径的注释合并（处理 Windows/Unix 路径差异）
     */
    it('应该将指向相同目标的注释合并', () => {
      const comments = {
        'src/file.ts': [{ id: '1', content: 'comment1' }],
        'src\\file.ts': [{ id: '2', content: 'comment2' }],
      };

      const result = utils.remapFileCommentsToWorkspace(comments, '/workspace/project');

      // 应该只有一个键，但包含两个注释
      const keys = Object.keys(result);
      expect(keys.length).toBe(1);
      expect(result[keys[0]].length).toBe(2);
    });

    /**
     * 测试目标: 空注释对象保持不变
     * 功能: 处理空的注释对象
     */
    it('对于空的注释对象应该返回空对象', () => {
      const result = utils.remapFileCommentsToWorkspace({}, '/workspace/project');
      expect(result).toEqual({});
    });
  });

  describe('buildExportData - 构建导出数据', () => {
    /**
     * 测试目标: 构建标准导出数据结构
     * 功能: 创建包含版本、项目信息、元数据、注释的导出对象
     */
    it('应该构建正确的导出数据结构', () => {
      const projectInfo = {
        name: 'TestProject',
        path: '/workspace/project',
        storageFile: '/workspace/project/.vscode/comments.json',
      };

      const comments = {
        'src/file.ts': [{
          id: '1',
          line: 1,
          content: 'test comment',
          timestamp: Date.now(),
          originalLine: 1,
          lineContent: 'const x = 1;'
        }],
      };

      const result = utils.buildExportData(projectInfo, comments, 1);

      expect(result.version).toBe('1.0.0');
      expect(result.projectInfo.name).toBe('TestProject');
      expect(result.projectInfo.path).toBeDefined();
      expect(result.metadata.totalFiles).toBe(1);
      expect(result.metadata.totalComments).toBe(1);
      expect(result.comments).toBeDefined();
      expect(result.exportTime).toBeDefined();
    });

    /**
     * 测试目标: 导出数据中标准化路径
     * 功能: 将导出数据中的 Windows 路径标准化为 Unix 格式
     */
    it('应该在导出数据中标准化路径', () => {
      mockWorkspaceState.workspaceFolders = undefined;

      const projectInfo = {
        name: 'TestProject',
        path: 'C:\\workspace\\project',
      };

      const comments = {
        'C:\\workspace\\project\\src\\file.ts': [{
          id: '1',
          line: 1,
          content: 'test',
          timestamp: Date.now(),
          originalLine: 1,
          lineContent: 'const x = 1;'
        }],
      };

      const result = utils.buildExportData(projectInfo, comments, 1);

      expect(result.projectInfo.path).toBe('/workspace/project');
      expect(Object.keys(result.comments)[0]).toBe('/workspace/project/src/file.ts');
    });

    /**
     * 测试目标: 处理空注释
     * 功能: 当没有注释时正确设置元数据
     */
    it('应该正确处理空的注释', () => {
      const projectInfo = {
        name: 'TestProject',
        path: '/workspace/project',
      };

      const result = utils.buildExportData(projectInfo, {}, 0);

      expect(result.metadata.totalFiles).toBe(0);
      expect(result.metadata.totalComments).toBe(0);
      expect(result.comments).toEqual({});
    });
  });
});
