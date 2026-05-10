---
title: Markdown & Rendering
permalink: /en/docs/markdown/
lang: en
---

# Markdown & Rendering

Local Comment's Markdown editor supports standard Markdown syntax as well as extended features.

## Syntax Reference {#syntax}

### Basic Syntax

| Element | Markdown Syntax |
|---------|-----------------|
| Heading | `# H1` `## H2` `### H3` |
| Bold | `**bold**` |
| Italic | `*italic*` |
| Quote | `> quoted content` |
| Ordered list | `1. First item` |
| Unordered list | `- First item` |
| Code | `` `code` `` |
| Code block | ` ```js\ncode\n``` ` |
| Link | `[title](url)` |
| Image | `![description](url)` |
| Divider | `---` |
| Table | `\| A \| B \|` |

## Mermaid Diagrams {#mermaid}

Use ` ```mermaid ` code blocks to insert flowcharts:

```markdown
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action A]
    B -->|No| D[Action B]
```
```

<div class="callout callout-tip">
<strong>Advanced tip:</strong> In the preview area, you can use <kbd>Ctrl</kbd> + mouse wheel to zoom Mermaid diagrams. Hand-drawn style is supported (can be switched in settings).
</div>

## LaTeX Formulas {#latex}

Use `$$` to wrap LaTeX formulas:

```markdown
$$
E = mc^2
$$
```

Inline formulas use `$...$`:

```markdown
This is an example of an inline formula $a^2 + b^2 = c^2$.
```

## Code Highlighting {#highlight}

Code blocks support syntax highlighting; specify the language in the fenced code block:

```markdown
```javascript
function hello() {
  console.log("Hello");
}
```
```

Supported languages include but are not limited to: javascript, typescript, python, java, cpp, html, css, json, yaml, bash.

## Theme Configuration {#theme}

In VS Code: settings, search for "local comment" to adjust:

- **Markdown preview font size:** Follows editor font size by default
- **Code highlighting theme:** Multiple themes available
- **Mermaid theme:** Default, hand-drawn, and other styles

<div class="callout callout-tip">
<strong>Daily configuration:</strong> If you frequently use Mermaid, it is recommended to try the "hand-drawn" style to make flowcharts look more relaxed.
</div>
