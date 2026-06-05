---
title: Tag System
permalink: /en/docs/tags/
lang: en
---

# Tag System

The tag system allows you to declare named anchors in comments and reference them in other comments, enabling bidirectional jumps.

## Declare Tags {#declare}

Declare a tag using <code>${tagName}</code> in a comment:

```javascript
function loadConfig() {
  // local comment: ${configLoader} configuration loading entry
}
```

Naming rules:
- Must start with a letter or underscore
- Can contain letters (any script), numbers, underscores
- Mixed scripts allowed, such as <code>${bugFix}</code>

## Reference Tags {#reference}

Reference a declared tag using <code>@tagName</code>:

```javascript
function saveConfig() {
  // local comment: reuse logic from @configLoader
}
```

Clicking <code>@configLoader</code> will automatically jump to the comment location where that tag was declared.

## Chinese Tags {#chinese}

Local Comment fully supports Chinese tags:

```javascript
function handleError() {
  // local comment: ${错误处理} core error handling logic
}

function validate() {
  // local comment: on failure call @错误处理
}
```

<div class="callout callout-tip">
<strong>Advanced scenario:</strong> Chinese tags are especially useful in pure Chinese codebases or teams, reducing the mental burden of tag naming.
</div>

## Tag Navigation {#navigate}

In addition to clicking <code>@tagName</code> references in comments to jump, you can also quickly locate any declared tag through the command palette:

- **Command Palette:** Press <kbd>F1</kbd>, search for "Local Comment: Show All Files Tags"
- It will list all declared tags in the current project; select one to jump to the corresponding location
- Supports keyword filtering, making it easy to quickly locate target tags among a large number of tags

## Using Tags in Markdown Files {#markdown-tags}

**New in v2.0**: You can now use tag references in any `.md` file to link documents to code:

**Insert tag reference**:
1. Right-click in a Markdown file and select "Insert tag reference"
2. Select a tag from the list (shows all declared tags in the project)

> Note: **Typing `@` does not trigger auto-completion in `.md` files** — this feature is only available in the Local Comment Markdown editor.

**Click to jump**:
- When previewing Markdown (right-click "Preview Markdown"), all `@tagName` are displayed with special styling
- **Click to jump directly to the tag definition in code** — documents and code seamlessly connected

```markdown
## Configuration Loading Flow

On startup, the system loads @userConfig, see source code for implementation.

Related features: @errorHandling @permissionCheck
```

<div class="callout callout-tip">
<strong>Knowledge management scenario:</strong> Write architecture docs referencing key code implementations with <code>@</code>; take notes while reading source, then jump back to code with one click.
</div>

## Tag Relation Graph {#graph}

**New in v2.0**: Visualize all tag reference relationships in your project:

- **Open**: Run `Local Comment: Show Tag Relation Graph` from the Command Palette
- **Interactive**: Supports zoom, drag to pan, click nodes to view tag details
- **Knowledge network**: Organize project knowledge like Obsidian, but **with the ability to jump directly into code implementations**

<div class="callout callout-tip">
<strong>Use cases:</strong> When onboarding to a large codebase, use the relation graph to quickly understand core module dependencies; when writing technical specs, verify all related features are covered.
</div>

## Autocomplete {#autocomplete}

When typing <code>@</code> in the Markdown editor, a dropdown list of declared tags will appear, supporting fuzzy search.

<div class="callout callout-tip">
<strong>Usage tip:</strong> In large documents in the Markdown editor, press <kbd>@</kbd> and type a few characters to quickly filter to the target tag.
</div>
