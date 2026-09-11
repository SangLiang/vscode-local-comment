/**
 * 开发版本打包脚本
 * 生成带-debug后缀的包名，并设置日志级别为debug
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
}

// 读取package.json获取版本号
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const name = packageJson.name;

// 生成带-debug后缀的文件名
// 格式: publisher-name-debug-version.vsix
const outputFileName = `${name}-debug-${version}.vsix`;

process.env.NODE_ENV = 'development';

const totalStartTime = Date.now();

console.log(`📦 正在打包开发版本: ${outputFileName}`);
console.log(`   日志级别: debug (显示所有日志)`);

try {
    console.log('   清理旧编译产物...');
    const cleanStart = Date.now();
    execSync(`node scripts/clean-out.js`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log(`   ⏱️ 清理耗时: ${formatDuration(Date.now() - cleanStart)}`);

    // 先设置日志级别为debug
    console.log('   设置日志级别为 debug...');
    const logLevelStart = Date.now();
    execSync(`node scripts/set-log-level.js debug`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log(`   ⏱️ 设置日志级别耗时: ${formatDuration(Date.now() - logLevelStart)}`);

    // 使用--out参数指定输出文件名
    // 注意：vsce package 会自动执行 vscode:prepublish 脚本（即 npm run compile），所以不需要手动编译
    console.log('   打包VSIX文件（将自动编译TypeScript）...');
    const packageStart = Date.now();
    execSync(`npx --no-install vsce package --out ${outputFileName}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });
    console.log(`   ⏱️ vsce package 耗时: ${formatDuration(Date.now() - packageStart)}`);

    console.log(`\n✅ 开发版本打包完成: ${outputFileName}`);
    console.log(`⏱️ 总耗时: ${formatDuration(Date.now() - totalStartTime)}`);
} catch (error) {
    console.error('\n❌ 打包失败:', error.message);
    console.error(`⏱️ 失败前已耗时: ${formatDuration(Date.now() - totalStartTime)}`);
    process.exit(1);
}

