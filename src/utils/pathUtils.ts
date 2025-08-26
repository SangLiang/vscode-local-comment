/**
 * 从文件路径中提取文件名
 * @param filePath 文件路径
 * @returns 文件名，如果无法提取则返回空字符串
 */
export function getFileNameFromPath(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || '';
}

/**
 * 从URI对象中提取文件名
 * @param uri URI对象
 * @returns 文件名，如果无法提取则返回空字符串
 */
export function getFileNameFromUri(uri: { fsPath: string }): string {
    return getFileNameFromPath(uri.fsPath);
}