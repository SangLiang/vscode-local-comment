---
title: Local Comments
permalink: /en/docs/comments/
lang: en
---

# Local Comments

The core feature of Local Comment. Attach durable Markdown comments to any code line without modifying the source code.

## Quick Add {#quick-add}

### Markdown Comments (Recommended)

- **Shortcut:** <kbd>Ctrl+Shift+M</kbd> (Mac: <kbd>Cmd+Shift+M</kbd>)
- Opens a multi-line Markdown editor, supporting rich text, lists, code blocks, etc.
- Ideal for writing longer analysis, design notes, or todos

### Quick Single-Line Comment

- **Shortcut:** <kbd>Ctrl+Shift+C</kbd>
- Directly input a single-line text comment
- Suitable for quick marking without opening an editor

<div class="callout callout-warning">
<strong>Note:</strong> The quick single-line comment feature overlaps somewhat with Markdown comments and may be adjusted or removed in future versions. It is recommended to prioritize Markdown comments.
</div>

## Markdown Editor {#markdown-edit}

### Open the Editor

- **New:** <kbd>Ctrl+Shift+M</kbd>
- **Edit existing:** <kbd>Ctrl+Shift+E</kbd>

### Editor Interface

The editor is divided into two columns: the left side is the Markdown text editing area, and the right side is the real-time preview area. It supports synchronized scroll positioning, making it easy to quickly find corresponding content in long documents.

### Supported Syntax

- Standard Markdown: headings, lists, quotes, links, images, tables
- Code blocks: syntax highlighting supported
- Mermaid flowcharts
- LaTeX math formulas

<div class="callout callout-tip">
<strong>Daily usage tip:</strong> In the Markdown editor, press <kbd>Ctrl+S</kbd> to save and continue editing, and press <kbd>Ctrl+Enter</kbd> to save and exit.
</div>

<div class="callout callout-tip">
<strong>Advanced tip:</strong> The context area in the editor displays the code snippet currently bound to the comment. Clicking the code snippet allows you to switch the comment's line number anchor.
</div>

## Edit & Delete {#edit-delete}

### Edit

1. Move the cursor to the code line with an existing comment
2. Press <kbd>Ctrl+Shift+E</kbd>
3. Modify the content and save

### Delete

1. Move the cursor to the code line with an existing comment
2. Press <kbd>Ctrl+Shift+D</kbd>
3. Confirm deletion

Or use the "Local Comments" view in the sidebar, hover over the comment item and click the delete icon.

## Selection to Comment {#selection-to-comment}

1. Select a piece of code in the editor
2. Press <kbd>Ctrl+Shift+T</kbd>
3. The selected text will be automatically filled into the context area of the Markdown editor, making it easy for you to write a comment for this code

<div class="callout callout-tip">
<strong>Anchoring strategy:</strong> Comments are bound to specific code lines. If the code changes, Local Comment will attempt to re-locate through "smart matching". To improve matching success rates, it is recommended to anchor comments on "stable" code lines, such as function definitions, class declarations, etc., and avoid empty lines or lines containing only punctuation.
</div>
