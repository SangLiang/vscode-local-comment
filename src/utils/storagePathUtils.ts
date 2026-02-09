import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger';

export interface StorageConfig {
    comments: string;
    bookmarks: string;
}

export interface StoragePaths {
    newPath: string;
    commentsDir: string;
    bookmarksDir: string;
    oldPath: string;
    oldCommentsFile: string;
    oldBookmarksFile: string;
}

export class StoragePathUtils {
    /**
     * 获取项目的存储路径配置
     */
    static getStoragePaths(
        context: vscode.ExtensionContext,
        workspacePath: string
    ): StoragePaths {
        const newPath = path.join(workspacePath, '.vscode', 'local-comment');
        const commentsDir = path.join(newPath, 'comments');
        const bookmarksDir = path.join(newPath, 'bookmarks');

        const globalStorageDir = context.globalStorageUri?.fsPath || context.extensionPath;
        const projectStorageDir = path.join(globalStorageDir, 'projects');
        const pathHash = crypto.createHash('md5').update(workspacePath).digest('hex');
        const projectName = path.basename(workspacePath);

        const oldCommentsFile = path.join(
            projectStorageDir,
            `${projectName}-${pathHash}.json`
        );
        const oldBookmarksFile = path.join(
            projectStorageDir,
            `${projectName}-${pathHash}-bookmarks.json`
        );

        return {
            newPath,
            commentsDir,
            bookmarksDir,
            oldPath: projectStorageDir,
            oldCommentsFile,
            oldBookmarksFile
        };
    }

    /**
     * 获取当前使用的注释配置文件路径
     */
    static getCurrentCommentsFile(paths: StoragePaths, workspacePath: string): string | null {
        const config = this.loadConfig(workspacePath);
        const fileName = config.comments || 'comments.json';
        const commentsFilePath = path.join(paths.commentsDir, fileName);

        if (fs.existsSync(commentsFilePath)) {
            return commentsFilePath;
        }

        const defaultFile = path.join(paths.commentsDir, 'comments.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, comments: 'comments.json' };
            this.saveConfig(updatedConfig).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 获取当前使用的书签配置文件路径
     */
    static getCurrentBookmarksFile(paths: StoragePaths, workspacePath: string): string | null {
        const config = this.loadConfig(workspacePath);
        const fileName = config.bookmarks || 'bookmarks.json';
        const bookmarksFilePath = path.join(paths.bookmarksDir, fileName);

        if (fs.existsSync(bookmarksFilePath)) {
            return bookmarksFilePath;
        }

        const defaultFile = path.join(paths.bookmarksDir, 'bookmarks.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, bookmarks: 'bookmarks.json' };
            this.saveConfig(updatedConfig).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 从 VSCode Settings 加载存储配置（注释/书签配置文件名）
     */
    static loadConfig(_workspacePath: string): StorageConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('local-comment');
        const commentsConfig = vscodeConfig.get<string>('storage.commentsConfig');
        const bookmarksConfig = vscodeConfig.get<string>('storage.bookmarksConfig');
        return {
            comments: commentsConfig ?? 'comments.json',
            bookmarks: bookmarksConfig ?? 'bookmarks.json'
        };
    }

    /**
     * 将存储配置保存到 VSCode Workspace Settings
     */
    static async saveConfig(config: StorageConfig): Promise<void> {
        const vscodeConfig = vscode.workspace.getConfiguration('local-comment');
        await vscodeConfig.update('storage.commentsConfig', config.comments, vscode.ConfigurationTarget.Workspace);
        await vscodeConfig.update('storage.bookmarksConfig', config.bookmarks, vscode.ConfigurationTarget.Workspace);
    }

    /**
     * 列出所有可用的配置文件
     */
    static listConfigFiles(dir: string): string[] {
        if (!fs.existsSync(dir)) {
            return [];
        }
        return fs.readdirSync(dir)
            .filter(file => file.endsWith('.json'))
            .map(file => file);
    }

    /**
     * 确保目录存在
     */
    static ensureDirectoryExists(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * 确保新路径目录存在
     */
    static ensureNewPathExists(paths: StoragePaths): void {
        this.ensureDirectoryExists(paths.newPath);
        this.ensureDirectoryExists(paths.commentsDir);
        this.ensureDirectoryExists(paths.bookmarksDir);
    }

    /**
     * 检查文件是否存在
     */
    static fileExists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    /**
     * 判断是否为只读/权限类错误
     */
    static isWritePermissionError(err: unknown): boolean {
        if (err instanceof Error) {
            const code = (err as NodeJS.ErrnoException).code;
            return code === 'EACCES' || code === 'EROFS' || code === 'EPERM';
        }
        return false;
    }
}
