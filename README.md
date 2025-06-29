# VSCode Local Comment Plugin

A VSCode extension designed for code learning and project development, providing local comments and bookmark features that allow you to add personal notes and markers without modifying source code.

### Tag Navigation
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)
### Markdown Local Comments
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

## Why Do We Need Local Comments?

In daily development, we often encounter scenarios like:
- 📚 **Learning Others' Code**: Want to add understanding notes without modifying original files
- 🔍 **Project Research**: Need to mark key code snippets and record analysis thoughts
- 💡 **Development Thinking**: Want to record design ideas and personal understanding, but these thoughts are not suitable for version control
- 🔗 **Code Association**: Need to mark cross-file code relationships and establish personal logical connections

### Problems with Traditional Solutions

- ❌ **Code Comments**: Pollute source code and affect code cleanliness
- ❌ **External Documentation**: Separated from code, difficult to maintain synchronization
- ❌ **Version Control**: Personal notes and temporary thoughts should not be committed to version control systems
- ❌ **Temporary Marking**: Lack of persistence, lost after restart

### Our Plugin's Solution

✅ **Completely Independent**: Comment data is completely separated from source code without affecting original files  
✅ **Project Isolation**: Each project stores independently without interference  
✅ **Persistent Storage**: Maintains across sessions, still exists after restarting VSCode  
✅ **Smart Tracking**: Automatically adjusts comment positions when code changes  
✅ **Rich Text Support**: Supports Markdown syntax for richer content  
✅ **Personal Exclusive**: Completely localized, comment content is completely private 

## 🚀 Core Features

### 📝 Local Comment System

#### Basic Comment Features
- **Quick Add**: `Ctrl+Shift+C` to add comments on current line
- **Markdown Support**: `Ctrl+Shift+M` to create rich text comments
- **Selection Conversion**: Right-click selected text to directly convert to comments and delete original code
- **Instant Edit**: `Ctrl+Shift+E` to quickly edit current line comments
- **Easy Delete**: `Ctrl+Shift+D` to delete current line comments

#### Advanced Editing Features
- **Multi-line Editor**: Professional multi-line comment editing interface
- **Real-time Preview**: Real-time rendering of Markdown content
- **Context Display**: Shows code context during editing
- **Smart Completion**: Tag auto-completion functionality
- **Quick Operations**: Built-in shortcut key support in editor

#### Smart Position Tracking
- **Auto Adjustment**: Automatically updates comment positions when code changes
- **Content Matching**: Intelligently repositions comments through line content
- **Fuzzy Matching**: Provides fuzzy matching options when exact matching fails
- **Manual Adjustment**: Supports manually updating comments to new line numbers

### 📖 Bookmark System

#### Quick Marking
- **One-key Toggle**: `Ctrl+Alt+K` to quickly add or delete bookmarks
- **Visual Display**: Editor sidebar shows bookmark icons
- **Scrollbar Markers**: Shows bookmark position markers on scrollbar
- **Hover Information**: Mouse hover displays detailed bookmark information

#### Efficient Navigation
- **Sequential Navigation**: `Ctrl+Alt+J` to jump to next bookmark
- **Reverse Navigation**: `Ctrl+Alt+Shift+J` to jump to previous bookmark
- **Cross-file Support**: Navigate bookmarks across the entire project scope
- **Circular Jump**: Automatically returns to first bookmark after reaching the last one

#### Smart Management
- **Auto Update**: Automatically updates bookmark line numbers when code changes
- **Content Recording**: Automatically records code content of bookmark lines
- **Batch Operations**: Supports clearing all bookmarks in files or projects
- **Tree Display**: Sidebar tree structure displays all bookmarks

## 🔑 Best Practices

Local comments are best applied on the same line as function declarations:

```javascript
function test { // local comment best placed here
  test code 
}
```

This reduces the problem of local comments not matching code positions when switching branches or making large-scale code modifications. Try to avoid applying local comments on empty lines.

## ⌨️ Complete Shortcuts

### Local Comment Shortcuts
| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl+Shift+C` | Add Local Comment | Add simple comment on current line |
| `Ctrl+Shift+M` | Add Markdown Comment | Open multi-line editor to add rich text comment |
| `Ctrl+Shift+E` | Edit Comment | Quickly edit current line comment |
| `Ctrl+Shift+D` | Delete Comment | Delete current line comment |
| `Ctrl+Shift+T` | Selection Conversion | Convert selected text to comment |

### Bookmark Shortcuts
| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl+Alt+K` | Toggle Bookmark | Add or delete bookmark on current line |
| `Ctrl+Alt+J` | Next Bookmark | Jump to next bookmark position |
| `Ctrl+Alt+Shift+J` | Previous Bookmark | Jump to previous bookmark position |

