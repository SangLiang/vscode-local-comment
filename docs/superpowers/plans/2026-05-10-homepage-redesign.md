# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Local Comment website homepage with a modern SaaS coffee-brown theme, deep hero, light content sections, SVG icons, terminal-style demo cards, and scroll animations.

**Architecture:** Modify existing Jekyll site: update SCSS variables, rewrite `_home.scss` entirely, rewrite `_layouts/home.html` HTML structure, add IntersectionObserver animation JS. The site uses Jekyll + Sass pipeline with no build step beyond `jekyll build`.

**Tech Stack:** Jekyll, Sass/SCSS, vanilla JavaScript (no frameworks), existing SVG icons

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `_sass/_variables.scss` | Modify | Add coffee color variables |
| `_sass/_home.scss` | Rewrite | All homepage-specific styles |
| `_sass/_components.scss` | Modify | Update button styles for coffee theme |
| `_layouts/home.html` | Rewrite | New HTML structure (Hero → Demo → Quick Start → Features) |
| `assets/js/main.js` | Modify | Add scroll animation (IntersectionObserver) |

---

### Task 1: Add coffee color variables to `_sass/_variables.scss`

**Files:**
- Modify: `website/_sass/_variables.scss`

- [ ] **Step 1: Add coffee color variables and update brand colors**

Append the coffee color system after the existing color definitions. Add section comments and the new variables. The final `$variables.scss` should have the existing colors plus the new coffee palette:

```scss
// Coffee color system
$coffee-900: #3E2723;
$coffee-800: #4E342E;
$coffee-700: #5D4037;
$coffee-600: #6D4C41;
$coffee-500: #8D6E63;
$coffee-400: #A1887F;
$coffee-300: #BCAAA4;
$coffee-200: #D7CCC8;
$coffee-100: #EFEBE9;
$coffee-50: #FAF8F6;

// Dark backgrounds
$hero-dark-1: #1A1A2E;
$hero-dark-2: #3E2723;
$hero-dark-3: #5D4037;

// Demo terminal background
$terminal-bg: #263238;

// Update brand primary to coffee
$brand-primary: #8D6E63;
```

- [ ] **Step 2: Commit**

```bash
git add website/_sass/_variables.scss
git commit -m "feat: add coffee color system variables for homepage redesign"
```

---

### Task 2: Rewrite `_layouts/home.html` with new section structure

**Files:**
- Rewrite: `website/_layouts/home.html`

- [ ] **Step 1: Write the new home layout HTML**

Replace the entire contents of `_layouts/home.html` with the new structure: Hero → Demos → Quick Start → Features. Use the existing SVG icon paths from the original file. Use Jekyll template tags (`relative_url`) for links.

