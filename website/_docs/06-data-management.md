---
title: 数据管理
permalink: /docs/data/
---

# 数据管理

Local Comment 的数据存储在项目本地或全局目录中，你可以完全控制自己的数据。

## 存储位置 {#storage-location}

### 项目本地存储（推荐，v1.4.0+）

数据存放在当前项目的 `.vscode/local-comment/` 目录下：

```
.vscode/local-comment/
├── comments/
│   └── comments.json          # 默认注释组
├── bookmarks/
│   └── bookmarks.json         # 默认书签组
```

### 全局存储（旧版兼容）

| 系统 | 路径 |
|------|------|
| Windows | `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/` |
| macOS | `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/` |
| Linux | `~/.config/Code/User/globalStorage/vscode-local-comment/projects/` |

<div class="callout callout-tip">
<strong>新手建议：</strong>新项目直接使用项目本地存储即可，无需额外配置。旧版数据可以通过迁移命令转移到新项目路径。
</div>

## 项目本地 vs 全局 {#local-vs-global}

| 特性 | 项目本地 | 全局 |
|------|----------|------|
| 路径 | `.vscode/local-comment/` | 用户目录下 |
| Git 追踪 | 可选择加入版本控制 | 不会被 Git 追踪 |
| 协作共享 | 方便复制文件夹共享 | 需导出/导入 |
| 迁移 | 复制文件夹即可 | 使用迁移命令 |

<div class="callout callout-warning">
<strong>注意：</strong>项目本地存储的优先级高于全局存储。如果同一项目同时存在两种存储，会优先读取项目本地数据。
</div>

## 多组配置 {#multi-group}

你可以为同一个项目创建多组注释和书签：

1. 在 `.vscode/local-comment/comments/` 下新建 JSON 文件，如 `work.json`、`study.json`
2. 打开 VS Code: 设置，搜索 "local comment"
3. 修改「Local Comment: Storage」下的活跃注释配置文件名
4. 或使用命令面板（<kbd>F1</kbd>）运行 "Local Comment: Switch Comments Config"

<div class="callout callout-tip">
<strong>使用场景：</strong>例如，你可以为「功能开发」和「代码审查」分别建立注释组，互不干扰。
</div>

## 导入导出 {#import-export}

### 导出

1. 按 <kbd>F1</kbd> 打开命令面板
2. 搜索 "Local Comment: Export Comment Data"
3. 选择导出格式和路径

### 导入

1. 按 <kbd>F1</kbd> 打开命令面板
2. 搜索 "Local Comment: Import Comment Data"
3. 选择之前导出的文件

<div class="callout callout-tip">
<strong>高级技巧：</strong>使用项目本地存储时，直接复制 <code>.vscode/local-comment/</code> 文件夹到另一台机器或另一个项目，即可完成迁移，无需使用导入导出命令。
</div>

## 迁移 {#migrate}

从旧版全局存储迁移到新版项目本地存储：

1. 按 <kbd>F1</kbd> 打开命令面板
2. 搜索 "Local Comment: Migrate to Project Local Storage"
3. 确认迁移，旧数据会被复制到 `.vscode/local-comment/`

<div class="callout callout-danger">
<strong>重要：</strong>迁移前建议先导出备份。迁移不会删除旧的全局存储数据。
</div>

## 备份 {#backup}

- **定期备份：** 导出注释数据或备份 `.vscode/local-comment/` 文件夹
- **切换分支前：** 虽然注释数据不随 Git 分支切换，但代码变更可能导致注释错位。建议在大规模重构前导出备份。
- **云同步：** 如果使用项目本地存储且项目本身在版本控制中，可选择将 `.vscode/local-comment/` 加入 Git 追踪。
