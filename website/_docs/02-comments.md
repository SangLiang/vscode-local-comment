---
title: 本地注释
permalink: /docs/comments/
---

# 本地注释

Local Comment 的核心功能。在不修改源代码的情况下，为任意代码行附加持久的 Markdown 注释。

## 快速添加 {#quick-add}

### Markdown 注释（推荐）

- **快捷键：** <kbd>Ctrl+Shift+M</kbd>（Mac: <kbd>Cmd+Shift+M</kbd>）
- 打开多行 Markdown 编辑器，支持富文本、列表、代码块等
- 适合编写较长的分析、设计说明或 todo

### 快速单行注释

- **快捷键：** <kbd>Ctrl+Shift+C</kbd>
- 直接输入单行文本注释
- 适合快速标记，无需打开编辑器

<div class="callout callout-warning" data-user-level="advanced">
<strong>注意：</strong>快速单行注释功能与 Markdown 注释有一定重叠，未来版本可能会调整或移除。建议优先使用 Markdown 注释。
</div>

## Markdown 编辑 {#markdown-edit}

### 打开编辑器

- **新建：** <kbd>Ctrl+Shift+M</kbd>
- **编辑已有：** <kbd>Ctrl+Shift+E</kbd>

### 编辑器界面

编辑器分为左右两栏：左侧为 Markdown 文本编辑区，右侧为实时预览区。支持同步滚动定位，方便在长文档中快速找到对应内容。

### 支持的语法

- 标准 Markdown：标题、列表、引用、链接、图片、表格
- 代码块：支持语法高亮
- Mermaid 流程图
- LaTeX 数学公式

<div class="callout callout-tip" data-user-level="daily">
<strong>日常使用技巧：</strong>在 Markdown 编辑器中按 <kbd>Ctrl+S</kbd> 可以保存并继续编辑，按 <kbd>Ctrl+Enter</kbd> 保存并退出。
</div>

<div class="callout callout-tip" data-user-level="advanced">
<strong>高级技巧：</strong>编辑器中的上下文区域显示了当前注释绑定的代码片段，点击代码片段可以切换注释的行号锚点。
</div>

## 编辑与删除 {#edit-delete}

### 编辑

1. 将光标移动到已有注释的代码行
2. 按 <kbd>Ctrl+Shift+E</kbd>
3. 修改内容后保存

### 删除

1. 将光标移动到已有注释的代码行
2. 按 <kbd>Ctrl+Shift+D</kbd>
3. 确认删除

或者通过侧边栏「Local Comments」视图， hover 到注释项上点击删除图标。

## 选择转注释 {#selection-to-comment}

1. 在编辑器中选中一段代码
2. 按 <kbd>Ctrl+Shift+T</kbd>
3. 选中的文本会自动填入 Markdown 编辑器的上下文区域，方便你针对这段代码写注释

<div class="callout callout-tip" data-user-level="advanced">
<strong>锚定策略：</strong>注释绑定在具体的代码行上。如果代码发生变更，Local Comment 会尝试通过「智能匹配」重新定位。为了提高匹配成功率，建议将注释锚定在「稳定」的代码行上，如函数定义、类声明等，避免空行或仅包含标点符号的行。
</div>