```html
---
layout: default
---

<div class="home">
  <section class="hero">
    <div class="hero-bg-grid"></div>
    <div class="hero-glow hero-glow-1"></div>
    <div class="hero-glow hero-glow-2"></div>
    <div class="wrapper hero-content">
      <span class="hero-badge">VS Code Extension · 本地代码注释工具</span>
      <h1 class="hero-title">让代码注释<br><span class="hero-gradient-text">留在编辑器里</span></h1>
      <p class="hero-subtitle">不修改源代码，用 Markdown 为任意代码行附加持久注释、标签和书签。<br>Mermaid 图表、LaTeX 公式、代码高亮一站支持。</p>
      <div class="hero-actions">
        <a class="btn btn-coffee-primary" href="https://marketplace.visualstudio.com/items?itemName=SangLiang.local-comment" target="_blank" rel="noopener">安装扩展 →</a>
        <a class="btn btn-coffee-secondary" href="{{ "/docs/" | relative_url }}">查看文档</a>
      </div>
    </div>
  </section>

  <section class="demos">
    <div class="wrapper">
      <span class="section-badge">DEMOS</span>
      <h2 class="section-title section-title--dark">核心功能演示</h2>
      <div class="demo-cards">
        <div class="demo-card">
          <div class="demo-card-header">
            <span class="demo-dot demo-dot--red"></span>
            <span class="demo-dot demo-dot--yellow"></span>
            <span class="demo-dot demo-dot--green"></span>
            <span class="demo-card-title">标签跳转</span>
          </div>
          <div class="demo-card-media">
            <img src="https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/jump.gif" alt="标签跳转演示" loading="lazy">
          </div>
          <div class="demo-card-desc">
            <h3>标签跳转</h3>
            <p>使用 <code>${tagName}</code> 声明标签，<code>@tagName</code> 引用跳转，支持中文标签名。</p>
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-card-header">
            <span class="demo-dot demo-dot--red"></span>
            <span class="demo-dot demo-dot--yellow"></span>
            <span class="demo-dot demo-dot--green"></span>
            <span class="demo-card-title">Markdown 注释</span>
          </div>
          <div class="demo-card-media">
            <img src="https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/markdown.gif" alt="Markdown 注释演示" loading="lazy">
          </div>
          <div class="demo-card-desc">
            <h3>Markdown 注释</h3>
            <p>多行富文本编辑，支持 Mermaid 图表、LaTeX 公式和代码高亮。</p>
          </div>
        </div>
        <div class="demo-card">
          <div class="demo-card-header">
            <span class="demo-dot demo-dot--red"></span>
            <span class="demo-dot demo-dot--yellow"></span>
            <span class="demo-dot demo-dot--green"></span>
            <span class="demo-card-title">书签导航</span>
          </div>
          <div class="demo-card-media">
            <img src="https://raw.githubusercontent.com/SangLiang/vscode-local-commet/refs/heads/master/images/view_panel.png" alt="书签导航演示" loading="lazy">
          </div>
          <div class="demo-card-desc">
            <h3>书签导航</h3>
            <p>跨文件标记阅读路径，通过侧边栏统一管理注释和书签。</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="quick-start">
    <div class="wrapper">
      <span class="section-badge section-badge--warm">GET STARTED</span>
      <h2 class="section-title section-title--dark">30 秒快速开始</h2>
      <div class="steps">
        <div class="step">
          <div class="step-circle">1</div>
          <h3>安装扩展</h3>
          <p>在 VS Code 市场搜索 "Local Comment"</p>
        </div>
        <div class="step">
          <div class="step-circle">2</div>
          <h3>添加注释</h3>
          <p>按 <kbd>Ctrl+Shift+M</kbd> 打开 Markdown 注释编辑器</p>
        </div>
        <div class="step">
          <div class="step-circle">3</div>
          <h3>查看列表</h3>
          <p>打开侧边栏「Local Comments」视图</p>
        </div>
      </div>
      <div class="quick-start-cta">
        <a class="btn btn-coffee-primary" href="{{ "/docs/" | relative_url }}">阅读完整指南 →</a>
      </div>
    </div>
  </section>

  <section class="features">
    <div class="wrapper">
      <span class="section-badge section-badge--warm">WHY LOCAL COMMENT</span>
      <h2 class="section-title section-title--dark">为什么选择 Local Comment？</h2>
      <div class="features-grid">
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </div>
          <h3>本地注释</h3>
          <p>不污染源码的持久笔记，独立于 Git 分支。</p>
        </div>
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <h3>书签导航</h3>
          <p>跨文件标记阅读路径，快速定位关键代码。</p>
        </div>
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          </div>
          <h3>标签跳转</h3>
          <p><code>${声明}</code> 与 <code>@引用</code> 双向链接，支持中文。</p>
        </div>
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="10.5" r="2.5"></circle><circle cx="8.5" cy="7.5" r="2.5"></circle><circle cx="6.5" cy="12.5" r="2.5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.013 17.041 2 12 2z"></path></svg>
          </div>
          <h3>Markdown 渲染</h3>
          <p>支持 Mermaid 图表、LaTeX 公式和语法高亮。</p>
        </div>
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          </div>
          <h3>数据隔离</h3>
          <p>项目级存储，支持多组注释配置自由切换。</p>
        </div>
        <div class="feature-card" data-animate="fade-up">
          <div class="feature-icon-bg">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><path d="M6 8h.001"></path><path d="M10 8h.001"></path><path d="M14 8h.001"></path><path d="M18 8h.001"></path><path d="M8 12h.001"></path><path d="M12 12h.001"></path><path d="M16 12h.001"></path><path d="M7 16h10"></path></svg>
          </div>
          <h3>快捷键驱动</h3>
          <p>全键盘操作，不离开编辑器即可管理注释。</p>
        </div>
      </div>
    </div>
  </section>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add website/_layouts/home.html
git commit -m "feat: rewrite home layout with new section structure (Hero → Demo → QuickStart → Features)"
```

---

### Task 3: Rewrite `_sass/_home.scss` with new styles

**Files:**
- Rewrite: `website/_sass/_home.scss`

- [ ] **Step 1: Write the complete new `_home.scss`**

Replace the entire file with the new styles. This is the largest change — all homepage styles are rewritten.

