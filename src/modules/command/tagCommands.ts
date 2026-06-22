import * as vscode from 'vscode';
import { TagManager, TagDeclaration } from '../../managers/tagManager';
import { CommentManager } from '../../managers/commentManager';
import { COMMANDS } from '../../constants';
import { getFileNameFromPath } from '../../utils/pathUtils';

interface TagQuickPickItem extends vscode.QuickPickItem {
    userData: TagDeclaration;
}

interface TagInsertQuickPickItem extends vscode.QuickPickItem {
    tagName: string;
}

async function insertTagReferenceAtCursor(editor: vscode.TextEditor, tagName: string): Promise<void> {
    const position = editor.selection.active;
    const lineText = editor.document.lineAt(position.line).text;
    const beforeCursor = lineText.substring(0, position.character);
    const atMatch = beforeCursor.match(/@([\u4e00-\u9fa5a-zA-Z0-9_]*)$/);
    const insertText = `@${tagName} `;

    const success = await editor.edit((editBuilder) => {
        if (atMatch) {
            const rangeStart = position.character - atMatch[0].length;
            const range = new vscode.Range(position.line, rangeStart, position.line, position.character);
            editBuilder.replace(range, insertText);
        } else {
            editBuilder.insert(position, insertText);
        }
    });

    if (!success) {
        return;
    }

    const newCharacter = atMatch
        ? position.character - atMatch[0].length + insertText.length
        : position.character + insertText.length;
    const newPosition = new vscode.Position(position.line, newCharacter);
    editor.selection = new vscode.Selection(newPosition, newPosition);
}

