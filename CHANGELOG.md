# Changelog

All notable changes to this project will be documented in this file.

## [1.3.3] - 2026-02-03

### Added
- Allow adjusting the font size of Markdown editor rendering in editor settings; it now defaults to match the code editor font size

### Changed
- Adjusted styles on the Markdown input page: removed the drag-to-resize input area (no longer needed), improved the basic feature hint icons
- Adjusted some styles on the Code Corner login page
- Adjusted some documentation structure

### Friendly reminder
- In the next version, the file save path will be changed. A path like `.vscode/vscode-local-comments/comments/comments.json` will be created under the project. The data read priority for local comments will be: `.vscode/vscode-local-comments/comments/comments.json` > `%APPDATA%/Code/User/globalStorage/vscode-local-comment/projects/`. **Project-local storage path has higher priority than the global storage path.** A data migration option will be provided. **For data safety, please back up and export your data regularly to avoid loss.**

## [1.3.2] - 2026-01-22

### Added
- Syntax highlighting for code blocks in Markdown preview
- Config option to customize the code color theme in Markdown preview

### Changed
- Adjusted Markdown editor layout: reduced margins to free up more content space
- Various internal code structure optimizations

## [1.3.1] - 2025-12-26

### Added
- Support Chinese tags: `${中文标签}`
- Added a tag list in the editor context menu for the current file; click to jump to the selected tag

### Changed
- **Breaking**: Tag declaration format changed from `$tag` to `${tag}` to avoid conflicts with `$latex$` in LaTeX formulas

### Fixed
- Other minor issues

## [1.3.0] - 2025-11-26

### Added

Now you can add LaTeX formulas in local comments!

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/latex_support.png)

- LaTeX formula support in local comments
- Allow outputting logs to the editor Output channel

### Changed
- Rendering performance optimizations

## [1.2.2] - 2025-10-28

### Fixed
- Error when clearing bookmarks for the current file
- When there are no shared comments, users who are not logged in no longer get a prompt

### Removed
- Unused code

## [1.2.1] - 2025-09-03

### Fixed
- Could not save/exit normally when entering Markdown editing via mouse click

### Changed
- Other optimizations

## [1.2.0] - 2025-08-23

### Added

**Multi-user collaboration**

Display other users' (here admin user) comment information in the editor. You can see others' evaluations of code segments like reading WeChat Books:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/other_comment.png)

Distinguish between users' local comment information and online shared information from others:
![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/local_and_online.png)

Manage your shared comments in the web interface:

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/manager.png)

**Note**: The multi-user collaboration version is not currently available for free public use.

- Multi-user collaboration: share local comments to the cloud and pull shared comments back to local
- Mermaid: zoom flowcharts with Ctrl + mouse wheel
- Mermaid: hand-drawn style mode
- Shared comments preview
- Allow users to copy shared comments directly into local comments
- In Markdown editor, click context content to switch comment line numbers

### Fixed
- Some known issues

### Notes
- This version introduced multi-user collaboration, but there is currently no public cloud server for testing.

## [1.1.3] - 2025-08-07

### Added

![image](https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/render_mermaid.png)

- Mermaid flowchart support in Markdown comments

### Fixed
- Some known issues

### Notes
- A preview of upcoming multi-user collaboration features.

## [1.1.2] - 2025-07-24

### Added
- Support Ctrl+S to save while editing Markdown
- Added a command to clear bookmarks across all files

### Fixed
- Icon display issues on Linux
- Some known issues

## [1.1.1] - 2025-07-08

### Changed
- Markdown preview UI: switched to a tabbed layout

### Fixed
- Autocomplete popup position issues for `@` tags in large Markdown documents
- Other issues

## [1.1.0] - 2025-06-29

### Added
- Bookmark feature: Ctrl+Alt+K to toggle, Ctrl+Alt+J to jump to next bookmark
- Show initial snapshot content in the Markdown editor when code cannot be matched

### Fixed
- Some known issues

## [1.0.10] - 2025-06-28

### Added
- Manually match comments to code
- Jump to file from items in the local comment panel

### Changed
- Local comment panel file items are now sorted by usage frequency

### Fixed
- Some known issues

## [1.0.9] - 2025-06-25

### Added
- Markdown editor opens in split view
- More flexible import/export options (by project path or by comment content)

### Changed
- More context hints in the Markdown editor

### Fixed
- Some known issues

## [1.0.8] - 2025-06-14

### Changed
- Stricter matching algorithm to reduce comment/code mismatch after large code changes

### Removed
- Unused commands from the command line panel

### Fixed
- Other issues

## [1.0.7] - 2025-06-04

### Added
- Markdown edit preview
- Multi-language support for operation commands

### Fixed
- Incorrect comment styles in the comment tree after switching branches

## [1.0.6] - 2025-06-02

### Changed
- In the comment tree, local comments that cannot be found now appear in a darker color

## [1.0.5] - 2025-05-31

### Fixed
- Switching Git branches incorrectly triggered comment snapshot updates, causing comment position confusion

## [1.0.4] - 2025-05-31

### Added
- New shortcut: Ctrl+Shift+M to quickly add/modify local comments in Markdown mode

### Fixed
- Cursor focus was lost when returning to the code editor after finishing Markdown editing

## [1.0.3] - 2025-05-31

### Fixed
- Different projects incorrectly shared the same local comment storage file
- Other known issues

## [1.0.2] - 2025-05-30

### Fixed
- Comment position incorrect after switching branches
- Smart completion position incorrect during Markdown editing

## [1.0.1] - 2025-05-30

### Added
- Convert selected text to local comment (right-click selected text)
- Multi-line comment editor with rich editing
- Dual edit modes: quick mode and detailed (Markdown) mode
- Improved tag completion: show dropdown when typing `@`
- Hover action buttons: edit, Markdown edit, delete

### Docs
- Added usage examples for quick marking and writing long comments

## [1.0.0] - 2025-05-29

### Added
- Local comments without modifying original source files
- Tag system: `${tagName}` declaration and `@tagName` reference
- Smart navigation: click tag references to jump to declarations
- Auto-completion for available tags when typing `@`
- Tree view in the sidebar for all comments
- Shortcut to add comments (Ctrl+Shift+C)
- Syntax highlighting for tags in comments
- Cross-file tag reference support

