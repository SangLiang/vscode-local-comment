import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * 资源 URI 构建选项
 */
export interface ResourceUriOptions {
    markedJs?: boolean;      // 是否需要 marked.js
    css?: string;            // CSS 文件相对路径（相对于 templates 目录）
    js?: string;             // JS 文件相对路径（相对于 templates 目录）
    mermaidJs?: boolean;     // 是否需要 mermaid.js
    customResources?: Array<{ path: string; name: string }>; // 自定义资源
}

/**
 * 构建的资源 URI 对象
 */
export interface ResourceUris {
    markedJsUri?: string;
    cssUri?: string;
    jsUri?: string;
    mermaidJsUri?: string;
    [key: string]: string | undefined; // 支持自定义资源
}

/**
 * Webview 工具类，提供统一的 HTML 模板处理功能
 */
export class WebviewUtils {
    // 模板缓存，避免重复读取文件
    private static templateCache: Map<string, string> = new Map();

    /**
     * 生成 CSP nonce（32字符的随机字符串）
     */
    public static getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * HTML 转义函数
     */
    public static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 统一构建资源 URI
     * @param webview Webview 对象
     * @param extensionUri 扩展 URI
     * @param options 资源选项
     * @returns 资源 URI 对象
     */
    public static buildResourceUris(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        options: ResourceUriOptions = {}
    ): ResourceUris {
        const uris: ResourceUris = {};

        // 构建 marked.js URI
        if (options.markedJs) {
            // 优先从 out/lib 加载（打包后的位置），如果不存在则从 src/lib 加载（开发环境）
            const outPath = vscode.Uri.joinPath(extensionUri, 'out', 'lib', 'marked.min.js');
            const srcPath = vscode.Uri.joinPath(extensionUri, 'src', 'lib', 'marked.min.js');
            // 检查文件是否存在，优先使用 out/lib（打包后）
            const markedJsPath = fs.existsSync(outPath.fsPath) ? outPath : srcPath;
            uris.markedJsUri = webview.asWebviewUri(markedJsPath).toString();
        }

        // 构建 CSS URI
        if (options.css) {
            const cssPath = vscode.Uri.joinPath(extensionUri, 'src', 'templates', options.css);
            uris.cssUri = webview.asWebviewUri(cssPath).toString();
        }

        // 构建 JS URI
        if (options.js) {
            const jsPath = vscode.Uri.joinPath(extensionUri, 'src', 'templates', options.js);
            uris.jsUri = webview.asWebviewUri(jsPath).toString();
        }

        // 构建 mermaid.js URI
        if (options.mermaidJs) {
            // 优先从 out/lib 加载（打包后的位置），如果不存在则从 src/lib 加载（开发环境）
            const outPath = vscode.Uri.joinPath(extensionUri, 'out', 'lib', 'mermaid.min.js');
            const srcPath = vscode.Uri.joinPath(extensionUri, 'src', 'lib', 'mermaid.min.js');
            // 检查文件是否存在，优先使用 out/lib（打包后）
            const mermaidJsPath = fs.existsSync(outPath.fsPath) ? outPath : srcPath;
            uris.mermaidJsUri = webview.asWebviewUri(mermaidJsPath).toString();
        }

        // 构建自定义资源 URI
        if (options.customResources) {
            for (const resource of options.customResources) {
                const resourcePath = vscode.Uri.joinPath(extensionUri, resource.path);
                uris[resource.name] = webview.asWebviewUri(resourcePath).toString();
            }
        }

        return uris;
    }

    /**
     * 加载模板文件（带缓存）
     * @param context 扩展上下文
     * @param templatePath 模板文件相对路径（相对于 src/templates 目录）
     * @param useCache 是否使用缓存（默认 true）
     * @returns 模板内容
     */
    public static loadTemplate(
        context: vscode.ExtensionContext,
        templatePath: string,
        useCache: boolean = true
    ): string {
        const cacheKey = templatePath;

        // 如果使用缓存且缓存中有，直接返回
        if (useCache && this.templateCache.has(cacheKey)) {
            return this.templateCache.get(cacheKey)!;
        }

        // 读取模板文件
        const fullPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'templates', templatePath);
        const content = fs.readFileSync(fullPath.fsPath, 'utf8');

        // 如果使用缓存，保存到缓存中
        if (useCache) {
            this.templateCache.set(cacheKey, content);
        }

        return content;
    }

    /**
     * 替换模板变量
     * 支持 ${variableName} 格式的变量替换
     * @param template 模板内容
     * @param variables 变量对象
     * @returns 替换后的模板内容
     */
    public static replaceTemplateVariables(
        template: string,
        variables: Record<string, string>
    ): string {
        return template.replace(/\${(\w+)}/g, (match, key: string) => {
            return variables[key] !== undefined ? variables[key] : '';
        });
    }

    /**
     * 清除模板缓存（可选，用于开发调试）
     */
    public static clearTemplateCache(): void {
        this.templateCache.clear();
    }
}

