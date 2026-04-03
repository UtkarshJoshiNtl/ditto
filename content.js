class StickyNotesContent {
    constructor() {
        this.notes = [];
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
        this.loadNotes();
        this.bindEvents();
        this.setupMessageListener();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'sticky-notes-container';
        this.container.className = 'sticky-notes-container';
        document.body.appendChild(this.container);
    }

    async loadNotes() {
        try {
            const result = await chrome.storage.local.get(['stickyNotes']);
            this.notes = result.stickyNotes || [];
            this.renderNotes();
        } catch (error) {
            console.error('Error loading notes in content script:', error);
        }
    }

    renderNotes() {
        this.container.innerHTML = '';
        
        this.notes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            this.container.appendChild(noteElement);
        });
    }

    createNoteElement(note) {
        const noteEl = document.createElement('div');
        noteEl.className = 'sticky-note';
        noteEl.dataset.noteId = note.id;
        noteEl.style.left = note.position.x + 'px';
        noteEl.style.top = note.position.y + 'px';

        noteEl.innerHTML = `
            <div class="sticky-note-header">
                <div class="sticky-note-title">${this.escapeHtml(note.title)}</div>
                <button class="sticky-note-close">×</button>
            </div>
            <div class="sticky-note-content" contenteditable="true">${this.escapeHtml(note.content)}</div>
            <div class="sticky-note-resize"></div>
        `;

        this.makeDraggable(noteEl);
        this.makeResizable(noteEl);
        this.bindNoteEvents(noteEl, note);

        return noteEl;
    }

    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        const header = element.querySelector('.sticky-note-header');
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('sticky-note-close')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = element.offsetLeft;
            initialY = element.offsetTop;
            
            element.style.zIndex = this.getMaxZIndex() + 1;
            element.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            element.style.left = (initialX + dx) + 'px';
            element.style.top = (initialY + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.classList.remove('dragging');
                this.updateNotePosition(element.dataset.noteId, element.offsetLeft, element.offsetTop);
            }
        });
    }

    makeResizable(element) {
        const resizeHandle = element.querySelector('.sticky-note-resize');
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = element.offsetWidth;
            startHeight = element.offsetHeight;
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            e.preventDefault();
            const width = startWidth + (e.clientX - startX);
            const height = startHeight + (e.clientY - startY);
            
            element.style.width = Math.max(200, width) + 'px';
            element.style.height = Math.max(150, height) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }

    bindNoteEvents(element, note) {
        const closeBtn = element.querySelector('.sticky-note-close');
        const content = element.querySelector('.sticky-note-content');

        closeBtn.addEventListener('click', () => {
            this.deleteNote(note.id);
        });

        content.addEventListener('blur', () => {
            this.updateNoteContent(note.id, content.textContent.trim());
        });

        content.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                content.blur();
            }
        });
    }

    async updateNotePosition(noteId, x, y) {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex].position = { x, y };
            await this.saveNotes();
        }
    }

    async updateNoteContent(noteId, content) {
        const noteIndex = this.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex].content = content;
            await this.saveNotes();
        }
    }

    async deleteNote(noteId) {
        this.notes = this.notes.filter(n => n.id !== noteId);
        await this.saveNotes();
        
        const element = document.querySelector(`[data-note-id="${noteId}"]`);
        if (element) {
            element.remove();
        }
    }

    async saveNotes() {
        try {
            await chrome.storage.local.set({ stickyNotes: this.notes });
        } catch (error) {
            console.error('Error saving notes in content script:', error);
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'create':
                    this.addNote(message.note);
                    break;
                case 'update':
                    this.updateNote(message.note);
                    break;
                case 'delete':
                    this.removeNote(message.note.id);
                    break;
                case 'focus':
                    this.focusNote(message.noteId);
                    break;
            }
        });
    }

    addNote(note) {
        this.notes.unshift(note);
        this.saveNotes();
        
        const noteElement = this.createNoteElement(note);
        this.container.appendChild(noteElement);
        
        // Animate entrance
        setTimeout(() => {
            noteElement.classList.add('visible');
        }, 10);
    }

    updateNote(note) {
        const element = document.querySelector(`[data-note-id="${note.id}"]`);
        if (element) {
            const titleEl = element.querySelector('.sticky-note-title');
            const contentEl = element.querySelector('.sticky-note-content');
            
            titleEl.textContent = note.title;
            contentEl.textContent = note.content;
        }
    }

    removeNote(noteId) {
        const element = document.querySelector(`[data-note-id="${noteId}"]`);
        if (element) {
            element.classList.add('removing');
            setTimeout(() => {
                element.remove();
            }, 300);
        }
        
        this.notes = this.notes.filter(n => n.id !== noteId);
        this.saveNotes();
    }

    focusNote(noteId) {
        const element = document.querySelector(`[data-note-id="${noteId}"]`);
        if (element) {
            element.style.zIndex = this.getMaxZIndex() + 1;
            element.classList.add('focused');
            
            // Scroll into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Highlight effect
            setTimeout(() => {
                element.classList.remove('focused');
            }, 2000);
        }
    }

    getMaxZIndex() {
        const notes = document.querySelectorAll('.sticky-note');
        let maxZ = 1000;
        notes.forEach(note => {
            const z = parseInt(window.getComputedStyle(note).zIndex) || 0;
            if (z > maxZ) maxZ = z;
        });
        return maxZ;
    }

    bindEvents() {
        // Prevent notes from interfering with page interactions
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const focusedNote = document.activeElement.closest('.sticky-note');
                if (focusedNote) {
                    focusedNote.blur();
                }
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize content script
new StickyNotesContent();
