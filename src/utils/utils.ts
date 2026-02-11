import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { FileComments } from '../managers/commentManager';

/**
 * 读取图标文件并将其转换为Base64数据URI。
 * 这对于将图像直接嵌入到webview或Markdown内容中非常有用。
 * @param context 扩展上下文，用于解析绝对文件路径。
 * @param filePath 从扩展根目录到图标文件的相对路径。
 * @returns 一个解析为Data URI字符串的Promise，如果读取失败则为空字符串。
 */
export async function createDataUri(context: vscode.ExtensionContext, filePath: string): Promise<string> {
    const absolutePath = context.asAbsolutePath(filePath);
    try {
        const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
        return `data:image/svg+xml;base64,${Buffer.from(fileContent).toString('base64')}`;
    } catch (e) {
        logger.error(`Local-Comment: Failed to read icon file ${absolutePath}:`, e);
        return '';
    }
}

/**
 * 标准化文件路径，使其跨平台兼容
 * 将Windows路径转换为统一的相对路径格式，便于跨平台迁移
 * @param filePath 原始文件路径
 * @returns 标准化后的文件路径
 */
export function normalizeFilePath(filePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        let normalizedPath = filePath.replace(/\\/g, '/');
        if (normalizedPath.match(/^[a-zA-Z]:/)) {
            normalizedPath = normalizedPath.substring(2);
        }
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        return normalizedPath;
    }
    const rootPath = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(rootPath, filePath);
    return relativePath.replace(/\\/g, '/');
}

/**
 * 将相对路径转换为绝对路径
 * @param relativePath 相对路径
 * @returns 绝对路径
 */
export function toAbsolutePath(relativePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return path.resolve(relativePath);
    }
    return path.join(workspaceFolder.uri.fsPath, relativePath);
}

/**
 * 批量标准化文件路径
 * 用于处理注释数据中的多个文件路径
 * @param fileComments 文件注释对象，键为文件路径
 * @returns 标准化后的文件注释对象
 */
export function normalizeFileComments(fileComments: { [filePath: string]: any[] }): { [filePath: string]: any[] } {
    const normalizedComments: { [filePath: string]: any[] } = {};
    for (const [filePath, comments] of Object.entries(fileComments)) {
        const normalizedPath = normalizeFilePath(filePath);
        normalizedComments[normalizedPath] = comments;
    }
    return normalizedComments;
}

/**
 * 将注释数据中的文件路径重映射到当前工作区
 * 用于解决从一台电脑拷贝 .vscode 存储到另一台电脑后，JSON 中存的是旧机器绝对路径导致无法跳转的问题
 * @param fileComments 文件注释对象，键可能为其他机器的绝对路径
 * @param workspacePath 当前工作区根路径
 * @returns 键已重映射为当前工作区绝对路径的注释对象
 */
export function remapFileCommentsToWorkspace(
    fileComments: { [filePath: string]: any[] },
    workspacePath: string
): { [filePath: string]: any[] } {
    const result: { [filePath: string]: any[] } = {};
    const projectName = path.basename(workspacePath);
    const normalizedWorkspace = path.normalize(workspacePath);

    for (const [filePath, comments] of Object.entries(fileComments)) {
        const normalizedKey = path.normalize(filePath);
        let targetKey: string;

        if (!path.isAbsolute(normalizedKey)) {
            targetKey = path.join(normalizedWorkspace, normalizedKey);
        } else {
            const relativePath = path.relative(normalizedWorkspace, normalizedKey);
            const isOutsideWorkspace = relativePath.startsWith('..') || path.isAbsolute(relativePath);

            if (!isOutsideWorkspace) {
                targetKey = path.join(normalizedWorkspace, relativePath);
            } else {
                const projectIndex = normalizedKey.indexOf(projectName);
                if (projectIndex >= 0) {
                    let suffix = normalizedKey.slice(projectIndex + projectName.length);
                    if (suffix.startsWith(path.sep)) {
                        suffix = suffix.slice(path.sep.length);
                    }
                    targetKey = path.join(normalizedWorkspace, suffix);
                } else {
                    targetKey = filePath;
                }
            }
        }

        if (!result[targetKey]) {
            result[targetKey] = [];
        }
        result[targetKey].push(...comments);
    }
    return result;
}

/**
 * 项目信息接口
 */
export interface ProjectInfo {
    name: string;
    path: string;
    storageFile?: string;
}

/**
 * 构建标准化的注释导出数据
 * 统一本地导出和云端上传的数据格式
 * @param projectInfo 项目信息
 * @param allComments 所有注释数据
 * @param totalComments 注释总数
 * @returns 标准化的导出数据
 */
export function buildExportData(projectInfo: ProjectInfo, allComments: FileComments, totalComments: number) {
    // 标准化注释数据中的文件路径
    const normalizedComments = normalizeFileComments(allComments);
    
    return {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        projectInfo: {
            name: projectInfo.name,
            path: normalizeFilePath(projectInfo.path)
        },
        comments: normalizedComments,
        metadata: {
            totalFiles: Object.keys(allComments).length,
            totalComments: totalComments
        }
    };
}
