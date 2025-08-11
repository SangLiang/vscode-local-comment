import * as vscode from 'vscode';
import { CommentManager, SharedComment } from '../managers/commentManager';
import { createDataUri } from '../utils/utils';

export class SharedCommentProvider implements vscode.Disposable {
    private decorationType: vscode.TextEditorDecorationType;
    private commentManager: CommentManager;
    private isVisible: boolean = true;
    private disposables: vscode.Disposable[] = [];
    private updateTimer: NodeJS.Timeout | null = null; // 防抖定时器

    // 预加载的图标URIs
    private cloudIconUri: string | null = null;

    constructor(commentManager: CommentManager) {
        this.commentManager = commentManager;

        // 初始化共享注释装饰类型
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 在行号区域显示云朵图标
            gutterIconPath: undefined, // 稍后设置
            gutterIconSize: 'contain'
        });

        // 监听编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateDecorations()),
            vscode.window.onDidChangeTextEditorSelection(() => this.debouncedUpdateDecorations())
        );

        // 异步加载图标，加载完成后重新创建装饰类型
        this.loadIcons().then(() => {
            this.recreateDecorationType();
            this.updateDecorations();
        });

        this.updateDecorations();
    }

    // 异步加载云朵图标
    private async loadIcons(): Promise<void> {
        try {
            const context = this.commentManager.getContext();
            this.cloudIconUri = await createDataUri(context, 'src/resources/cloud.svg');
        } catch (error) {
            console.error('加载云朵图标失败:', error);
        }
    }

    // 重新创建装饰类型（加载图标后）
    private recreateDecorationType(): void {
        // 先释放旧的装饰类型
        this.decorationType.dispose();

        // 创建新的装饰类型，包含云朵图标
        this.decorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.cloudIconUri ? vscode.Uri.parse(this.cloudIconUri) : undefined,
            gutterIconSize: 'contain'
        });
    }

    public refresh(): void {
        this.updateDecorations();
    }

    public toggleVisibility(): void {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.updateDecorations();
            vscode.window.showInformationMessage('共享注释已显示');
        } else {
            this.clearDecorations();
            vscode.window.showInformationMessage('共享注释已隐藏');
        }
    }

    private updateDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.isVisible) {
            this.clearDecorations();
            return;
        }

        const document = editor.document;
        const uri = document.uri;
        
        // 获取所有共享注释
        const allSharedComments = this.commentManager.getAllSharedComments();
        const filePath = document.uri.fsPath;
        const sharedComments = allSharedComments[filePath] || [];

        if (sharedComments.length === 0) {
            this.clearDecorations();
            return;
        }

        // 获取本地注释，用于判断哪些行已经有本地注释
        const localComments = this.commentManager.getComments(uri);
        const localCommentsByLine = new Set<number>();
        localComments.forEach(comment => {
            if (!('userId' in comment)) { // 只统计本地注释
                localCommentsByLine.add(comment.line);
            }
        });

        const sharedDecorations: vscode.DecorationOptions[] = [];

        // 为每一行创建共享注释装饰器
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const lineComments = sharedComments.filter(comment => comment.line === lineNumber);
            
            if (lineComments.length === 0) {
                continue;
            }

            // 如果这一行已经有本地注释，跳过共享注释装饰器
            if (localCommentsByLine.has(lineNumber)) {
                continue;
            }

            // 创建共享注释装饰器
            const decoration = this.createSharedCommentDecoration(lineNumber);
            sharedDecorations.push(decoration);
        }

        editor.setDecorations(this.decorationType, sharedDecorations);
    }

    // 创建共享注释的装饰器
    private createSharedCommentDecoration(lineNumber: number): vscode.DecorationOptions {
        return {
            range: new vscode.Range(lineNumber, 0, lineNumber, 0)
        };
    }

    private clearDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    public dispose(): void {
        this.decorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }

    // 防抖更新方法，避免频繁更新装饰
    private debouncedUpdateDecorations(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }

        this.updateTimer = setTimeout(() => {
            this.updateDecorations();
            this.updateTimer = null;
        }, 100); // 100ms防抖延迟
    }
}
