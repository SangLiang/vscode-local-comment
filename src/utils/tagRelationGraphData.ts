import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CommentManager } from '../managers/commentManager';
import { TagManager } from '../managers/tagManager';
import { extractTagsFromMarkdown } from './tagParser';

export interface GraphNode {
    id: string;
    label: string;
    type: 'center' | 'tag';
    filePath: string;
    line?: number;
    color: string;
    hasChildren: boolean;
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
}

export interface BreadcrumbItem {
    id: string;
    label: string;
    filePath: string;
    line?: number;
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    level: number;
    centerNode: {
        id: string;
        filePath: string;
        label: string;
    };
    breadcrumb: BreadcrumbItem[];
}

const FILE_COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#00BCD4', '#FF9800', '#795548'];

export function tagNameFromCenterLabel(centerLabel: string): string {
    const firstLine = centerLabel.split('\n')[0] ?? centerLabel;
    return firstLine.replace(/^@/, '');
}

export function checkHasChildren(content: string): boolean {
    return extractTagsFromMarkdown(content).some(tag => tag.type === 'reference');
}

export function extractTagReferences(content: string): string[] {
    const references = extractTagsFromMarkdown(content)
        .filter(tag => tag.type === 'reference')
        .map(tag => tag.tagName);
    return [...new Set(references)];
}

function collectLevelZeroReferences(
    commentManager: CommentManager,
    centerFilePath: string,
    centerContent: string | undefined
): string[] {
    if (centerContent !== undefined) {
        return extractTagReferences(centerContent);
    }

    const references: string[] = [];
    if (centerFilePath.toLowerCase().endsWith('.md') && fs.existsSync(centerFilePath)) {
        try {
            references.push(...extractTagReferences(fs.readFileSync(centerFilePath, 'utf8')));
        } catch {
            // 忽略读失败
        }
    }
    const comments = commentManager.getComments(vscode.Uri.file(centerFilePath));
    for (const item of comments) {
        references.push(...extractTagReferences(item.content));
    }
    return [...new Set(references)];
}

export function buildTagRelationGraphData(options: {
    commentManager: CommentManager;
    tagManager: TagManager;
    centerFilePath: string;
    centerLabel: string;
    centerContent?: string;
    level: number;
    breadcrumb: BreadcrumbItem[];
}): GraphData {
    const { commentManager, tagManager, centerFilePath, centerLabel, centerContent, level, breadcrumb } = options;

    let references: string[] = [];
    if (level === 0) {
        references = collectLevelZeroReferences(commentManager, centerFilePath, centerContent);
    } else {
        const declaration = tagManager.getTagDeclaration(tagNameFromCenterLabel(centerLabel));
        if (declaration) {
            references = extractTagReferences(declaration.content);
        }
    }

    const centerNode: GraphNode = {
        id: 'center',
        label: centerLabel,
        type: 'center',
        filePath: centerFilePath,
        color: '#4285F4',
        hasChildren: false
    };

    const nodes: GraphNode[] = [centerNode];
    const edges: GraphEdge[] = [];
    const fileColorMap = new Map<string, string>();
    let colorIndex = 0;

    for (let i = 0; i < references.length; i++) {
        const tagName = references[i];
        const declaration = tagManager.getTagDeclaration(tagName);
        if (!declaration) {
            continue;
        }
        const tagFilePath = declaration.filePath;
        if (!fileColorMap.has(tagFilePath)) {
            fileColorMap.set(tagFilePath, FILE_COLORS[colorIndex % FILE_COLORS.length]);
            colorIndex++;
        }
        const nodeId = `tag-${tagName}`;
        nodes.push({
            id: nodeId,
            label: `@${tagName}\n${path.basename(tagFilePath)}:${declaration.line + 1}`,
            type: 'tag',
            filePath: tagFilePath,
            line: declaration.line,
            color: fileColorMap.get(tagFilePath) || '#999',
            hasChildren: checkHasChildren(declaration.content)
        });
        edges.push({
            id: `edge-${centerNode.id}-${nodeId}`,
            source: 'center',
            target: nodeId
        });
    }

    return {
        nodes,
        edges,
        level,
        centerNode: {
            id: 'center',
            filePath: centerFilePath,
            label: centerLabel
        },
        breadcrumb
    };
}

export function buildTagRelationChildNodes(options: {
    commentManager: CommentManager;
    tagManager: TagManager;
    parentId: string;
    centerLabel: string;
    centerFilePath: string;
}): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const data = buildTagRelationGraphData({
        commentManager: options.commentManager,
        tagManager: options.tagManager,
        centerFilePath: options.centerFilePath,
        centerLabel: options.centerLabel,
        level: 1,
        breadcrumb: []
    });
    const nodes = data.nodes.filter(node => node.type === 'tag');
    const edges = data.edges.map(edge => ({
        id: `edge-${options.parentId}-${edge.target}`,
        source: options.parentId,
        target: edge.target
    }));
    return { nodes, edges };
}
