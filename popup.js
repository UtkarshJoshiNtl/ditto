class StickyNotesPopup {
    constructor() {
        this.notes = [];
        this.filteredNotes = [];
        this.init();
    }

    async init() {
        this.gistId = null;
        this.sync = new GistSync();
        this.bindEvents();
        await this.loadNotes();
        await this.restoreSyncState();
    }

    bindEvents() {
        const addNoteBtn = document.getElementById('addNoteBtn');
        const searchInput = document.getElementById('searchInput');
        const syncTabBtn = document.getElementById('syncTabBtn');
        const saveTokenBtn = document.getElementById('saveTokenBtn');
        const pushSyncBtn = document.getElementById('pushSyncBtn');
        const pullSyncBtn = document.getElementById('pullSyncBtn');

        addNoteBtn.addEventListener('click', () => this.createNote());
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            this.filterNotes(query);
        });

        syncTabBtn.addEventListener('click', () => this.toggleSyncTab());
        
        saveTokenBtn.addEventListener('click', () => this.saveToken());
        pushSyncBtn.addEventListener('click', () => this.pushToGist());
        pullSyncBtn.addEventListener('click', () => this.pullFromGist());
    }

    async restoreSyncState() {
        const res = await chrome.storage.local.get(['ghToken', 'gistId']);
        if (res.ghToken) {
            document.getElementById('ghToken').value = res.ghToken;
            this.sync.setToken(res.ghToken);
            this.sync.gistId = res.gistId;
            this.updateSyncUI(true);
        }
    }

    toggleSyncTab() {
        const notesContainer = document.getElementById('notesContainer');
        const syncSection = document.getElementById('syncSection');
        const isSyncVisible = syncSection.style.display !== 'none';

        if (isSyncVisible) {
            syncSection.style.display = 'none';
            notesContainer.style.display = 'block';
        } else {
            syncSection.style.display = 'block';
            notesContainer.style.display = 'none';
        }
    }

    async saveToken() {
        const token = document.getElementById('ghToken').value.trim();
        if (!token) return;

        this.sync.setToken(token);
        const isValid = await this.sync.checkConnection();
        
        if (isValid) {
            await chrome.storage.local.set({ ghToken: token });
            this.updateSyncUI(true);
            alert('GitHub token saved successfully!');
        } else {
            alert('Invalid GitHub token. Please check and try again.');
        }
    }

    async pushToGist() {
        try {
            const btn = document.getElementById('pushSyncBtn');
            btn.disabled = true;
            btn.textContent = 'Pushing...';
            
            await this.sync.push(this.notes);
            
            btn.disabled = false;
            btn.textContent = 'Push to Gist';
            alert('Notes successfully backed up to Gist!');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    async pullFromGist() {
        try {
            const btn = document.getElementById('pullSyncBtn');
            btn.disabled = true;
            btn.textContent = 'Pulling...';
            
            const remoteNotes = await this.sync.pull();
            if (remoteNotes) {
                this.notes = remoteNotes;
                this.filteredNotes = [...this.notes];
                this.renderNotes();
                alert('Notes successfully pulled from Gist! Local notes were overwritten.');
            }
            
            btn.disabled = false;
            btn.textContent = 'Pull from Gist';
        } catch (e) {
            alert('Error: ' + e.message);
        }
    }

    updateSyncUI(isConnected) {
        const status = document.getElementById('syncStatus');
        const pushBtn = document.getElementById('pushSyncBtn');
        const pullBtn = document.getElementById('pullSyncBtn');
        
        if (isConnected) {
            status.textContent = 'Connected to GitHub';
            status.style.color = '#10b981'; // Green
            pushBtn.disabled = false;
            pullBtn.disabled = false;
        } else {
            status.textContent = 'Not connected';
            status.style.color = '#ef4444'; // Red
            pushBtn.disabled = true;
            pullBtn.disabled = true;
        }
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
            color: 'default',
            origin: window.location.hostname
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.loadNotes();
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

        // Render Others (Grouped by Domain)
        if (unpinnedNotes.length > 0) {
            notesSection.style.display = 'block';
            const groups = this.groupNotesByDomain(unpinnedNotes);
            unpinnedList.innerHTML = Object.entries(groups).map(([domain, notes]) => `
                <div class="domain-group">
                    <div class="domain-header">${domain}</div>
                    <div class="domain-notes">
                        ${notes.map(n => this.createNoteHTML(n)).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            notesSection.style.display = 'none';
        }

        this.bindNoteEvents();
    }

    groupNotesByDomain(notes) {
        return notes.reduce((acc, note) => {
            const domain = note.origin || 'Other';
            if (!acc[domain]) acc[domain] = [];
            acc[domain].push(note);
            return acc;
        }, {});
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
