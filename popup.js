class StickyNotesPopup {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadNotes();
    }

    bindEvents() {
        const addNoteBtn = document.getElementById('addNoteBtn');
        const searchInput = document.getElementById('searchInput');

        addNoteBtn.addEventListener('click', () => this.createNote());
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.filterNotes(query);
        });
    }

    async loadNotes() {
        try {
            const result = await chrome.storage.local.get(['stickyNotes']);
            this.notes = result.stickyNotes || [];
            this.filteredNotes = [...this.notes];
            this.renderNotes();
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    async saveNotes() {
        try {
            await chrome.storage.local.set({ stickyNotes: this.notes });
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    }

    filterNotes(query) {
        if (!query) {
            this.filteredNotes = [...this.notes];
        } else {
            this.filteredNotes = this.notes.filter(note => 
                note.title.toLowerCase().includes(query) || 
                note.content.toLowerCase().includes(query)
            );
        }
        this.renderNotes();
    }

    createNote() {
        const note = {
            id: Date.now().toString(),
            title: 'New Note',
            content: '',
            timestamp: new Date().toISOString(),
            position: { x: 50, y: 50 },
            pinned: false,
            color: 'default'
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.loadNotes(); // Reload and re-render
        this.notifyContentScript('create', note);
    }

    renderNotes() {
        const pinnedList = document.getElementById('pinnedNotesList');
        const unpinnedList = document.getElementById('notesList');
        const emptyState = document.getElementById('emptyState');
        const pinnedSection = document.getElementById('pinnedSection');
        const notesSection = document.getElementById('notesSection');

        const pinnedNotes = this.filteredNotes.filter(n => n.pinned);
        const unpinnedNotes = this.filteredNotes.filter(n => !n.pinned);

        if (this.filteredNotes.length === 0) {
            pinnedSection.style.display = 'none';
            notesSection.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        // Render Pinned
        if (pinnedNotes.length > 0) {
            pinnedSection.style.display = 'block';
            pinnedList.innerHTML = pinnedNotes.map(n => this.createNoteHTML(n)).join('');
        } else {
            pinnedSection.style.display = 'none';
        }

        // Render Others
        if (unpinnedNotes.length > 0) {
            notesSection.style.display = 'block';
            unpinnedList.innerHTML = unpinnedNotes.map(n => this.createNoteHTML(n)).join('');
        } else {
            notesSection.style.display = 'none';
        }

        this.bindNoteEvents();
    }

    createNoteHTML(note) {
        const date = new Date(note.timestamp);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        return `
            <div class="note-item ${note.pinned ? 'pinned' : ''}" data-note-id="${note.id}">
                <div class="note-title">${this.escapeHtml(note.title || 'Untitled')}</div>
                <div class="note-content">${this.escapeHtml(note.content || 'No content')}</div>
                <div class="note-time">${dateStr}</div>
            </div>
        `;
    }

    bindNoteEvents() {
        document.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this.focusNoteOnPage(noteId);
            });
        });
    }

    notifyContentScript(action, data) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action,
                    note: data
                }).catch(() => {}); // Ignore errors if content script not loaded
            }
        });
    }

    focusNoteOnPage(noteId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'focus',
                    noteId: noteId
                }).catch(() => {});
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StickyNotesPopup();
});
