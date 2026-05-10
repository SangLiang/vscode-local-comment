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

- **命令面板：** 按 <kbd>F1</kbd>，搜索 "Local Comment: Go to Tag"
- 会列出当前项目中所有已声明的标签，选择一个即可跳转到对应位置
- 支持输入关键词过滤，方便在大量标签中快速定位

## 自动补全 {#autocomplete}

在 Markdown 编辑器中输入 `@` 时，会弹出已声明标签的下拉列表，支持模糊搜索。

<div class="callout callout-tip">
<strong>使用技巧：</strong>在 Markdown 编辑器的大文档中，按 <kbd>@</kbd> 后输入几个字符即可快速过滤到目标标签。
</div>
