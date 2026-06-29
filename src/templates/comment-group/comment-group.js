const vscode = acquireVsCodeApi();

const CMD = {
    GET_COMMENT_GROUPS: 'getCommentGroups',
    COMMENT_GROUPS_RESULT: 'commentGroupsResult',
    SELECT_COMMENT_GROUP: 'selectCommentGroup',
    CREATE_COMMENT_GROUP: 'createCommentGroup',
    RENAME_COMMENT_GROUP: 'renameCommentGroup',
    DELETE_COMMENT_GROUP: 'deleteCommentGroup',
    COMMENT_GROUP_ERROR: 'commentGroupError',
};

const currentGroupEl = document.getElementById('current-group');
const groupListEl = document.getElementById('group-list');
const btnCreateEl = document.getElementById('btn-create');
const noWorkspaceEl = document.getElementById('no-workspace');
const mainContentEl = document.getElementById('main-content');
const errorMessageEl = document.getElementById('error-message');

function formatName(fileName) {
    if (!fileName) {
        return '—';
    }
    return fileName.replace(/\.json$/i, '');
}

function hideError() {
    errorMessageEl.style.display = 'none';
    errorMessageEl.textContent = '';
}

function showError(message) {
    errorMessageEl.textContent = message || '操作失败';
    errorMessageEl.style.display = 'block';
}

function renderGroups(data) {
    hideError();

    if (data.noWorkspace) {
        noWorkspaceEl.style.display = 'block';
        mainContentEl.style.display = 'none';
        return;
    }

    noWorkspaceEl.style.display = 'none';
    mainContentEl.style.display = 'flex';

    const groups = data.groups || [];
    const current = data.current || '';

    currentGroupEl.textContent = formatName(current);
    groupListEl.innerHTML = '';

    if (groups.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'group-list-empty';

        const emptyText = document.createElement('p');
        emptyText.textContent = '暂无分组';
        emptyEl.appendChild(emptyText);

        const btnDefault = document.createElement('button');
        btnDefault.className = 'btn-create';
        btnDefault.type = 'button';
        btnDefault.textContent = '创建默认分组';
        btnDefault.addEventListener('click', () => {
            vscode.postMessage({ command: CMD.CREATE_COMMENT_GROUP, fileName: 'comments' });
        });
        emptyEl.appendChild(btnDefault);

        groupListEl.appendChild(emptyEl);
        return;
    }

    groups.forEach((fileName) => {
        const item = document.createElement('div');
        item.className = 'group-item' + (fileName === current ? ' current' : '');

        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-name';
        nameSpan.textContent = formatName(fileName);
        nameSpan.title = '点击切换到此分组并打开管理页';
        nameSpan.addEventListener('click', () => {
            vscode.postMessage({ command: CMD.SELECT_COMMENT_GROUP, fileName });
        });

        const renameBtn = document.createElement('button');
        renameBtn.className = 'btn-icon';
        renameBtn.type = 'button';
        renameBtn.title = '重命名';
        renameBtn.textContent = '✎';
        renameBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            vscode.postMessage({ command: CMD.RENAME_COMMENT_GROUP, fileName });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon';
        deleteBtn.type = 'button';
        deleteBtn.title = '删除';
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            vscode.postMessage({ command: CMD.DELETE_COMMENT_GROUP, fileName });
        });

        item.appendChild(nameSpan);
        item.appendChild(renameBtn);
        item.appendChild(deleteBtn);
        groupListEl.appendChild(item);
    });
}

btnCreateEl.addEventListener('click', () => {
    vscode.postMessage({ command: CMD.CREATE_COMMENT_GROUP });
});

window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case CMD.COMMENT_GROUPS_RESULT:
            renderGroups(message);
            break;
        case CMD.COMMENT_GROUP_ERROR:
            showError(message.message);
            break;
    }
});

vscode.postMessage({ command: CMD.GET_COMMENT_GROUPS });
