import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { StoragePathUtils } from './storagePathUtils';
import { DialogUtils } from './dialogUtils';
import type { CommentManager } from '../managers/commentManager';
import type { BookmarkManager } from '../managers/bookmarkManager';
import { logger } from './logger';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 统一迁移提示：只弹一次窗，确认后同时迁移注释和书签
 */
export async function checkUnifiedMigration(
    context: vscode.ExtensionContext,
    commentManager: CommentManager,
    bookmarkManager: BookmarkManager
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const paths = StoragePathUtils.getStoragePaths(context, workspacePath);

    const hasOldComments = StoragePathUtils.fileExists(paths.oldCommentsFile);
    const hasOldBookmarks = StoragePathUtils.fileExists(paths.oldBookmarksFile);
    if (!hasOldComments && !hasOldBookmarks) return;

    const snoozeKey = `migration_snooze_until_unified_${crypto.createHash('md5').update(workspacePath).digest('hex')}`;
    const snoozeUntil = context.globalState.get<number>(snoozeKey, 0);
    if (snoozeUntil > 0 && Date.now() < snoozeUntil) return;

    const choice = await DialogUtils.showChoiceDialog(
        '您的注释和书签当前保存在扩展全局目录。建议迁移到项目内 .vscode/local-comment/ 目录：数据随项目存放更安全，在项目里即可查看与备份。是否立即迁移？',
        ['立即迁移', '稍后提醒', '一周内不再提醒'] as const
    );

    if (choice === '立即迁移') {
        await commentManager.migrateOldData();
        await bookmarkManager.migrateOldData();
        logger.info('注释与书签已统一迁移到项目本地存储');
    } else if (choice === '一周内不再提醒') {
        context.globalState.update(snoozeKey, Date.now() + ONE_WEEK_MS);
    }
}