## 🚀 Quick Start

1. **Add First Comment**: Press `Ctrl+Shift+M` on a code line
2. **Add First Bookmark**: Press `Ctrl+Alt+K` on a code line
3. **View Sidebar**: Find "Local Comments" panel in Explorer
4. **Try Tag Feature**: Use `$tagName` and `@tagName` in comments

#### Using Tags
```javascript
let userConfig = {};  // Local comment: This is where $userConfig is declared

function loadConfig() {// Local comment: This loads @userConfig configuration
    userConfig = JSON.parse(localStorage.getItem('config'));
}
```

### Frequently Asked Questions

**Q: Will comment data be committed to version control?**
A: No. Comment data is stored locally and does not affect source code files.

**Q: Will comments be lost after switching branches?**
A: No. Comment data is independent of Git branches, switching branches will not affect comments.

**Q: How to backup comment data?**
A: You can export backups through the "Export Comment Data" function in the command palette.

**Q: Can others see my comments?**
A: No. Comment data is only stored locally, completely private, and cannot be seen by others.

## 📊 Usage Statistics

Use the command palette (`Ctrl+Shift+P`) to search for the following commands:

- **Show Comment Statistics**: View comment count, tag statistics, and other information
- **Show Storage Location**: View the storage location of comment data

## 💾 Data Storage

### Storage Location
- **Base Directory**:
  - **Windows**: `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`
  - **Linux**: `~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### Project-Specific Storage
Each project has its own storage file, named: `[project-name]-[hash].json`

For example:
```
my-project-a1b2c3d4e5f6.json
another-project-g7h8i9j0k1l2.json
```

### Data Characteristics
- Comment data stored locally by project
- Not committed to version control systems
- Support for manual backup and recovery
- Persistence across VSCode sessions
- Each project maintains an independent comment database

## 🎯 Use Cases

### 1. Code Understanding
```javascript
function complexAlgorithm() {  // Local comment: $complexAlgorithm core algorithm
    // Complex algorithm implementation
}

// Elsewhere
if (needOptimization) {  // Local comment: May need to optimize @complexAlgorithm here
    complexAlgorithm();
}
```

### 2. Temporary Marking
```javascript
const API_KEY = 'xxx';  // Local comment: $API_KEY should be obtained from environment variables

fetch(url, {
    headers: { 'Authorization': API_KEY }  // Local comment: Using @API_KEY for authentication
});
```

### 3. Learning Notes
```javascript
class EventEmitter {  // Local comment: $EventEmitter observer pattern implementation
    on(event, callback) {  // Local comment: Register event listeners
        // Implementation code
    }
}

