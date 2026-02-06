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
    configFile: string;
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
        const configFile = path.join(newPath, 'config.json');

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
            configFile,
            oldPath: projectStorageDir,
            oldCommentsFile,
            oldBookmarksFile
        };
    }

    /**
     * 获取当前使用的注释配置文件路径
     */
    static getCurrentCommentsFile(paths: StoragePaths, workspacePath: string): string | null {
        const config = this.loadConfig(paths.configFile, workspacePath);
        const fileName = config.comments || 'comments.json';
        const configFile = path.join(paths.commentsDir, fileName);

        if (fs.existsSync(configFile)) {
            return configFile;
        }

        const defaultFile = path.join(paths.commentsDir, 'comments.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, comments: 'comments.json' };
            this.saveConfig(paths.configFile, updatedConfig, false).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 获取当前使用的书签配置文件路径
     */
    static getCurrentBookmarksFile(paths: StoragePaths, workspacePath: string): string | null {
        const config = this.loadConfig(paths.configFile, workspacePath);
        const fileName = config.bookmarks || 'bookmarks.json';
        const configFile = path.join(paths.bookmarksDir, fileName);

        if (fs.existsSync(configFile)) {
            return configFile;
        }

        const defaultFile = path.join(paths.bookmarksDir, 'bookmarks.json');
        if (fs.existsSync(defaultFile)) {
            const updatedConfig = { ...config, bookmarks: 'bookmarks.json' };
            this.saveConfig(paths.configFile, updatedConfig, false).catch(e => logger.error('saveConfig failed', e));
            return defaultFile;
        }

        return null;
    }

    /**
     * 加载配置文件（优先从 VSCode Settings 读取）
     */
    static loadConfig(configFile: string, workspacePath: string): StorageConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('local-comment');
        const commentsConfig = vscodeConfig.get<string>('storage.commentsConfig');
        const bookmarksConfig = vscodeConfig.get<string>('storage.bookmarksConfig');

        if (commentsConfig !== undefined || bookmarksConfig !== undefined) {
            return {
                comments: commentsConfig ?? 'comments.json',
                bookmarks: bookmarksConfig ?? 'bookmarks.json'
            };
        }

        if (fs.existsSync(configFile)) {
            try {
                const data = fs.readFileSync(configFile, 'utf8');
                const config = JSON.parse(data);
                return {
                    comments: config.comments || 'comments.json',
                    bookmarks: config.bookmarks || 'bookmarks.json'
                };
            } catch (error) {
                logger.error('加载配置文件失败:', error);
            }
        }

        return {
            comments: 'comments.json',
            bookmarks: 'bookmarks.json'
        };
    }

    /**
     * 保存配置文件（同时更新 VSCode Settings 和 config.json）
     */
    static async saveConfig(
        configFile: string,
        config: StorageConfig,
        updateVSCodeSettings: boolean = true
    ): Promise<void> {
        if (updateVSCodeSettings) {
            const vscodeConfig = vscode.workspace.getConfiguration('local-comment');
            await vscodeConfig.update('storage.commentsConfig', config.comments, vscode.ConfigurationTarget.Workspace);
            await vscodeConfig.update('storage.bookmarksConfig', config.bookmarks, vscode.ConfigurationTarget.Workspace);
        }

        const configDir = path.dirname(configFile);
        this.ensureDirectoryExists(configDir);
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
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
