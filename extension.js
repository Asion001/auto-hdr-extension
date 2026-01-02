import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const DISPLAY_CONFIG_INTERFACE = 'org.gnome.Mutter.DisplayConfig';
const DISPLAY_CONFIG_PATH = '/org/gnome/Mutter/DisplayConfig';
const DISPLAY_CONFIG_BUS_NAME = 'org.gnome.Mutter.DisplayConfig';

export default class AutoHDRExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings = null;
        this._appSystem = null;
        this._windowTracker = null;
        this._runningAppsChangedId = null;
        this._windowsChangedIds = [];
        this._displayConfigProxy = null;
        this._trackedApps = new Set();
        this._hdrState = new Map(); // Track HDR state per monitor
    }

    enable() {
        this._settings = this.getSettings();
        this._appSystem = Shell.AppSystem.get_default();
        this._windowTracker = Shell.WindowTracker.get_default();
        
        // Initialize DBus proxy for DisplayConfig
        try {
            this._initDisplayConfigProxy();
        } catch (e) {
            this._log(`Error initializing DisplayConfig proxy: ${e}`);
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
        this._displayConfigProxy = null;
        
        this._log('Auto HDR Extension disabled');
    }

    _initDisplayConfigProxy() {
        const DisplayConfigInterface = `
        <node>
          <interface name="${DISPLAY_CONFIG_INTERFACE}">
            <method name="GetCurrentState">
              <arg type="u" direction="out" name="serial"/>
              <arg type="a((ssss)a(siiddada{sv})a{sv})" direction="out" name="monitors"/>
              <arg type="a(iiduba(ssss)a{sv})" direction="out" name="logical_monitors"/>
              <arg type="a{sv}" direction="out" name="properties"/>
            </method>
            <method name="ApplyMonitorsConfig">
              <arg type="u" direction="in" name="serial"/>
              <arg type="u" direction="in" name="method"/>
              <arg type="a(iiduba(ssss)a{sv})" direction="in" name="logical_monitors"/>
              <arg type="a{sv}" direction="in" name="properties"/>
            </method>
          </interface>
        </node>`;

        this._displayConfigProxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            Gio.DBusNodeInfo.new_for_xml(DisplayConfigInterface).interfaces[0],
            DISPLAY_CONFIG_BUS_NAME,
            DISPLAY_CONFIG_PATH,
            DISPLAY_CONFIG_INTERFACE,
            null
        );
        
        this._log('DisplayConfig proxy initialized');
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
        if (!this._displayConfigProxy) {
            this._log('DisplayConfig proxy not available for HDR control');
            return;
        }

        try {
            // Get current display configuration
            const result = this._displayConfigProxy.call_sync(
                'GetCurrentState',
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            const [serial, monitors, logicalMonitors, properties] = result.deep_unpack();
            this._log(`Current display state retrieved (serial: ${serial})`);

            // Get selected monitors from settings, or use all if empty
            const selectedMonitors = this._settings.get_strv('selected-monitors');
            let modifiedCount = 0;

            // Modify logical monitors to set HDR mode
            const modifiedLogicalMonitors = logicalMonitors.map(logicalMonitor => {
                const [x, y, scale, transform, isPrimary, monitorsInLogical, logicalProps] = logicalMonitor;
                
                const modifiedMonitorsInLogical = monitorsInLogical.map(monitor => {
                    const [connector, mode, monitorProps] = monitor;
                    
                    // Check if this monitor should be modified
                    const shouldModify = selectedMonitors.length === 0 || selectedMonitors.includes(connector);
                    
                    if (shouldModify) {
                        // Create new properties dict with color-mode set
                        const newMonitorProps = {};
                        
                        // Copy existing properties
                        for (const key in monitorProps) {
                            newMonitorProps[key] = monitorProps[key];
                        }
                        
                        // Set color mode based on enable flag
                        // Try bt2100-pq (HDR10), fallback to default if not supported
                        // Some systems might use 'bt2100-hlg' instead
                        if (enable) {
                            // Try to enable HDR - use bt2100-pq for HDR10
                            newMonitorProps['color-mode'] = new GLib.Variant('s', 'bt2100-pq');
                            this._log(`Setting HDR ON (bt2100-pq) for monitor: ${connector}`);
                        } else {
                            // Disable HDR - use default/sRGB mode
                            newMonitorProps['color-mode'] = new GLib.Variant('s', 'default');
                            this._log(`Setting HDR OFF (default) for monitor: ${connector}`);
                        }
                        
                        modifiedCount++;
                        
                        return [connector, mode, newMonitorProps];
                    }
                    
                    return monitor;
                });
                
                return [x, y, scale, transform, isPrimary, modifiedMonitorsInLogical, logicalProps];
            });

            if (modifiedCount === 0) {
                this._log('No monitors modified - check if monitors support HDR or are in selected list');
                return;
            }

            // Apply the modified configuration
            // Method: 1 = verify (don't persist), 2 = persistent
            const applyParams = new GLib.Variant(
                '(uua(iiduba(ssss)a{sv})a{sv})',
                [serial, 2, modifiedLogicalMonitors, properties]
            );

            this._displayConfigProxy.call_sync(
                'ApplyMonitorsConfig',
                applyParams,
                Gio.DBusCallFlags.NONE,
                -1,
                null
            );

            this._log(`HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`);
            
            // Notify user
            Main.notify(
                'Auto HDR',
                `HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`
            );
        } catch (e) {
            this._log(`Error setting HDR state: ${e}`);
            this._log(`Error details: ${e.message}`);
            Main.notify(
                'Auto HDR Error',
                `Failed to ${enable ? 'enable' : 'disable'} HDR: ${e.message}`
            );
        }
    }
}