emitter.on('data', handler);  // Local comment: Listening to @EventEmitter's data event
```

## 🤝 Contribution and Feedback

### Issue Reporting
If you encounter problems during use, please provide feedback through:
- GitHub Issues: [Project Repository](https://github.com/SangLiang/vscode-local-commet/issues)
- Email Contact: 378305868@qq.com

## 📝 Changelog

### Change Log

## [1.1.0] - 2025-06-29 
- ✨ Added bookmark functionality, use shortcut Ctrl+Alt+K to add bookmarks, use Ctrl+Alt+J to jump to next bookmark position
- 🔨 Fixed some known issues

## [1.0.10] - 2025-06-28 
- ✨ Added user manual matching function for comments to code
- ✨ File items in local comment panel are sorted by user usage frequency
- ✨ Added jump to file functionality for file items in local comment panel, can serve as auxiliary navigation for file tabs
- 🔨 Fixed some known issues

## [1.0.9] - 2025-06-25 
- ✨ Split screen display when using markdown editor
- ✨ More flexible import and export functionality for user data (import/export by project path, import/export by comment content)
- ✨ Increased context content hints when using markdown editor
- 🔨 Fixed some known issues

## [1.0.8] - 2025-06-14
- 🔨 Used stricter matching algorithm, fixed comment-code position mismatch issues caused by large code block changes
- ✨ Removed some unused commands from command panel
- 🔨 Other issues

## [1.0.7] - 2025-06-04

### 🔨 Changes

- ✨ Added markdown editing preview functionality
- ✨ Added multilingual support for operation commands
- 🔨 Fixed incorrect comment styles in comment tree when switching branches

## [1.0.6] - 2025-06-02

### 🔨 Optimized comment tree

- ✨ Local comments not found in comment tree panel are displayed in darker colors

## [1.0.5] - 2025-05-31

### 🔨 Bug fixes

- ✨ Fixed issue where git branch switching incorrectly executed comment code snapshot update, causing comment position confusion. This issue has now been fixed

## [1.0.4] - 2025-05-31

### ✨ Optimized user experience

- 🎉 Added new shortcut Ctrl+Shift+M allowing direct entry into markdown mode for adding and modifying local comments

### 🔨 Bug fixes

- 🔨 Fixed issue where cursor focus was lost when returning to code editor after completing editing in markdown editor

## [1.0.3] - 2025-05-31

### 🔨 Bug fixes
- 🔨 Fixed issue where different projects used the same local comment storage file
- 🎯 Other known errors

## [1.0.2] - 2025-05-30

### 🔨 Bug fixes
- 🔨 Fixed comment position errors caused by branch switching
- 💻 Fixed incorrect smart completion position during Markdown editing

## [1.0.1] - 2025-05-30

### 🎉 New Features

- ✨ **Convert Selected Text to Comments**: Right-click selected text to directly convert to local comments and delete original text
- 📝 **Multi-line Editor**: Added professional multi-line comment editing interface with rich editing features
- 🎨 **Dual Editing Modes**: 
  - Quick Mode: Single-line quick editing
  - Detailed Mode: Multi-line rich text editing
- ⌨️ **Enhanced Shortcuts**: 
  - Ctrl+Enter: Save editing
- 🏷️ **Improved Tag Completion**: Automatically shows tag dropdown when typing @ in editor
- 🖱️ **Hover Action Buttons**: 
  - ✏️ Edit: Quick single-line editing
  - 📝 Markdown Edit: Multi-line detailed editing  
  - 🗑️ Delete: Delete comment

### 📖 New Use Cases

#### Quick Code Segment Marking
1. Select code that needs marking
2. Right-click and choose "Convert to Local Comment"
3. Selected code becomes comment, original code is automatically deleted

#### Writing Long Comments
1. Hover over comment
2. Click "📝 Markdown Edit"
3. Write detailed description in multi-line editor
4. Supports line breaks (\n) and tag references

## [1.0.0] - 2025-05-29

### New Features
- ✨ Local comment functionality: Add local comments in code without modifying original files
- 🏷️ Tag system: Support `$tagName` declaration and `@tagName` reference
- 🔗 Smart jumping: Click tag references to jump to declaration locations
- 💡 Auto-completion: Automatically suggests available tags when typing `@`
- 🌲 Tree view: View all comments in sidebar
- ⌨️ Shortcut support: Ctrl+Shift+C to add comments
- 🎨 Syntax highlighting: Tags are highlighted in comments
- 📁 Cross-file support: Tags can be referenced between different files

## 📄 License

MIT License


# VSCode 本地注释插件 (Local Comment)

一个专为代码学习和项目开发设计的 VSCode 扩展，提供本地注释和书签功能，让你在不修改源代码的情况下添加个人笔记和标记。

### tag跳转
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)
### markdown本地注释
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

## 为什么需要本地注释？

在日常开发中，我们经常遇到这样的场景：
- 📚 **学习他人代码**：想要添加理解笔记，但不想修改原文件
- 🔍 **项目调研**：需要标记关键代码片段，记录分析思路
- 💡 **开发思考**：想要记录设计想法和个人理解，但这些想法不适合提交到版本控制
- 🔗 **代码关联**：需要标记跨文件的代码关系，建立个人的逻辑连接

### 传统方案的问题

- ❌ **代码注释**：会污染源代码，影响代码整洁性
- ❌ **外部文档**：与代码分离，难以维护同步
- ❌ **版本控制**：个人笔记和临时想法不应该提交到版本控制系统
- ❌ **临时标记**：缺乏持久化，重启后丢失

### 本插件的解决方案

✅ **完全独立**：注释数据与源代码完全分离，不影响原文件  
✅ **项目隔离**：每个项目独立存储，互不干扰  
✅ **持久保存**：跨会话保持，重启VSCode后依然存在  
✅ **智能跟踪**：代码变化时自动调整注释位置  
✅ **富文本支持**：支持Markdown语法，内容更丰富  
✅ **个人专属**：完全本地化，注释内容完全私有 

## 🚀 核心功能

### 📝 本地注释系统

#### 基础注释功能
- **快速添加**：`Ctrl+Shift+C` 在当前行添加注释
- **Markdown支持**：`Ctrl+Shift+M` 创建富文本注释
- **选择转换**：右键选中文本，直接转换为注释并删除原代码
- **即时编辑**：`Ctrl+Shift+E` 快速编辑当前行注释
- **便捷删除**：`Ctrl+Shift+D` 删除当前行注释

#### 高级编辑功能
- **多行编辑器**：专业的多行注释编辑界面
- **实时预览**：Markdown内容实时渲染
- **上下文显示**：编辑时显示代码上下文
- **智能补全**：标签自动补全功能
- **快捷操作**：编辑器内置快捷键支持

#### 智能位置跟踪
- **自动调整**：代码变化时自动更新注释位置
- **内容匹配**：通过行内容智能重新定位注释
- **模糊匹配**：当精确匹配失败时提供模糊匹配选项
- **手动调整**：支持手动更新注释到新行号

### 📖 书签系统

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

#### 智能管理
- **自动更新**：代码变化时自动更新书签行号
- **内容记录**：自动记录书签所在行的代码内容
- **批量操作**：支持清除文件或项目的所有书签
- **树形显示**：侧边栏树形结构显示所有书签


## 🔑最佳实践

本地注释最好应用在函数声明的同一行。如：

```javascript
function test { // local comment 最好在此行注释
  test code 
}
```

这样做可以减少因为在切换分支，或者大范围修改代码后，本地注释匹配不到代码位置的问题，尽可能不要在空行应用本地注释。

## ⌨️ 快捷键大全

### 本地注释快捷键
| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Shift+C` | 添加本地注释 | 在当前行添加简单注释 |
| `Ctrl+Shift+M` | 添加Markdown注释 | 打开多行编辑器添加富文本注释 |
| `Ctrl+Shift+E` | 编辑注释 | 快速编辑当前行注释 |
| `Ctrl+Shift+D` | 删除注释 | 删除当前行注释 |
| `Ctrl+Shift+T` | 选择转换 | 将选中文本转换为注释 |

