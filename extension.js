import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class AutoHDRExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings = null;
        this._appSystem = null;
        this._windowTracker = null;
        this._runningAppsChangedId = null;
        this._windowsChangedIds = [];
        this._monitorManager = null;
        this._debugControl = null;
        this._trackedApps = new Set();
        this._hdrState = new Map(); // Track HDR state per monitor
    }

    enable() {
        this._settings = this.getSettings();
        this._appSystem = Shell.AppSystem.get_default();
        this._windowTracker = Shell.WindowTracker.get_default();
        
        // Get monitor manager and debug control for HDR operations
        try {
            this._monitorManager = global.backend.get_monitor_manager();
            this._debugControl = global.context.get_debug_control();
        } catch (e) {
            this._log(`Error getting monitor manager or debug control: ${e}`);
        }

        // Connect to app system changes
        this._runningAppsChangedId = this._appSystem.connect(
            'app-state-changed',
            this._onAppStateChanged.bind(this)
        );

        // Track window changes for better detection
        global.display.connect('window-created', (display, window) => {
            this._onWindowCreated(window);
        });

        // Initial check of running apps
        this._checkRunningApps();
        
        this._log('Auto HDR Extension enabled');
    }

    disable() {
        // Disconnect signals
        if (this._runningAppsChangedId) {
            this._appSystem.disconnect(this._runningAppsChangedId);
            this._runningAppsChangedId = null;
        }

        this._windowsChangedIds.forEach(id => {
            try {
                global.window_manager.disconnect(id);
            } catch (e) {
                // Window might already be destroyed
            }
        });
        this._windowsChangedIds = [];

        // Cleanup
        this._trackedApps.clear();
        this._hdrState.clear();
        this._settings = null;
        this._appSystem = null;
        this._windowTracker = null;
        this._monitorManager = null;
        this._debugControl = null;
        
        this._log('Auto HDR Extension disabled');
    }

    _log(message) {
        if (this._settings && this._settings.get_boolean('enable-logging')) {
            console.log(`[Auto HDR] ${message}`);
        }
    }

    _onAppStateChanged(appSystem, app) {
        this._log(`App state changed: ${app.get_id()}`);
        this._checkRunningApps();
    }

    _onWindowCreated(window) {
        const app = this._windowTracker.get_window_app(window);
        if (app) {
            this._log(`Window created for app: ${app.get_id()}`);
            this._checkRunningApps();
        }
    }

    _checkRunningApps() {
        const runningApps = this._appSystem.get_running();
        const hdrOnApps = this._settings.get_strv('hdr-on-apps');
        const hdrOffApps = this._settings.get_strv('hdr-off-apps');
        
        let shouldEnableHDR = false;
        let shouldDisableHDR = false;

        // Check if any HDR-on apps are running
        for (const app of runningApps) {
            const appId = app.get_id();
            
            if (hdrOnApps.includes(appId)) {
                this._log(`HDR-on app detected: ${appId}`);
                shouldEnableHDR = true;
                this._trackedApps.add(appId);
            }
            
            if (hdrOffApps.includes(appId)) {
                this._log(`HDR-off app detected: ${appId}`);
                shouldDisableHDR = true;
                this._trackedApps.add(appId);
            }
        }

        // Check if tracked apps are no longer running
        const runningAppIds = runningApps.map(app => app.get_id());
        const stoppedApps = Array.from(this._trackedApps).filter(
            appId => !runningAppIds.includes(appId)
        );

        for (const appId of stoppedApps) {
            this._log(`Tracked app stopped: ${appId}`);
            this._trackedApps.delete(appId);
            
            // Check if we should revert HDR state
            if (hdrOnApps.includes(appId)) {
                // HDR-on app closed, disable HDR if no other HDR-on apps running
                const otherHdrOnAppsRunning = runningAppIds.some(id => hdrOnApps.includes(id));
                if (!otherHdrOnAppsRunning) {
                    this._setHDR(false);
                }
            }
            
            if (hdrOffApps.includes(appId)) {
                // HDR-off app closed, enable HDR if no other HDR-off apps running
                const otherHdrOffAppsRunning = runningAppIds.some(id => hdrOffApps.includes(id));
                if (!otherHdrOffAppsRunning) {
                    this._setHDR(true);
                }
            }
        }

        // Apply HDR state
        if (shouldEnableHDR && !shouldDisableHDR) {
            this._setHDR(true);
        } else if (shouldDisableHDR && !shouldEnableHDR) {
            this._setHDR(false);
        }
    }

    _setHDR(enable) {
        if (!this._debugControl) {
            this._log('Debug control not available for HDR control');
            return;
        }

        try {
            // For GNOME 47+ (including 49), use enable_hdr property
            const currentState = this._debugControl.enable_hdr;
            
            if (currentState === enable) {
                this._log(`HDR already ${enable ? 'enabled' : 'disabled'}`);
                return;
            }

            this._debugControl.enable_hdr = enable;
            this._log(`HDR ${enable ? 'enabled' : 'disabled'}`);
            
            // Notify user
            Main.notify(
                'Auto HDR',
                `HDR ${enable ? 'enabled' : 'disabled'}`
            );
        } catch (e) {
            this._log(`Error setting HDR state: ${e}`);
        }
    }

    _getHDRCapableMonitors() {
        // This is a placeholder - in a real implementation, you would query
        // the monitor manager for HDR capabilities
        // For GNOME 47+, HDR is a global setting rather than per-monitor
        const selectedMonitors = this._settings.get_strv('selected-monitors');
        return selectedMonitors;
    }
}
