// Background script for Sticky Notes extension
// Handles extension lifecycle and storage management

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Sticky Notes extension installed');
        
        // Initialize with a welcome note
        const welcomeNote = {
            id: 'welcome-' + Date.now(),
            title: 'Welcome to Sticky Notes!',
            content: 'Click the extension icon to manage your notes. You can create, edit, and delete sticky notes on any webpage!',
            timestamp: new Date().toISOString(),
            position: { x: 150, y: 150 }
        };
        
        chrome.storage.local.set({ stickyNotes: [welcomeNote] });
    } else if (details.reason === 'update') {
        console.log('Sticky Notes extension updated');
    }
});

// Handle storage quota exceeded
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.stickyNotes) {
        const notes = changes.stickyNotes.newValue || [];
        
        // Check if we're approaching storage limits
        chrome.storage.local.getBytesInUse((bytesInUse) => {
            const quota = 5242880; // 5MB typical limit
            if (bytesInUse > quota * 0.8) {
                console.warn('Storage usage is high:', bytesInUse, 'bytes');
                
                // Optionally notify user or clean up old notes
                if (notes.length > 100) {
                    const trimmedNotes = notes.slice(0, 100);
                    chrome.storage.local.set({ stickyNotes: trimmedNotes });
                }
            }
        });
    }
});

// Handle extension icon click (alternative to popup)
chrome.action.onClicked.addListener((tab) => {
    // This is handled by the popup, but we keep it for potential future features
    console.log('Extension clicked on tab:', tab.id);
});
