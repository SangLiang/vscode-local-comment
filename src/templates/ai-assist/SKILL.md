---
name: local-comment-ai-write
description: >-
  将 AI 生成的代码注释写入 Local Comment 本地注释文件（.vscode/local-comment/），
  每次自动创建新的注释分组，禁止修改已有分组。适用于用户要求注释整个文件、
  生成说明文档、归档 AI 知识点，或明确提到「本地注释」「Local Comment」「不要写进源码」时使用。
---

# Local Comment AI 写入指南

## 核心原则

1. **禁止**在源码中添加 `//`、`/* */`、`#` 等行内/块注释（除非用户明确要求写进源码）。
2. **每次必须新建独立注释分组**，禁止读取、修改、合并、覆盖 `.vscode/local-comment/comments/` 下任何已存在的 JSON 分组文件。
3. AI 注释只写入本次新建的空白分组文件。
4. 完成后提示用户在 Activity Bar **注释分组**侧栏点击 **↻ 刷新**，再切换新分组即可；无需 Reload Window。

## 分组隔离（最重要）

```
绝对禁止：
- 修改 comments.json、work.json 等已有分组
- 向已有分组追加/合并/替换注释
- 删除或清空已有分组内的任何条目

必须执行：
- 列出 .vscode/local-comment/comments/*.json 已有文件名
- 新建一个不与已有文件重名的分组
- 仅向新分组写入本次生成的注释
```

### 新分组命名

格式：`ai-<YYYYMMDD>-<HHmm>-<简述>.json`

- 示例：`ai-20260701-1430-extension-container.json`
- 简述取自目标文件名或任务关键词，小写、连字符分隔
- 若重名，追加 `-2`、`-3` 等后缀

### 新分组初始内容

```json
{
  "comments": {},
  "shareComments": {}
}
```

## 确定目标文件

1. 工作区根目录 = 第一个 workspace folder
2. 列出 `.vscode/local-comment/comments/` 下已有 `*.json`（只读，用于避重）
3. 按命名规则生成新分组文件名
4. 创建新分组文件（空白结构），写入路径：`.vscode/local-comment/comments/<新分组名>`
5. 可选：在 `.vscode/settings.json` **仅**更新 `"local-comment.storage.commentsConfig": "<新分组名>"`，以便 Reload 后自动切换到新分组

### 更新 settings.json（可选）

若需写入 `commentsConfig`，必须遵守：

**允许修改：**

- 仅 `local-comment.storage.commentsConfig` 这一个字段的值

**禁止：**

- 修改、删除、重排 settings.json 中的其他任何字段（如 `local-comment.storage.bookmarksConfig`、`editor.*` 等）
- 用整文件覆盖的方式重写 settings.json

操作方式：先读取现有 `.vscode/settings.json`，再用**定点替换**只改 `commentsConfig` 的值；若该键不存在则追加，其余键原样保留。

## 单条注释数据结构

每条本地注释必填字段：

| 字段 | 说明 |
|------|------|
| `id` | 唯一 ID，格式 `${Date.now().toString(36)}` + 16 位随机 hex |
| `line` | 0-based 行号（与 VS Code 一致） |
| `content` | 注释正文，支持 Markdown |
| `timestamp` | `Date.now()` 毫秒时间戳 |
| `originalLine` | 与 `line` 相同 |
| `lineContent` | 该行源码 trim 后的文本，用于代码变动后智能定位 |
| `isShared` | 固定 `false` |

示例：

```json
{
  "id": "m5x2k9abc123def4567890",
  "line": 42,
  "content": "初始化扩展容器，按依赖顺序创建各 Manager。",
  "timestamp": 1719792000000,
  "originalLine": 42,
  "lineContent": "constructor(context: vscode.ExtensionContext) {",
  "isShared": false
}
```

## 文件路径键

`comments` 对象的 key 必须是**绝对路径**：

- Windows: `D:/work/project/src/foo.ts`（推荐正斜杠）
- 从当前打开文件或 workspace 根目录解析，不要用相对路径

## 写入流程

