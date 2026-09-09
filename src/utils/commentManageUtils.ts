import * as path from 'path';
import { FileComments, LocalComment } from '../managers/commentTypes';
import { extractTagsFromMarkdown } from './tagParser';
import { colorKeyForStorage, resolveCommentDecorationColor } from './commentDecorationColor';

/**
 * 注释管理表格的一行。
 * 由存储 JSON 展平而来，供 Activity Bar 注释管理 Webview 渲染。
 */
export interface CommentManageRow {
  id: string;
  /** 相对工作区的路径；无法相对化时保留绝对路径 */
  filePath: string;
  /** 0-based 行号；有智能匹配结果时用匹配行，否则用存储行 */
  line: number;
  /** 去掉 Markdown 标记后的短摘要，用于表格展示 */
  summary: string;
  /** 正文中的 `${tag}` 声明名（不含 @引用） */
  tagDeclarations: string[];
  /** ISO 时间；无 timestamp 时缺省 */
  updatedAt?: string;
  content: string;
  lineContent: string;
  /** 非默认装饰色的 hex；默认灰 / 未设色时缺省，表格用主题前景色 */
  colorHex?: string;
}

/** 从注释正文提取 `${tag}` 声明，去重后返回 tag 名 */
export function extractTagDeclarations(content: string): string[] {
  const tags = extractTagsFromMarkdown(content)
    .filter(tag => tag.type === 'declaration')
    .map(tag => tag.tagName);
  return [...new Set(tags)];
}

/** 去掉 Markdown 标记并压成单行摘要，超长截断并加省略号 */
export function toCommentSummary(content: string, maxLength = 120): string {
  const plain = content
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  const ellipsis = '...';
  const sliceLen = Math.max(0, maxLength - ellipsis.length);
  return `${plain.slice(0, sliceLen)}${ellipsis}`;
}

function isLocalComment(comment: LocalComment & { userId?: string }): boolean {
  return !('userId' in comment);
}

/** 能落到工作区内则转成 POSIX 相对路径，否则原样返回 */
function toRelativePath(absPath: string, workspaceRoot?: string): string {
  if (!workspaceRoot) {
    return absPath;
  }
  const rel = path.relative(workspaceRoot, absPath);
  return rel.startsWith('..') ? absPath : rel.replace(/\\/g, '/');
}

/**
 * 把按文件分组的注释展平为表格行。
 * 跳过共享注释；`matchedLineMap` 有条目时用匹配后的行号。
 */
export function flattenCommentsToRows(
  comments: FileComments,
  workspaceRoot?: string,
  matchedLineMap?: Map<string, number>
): CommentManageRow[] {
  const rows: CommentManageRow[] = [];
  for (const [absPath, fileComments] of Object.entries(comments)) {
    for (const comment of fileComments) {
      if (!isLocalComment(comment as LocalComment & { userId?: string })) {
        continue;
      }
      const matchedLine = matchedLineMap?.get(comment.id);
      const colorKey = colorKeyForStorage(comment.color);
      rows.push({
        id: comment.id,
        filePath: toRelativePath(absPath, workspaceRoot),
        line: matchedLine !== undefined ? matchedLine : comment.line,
        summary: toCommentSummary(comment.content),
        tagDeclarations: extractTagDeclarations(comment.content),
        updatedAt: comment.timestamp ? new Date(comment.timestamp).toISOString() : undefined,
        content: comment.content,
        lineContent: comment.lineContent,
        colorHex: colorKey ? resolveCommentDecorationColor(colorKey) : undefined,
      });
    }
  }
  return rows;
}

/** 空串表示不过滤；tag = 含声明；normal = 不含声明 */
export type CommentKindFilter = '' | 'tag' | 'normal';

export interface CommentRowFilter {
  query?: string;
  commentKind?: CommentKindFilter;
  filePath?: string;
}

/** 按关键字、注释种类、文件路径过滤表格行；query 匹配摘要 / 路径 / 正文 */
export function filterCommentRows(rows: CommentManageRow[], filter: CommentRowFilter): CommentManageRow[] {
  const query = filter.query?.trim().toLowerCase();
  const commentKind = filter.commentKind ?? '';
  const filePath = filter.filePath?.trim().toLowerCase();
  return rows.filter((row) => {
    const hasTag = row.tagDeclarations.length > 0;
    if (commentKind === 'tag' && !hasTag) {
      return false;
    }
    if (commentKind === 'normal' && hasTag) {
      return false;
    }
    if (filePath && !row.filePath.toLowerCase().includes(filePath)) {
      return false;
    }
    if (!query) {
      return true;
    }
    return (
      row.summary.toLowerCase().includes(query) ||
      row.filePath.toLowerCase().includes(query) ||
      row.content.toLowerCase().includes(query)
    );
  });
}

export type CommentRowSortKey = 'filePath' | 'line' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

/**
 * 排序表格行。按文件路径时，同文件再按行号；不修改原数组。
 */
export function sortCommentRows(
  rows: CommentManageRow[],
  sortKey: CommentRowSortKey = 'filePath',
  direction: SortDirection = 'asc'
): CommentManageRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortKey === 'line') {
      return (a.line - b.line) * factor;
    }
    if (sortKey === 'updatedAt') {
      const av = a.updatedAt ?? '';
      const bv = b.updatedAt ?? '';
      return av.localeCompare(bv) * factor;
    }
    const fileCmp = a.filePath.localeCompare(b.filePath);
    if (fileCmp !== 0) {
      return fileCmp * factor;
    }
    return (a.line - b.line) * factor;
  });
}
