import * as vscode from 'vscode';
import { CommentManager, LocalComment } from '../managers/commentManager';
import { COMMANDS } from '../constants';

/**
 * 在注释行上方提供可点击的 CodeLens「打开 Markdown 预览」，
 * 点击后打开该行注释的 Markdown 编辑/预览面板。
 */
export class CommentCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    private configChangeDisposable?: vscode.Disposable;

    constructor(private commentManager: CommentManager) {
        // 监听配置变更，CodeLens 开关变化时刷新
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('local-comment.enableCodeLensProvider')) {
                this.refresh();
            }
        });
    }

    /**
     * 通知 CodeLens 需要刷新（在 commentProvider.refresh 时可由外部调用）
     */
    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        // 检查是否启用 CodeLens
        const config = vscode.workspace.getConfiguration('local-comment');
        if (!config.get<boolean>('enableCodeLensProvider', true)) {
            return [];
        }

        const uri = document.uri;
        const comments = this.commentManager.getComments(uri);
        if (comments.length === 0) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];
        const seenLines = new Set<number>();

        for (const comment of comments) {
            const line = comment.line;
            if (seenLines.has(line)) continue;

            const localComments = comments.filter(
                (c): c is LocalComment => c.line === line && !('userId' in c)
            );
            if (localComments.length === 0) continue;

            seenLines.add(line);
            const firstComment = localComments[0];
            const lineRange = document.lineAt(line).range;

            const args = {
                uri: uri.toString(),
                commentId: firstComment.id,
                line: firstComment.line
            };

            lenses.push(
                new vscode.CodeLens(lineRange, {
                    title: 'local comment:',
                    command: COMMANDS.EDIT_COMMENT_FROM_HOVER,
                    arguments: [args]
                })
            );
        }

        return lenses;
    }

    dispose(): void {
        this.configChangeDisposable?.dispose();
        this._onDidChangeCodeLenses.dispose();
    }
}