### 书签快捷键
| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+Alt+K` | 切换书签 | 添加或删除当前行书签 |
| `Ctrl+Alt+J` | 下一个书签 | 跳转到下一个书签位置 |
| `Ctrl+Alt+Shift+J` | 上一个书签 | 跳转到上一个书签位置 |


## 🚀 快速开始

1. **添加第一个注释**：在代码行上按 `Ctrl+Shift+M`
2. **添加第一个书签**：在代码行上按 `Ctrl+Alt+K`
3. **查看侧边栏**：在资源管理器中找到"本地注释"面板
4. **尝试标签功能**：在注释中使用 `$tagName` 和 `@tagName`


#### 使用标签
```javascript
let userConfig = {};  // 本地注释: 这里是$userConfig的声明地方

function loadConfig() {// 本地注释: 这里加载@userConfig的配置
    userConfig = JSON.parse(localStorage.getItem('config'));
}
```

### 常见问题

**Q: 注释数据会被提交到版本控制吗？**
A: 不会。注释数据存储在本地，不会影响源代码文件。

**Q: 切换分支后注释会丢失吗？**
A: 不会。注释数据独立于Git分支，切换分支不会影响注释。

**Q: 如何备份注释数据？**
A: 可以通过命令面板的"导出注释数据"功能导出备份。

**Q: 其他人可以看到我的注释吗？**
A: 不能。注释数据只存储在本地，完全私有，不会被其他人看到。


## 📊 使用统计

使用命令面板 (`Ctrl+Shift+P`) 搜索以下命令：

- **显示注释统计**: 查看注释数量、标签统计等信息
- **显示存储位置**: 查看注释数据的存储位置

## 💾 数据存储

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

## 🎯 使用场景

### 1. 代码理解
```javascript
function complexAlgorithm() {  // 本地注释: $complexAlgorithm核心算法
    // 复杂的算法实现
}

// 在其他地方
if (needOptimization) {  // 本地注释: 这里可能需要优化@complexAlgorithm
    complexAlgorithm();
}
```

### 2. 临时标记
```javascript
const API_KEY = 'xxx';  // 本地注释: $API_KEY需要从环境变量获取

fetch(url, {
    headers: { 'Authorization': API_KEY }  // 本地注释: 使用@API_KEY进行认证
});
```

### 3. 学习笔记
```javascript
class EventEmitter {  // 本地注释: $EventEmitter观察者模式实现
    on(event, callback) {  // 本地注释: 注册事件监听器
        // 实现代码
    }
}

