import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CommentManager } from '../managers/commentManager';
import { TagManager } from '../managers/tagManager';
import { CommentProvider } from '../providers/commentProvider';
import { CommentTreeProvider } from '../providers/commentTreeProvider';
import { BookmarkManager } from '../managers/bookmarkManager';
import { showWebViewInput, getCodeContext } from './webview';
import { showQuickInputWithTagCompletion } from '../utils/quickInput';

export function registerCommands(
    context: vscode.ExtensionContext,
    commentManager: CommentManager,
    tagManager: TagManager,
    commentProvider: CommentProvider,
    commentTreeProvider: CommentTreeProvider,
    bookmarkManager?: BookmarkManager
) {
    // 辅助函数：创建保存并继续的回调函数
    function createSaveAndContinueCallback(
        operation: 'edit' | 'add',
        uri: vscode.Uri,
        commentId: string,
        line: number,
        originalContent: string
    ) {
        return (savedContent: string) => {
            // 对于添加操作，检查内容是否为空
            if (operation === 'add' && (!savedContent || savedContent.trim() === '')) {
                return;
            }
            
            // 对于编辑操作，检查内容是否发生变化
            if (operation === 'edit' && savedContent === originalContent) {
                return;
            }
            
            const promise = operation === 'edit' 
                ? commentManager.editComment(uri, commentId, savedContent)
                : commentManager.addComment(uri, line, savedContent);
            
            promise.then(() => {
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            });
        };
    }
    const showStorageLocationCommand = vscode.commands.registerCommand('localComment.showStorageLocation', () => {
        const projectInfo = commentManager.getProjectInfo();
        const storageFile = commentManager.getStorageFilePath();
        
        let message = `项目注释存储信息:\n\n`;
        message += `项目名称: ${projectInfo.name}\n`;
        message += `项目路径: ${projectInfo.path}\n`;
        message += `存储文件: ${storageFile}\n\n`;
        message += `️注意: 每个项目的注释数据独立存储`;
        
        vscode.window.showInformationMessage(
            message,
            '打开文件夹', '复制路径', '查看项目目录'
        ).then(selection => {
            if (selection === '打开文件夹') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(storageFile));
            } else if (selection === '复制路径') {
                vscode.env.clipboard.writeText(storageFile);
                vscode.window.showInformationMessage('路径已复制到剪贴板');
            } else if (selection === '查看项目目录') {
                const projectDir = path.dirname(path.dirname(storageFile)); // 返回到projects目录
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
            }
        });
    });

    const showStorageStatsCommand = vscode.commands.registerCommand('localComment.showStorageStats', () => {
        const projectInfo = commentManager.getProjectInfo();
        const allComments = commentManager.getAllComments();
        const fileCount = Object.keys(allComments).length;
        const totalComments = Object.values(allComments).reduce((sum, comments) => sum + comments.length, 0);
        
        // 统计标签信息
        const tagDeclarations = tagManager.getTagDeclarations();
        const tagReferences = tagManager.getTagReferences();
        
        let message = `${projectInfo.name} 项目注释统计:\n\n`;
        message += `包含注释的文件: ${fileCount} 个\n`;
        message += `总注释数量: ${totalComments} 条\n`;
        message += `标签声明: ${tagDeclarations.size} 个\n`;
        message += `标签引用: ${tagReferences.length} 个\n\n`;
        
        if (fileCount > 0) {
            message += `详细信息:\n`;
            for (const [filePath, comments] of Object.entries(allComments)) {
                const fileName = filePath.split(/[/\\]/).pop();
                message += `• ${fileName}: ${comments.length} 条注释\n`;
            }
        }
        
        if (tagDeclarations.size > 0) {
            message += `\n️ 可用标签:\n`;
            for (const tagName of tagManager.getAvailableTagNames()) {
                message += `• $${tagName}\n`;
            }
        }
        
        message += `\n 存储位置: ${projectInfo.storageFile}`;
        message += `\n️ 注意: 注释数据按项目分离存储`;
        
        vscode.window.showInformationMessage(message, { modal: true });
    });

    // 添加管理所有项目注释数据的命令
    const manageProjectsCommand = vscode.commands.registerCommand('localComment.manageProjects', async () => {
        try {
            const globalStorageDir = commentManager.getContext().globalStorageUri?.fsPath || commentManager.getContext().extensionPath;
            const projectsDir = path.join(globalStorageDir, 'projects');
            
            if (!fs.existsSync(projectsDir)) {
                vscode.window.showInformationMessage('暂无项目注释数据');
                return;
            }
            
            const files = fs.readdirSync(projectsDir).filter(file => file.endsWith('.json'));
            
            if (files.length === 0) {
                vscode.window.showInformationMessage('暂无项目注释数据');
                return;
            }
            
            let message = ` 所有项目注释数据:\n\n`;
            message += ` 项目数量: ${files.length} 个\n\n`;
            
            let totalFiles = 0;
            let totalComments = 0;
            
            for (const file of files) {
                const filePath = path.join(projectsDir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const fileCount = Object.keys(data).length;
                    const commentCount = Object.values(data).reduce((sum: number, comments: any) => sum + comments.length, 0);
                    
                    totalFiles += fileCount;
                    totalComments += commentCount;
                    
                    // 从文件名解析项目名称（格式：项目名-哈希值.json）
                    const projectName = file.replace(/-[a-f0-9]+\.json$/, '');
                    message += `${projectName}: ${fileCount} 个文件, ${commentCount} 条注释\n`;
                } catch (error) {
                    console.error(`读取项目文件失败: ${file}`, error);
                }
            }
            
            message += `\n 总计: ${totalFiles} 个文件, ${totalComments} 条注释`;
            message += `\n 存储目录: ${projectsDir}`;
            
            vscode.window.showInformationMessage(
                message,
                '打开项目目录', '清理旧数据'
            ).then(selection => {
                if (selection === '打开项目目录') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectsDir));
                } else if (selection === '清理旧数据') {
                    showCleanupDialog(projectsDir, files);
                }
            });
            
        } catch (error) {
            console.error('管理项目数据失败:', error);
            vscode.window.showErrorMessage('管理项目数据时发生错误');
        }
    });

    // 清理数据对话框
    async function showCleanupDialog(projectsDir: string, files: string[]) {
        const items = files.map(file => {
            const projectName = file.replace(/-[a-f0-9]+\.json$/, '');
            return {
                label: projectName,
                description: file,
                detail: `删除 ${projectName} 项目的注释数据`
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要删除的项目注释数据',
            canPickMany: true
        });
        
        if (selected && selected.length > 0) {
            const confirm = await vscode.window.showWarningMessage(
                `确定要删除 ${selected.length} 个项目的注释数据吗？此操作不可恢复！`,
                '确定删除', '取消'
            );
            
            if (confirm === '确定删除') {
                let deletedCount = 0;
                for (const item of selected) {
                    try {
                        const filePath = path.join(projectsDir, item.description);
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    } catch (error) {
                        console.error(`删除文件失败: ${item.description}`, error);
                    }
                }
                
                vscode.window.showInformationMessage(
                    `已删除 ${deletedCount} 个项目的注释数据`
                );
            }
        }
    }

    const toggleCommentsCommand = vscode.commands.registerCommand('localComment.toggleComments', () => {
        commentProvider.toggleVisibility();
    });

    const refreshCommentsCommand = vscode.commands.registerCommand('localComment.refreshComments', () => {
        commentProvider.refresh();  // 更新编辑器里的本地注释内容
        commentTreeProvider.refresh(); // 刷新注释树
    });

    const refreshTreeCommand = vscode.commands.registerCommand('localComment.refreshTree', () => {
        commentTreeProvider.refresh();
    });

    const deleteCommentFromTreeCommand = vscode.commands.registerCommand('localComment.deleteCommentFromTree', async (item) => {
        if ((item.contextValue === 'comment' || item.contextValue === 'hidden-comment') && item.filePath && item.comment) {
            const uri = vscode.Uri.file(item.filePath);
            await commentManager.removeComment(uri, item.comment.line);
            tagManager.updateTags(commentManager.getAllComments());
            commentProvider.refresh();
            commentTreeProvider.refresh();
        }
    });

    const clearFileCommentsCommand = vscode.commands.registerCommand('localComment.clearFileComments', async (item) => {
        if (item.contextValue === 'file' && item.filePath) {
            // 显示确认对话框
            const fileName = item.filePath.split(/[/\\]/).pop() || '';
            const confirm = await vscode.window.showWarningMessage(
                `确定要清除文件 "${fileName}" 的所有本地注释吗？此操作不可恢复！`,
                '确定清除', '取消'
            );
            
            if (confirm === '确定清除') {
                const uri = vscode.Uri.file(item.filePath);
                await commentManager.clearFileComments(uri);
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        }
    });

    const goToCommentCommand = vscode.commands.registerCommand('localComment.goToComment', async (filePath: string, line: number) => {
        try {
            const uri = vscode.Uri.file(filePath);
            
            // 首先验证注释是否还能找到对应的代码
            const fileComments = commentManager.getAllComments()[filePath] || [];
            const targetComment = fileComments.find(c => c.originalLine === line || c.line === line);
            
            if (!targetComment) {
                vscode.window.showWarningMessage(`找不到第 ${line + 1} 行的注释`);
                return;
            }

            // 打开文档
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            // 使用智能匹配验证注释是否还能找到对应的代码
            const comments = commentManager.getComments(uri);
            const matchedComment = comments.find(c => c.id === targetComment.id);
            
            if (matchedComment) {
                // 注释能找到对应代码，执行跳转到匹配位置
                const position = new vscode.Position(matchedComment.line, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                
                // 如果位置发生了变化，提示用户
                if (matchedComment.line !== targetComment.line) {
                    vscode.window.showInformationMessage(
                        `注释位置已更新：第 ${targetComment.line + 1} 行 → 第 ${matchedComment.line + 1} 行`
                    );
                }
            } else {
                // 注释无法匹配到代码，检查原始行是否仍然存在
                if (targetComment.line < document.lineCount) {
                    // 原始行仍然存在，跳转到原始行
                    const position = new vscode.Position(targetComment.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    
                    vscode.window.showInformationMessage(
                        `注释"${targetComment.content.substring(0, 30)}${targetComment.content.length > 30 ? '...' : ''}"的代码内容已变化，已跳转到原始行`,
                        '查看注释详情'
                    ).then(selection => {
                        if (selection === '查看注释详情') {
                            // 显示注释详细信息
                            const message = `注释内容: ${targetComment.content}\n` +
                                          `原始代码: ${targetComment.lineContent || '未知'}\n` +
                                          `创建时间: ${new Date(targetComment.timestamp).toLocaleString()}`;
                            vscode.window.showInformationMessage(message, { modal: true });
                        }
                    });
                } else {
                    // 原始行也不存在，提示用户
                    vscode.window.showWarningMessage(
                        `注释"${targetComment.content.substring(0, 30)}${targetComment.content.length > 30 ? '...' : ''}"暂时找不到对应的代码。可能是代码被修改、删除，或者在不同的Git分支中。`, 
                        '查看注释详情'
                    ).then(selection => {
                        if (selection === '查看注释详情') {
                            // 显示注释详细信息
                            const message = `注释内容: ${targetComment.content}\n` +
                                          `原始代码: ${targetComment.lineContent || '未知'}\n` +
                                          `创建时间: ${new Date(targetComment.timestamp).toLocaleString()}`;
                            vscode.window.showInformationMessage(message, { modal: true });
                        }
                    });
                }
            }
        } catch (error) {
            console.error('跳转到注释时发生错误:', error);
            vscode.window.showErrorMessage('无法打开文件或跳转到指定位置');
        }
    });

    const goToTagDeclarationCommand = vscode.commands.registerCommand('localComment.goToTagDeclaration', async (args) => {
        try {
            let tagName: string;
            
            // 处理参数
            if (typeof args === 'string') {
                try {
                    const parsed = JSON.parse(args);
                    tagName = parsed.tagName;
                } catch {
                    tagName = args; // 如果解析失败，直接使用字符串
                }
            } else if (args && typeof args === 'object' && args.tagName) {
                tagName = args.tagName;
            } else {
                vscode.window.showErrorMessage('无效的标签名称');
                return;
            }
            
            // 查找标签声明
            const declaration = tagManager.getTagDeclaration(tagName);
            
            if (!declaration) {
                vscode.window.showWarningMessage(`找不到标签 $${tagName} 的声明`);
                return;
            }
            
            // 跳转到声明位置
            const uri = vscode.Uri.file(declaration.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            const position = new vscode.Position(declaration.line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            
        } catch (error) {
            console.error('跳转到标签声明时发生错误:', error);
            vscode.window.showErrorMessage(`跳转失败: ${error}`);
        }
    });

    const removeCommentCommand = vscode.commands.registerCommand('localComment.removeComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const line = selection.active.line;
        
        await commentManager.removeComment(editor.document.uri, line);
        tagManager.updateTags(commentManager.getAllComments());
        commentProvider.refresh();
        commentTreeProvider.refresh();
    });

    const removeCommentFromHoverCommand = vscode.commands.registerCommand('localComment.removeCommentFromHover', async (args) => {
        try {
            let parsedArgs;
            
            // 检查参数是否已经是对象
            if (typeof args === 'object') {
                parsedArgs = args;
            } else if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                } catch (parseError) {
                    console.error('参数解析失败:', parseError);
                    vscode.window.showErrorMessage('参数格式错误');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('参数类型不正确');
                return;
            }

            const { uri, commentId, line } = parsedArgs;
            
            if (!uri || !commentId || line === undefined) {
                vscode.window.showErrorMessage('参数不完整');
                return;
            }

            const documentUri = vscode.Uri.parse(uri);
            
            // 通过commentId直接查找注释，不依赖光标位置
            const comment = commentManager.getCommentById(documentUri, commentId);
            
            if (!comment) {
                vscode.window.showWarningMessage(`找不到指定的注释`);
                return;
            }

            // 删除注释
            await commentManager.removeCommentById(documentUri, commentId);
            tagManager.updateTags(commentManager.getAllComments());
            commentProvider.refresh();
            commentTreeProvider.refresh();
            // 删除注释无需提示，用户可以直接看到结果
        } catch (error) {
            console.error('从hover删除注释时发生错误:', error);
            vscode.window.showErrorMessage(`删除注释时发生错误: ${error}`);
        }
    });

    // 添加edit相关的命令
    const editCommentFromHoverCommand = vscode.commands.registerCommand('localComment.editCommentFromHover', async (args) => {
        try {
            let parsedArgs;
            
            // 检查参数是否已经是对象
            if (typeof args === 'object') {
                parsedArgs = args;
            } else if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                } catch (parseError) {
                    console.error('参数解析失败:', parseError);
                    vscode.window.showErrorMessage('参数格式错误');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('参数类型不正确');
                return;
            }

            const { uri, commentId, line } = parsedArgs;
            
            if (!uri || !commentId || line === undefined) {
                vscode.window.showErrorMessage('参数不完整');
                return;
            }

            const documentUri = vscode.Uri.parse(uri);
            
            // 通过commentId直接查找注释，不依赖光标位置
            const comment = commentManager.getCommentById(documentUri, commentId);
            
            if (!comment) {
                vscode.window.showWarningMessage(`找不到指定的注释`);
                return;
            }

            // 获取上下文信息
            const fileName = documentUri.fsPath.split(/[/\\]/).pop() || '';
            const document = await vscode.workspace.openTextDocument(documentUri);
            
            // 检查注释是否能匹配到当前代码
            const matchedComments = commentManager.getComments(documentUri);
            const isMatched = matchedComments.some(c => c.id === comment.id);
            
            let contextInfo: any = {
                fileName,
                lineNumber: comment.line,
                originalLineContent: comment.lineContent // 注释保存的代码快照
            };

            if (isMatched) {
                // 注释能匹配到代码，显示完整的上下文信息
                const lineContent = document.lineAt(comment.line).text;
                const codeContext = await getCodeContext(documentUri, comment.line);
                
                contextInfo.lineContent = lineContent; // 当前行的实际内容
                contextInfo.contextLines = codeContext.contextLines;
                contextInfo.contextStartLine = codeContext.contextStartLine;
            }

            const newContent = await showWebViewInput(
                context,
                '修改注释内容',
                '支持 Markdown 语法和多行输入，使用 $标签名 声明标签，使用 @标签名 引用标签',
                comment.content,
                contextInfo,
                '',
                createSaveAndContinueCallback('edit', documentUri, commentId, comment.line, comment.content)
            );

            // 注意：如果使用了saveAndContinue，内容会通过回调函数保存，这里不需要重复保存
            if (newContent !== undefined && newContent !== comment.content) {
                await commentManager.editComment(documentUri, commentId, newContent);
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        } catch (error) {
            console.error('从hover编辑注释时发生错误:', error);
            vscode.window.showErrorMessage(`编辑注释时发生错误: ${error}`);
        }
    });

    // 添加快速编辑命令（单行输入）
    const quickEditCommentFromHoverCommand = vscode.commands.registerCommand('localComment.quickEditCommentFromHover', async (args) => {
        try {
            let parsedArgs;
            
            if (typeof args === 'object') {
                parsedArgs = args;
            } else if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                } catch (parseError) {
                    console.error('参数解析失败:', parseError);
                    vscode.window.showErrorMessage('参数格式错误');
                    return;
                }
            } else {
                vscode.window.showErrorMessage('参数类型不正确');
                return;
            }

            const { uri, commentId, line } = parsedArgs;
            
            if (!uri || !commentId || line === undefined) {
                vscode.window.showErrorMessage('参数不完整');
                return;
            }

            const documentUri = vscode.Uri.parse(uri);
            const comment = commentManager.getCommentById(documentUri, commentId);
            
            if (!comment) {
                vscode.window.showWarningMessage(`找不到指定的注释`);
                return;
            }

            const newContent = await showQuickInputWithTagCompletion(
                '快速编辑注释',
                '支持标签引用 @标签名',
                comment.content,
                tagManager
            );

            if (newContent !== undefined && newContent !== comment.content) {
                await commentManager.editComment(documentUri, commentId, newContent);
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        } catch (error) {
            console.error('从hover快速编辑注释时发生错误:', error);
            vscode.window.showErrorMessage(`编辑注释时发生错误: ${error}`);
        }
    });

    // 添加editCommentInPlace命令
    const editCommentInPlaceCommand = vscode.commands.registerCommand('localComment.editCommentInPlace', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const line = selection.active.line;
        
        // 获取当前行的注释
        const comments = commentManager.getComments(editor.document.uri);
        const comment = comments.find(c => c.line === line);
        
        if (!comment) {
            vscode.window.showWarningMessage(`第 ${line + 1} 行没有本地注释`);
            return;
        }

        // 获取上下文信息
        const fileName = editor.document.uri.fsPath.split(/[/\\]/).pop() || '';
        const lineContent = editor.document.lineAt(line).text;

        const newContent = await showQuickInputWithTagCompletion(
            '编辑注释内容',
            '请修改注释内容... (支持 @标签名 引用标签)',
            comment.content,
            tagManager
        );

        if (newContent !== undefined && newContent !== comment.content) {
            await commentManager.editComment(editor.document.uri, comment.id, newContent);
            tagManager.updateTags(commentManager.getAllComments());
            commentProvider.refresh();
            commentTreeProvider.refresh();
        }
    });

    const editCommentCommand = vscode.commands.registerCommand('localComment.editComment', async (uri: vscode.Uri, line: number) => {
        try {
            const comments = commentManager.getComments(uri);
            const comment = comments.find(c => c.line === line);
            
            if (!comment) {
                vscode.window.showErrorMessage('找不到指定的注释');
                return;
            }
            
            // 获取上下文信息
            const fileName = uri.fsPath.split(/[/\\]/).pop() || '';
            const document = await vscode.workspace.openTextDocument(uri);
            
            // 检查注释是否能匹配到当前代码
            const matchedComments = commentManager.getComments(uri);
            const isMatched = matchedComments.some(c => c.id === comment.id);
            
            let contextInfo: any = {
                fileName,
                lineNumber: comment.line,
                originalLineContent: comment.lineContent // 注释保存的代码快照
            };

            if (isMatched) {
                // 注释能匹配到代码，显示完整的上下文信息
                const lineContent = document.lineAt(comment.line).text;
                const codeContext = await getCodeContext(uri, comment.line);
                
                contextInfo.lineContent = lineContent; // 当前行的实际内容
                contextInfo.contextLines = codeContext.contextLines;
                contextInfo.contextStartLine = codeContext.contextStartLine;
            }
            
            // 使用新的WebView输入界面
            const newContent = await showWebViewInput(
                context,
                '编辑本地注释',
                '请修改注释内容...',
                comment.content,
                contextInfo,
                '',
                createSaveAndContinueCallback('edit', uri, comment.id, comment.line, comment.content)
            );
            
            // 注意：如果使用了saveAndContinue，内容会通过回调函数保存，这里不需要重复保存
            if (newContent !== undefined && newContent.trim() !== '') {
                await commentManager.editComment(uri, comment.id, newContent);
                // 刷新标签和界面
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        } catch (error) {
            console.error('编辑注释时出错:', error);
            vscode.window.showErrorMessage(`编辑注释失败: ${error}`);
        }
    });

    const editCommentFromTreeCommand = vscode.commands.registerCommand('localComment.editCommentFromTree', async (item) => {
        if ((item.contextValue === 'comment' || item.contextValue === 'hidden-comment') && item.filePath && item.comment) {
            try {
                // 获取上下文信息
                const fileName = item.filePath.split(/[/\\]/).pop() || '';
                const uri = vscode.Uri.file(item.filePath);
                
                let contextInfo: any = {
                    fileName,
                    lineNumber: item.comment.line,
                    originalLineContent: item.comment.lineContent // 注释保存的代码快照
                };

                // 检查文件是否存在
                let fileExists = false;
                let document: vscode.TextDocument | null = null;
                
                try {
                    document = await vscode.workspace.openTextDocument(uri);
                    fileExists = true;
                } catch (error) {
                    // 文件不存在，但这不应该阻止编辑注释
                    console.log(`文件不存在: ${item.filePath}，但仍允许编辑注释`);
                    fileExists = false;
                }

                if (fileExists && document) {
                    // 文件存在时，检查注释是否能匹配到当前代码
                    const matchedComments = commentManager.getComments(uri);
                    const isMatched = matchedComments.some(c => c.id === item.comment.id);
                    
                    if (isMatched) {
                        // 注释能匹配到代码，显示完整的上下文信息
                        const lineContent = document.lineAt(item.comment.line).text;
                        const codeContext = await getCodeContext(uri, item.comment.line);
                        
                        contextInfo.lineContent = lineContent; // 当前行的实际内容
                        contextInfo.contextLines = codeContext.contextLines;
                        contextInfo.contextStartLine = codeContext.contextStartLine;
                    }
                } else {
                    // 文件不存在时，在上下文信息中添加说明
                    contextInfo.fileNotFound = true;
                    contextInfo.filePath = item.filePath;
                }
                
                const newContent = await showWebViewInput(
                    context,
                    fileExists ? '修改注释内容' : '修改注释内容 (原文件已删除)',
                    fileExists ? 
                        '支持 Markdown 语法和多行输入，使用 $标签名 声明标签，使用 @标签名 引用标签' : 
                        '原文件已删除，但您仍可以编辑注释内容。支持 Markdown 语法和多行输入，使用 $标签名 声明标签，使用 @标签名 引用标签',
                    item.comment.content,
                    contextInfo,
                    '',
                    createSaveAndContinueCallback('edit', uri, item.comment.id, item.comment.line, item.comment.content)
                );

                // 注意：如果使用了saveAndContinue，内容会通过回调函数保存，这里不需要重复保存
                if (newContent !== undefined && newContent !== item.comment.content) {
                    await commentManager.editComment(uri, item.comment.id, newContent);
                    tagManager.updateTags(commentManager.getAllComments());
                    commentProvider.refresh();
                    commentTreeProvider.refresh();
                }
            } catch (error) {
                console.error('编辑注释失败:', error);
                vscode.window.showErrorMessage(`编辑注释失败: ${error instanceof Error ? error.message : '未知错误'}`);
            }
        }
    });

    // 添加单行注释命令
    const addCommentCommand = vscode.commands.registerCommand('localComment.addComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        
        try {
            // 使用单行快速输入界面
            const content = await showQuickInputWithTagCompletion(
                '添加本地注释',
                '请输入注释内容... (支持 @标签名 引用标签)',
                '',
                tagManager
            );
            
            if (content !== undefined && content.trim() !== '') {
                await commentManager.addComment(editor.document.uri, line, content);
                // 刷新标签和界面
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();
            }
        } catch (error) {
            console.error('添加注释时出错:', error);
            vscode.window.showErrorMessage(`添加注释失败: ${error}`);
        }
    });

    // 添加多行Markdown注释命令
    const addMarkdownCommentCommand = vscode.commands.registerCommand('localComment.addMarkdownComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const line = editor.selection.active.line;
        const document = editor.document;
        const lineContent = document.lineAt(line).text;
        const fileName = document.fileName.split(/[/\\]/).pop() || '';
        
        // 检查当前行是否已有注释
        const comments = commentManager.getComments(editor.document.uri);
        const existingComment = comments.find(c => c.line === line);
        
        try {
            if (existingComment) {
                // 如果有现有注释，进入编辑模式
                // 检查注释是否能匹配到当前代码
                const matchedComments = commentManager.getComments(editor.document.uri);
                const isMatched = matchedComments.some(c => c.id === existingComment.id);
                
                let contextInfo: any = {
                    fileName,
                    lineNumber: line,
                    originalLineContent: existingComment.lineContent // 注释保存的代码快照
                };

                if (isMatched) {
                    // 注释能匹配到代码，显示完整的上下文信息
                    const codeContext = await getCodeContext(editor.document.uri, line);
                    
                    contextInfo.lineContent = lineContent; // 当前行的实际内容
                    contextInfo.contextLines = codeContext.contextLines;
                    contextInfo.contextStartLine = codeContext.contextStartLine;
                }
                
                const newContent = await showWebViewInput(
                    context,
                    '编辑多行本地注释',
                    '支持 Markdown 语法和多行输入，使用 $标签名 声明标签，使用 @标签名 引用标签',
                    existingComment.content,
                    contextInfo,
                    '',
                    createSaveAndContinueCallback('edit', editor.document.uri, existingComment.id, existingComment.line, existingComment.content)
                );
                
                // 注意：如果使用了saveAndContinue，内容会通过回调函数保存，这里不需要重复保存
                if (newContent !== undefined && newContent !== existingComment.content) {
                    await commentManager.editComment(editor.document.uri, existingComment.id, newContent);
                    // 刷新标签和界面
                    tagManager.updateTags(commentManager.getAllComments());
                    commentProvider.refresh();
                    commentTreeProvider.refresh();
                }
            } else {
                // 如果没有现有注释，添加新注释
                // 优化：先显示编辑器，异步加载代码上下文
                const content = await showWebViewInput(
                    context,
                    '添加多行本地注释',
                    '支持 Markdown 语法和多行输入，使用 $标签名 声明标签，使用 @标签名 引用标签',
                    '',
                    {
                        fileName,
                        lineNumber: line,
                        lineContent,
                        // 暂时不包含上下文，让webview先显示
                    },
                    '',
                    createSaveAndContinueCallback('add', editor.document.uri, '', line, '')
                );
                
                // 注意：如果使用了saveAndContinue，内容会通过回调函数保存，这里不需要重复保存
                if (content !== undefined && content.trim() !== '') {
                    await commentManager.addComment(editor.document.uri, line, content);
                    // 刷新标签和界面
                    tagManager.updateTags(commentManager.getAllComments());
                    commentProvider.refresh();
                    commentTreeProvider.refresh();
                }
            }
        } catch (error) {
            console.error('处理多行注释时出错:', error);
            vscode.window.showErrorMessage(`操作失败: ${error}`);
        }
    });

    // 添加转换选中文字为注释的命令
    const convertSelectionToCommentCommand = vscode.commands.registerCommand('localComment.convertSelectionToComment', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('请先选中要转换为注释的文字');
            return;
        }

        // 获取选中的文字
        const selectedText = editor.document.getText(selection);
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage('选中的文字不能为空');
            return;
        }

        try {
            await commentManager.convertSelectionToComment(editor.document.uri, selection, selectedText);
            tagManager.updateTags(commentManager.getAllComments());
            commentProvider.refresh();
            commentTreeProvider.refresh();
        } catch (error) {
            console.error('转换选中文字为注释失败:', error);
            vscode.window.showErrorMessage('转换失败，请重试');
        }
    });

    // 导出注释数据命令
    const exportCommentsCommand = vscode.commands.registerCommand('localComment.exportComments', async () => {
        try {
            const projectInfo = commentManager.getProjectInfo();
            const allComments = commentManager.getAllComments();
            
            // 检查是否有注释数据
            const totalComments = Object.values(allComments).reduce((sum, comments) => sum + comments.length, 0);
            if (totalComments === 0) {
                vscode.window.showWarningMessage('当前项目没有注释数据可以导出');
                return;
            }

            // 生成默认文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const defaultFileName = `${projectInfo.name}-comments-${timestamp}.json`;

            // 让用户选择保存位置
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultFileName),
                filters: {
                    'JSON文件': ['json'],
                    '所有文件': ['*']
                },
                saveLabel: '导出注释数据'
            });

            if (!saveUri) {
                return; // 用户取消了操作
            }

            // 执行导出
            const success = await commentManager.exportComments(saveUri.fsPath);
            
            if (success) {
                const fileCount = Object.keys(allComments).length;
                vscode.window.showInformationMessage(
                    `导出成功！已导出 ${fileCount} 个文件的 ${totalComments} 条注释`,
                    '打开文件位置', '查看文件'
                ).then(selection => {
                    if (selection === '打开文件位置') {
                        vscode.commands.executeCommand('revealFileInOS', saveUri);
                    } else if (selection === '查看文件') {
                        vscode.commands.executeCommand('vscode.open', saveUri);
                    }
                });
            } else {
                vscode.window.showErrorMessage('导出失败，请检查文件路径和权限');
            }

        } catch (error) {
            console.error('导出注释数据时发生错误:', error);
            vscode.window.showErrorMessage(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 导入注释数据命令
    const importCommentsCommand = vscode.commands.registerCommand('localComment.importComments', async () => {
        try {
            // 让用户选择导入文件
            const openUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'JSON文件': ['json'],
                    '所有文件': ['*']
                },
                openLabel: '选择注释数据文件'
            });

            if (!openUri || openUri.length === 0) {
                return; // 用户取消了操作
            }

            const importPath = openUri[0].fsPath;

            // 验证导入文件
            const validation = await commentManager.validateImportFile(importPath);
            
            if (!validation.valid) {
                vscode.window.showErrorMessage(`文件验证失败: ${validation.message}`);
                return;
            }

            // 分析导入文件的路径信息
            const pathAnalysis = await commentManager.analyzeImportPaths(importPath);
            
            if (!pathAnalysis.success) {
                vscode.window.showErrorMessage(`路径分析失败: ${pathAnalysis.message}`);
                return;
            }

            // 获取当前项目信息
            const currentProject = commentManager.getProjectInfo();

            // 显示导入预览信息
            let previewMessage = `导入预览:\n\n`;
            previewMessage += `源项目: ${validation.projectName}\n`;
            previewMessage += `目标项目: ${currentProject.name}\n`;
            previewMessage += `导出时间: ${validation.exportTime}\n`;
            previewMessage += `文件数量: ${validation.fileCount} 个\n`;
            previewMessage += `注释数量: ${validation.commentCount} 条\n\n`;

            // 检查是否需要跨项目导入
            const needsCrossProjectImport = pathAnalysis.commonBasePath && 
                !pathAnalysis.commonBasePath.startsWith(currentProject.path.replace(/\\/g, '/'));

            let importOptions: Array<{
                label: string;
                description: string;
                detail: string;
                mode: 'merge' | 'replace';
            }> = [];

            if (needsCrossProjectImport) {
                // 跨项目导入选项
                previewMessage += `检测到跨项目导入需求\n`;
                previewMessage += `源项目路径: ${pathAnalysis.commonBasePath}\n`;
                previewMessage += `当前项目路径: ${currentProject.path}\n\n`;
                previewMessage += `请选择导入方式:`;

                importOptions = [
                    {
                        label: '路径重映射 + 合并',
                        description: '自动重映射文件路径并合并注释',
                        detail: `将源路径 ${pathAnalysis.commonBasePath} 映射到 ${currentProject.path}`,
                        mode: 'merge'
                    },
                    {
                        label: '路径重映射 + 替换',
                        description: '自动重映射文件路径并替换所有注释',
                        detail: '警告：这将删除当前项目的所有注释数据',
                        mode: 'replace'
                    }
                ];
            } else {
                // 同项目导入选项
                previewMessage += `请选择导入模式:`;

                importOptions = [
                    {
                        label: '合并导入',
                        description: '将导入的注释与现有注释合并',
                        detail: '如果存在相同ID的注释将跳过，保留现有数据',
                        mode: 'merge'
                    },
                    {
                        label: '替换导入',
                        description: '用导入的注释替换所有现有注释',
                        detail: '警告：这将删除当前项目的所有注释数据',
                        mode: 'replace'
                    }
                ];
            }

            // 让用户选择导入模式
            const importMode = await vscode.window.showQuickPick(importOptions, {
                placeHolder: '选择导入方式',
                ignoreFocusOut: true
            });

            if (!importMode) {
                return; // 用户取消了操作
            }

            // 如果是替换模式，再次确认
            if (importMode.mode === 'replace') {
                const confirm = await vscode.window.showWarningMessage(
                    '确定要替换所有现有注释数据吗？\n\n此操作将删除当前项目的所有注释，且不可恢复！',
                    { modal: true },
                    '确定替换', '取消'
                );
                
                if (confirm !== '确定替换') {
                    return;
                }
            }

            // 准备路径映射配置
            let pathMapping: { oldBasePath: string; newBasePath: string } | undefined;
            
            if (needsCrossProjectImport && pathAnalysis.commonBasePath) {
                pathMapping = {
                    oldBasePath: pathAnalysis.commonBasePath,
                    newBasePath: currentProject.path.replace(/\\/g, '/') + '/'
                };
            }

            // 执行导入
            const result = await commentManager.importComments(
                importPath,
                importMode.mode,
                pathMapping
            );
            
            if (result.success) {
                // 刷新界面
                tagManager.updateTags(commentManager.getAllComments());
                commentProvider.refresh();
                commentTreeProvider.refresh();

                // 构建成功消息
                let successMessage = result.message;
                if (result.remappedFiles && result.remappedFiles > 0) {
                    successMessage += `\n 已重映射 ${result.remappedFiles} 个文件的路径`;
                }
                
                // 显示成功消息
                vscode.window.showInformationMessage(
                    `${successMessage}`,
                    '查看注释列表', '显示统计'
                ).then(selection => {
                    if (selection === '查看注释列表') {
                        vscode.commands.executeCommand('workbench.view.explorer');
                    } else if (selection === '显示统计') {
                        vscode.commands.executeCommand('localComment.showStorageStats');
                    }
                });
            } else {
                vscode.window.showErrorMessage(result.message);
            }

        } catch (error) {
            console.error('导入注释数据时发生错误:', error);
            vscode.window.showErrorMessage(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 模糊匹配命令
    const fuzzyMatchCommentCommand = vscode.commands.registerCommand('localComment.fuzzyMatchComment', async (item) => {
        if (!item || !item.comment || !item.filePath) {
            vscode.window.showErrorMessage('无效的注释项');
            return;
        }

        try {
            // 确保文档已打开
            const uri = vscode.Uri.file(item.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            // 使用CommentMatcher进行模糊匹配
            const commentMatcher = (commentManager as any).commentMatcher;
            const candidates = commentMatcher.fuzzyMatchComment(document, item.comment, 8);
            
            if (candidates.length === 0) {
                vscode.window.showInformationMessage('未找到相似的代码行，无法进行模糊匹配');
                return;
            }

            // 根据置信度使用不同的Codicon图标
            const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
                // 使用VS Code内置的Codicon图标
                switch (confidence) {
                    case 'high':
                        return '$(star-full)'; // 实心星星，表示高置信度
                    case 'medium':
                        return '$(star-half)'; // 半星，表示中等置信度
                    case 'low':
                        return '$(star-empty)'; // 空心星星，表示低置信度
                    default:
                        return '$(circle-outline)';
                }
            };

            // 定义候选项类型
            interface FuzzyMatchQuickPickItem extends vscode.QuickPickItem {
                candidate: {
                    line: number;
                    content: string;
                    similarity: number;
                    confidence: 'high' | 'medium' | 'low';
                } | null;
            }

            // 构建候选项列表
            const quickPickItems: FuzzyMatchQuickPickItem[] = candidates.map((candidate: {
                line: number;
                content: string;
                similarity: number;
                confidence: 'high' | 'medium' | 'low';
            }) => {
                const confidenceIcon = getConfidenceIcon(candidate.confidence);
                const similarityPercent = Math.round(candidate.similarity * 100);
                
                return {
                    label: `${confidenceIcon} 第${candidate.line + 1}行 (${similarityPercent}% 相似)`,
                    description: candidate.content.length > 60 ? 
                        candidate.content.substring(0, 60) + '...' : candidate.content,
                    detail: `置信度: ${candidate.confidence} | 相似度: ${similarityPercent}%`,
                    candidate: candidate
                };
            });

            // 添加取消选项
            quickPickItems.push({
                label: '取消匹配',
                description: '不进行匹配，保持注释隐藏状态',
                detail: '',
                candidate: null
            });

            // 显示选择对话框
            const selected = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `为注释 "${item.comment.content}" 选择匹配的代码行 (选择后立即执行)`,
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selected || !selected.candidate) {
                return; // 用户取消或选择了取消选项
            }

            // 更新注释位置和代码快照
            const allComments = commentManager.getAllComments();
            const fileComments = allComments[item.filePath];
            
            if (fileComments) {
                const commentToUpdate = fileComments.find(c => c.id === item.comment.id);
                if (commentToUpdate) {
                    commentToUpdate.line = selected.candidate.line;
                    commentToUpdate.lineContent = selected.candidate.content;
                    commentToUpdate.isMatched = true;
                    
                    // 保存更改
                    await (commentManager as any).saveComments();
                    
                    // 刷新界面
                    commentProvider.refresh();
                    commentTreeProvider.refresh();
                    
                    // 跳转到匹配的行
                    const editor = await vscode.window.showTextDocument(document);
                    const position = new vscode.Position(selected.candidate.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    
                    vscode.window.showInformationMessage(
                        `模糊匹配成功！注释已更新到第${selected.candidate.line + 1}行 (相似度: ${Math.round(selected.candidate.similarity * 100)}%)`
                    );
                }
            }

        } catch (error) {
            console.error('模糊匹配失败:', error);
            vscode.window.showErrorMessage(`模糊匹配失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 跳转到文件命令
    const goToFileCommand = vscode.commands.registerCommand('localComment.goToFile', async (item) => {
        if (!item || !item.filePath) {
            vscode.window.showErrorMessage('无效的文件项');
            return;
        }

        try {
            const uri = vscode.Uri.file(item.filePath);
            
            // 检查文件是否已经在编辑器中打开
            const existingEditor = vscode.window.visibleTextEditors.find(
                editor => editor.document.uri.fsPath === item.filePath
            );

            if (existingEditor) {
                // 文件已经打开，直接切换到该编辑器，保持原有的光标位置和选择
                await vscode.window.showTextDocument(existingEditor.document, {
                    viewColumn: existingEditor.viewColumn,
                    preview: false,
                    preserveFocus: false,
                    // 不设置selection，保持用户原有的光标位置
                });
            } else {
                // 文件未打开，打开文件并定位到顶部
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document, {
                    preview: false, // 不使用预览模式，确保文件真正打开
                    preserveFocus: false // 将焦点切换到编辑器
                });

                // 新打开的文件，定位到顶部
                const position = new vscode.Position(0, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.Default);
            }

        } catch (error) {
            console.error('打开文件失败:', error);
            vscode.window.showErrorMessage(`打开文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 更新注释行号命令
    const updateCommentLineCommand = vscode.commands.registerCommand('localComment.updateCommentLine', async (item) => {
        if (!item || !item.comment || !item.filePath) {
            vscode.window.showErrorMessage('无效的注释项');
            return;
        }

        try {
            // 确保文档已打开
            const uri = vscode.Uri.file(item.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            
            // 获取当前注释信息
            const comment = item.comment;
            const currentLine = comment.line + 1; // 转换为1基索引显示给用户
            
            // 显示输入框让用户输入新的行号
            const newLineInput = await vscode.window.showInputBox({
                prompt: `请输入新的行号 (当前: 第${currentLine}行) - 输入后立即执行`,
                placeHolder: '例如: 25',
                value: currentLine.toString(),
                validateInput: (value) => {
                    const lineNumber = parseInt(value);
                    if (isNaN(lineNumber)) {
                        return '请输入有效的数字';
                    }
                    if (lineNumber < 1) {
                        return '行号必须大于0';
                    }
                    if (lineNumber > document.lineCount) {
                        return `行号不能超过文件总行数 (${document.lineCount})`;
                    }
                    return null;
                }
            });

            if (!newLineInput) {
                return; // 用户取消了输入
            }

            const newLine = parseInt(newLineInput) - 1; // 转换为0基索引
            
            if (newLine === comment.line) {
                return;
            }

            // 获取新行的内容
            const newLineContent = document.lineAt(newLine).text.trim();

            // 检查新位置是否已经有其他注释
            const allComments = commentManager.getAllComments();
            const fileComments = allComments[item.filePath];
            
            if (fileComments) {
                const existingComment = fileComments.find(c => c.line === newLine && c.id !== comment.id);
                if (existingComment) {
                    const replaceExisting = await vscode.window.showWarningMessage(
                        `第${newLine + 1}行已经有注释了：\n"${existingComment.content}"\n\n是否要替换它？`,
                        { modal: true },
                        '替换现有注释', '取消操作'
                    );
                    
                    if (replaceExisting !== '替换现有注释') {
                        return;
                    }
                    
                    // 删除现有注释
                    const existingIndex = fileComments.findIndex(c => c.id === existingComment.id);
                    if (existingIndex >= 0) {
                        fileComments.splice(existingIndex, 1);
                    }
                }

                // 更新注释位置和代码快照
                const commentToUpdate = fileComments.find(c => c.id === comment.id);
                if (commentToUpdate) {
                    commentToUpdate.line = newLine;
                    commentToUpdate.lineContent = newLineContent;
                    commentToUpdate.isMatched = true;
                    commentToUpdate.timestamp = Date.now(); // 更新时间戳
                    
                    // 保存更改
                    await (commentManager as any).saveComments();
                    
                    // 更新标签系统
                    tagManager.updateTags(commentManager.getAllComments());
                    
                    // 刷新界面
                    commentProvider.refresh();
                    commentTreeProvider.refresh();
                    
                    // 跳转到新的行
                    const editor = await vscode.window.showTextDocument(document);
                    const position = new vscode.Position(newLine, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                    
                    vscode.window.showInformationMessage(
                        `行号更新成功！注释从第${comment.line + 1}行移动到第${newLine + 1}行`
                    );
                }
            }

        } catch (error) {
            console.error('更新注释行号失败:', error);
            vscode.window.showErrorMessage(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    });

    // 书签相关命令
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

    const goToBookmarkCommand = vscode.commands.registerCommand('localComment.goToBookmark', async (filePath: string, line: number) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToBookmark(filePath, line);
    });

    const deleteBookmarkFromTreeCommand = vscode.commands.registerCommand('localComment.deleteBookmarkFromTree', async (item) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        if (item.contextValue === 'bookmark' && item.bookmark) {
            await bookmarkManager.removeBookmarkById(item.bookmark.id);
        }
    });

    const clearFileBookmarksCommand = vscode.commands.registerCommand('localComment.clearFileBookmarks', async (item) => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        if (item.contextValue === 'file' && item.filePath) {
            const uri = vscode.Uri.file(item.filePath);
            await bookmarkManager.clearFileBookmarks(uri);
        }
    });

    const goToNextBookmarkCommand = vscode.commands.registerCommand('localComment.goToNextBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToNextBookmark();
    });

    const goToPreviousBookmarkCommand = vscode.commands.registerCommand('localComment.goToPreviousBookmark', async () => {
        if (!bookmarkManager) {
            vscode.window.showErrorMessage('书签管理器未初始化');
            return;
        }

        await bookmarkManager.goToPreviousBookmark();
    });

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

    // 返回所有注册的命令，以便在extension.ts中添加到subscriptions
    return [
        showStorageLocationCommand,
        showStorageStatsCommand,
        manageProjectsCommand,
        toggleCommentsCommand,
        refreshCommentsCommand,
        refreshTreeCommand,
        deleteCommentFromTreeCommand,
        clearFileCommentsCommand,
        goToCommentCommand,
        goToTagDeclarationCommand,
        removeCommentCommand,
        removeCommentFromHoverCommand,
        editCommentFromHoverCommand,
        quickEditCommentFromHoverCommand,
        editCommentInPlaceCommand,
        editCommentCommand,
        editCommentFromTreeCommand,
        addCommentCommand,
        addMarkdownCommentCommand,
        convertSelectionToCommentCommand,
        exportCommentsCommand,
        importCommentsCommand,
        fuzzyMatchCommentCommand,
        updateCommentLineCommand,
        goToFileCommand,
        addBookmarkCommand,
        toggleBookmarkCommand,
        removeBookmarkCommand,
        goToBookmarkCommand,
        deleteBookmarkFromTreeCommand,
        clearFileBookmarksCommand,
        goToNextBookmarkCommand,
        goToPreviousBookmarkCommand,
        showCurrentFileBookmarksCommand
    ];
} 