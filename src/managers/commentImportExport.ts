import * as fs from 'fs';
import * as path from 'path';
import { LocalComment, SharedComment, FileComments } from './commentTypes';
import { CommentStorage } from './commentStorage';
import { findCommentIndex } from '../utils/idUtils';
import { buildExportData, getErrorMessage, toAbsolutePath } from '../utils/utils';
import { logger } from '../utils/logger';

/**
 * 注释导入导出管理类
 *
 * 职责：
 * - 导出注释数据到文件
 * - 从文件导入注释数据（支持合并/替换模式）
 * - 路径分析和验证
 * - 跨项目导入的路径重映射
 *
 * 注意：本类不直接触发事件，事件由 CommentManager 协调器统一处理
 */
export class CommentImportExport {
  constructor(private storage: CommentStorage) {}

  /**
   * 导出注释数据到指定文件
   * @param exportPath 导出文件路径
   * @returns 导出是否成功
   */
  async exportComments(exportPath: string): Promise<boolean> {
    try {
      const projectInfo = this.storage.getProjectInfo();
      const comments = this.storage.getCommentsRef();
      const totalComments = Object.values(comments).reduce((sum, fileComments) => sum + fileComments.length, 0);

      // 构建导出数据
      const exportData = buildExportData(projectInfo, comments, totalComments);

      // 确保导出目录存在
      const exportDir = path.dirname(exportPath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      // 写入导出文件
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

      logger.info(`注释数据已导出到: ${exportPath}`);
      return true;
    } catch (error) {
      logger.error('导出注释数据失败:', error);
      return false;
    }
  }

  /**
   * 从指定文件导入注释数据
   * @param importPath 导入文件路径
   * @param mergeMode 导入模式：'replace' 替换现有数据，'merge' 合并数据
   * @param pathMapping 路径映射配置，用于跨项目导入
   * @returns 导入结果信息
   */
  async importComments(
    importPath: string,
    mergeMode: 'replace' | 'merge' = 'merge',
    pathMapping?: { oldBasePath: string; newBasePath: string }
  ): Promise<{
    success: boolean;
    message: string;
    importedFiles?: number;
    importedComments?: number;
    skippedComments?: number;
    remappedFiles?: number;
  }> {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(importPath)) {
        return {
          success: false,
          message: '导入文件不存在'
        };
      }

      // 读取导入文件
      const importDataStr = fs.readFileSync(importPath, 'utf8');
      const importData = JSON.parse(importDataStr);

      // 验证导入数据格式
      if (!importData.comments || typeof importData.comments !== 'object') {
        return {
          success: false,
          message: '导入文件格式不正确，缺少注释数据'
        };
      }

      let importedFiles = 0;
      let importedComments = 0;
      let skippedComments = 0;
      let remappedFiles = 0;

      const comments = this.storage.getCommentsRef();

      if (mergeMode === 'replace') {
        // 替换模式：清空现有数据
        for (const key of Object.keys(comments)) {
          delete comments[key];
        }
      }

      // 处理导入的注释数据
      for (const [originalFilePath, fileComments] of Object.entries(importData.comments)) {
        if (!Array.isArray(fileComments)) {
          continue;
        }

        let targetFilePath = originalFilePath;

        // 处理跨项目路径重映射
        if (pathMapping) {
          const { oldBasePath, newBasePath } = pathMapping;

          // 确保路径是绝对路径，以便进行正确的相对路径计算
          const oldFullPath = path.resolve(oldBasePath, originalFilePath);

          // 计算相对于旧基础路径的相对路径
          const relativePath = path.relative(oldBasePath, oldFullPath);

          // 构建新的绝对路径
          targetFilePath = path.join(newBasePath, relativePath);

          if (originalFilePath !== targetFilePath) {
            remappedFiles++;
            logger.debug(`路径重映射: ${originalFilePath} -> ${targetFilePath}`);
          }
        } else {
          // 如果没有路径映射，尝试将标准化路径转换为当前系统路径
          targetFilePath = toAbsolutePath(originalFilePath);
        }

        if (!comments[targetFilePath]) {
          comments[targetFilePath] = [];
          importedFiles++;
        }

        for (const comment of fileComments as (LocalComment | SharedComment)[]) {
          // 验证注释数据完整性
          if (!comment.id || typeof comment.line !== 'number' || !comment.content) {
            skippedComments++;
            continue;
          }

          if (mergeMode === 'merge') {
            // 合并模式：检查是否已存在相同ID的注释
            const existingIndex = findCommentIndex(comments[targetFilePath], comment.id);
            if (existingIndex >= 0) {
              // 如果存在相同ID，跳过避免冲突
              skippedComments++;
              continue;
            }
          }

          // 添加注释，确保必要字段存在
          const importedComment: LocalComment = {
            id: comment.id,
            line: comment.line,
            content: comment.content,
            timestamp: comment.timestamp || Date.now(),
            originalLine: comment.originalLine || comment.line,
            lineContent: comment.lineContent || '',
            isMatched: comment.isMatched
          };

          comments[targetFilePath].push(importedComment);
          importedComments++;
        }
      }

      let message = `导入完成！导入了 ${importedFiles} 个文件的 ${importedComments} 条注释`;
      if (skippedComments > 0) {
        message += `，跳过 ${skippedComments} 条注释`;
      }
      if (remappedFiles > 0) {
        message += `，重映射了 ${remappedFiles} 个文件路径`;
      }

      logger.info(`${message}`);

      return {
        success: true,
        message,
        importedFiles,
        importedComments,
        skippedComments,
        remappedFiles
      };

    } catch (error) {
      logger.error('导入注释数据失败:', error);
      return {
        success: false,
        message: `导入失败: ${getErrorMessage(error)}`
      };
    }
  }

  /**
   * 分析导入文件中的文件路径，用于跨项目导入时的路径分析
   * @param importPath 导入文件路径
   * @returns 路径分析结果
   */
  async analyzeImportPaths(importPath: string): Promise<{
    success: boolean;
    message: string;
    filePaths?: string[];
    commonBasePath?: string;
    projectName?: string;
  }> {
    try {
      if (!fs.existsSync(importPath)) {
        return {
          success: false,
          message: '文件不存在'
        };
      }

      const importDataStr = fs.readFileSync(importPath, 'utf8');
      const importData = JSON.parse(importDataStr);

      if (!importData.comments || typeof importData.comments !== 'object') {
        return {
          success: false,
          message: '文件格式不正确'
        };
      }

      const filePaths = Object.keys(importData.comments);

      if (filePaths.length === 0) {
        return {
          success: false,
          message: '没有找到文件路径'
        };
      }

      // 查找公共基础路径
      let commonBasePath = '';
      if (filePaths.length > 0) {
        // 标准化所有路径
        const normalizedPaths = filePaths.map(p => p.replace(/\\/g, '/'));

        // 找到最短路径作为基础
        const shortestPath = normalizedPaths.reduce((a, b) => a.length <= b.length ? a : b);

        // 逐字符比较找到公共前缀
        for (let i = 0; i < shortestPath.length; i++) {
          const char = shortestPath[i];
          if (normalizedPaths.every(p => p[i] === char)) {
            commonBasePath += char;
          } else {
            break;
          }
        }

        // 确保公共路径以目录分隔符结尾
        const lastSlashIndex = commonBasePath.lastIndexOf('/');
        if (lastSlashIndex > 0) {
          commonBasePath = commonBasePath.substring(0, lastSlashIndex + 1);
        }
      }

      return {
        success: true,
        message: '路径分析完成',
        filePaths,
        commonBasePath,
        projectName: importData.projectInfo?.name || '未知项目'
      };

    } catch (error) {
      return {
        success: false,
        message: `路径分析失败: ${getErrorMessage(error)}`
      };
    }
  }

  /**
   * 验证导入文件的格式和内容
   * @param importPath 导入文件路径
   * @returns 验证结果
   */
  async validateImportFile(importPath: string): Promise<{
    valid: boolean;
    message: string;
    fileCount?: number;
    commentCount?: number;
    projectName?: string;
    exportTime?: string;
  }> {
    try {
      if (!fs.existsSync(importPath)) {
        return {
          valid: false,
          message: '文件不存在'
        };
      }

      const importDataStr = fs.readFileSync(importPath, 'utf8');
      const importData = JSON.parse(importDataStr) as {
        comments?: Record<string, unknown>;
        projectInfo?: { name?: string };
        exportTime?: string;
      };

      // 检查基本结构
      if (!importData.comments || typeof importData.comments !== 'object') {
        return {
          valid: false,
          message: '文件格式不正确，缺少注释数据'
        };
      }

      // 统计信息
      const fileCount = Object.keys(importData.comments).length;
      const commentCount = Object.values(importData.comments).reduce<number>((sum, comments) => {
        return sum + (Array.isArray(comments) ? comments.length : 0);
      }, 0);

      return {
        valid: true,
        message: '文件格式正确',
        fileCount,
        commentCount,
        projectName: importData.projectInfo?.name || '未知项目',
        exportTime: importData.exportTime || '未知时间'
      };

    } catch (error) {
      return {
        valid: false,
        message: `文件解析失败: ${getErrorMessage(error)}`
      };
    }
  }
}
