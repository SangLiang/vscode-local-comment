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

- **Command Palette:** Press <kbd>F1</kbd>, search for "Local Comment: Go to Tag"
- It will list all declared tags in the current project; select one to jump to the corresponding location
- Supports keyword filtering, making it easy to quickly locate target tags among a large number of tags

## Autocomplete {#autocomplete}

When typing <code>@</code> in the Markdown editor, a dropdown list of declared tags will appear, supporting fuzzy search.

<div class="callout callout-tip">
<strong>Usage tip:</strong> In large documents in the Markdown editor, press <kbd>@</kbd> and type a few characters to quickly filter to the target tag.
</div>
