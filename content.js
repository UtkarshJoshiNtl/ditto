class StickyNotesContent {
    constructor() {
        this.notes = [];
        this.container = null;
        this.isEditing = false;
        this.init();
    }

    async init() {
        this.createContainer();
        await this.loadNotes();
        this.setupMessageListener();
        this.bindGlobalEvents();
    }

    createContainer() {
        if (document.getElementById('sticky-notes-pro-container')) return;
        this.container = document.createElement('div');
        this.container.id = 'sticky-notes-pro-container';
        this.container.className = 'sticky-notes-container';
        document.body.appendChild(this.container);
    }

    async loadNotes() {
        try {
            const result = await chrome.storage.local.get(['stickyNotes']);
            this.notes = result.stickyNotes || [];
            this.renderNotes();
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    renderNotes() {
        this.container.innerHTML = '';
        this.notes.forEach(note => {
            const noteEl = this.createNoteElement(note);
            this.container.appendChild(noteEl);
            setTimeout(() => noteEl.classList.add('visible'), 10);
        });
    }

    createNoteElement(note) {
        const noteEl = document.createElement('div');
        noteEl.className = `sticky-note color-${note.color || 'default'} ${note.pinned ? 'pinned' : ''}`;
        noteEl.dataset.noteId = note.id;
        noteEl.style.left = note.position.x + 'px';
        noteEl.style.top = note.position.y + 'px';
        noteEl.style.width = (note.size?.width || 280) + 'px';
        noteEl.style.height = (note.size?.height || 180) + 'px';
        noteEl.style.zIndex = note.pinned ? '2147483647' : '2147483646';

        const renderedContent = this.renderMarkdown(note.content);

        noteEl.innerHTML = `
            <div class="sticky-note-header">
                <div class="sticky-note-title" contenteditable="true" spellcheck="false">${this.escapeHtml(note.title || 'Untitled')}</div>
                <div class="sticky-note-actions">
                    <button class="action-btn snapshot-btn" title="Take Screenshot Fragment">📸</button>
                    <button class="action-btn pin-btn" title="${note.pinned ? 'Unpin' : 'Pin'}">${note.pinned ? '📌' : '📍'}</button>
                    <button class="action-btn color-btn" title="Change Color">🎨</button>
                    <button class="action-btn delete-btn" title="Delete Note">🗑️</button>
                </div>
            </div>
            <div class="sticky-note-content" contenteditable="true" spellcheck="false">${renderedContent}</div>
            <div class="sticky-note-resize"></div>
        `;

        this.makeDraggable(noteEl);
        this.makeResizable(noteEl);
        this.bindNoteEvents(noteEl, note);

        return noteEl;
    }

    renderMarkdown(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        
        // Bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        
        // Italic: *text*
        html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
        
        // Lists: * item
        html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
        html = html.replace(/<\/ul>\n<ul>/g, ''); // Join adjacent lists
        
        return html;
    }

    // Reverse markdown for editing
    reverseMarkdown(html) {
        let text = html;
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');
        text = text.replace(/<ul>(.*?)<\/ul>/gs, (match, p1) => {
            return p1.replace(/<li>(.*?)<\/li>/g, '* $1\n').trim();
        });
        text = text.replace(/<div>(.*?)<\/div>/g, '\n$1');
        text = text.replace(/<br>/g, '\n');
        return text.trim();
    }

    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        const header = element.querySelector('.sticky-note-header');

        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('action-btn') || e.target.classList.contains('sticky-note-title')) return;
            isDragging = true;
            element.classList.add('dragging');
            startX = e.clientX;
            startY = e.clientY;
            initialX = element.offsetLeft;
            initialY = element.offsetTop;
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialX + dx}px`;
            element.style.top = `${initialY + dy}px`;
        });

        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.classList.remove('dragging');
                document.body.style.userSelect = '';
                this.updateNote(element.dataset.noteId, {
                    position: { x: element.offsetLeft, y: element.offsetTop }
                });
            }
        });
    }

    makeResizable(element) {
        const handle = element.querySelector('.sticky-note-resize');
        let isResizing = false;
        let startX, startY, startW, startH;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startW = element.offsetWidth;
            startH = element.offsetHeight;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const w = Math.max(200, startW + (e.clientX - startX));
            const h = Math.max(150, startH + (e.clientY - startY));
            element.style.width = `${w}px`;
            element.style.height = `${h}px`;
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                this.updateNote(element.dataset.noteId, {
                    size: { width: element.offsetWidth, height: element.offsetHeight }
                });
            }
        });
    }

    bindNoteEvents(element, note) {
        const titleEl = element.querySelector('.sticky-note-title');
        const contentEl = element.querySelector('.sticky-note-content');
        const snapshotBtn = element.querySelector('.snapshot-btn');
        const pinBtn = element.querySelector('.pin-btn');
        const colorBtn = element.querySelector('.color-btn');
        const deleteBtn = element.querySelector('.delete-btn');

        // Snapshot Action
        snapshotBtn.addEventListener('click', () => {
            this.startCropping(note.id);
        });

        // Handle Content Editing (Show raw text when editing)
        contentEl.addEventListener('focus', () => {
            this.isEditing = true;
            contentEl.innerText = this.notes.find(n => n.id === note.id).content;
        });

        contentEl.addEventListener('blur', () => {
            this.isEditing = false;
            const newContent = contentEl.innerText;
            this.updateNote(note.id, { content: newContent });
            contentEl.innerHTML = this.renderMarkdown(newContent);
        });

        titleEl.addEventListener('blur', () => {
            this.updateNote(note.id, { title: titleEl.innerText });
        });

        // Toolbar Actions
        pinBtn.addEventListener('click', () => {
            const isPinned = !note.pinned;
            this.updateNote(note.id, { pinned: isPinned });
            element.classList.toggle('pinned', isPinned);
            element.style.zIndex = isPinned ? '2147483647' : '2147483646';
            pinBtn.innerText = isPinned ? '📌' : '📍';
            pinBtn.title = isPinned ? 'Unpin' : 'Pin';
        });

        colorBtn.addEventListener('click', () => {
            const colors = ['default', 'lavender', 'mint', 'sky', 'rose'];
            const currentIndex = colors.indexOf(note.color || 'default');
            const nextColor = colors[(currentIndex + 1) % colors.length];
            this.updateNote(note.id, { color: nextColor });
            colors.forEach(c => element.classList.remove(`color-${c}`));
            element.classList.add(`color-${nextColor}`);
            note.color = nextColor; // Update local state for cycling
        });

        deleteBtn.addEventListener('click', () => {
            if (confirm('Delete this note?')) {
                this.deleteNote(note.id);
            }
        });
    }

    async updateNote(noteId, updates) {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = { ...this.notes[noteIndex], ...updates };
            await chrome.storage.local.set({ stickyNotes: this.notes });
        }
    }

    async deleteNote(noteId) {
        this.notes = this.notes.filter(n => n.id !== noteId);
        await chrome.storage.local.set({ stickyNotes: this.notes });
        const el = document.querySelector(`[data-note-id="${noteId}"]`);
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'scale(0.8)';
            setTimeout(() => el.remove(), 300);
        }
    }

    // --- CROPPING LOGIC ---
    startCropping(noteId) {
        // Hide all notes for a clean shot
        this.container.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 2147483647; cursor: crosshair;
        `;
        document.body.appendChild(overlay);

        let startX, startY;
        const selector = document.createElement('div');
        selector.style.cssText = 'position: absolute; border: 2px solid #6366f1; background: rgba(99, 102, 241, 0.1); display: none;';
        overlay.appendChild(selector);

        const onMouseDown = (e) => {
            startX = e.clientX;
            startY = e.clientY;
            selector.style.display = 'block';
            selector.style.left = startX + 'px';
            selector.style.top = startY + 'px';
        };

        const onMouseMove = (e) => {
            if (!startX) return;
            const w = Math.abs(e.clientX - startX);
            const h = Math.abs(e.clientY - startY);
            selector.style.width = w + 'px';
            selector.style.height = h + 'px';
            selector.style.left = Math.min(e.clientX, startX) + 'px';
            selector.style.top = Math.min(e.clientY, startY) + 'px';
        };

        const onMouseUp = async (e) => {
            const rect = selector.getBoundingClientRect();
            overlay.remove();
            
            if (rect.width > 5 && rect.height > 5) {
                // Request capture from background
                chrome.runtime.sendMessage({ 
                    action: 'capture',
                    rect: {
                        x: rect.x * window.devicePixelRatio,
                        y: rect.y * window.devicePixelRatio,
                        w: rect.width * window.devicePixelRatio,
                        h: rect.height * window.devicePixelRatio
                    }
                }, (response) => {
                    if (response && response.dataUrl) {
                        this.attachImageToNote(noteId, response.dataUrl);
                    }
                });
            }
            
            this.container.style.display = 'block';
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    attachImageToNote(noteId, dataUrl) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            const imgHtml = `<br><img src="${dataUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 8px;">`;
            note.content += imgHtml;
            this.updateNote(noteId, { content: note.content });
            
            const el = document.querySelector(`[data-note-id="${noteId}"] .sticky-note-content`);
            if (el) el.innerHTML = this.renderMarkdown(note.content);
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'create') {
                this.addNote(message.note);
            } else if (message.action === 'focus') {
                this.focusNote(message.noteId);
            } else if (message.action === 'context-create') {
                this.addNoteAt(message.note, message.pos);
            }
        });
    }

    addNote(note) {
        if (!this.notes.find(n => n.id === note.id)) {
            this.notes.push(note);
            const el = this.createNoteElement(note);
            this.container.appendChild(el);
            setTimeout(() => el.classList.add('visible'), 10);
        }
    }

    addNoteAt(note, pos) {
        note.position = pos;
        this.addNote(note);
        this.updateNote(note.id, { position: pos });
    }

    focusNote(noteId) {
        const el = document.querySelector(`[data-note-id="${noteId}"]`);
        if (el) {
            el.classList.add('focused');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => el.classList.remove('focused'), 2000);
        }
    }

    bindGlobalEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.createNewAtCenter();
            }
        });
    }

    createNewAtCenter() {
        const id = Date.now().toString();
        const note = {
            id,
            title: 'Quick Note',
            content: '',
            timestamp: new Date().toISOString(),
            position: { x: window.innerWidth / 2 - 140, y: window.innerHeight / 2 - 90 },
            pinned: false,
            color: 'default'
        };
        this.addNote(note);
        // Sync to storage
        chrome.storage.local.get(['stickyNotes'], (res) => {
            const list = res.stickyNotes || [];
            list.push(note);
            chrome.storage.local.set({ stickyNotes: list });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

new StickyNotesContent();
