# VSCode Local Comment Extension

[中文文档](https://github.com/SangLiang/vscode-local-commet/blob/master/README_CN.md)

A VSCode extension designed for large project development, providing local comment and bookmark functionality that allows you to add Markdown technical notes without modifying source code.

> You might not need it now, but when you face overwhelming amounts of code, I hope you'll remember it.

## Tag Navigation

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)

## Local Markdown Comments

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

## Mermaid Flowchart Support!!! [v1.1.3 Feature]

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

## Multi-user Collaboration is Here!!! [v1.2.0 Feature]

Display other users' (here admin user) comment information in the editor. You can see others' evaluations of code segments like reading WeChat Books:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

Distinguish between users' local comment information and online shared information from others:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

Manage your shared comments in the web interface:

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**Note**: The multi-user collaboration version is not currently available for free public use.

## Support latex formulas [v1.3.0]

Now, latex formulas can be added in local comments!

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

## Why Do We Need Local Comments?

In daily development, we often encounter scenarios like:

- **Project Research**: Need to mark key code segments and record analysis thoughts
- **Development Thinking**: Want to record design ideas and personal understanding, but these thoughts aren't suitable for version control
- **Problem Fixing**: For some problem fixes, want to record the related solution process
- **Code Association**: Need to mark cross-file code relationships and establish personal logical connections
- **Learning Others' Code**: Want to add learning comprehension notes without modifying original files
- **AI Assistance**: AI-written or analyzed code has scattered knowledge points, hope to have a place to save records

### Problems with Traditional Solutions

- ❌ **Code Comments**: Will pollute source code and affect code cleanliness
- ❌ **External Documentation**: This is our most commonly used solution, but it also has the most problems. Good ones don't support markdown, markdown-supporting ones don't support multi-point login, multi-point login ones don't have mermaid diagram rendering, and those with everything require payment.

### Local Comment's Solution

**Completely Independent**: Comment data is completely separated from source code, not affecting original files

**Project Isolation**: Each project stores independently without interference

**Persistent Storage**: Maintains across sessions, still exists after restarting VSCode

**Smart Tracking**: Automatically adjusts comment positions when code changes

**Rich Text Support**: Supports Markdown syntax for richer content

**Mermaid Flowchart Support**: Supports Mermaid flowcharts, better helping to understand code

**Personal Exclusive**: Completely localized, comment content completely private

**Multi-user Collaboration**: Previous generations plant trees, future generations enjoy the shade. Users' completed code analysis and functional understanding can be shared with the team, everyone can enjoy the learning results.

## 🚀 Core Features

### 1. Local Comment System

#### Basic Comment Functions

- **Quick Add**: `Ctrl+Shift+C` Add comment at current line (functionality is somewhat redundant, will consider removing in future versions)
- **Markdown Support**: `Ctrl+Shift+M` Create Markdown local comment
- **Instant Edit**: `Ctrl+Shift+E` Quickly edit current line comment
- **Convenient Delete**: `Ctrl+Shift+D` Delete current line comment

### 2. Bookmark System

#### Quick Marking

- **One-click Toggle**: `Ctrl+Alt+K` Quickly add or remove bookmark
- **Visual Display**: Shows bookmark icons in editor sidebar
- **Scrollbar Marking**: Shows bookmark position markers on scrollbar
- **Hover Information**: Mouse hover displays bookmark detailed information

#### Efficient Navigation

- **Sequential Navigation**: `Ctrl+Alt+J` Jump to next bookmark
- **Reverse Navigation**: `Ctrl+Alt+Shift+J` Jump to previous bookmark
- **Cross-file Support**: Navigate bookmarks across entire project
- **Circular Jump**: Automatically returns to first after reaching last bookmark

## Best Practices (Important)

Local comments are best applied on the same line as function declarations. For example:

```javascript
function test { // local comment is best placed on this line
  test code
}
```

This reduces the problem of local comments not matching code positions after switching branches or making large-scale code modifications. **Please do not add local comments on empty lines or meaningless code lines**.

## ⌨️ Complete Shortcut Keys

### Local Comment Shortcuts

| Shortcut | Function | Description |
|-----------|----------|-------------|
| `Ctrl+Shift+C` | Add Local Comment | Add simple comment at current line |
| `Ctrl+Shift+M` | Add Markdown Comment | Open multi-line editor for rich text comments, core shortcut, just remember this one |
| `Ctrl+Shift+E` | Edit Comment | Quickly edit current line comment |
| `Ctrl+Shift+D` | Delete Comment | Delete current line comment |
| `Ctrl+Shift+T` | Select Convert | Convert selected text to comment |

