---
title: Bookmarks
permalink: /en/docs/bookmarks/
lang: en
---

# Bookmarks

The bookmark feature helps you mark key locations in large codebases and establish cross-file reading paths.

## Toggle {#toggle}

- **Shortcut:** <kbd>Ctrl+Alt+K</kbd>
- Add or remove a bookmark on the current code line
- Bookmarks will display an icon next to the editor's line number

<div class="callout callout-tip">
<strong>New user tip:</strong> Bookmarks and local comments can coexist on the same line without interfering with each other.
</div>

## Navigation {#navigate}

| Shortcut | Action |
|----------|--------|
| <kbd>Ctrl+Alt+J</kbd> | Jump to next bookmark |
| <kbd>Ctrl+Alt+Shift+J</kbd> | Jump to previous bookmark |

Bookmark navigation is cross-file. When there are no more bookmarks in the current file, it will automatically open the next file containing bookmarks.

<div class="callout callout-tip">
<strong>Daily usage:</strong> When reading unfamiliar codebases, you can add bookmarks to each key logic point, then use shortcuts to quickly jump between them, forming a "reading path".
</div>

## Cross-File {#cross-file}

Bookmark data, like local comments, is stored in project-isolated storage. All bookmarks across files are listed in the "Local Comments" view in the sidebar, grouped by file.

## Clear All {#clear}

- **Command Palette:** Press <kbd>F1</kbd>, search for "Local Comment: Clear All Bookmarks"
- A confirmation dialog will pop up; after confirmation, all bookmarks in the current project will be deleted

<div class="callout callout-danger">
<strong>Warning:</strong> The clear action cannot be undone. Please make sure you no longer need these bookmarks.
</div>

<div class="callout callout-tip">
<strong>Advanced tip:</strong> Bookmarks, comments, and tags work best when used together: use "comments" to record core logic, "bookmarks" to mark positions on the reading path, and "tags" to establish bidirectional links. You can list all tags and quickly jump to them through the command palette.
</div>
