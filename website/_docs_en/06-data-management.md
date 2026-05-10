---
title: Data Management
permalink: /en/docs/data/
lang: en
---

# Data Management

Local Comment data is stored in project-local or global directories, and you have full control over your data.

## Storage Location {#storage-location}

### Project-Local Storage (Recommended, v1.4.0+)

Data is stored in the current project's `.vscode/local-comment/` directory:

```
.vscode/local-comment/
├── comments/
│   └── comments.json          # Default comment group
├── bookmarks/
│   └── bookmarks.json         # Default bookmark group
```

### Global Storage (Legacy/Compatibility)

| System | Path |
|--------|------|
| Windows | `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/` |
| macOS | `~/Library/Application Support/Code/User/globalStorage/vscode-local-comment/projects/` |
| Linux | `~/.config/Code/User/globalStorage/vscode-local-comment/projects/` |

<div class="callout callout-tip">
<strong>New user recommendation:</strong> For new projects, simply use project-local storage without additional configuration. Legacy data can be transferred to the new project path using the migration command.
</div>

## Local vs Global {#local-vs-global}

| Feature | Project-Local | Global |
|---------|---------------|--------|
| Path | `.vscode/local-comment/` | Under user directory |
| Git tracking | Can optionally join version control | Will not be tracked by Git |
| Collaboration sharing | Easy to share by copying folder | Requires export/import |
| Migration | Copy folder directly | Use migration command |

<div class="callout callout-warning">
<strong>Note:</strong> Project-local storage takes priority over global storage. If both storages exist for the same project, project-local data will be read first.
</div>

## Multiple Groups {#multi-group}

You can create multiple comment and bookmark groups for the same project:

1. Create a new JSON file under `.vscode/local-comment/comments/`, such as `work.json`, `study.json`
2. Open VS Code: settings, search for "local comment"
3. Modify the active comment config file name under "Local Comment: Storage"
4. Or use the command palette (<kbd>F1</kbd>) to run "Local Comment: Switch Comments Config"

<div class="callout callout-tip">
<strong>Usage scenario:</strong> For example, you can create separate comment groups for "feature development" and "code review" without interfering with each other.
</div>

## Import & Export {#import-export}

### Export

1. Press <kbd>F1</kbd> to open the command palette
2. Search for "Local Comment: Export Comment Data"
3. Select export format and path

### Import

1. Press <kbd>F1</kbd> to open the command palette
2. Search for "Local Comment: Import Comment Data"
3. Select a previously exported file

<div class="callout callout-tip">
<strong>Advanced tip:</strong> When using project-local storage, simply copy the `.vscode/local-comment/` folder to another machine or project to complete migration, without using the import/export commands.
</div>

## Migration {#migrate}

Migrate from legacy global storage to new project-local storage:

1. Press <kbd>F1</kbd> to open the command palette
2. Search for "Local Comment: Migrate to Project Local Storage"
3. Confirm migration; old data will be copied to `.vscode/local-comment/`

<div class="callout callout-danger">
<strong>Important:</strong> It is recommended to export a backup before migration. Migration will not delete old global storage data.
</div>

## Backup {#backup}

- **Regular backup:** Export comment data or back up the `.vscode/local-comment/` folder
- **Before switching branches:** Although comment data does not switch with Git branches, code changes may cause comment misalignment. It is recommended to export a backup before large-scale refactoring.
- **Cloud sync:** If using project-local storage and the project itself is under version control, you can choose to add `.vscode/local-comment/` to Git tracking.