```scss
// ===== Hero Section =====
.hero {
  position: relative;
  padding: 100px 0 80px;
  background: linear-gradient(160deg, $hero-dark-1 0%, $hero-dark-2 50%, $hero-dark-3 100%);
  text-align: center;
  overflow: hidden;
  color: $coffee-100;
}

.hero-bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(255, 255, 255, 0.02) 19px, rgba(255, 255, 255, 0.02) 20px),
    repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(255, 255, 255, 0.02) 19px, rgba(255, 255, 255, 0.02) 20px);
  pointer-events: none;
}

.hero-glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.hero-glow-1 {
  top: -80px;
  right: -80px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba($coffee-500, 0.15), transparent 70%);
}

.hero-glow-2 {
  bottom: -100px;
  left: -50px;
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba($coffee-300, 0.08), transparent 70%);
}

.hero-content {
  position: relative;
  max-width: 680px;
}

.hero-badge {
  display: inline-block;
  background: rgba($coffee-500, 0.25);
  border: 1px solid rgba($coffee-300, 0.2);
  border-radius: 20px;
  padding: 4px 16px;
  font-size: 0.75rem;
  color: $coffee-200;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

.hero-title {
  font-size: 2.8rem;
  font-weight: 800;
  margin: 0 0 16px;
  line-height: 1.15;
  letter-spacing: -0.5px;
  color: #fff;
}

.hero-gradient-text {
  background: linear-gradient(90deg, $coffee-100, $coffee-300);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.05rem;
  max-width: 560px;
  margin: 0 auto 32px;
  color: $coffee-300;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

// ===== Buttons (coffee theme) =====
.btn-coffee-primary {
  background: linear-gradient(135deg, $coffee-500, $coffee-400);
  color: #fff;
  padding: 14px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  box-shadow: 0 6px 24px rgba($coffee-500, 0.4);
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba($coffee-500, 0.5);
    text-decoration: none;
    color: #fff;
  }
}

.btn-coffee-secondary {
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: $coffee-200;
  padding: 14px 32px;
  border-radius: 12px;
  font-size: 0.95rem;
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
    text-decoration: none;
    color: $coffee-100;
  }
}

// ===== Section Badges =====
.section-badge {
  display: inline-block;
  background: rgba($coffee-500, 0.2);
  border-radius: 4px;
  padding: 3px 12px;
  font-size: 0.7rem;
  color: $coffee-500;
  margin-bottom: 12px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.section-badge--warm {
  background: rgba($coffee-500, 0.12);
  color: $coffee-600;
}

// ===== Section Titles =====
.section-title {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 40px;
}

.section-title--dark {
  color: $coffee-900;
}

.section-title--light {
  color: $coffee-100;
}

// ===== Demo Section =====
.demos {
  padding: 64px 0;
  background: $bg-white;
}

.demo-cards {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.demo-card {
  background: $terminal-bg;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.demo-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.demo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.demo-dot--red { background: #EF5350; }
.demo-dot--yellow { background: #FFC107; }
.demo-dot--green { background: #4CAF50; }

.demo-card-title {
  margin-left: auto;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: $font-family-mono;
}

.demo-card-media {
  padding: 16px;
  text-align: center;
  img {
    max-width: 100%;
    border-radius: 4px;
  }
}

.demo-card-desc {
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  h3 {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.95rem;
    margin: 0 0 4px;
  }
  p {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.5;
    margin: 0;
    code {
      background: rgba($coffee-500, 0.3);
      padding: 1px 5px;
      border-radius: 3px;
      color: $coffee-200;
      font-size: 0.8rem;
    }
  }
}

// ===== Quick Start Section =====
.quick-start {
  padding: 64px 0;
  background: $coffee-50;
}

.steps {
  display: flex;
  gap: 32px;
  justify-content: center;
  margin-bottom: 40px;
}

.step {
  flex: 1;
  max-width: 220px;
  text-align: center;
  h3 {
    color: $coffee-900;
    font-size: 0.95rem;
    margin: 0 0 4px;
  }
  p {
    color: $coffee-600;
    font-size: 0.8rem;
    margin: 0;
  }
}

.step-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, $coffee-700, $coffee-500);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  box-shadow: 0 4px 16px rgba($coffee-700, 0.3);
}

.quick-start {
  kbd {
    background: rgba($coffee-500, 0.1);
    color: $coffee-700;
    border: 1px solid rgba($coffee-500, 0.2);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.75rem;
    font-family: $font-family-mono;
    box-shadow: none;
    border-bottom-color: rgba($coffee-500, 0.2);
  }
}

.quick-start-cta {
  text-align: center;
}

// ===== Features Section =====
.features {
  padding: 64px 0;
  background: $bg-white;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature-card {
  background: $coffee-50;
  border: 1px solid rgba($coffee-500, 0.08);
  border-radius: 14px;
  padding: 28px 20px;
  text-align: center;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba($coffee-700, 0.1);
    border-color: rgba($coffee-500, 0.2);
  }
  .feature-icon-bg {
    width: 40px;
    height: 40px;
    margin: 0 auto 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba($coffee-500, 0.1);
    border-radius: 10px;
    color: $coffee-600;
  }
  h3 {
    font-size: 1.05rem;
    font-weight: 600;
    color: $coffee-900;
    margin: 0 0 6px;
  }
  p {
    font-size: 0.8rem;
    color: $coffee-600;
    line-height: 1.6;
    margin: 0;
    code {
      background: rgba($coffee-500, 0.1);
      color: $coffee-700;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 0.8rem;
    }
  }
}

// ===== Responsive =====
@media screen and (max-width: $bp-desktop - 1px) {
  .hero-title {
    font-size: 2.2rem;
  }
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media screen and (max-width: $bp-tablet - 1px) {
  .hero {
    padding: 60px 0 48px;
  }
  .hero-title {
    font-size: 1.8rem;
  }
  .hero-subtitle {
    font-size: 0.95rem;
  }
  .features-grid {
    grid-template-columns: 1fr;
  }
  .steps {
    flex-direction: column;
    align-items: center;
  }
  .step {
    max-width: 280px;
  }
}

// ===== Scroll Animations =====
[data-animate="fade-up"] {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
  &.animate-visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add website/_sass/_home.scss
git commit -m "feat: rewrite homepage styles with coffee-brown SaaS theme"
```

