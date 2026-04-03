class StickyNotesStorage {
    static KEYS = {
        STICKY_NOTES: 'stickyNotes',
        SETTINGS: 'stickyNotesSettings',
        LAST_SYNC: 'lastSync'
    };

    static DEFAULT_SETTINGS = {
        autoSave: true,
        noteColor: 'yellow',
        defaultPosition: { x: 100, y: 100 },
        maxNotes: 50
    };

    static async getNotes() {
        try {
            const result = await chrome.storage.local.get(this.KEYS.STICKY_NOTES);
            return result[this.KEYS.STICKY_NOTES] || [];
        } catch (error) {
            console.error('Error getting notes:', error);
            return [];
        }
    }

    static async saveNotes(notes) {
        try {
            await chrome.storage.local.set({ [this.KEYS.STICKY_NOTES]: notes });
            return true;
        } catch (error) {
            console.error('Error saving notes:', error);
            return false;
        }
    }

    static async getSettings() {
        try {
            const result = await chrome.storage.local.get(this.KEYS.SETTINGS);
            return { ...this.DEFAULT_SETTINGS, ...result[this.KEYS.SETTINGS] };
        } catch (error) {
            console.error('Error getting settings:', error);
            return this.DEFAULT_SETTINGS;
        }
    }

    static async saveSettings(settings) {
        try {
            await chrome.storage.local.set({ [this.KEYS.SETTINGS]: settings });
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    static async addNote(note) {
        const notes = await this.getNotes();
        notes.unshift(note);
        
        // Limit number of notes
        const settings = await this.getSettings();
        if (notes.length > settings.maxNotes) {
            notes.splice(settings.maxNotes);
        }
        
        return await this.saveNotes(notes);
    }

    static async updateNote(noteId, updates) {
        const notes = await this.getNotes();
        const noteIndex = notes.findIndex(note => note.id === noteId);
        
        if (noteIndex !== -1) {
            notes[noteIndex] = { ...notes[noteIndex], ...updates };
            return await this.saveNotes(notes);
        }
        
        return false;
    }

    static async deleteNote(noteId) {
        const notes = await this.getNotes();
        const filteredNotes = notes.filter(note => note.id !== noteId);
        return await this.saveNotes(filteredNotes);
    }

    static async clearAllNotes() {
        try {
            await chrome.storage.local.remove(this.KEYS.STICKY_NOTES);
            return true;
        } catch (error) {
            console.error('Error clearing notes:', error);
            return false;
        }
    }

    static async exportNotes() {
        try {
            const notes = await this.getNotes();
            const settings = await this.getSettings();
            
            const exportData = {
                notes: notes,
                settings: settings,
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            };
            
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting notes:', error);
            return null;
        }
    }

    static async importNotes(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (importData.notes && Array.isArray(importData.notes)) {
                await this.saveNotes(importData.notes);
            }
            
            if (importData.settings) {
                await this.saveSettings(importData.settings);
            }
            
            return true;
        } catch (error) {
            console.error('Error importing notes:', error);
            return false;
        }
    }

    static async getStorageUsage() {
        try {
            const result = await chrome.storage.local.getBytesInUse();
            return result;
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return 0;
        }
    }

    static validateNote(note) {
        const requiredFields = ['id', 'title', 'content', 'timestamp', 'position'];
        return requiredFields.every(field => note.hasOwnProperty(field));
    }

    static sanitizeNote(note) {
        return {
            id: note.id || Date.now().toString(),
            title: String(note.title || '').substring(0, 100),
            content: String(note.content || '').substring(0, 2000),
            timestamp: note.timestamp || new Date().toISOString(),
            position: {
                x: Math.max(0, Math.min(window.innerWidth - 250, note.position?.x || 100)),
                y: Math.max(0, Math.min(window.innerHeight - 200, note.position?.y || 100))
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StickyNotesStorage;
}
