# VSCode Local Comment Plugin

[中文文档](https://github.com/SangLiang/vscode-local-commet/blob/master/README_CN.md)

A VSCode extension designed for code learning and project development, providing local comments and bookmark features that allow you to add personal notes and markers without modifying source code.

### Support Mermaid Flow-chart！！！【v1.1.3 Feat】
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)
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

## [1.1.3] - 2025-08-07 
✨ Support for mermaid flowcharts: Users can now freely use mermaid syntax in markdown comments.
- 🔨 Fixed some known issues
🎉 Additional note: In this release, we have actually implemented many features related to multi-person collaborative commenting, but we still need some time to refine the functionality. This is just a functional preview for the next major version.

## [1.1.2] - 2025-07-24
- ✨ Added support for saving text with Ctrl+S while editing Markdown.
- ✨ Added a feature to clear all bookmarks in files in the local comment command.
- 🔨 Fixed the issue where some icon styles were not displayed correctly on the Linux platform.
- 🔨 Fixed some known issues.

## [1.1.1] -2025-07-08
- ✨ Markdonw optimize the preview position using the tab box style
- 🔨 fixed the issue where the auto-completion position was incorrect and not displayed when using the @ tag when there were too many lines in markdown
- 🔨 some other questions

## [1.1.0] - 2025-06-29 
- ✨ Added bookmark functionality, use shortcut Ctrl+Alt+K to add bookmarks, use Ctrl+Alt+J to jump to next bookmark position
- ✨ for unmatched code, the initial snapshot content can also be seen in the markdown editor
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
