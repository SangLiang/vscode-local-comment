import * as vscode from 'vscode';
import { BookmarkManager } from '../managers/bookmarkManager';

export class BookmarkDecorationProvider implements vscode.Disposable {
    private decorationType: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];
    private updateTimer: NodeJS.Timeout | null = null; // 添加防抖定时器

    constructor(private bookmarkManager: BookmarkManager) {
        // 创建装饰类型 - 在行号区域显示书签图标，在滚动条上显示标记
        this.decorationType = vscode.window.createTextEditorDecorationType({
            // 在行号区域显示书签图标
            gutterIconPath: this.getBookmarkIconPath(),
            gutterIconSize: 'auto',
            
            // 在滚动条上显示标记
            overviewRulerColor: '#4A90E2', // 蓝色标记，更符合VSCode风格
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            
            // 不添加背景色，保持简洁
            isWholeLine: false
        });

        // 监听书签变化
        const bookmarkChangeDisposable = this.bookmarkManager.onDidChangeBookmarks(() => {
            this.debouncedUpdateDecorations();
        });
        this.disposables.push(bookmarkChangeDisposable);

        // 监听编辑器变化
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateDecorations(); // 编辑器切换时立即更新
        });
        this.disposables.push(editorChangeDisposable);

        // 书签保持静态显示，不需要监听文档变化

        // 初始化装饰
        this.updateDecorations();
    }

    private getBookmarkIconPath(): vscode.Uri {
        // 使用符合VSCode风格的书签图标
        const svgContent = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 2C4 1.44772 4.44772 1 5 1H11C11.5523 1 12 1.44772 12 2V14L8 11L4 14V2Z" 
                      fill="#4A90E2" stroke="#2E5C8A" stroke-width="0.5"/>
            </svg>
        `;
        
        // 创建临时URI
        const uri = vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`);
        return uri;
    }

    private updateDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const bookmarks = this.bookmarkManager.getBookmarks(document.uri);
        
        const decorations: vscode.DecorationOptions[] = [];

        for (const bookmark of bookmarks) {
            // 确保行号在文档范围内
            if (bookmark.line >= 0 && bookmark.line < document.lineCount) {
                const range = new vscode.Range(bookmark.line, 0, bookmark.line, 0);
                
                // 创建装饰选项
                const decoration: vscode.DecorationOptions = {
                    range: range,
                    hoverMessage: this.createHoverMessage(bookmark)
                };
                
                decorations.push(decoration);
            }
        }

        // 应用装饰
        editor.setDecorations(this.decorationType, decorations);
    }

    private createHoverMessage(bookmark: any): vscode.MarkdownString {
        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**书签**\n\n`);
        
        if (bookmark.label) {
            markdown.appendMarkdown(`**标签**: ${bookmark.label}\n\n`);
        }
        
        if (bookmark.lineContent) {
            markdown.appendMarkdown(`**代码内容**: \`${bookmark.lineContent}\`\n\n`);
        }
        
        markdown.appendMarkdown(`**位置**: 第 ${bookmark.line + 1} 行\n\n`);
        markdown.appendMarkdown(`**创建时间**: ${new Date(bookmark.timestamp).toLocaleString()}\n\n`);
        markdown.appendMarkdown(`*使用 Ctrl+Alt+K 可以切换书签*`);
        
        return markdown;
    }

    /**
     * 手动刷新装饰
     */
    public refresh(): void {
        this.updateDecorations();
    }

    /**
     * 清除所有装饰
     */
    public clearDecorations(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    /**
     * 防抖更新装饰器 - 主要用于书签变化事件
     */
    private debouncedUpdateDecorations(): void {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
            this.updateDecorations();
            this.updateTimer = null;
        }, 200); // 书签变化时的防抖延迟
    }

    dispose(): void {
        // 清理防抖定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        // 清理装饰类型
        this.decorationType.dispose();
        
        // 清理所有事件监听器
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
} 