### Bookmark Shortcuts

| Shortcut | Function | Description |
|-----------|----------|-------------|
| `Ctrl+Alt+K` | Toggle Bookmark | Add or remove bookmark at current line |
| `Ctrl+Alt+J` | Next Bookmark | Jump to next bookmark position |
| `Ctrl+Alt+Shift+J` | Previous Bookmark | Jump to previous bookmark position |

## 🚀 Quick Start

1. **Add First Comment**: Press `Ctrl+Shift+M` on a code line
2. **Add First Bookmark**: Press `Ctrl+Alt+K` on a code line
3. **View Sidebar**: Find "Local Comments" panel in resource explorer
4. **Try Tag Function**: Use `${tagName}` and `@tagName` in comments

### Using Tags

The tag system supports Chinese tag names. You can use Chinese, English, or mixed Chinese-English tag names.

**Tag Declaration Format**: `${tagName}` - Declare a tag in a comment
**Tag Reference Format**: `@tagName` - Reference a declared tag in a comment

```javascript
let userConfig = {};  // local comment: This is where ${userConfig} is declared

function loadConfig() {// local comment: This loads @userConfig configuration
    userConfig = JSON.parse(localStorage.getItem('config'));
}

// Chinese tag example
function handleError() { // local comment: ${错误处理} This is error handling logic
    // ...
}

function validate() { // local comment: Call @错误处理 for validation here
    // ...
}
```

**Tag Naming Rules**:
- Supports Chinese characters, English letters, numbers, and underscores
- Must start with a Chinese character, English letter, or underscore
- Can use mixed Chinese-English, such as `${bug修复}`, `${待办事项}`

### Common Questions

**Q: Will comment data be committed to version control?**
A: No. Comment data is stored locally and won't affect source code files.

**Q: Will comments be lost after switching branches?**
A: No. Comment data is independent of Git branches, switching branches won't affect comments.

**Q: How to backup comment data?**
A: You can export backup through the "Export Comment Data" function in the command palette.

**Q: Can others see my comments?**
A: No. Comment data is only stored locally, completely private, and won't be seen by others.

## 💾 Data Storage

### Storage Location

