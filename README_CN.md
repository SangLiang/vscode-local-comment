# Local Comment（本地注释）

[English](./README.md)

**在不改一行源代码的前提下**，在 VS Code 里为代码挂上可持久保存的笔记与书签：支持 **Markdown**、**Mermaid**、**LaTeX**，以及 **标签声明与跳转**，适合大项目阅读、调研和整理个人理解。

> 平时可以当普通笔记用；当代码量上来、分支切来切去时，本地注释会帮你把「思路」留在编辑器里，而不是散落在聊天或外部文档里。

**文档网站：** [https://sangliang.github.io/vscode-local-comment/](https://sangliang.github.io/vscode-local-comment/)

---

## 这个插件主要能做什么

| 能力 | 说明 |
|------|------|
| **本地注释** | 注释存在独立数据里，**不写入源文件**，不污染 Git 提交内容。 |
| **Markdown 长笔记** | 多行富文本编辑，适合写分析、流程、待办，而不是单行 `//`。 |
| **标签跳转** | 用 `${标签名}` 声明、`@标签名` 引用，在注释间快速跳转，支持中文标签。 |
| **智能锚定** | 代码改动后尽量跟随行位；建议绑在**有意义的代码行**（见下文最佳实践）。 |
| **Mermaid / LaTeX** | 流程图与公式在预览中渲染，方便技术说明。 |
| **书签** | 跨文件标记与顺序跳转，和注释配合做「阅读路线」。 |
| **侧栏列表** | 统一浏览当前项目的注释与书签，从树里点回代码。 |
| **项目 / 分组** | 支持多项目内多分组注释，可以 `.vscode/local-comment/` 下多份配置切换（分支1的注释 / 分支2的注释）。 |
| **Markdown 预览** | 直接预览 `.md` 文件，支持 Mermaid 图表、LaTeX 公式、代码高亮，可缩放拖拽图表。 |
| **导出 HTML** | 将 Markdown 文件（含渲染后的图表、公式）导出为自包含 HTML 文件，便于分享和离线查看。 |

简单来说就是把「读代码时的脑子」留在 VS Code 里，且**默认完全本地、私有**。

---

## 30 秒上手

1. 光标放在某行代码上，按 **`Ctrl+Shift+M`** → 写一条 Markdown 本地注释（**最常用快捷键**）。
2. 侧栏打开 **「本地注释」** 面板，查看列表与跳转。
3. 需要打点跳转时，按 **`Ctrl+Alt+K`** 切换书签，**`Ctrl+Alt+J`** / **`Ctrl+Alt+Shift+J`** 在书签间移动。

完整快捷键见文末表格。

---

## 功能演示

### 标签跳转

![标签跳转](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)

### Markdown 本地注释

![Markdown 本地注释](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

### 本地注释与书签列表

![侧栏列表面板](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/view_panel.png)

### Mermaid 流程图

![Mermaid 渲染](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

### LaTeX 公式

在本地注释中可插入 LaTeX 公式并在预览中渲染。

![LaTeX 支持](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

### 多人协作（可选）

在编辑器中可区分**自己的本地注释**与**线上他人分享的解读**（类似在书里看别人划线）。

![他人注释展示](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

![本地与线上区分](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

在网页端管理已分享的注释：

![管理已分享注释](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**注意**：多人协作版**暂不对外免费提供**。

---

## 为什么需要本地注释

常见场景：**项目调研**、**设计思路不想进仓库**、**修 Bug 的过程记录**、**跨文件逻辑串联**、**啃别人代码时的学习笔记**、**AI 生成代码后的零碎知识点归档**。

### 和传统做法比

- **写进源码注释**：会污染仓库与 Code Review，不适合长篇或私人笔记。
- **外部文档 / 笔记应用**：与当前文件、当前行脱节，Markdown / Mermaid / 多点同步往往要折腾或付费。

### Local Comment 的做法

- **与源码分离**：数据独立存储，原文件保持干净。  
- **按项目隔离**：各项目互不干扰。  
- **会话持久**：重启 VS Code 仍在。  
- **尽量跟随代码变更**：减少「注释还在、代码已经面目全非」的错位感。  
- **默认私有**：数据在本地；可选的团队分享见上文「多人协作」。

---

## 核心功能说明

### 1. 本地注释

- **快速添加**：`Ctrl+Shift+C` 在当前行添加简单注释（与 Markdown 入口部分重叠，后续版本可能调整）。
- **Markdown**：`Ctrl+Shift+M` 打开多行编辑器（**推荐主入口**）。
- **编辑**：`Ctrl+Shift+E` 编辑当前行关联的注释。
- **删除**：`Ctrl+Shift+D` 删除当前行注释。
- **选区转注释**：`Ctrl+Shift+T` 将选中内容转为注释。

### 2. 书签

- **切换**：`Ctrl+Alt+K` 在当前行添加或移除书签。  
- **可视化**：行号旁图标、滚动条标记、悬停详情。  
- **导航**：`Ctrl+Alt+J` 下一个、`Ctrl+Alt+Shift+J` 上一个，支持跨文件、首尾循环。

### 3. Markdown 文件预览与导出

- **预览**：在 Markdown 文件编辑器右键菜单选择「预览 Markdown」，或使用命令面板执行 `Local Comment: Preview Markdown`。支持实时预览 Mermaid 图表、LaTeX 公式、代码高亮。
- **图表交互**：支持缩放按钮（+/-）、Ctrl+滚轮缩放、鼠标拖拽平移 Mermaid 图表。
- **导出 HTML**：预览面板点击「导出 HTML」按钮，生成自包含的 HTML 文件（内嵌 CSS/JS/字体），无需依赖网络即可查看，便于分享和存档。

---

## 最佳实践（非常重要）

本地注释尽量写在**有语义的代码行**上（例如函数声明同一行），**避免**空行或仅符号的行：

```javascript
function test() { // 本地注释：写在这一行更稳
  // ...
}
```

这样在**切换分支**或**大块重构**后，仍更容易匹配到正确位置。

---

## 快捷键一览

### 本地注释

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Shift+C` | 添加本地注释 | 当前行简单注释 |
| `Ctrl+Shift+M` | 添加 Markdown 注释 | **核心**：多行富文本 |
| `Ctrl+Shift+E` | 编辑注释 | 快速改当前行注释 |
| `Ctrl+Shift+D` | 删除注释 | 删除当前行注释 |
| `Ctrl+Shift+T` | 选区转注释 | 选中内容转注释 |
| - | 预览 Markdown | 右键菜单或命令面板（仅对 `.md` 文件） |

### 书签

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Alt+K` | 切换书签 |
| `Ctrl+Alt+J` | 下一个书签 |
| `Ctrl+Alt+Shift+J` | 上一个书签 |

---

## 标签用法

标签支持中文。声明：`${标签名}`；引用：`@标签名`。

```javascript
let userConfig = {};  // 本地注释：${userConfig} 在此声明

function loadConfig() { // 本地注释：此处加载 @userConfig
    userConfig = JSON.parse(localStorage.getItem('config'));
}

// 中文标签示例
function handleError() { // 本地注释：${错误处理} 核心逻辑
}

function validate() { // 本地注释：校验失败走 @错误处理
}
```

**命名**：中英文、数字、下划线；须以中文、英文字母或下划线开头；可混用，如 `${bug修复}`。

---

## 常见问题

**Q: 注释会进 Git 吗？**  
A: 默认数据在本地存储配置里，**不写入源文件**。若使用项目下 `.vscode/local-comment/`，是否提交由你是否把该目录纳入版本库决定。

**Q: 切分支会丢注释吗？**  
A: 注释数据与 Git 分支独立，**不会因切分支而清空**（仍建议把注释锚在稳定代码行上）。

**Q: 如何备份？**  
A: 命令面板中可使用「导出注释数据」；使用 `.vscode/local-comment/` 时也可直接备份该目录。

**Q: 别人能看到我的注释吗？**  
A: **默认不能**；数据本地私有。仅在你使用并开通「多人协作」相关能力时才会按产品设计分享。

---

## 数据存储

### 存储位置

- **项目内（推荐，v1.4.0+）**：`.vscode/local-comment/`  
  旧数据迁移：项目弹窗点迁移，或 `F1` 命令面板搜索 `local comment` 执行迁移命令。

- **全局基础目录（旧版 / 兼容）**  
  - **Windows**：`%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`  
  - **macOS**：`~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`  
  - **Linux**：`~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### 项目文件命名

每个项目可有独立文件，形如：`[项目名]-[哈希].json`。

使用 **`.vscode/local-comment/`** 后，一般**不必再频繁导入导出**，复制该目录到新机器或新项目即可携带数据。

### 多分组注释与书签（v1.4.0+）

- **注释**：`.vscode/local-comment/comments/`，默认 `comments.json`；可放多个 JSON（如 `work.json`、`study.json`）。
- **书签**：`.vscode/local-comment/bookmarks/`，默认 `bookmarks.json`，同样可多文件。
- **切换**：设置里搜索「local comment」，在 **Local Comment: Storage** 中修改当前使用的注释/书签配置文件名；或 `F1` 执行 `switch comments config`。

![多分组注释设置](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/multi_group_comments.png)

![切换注释配置命令](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/switch_storage_config.png)

### 数据特性小结

- 按项目分别存放  
- 不自动污染业务源码  
- 可备份、可恢复  
- 跨会话持久化  

---

## 贡献与反馈

- **GitHub Issues**：[https://github.com/SangLiang/vscode-local-comment/issues](https://github.com/SangLiang/vscode-local-comment/issues)  
- **邮件**：sangliang_sa@qq.com  

## 更新日志

变更说明见 [`CHANGELOG.zh-CN.md`](./CHANGELOG.zh-CN.md)。

## 打赏作者

我知道这有点傻，但帮作者补充点AI Token 或者点杯咖啡，会让我更有动力维护软件哦

![打赏作者](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/donate.jpg)

## License

MIT License