emitter.on('data', handler);  // 本地注释: 监听@EventEmitter的data事件
```
## 🤝 贡献与反馈

### 问题反馈
如果您在使用过程中遇到问题，请通过以下方式反馈：
- GitHub Issues: [项目地址](https://github.com/SangLiang/vscode-local-commet/issues)
- 邮件联系: 378305868@qq.com

## 📝 更新日志

### 变更日志

## [1.1.0] - 2025-06-29 
- ✨ 加入书签功能，使用快捷键ctrl+alt+k可以添加书签，使用ctrl+alt+j可以跳转到下一个书签位置
- 🔨 修复一些已知问题

## [1.0.10] - 2025-06-28 
- ✨ 加入用户手动匹配注释到代码的功能
- ✨ 本地注释面板中的文件项，会根据用户的使用频率来排序
- ✨ 本地注释面板中的文件项加入跳转到文件的功能，可以作为文件tab的一个辅助跳转
- 🔨 修复一些已知问题


## [1.0.9] - 2025-06-25 
- ✨ 使用markdown编辑器时，会分屏显示
- ✨ 用户数据的导入和导出功能，选项更加自由(通过项目路径导入导出，通过注释内容的导入导出)
- ✨ 在使用markdown编辑器时候，上下文内容的提示增多了。
- 🔨 修复一些已知问题


## [1.0.8] - 2025-06-14
- 🔨 使用了更严格的匹配算法，修复在大的代码块改动后导致的注释与代码位置不匹配的问题
- ✨ 在命令行的panel中，移除了一些没有用的命令
- 🔨 其他的一些问题


## [1.0.7] - 2025-06-04

### 🔨 改动

- ✨ 添加了markdwon编辑的预览功能
- ✨ 为操作命令添加了多语言
- 🔨 修复了comment tree中，切换分支后导致的注释样式不正确的问题

## [1.0.6] - 2025-06-02

### 🔨 优化comment tree

- ✨在注释树面板中找不到的本地注释,会以更暗的颜色显示

## [1.0.5] - 2025-05-31

### 🔨 修复bug

- ✨git branch 切换分支的时候，错误的执行了更新注释代码快照的代码，导致注释的位置错乱。现在已经修复这个问题

## [1.0.4] - 2025-05-31

### ✨优化用户体验

- 🎉 加入新的快捷键ctrl+shift+m 允许直接进入markdown模式的添加，修改本地注释

### 🔨 修复bug

- 🔨修复在markdown编辑器里完成编辑后，返回代码编辑器时，失去了光标焦点的问题

## [1.0.3] - 2025-05-31

### 🔨 修复bug
- 🔨修复不同项目使用同一份本地注释储存文件的问题。
- 🎯其他的一些已知错误

## [1.0.2] - 2025-05-30

### 🔨 修复bug
- 🔨切换分支导致的注释位置错误的问题
- 💻Markdown编辑时，智能补全位置错误的问题


## [1.0.1] - 2025-05-30

### 🎉 新增功能

- ✨ **选中文字转换为注释**: 右键选中的文字，可直接转换为本地注释并删除原文字
- 📝 **多行编辑器**: 新增专业的多行注释编辑界面，支持丰富的编辑功能
- 🎨 **双重编辑模式**: 
  - 快捷模式：单行快速编辑
  - 详细模式：多行富文本编辑
- ⌨️ **增强快捷键**: 
  - Ctrl+Enter: 保存编辑
- 🏷️ **改进的标签补全**: 编辑器中输入@时自动显示标签下拉列表
- 🖱️ **悬停操作按钮**: 
  - ✏️ 编辑：快速单行编辑
  - 📝 Markdown编辑：多行详细编辑  
  - 🗑️ 删除：删除注释

### 📖 新增使用场景

#### 快速标记代码段
1. 选中需要标记的代码
2. 右键选择"转换为本地注释"
3. 选中的代码变成注释，原代码自动删除

#### 编写长注释
1. 悬停在注释上
2. 点击"📝 Markdown编辑"
3. 在多行编辑器中写入详细说明
4. 支持换行符(\n)和标签引用

## [1.0.0] - 2025-05-29

### 新增功能
- ✨ 本地注释功能：在代码中添加本地注释，不修改原文件
- 🏷️ 标签系统：支持 `$标签名` 声明和 `@标签名` 引用
- 🔗 智能跳转：点击标签引用可跳转到声明位置
- 💡 自动补全：输入 `@` 时自动提示可用标签
- 🌲 树形视图：在侧边栏查看所有注释
- ⌨️ 快捷键支持：Ctrl+Shift+C 添加注释
- 🎨 语法高亮：标签在注释中高亮显示
- 📁 跨文件支持：标签可在不同文件间引用

## 📄 License

MIT License
