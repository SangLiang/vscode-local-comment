import { describe, it, expect } from 'vitest';
import { generateId, findCommentIndex } from './idUtils';
import { LocalComment, SharedComment } from '../managers/commentTypes';

describe('idUtils', () => {
  describe('generateId', () => {
    it('应该生成唯一ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('生成的ID应该是字符串', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('生成的ID应该包含时间戳和随机部分', () => {
      const id = generateId();
      // 格式: ${timestamp}${randomHex}
      expect(id.length).toBeGreaterThan(10);
    });

    it('连续生成的ID应该不同', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('findCommentIndex', () => {
    const mockComments: LocalComment[] = [
      {
        id: 'comment-1',
        line: 10,
        content: '第一个注释',
        timestamp: Date.now(),
        originalLine: 10,
        lineContent: 'const x = 1;'
      },
      {
        id: 'comment-2',
        line: 20,
        content: '第二个注释',
        timestamp: Date.now(),
        originalLine: 20,
        lineContent: 'const y = 2;'
      },
      {
        id: 'comment-3',
        line: 30,
        content: '第三个注释',
        timestamp: Date.now(),
        originalLine: 30,
        lineContent: 'const z = 3;'
      }
    ];

    it('应该找到存在的注释索引', () => {
      const index = findCommentIndex(mockComments, 'comment-2');
      expect(index).toBe(1);
    });

    it('应该返回-1当注释不存在', () => {
      const index = findCommentIndex(mockComments, 'non-existent');
      expect(index).toBe(-1);
    });

    it('应该处理空数组', () => {
      const index = findCommentIndex([], 'comment-1');
      expect(index).toBe(-1);
    });

    it('应该找到第一个匹配的注释', () => {
      const commentsWithDuplicate = [
        ...mockComments,
        { ...mockComments[0], line: 40 } // 相同ID
      ];
      const index = findCommentIndex(commentsWithDuplicate, 'comment-1');
      expect(index).toBe(0); // 返回第一个匹配
    });

    it('应该处理SharedComment数组', () => {
      const sharedComments: SharedComment[] = [
        {
          ...mockComments[0],
          userId: 'user-1',
          username: 'testuser'
        },
        {
          ...mockComments[1],
          userId: 'user-2',
          username: 'testuser2'
        }
      ];
      const index = findCommentIndex(sharedComments, 'comment-2');
      expect(index).toBe(1);
    });

    it('应该处理混合数组', () => {
      const mixedComments: (LocalComment | SharedComment)[] = [
        mockComments[0],
        {
          ...mockComments[1],
          userId: 'user-1',
          username: 'testuser'
        }
      ];
      const index = findCommentIndex(mixedComments, 'comment-2');
      expect(index).toBe(1);
    });
  });
});
