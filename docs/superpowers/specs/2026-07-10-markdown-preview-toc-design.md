# Markdown 预览文章目录（TOC）设计

日期：2026-07-10  
状态：已确认

## 背景

Local Comment 的 Markdown 预览（`MarkdownPreviewWebview`）已支持语法渲染、Mermaid、KaTeX、代码高亮、live sync、Ctrl+F 搜索与导出 HTML。长文档缺少目录时，跳转成本高。

目标：在预览中增加可开关的文章目录，第一版保持轻量。

## 目标与非目标

### 目标

- Header 提供「显示目录」开关，默认关闭
- 开启后在预览右侧显示浮动目录面板（叠在正文上，不挤占布局空间）
- 从渲染后的 `h1–h6` 生成目录，按层级缩进
- 点击目录项平滑滚动到对应标题
- 开关状态仅在当前预览 Tab 内记住
- 导出 HTML 不包含目录

### 非目标（第一版不做）

- 滚动时高亮当前章节（scroll spy）
- 写入 VS Code 全局/工作区设置持久化
- 导出 HTML 携带目录
- 目录折叠/展开、拖拽改宽、独立侧栏 TreeView
- 扩展宿主侧（`markdownPreviewWebview.ts`）新增 IPC 或配置项

## 交互设计

1. 在 header `export-actions` 中增加「显示目录」checkbox，样式对齐现有「保留打印背景」。
2. 默认不勾选；勾选后显示右侧浮动目录面板。
3. 面板使用 `position: fixed`，覆盖在预览内容之上，不改变 `.content-area` / `#previewArea` 的布局宽度。
4. 面板内容：
   - 有标题：按 `h1–h6` 层级缩进列表
   - 无标题：显示「暂无标题」
   - 标题文本为空：仍保留条目，文案显示「（空标题）」
5. 点击某项：对对应标题元素执行 `scrollIntoView({ behavior: 'smooth', block: 'start' })`。
6. 取消勾选：隐藏面板；当前 Tab 内再次打开时恢复上次开关状态。
7. 窄屏允许目录挡住正文右侧；用户可随时关闭。

## 架构与数据流

改动集中在预览 Webview 前端，宿主 TypeScript 基本不动。

```
Markdown 渲染完成（含 Mermaid 等异步步骤）
        │
        ▼
 rebuildToc()  ←── live sync / UPDATE_CONTENT 再次渲染后同样调用
        │
        ▼
 扫描 #previewArea 的 h1–h6 → 填充 #previewToc 列表

 checkbox change
        │
        ├─► 显隐 #previewToc
        └─► vscode.setState({ showToc })

 页面加载
        │
        └─► vscode.getState() 恢复 showToc（仅当前 Tab）

 导出 HTML
        │
        └─► 仍只序列化 #previewArea（及既有导出逻辑），不包含 #previewToc
```

### 状态

- `showToc: boolean`，默认 `false`
- 使用 `acquireVsCodeApi().getState()` / `setState()` 在当前 Webview Tab 内持久化
- 关闭 Tab 后状态丢弃；不新增 `package.json` 配置项

### 目录重建时机

- 首次预览渲染完成之后
- 每次内容更新并完成重新渲染之后
- 重建时保留当前 `showToc` 显隐状态，只刷新列表内容

## 文件改动

| 文件 | 改动 |
|------|------|
| `src/templates/markdownPreview/preview.html` | 增加「显示目录」checkbox；增加 `#previewToc` 浮层容器 |
| `src/templates/markdownPreview/preview.css` | 浮层样式：fixed、右侧、最大高度、内部滚动、层级缩进、VS Code 主题色变量 |
| `src/templates/markdownPreview/preview.js` | 开关逻辑、`rebuildToc()`、点击跳转、`setState`/`getState` |

不改：

- `src/modules/markdownPreviewWebview.ts`（除非导出路径误包含目录，需回归确认）
- `package.json` 配置贡献点
- 导出 HTML 组装逻辑（刻意排除 TOC）

## 样式要点

- `#previewToc`：`position: fixed`，贴视口右侧；垂直位置在 header 下方，避免挡住「显示目录」等按钮；`z-index` 高于正文。Ctrl+F 查找栏在内容区顶部 sticky，二者可能重叠时以查找栏可点为准（TOC 可略低于查找栏区域）
- 背景使用 `var(--vscode-editorWidget-background)`，边框 `var(--vscode-editorWidget-border)`
- 列表项可点击，hover 使用 toolbar/list hover 类变量
- `max-height` + `overflow-y: auto`，避免长目录撑满屏幕
- 正文区域不加 `padding-right` 为目录让位（明确：浮动、不开辟空间）

## 边界与错误处理

| 场景 | 行为 |
|------|------|
| 无标题 | 浮层显示「暂无标题」 |
| 标题为空 | 显示「（空标题）」 |
| live sync 频繁刷新 | 每次渲染结束后重建目录；不引入 scroll spy 监听 |
| 导出 | TOC 不在导出 DOM 中 |
| F5 / 扩展重载后新开预览 | 新 Tab 默认关闭目录 |

## 测试建议

- 手动：有多级标题的 md → 打开预览 → 勾选「显示目录」→ 点击跳转正确
- 手动：无标题文档 → 显示「暂无标题」
- 手动：关闭再打开同一预览 Tab 内开关状态保持；关掉 Tab 重开后默认关闭
- 手动：编辑源文件触发 live sync 后目录条目更新
- 手动：导出 HTML，打开结果确认无目录面板
- 手动：窄预览宽度下浮层叠在正文上，不把正文挤窄

## 实现备注

- 优先给标题确保可定位：若现有 heading 无稳定 id，重建目录时可给每个 heading 写入临时 `id` 或直接保存元素引用（同文档内点击跳转用元素引用即可，不必依赖 hash）
- `rebuildToc` 应挂在现有「渲染完成」路径末尾，避免 Mermaid 异步替换导致标题列表时机不对（标题本身通常不依赖 Mermaid，但统一放在最终 DOM 稳定后更安全）
