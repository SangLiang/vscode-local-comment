/**
 * 复制库文件脚本
 * 从 node_modules 复制 marked 和 mermaid 的浏览器版本到 out/lib 目录
 * 这些文件会在打包时被包含到 vsix 中
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const outLibPath = path.join(projectRoot, 'out', 'lib');

// 确保 out/lib 目录存在
if (!fs.existsSync(outLibPath)) {
    fs.mkdirSync(outLibPath, { recursive: true });
}

/**
 * 查找文件，尝试多个可能的路径
 */
function findFile(possiblePaths, packageName) {
    for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

// 需要复制的文件配置
const filesToCopy = [
    {
        packageName: 'marked',
        possiblePaths: [
            path.join(nodeModulesPath, 'marked', 'marked.min.js'),
            path.join(nodeModulesPath, 'marked', 'marked.esm.min.js')
        ],
        target: path.join(outLibPath, 'marked.min.js')
    },
    {
        packageName: 'mermaid',
        possiblePaths: [
            path.join(nodeModulesPath, 'mermaid', 'dist', 'mermaid.min.js'),
            path.join(nodeModulesPath, 'mermaid', 'mermaid.min.js'),
            path.join(nodeModulesPath, '@mermaid-js', 'mermaid', 'dist', 'mermaid.min.js')
        ],
        target: path.join(outLibPath, 'mermaid.min.js')
    }
];

console.log('开始复制库文件到 out/lib...');

let copiedCount = 0;
let failedCount = 0;

filesToCopy.forEach(({ packageName, possiblePaths, target }) => {
    const sourceFile = findFile(possiblePaths, packageName);
    
    if (!sourceFile) {
        console.error(`  错误: 找不到 ${packageName} 文件`);
        console.error(`   尝试的路径:`);
        possiblePaths.forEach(p => {
            console.error(`     - ${path.relative(projectRoot, p)}`);
        });
        failedCount++;
        return;
    }
    
    try {
        // 复制文件
        fs.copyFileSync(sourceFile, target);
        const stats = fs.statSync(target);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`  已复制 ${packageName}: ${path.relative(projectRoot, target)} (${sizeKB} KB)`);
        console.log(`   来源: ${path.relative(projectRoot, sourceFile)}`);
        copiedCount++;
    } catch (error) {
        console.error(` 复制 ${packageName} 失败:`, error.message);
        failedCount++;
    }
});

if (failedCount === 0) {
    console.log(`\n  成功复制 ${copiedCount} 个文件到 out/lib 目录`);
} else {
    console.error(`\n 复制完成，但有 ${failedCount} 个文件失败`);
    console.error('请确保已运行 npm install 安装依赖');
    process.exit(1);
}

