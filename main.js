const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let store;
(async () => {
    const Store = await import('electron-store');
    store = new Store.default();
})();

let mainWindow = null;
let preferencesWindow = null;
let isWebcamEnabled = true;
let colorTint = '#ffffff';
let videoOverlay1 = null;
let videoOverlay2 = null;

async function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    await mainWindow.loadFile('index.html');
    
    // Load and send saved preferences to main window
    const preferences = store?.get('preferences') || {};
    
    // Send video overlay preferences
    if (preferences.overlay1 || preferences.overlay2) {
        mainWindow.webContents.send('video-overlay-changed', {
            overlay1: preferences.overlay1 || null,
            overlay2: preferences.overlay2 || null
        });
    }

    // Send color tint preferences
    mainWindow.webContents.send('color-tint-changed', {
        colorTint1: preferences.colorTint1 || '#ffffff',
        colorTint2: preferences.colorTint2 || '#ffffff'
    });

    // Send text settings if they exist
    if (preferences.fontFamily || preferences.textFields) {
        mainWindow.webContents.send('text-settings-changed', {
            fontFamily: preferences.fontFamily || 'Arial',
            textFields: preferences.textFields || [
                { x: 5, y: 10, size: 4 },
                { x: 5, y: 20, size: 4 },
                { x: 5, y: 30, size: 4 }
            ]
        });
    }

    return mainWindow;
}

function createPreferencesWindow() {
    console.log('Creating preferences window...');
    if (preferencesWindow) {
        console.log('Preferences window already exists, focusing...');
        preferencesWindow.focus();
        return;
    }

    preferencesWindow = new BrowserWindow({
        width: 500,
        height: 600,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        }
    });

    const preferencesHtmlPath = path.join(__dirname, 'preferences.html');
    console.log('Loading preferences.html from:', preferencesHtmlPath);
    preferencesWindow.loadFile(preferencesHtmlPath);

    preferencesWindow.webContents.on('did-finish-load', () => {
        console.log('Preferences window loaded successfully');
        // Send initial states
        preferencesWindow.webContents.send('webcam-state-changed', isWebcamEnabled);
        preferencesWindow.webContents.send('color-tint-changed', colorTint);
        preferencesWindow.webContents.send('video-overlay-changed', {
            overlay1: videoOverlay1,
            overlay2: videoOverlay2
        });
    });

    preferencesWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load preferences window:', errorCode, errorDescription);
    });

    preferencesWindow.on('closed', () => {
        console.log('Preferences window closed');
        preferencesWindow = null;
    });
}

