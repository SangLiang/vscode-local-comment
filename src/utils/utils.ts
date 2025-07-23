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
