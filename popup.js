class StickyNotesPopup {
    constructor() {
        this.notes = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadNotes();
    }

    bindEvents() {
        const addNoteBtn = document.getElementById('addNoteBtn');
        addNoteBtn.addEventListener('click', () => this.createNote());
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

    async saveNotes() {
        try {
            await chrome.storage.local.set({ stickyNotes: this.notes });
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    }

    createNote() {
        const note = {
            id: Date.now().toString(),
            title: 'New Note',
            content: 'Click to edit this note...',
            timestamp: new Date().toISOString(),
            position: { x: 100, y: 100 }
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotes();
        this.notifyContentScript('create', note);
    }

    updateNote(noteId, updates) {
        const noteIndex = this.notes.findIndex(note => note.id === noteId);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = { ...this.notes[noteIndex], ...updates };
            this.saveNotes();
            this.renderNotes();
            this.notifyContentScript('update', this.notes[noteIndex]);
        }
    }

    deleteNote(noteId) {
        this.notes = this.notes.filter(note => note.id !== noteId);
        this.saveNotes();
        this.renderNotes();
        this.notifyContentScript('delete', { id: noteId });
    }

    renderNotes() {
        const notesList = document.getElementById('notesList');
        const emptyState = document.getElementById('emptyState');

        if (this.notes.length === 0) {
            notesList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        notesList.style.display = 'flex';
        emptyState.style.display = 'none';

        notesList.innerHTML = this.notes.map(note => this.createNoteHTML(note)).join('');

        // Bind events for note actions
        this.bindNoteEvents();
    }

    createNoteHTML(note) {
        const date = new Date(note.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="note-item" data-note-id="${note.id}">
                <div class="note-title" contenteditable="true" data-field="title">${note.title}</div>
                <div class="note-content" contenteditable="true" data-field="content">${note.content}</div>
                <div class="note-actions">
                    <button class="note-action-btn edit-btn" data-action="edit">Edit</button>
                    <button class="note-action-btn delete-btn" data-action="delete">Delete</button>
                </div>
                <div class="note-time">${dateStr}</div>
            </div>
        `;
    }

    bindNoteEvents() {
        // Handle contenteditable changes
        document.querySelectorAll('[contenteditable]').forEach(element => {
            element.addEventListener('blur', (e) => {
                const noteId = e.target.closest('.note-item').dataset.noteId;
                const field = e.target.dataset.field;
                const value = e.target.textContent.trim();
                
                this.updateNote(noteId, { [field]: value });
            });

            element.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.target.blur();
                }
            });
        });

        // Handle action buttons
        document.querySelectorAll('.note-action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const noteId = e.target.closest('.note-item').dataset.noteId;
                const action = e.target.dataset.action;

                if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this note?')) {
                        this.deleteNote(noteId);
                    }
                } else if (action === 'edit') {
                    this.focusNoteOnPage(noteId);
                }
            });
        });
    }

    notifyContentScript(action, data) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: action,
                    note: data
                });
            }
        });
    }

    focusNoteOnPage(noteId) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'focus',
                    noteId: noteId
                });
            }
        });
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StickyNotesPopup();
});
