import { describe, it, expect } from 'vitest';
import {
  flattenCommentsToRows,
  filterCommentRows,
  sortCommentRows,
  extractTagDeclarations,
  toCommentSummary,
  formatGroupDisplayName,
  normalizeGroupConfigFileName,
  validateNewGroupName,
} from './commentManageUtils';
import { FileComments } from '../managers/commentTypes';

describe('commentManageUtils', () => {
  const sampleComments: FileComments = {
    '/proj/src/a.ts': [
      {
        id: 'c1',
        line: 10,
        content: '说明 @foo 引用',
        timestamp: 2000,
        originalLine: 10,
        lineContent: 'const x = 1;',
      },
      {
        id: 'c2',
        line: 20,
        content: '${todo} 待办事项',
        timestamp: 1000,
        originalLine: 20,
        lineContent: 'const y = 2;',
      },
    ],
    '/proj/src/b.ts': [
      {
        id: 'c3',
        line: 0,
        content: '# 标题',
        timestamp: 3000,
        originalLine: 0,
        lineContent: '',
      },
    ],
  };

  it('flattenCommentsToRows 应跳过共享注释并生成稳定 id', () => {
    const withShared: FileComments = {
      '/proj/x.ts': [
        { id: 'local', line: 1, content: 'a', timestamp: 1, originalLine: 1, lineContent: '' },
        { id: 'shared', line: 2, content: 'b', timestamp: 2, originalLine: 2, lineContent: '', userId: 'u1' },
      ],
    };
    const rows = flattenCommentsToRows(withShared, '/proj');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('local');
    expect(rows[0].filePath).toBe('x.ts');
  });

  it('flattenCommentsToRows 仅给非默认颜色带上 colorHex', () => {
    const colored: FileComments = {
      '/proj/x.ts': [
        { id: 'plain', line: 1, content: 'a', timestamp: 1, originalLine: 1, lineContent: '' },
        { id: 'gray', line: 2, content: 'b', timestamp: 2, originalLine: 2, lineContent: '', color: 'default' },
        { id: 'blue', line: 3, content: 'c', timestamp: 3, originalLine: 3, lineContent: '', color: 'blue' },
        { id: 'red', line: 4, content: 'd', timestamp: 4, originalLine: 4, lineContent: '', color: 'red' },
      ],
    };
    const rows = flattenCommentsToRows(colored, '/proj');
    expect(rows.find((row) => row.id === 'plain')?.colorHex).toBeUndefined();
    expect(rows.find((row) => row.id === 'gray')?.colorHex).toBeUndefined();
    expect(rows.find((row) => row.id === 'blue')?.colorHex).toBe('#3B82F6');
    expect(rows.find((row) => row.id === 'red')?.colorHex).toBe('#EF4444');
  });

  it('extractTagDeclarations 应提取 ${tag} 声明', () => {
    expect(extractTagDeclarations('${bug} 修复问题')).toEqual(['bug']);
    expect(extractTagDeclarations('见 @foo 和 ${bar}')).toEqual(['bar']);
    expect(extractTagDeclarations('见 @foo 和 @bar_baz')).toEqual([]);
    expect(extractTagDeclarations('`${inline}`\n```python\ntemplate = "${block}"\n```')).toEqual([]);
  });

  it('toCommentSummary 应截断并去除 Markdown 标题标记', () => {
    const long = '# '.concat('x'.repeat(200));
    expect(toCommentSummary(long, 50).length).toBeLessThanOrEqual(50);
    expect(toCommentSummary('# Hello', 80)).toBe('Hello');
  });

  it('filterCommentRows 支持 query 与 commentKind', () => {
    const rows = flattenCommentsToRows(sampleComments, '/proj');
    expect(filterCommentRows(rows, { commentKind: 'tag' })).toHaveLength(1);
    expect(filterCommentRows(rows, { commentKind: 'tag' })[0].id).toBe('c2');
    expect(filterCommentRows(rows, { commentKind: 'normal' })).toHaveLength(2);
    const filtered = filterCommentRows(rows, { query: 'todo', commentKind: 'tag' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('c2');
  });

  it('sortCommentRows 默认按文件路径再按行号', () => {
    const rows = flattenCommentsToRows(sampleComments, '/proj');
    const sorted = sortCommentRows(rows, 'filePath', 'asc');
    expect(sorted[0].filePath).toBe('src/a.ts');
    expect(sorted[0].line).toBe(10);
    expect(sorted[1].line).toBe(20);
  });
});


describe('group config file name safety (TD-5)', () => {
  describe('normalizeGroupConfigFileName', () => {
    it('接受合法名干并补全 .json', () => {
      expect(normalizeGroupConfigFileName('team_a')).toBe('team_a.json');
      expect(normalizeGroupConfigFileName('team-a')).toBe('team-a.json');
      expect(normalizeGroupConfigFileName('A1_b-2')).toBe('A1_b-2.json');
    });

    it('接受已带 .json 的合法文件名', () => {
      expect(normalizeGroupConfigFileName('team_a.json')).toBe('team_a.json');
      expect(normalizeGroupConfigFileName('  team_a.JSON  ')).toBe('team_a.json');
    });

    it('拒绝空值与空白', () => {
      expect(normalizeGroupConfigFileName('')).toBeNull();
      expect(normalizeGroupConfigFileName('   ')).toBeNull();
    });

    it('拒绝路径分隔符与穿越', () => {
      expect(normalizeGroupConfigFileName('../evil')).toBeNull();
      expect(normalizeGroupConfigFileName('..\\evil')).toBeNull();
      expect(normalizeGroupConfigFileName('foo/bar')).toBeNull();
      expect(normalizeGroupConfigFileName('foo\\bar')).toBeNull();
      expect(normalizeGroupConfigFileName('/abs/evil.json')).toBeNull();
      expect(normalizeGroupConfigFileName('C:\\tmp\\evil.json')).toBeNull();
    });

    it('拒绝非法字符与非 json 扩展', () => {
      expect(normalizeGroupConfigFileName('has space')).toBeNull();
      expect(normalizeGroupConfigFileName('中文')).toBeNull();
      expect(normalizeGroupConfigFileName('evil.txt')).toBeNull();
      expect(normalizeGroupConfigFileName('evil.json.bak')).toBeNull();
      expect(normalizeGroupConfigFileName('a.b.json')).toBeNull();
    });
  });

  describe('validateNewGroupName', () => {
    const existing = ['alpha.json', 'Beta.json'];

    it('合法新名通过', () => {
      expect(validateNewGroupName('gamma', existing)).toBeNull();
    });

    it('拒绝空、后缀、路径与非法字符', () => {
      expect(validateNewGroupName('', existing)).toBe('文件名不能为空');
      expect(validateNewGroupName('gamma.json', existing)).toBe('请勿输入 .json 后缀');
      expect(validateNewGroupName('../x', existing)).toBe('文件名不能包含路径分隔符');
      expect(validateNewGroupName('bad name', existing)).toBe('文件名只能包含字母、数字、下划线和连字符');
    });

    it('拒绝与现有配置冲突（大小写不敏感）', () => {
      expect(validateNewGroupName('alpha', existing)).toBe('配置文件已存在');
      expect(validateNewGroupName('BETA', existing)).toBe('配置文件已存在');
    });
  });

  describe('formatGroupDisplayName', () => {
    it('去掉 .json 后缀', () => {
      expect(formatGroupDisplayName('team_a.json')).toBe('team_a');
      expect(formatGroupDisplayName('')).toBe('');
    });
  });
});

