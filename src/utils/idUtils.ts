/**
 * ID 生成与注释查找工具函数
 *
 * 提取为独立模块，供 CommentCRUD 和 CommentSharing 复用
 */

import * as crypto from 'crypto';
import { LocalComment, SharedComment } from '../managers/commentTypes';

/**
 * 生成唯一注释 ID
 * @returns 格式为 `${timestamp}${random}` 的字符串
 */
export function generateId(): string {
  return `${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * 在注释数组中查找指定 ID 的注释索引
 * @param comments 注释数组
 * @param commentId 注释ID
 * @returns 注释的索引，如果未找到则返回 -1
 */
export function findCommentIndex(
  comments: (LocalComment | SharedComment)[],
  commentId: string
): number {
  return comments.findIndex(c => c.id === commentId);
}
