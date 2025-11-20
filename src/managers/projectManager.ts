import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class ProjectManager {
    private static readonly MEMENTO_KEY = 'localComment.projectAssociations';

    private _context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    /**
     * 将项目ID与当前工作区路径关联
     * @param projectId 项目ID
     */
    public async associateProject(projectId: string): Promise<void> {
        const workspaceFolder = this.getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            throw new Error('没有打开的工作区，无法关联项目。');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        const associations = this.getAssociations();
        associations[workspacePath] = projectId;

        try {
            await this._context.workspaceState.update(ProjectManager.MEMENTO_KEY, associations);
            
            // 验证保存是否成功
            const savedAssociations = this.getAssociations();
            
            if (savedAssociations[workspacePath] === projectId) {
                vscode.window.showInformationMessage(`项目已成功关联到当前工作区`);
            } else {
                throw new Error('数据保存验证失败');
            }
        } catch (error) {
            logger.error('关联项目 - 保存失败:', error);
            throw new Error(`保存关联数据失败: ${error}`);
        }
    }

    /**
     * 获取当前工作区关联的项目ID
     */
    public getAssociatedProject(): string | undefined {
        const workspaceFolder = this.getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            return undefined;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        const associations = this.getAssociations();
        return associations[workspacePath];
    }

    /**
     * 检查当前工作区是否已关联项目
     */
    public isProjectAssociated(): boolean {
        return !!this.getAssociatedProject();
    }
    
    /**
     * 取消当前工作区与项目的关联
     */
    public async disassociateProject(): Promise<void> {
        const workspaceFolder = this.getCurrentWorkspaceFolder();
        if (!workspaceFolder) {
            throw new Error('没有打开的工作区，无法取消关联项目。');
        }
        
        const workspacePath = workspaceFolder.uri.fsPath;
        const associations = this.getAssociations();
        
        if (!associations[workspacePath]) {
            throw new Error('当前工作区没有关联任何项目。');
        }
        
        // 删除关联
        delete associations[workspacePath];

        try {
            await this._context.workspaceState.update(ProjectManager.MEMENTO_KEY, associations);
            
            // 验证保存是否成功
            const savedAssociations = this.getAssociations();
            
            if (!savedAssociations[workspacePath]) {
                vscode.window.showInformationMessage(`项目关联已取消`);
            } else {
                throw new Error('数据保存验证失败');
            }
        } catch (error) {
            logger.error('取消关联项目 - 保存失败:', error);
            throw new Error(`保存数据失败: ${error}`);
        }
    }
    
    /**
     * 获取所有项目关联
     */
    private getAssociations(): { [workspacePath: string]: string } {
        return this._context.workspaceState.get<{ [workspacePath: string]: string }>(ProjectManager.MEMENTO_KEY, {});
    }

    /**
     * 获取当前活动的工作区文件夹
     */
    private getCurrentWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        // 如果有多个工作区，优先使用当前打开的文件所在的工作区
        if (vscode.window.activeTextEditor) {
            const activeFileUri = vscode.window.activeTextEditor.document.uri;
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFileUri);
            if (workspaceFolder) {
                return workspaceFolder;
            }
        }
        
        // 如果没有打开的文件或文件不在任何工作区内，使用第一个工作区
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return vscode.workspace.workspaceFolders[0];
        }

        return undefined;
    }
} 