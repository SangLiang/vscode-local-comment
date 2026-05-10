---
title: 设置与参考
permalink: /docs/reference/
---

# 设置与参考

## 快捷键大全 {#shortcuts}

### 本地注释

| 快捷键（Windows/Linux） | 快捷键（macOS） | 动作 |
|------------------------|----------------|------|
| <kbd>Ctrl+Shift+C</kbd> | <kbd>Cmd+Shift+C</kbd> | 添加快速单行注释 |
| <kbd>Ctrl+Shift+M</kbd> | <kbd>Cmd+Shift+M</kbd> | 添加/编辑 Markdown 注释 |
| <kbd>Ctrl+Shift+E</kbd> | <kbd>Cmd+Shift+E</kbd> | 编辑当前行注释 |
| <kbd>Ctrl+Shift+D</kbd> | <kbd>Cmd+Shift+D</kbd> | 删除当前行注释 |
| <kbd>Ctrl+Shift+T</kbd> | <kbd>Cmd+Shift+T</kbd> | 选中内容转注释 |

### 书签

| 快捷键（Windows/Linux） | 快捷键（macOS） | 动作 |
|------------------------|----------------|------|
| <kbd>Ctrl+Alt+K</kbd> | <kbd>Cmd+Alt+K</kbd> | 切换书签 |
| <kbd>Ctrl+Alt+J</kbd> | <kbd>Cmd+Alt+J</kbd> | 下一个书签 |
| <kbd>Ctrl+Alt+Shift+J</kbd> | <kbd>Cmd+Alt+Shift+J</kbd> | 上一个书签 |

<div class="callout callout-tip">
<strong>记忆技巧：</strong>M 代表 Markdown，C 代表 Comment，E 代表 Edit，D 代表 Delete，T 代表 Turn（转换）。书签的 J/K 对应 VS Code: 默认的「上一个/下一个」语义。
</div>

## 设置项 {#settings}

在 VS Code: 设置中搜索 "local comment"，可配置以下选项：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| `localComment.storage.commentsFileName` | 当前活跃的注释配置文件名 | `comments.json` |
| `localComment.storage.bookmarksFileName` | 当前活跃的书签配置文件名 | `bookmarks.json` |
| `localComment.markdownPreview.fontSize` | Markdown 预览字体大小 | 跟随编辑器 |
| `localComment.codeHighlight.theme` | 代码高亮主题 | `github` |
| `localComment.mermaid.theme` | Mermaid 图表主题 | `default` |
| `localComment.showGutterIcon` | 是否显示注释 gutter 图标 | `true` |
| `localComment.showCodeLens` | 是否显示 CodeLens 操作按钮 | `true` |

<div class="callout callout-tip">
<strong>高级配置：</strong>你可以通过 <code>.vscode/settings.json</code> 为每个项目单独配置这些选项，实现「项目级」的注释行为定制。
</div>

## FAQ {#faq}

**Q: 注释会进入 Git 吗？**
A: 默认数据存储在本地，不写入源文件。如果使用 `.vscode/local-comment/`，是否提交取决于你是否将该目录加入版本控制。

**Q: 切换 Git 分支会丢失注释吗？**
A: 不会。注释数据独立于 Git 分支，切换分支不会清除。但代码变更可能导致注释位置错位，建议锚定在稳定的代码行上。

**Q: 如何备份？**
A: 使用命令面板的「导出」功能，或直接备份 `.vscode/local-comment/` 文件夹。

**Q: 其他人能看到我的注释吗？**
A: 默认不能，数据完全本地。多用户协作功能需要额外配置（目前未公开提供）。

**Q: 注释对不上代码了怎么办？**
A: Local Comment 会尝试智能匹配。如果匹配失败，注释会显示为「未找到」，你可以手动重新锚定或编辑注释内容。

## 故障排查 {#troubleshooting}

### 问题：无法添加注释

1. 确认扩展已正确安装并启用
2. 检查当前文件是否属于一个已打开的工作区文件夹（注释按项目隔离）
3. 查看 VS Code: 输出面板中 Local Comment 的日志信息

### 问题：注释位置错乱

1. 确认注释锚定在「有意义的代码行」（函数声明、变量定义等）
2. 避免锚定在空行或纯标点符号行
3. 大规模重构后，部分注释可能需要手动重新定位

### 问题：Markdown 预览不显示 Mermaid/LaTeX

1. 确认 fenced code block 中正确指定了 `mermaid` 语言
2. LaTeX 公式需用 `$$` 包裹（块级）或 `$` 包裹（行内）
3. 检查设置中的 `localComment.mermaid.theme` 是否配置正确

### 问题：侧边栏不显示注释列表

1. 确认当前打开的文件属于一个已打开的工作区
2. 检查 `.vscode/local-comment/comments/` 目录下是否存在 JSON 数据文件
3. 尝试切换注释配置文件（命令面板 → "Switch Comments Config"）

## 最佳实践 {#best-practices}

1. **锚定稳定行：** 优先将注释绑定在函数声明、类定义等有意义的代码行上
2. **定期备份：** 使用导出功能或备份 `.vscode/local-comment/` 目录
3. **善用标签：** 为跨文件的关联逻辑建立标签链接，提高代码可读性
4. **分组管理：** 使用多组注释配置，将不同场景（开发、审查、学习）的注释隔离
5. **结合书签：** 注释记录「为什么」，书签标记「在哪里」，两者配合使用
