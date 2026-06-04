# Local Comment

[中文文档](./README_CN.md)

**Without changing your source files**, attach durable notes and bookmarks to code in VS Code: **Markdown**, **Mermaid**, **LaTeX**, and **tag declarations with jump-to navigation**—built for reading large codebases, research, and capturing your own understanding.

> Use it as everyday notes; when the codebase grows and branches keep moving, Local Comment keeps your thinking **inside the editor** instead of scattered across chat or external docs.

**Documentation site:** [https://sangliang.github.io/vscode-local-comment/](https://sangliang.github.io/vscode-local-comment/)

---

## What it does

| Capability | Description |
|------------|-------------|
| **Local comments** | Stored in separate data; **not written into source files**; does not clutter Git commits with notes. |
| **Markdown notes** | Multi-line rich editing for analysis, flows, and todos—not only single-line `//` comments. |
| **Tag jumps** | Declare with `${tagName}`, reference with `@tagName`, jump between notes; **Chinese tag names** supported. |
| **Smart anchoring** | Tries to follow lines as code moves; anchor on **meaningful code lines** (see best practices below). |
| **Mermaid / LaTeX** | Diagrams and formulas render in preview for technical explanations. |
| **Bookmarks** | Mark lines across files and navigate in order—pairs well with comments as a reading path. |
| **Sidebar tree** | Browse comments and bookmarks for the project and jump back to code. |
| **Projects / groups** | Multiple independent comment groups per project: switch between several configs under `.vscode/local-comment/` (e.g. notes for one branch vs another). |
| **Markdown preview** | Preview `.md` files directly with Mermaid diagrams, LaTeX formulas, and syntax-highlighted code; supports zoom/pan for diagrams. |
| **Export to HTML** | Export Markdown files (including rendered diagrams and formulas) to a self-contained HTML file for sharing and offline viewing. |

**In short:** keep “how you read the code” in VS Code, **local and private by default**.

---

## 30-second start

1. Put the cursor on a line of code and press **`Ctrl+Shift+M`** to write a Markdown local comment (**the shortcut to remember**).
2. Open the **Local Comments** view in the sidebar for the list and navigation.
3. For quick landmarks, **`Ctrl+Alt+K`** toggles a bookmark; **`Ctrl+Alt+J`** / **`Ctrl+Alt+Shift+J`** moves between bookmarks.

Full shortcut tables are at the end of this file.

---

## Feature demos

### Tag navigation

![Tag navigation](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif)

### Markdown local comments

![Markdown local comments](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif)

### Comments and bookmarks list

![Sidebar list](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/view_panel.png)

### Mermaid diagrams

![Mermaid rendering](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

### LaTeX formulas

You can embed LaTeX in local comments and render it in preview.

![LaTeX support](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

### Multi-user collaboration (optional)

Distinguish **your local notes** from **shared online annotations** (similar to highlights in a shared book).

![Others' comments](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

![Local vs online](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

Manage comments you have shared from the web UI:

![Manage shared comments](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**Note:** The multi-user collaboration offering is **not** currently available as a free public product.

---

## Why local comments?

Typical cases: **researching a codebase**, **design notes that should not land in the repo**, **recording how a bug was fixed**, **linking logic across files**, **study notes while reading others’ code**, **capturing scattered takeaways after AI-assisted edits**.

### Compared with common alternatives

- **Comments in source**: Pollutes the repo and code review; poor fit for long or private write-ups.
- **External docs / note apps**: Detached from the exact file and line; Markdown, Mermaid, and sync often mean extra tooling or cost.

### How Local Comment approaches it

- **Separated from source**: Data lives in its own storage; files stay clean.  
- **Per-project isolation**: Projects do not mix.  
- **Persistent across sessions**: Survives restarting VS Code.  
- **Tracks edits when possible**: Reduces “comment still there, code unrecognizable” drift.  
- **Private by default**: Local data; optional team sharing is described under **Multi-user collaboration** above.

---

## Core features

### 1. Local comments

- **Quick add**: `Ctrl+Shift+C` adds a simple comment on the current line (overlaps somewhat with the Markdown entry; may change in a future release).
- **Markdown**: `Ctrl+Shift+M` opens the multi-line editor (**recommended main entry**).
- **Edit**: `Ctrl+Shift+E` edits the comment bound to the current line.
- **Delete**: `Ctrl+Shift+D` removes the comment on the current line.
- **Selection to comment**: `Ctrl+Shift+T` turns the selection into a comment.

### 2. Bookmarks

- **Toggle**: `Ctrl+Alt+K` adds or removes a bookmark on the current line.  
- **Visuals**: Gutter icons, scrollbar markers, hover details.  
- **Navigate**: `Ctrl+Alt+J` next, `Ctrl+Alt+Shift+J` previous, cross-file, wraps end-to-start.

### 3. Markdown file preview and export

- **Preview**: Select "Preview Markdown" from the right-click menu in the Markdown file editor, or run `Local Comment: Preview Markdown` from the Command Palette. Supports live preview of Mermaid diagrams, LaTeX formulas, and syntax-highlighted code.
- **Diagram interactions**: Zoom buttons (+/-), Ctrl+scroll to zoom, mouse drag to pan Mermaid diagrams.
- **Export HTML**: Click the "Export HTML" button in the preview panel to generate a self-contained HTML file (with inlined CSS/JS/fonts) that can be viewed without network access—perfect for sharing and archiving.

---

## Best practices (very important)

Prefer attaching comments to **meaningful code lines** (e.g. the same line as a function declaration). **Avoid** empty lines or lines that are only punctuation:

```javascript
function test() { // local comment: this line is a stable anchor
  // ...
}
```

That makes it easier to stay aligned after **branch switches** or **large refactors**.

---

## Shortcuts

### Local comments

| Shortcut | Action | Notes |
|----------|--------|--------|
| `Ctrl+Shift+C` | Add local comment | Simple one-line comment |
| `Ctrl+Shift+M` | Add Markdown comment | **Core**: multi-line rich text |
| `Ctrl+Shift+E` | Edit comment | Quick edit for current line |
| `Ctrl+Shift+D` | Delete comment | Remove comment on current line |
| `Ctrl+Shift+T` | Selection to comment | Convert selection |
| - | Preview Markdown | Right-click menu or Command Palette (`.md` files only) |

### Bookmarks

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+K` | Toggle bookmark |
| `Ctrl+Alt+J` | Next bookmark |
| `Ctrl+Alt+Shift+J` | Previous bookmark |

---

## Tags

Tags support Chinese. Declare: `${tagName}`; reference: `@tagName`.

```javascript
let userConfig = {};  // local comment: ${userConfig} declared here

function loadConfig() { // local comment: load @userConfig here
    userConfig = JSON.parse(localStorage.getItem('config'));
}

// Chinese tag example
function handleError() { // local comment: ${错误处理} core logic
}

function validate() { // local comment: on failure use @错误处理
}
```

**Naming:** letters (any script), digits, underscores; must start with a letter or underscore; mixing scripts is allowed, e.g. `${bug修复}`.

---

## FAQ

**Q: Do comments go into Git?**  
A: By default data lives in local storage and is **not written into source files**. If you use `.vscode/local-comment/` under the project, whether it is committed depends on whether you track that folder in version control.

**Q: Do I lose comments when I switch branches?**  
A: Comment data is independent of Git branches; it is **not cleared** when you switch (still best to anchor on stable lines).

**Q: How do I back up?**  
A: Use **Export comment data** from the Command Palette, or back up the `.vscode/local-comment/` directory when you use project-local storage.

**Q: Can others see my comments?**  
A: **Not by default**; data stays local. Sharing follows the product design only if you enable the **multi-user collaboration** features.

---

## Data storage

### Locations

- **Inside the project (recommended, v1.4.0+):** `.vscode/local-comment/`  
  Migrating legacy data: use the migrate action in the project prompt, or open the Command Palette (`F1`), search for `local comment`, and run the migrate command.

- **Global base directory (legacy / compatibility)**  
  - **Windows:** `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`  
  - **macOS:** `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/`  
  - **Linux:** `~/.config/Code/User/globalStorage/vscode-local-comment/projects/`

### Per-project file naming

Each project can have its own file shaped like: `[project-name]-[hash].json`.

With **`.vscode/local-comment/`**, you usually **do not need frequent import/export**—copy that folder to another machine or project to move data.

### Multiple comment and bookmark groups (v1.4.0+)

- **Comments:** `.vscode/local-comment/comments/`, default `comments.json`; add more JSON files (e.g. `work.json`, `study.json`).
- **Bookmarks:** `.vscode/local-comment/bookmarks/`, default `bookmarks.json`; same pattern for multiple files.
- **Switching:** VS Code Settings → search **local comment** → under **Local Comment: Storage**, change the active comments or bookmarks config file name; or run `switch comments config` from `F1`.

![Multi-group comments settings](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/multi_group_comments.png)

![Switch comments config command](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/switch_storage_config.png)

### Data characteristics

- Stored per project  
- Does not automatically pollute application source  
- Backup and restore supported  
- Persists across VS Code sessions  

---

## Contributing and feedback

- **GitHub Issues:** [https://github.com/SangLiang/vscode-local-comment/issues](https://github.com/SangLiang/vscode-local-comment/issues)  
- **Email:** sangliang_sa@qq.com  

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md). Chinese notes: [`CHANGELOG.zh-CN.md`](./CHANGELOG.zh-CN.md).

## Support the author

This may sound silly, but chipping in for a bit of AI usage or buying the author a coffee goes a long way toward keeping the extension maintained.

![Support the author](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/donate.jpg)

## License

MIT License
