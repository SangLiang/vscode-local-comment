# VSCode Local Comment Extension

A VSCode extension designed for large project development, providing local comment and bookmark functionality that allows you to add Markdown technical notes without modifying source code.

> You might not need it now, but when you face overwhelming amounts of code, I hope you'll remember it.

## Tag Navigation

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)

## Local Markdown Comments

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

## Local Comments and Bookmarks List

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/view_panel.png)

## Mermaid Flowchart Support!

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

## LaTeX formulas

Now, LaTeX formulas can be added in local comments!

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

## Multi-user Collaboration

Display other users' (here admin user) comment information in the editor. You can see others' evaluations of code segments like reading WeChat Books:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

Distinguish between users' local comment information and online shared information from others:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

Manage your shared comments in the web interface:

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**Note**: The multi-user collaboration version is not currently available for free public use.

## Why Do We Need Local Comments?

In daily development, we often encounter scenarios like:

- **Project Research**: Need to mark key code segments and record analysis thoughts
- **Development Thinking**: Want to record design ideas and personal understanding, but these thoughts aren't suitable for version control
- **Problem Fixing**: For some problem fixes, want to record the related solution process
- **Code Association**: Need to mark cross-file code relationships and establish personal logical connections
- **Learning Others' Code**: Want to add learning comprehension notes without modifying original files
- **AI Assistance**: AI-written or analyzed code has scattered knowledge points, hope to have a place to save records

### Problems with Traditional Solutions

- **Code Comments**: Will pollute source code and affect code cleanliness
- **External Documentation**: This is our most commonly used solution, but it also has the most problems. Good ones don't support markdown, markdown-supporting ones don't support multi-point login, multi-point login ones don't have mermaid diagram rendering, and those with everything require payment.

### Local Comment's Solution

**Completely Independent**: Comment data is completely separated from source code, not affecting original files

**Project Isolation**: Each project stores independently without interference

**Persistent Storage**: Maintains across sessions, still exists after restarting VSCode

**Smart Tracking**: Automatically adjusts comment positions when code changes

**Rich Text Support**: Supports Markdown syntax for richer content

**Mermaid Flowchart Support**: Supports Mermaid flowcharts, better helping to understand code

**Personal Exclusive**: Completely localized, comment content completely private

**Multi-user Collaboration**: Previous generations plant trees, future generations enjoy the shade. Users' completed code analysis and functional understanding can be shared with the team, everyone can enjoy the learning results.

## Core Features

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

## Complete Shortcut Keys

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

## Quick Start

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

## Data Storage

### Storage Location

- **Current project storage**:
  - Since v1.3.4, data is stored under `.vscode/local-comment/` in the current project
  - For projects with existing legacy data, you can migrate to the project directory `.vscode/local-comment/` in two ways:
    - 1. Click the migrate button in the project popup
    - 2. Open the Command Palette (F1), search for "local comment", find and run the migrate command

- **Base directory**:
  - **Windows**: `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`
  - **macOS**: `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`
  - **Linux**: `~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### Project-Specific Storage

Each project has its own storage file, named: `[Project Name]-[Hash Value].json`

**Using project-local storage (`.vscode/local-comment/`) avoids the need to manually import/export the local comment storage file; you can copy the data under `.vscode/local-comment/` to a new project directly.**

For example:
```
my-project-a1b2c3d4e5f6.json
another-project-g7h8i9j0k1l2.json
```

### Multi-group comments and bookmarks

Since v1.3.4, you can use multiple independent groups of local comments and bookmarks in the same project.

- **Comment data files**: Stored under `.vscode/local-comment/comments/`. The default file is `comments.json`. You can add multiple json files (e.g. `work.json`, `study.json`) in this directory to separate groups such as "work notes" and "study notes".
- **Bookmark data files**: Stored under `.vscode/local-comment/bookmarks/`. The default file is `bookmarks.json`; multiple bookmark config files are supported in the same way.
- **Switching groups**: Open VSCode Settings, search for "local comment", and under **Local Comment: Storage** change "Current comments config file name" or "Current bookmarks config file name" to switch between groups—no import/export needed.

![Multi-group comments settings](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/multi_group_comments.png)

### Data Characteristics

- Comment data is stored locally by project
- Won't be committed to version control system
- Supports manual backup and restore
- Persists across VSCode sessions
- Each project maintains independent comment database

## Contribution and Feedback

### Issue Feedback

If you encounter problems during use, please provide feedback through:

- GitHub Issues: [Project Address](https://github.com/SangLiang/vscode-local-commet/issues)
- Email Contact: sangliang_sa@qq.com

## Changelog

- The changelog has been moved to `CHANGELOG.md`. See: [`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT License
