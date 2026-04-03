# Sticky Notes Chrome Extension

A simple Chrome extension for creating and managing sticky notes on any webpage.

## Features

- Create sticky notes on any webpage
- Persistent storage using Chrome storage API
- Clean and intuitive interface
- Draggable and resizable notes
- Multiple note colors
- Real-time synchronization between popup and page
- Export/import functionality
- Storage management

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select this directory

## Usage

1. Click the Sticky Notes icon in the Chrome toolbar
2. Use the popup to create and manage notes
3. Notes will appear as draggable sticky notes on the current page
4. Edit notes directly on the page or in the popup
5. Notes are automatically saved and persist across sessions

## Development

This extension uses Manifest V3 and modern JavaScript.

## File Structure

```
├── manifest.json       # Extension configuration
├── popup.html          # Popup interface
├── popup.css           # Popup styling
├── popup.js            # Popup functionality
├── content.js          # Page content script
├── content.css         # Page note styling
├── background.js       # Background service worker
├── storage.js          # Storage management utilities
├── icons/              # Extension icons
└── README.md           # This file
```

## Notes

- Icon files (icon16.png, icon48.png, icon128.png) need to be created
- Extension uses 5MB storage limit from Chrome storage API
- Notes are limited to 50 by default to prevent storage issues