export function registerTagCommands(
    tagManager: TagManager,
    commentManager: CommentManager
): vscode.Disposable[] {
    // 显示当前文件标签命令
    const showCurrentFileTagsCommand = vscode.commands.registerCommand(
        COMMANDS.SHOW_CURRENT_FILE_TAGS,
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('请先打开一个文件');
                return;
            }

            const currentUri = editor.document.uri;
            const currentFilePath = currentUri.fsPath;

            // 更新标签管理器以获取所有标签
            const allComments = commentManager.getAllComments();
            tagManager.updateTags(allComments);

            // 获取当前文件的所有标签声明
            const allTagDeclarations = tagManager.getTagDeclarations();
            const currentFileTags: TagDeclaration[] = [];

            for (const [tagName, declaration] of allTagDeclarations.entries()) {
                if (declaration.filePath === currentFilePath) {
                    currentFileTags.push(declaration);
                }
            }

            if (currentFileTags.length === 0) {
                vscode.window.showInformationMessage('当前文件没有标签');
                return;
            }

            // 按行号排序
            const sortedTags = currentFileTags.sort((a, b) => a.line - b.line);

            // 创建快速选择项
            const quickPickItems: TagQuickPickItem[] = sortedTags.map(tag => {
                const label = `\${${tag.tagName}}`;
                const description = `第${tag.line + 1}行`;
                
                // 显示标签所在行的内容预览
                let detail = '';
                try {
                    const lineText = editor.document.lineAt(tag.line).text;
                    detail = lineText.length > 60 
                        ? lineText.substring(0, 60) + '...'
                        : lineText;
                } catch {
                    detail = tag.content.substring(0, 60) + '...';
                }

                return {
                    label,
                    description,
                    detail,
                    // 将标签对象存储在用户数据中，以便后续使用
                    userData: tag
                };
            });

            // 显示快速选择器
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `选择要跳转的标签 (共 ${currentFileTags.length} 个)`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selectedItem) {
                const tag = selectedItem.userData;
                // 跳转到标签位置
                const uri = vscode.Uri.file(tag.filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document);
                
                const position = new vscode.Position(tag.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        }
    );

    // 显示所有文件标签命令
    const showAllFilesTagsCommand = vscode.commands.registerCommand(
        COMMANDS.SHOW_ALL_FILES_TAGS,
        async () => {
            // 获取所有注释并更新标签管理器
            const allComments = commentManager.getAllComments();
            tagManager.updateTags(allComments);

            // 获取所有标签声明
            const allTagDeclarations = tagManager.getTagDeclarations();

            if (allTagDeclarations.size === 0) {
                vscode.window.showInformationMessage('当前项目没有标签');
                return;
            }

            // 转换为数组并按标签名排序
            const tagsArray: TagDeclaration[] = Array.from(allTagDeclarations.values());
            const sortedTags = tagsArray.sort((a, b) => {
                // 先按标签名排序，再按文件路径排序，最后按行号排序
                if (a.tagName !== b.tagName) {
                    return a.tagName.localeCompare(b.tagName);
                }
                if (a.filePath !== b.filePath) {
                    return a.filePath.localeCompare(b.filePath);
                }
                return a.line - b.line;
            });

            // 创建快速选择项
            const quickPickItems: TagQuickPickItem[] = sortedTags.map(tag => {
                const label = `\${${tag.tagName}}`;
                const fileName = getFileNameFromPath(tag.filePath);
                const description = `${fileName}:${tag.line + 1}`;
                
                // 显示文件路径和标签所在行的内容预览
                let detail = tag.filePath;
                try {
                    const document = vscode.workspace.textDocuments.find(
                        doc => doc.uri.fsPath === tag.filePath
                    );
                    if (document) {
                        const lineText = document.lineAt(tag.line).text;
                        detail = `${tag.filePath} - ${lineText.length > 40 
                            ? lineText.substring(0, 40) + '...'
                            : lineText}`;
                    }
                } catch {
                    detail = tag.filePath;
                }

                return {
                    label,
                    description,
                    detail,
                    // 将标签对象存储在用户数据中，以便后续使用
                    userData: tag
                };
            });

            // 显示快速选择器
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `选择要跳转的标签 (共 ${allTagDeclarations.size} 个)`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selectedItem) {
                const tag = selectedItem.userData;
                // 跳转到标签位置
                const uri = vscode.Uri.file(tag.filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document);
                
                const position = new vscode.Position(tag.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        }
    );

    const insertTagReferenceCommand = vscode.commands.registerCommand(
        COMMANDS.INSERT_TAG_REFERENCE,
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('请先打开一个文件');
                return;
            }

            if (!editor.document.fileName.toLowerCase().endsWith('.md')) {
                vscode.window.showWarningMessage('仅支持在 Markdown（.md）文件中插入标签引用');
                return;
            }

            tagManager.updateTags(commentManager.getAllComments());
            const tagNames = tagManager.getAvailableTagNames();

            if (tagNames.length === 0) {
                vscode.window.showInformationMessage('当前项目没有已声明的标签，请先在代码注释中使用 ${标签名} 声明标签');
                return;
            }

            const allTagDeclarations = tagManager.getTagDeclarations();
            const quickPickItems: TagInsertQuickPickItem[] = tagNames.map(tagName => {
                const declaration = allTagDeclarations.get(tagName);
                const fileName = declaration ? getFileNameFromPath(declaration.filePath) : '';
                const description = declaration ? `${fileName}:${declaration.line + 1}` : '';
                let detail = declaration?.filePath ?? '';
                if (declaration) {
                    try {
                        const doc = vscode.workspace.textDocuments.find(
                            d => d.uri.fsPath === declaration.filePath
                        );
                        if (doc) {
                            const lineText = doc.lineAt(declaration.line).text;
                            detail = lineText.length > 50 ? lineText.substring(0, 50) + '...' : lineText;
                        }
                    } catch {
                        detail = declaration.content.substring(0, 50);
                    }
                }
                return {
                    label: `@${tagName}`,
                    description,
                    detail,
                    tagName
                };
            });

            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `选择要插入的标签引用（共 ${tagNames.length} 个）`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                await insertTagReferenceAtCursor(editor, selected.tagName);
            }
        }
    );

    return [
        showCurrentFileTagsCommand,
        showAllFilesTagsCommand,
        insertTagReferenceCommand
    ];
}

