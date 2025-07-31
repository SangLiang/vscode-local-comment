import * as vscode from 'vscode';
import { CommentProvider } from '../../providers/commentProvider';
import { CommentTreeProvider } from '../../providers/commentTreeProvider';
import { CommentManager } from '../../managers/commentManager';
import { TagManager } from '../../managers/tagManager';
import { showMarkdownWebviewInput, getCodeContext } from '../markdownWebview';
import { showQuickInputWithTagCompletion } from '../../utils/quickInput';

export function registerCommentCommands(
    commentManager: CommentManager,
    tagManager: TagManager,
    commentProvider: CommentProvider,
    commentTreeProvider: CommentTreeProvider,
    context?: vscode.ExtensionContext
): vscode.Disposable[] {
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

    // 添加editCommentFromHover命令
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

            const newContent = await showMarkdownWebviewInput(
                context!,
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
            const newContent = await showMarkdownWebviewInput(
                context!,
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
                
                const newContent = await showMarkdownWebviewInput(
                    context!,
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
                
                const newContent = await showMarkdownWebviewInput(
                    context!,
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
                const content = await showMarkdownWebviewInput(
                    context!,
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

    // 删除注释命令
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

    // 从hover删除注释命令
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

    return [
        goToCommentCommand,
        goToTagDeclarationCommand,
        refreshCommentsCommand,
        refreshTreeCommand,
        deleteCommentFromTreeCommand,
        clearFileCommentsCommand,
        fuzzyMatchCommentCommand,
        goToFileCommand,
        updateCommentLineCommand,
        editCommentInPlaceCommand,
        editCommentCommand,
        editCommentFromTreeCommand,
        editCommentFromHoverCommand,
        quickEditCommentFromHoverCommand,
        addMarkdownCommentCommand,
        addCommentCommand,
        convertSelectionToCommentCommand,
        removeCommentCommand,
        removeCommentFromHoverCommand,
    ];
}