// When app is ready
app.whenReady().then(async () => {
    // Wait for store to be initialized
    while (!store) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    mainWindow = await createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers
ipcMain.on('open-preferences', () => {
    console.log('Received open-preferences event');
    createPreferencesWindow();
});

ipcMain.handle('save-preferences', async (event, preferences) => {
    console.log('Saving preferences:', preferences);
    const currentPrefs = store?.get('preferences') || {};
    
    // Only update the specific preferences that were changed
    const updatedPrefs = { ...currentPrefs };
    Object.keys(preferences).forEach(key => {
        if (preferences[key] !== undefined) {
            updatedPrefs[key] = preferences[key];
        }
    });
    
    await store?.set('preferences', updatedPrefs);
    
    // Send only relevant updates to main window
    if (mainWindow) {
        // Only send color tint update if color tints changed
        if (preferences.colorTint1 !== undefined || preferences.colorTint2 !== undefined) {
            mainWindow.webContents.send('color-tint-changed', {
                colorTint1: preferences.colorTint1 || currentPrefs.colorTint1,
                colorTint2: preferences.colorTint2 || currentPrefs.colorTint2
            });
        }
        
        // Only send overlay update if overlays changed
        if (preferences.overlay1 !== undefined || preferences.overlay2 !== undefined) {
            mainWindow.webContents.send('video-overlay-changed', {
                overlay1: preferences.overlay1 || currentPrefs.overlay1 || null,
                overlay2: preferences.overlay2 || currentPrefs.overlay2 || null
            });
        }
        
        // Only send webcam update if webcam changed
        if (preferences.selectedWebcam !== undefined) {
            mainWindow.webContents.send('webcam-changed', preferences.selectedWebcam);
        }
    }
});

// Add handler for text settings changes
ipcMain.on('text-settings-changed', (event, settings) => {
    console.log('Text settings changed:', settings);
    // Update stored preferences with new text settings
    const preferences = store?.get('preferences') || {};
    if (settings.fontFamily !== undefined) {
        preferences.fontFamily = settings.fontFamily;
    }
    if (settings.textFields !== undefined) {
        preferences.textFields = settings.textFields;
    }
    store?.set('preferences', preferences);
    
    // Send update to main window
    if (mainWindow) {
        mainWindow.webContents.send('text-settings-changed', settings);
    }
});

// When loading preferences, also send text settings and initialize webcam state
ipcMain.handle('load-preferences', async () => {
    const preferences = store?.get('preferences') || {
        isWebcamEnabled: true,
        colorTint: '#ffffff',
        overlay1: '',
        overlay2: '',
        fontFamily: 'Arial',
        textFields: [
            { x: 5, y: 10, size: 4 },
            { x: 5, y: 20, size: 4 },
            { x: 5, y: 30, size: 4 }
        ]
    };

    // Initialize webcam state from preferences
    isWebcamEnabled = preferences.isWebcamEnabled !== undefined ? preferences.isWebcamEnabled : true;

    // Send initial text settings to main window
    if (mainWindow && (preferences.fontFamily || preferences.textFields)) {
        mainWindow.webContents.send('text-settings-changed', {
            fontFamily: preferences.fontFamily,
            textFields: preferences.textFields
        });
    }

    return preferences;
});

ipcMain.on('close-preferences', () => {
    if (preferencesWindow) {
        const preferences = store.get('preferences');
        if (preferences && (preferences.overlay1 || preferences.overlay2)) {
            mainWindow.webContents.send('video-overlay-changed', {
                overlay1: preferences.overlay1 || null,
                overlay2: preferences.overlay2 || null
            });
        }
        preferencesWindow.close();
    }
});

ipcMain.on('update-video-overlay', async (event, data) => {
    console.log('Updating video overlay', data);
    if (mainWindow) {
        mainWindow.webContents.send('video-overlay-changed', data);
    }
    // Update stored preferences with new overlay paths
    const preferences = store?.get('preferences') || {};
    preferences.overlay1 = data.overlay1 || preferences.overlay1;
    preferences.overlay2 = data.overlay2 || preferences.overlay2;
    await store?.set('preferences', preferences);
});

ipcMain.on('update-color-tint', (event, color) => {
    console.log('Updating color tint to:', color);
    colorTint = color;
    if (mainWindow) {
        mainWindow.webContents.send('color-tint-changed', color);
    }
});

function toggleWebcam() {
    const preferences = store?.get('preferences') || {};
    preferences.isWebcamEnabled = !preferences.isWebcamEnabled;
    store?.set('preferences', preferences);
    
    // Notify windows of state change
    if (mainWindow) {
        mainWindow.webContents.send('webcam-state-changed', preferences.isWebcamEnabled);
    }
    
    if (preferencesWindow) {
        preferencesWindow.webContents.send('webcam-state-changed', preferences.isWebcamEnabled);
    }
}

ipcMain.on('toggle-webcam', () => {
    console.log('Received toggle-webcam event');
    toggleWebcam();
});

// Add handler for webcam selection changes
ipcMain.on('update-webcam', (event, deviceId) => {
    console.log('Updating webcam selection:', deviceId);
    const preferences = store?.get('preferences') || {};
    preferences.selectedWebcam = deviceId;
    store?.set('preferences', preferences);
    
    if (mainWindow) {
        mainWindow.webContents.send('webcam-changed', deviceId);
    }
}); 