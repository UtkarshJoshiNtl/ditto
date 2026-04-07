chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "create-sticky-note",
    title: "Create Sticky Note here",
    contexts: ["page", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "create-sticky-note") {
    const id = Date.now().toString();
    const note = {
      id: id,
      title: info.selectionText ? 'Fragment' : 'New Note',
      content: info.selectionText || '',
      timestamp: new Date().toISOString(),
      position: { x: 100, y: 100 }, // Default, will be updated by content script
      pinned: false,
      color: 'default'
    };

    // Save to storage
    chrome.storage.local.get(['stickyNotes'], (res) => {
      const notes = res.stickyNotes || [];
      notes.push(note);
      chrome.storage.local.set({ stickyNotes: notes });
    });

    // Send to content script to render at a good spot
    chrome.tabs.sendMessage(tab.id, {
      action: 'context-create',
      note: note,
      pos: { x: 100, y: 100 } // Simple fallback
    }).catch(() => {});
  }
});
