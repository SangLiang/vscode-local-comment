---
title: Settings & Reference
permalink: /en/docs/reference/
lang: en
---

# Settings & Reference

## Shortcuts {#shortcuts}

### Local Comments

| Shortcut (Windows/Linux) | Shortcut (macOS) | Action |
|-------------------------|-----------------|--------|
| <kbd>Ctrl+Shift+C</kbd> | <kbd>Cmd+Shift+C</kbd> | Add quick single-line comment |
| <kbd>Ctrl+Shift+M</kbd> | <kbd>Cmd+Shift+M</kbd> | Add/edit Markdown comment |
| <kbd>Ctrl+Shift+E</kbd> | <kbd>Cmd+Shift+E</kbd> | Edit comment on current line |
| <kbd>Ctrl+Shift+D</kbd> | <kbd>Cmd+Shift+D</kbd> | Delete comment on current line |
| <kbd>Ctrl+Shift+T</kbd> | <kbd>Cmd+Shift+T</kbd> | Convert selection to comment |

### Bookmarks

| Shortcut (Windows/Linux) | Shortcut (macOS) | Action |
|-------------------------|-----------------|--------|
| <kbd>Ctrl+Alt+K</kbd> | <kbd>Cmd+Alt+K</kbd> | Toggle bookmark |
| <kbd>Ctrl+Alt+J</kbd> | <kbd>Cmd+Alt+J</kbd> | Next bookmark |
| <kbd>Ctrl+Alt+Shift+J</kbd> | <kbd>Cmd+Alt+Shift+J</kbd> | Previous bookmark |

<div class="callout callout-tip">
<strong>Memory trick:</strong> M stands for Markdown, C stands for Comment, E stands for Edit, D stands for Delete, T stands for Turn (convert). Bookmarks' J/K correspond to VS Code:'s default "previous/next" semantics.
</div>

## Settings {#settings}

In VS Code: settings, search for "local comment" to configure the following options:

| Setting | Description | Default |
|---------|-------------|---------|
| `localComment.storage.commentsFileName` | Current active comment config file name | `comments.json` |
| `localComment.storage.bookmarksFileName` | Current active bookmark config file name | `bookmarks.json` |
| `localComment.markdownPreview.fontSize` | Markdown preview font size | Follows editor |
| `localComment.codeHighlight.theme` | Code highlighting theme | `github` |
| `localComment.mermaid.theme` | Mermaid diagram theme | `default` |
| `localComment.showGutterIcon` | Whether to show comment gutter icon | `true` |
| `localComment.showCodeLens` | Whether to show CodeLens action buttons | `true` |

<div class="callout callout-tip">
<strong>Advanced configuration:</strong> You can configure these options per project through <code>.vscode/settings.json</code>, achieving "project-level" customization of comment behavior.
</div>

## FAQ {#faq}

**Q: Do comments go into Git?**
A: By default, data is stored locally and not written into source files. If you use `.vscode/local-comment/`, whether it is committed depends on whether you add that directory to version control.

**Q: Will I lose comments when switching Git branches?**
A: No. Comment data is independent of Git branches; switching branches will not clear it. However, code changes may cause comment position misalignment, so it is recommended to anchor on stable code lines.

**Q: How do I back up?**
A: Use the "Export" function from the command palette, or directly back up the `.vscode/local-comment/` folder.

**Q: Can others see my comments?**
A: Not by default; data stays completely local. Multi-user collaboration features require additional configuration (not publicly available at this time).

**Q: What if comments don't match the code anymore?**
A: Local Comment will attempt smart matching. If matching fails, the comment will display as "not found", and you can manually re-anchor or edit the comment content.

## Troubleshooting {#troubleshooting}

### Issue: Cannot add comments

1. Confirm the extension is correctly installed and enabled
2. Check if the current file belongs to an opened workspace folder (comments are isolated by project)
3. Check the Local Comment log information in the VS Code: Output panel

### Issue: Comment positions are misaligned

1. Confirm comments are anchored on "meaningful code lines" (function declarations, variable definitions, etc.)
2. Avoid anchoring on empty lines or lines with only punctuation
3. After large-scale refactoring, some comments may need manual re-location

### Issue: Markdown preview does not show Mermaid/LaTeX

1. Confirm the fenced code block correctly specifies the `mermaid` language
2. LaTeX formulas need to be wrapped with `$$` (block-level) or `$` (inline)
3. Check if `localComment.mermaid.theme` is configured correctly in settings

### Issue: Sidebar does not show comment list

1. Confirm the currently opened file belongs to an opened workspace
2. Check if JSON data files exist under `.vscode/local-comment/comments/`
3. Try switching the comment config file (Command Palette → "Switch Comments Config")

## Best Practices {#best-practices}

1. **Anchor on stable lines:** Prioritize binding comments to meaningful code lines such as function declarations and class definitions
2. **Regular backups:** Use the export function or back up the `.vscode/local-comment/` directory
3. **Make good use of tags:** Establish tag links for cross-file related logic to improve code readability
4. **Group management:** Use multiple comment config groups to isolate comments for different scenarios (development, review, learning)
5. **Combine with bookmarks:** Comments record "why", bookmarks mark "where"—use both together for best results
