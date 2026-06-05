---
title: 标签系统
permalink: /docs/tags/
---

# 标签系统

标签系统允许你在注释中声明命名锚点，并在其他注释中引用它们，实现双向跳转。

## 声明标签 {#declare}

在注释中使用 `${tagName}` 声明一个标签：

```javascript
function loadConfig() {
  // local comment: ${configLoader} 配置加载入口
}
```

命名规则：
- 必须以字母或下划线开头
- 可包含字母（任何文字）、数字、下划线
- 允许混用脚本，如 `${bug修复}`

## 引用标签 {#reference}

使用 `@tagName` 引用已声明的标签：

```javascript
function saveConfig() {
  // local comment: 复用 @configLoader 的逻辑
}
```

点击 `@configLoader` 会自动跳转到声明该标签的注释位置。

## 中文标签 {#chinese}

Local Comment 完整支持中文标签：

```javascript
function handleError() {
  // local comment: ${错误处理} 核心错误处理逻辑
}

function validate() {
  // local comment: 失败时调用 @错误处理
}
```

<div class="callout callout-tip">
<strong>高级场景：</strong>中文标签在纯中文代码库或团队中尤其有用，可以降低标签命名的心智负担。
</div>

## 标签跳转 {#navigate}

除了在注释中点击 `@tagName` 引用跳转外，还可以通过命令面板快速定位到任意已声明的标签：

- **命令面板：** 按 <kbd>F1</kbd>，搜索 "Local Comment: Show All Files Tags" 
- 会列出当前项目中所有已声明的标签，选择一个即可跳转到对应位置
- 支持输入关键词过滤，方便在大量标签中快速定位

## 在 Markdown 文件中引用标签 {#markdown-tags}

**2.0 新增**：你现在可以在任意 `.md` 文件中使用标签引用功能，实现文档与代码的关联：

**插入标签引用**：
1. 在 Markdown 文件中右键，选择「插入标签引用」
2. 从列表中选择要引用的标签（显示项目中所有已声明的标签）

> 注意：在 `.md` 文件中**无法通过输入 `@` 触发自动补全**，此功能仅在 Local Comment 的 Markdown 编辑器中可用。

**点击跳转**：
- 预览 Markdown 时（右键「预览 Markdown」），所有 `@tagName` 会以特殊样式显示
- **点击即可跳转到代码中的标签定义位置** —— 文档与代码无缝连接

```markdown
## 配置加载流程

系统启动时会加载 @userConfig，具体实现见源码。

相关功能：@错误处理 @权限校验
```

<div class="callout callout-tip">
<strong>知识管理场景：</strong>写架构设计文档时，用 <code>@</code> 标记引用关键代码实现；读源码时写笔记，下次从笔记一键跳回代码。
</div>

## 标签关系图 {#graph}

**2.0 新增**：可视化展示项目中所有标签的引用关系：

- **打开方式**：命令面板执行 `Local Comment: 显示标签关系图`
- **交互功能**：支持缩放、拖拽平移、点击节点查看标签详情
- **知识网络**：像 Obsidian 那样组织项目知识，但**还能直接跳转到代码实现**

<div class="callout callout-tip">
<strong>使用场景：</strong>接手大型项目时，通过关系图快速理清核心模块的依赖关系；写技术方案时，确认相关功能点是否都被覆盖。
</div>

## 自动补全 {#autocomplete}

在 Markdown 编辑器中输入 `@` 时，会弹出已声明标签的下拉列表，支持模糊搜索。

<div class="callout callout-tip">
<strong>使用技巧：</strong>在 Markdown 编辑器的大文档中，按 <kbd>@</kbd> 后输入几个字符即可快速过滤到目标标签。
</div>
