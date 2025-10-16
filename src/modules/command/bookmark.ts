import * as vscode from 'vscode';
import { BookmarkManager } from '../../managers/bookmarkManager';

export function registerBookmarkCommands(
    bookmarkManager?: BookmarkManager
): vscode.Disposable[] {
    // 添加书签命令
    const addBookmarkCommand = vscode.commands.registerCommand('localComment.addBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        await bookmarkManager.addBookmark(editor.document.uri, line);
    });

    // 切换书签命令
    const toggleBookmarkCommand = vscode.commands.registerCommand('localComment.toggleBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        await bookmarkManager.toggleBookmark(editor.document.uri, line);
    });

    // 移除书签命令
    const removeBookmarkCommand = vscode.commands.registerCommand('localComment.removeBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        await bookmarkManager.removeBookmark(editor.document.uri, line);
    });

    // 跳转到书签命令
    const goToBookmarkCommand = vscode.commands.registerCommand('localComment.goToBookmark', async (filePath: string, line: number) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToBookmark(filePath, line);
    });

    // 从树中删除书签命令
    const deleteBookmarkFromTreeCommand = vscode.commands.registerCommand('localComment.deleteBookmarkFromTree', async (item) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        if (item && item.contextValue === 'bookmark' && item.bookmark) {
            await bookmarkManager.removeBookmarkById(item.bookmark.id);
        }
    });

    // 清除文件书签命令
    const clearFileBookmarksCommand = vscode.commands.registerCommand('localComment.clearFileBookmarks', async (arg: any) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        let uri: vscode.Uri | undefined;

        // 安全地检查参数类型
        if (typeof arg === 'object' && arg !== null) {
            // 检查是否是从树视图调用（带有 contextValue 和 filePath 属性）
            if ('contextValue' in arg && 'filePath' in arg) {
                if (arg.contextValue === 'file' && typeof arg.filePath === 'string') {
                    uri = vscode.Uri.file(arg.filePath);
                }
            }
        }

        // 如果没有有效的参数，则尝试使用当前活动编辑器
        if (!uri) {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                uri = editor.document.uri;
            }
        }

        // 执行清除操作
        if (uri) {
            await bookmarkManager.clearFileBookmarks(uri);
            return;
        }

        // 如果既没有有效参数，也没有活动编辑器
        vscode.window.showErrorMessage('请先打开一个文件或从书签树中选择一个文件');
    });

    // 清除所有书签命令
    const clearAllBookmarksCommand = vscode.commands.registerCommand('localComment.clearAllBookmarks', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }
        await bookmarkManager.clearAllBookmarks();
    });

    // 跳转到下一个书签命令
    const goToNextBookmarkCommand = vscode.commands.registerCommand('localComment.goToNextBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToNextBookmark();
    });

    // 跳转到上一个书签命令
    const goToPreviousBookmarkCommand = vscode.commands.registerCommand('localComment.goToPreviousBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToPreviousBookmark();
    });

    // 显示当前文件书签命令
    const showCurrentFileBookmarksCommand = vscode.commands.registerCommand('localComment.showCurrentFileBookmarks', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const currentUri = editor.document.uri;
        const bookmarks = bookmarkManager.getBookmarks(currentUri);

        if (bookmarks.length === 0) {
            vscode.window.showInformationMessage('当前文件没有书签');
            return;
        }

        // 按行号排序
        const sortedBookmarks = bookmarks.sort((a, b) => a.line - b.line);

        // 创建快速选择项
        const quickPickItems: vscode.QuickPickItem[] = sortedBookmarks.map(bookmark => {
            let label = `第${bookmark.line + 1}行`;
            let description = '';
            let detail = '';

            // 如果有自定义标签，优先显示标签
            if (bookmark.label) {
                label += `: ${bookmark.label}`;
            }

            // 如果有行内容，显示为描述
            if (bookmark.lineContent) {
                description = bookmark.lineContent.length > 60 
                    ? bookmark.lineContent.substring(0, 60) + '...'
                    : bookmark.lineContent;
            }

            // 显示创建时间
            detail = `创建于 ${new Date(bookmark.timestamp).toLocaleString()}`;

            return {
                label,
                description,
                detail,
                // 将书签对象存储在用户数据中，以便后续使用
                userData: bookmark
            } as vscode.QuickPickItem & { userData: any };
        });

        // 显示快速选择器
        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `选择要跳转的书签 (共 ${bookmarks.length} 个)`,
            matchOnDescription: true,
            matchOnDetail: false
        });

        if (selectedItem && (selectedItem as any).userData) {
            const bookmark = (selectedItem as any).userData;
            await bookmarkManager.goToBookmark(bookmark.filePath, bookmark.line);
        }
    });

    return [
        addBookmarkCommand,
        toggleBookmarkCommand,
        removeBookmarkCommand,
        goToBookmarkCommand,
        deleteBookmarkFromTreeCommand,
        clearFileBookmarksCommand,
        clearAllBookmarksCommand,
        goToNextBookmarkCommand,
        goToPreviousBookmarkCommand,
        showCurrentFileBookmarksCommand
    ];
}