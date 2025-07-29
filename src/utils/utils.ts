import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
        console.error(`Local-Comment: Failed to read icon file ${absolutePath}:`, e);
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
    // 将路径分隔符统一为正斜杠
    let normalizedPath = filePath.replace(/\\/g, '/');
    
    // 移除驱动器盘符（Windows特有）
    if (normalizedPath.match(/^[a-zA-Z]:/)) {
        normalizedPath = normalizedPath.substring(2);
    }
    
    // 确保路径以正斜杠开头（相对路径）
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
    }
    
    return normalizedPath;
}

/**
 * 将标准化的路径转换为当前系统的路径格式
 * 用于将跨平台的标准路径转换回当前操作系统的路径格式
 * @param normalizedPath 标准化路径
 * @param basePath 基础路径（可选），用于构建完整路径
 * @returns 当前系统格式的路径
 */
export function denormalizeFilePath(normalizedPath: string, basePath?: string): string {
    // 移除开头的正斜杠
    let denormalizedPath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
    
    // 如果有基础路径，则拼接
    if (basePath) {
        denormalizedPath = path.join(basePath, denormalizedPath);
    }
    
    // 转换为当前系统的路径格式
    return path.resolve(denormalizedPath);
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