1. 读取目标源码，确定需要注释的行与内容
2. 列出已有分组文件名（只读，禁止打开/修改）
3. 创建新空白分组 JSON
4. 向新分组写入本次注释（见下方规则）
5. 可选：仅更新 settings.json 中的 `local-comment.storage.commentsConfig`
6. 告知用户新分组名、切换方式

### 新分组内写入规则

仅在本轮**新建的空分组**内操作：

- 同一 `filePath` 不同行 → 追加
- 同一 `filePath` 同行重复生成 → 保留一条（取最新）
- `shareComments` 保持 `{}`
- 同一文件内注释按 `line` 升序排列

## 注释粒度建议

| 场景 | 建议 |
|------|------|
| 整文件概览 | 文件顶部（第 0 行或首个非空行）写一条总述 |
| 函数/类 | 挂在定义行 |
| 复杂逻辑块 | 挂在块起始行 |
| 不宜过多 | 避免每行都注释，聚焦公共 API、非 obvious 逻辑、架构要点 |

## 备选：导入格式（临时文件）

若用户要求手动确认后再导入：

1. 仍须先**创建新空白分组**（同上命名规则）
2. 将导入格式 JSON 存到临时路径（如 `.vscode/local-comment/import-draft.json`）
3. 提示用户：先 **Switch Comments Config** 切换到新分组，再 **Import Comments Data**，选择 **替换** 模式（因新分组为空）
4. **禁止**对已有分组执行合并导入

导入格式（与存储格式不同，需包含 `version`、`projectInfo`、`metadata`）：

```json
{
  "version": "1.0.0",
  "exportTime": "2026-07-01T12:00:00.000Z",
  "projectInfo": {
    "name": "my-app",
    "path": "D:/work/my-app"
  },
  "comments": {
    "D:/work/my-app/src/core/ExtensionContainer.ts": [
      {
        "id": "m5x2k9a1b2c3d4e5f6789012",
        "line": 25,
        "content": "按依赖顺序初始化各 Manager。",
        "timestamp": 1719792000000,
        "originalLine": 25,
        "lineContent": "constructor(context: vscode.ExtensionContext) {"
      }
    ]
  },
  "metadata": {
    "totalFiles": 1,
    "totalComments": 1
  }
}
```

导入后扩展会自动刷新，无需 Reload Window。

## 完整新分组示例

路径：`.vscode/local-comment/comments/ai-20260701-1430-extension-container.json`

```json
{
  "comments": {
    "D:/work/my-app/src/core/ExtensionContainer.ts": [
      {
        "id": "m5x2k9a1b2c3d4e5f6789012",
        "line": 0,
        "content": "扩展容器：统一管理 CommentManager、BookmarkManager 等单例，负责 dispose 顺序。",
        "timestamp": 1719792000000,
        "originalLine": 0,
        "lineContent": "import * as vscode from 'vscode';",
        "isShared": false
      },
      {
        "id": "m5x2k9b2c3d4e5f6789012345",
        "line": 25,
        "content": "按依赖顺序初始化；CommentManager 需最先创建，Provider 依赖它。",
        "timestamp": 1719792001000,
        "originalLine": 25,
        "lineContent": "constructor(context: vscode.ExtensionContext) {",
        "isShared": false
      }
    ]
  },
  "shareComments": {}
}
```

## 用户提示词示例

```
请用 Local Comment 本地注释 skill，为 src/core/ExtensionContainer.ts 生成注释，
新建独立分组，不要修改已有分组，不要写进源码。
```

```
帮我把这个文件的 AI 注释归档到新的本地注释分组里。
```

## 禁止事项

- **禁止修改任何已有注释分组文件**（最高优先级）
- 更新 `.vscode/settings.json` 时**只允许改** `local-comment.storage.commentsConfig`，不得动其他字段
- 不要猜测 `lineContent`，必须从源码文件读取对应行
- 不要用 Import 合并模式写入已有分组

## 完成提示模板

```
已创建新注释分组 ai-20260701-1430-xxx.json，写入 N 条本地注释（文件：xxx.ts）。
原有分组未被修改。

请在 Activity Bar「注释分组」侧栏点击 ↻ 刷新，看到新分组后点击切换或「应用」。
源码文件未被修改。
```