---

### Task 4: Update button styles in `_components.scss`

**Files:**
- Modify: `website/_sass/_components.scss`

- [ ] **Step 1: Update section-title and remove old step styles**

In `_components.scss`, update the `.section-title` to remove the fixed color (it's now context-dependent via modifiers). Update `.step` to remove the old circle styles since they're now handled by `.step-circle` in `_home.scss`. Change the `.feature-card` styles to minimal since they're now in `_home.scss`. The key changes:

1. `.section-title`: remove `color: $text-primary` (add `color: $text-primary` as default but the home page overrides with modifiers)
2. Remove `.step` styles entirely (now in `_home.scss`)
3. Remove `.feature-card` old styles entirely (now in `_home.scss`)

Find and replace the section-title block:

Old:
```scss
.section-title {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 40px;
  color: $text-primary;
}
```

New:
```scss
.section-title {
  text-align: center;
  font-size: 1.75rem;
  margin-bottom: 40px;
  color: $text-primary;
  &.section-title--dark {
    color: $coffee-900;
  }
  &.section-title--light {
    color: $coffee-100;
  }
}
```

Remove the entire `.step` block (lines 70-94) and the entire `.feature-card` block (lines 43-68).

- [ ] **Step 2: Commit**

```bash
git add website/_sass/_components.scss
git commit -m "feat: update components for coffee theme, remove moved styles"
```

---

### Task 5: Add IntersectionObserver scroll animations to `main.js`

**Files:**
- Modify: `website/assets/js/main.js`

- [ ] **Step 1: Add scroll animation initialization**

Add a new function `initScrollAnimations()` and call it in the `DOMContentLoaded` handler. This will use IntersectionObserver to add the `animate-visible` class to elements with `data-animate="fade-up"` when they enter the viewport.

Append this inside the IIFE, before the `DOMContentLoaded` listener:

```javascript
function initScrollAnimations() {
  var elements = document.querySelectorAll('[data-animate="fade-up"]');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach(function(el) {
      el.classList.add('animate-visible');
    });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: '-80px 0px -60% 0px',
    threshold: 0
  });

  elements.forEach(function(el) {
    observer.observe(el);
  });
}
```

Add `initScrollAnimations();` to the `DOMContentLoaded` handler after `initScrollSpy();`.

- [ ] **Step 2: Commit**

```bash
git add website/assets/js/main.js
git commit -m "feat: add IntersectionObserver scroll animations for homepage"
```

---

### Task 6: Build and verify

- [ ] **Step 1: Build the Jekyll site**

Run: `cd website && bundle exec jekyll build`

Check for any Sass compilation errors. Fix if any appear.

- [ ] **Step 2: Visual verification**

Run `bundle exec jekyll serve` and open in browser to verify:
1. Hero section has dark gradient background with grid texture and glows
2. Demo cards have terminal-window styling
3. Quick Start has warm off-white background and coffee step circles
4. Features grid is 3 columns with icon containers
5. Responsive: features collapse to 2 cols on tablet, 1 col on mobile
6. Scroll animations: feature cards fade in on scroll
7. SVG icons render in coffee color
8. All links work correctly

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: adjust homepage styles after visual verification"
```