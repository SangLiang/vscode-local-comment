# VSCode 本地注释插件 (Local Comment)

一个专为大项目开发而设计的 VSCode 扩展，提供本地注释和书签功能，允许你在不修改源代码的情况下添加Markdown技术笔记。

> 现在你或许不需要他，但你面对难以应付的的巨量代码时候，希望你能想起他。

## tag跳转

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)

## markdown本地注释

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

## 本地注释和书签列表

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/view_panel.png)

## Mermaid流程图支持！

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

## latex公式 

在本地注释中可以添加latex公式啦！

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

## 多人合作

在编辑器上显示其他人(此处为admin用户)的注释信息，你可以像看微信读书那样，看到别人对该段代码的评价:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

用户的本地注释信息和线上其他人的分享的信息区分：
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

在web页面，管理自己分享的comment:

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**注意** :多人协作版暂不对外免费提供。

## 为什么需要本地注释？

在日常开发中，我们经常遇到这样的场景：

- **项目调研**：需要标记关键代码片段，记录分析思路
- **开发思考**：想要记录设计想法和个人理解，但这些想法不适合提交到版本控制
- **问题修复**: 对于一些问题的修复，想要记录下来相关的解决流程
- **代码关联**：需要标记跨文件的代码关系，建立个人的逻辑连接
- **学习他人代码**：想要添加学习理解笔记，但不想修改原文件
- **AI辅助**: 让AI写完或者分析完的代码，知识点比较零碎，希望有个保存记录的地方。

### 传统方案的问题

- **代码注释**：会污染源代码，影响代码整洁性

- **外部文档**：这是我们最常用的解决方案，但是问题也是最多的，好用的不支持markdown，支持markdown的不支持多点登录，支持多点登录的没有mermaid图渲染，全都有的要付钱。

### local comment 的解决方案

**完全独立**：注释数据与源代码完全分离，不影响原文件

**项目隔离**：每个项目独立存储，互不干扰

**持久保存**：跨会话保持，重启VSCode后依然存在

**智能跟踪**：代码变化时自动调整注释位置

**富文本支持**：支持Markdown语法，内容更丰富

**Mermaid流程图支持**：支持Mermaid流程图，能更好的帮助理解代码

**个人专属**：完全本地化，注释内容完全私有

**多人协作**：前人栽树，后人乘凉。用户完成的对代码的分析，对功能的理解可以分享到团队，大家都能享受到学习成果。

## 核心功能

### 1.本地注释系统

#### 基础注释功能

- **快速添加**：`Ctrl+Shift+C` 在当前行添加注释(功能有点重复了，后面的版本会考虑移除)
- **Markdown支持**：`Ctrl+Shift+M` 创建Markdown本地注释
- **即时编辑**：`Ctrl+Shift+E` 快速编辑当前行注释
- **便捷删除**：`Ctrl+Shift+D` 删除当前行注释

### 2.书签系统

#### 快速标记

- **一键切换**：`Ctrl+Alt+K` 快速添加或删除书签
- **可视化显示**：编辑器侧边栏显示书签图标
- **滚动条标记**：滚动条上显示书签位置标记
- **悬停信息**：鼠标悬停显示书签详细信息

#### 高效导航

- **顺序导航**：`Ctrl+Alt+J` 跳转到下一个书签
- **逆序导航**：`Ctrl+Alt+Shift+J` 跳转到上一个书签
- **跨文件支持**：在整个项目范围内导航书签
- **循环跳转**：到达最后一个书签后自动回到第一个

## 最佳实践(重要)

本地注释最好应用在函数声明的同一行。如：

```javascript
function test { // local comment 最好在此行注释
  test code
}
```

这样做可以减少因为在切换分支，或者大范围修改代码后，本地注释匹配不到代码位置的问题，**请不要在空行或者无意义的代码行添加本地注释**。

## 快捷键大全

### 本地注释快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Shift+C` | 添加本地注释 | 在当前行添加简单注释 |
| `Ctrl+Shift+M` | 添加Markdown注释 | 打开多行编辑器添加富文本注释，核心快捷键，只记住这一个就可以了 |
| `Ctrl+Shift+E` | 编辑注释 | 快速编辑当前行注释 |
| `Ctrl+Shift+D` | 删除注释 | 删除当前行注释 |
| `Ctrl+Shift+T` | 选择转换 | 将选中文本转换为注释 |

### 书签快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Alt+K` | 切换书签 | 添加或删除当前行书签 |
| `Ctrl+Alt+J` | 下一个书签 | 跳转到下一个书签位置 |
| `Ctrl+Alt+Shift+J` | 上一个书签 | 跳转到上一个书签位置 |


## 快速开始

1. **添加第一个注释**：在代码行上按 `Ctrl+Shift+M`
2. **添加第一个书签**：在代码行上按 `Ctrl+Alt+K`
3. **查看侧边栏**：在资源管理器中找到"本地注释"面板
4. **尝试标签功能**：在注释中使用 `${tagName}` 和 `@tagName`

### 使用标签

标签系统支持中文标签名，您可以使用中文、英文或中英文混合的标签名。

**标签声明格式**：`${标签名}` - 在注释中声明一个标签
**标签引用格式**：`@标签名` - 在注释中引用已声明的标签

```javascript
let userConfig = {};  // 本地注释: 这里是${userConfig}的声明地方

function loadConfig() {// 本地注释: 这里加载@userConfig的配置
    userConfig = JSON.parse(localStorage.getItem('config'));
}

// 中文标签示例
function handleError() { // 本地注释: ${错误处理} 这里是错误处理逻辑
    // ...
}

function validate() { // 本地注释: 这里调用@错误处理进行验证
    // ...
}
```

**标签命名规则**：
- 支持中文、英文字母、数字和下划线
- 必须以中文、英文字母或下划线开头
- 可以使用中英文混合，如 `${bug修复}`、`${待办事项}`

### 常见问题

**Q: 注释数据会被提交到版本控制吗？**
A: 不会。注释数据存储在本地，不会影响源代码文件。

**Q: 切换分支后注释会丢失吗？**
A: 不会。注释数据独立于Git分支，切换分支不会影响注释。

**Q: 如何备份注释数据？**
A: 可以通过命令面板的"导出注释数据"功能导出备份。

**Q: 其他人可以看到我的注释吗？**
A: 不能。注释数据只存储在本地，完全私有，不会被其他人看到。


## 数据存储

### 存储位置

- **基础目录**:
  - **Windows**: `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`
  - **Linux**: `~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### 项目特定存储

每个项目都有自己的存储文件，命名为：`[项目名]-[哈希值].json`

例如：
```

my-project-a1b2c3d4e5f6.json
another-project-g7h8i9j0k1l2.json
```

### 数据特性

- 注释数据按项目分别存储在本地
- 不会被提交到版本控制系统
- 支持手动备份和恢复
- 跨VSCode会话持久化
- 各项目维护独立的注释数据库

## 贡献与反馈

### 问题反馈

如果您在使用过程中遇到问题，请通过以下方式反馈：

- GitHub Issues: [项目地址](https://github.com/SangLiang/vscode-local-commet/issues)

- 邮件联系: sangliang_sa@qq.com

## 更新日志

- 变更日志已迁移至 `CHANGELOG.zh-CN.md`，请查看：[`CHANGELOG.zh-CN.md`](./CHANGELOG.zh-CN.md)

## License

MIT License
