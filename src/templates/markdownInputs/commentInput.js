(function() {
    const vscode = acquireVsCodeApi();
    const textarea = document.getElementById('contentInput');
    const previewArea = document.getElementById('previewArea');
    let previewVisible = false;
    
    // Tab切换功能
    let currentTab = 'code-tab';
    
    // 状态管理：恢复之前保存的状态
    const previousState = vscode.getState();
    if (previousState) {
        if (previousState.content && previousState.content !== textarea.value) {
            textarea.value = previousState.content;
        }
        if (previousState.previewVisible) {
            previewVisible = previousState.previewVisible;
            // 如果之前在预览状态，恢复到预览tab
            if (previewVisible) {
                currentTab = 'preview-tab';
            }
        }
        if (previousState.currentTab) {
            currentTab = previousState.currentTab;
        }
        if (previousState.cursorPosition !== undefined) {
            textarea.setSelectionRange(previousState.cursorPosition, previousState.cursorPosition);
        }
    }
    
    // 保存状态的函数
    function saveState() {
        vscode.setState({
            content: textarea.value,
            previewVisible: previewVisible,
            currentTab: currentTab,
            cursorPosition: textarea.selectionStart
        });
    }
    
    // 初始化marked
    let markedInitialized = false;
    
    function initializeMarked() {
        if (typeof marked !== 'undefined' && !markedInitialized) {
            marked.setOptions({
                breaks: true,
                gfm: true,
                sanitize: false
            });
            markedInitialized = true;
            return true;
        }
        return false;
    }

    // 等待marked库加载完成
    function waitForMarked() {
        return new Promise((resolve) => {
            const checkMarked = () => {
                if (initializeMarked()) {
                    resolve();
                } else {
                    setTimeout(checkMarked, 100);
                }
            };
            checkMarked();
        });
    }

    // 更新预览内容
    async function updatePreview(content) {
        try {
            if (!content) {
                previewArea.innerHTML = '<p>没有内容可预览</p>';
                return;
            }
            
            // 将@标签转换为高亮样式
            const highlightedContent = content.replace(/@([a-zA-Z0-9_]+)/g, '<span style="color: var(--vscode-symbolIcon-functionForeground); font-weight: bold;">@$1</span>');
            
            // 确保marked已经加载并初始化
            if (!markedInitialized) {
                await waitForMarked();
            }
            
            if (typeof marked === 'undefined') {
                console.error('marked库未加载');
                previewArea.innerHTML = '<p>正在加载预览功能...</p>';
                return;
            }
            
            // 转换Markdown为HTML
            const htmlContent = marked.parse(highlightedContent);
            previewArea.innerHTML = htmlContent || '<p>没有内容可预览</p>';
        } catch (error) {
            console.error('预览更新失败:', error);
            previewArea.innerHTML = '<p>预览生成失败，请重试</p>';
        }
    }

    // Tab切换功能
    function initTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.getAttribute('data-tab');
                switchTab(targetTab);
            });
        });
    }
    
    function switchTab(targetTab) {
        // 更新按钮状态
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-tab') === targetTab) {
                btn.classList.add('active');
            }
        });
        
        // 更新内容显示
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === targetTab) {
                content.classList.add('active');
            }
        });
        
        // 如果切换到预览tab，自动更新预览内容
        if (targetTab === 'preview-tab') {
            const content = textarea.value;
            updatePreview(content);
            previewVisible = true;
        }
        
        currentTab = targetTab;
        saveState();
    }
    
    // 标签自动补全 - 支持动态更新
    let tagSuggestions = window.tagSuggestions || '';
    let tagList = tagSuggestions.split(',').filter(tag => tag.length > 0);
    
    // 监听来自extension的数据更新
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateTagSuggestions') {
            tagSuggestions = message.tagSuggestions || '';
            tagList = tagSuggestions.split(',').filter(tag => tag.length > 0);
            console.log('标签建议已更新:', tagList.length + ' 个标签');
        } else if (message.command === 'updateCodeContext') {
            // 异步更新代码上下文
            updateCodeContext(message.contextLines, message.contextStartLine, message.lineNumber);
        }
    });
    
    // 更新代码上下文显示
    function updateCodeContext(contextLines, contextStartLine, lineNumber) {
        const codeTab = document.getElementById('code-tab');
        if (!codeTab || !contextLines || contextLines.length === 0) return;
        
        // 查找或创建代码上下文区域
        let contextItem = codeTab.querySelector('.context-item:has(.code-context-preview)');
        if (!contextItem) {
            // 创建新的上下文区域
            const contextHtml = `
                <div class="context-item">
                    <span class="context-label">代码上下文:</span>
                    <div class="context-value">
                        <div class="code-context-preview"></div>
                    </div>
                </div>
            `;
            codeTab.insertAdjacentHTML('beforeend', contextHtml);
            contextItem = codeTab.querySelector('.context-item:last-child');
        }
        
        const previewContainer = contextItem.querySelector('.code-context-preview');
        if (previewContainer) {
            let contextHtml = '';
            contextLines.forEach((line, index) => {
                const currentLineNumber = (contextStartLine || 0) + index;
                const isTargetLine = currentLineNumber === lineNumber;
                const lineClass = isTargetLine ? 'target-line' : 'context-line';
                const lineNumberDisplay = currentLineNumber + 1;
                
                const escapedLine = line
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                
                contextHtml += `
                    <div class="code-line ${lineClass}">
                        <span class="line-number">${lineNumberDisplay}</span>
                        <span class="line-content">${escapedLine}</span>
                    </div>
                `;
            });
            
            previewContainer.innerHTML = contextHtml;
            console.log('代码上下文已更新:', contextLines.length + ' 行');
        }
    }
    
    // 全局函数定义
    window.save = function() {
        const content = textarea.value;
        vscode.postMessage({
            command: 'save',
            content: content
        });
    };
    
    window.cancel = function() {
        vscode.postMessage({
            command: 'cancel'
        });
    };
    
    // 自动补全功能
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    let selectedIndex = -1;
    let filteredTags = [];
    let autocompleteVisible = false;
    
    function showAutocomplete(tags, cursorPos) {
        if (tags.length === 0) {
            hideAutocomplete();
            return;
        }
        
        filteredTags = tags;
        selectedIndex = 0;
        autocompleteVisible = true;
        
        // 清空下拉列表
        autocompleteDropdown.innerHTML = '';
        
        // 添加选项
        tags.forEach((tag, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item' + (index === 0 ? ' selected' : '');
            item.innerHTML = '<span class="tag-name">@' + tag + '</span><span class="tag-description">标签引用</span>';
            item.addEventListener('click', () => {
                insertTag(tag);
            });
            autocompleteDropdown.appendChild(item);
        });
        
        // 显示下拉框（先显示，后调整位置，避免测量错误）
        autocompleteDropdown.style.display = 'block';
        
        // 计算光标位置
        const position = getCaretPixelPosition(textarea, cursorPos);
        
        // 设置下拉框初始位置（相对于textarea）
        autocompleteDropdown.style.left = position.left + 'px';
        autocompleteDropdown.style.top = (position.top + position.height + 2) + 'px';
        
        // 确保下拉框不超出容器边界（需要在显示后调整）
        setTimeout(() => {
            adjustDropdownPosition();
        }, 0);
    }
    
    /**
     * 获取光标在textarea中的像素位置
     */
    function getCaretPixelPosition(textarea, caretPos) {
        // 创建一个隐藏的div，模拟textarea的样式
        const div = document.createElement('div');
        const style = window.getComputedStyle(textarea);
        
        // 复制textarea的样式到div，确保布局一致
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.top = '-9999px';
        div.style.left = '-9999px';
        div.style.overflow = 'hidden';
        
        // 复制重要的样式属性
        [
            'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
            'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom',
            'borderTopWidth', 'borderLeftWidth', 'borderRightWidth', 'borderBottomWidth',
            'width', 'boxSizing'
        ].forEach(prop => {
            div.style[prop] = style[prop];
        });
        
        document.body.appendChild(div);
        
        // 设置文本内容到光标位置
        const textBeforeCaret = textarea.value.substring(0, caretPos);
        div.textContent = textBeforeCaret;
        
        // 创建一个span来标记光标位置
        const span = document.createElement('span');
        span.textContent = '\u200b'; // 使用零宽度字符
        div.appendChild(span);
        
        // 获取span的位置（即光标位置）
        const spanRect = span.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        
        // 获取textarea的内边距
        const paddingLeft = parseInt(style.paddingLeft) || 0;
        const paddingTop = parseInt(style.paddingTop) || 0;
        
        // 计算相对于textarea内容区域的位置
        let left = spanRect.left - textareaRect.left;
        let top = spanRect.top - textareaRect.top - textarea.scrollTop + textarea.scrollHeight - div.scrollHeight;
        
        // 如果计算出现问题，使用备用方法
        if (top < 0 || top > textarea.clientHeight) {
            // 使用行高估算位置
            const lineHeight = parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2;
            const lines = textBeforeCaret.split('\n');
            const lineIndex = lines.length - 1;
            top = paddingTop + lineIndex * lineHeight - textarea.scrollTop;
        }
        
        const height = parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2;
        
        // 清理
        document.body.removeChild(div);
        
        return {
            left: Math.max(0, left),
            top: Math.max(0, top),
            height: height
        };
    }
    
    /**
     * 调整下拉框位置，确保不超出容器边界
     */
    function adjustDropdownPosition() {
        const dropdown = autocompleteDropdown;
        const textareaContainer = textarea.parentElement; // autocomplete容器
        const container = textareaContainer.parentElement; // input-area容器
        
        // 获取各个元素的边界信息
        const containerRect = container.getBoundingClientRect();
        const textareaRect = textarea.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        
        // 获取当前下拉框的位置（相对于textarea）
        let currentLeft = parseInt(dropdown.style.left) || 0;
        let currentTop = parseInt(dropdown.style.top) || 0;
        
        // 计算下拉框在屏幕上的实际位置
        const actualLeft = textareaRect.left + currentLeft;
        const actualTop = textareaRect.top + currentTop;
        const actualRight = actualLeft + dropdownRect.width;
        const actualBottom = actualTop + dropdownRect.height;
        
        // 检查是否超出右边界
        if (actualRight > containerRect.right) {
            const overflow = actualRight - containerRect.right;
            currentLeft = Math.max(0, currentLeft - overflow - 10);
            dropdown.style.left = currentLeft + 'px';
        }
        
        // 检查是否超出左边界
        if (actualLeft < containerRect.left) {
            const underflow = containerRect.left - actualLeft;
            currentLeft = currentLeft + underflow + 10;
            dropdown.style.left = currentLeft + 'px';
        }
        
        // 检查是否超出底部边界，如果超出则显示在光标上方
        if (actualBottom > containerRect.bottom) {
            // 计算光标的实际位置
            const position = getCaretPixelPosition(textarea, textarea.selectionStart);
            // 将下拉框显示在光标上方
            currentTop = position.top - dropdownRect.height - 5;
            dropdown.style.top = Math.max(5, currentTop) + 'px';
        }
        
        // 检查是否超出顶部边界
        if (actualTop < containerRect.top) {
            // 如果上方也放不下，则在可视区域内显示
            const visibleTop = Math.max(5, containerRect.top - textareaRect.top + 5);
            dropdown.style.top = visibleTop + 'px';
        }
    }
    
    function hideAutocomplete() {
        autocompleteVisible = false;
        autocompleteDropdown.style.display = 'none';
        selectedIndex = -1;
        filteredTags = [];
    }
    
    function updateSelection(direction) {
        if (!autocompleteVisible || filteredTags.length === 0) return;
        
        // 移除当前选中状态
        const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
        if (items[selectedIndex]) {
            items[selectedIndex].classList.remove('selected');
        }
        
        // 更新选中索引
        selectedIndex += direction;
        if (selectedIndex < 0) selectedIndex = filteredTags.length - 1;
        if (selectedIndex >= filteredTags.length) selectedIndex = 0;
        
        // 添加新的选中状态
        if (items[selectedIndex]) {
            items[selectedIndex].classList.add('selected');
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    function insertTag(tag) {
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;
        
        // 找到@的位置
        const beforeCursor = text.substring(0, cursorPos);
        const atIndex = beforeCursor.lastIndexOf('@');
        
        if (atIndex !== -1) {
            // 替换@后的内容
            const beforeAt = text.substring(0, atIndex);
            const afterCursor = text.substring(cursorPos);
            const newText = beforeAt + '@' + tag + ' ' + afterCursor;
            
            textarea.value = newText;
            const newCursorPos = atIndex + tag.length + 2; // @tag + 空格
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
        }
        
        hideAutocomplete();
    }
    
    textarea.addEventListener('input', function(e) {
        // 如果当前在预览tab，实时更新预览
        if (currentTab === 'preview-tab') {
            const content = e.target.value;
            updatePreview(content);
        }
        
        const cursorPos = e.target.selectionStart;
        const text = e.target.value;
        const beforeCursor = text.substring(0, cursorPos);
        
        // 检查是否刚输入了@
        const atMatch = beforeCursor.match(/@([a-zA-Z0-9_]*)$/);
        if (atMatch && tagList.length > 0) {
            const searchTerm = atMatch[1].toLowerCase();
            const availableTags = tagList.filter(tag => 
                tag.startsWith('@') && 
                tag.slice(1).toLowerCase().includes(searchTerm)
            ).map(tag => tag.slice(1)); // 移除@前缀
            
            if (availableTags.length > 0) {
                showAutocomplete(availableTags, cursorPos);
            } else {
                hideAutocomplete();
            }
        } else {
            hideAutocomplete();
        }
        
        // 保存输入状态
        saveState();
    });
    
    // 处理键盘导航
    textarea.addEventListener('keydown', function(e) {
        if (autocompleteVisible) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    updateSelection(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    updateSelection(-1);
                    break;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    if (selectedIndex >= 0 && filteredTags[selectedIndex]) {
                        insertTag(filteredTags[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    hideAutocomplete();
                    break;
            }
        }
    });
    
    // 点击其他地方时隐藏自动补全
    document.addEventListener('click', function(e) {
        if (!autocompleteDropdown.contains(e.target) && e.target !== textarea) {
            hideAutocomplete();
        }
    });
    
    // 监听textarea滚动事件，重新调整下拉框位置
    textarea.addEventListener('scroll', function() {
        if (autocompleteVisible) {
            adjustDropdownPosition();
        }
    });
    
    // 监听窗口大小变化，重新调整下拉框位置
    window.addEventListener('resize', function() {
        if (autocompleteVisible) {
            setTimeout(() => {
                adjustDropdownPosition();
            }, 100);
        }
    });
    
    // 全局快捷键支持
    document.addEventListener('keydown', function(e) {
        if (!autocompleteVisible) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                window.save();
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                window.saveAndContinue();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                window.cancel();
            }
        }
    });
    
    // 监听光标位置变化
    textarea.addEventListener('selectionchange', function() {
        saveState();
    });
    
    // 监听失去焦点时保存状态
    textarea.addEventListener('blur', function() {
        saveState();
    });
    
    // 初始化tab切换功能
    initTabSwitching();
    
    // 恢复tab状态
    if (previousState && previousState.currentTab) {
        switchTab(previousState.currentTab);
    }
    
    // 初始化时如果有恢复的预览状态，更新预览内容
    if (previewVisible && textarea.value) {
        updatePreview(textarea.value);
    }
    
    // 设置焦点
    textarea.focus();
    if (previousState && previousState.cursorPosition !== undefined) {
        textarea.setSelectionRange(previousState.cursorPosition, previousState.cursorPosition);
    } else {
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    
    // 暴露函数给全局作用域
    window.saveAndContinue = function() {
        vscode.postMessage({
            command: 'saveAndContinue',
            content: textarea.value
        });
    };
    
    // 添加分享函数
    window.share = function() {
        // 获取当前注释内容
        const content = textarea.value;
        
        // 发送分享消息到扩展，包含内容和其它可能的信息
        vscode.postMessage({
            command: 'share',
            content: content,
            comment: {
                content: content,
                timestamp: Date.now()
            }
        });
    };
    
    // 监听来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'shareSuccess':
                // 分享成功后可以更新UI状态
                console.log('注释分享成功，sharedId:', message.sharedId);
                // 可以在这里添加更新UI的代码，比如禁用分享按钮或改变其文本
                // 例如：显示"已分享"状态
                const shareButton = document.querySelector('.share-btn');
                if (shareButton) {
                    shareButton.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        已分享
                    `;
                    shareButton.disabled = true;
                    shareButton.style.backgroundColor = 'var(--vscode-button-secondaryBackground)';
                    shareButton.style.borderColor = 'var(--vscode-button-secondaryBorder)';
                }
                break;
            case 'shareError':
                // 处理分享错误
                console.error('分享失败:', message.error);
                // 显示错误消息
                alert('分享失败: ' + message.error);
                break;
        }
    });
})();