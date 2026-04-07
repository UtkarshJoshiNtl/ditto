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
      id,
      title: info.selectionText ? 'Fragment' : 'New Note',
      content: info.selectionText || '',
      timestamp: new Date().toISOString(),
      position: { x: 100, y: 100 },
      pinned: false,
      color: 'default',
      origin: new URL(tab.url).hostname
    };

    chrome.storage.local.get(['stickyNotes'], (res) => {
      const notes = res.stickyNotes || [];
      notes.push(note);
      chrome.storage.local.set({ stickyNotes: notes });
    });

    chrome.tabs.sendMessage(tab.id, {
      action: 'context-create',
      note,
      pos: { x: 100, y: 100 }
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capture') {
    captureAndCrop(request.rect, sender.tab.id).then(dataUrl => {
      sendResponse({ dataUrl });
    });
    return true; // Keep channel open for async response
  }
});

async function captureAndCrop(rect, tabId) {
  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
  
  // Use OffscreenCanvas to crop the image
  // Note: OffscreenCanvas is available in Service Workers
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  
  const canvas = new OffscreenCanvas(rect.w, rect.h);
  const ctx = canvas.getContext('2d');
  
  // Draw the cropped portion
  ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  
  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(croppedBlob);
  });
}
