class GistSync {
    constructor(token = null) {
        this.token = token;
        this.gistId = null;
        this.filename = 'sticky-notes-pro-backup.json';
    }

    setToken(token) {
        this.token = token;
    }

    async init() {
        if (!this.token) return false;
        // Check if we already have a gist ID in storage
        const res = await chrome.storage.local.get(['gistId']);
        this.gistId = res.gistId;
        return true;
    }

    async push(notes) {
        if (!this.token) throw new Error('No GitHub token');

        const content = JSON.stringify({
            notes,
            updatedAt: new Date().toISOString(),
            version: '2.0.0'
        }, null, 2);

        const data = {
            description: 'Sticky Notes Pro Backup (Strictly Open Source)',
            public: false,
            files: {
                [this.filename]: { content }
            }
        };

        let url = 'https://api.github.com/gists';
        let method = 'POST';

        if (this.gistId) {
            url += `/${this.gistId}`;
            method = 'PATCH';
        }

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to push to Gist');
        }

        const result = await response.json();
        if (method === 'POST') {
            this.gistId = result.id;
            await chrome.storage.local.set({ gistId: this.gistId });
        }

        return true;
    }

    async pull() {
        if (!this.token || !this.gistId) throw new Error('Not connected to a Gist');

        const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error('Failed to pull from Gist');

        const result = await response.json();
        const file = result.files[this.filename];
        
        if (!file) throw new Error('Backup file not found in Gist');

        const data = JSON.parse(file.content);

        /**
         * ALWAYS OVERRIDE LOGIC
         * 
         * For now, we are performing a simple overwrite. 
         * 
         * FEASIBILITY OF CONFLICT RESOLUTION:
         * To implement proper conflict resolution (merge):
         * 1. Store a "lastSyncedAt" timestamp for each note.
         * 2. Compare local 'updatedAt' vs Gist 'updatedAt'.
         * 3. Implement a Three-Way Merge or CRDT (Conflict-free Replicated Data Type) 
         *    to merge edits at the field level (title/content).
         * 4. Prompt the user with a Diff UI if fields strictly conflict.
         */
        
        if (data.notes && Array.isArray(data.notes)) {
            await chrome.storage.local.set({ stickyNotes: data.notes });
            return data.notes;
        }

        return null;
    }

    async checkConnection() {
        if (!this.token) return false;
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${this.token}` }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }
}
