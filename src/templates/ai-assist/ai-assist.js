(function () {
    const vscode = acquireVsCodeApi();

    const IPC = {
        GET_AI_ASSIST_CONTENT: 'getAiAssistContent',
        AI_ASSIST_CONTENT_RESULT: 'aiAssistContentResult',
        COPY_AI_PROMPT: 'copyAiPrompt',
        OPEN_AI_SKILL_FILE: 'openAiSkillFile',
        INSTALL_AI_SKILL: 'installAiSkill',
    };

    const promptCardEl = document.getElementById('prompt-card');
    const btnOpenSkill = document.getElementById('btn-open-skill');
    const btnInstallSkill = document.getElementById('btn-install-skill');
    const skillStatusEl = document.getElementById('skill-status');

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderSkillStatus(data) {
        if (!skillStatusEl || !btnInstallSkill) {
            return;
        }
        btnInstallSkill.textContent = data.skillSaved ? '重新另存…' : '另存 Skill 文件…';
        if (data.skillSaved) {
            skillStatusEl.className = 'skill-status installed';
            skillStatusEl.innerHTML =
                '已保存：<code>' + escapeHtml(data.skillDisplayPath || '') + '</code>';
        } else {
            skillStatusEl.className = 'skill-status missing';
            skillStatusEl.textContent = '尚未另存；可点击「阅读 Skill」查看规则，或另存到自选路径供 AI 引用。';
        }
    }

    function renderPrompt(prompt) {
        if (!promptCardEl || !prompt) {
            return;
        }
        promptCardEl.innerHTML = '';

        const pre = document.createElement('pre');
        pre.className = 'prompt-text';
        pre.textContent = prompt.text;

        const btn = document.createElement('button');
        btn.className = 'btn-copy';
        btn.type = 'button';
        btn.textContent = '复制提示词';
        btn.addEventListener('click', () => {
            vscode.postMessage({ command: IPC.COPY_AI_PROMPT, text: prompt.text });
            btn.textContent = '已复制';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = '复制提示词';
                btn.classList.remove('copied');
            }, 1500);
        });

        promptCardEl.appendChild(pre);
        promptCardEl.appendChild(btn);
    }

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || !message.command) {
            return;
        }
        if (message.command === IPC.AI_ASSIST_CONTENT_RESULT) {
            renderSkillStatus(message);
            renderPrompt(message.prompt);
        }
    });

    btnOpenSkill?.addEventListener('click', () => {
        vscode.postMessage({ command: IPC.OPEN_AI_SKILL_FILE });
    });

    btnInstallSkill?.addEventListener('click', () => {
        vscode.postMessage({ command: IPC.INSTALL_AI_SKILL });
    });

    vscode.postMessage({ command: IPC.GET_AI_ASSIST_CONTENT });
})();
