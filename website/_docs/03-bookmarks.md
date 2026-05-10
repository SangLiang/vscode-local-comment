---
title: 书签
permalink: /docs/bookmarks/
---

# 书签

书签功能帮助你在大型代码库中标记关键位置，建立跨文件的阅读路径。

## 添加与删除 {#toggle}

- **快捷键：** <kbd>Ctrl+Alt+K</kbd>
- 在当前代码行添加或移除书签
- 书签会在编辑器的行号旁显示一个图标

<div class="callout callout-tip">
<strong>新手提示：</strong>书签和本地注释可以共存于同一行，它们互不干扰。
</div>

## 导航跳转 {#navigate}

| 快捷键 | 动作 |
|--------|------|
| <kbd>Ctrl+Alt+J</kbd> | 跳转到下一个书签 |
| <kbd>Ctrl+Alt+Shift+J</kbd> | 跳转到上一个书签 |

书签导航是跨文件的。当当前文件没有更多书签时，会自动打开下一个包含书签的文件。

<div class="callout callout-tip">
<strong>日常使用：</strong>在阅读不熟悉的代码库时，可以为每个关键逻辑点添加书签，然后使用快捷键在它们之间快速跳转，形成一条「阅读路径」。
</div>

## 跨文件 {#cross-file}

书签数据与本地注释一样，按项目隔离存储。所有文件中的书签会在侧边栏「Local Comments」视图中统一列出，按文件分组。

## 清除所有 {#clear}

- **命令面板：** 按 <kbd>F1</kbd>，搜索 "Local Comment: Clear All Bookmarks"
- 会弹出确认对话框，确认后删除当前项目的所有书签

<div class="callout callout-danger">
<strong>警告：</strong>清除操作不可撤销，请确保你不再需要这些书签。
</div>

<div class="callout callout-tip">
<strong>高级技巧：</strong>书签和注释配合使用效果更佳：用「注释」记录为什么这段代码重要，用「书签」标记位置以便快速返回。
</div>
