# Homepage Redesign — Design Spec

Date: 2026-05-10

## Overview

Redesign the Local Comment website homepage from the current flat/minima-style layout to a modern SaaS-style landing page with a coffee-brown color scheme, improved visual hierarchy, and better content flow.

## Design Direction

**Style**: Modern SaaS — clean, warm, professional
**Color scheme**: Coffee-brown dark theme for Hero, warm light backgrounds for content sections
**Animations**: Moderate — scroll fade-in-up, card hover lift, button hover shadow enhancement

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--hero-dark-1` | `#1A1A2E` | Hero gradient start |
| `--hero-dark-2` | `#3E2723` | Hero gradient mid |
| `--hero-dark-3` | `#5D4037` | Hero gradient end |
| `--coffee-700` | `#4E342E` | Dark coffee text |
| `--coffee-600` | `#5D4037` | Primary coffee |
| `--coffee-500` | `#6D4C41` | SVG icon stroke |
| `--coffee-400` | `#8D6E63` | Gradient buttons start |
| `--coffee-300` | `#A1887F` | Gradient buttons end |
| `--coffee-200` | `#BCAAA4` | Light text on dark |
| `--coffee-100` | `#D7CCC8` | Muted text on dark |
| `--coffee-50` | `#EFEBE9` | Bright text on dark |
| `--bg-warm` | `#FAF8F6` | Section background (Features, Quick Start) |
| `--text-dark` | `#3E2723` | Headings on light |
| `--text-body` | `#795548` | Body text on light |

## Page Sections (in order)

### 1. Hero Section

- **Background**: `linear-gradient(160deg, #1A1A2E 0%, #3E2723 50%, #5D4037 100%)`
- **Overlay**: CSS grid pattern (`repeating-linear-gradient`) at 2% opacity for texture
- **Radial glows**: `rgba(141, 110, 99, 0.15)` radial gradient circles for depth
- **Pill badge**: "VS Code Extension · 本地代码注释工具" — `rgba(141,110,99,0.25)` bg, `rgba(188,170,164,0.2)` border, `border-radius: 20px`
- **Title**: "让代码注释" (white) + "留在编辑器里" (gradient text: `#EFEBE9 → #BCAAA4`, `background-clip: text`)
- **Subtitle**: `#BCAAA4`, max-width 560px
- **Primary CTA**: `background: linear-gradient(135deg, #8D6E63, #A1887F)`, white text, `border-radius: 12px`, `box-shadow: 0 6px 24px rgba(141,110,99,0.4)`
- **Secondary CTA**: `border: 1px solid rgba(255,255,255,0.15)`, `#D7CCC8` text, `background: rgba(255,255,255,0.05)`

### 2. Demo Section

- **Background**: `#FFFFFF` (white)
- **Section label**: "DEMOS" pill (`rgba(141,110,99,0.12)` bg, `#8D6E63` text)
- **Section title**: `#3E2723`, 1.6rem, bold
- **Demo cards**: Terminal-window style
  - Dark background `#263238`, `border-radius: 14px`
  - Window control dots (red/yellow/green) in header bar
  - Title text in header: `rgba(255,255,255,0.4)`, monospace
  - Content area: placeholder for GIF screenshots
  - Description footer: `rgba(255,255,255,0.03)` bg, title `rgba(255,255,255,0.9)`, body `rgba(255,255,255,0.5)`
  - Inline code: `rgba(141,110,99,0.3)` bg, `#BCAAA4` text
  - `box-shadow: 0 8px 32px rgba(0,0,0,0.15)`
- **3 demo cards**: 标签跳转, Markdown 注释, 书签导航

### 3. Quick Start Section

- **Background**: `#FAF8F6` (warm off-white)
- **Section label**: "GET STARTED" pill
- **Step circles**: `56px` diameter, `border-radius: 50%`, `background: linear-gradient(135deg, #5D4037, #8D6E63)`, white text, `box-shadow: 0 4px 16px rgba(93,64,55,0.3)`
- **Step titles**: `#3E2723`, 0.95rem, bold
- **Step descriptions**: `#795548`, 0.8rem
- **Kbd style**: `rgba(141,110,99,0.1)` bg, `#5D4037` text, `1px solid rgba(141,110,99,0.2)` border, `border-radius: 4px`
- **CTA button**: `background: linear-gradient(135deg, #5D4037, #8D6E63)`, white text

### 4. Features Section

- **Background**: `#FFFFFF` (white)
- **Section label**: "WHY LOCAL COMMENT" pill
- **Section title**: "为什么选择 Local Comment？", `#3E2723`
- **Layout**: `grid-template-columns: repeat(3, 1fr)`, 2 rows
- **Cards**:
  - `background: #FAF8F6`
  - `border: 1px solid rgba(141,110,99,0.08)`
  - `border-radius: 14px`
  - Center-aligned text
  - Icon container: `40px × 40px`, `background: rgba(141,110,99,0.1)`, `border-radius: 10px`
  - SVG icons: original SVG paths from existing `home.html`, `stroke: #6D4C41`, `stroke-width: 2`
  - Title: `#3E2723`, 1.05rem, bold
  - Description: `#795548`, 0.8rem
  - Inline code: `rgba(141,110,99,0.1)` bg, `#5D4037` text, `border-radius: 3px`
- **Hover**: border brightens + slight translateY(-2px)

## Animations

- **Scroll reveal**: Elements fade-in and slide up (`opacity: 0 → 1`, `translateY(20px) → 0`) when entering viewport via IntersectionObserver
- **Card hover**: `transform: translateY(-2px)`, `box-shadow` increase, border-color brighten
- **Button hover**: shadow enhancement, slight scale
- **Transition durations**: `0.3s ease` for hovers, `0.6s ease` for scroll reveals

## Responsive

- **Desktop** (>1024px): Full layout as designed
- **Tablet** (768-1023px): Features grid → 2 columns, Demo cards full width
- **Mobile** (<768px): Features grid → 1 column, Hero title scales down, step circles smaller

## Files to Modify

| File | Changes |
|------|---------|
| `_layouts/home.html` | Rewrite HTML structure for new section order and styles |
| `_sass/_variables.scss` | Add coffee color variables, update breakpoints if needed |
| `_sass/_home.scss` | Complete rewrite for new layout and styles |
| `assets/js/main.js` | Add IntersectionObserver for scroll animations |
| `_includes/nav.html` | Update nav colors to match coffee theme (optional) |
| `_includes/footer.html` | Update footer colors to match coffee theme (optional) |