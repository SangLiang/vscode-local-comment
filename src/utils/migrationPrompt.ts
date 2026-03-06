import * as vscode from 'vscode';
import { StoragePathUtils } from './storagePathUtils';
import { DialogUtils } from './dialogUtils';
import { getFirstWorkspaceFolder } from './utils';
import type { CommentManager } from '../managers/commentManager';
import type { BookmarkManager } from '../managers/bookmarkManager';
import { logger } from './logger';

/**
 * 统一迁移提示：确认后同时迁移注释和书签
 */
export async function checkUnifiedMigration(
    context: vscode.ExtensionContext,
    commentManager: CommentManager,
    bookmarkManager: BookmarkManager
): Promise<void> {
    const folder = getFirstWorkspaceFolder();
    if (!folder) return;

    const workspacePath = folder.uri.fsPath;
    const paths = StoragePathUtils.getStoragePaths(context, workspacePath);

    const hasOldComments = StoragePathUtils.fileExists(paths.oldCommentsFile);
    const hasOldBookmarks = StoragePathUtils.fileExists(paths.oldBookmarksFile);
    const hasNewComments = StoragePathUtils.getCurrentCommentsFile(paths, workspacePath) !== null;
    const hasNewBookmarks = StoragePathUtils.getCurrentBookmarksFile(paths, workspacePath) !== null;

    // 仅当存在“旧路径有数据且新路径尚无该文件”时才提示迁移
    const needMigrateComments = hasOldComments && !hasNewComments;
    const needMigrateBookmarks = hasOldBookmarks && !hasNewBookmarks;
    if (!needMigrateComments && !needMigrateBookmarks) return;

    const choice = await DialogUtils.showChoiceDialog(
        '您的注释和书签当前保存在扩展全局目录。建议迁移到项目内 .vscode/local-comment/ 目录：数据随项目存放更安全，在项目里即可查看与备份。是否立即迁移？',
        ['立即迁移', '稍后提醒'] as const
    );

    if (choice === '立即迁移') {
        await commentManager.migrateOldData();
        await bookmarkManager.migrateOldData();
        logger.info('注释与书签已统一迁移到项目本地存储');
    }
}