- **Base Directory**:
  - **Windows**: `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`
  - **Linux**: `~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### Project-Specific Storage

Each project has its own storage file, named: `[Project Name]-[Hash Value].json`

For example:
```
my-project-a1b2c3d4e5f6.json
another-project-g7h8i9j0k1l2.json
```

### Data Characteristics

- Comment data is stored locally by project
- Won't be committed to version control system
- Supports manual backup and restore
- Persists across VSCode sessions
- Each project maintains independent comment database

## 🤝 Contribution and Feedback

### Issue Feedback

If you encounter problems during use, please provide feedback through:

- GitHub Issues: [Project Address](https://github.com/SangLiang/vscode-local-commet/issues)
- Email Contact: sangliang_sa@qq.com

## 📝 Changelog

### Change Log

## [1.3.0] -2025-11-26

- ✨ adds support for latex formulas!!
- ✨ allows log information to be output in the output of the editor
- 🔨 optimized the code, slightly improving performance in rendering

## [1.2.2] -2025-10-31

- Fixed the issue where an error occurred when cleaning bookmarks for the current fileWhen there are no shared comments, unlogged-in users do not need pop-up prompts
- Remove some useless code

## [1.2.1] - 2025-09-03

- The issue of being unable to normally save and exit when entering Markdown editing from a mouse click
- Some other optimizations

## [1.2.0] - 2025-08-23

- ✨ Biggest highlight: Support for multi-user collaboration, allowing users to share local comments to the cloud and pull local comments from the cloud
- ✨ Optimize mermaid diagrams, allowing ctrl+mouse wheel to zoom flowcharts
- ✨ Add mermaid diagram hand-drawn mode
- ✨ Support preview of shared comments
- ✨ Allow users to directly import contributed comments into local comments
- ✨ Allow users to click context content in markdown editor to switch comment line numbers
- 🔨 Fix some known issues
- 🎉 Additional note: Although this version already supports multi-user comments, I don't have a cloud server yet, so it can't be tested for now

## [1.1.3] - 2025-08-07

- ✨ Support for mermaid flowcharts, now users can freely use mermaid syntax in markdown comments
- 🔨 Fix some known issues
- 🎉 Additional note: In this release, many features about multi-user collaborative comment content have actually been implemented, but still need some time to polish the functionality. This is just a preview of the next major version's features

## [1.1.2] - 2025-07-24

- ✨ Support using ctrl+s to save text while editing Markdown
- ✨ Add clear all bookmarks in all files functionality to local comment commands
- 🔨 Fix icon style display issues on Linux platforms
- 🔨 Fix some known issues

## [1.1.1] - 2025-07-08

- ✨ Optimize Markdown preview position, using tab selection box style
- 🔨 Fix issue where @ tag autocomplete position appears incorrectly and doesn't display when markdown has too many lines
- 🔨 Other issues

## [1.1.0] - 2025-06-29

- ✨ Add bookmark functionality, use ctrl+alt+k to add bookmarks, use ctrl+alt+j to jump to next bookmark position
- ✨ For unmatched code, can also see initial snapshot content in markdown editor
- 🔨 Fix some known issues

## [1.0.10] - 2025-06-28

- ✨ Add user manual matching of comments to code functionality
- ✨ File items in local comment panel are sorted by user usage frequency
- ✨ Add jump to file functionality for file items in local comment panel, can serve as auxiliary file tab jumping
- 🔨 Fix some known issues

## [1.0.9] - 2025-06-25

- ✨ When using markdown editor, will display in split screen
- ✨ User data import and export functionality, more flexible options (import/export by project path, import/export by comment content)
- ✨ When using markdown editor, context content hints are increased
- 🔨 Fix some known issues

## [1.0.8] - 2025-06-14

- 🔨 Use stricter matching algorithm, fix issue where comments don't match code positions after large code block changes
- ✨ Remove some useless commands from command line panel
- 🔨 Other issues

## [1.0.7] - 2025-06-04

### 🔨 Changes

- ✨ Add markdown edit preview functionality
- ✨ Add multi-language support for operation commands
- 🔨 Fix issue where comment styles are incorrect in comment tree after switching branches

## [1.0.6] - 2025-06-02

### 🔨 Optimize comment tree

- ✨ Local comments not found in comment tree panel will display in darker colors

## [1.0.5] - 2025-05-31

### 🔨 Fix bugs

- ✨ When switching git branches, incorrectly executed code for updating comment code snapshots, causing comment position confusion. This issue has now been fixed

## [1.0.4] - 2025-05-31

### ✨ Optimize user experience

- 🎉 Add new shortcut ctrl+shift+m allowing direct entry into markdown mode for adding and modifying local comments

### 🔨 Fix bugs

- 🔨 Fix issue where cursor focus is lost when returning to code editor after completing editing in markdown editor

## [1.0.3] - 2025-05-31

### 🔨 Fix bugs

- 🔨 Fix issue where different projects use the same local comment storage file
- 🎯 Other known errors

## [1.0.2] - 2025-05-30

### 🔨 Fix bugs

- 🔨 Fix issue where comment positions are incorrect after switching branches
- 💻 Fix issue where smart completion positions are incorrect during Markdown editing

## [1.0.1] - 2025-05-30

### 🎉 New Features

- ✨ **Convert Selected Text to Comment**: Right-click selected text can directly convert to local comment and delete original text
- 📝 **Multi-line Editor**: New professional multi-line comment editing interface with rich editing features
- 🎨 **Dual Edit Mode**:
  - Quick Mode: Single-line quick editing
  - Detailed Mode: Multi-line rich text editing
- ⌨️ **Enhanced Shortcuts**:
  - Ctrl+Enter: Save editing
- 🏷️ **Improved Tag Completion**: Automatically display tag dropdown when typing @ in editor
- 🖱️ **Hover Action Buttons**:
  - ✏️ Edit: Quick single-line editing
  - 📝 Markdown Edit: Multi-line detailed editing
  - 🗑️ Delete: Delete comment

### 📖 New Usage Scenarios

#### Quick Marking of Code Segments

1. Select code that needs marking
2. Right-click and choose "Convert to Local Comment"
3. Selected code becomes comment, original code automatically deleted

#### Writing Long Comments

1. Hover over comment
2. Click "📝 Markdown Edit"
3. Write detailed explanation in multi-line editor
4. Support line breaks (\n) and tag references

## [1.0.0] - 2025-05-29

### New Features

- ✨ Local comment functionality: Add local comments in code without modifying original files
- 🏷️ Tag system: Support `${tagName}` declaration and `@tagName` reference
- 🔗 Smart navigation: Click tag references to jump to declaration positions
- 💡 Auto-completion: Automatically suggest available tags when typing `@`
- 🌲 Tree view: View all comments in sidebar
- ⌨️ Shortcut support: Ctrl+Shift+C to add comments
- 🎨 Syntax highlighting: Tags highlighted in comments
- 📁 Cross-file support: Tags can be referenced across different files

## 📄 License

MIT License
