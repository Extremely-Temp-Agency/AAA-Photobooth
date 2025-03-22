const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        openPreferences: () => ipcRenderer.send('open-preferences'),
        savePreferences: (preferences) => {
            // Create a clean preferences object with only the changed values
            const prefsToSave = {};
            Object.entries(preferences).forEach(([key, value]) => {
                // Skip text and webcam settings as they're handled separately
                if (!['fontFamily', 'textFields', 'selectedWebcam'].includes(key) && value !== undefined) {
                    prefsToSave[key] = value;
                }
            });
            return ipcRenderer.invoke('save-preferences', prefsToSave);
        },
        closePreferences: () => ipcRenderer.send('close-preferences'),
        loadPreferences: () => ipcRenderer.invoke('load-preferences'),
        toggleWebcam: () => ipcRenderer.send('toggle-webcam'),
        onWebcamStateChange: (callback) => ipcRenderer.on('webcam-state-changed', (_, state) => callback(state)),
        updateVideoOverlay: (data) => ipcRenderer.send('update-video-overlay', data),
        updateColorTint: (tints) => ipcRenderer.send('update-color-tint', tints),
        updateWebcam: (deviceId) => {
            if (deviceId !== undefined) {
                ipcRenderer.send('update-webcam', deviceId);
            }
        },
        onVideoOverlayChange: (callback) => ipcRenderer.on('video-overlay-changed', (_, data) => callback(data)),
        onColorTintChange: (callback) => ipcRenderer.on('color-tint-changed', (_, tints) => callback(tints)),
        onWebcamChange: (callback) => ipcRenderer.on('webcam-changed', (_, deviceId) => callback(deviceId)),
        onTextSettingsChange: (callback) => ipcRenderer.on('text-settings-changed', (_, settings) => callback(settings)),
        updateTextSettings: (settings) => {
            ipcRenderer.send('text-settings-changed', settings);
        },
        send: (channel, data) => ipcRenderer.send(channel, data)
    }
); 