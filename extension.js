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
        this._hdrEnabled = false; // Track current HDR state
    }

    enable() {
        this._settings = this.getSettings();
        this._appSystem = Shell.AppSystem.get_default();
        this._windowTracker = Shell.WindowTracker.get_default();
        
        // Initialize DBus proxy for DisplayConfig asynchronously
        this._initDisplayConfigProxy();

        // Connect to app system changes
        this._runningAppsChangedId = this._appSystem.connect(
            'app-state-changed',
            this._onAppStateChanged.bind(this)
        );

        // Track window changes for better detection
        global.display.connect('window-created', (display, window) => {
            this._onWindowCreated(window);
        });

        // Initial check of running apps - but only after proxy is ready
        // We'll check in the proxy initialization callback
        
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
        this._hdrEnabled = false;
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
              <arg type="a(iiduba(ssa{sv}))a{sv})" direction="in" name="logical_monitors"/>
              <arg type="a{sv}" direction="in" name="properties"/>
            </method>
          </interface>
        </node>`;

        // Use async initialization to avoid freezing
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            Gio.DBusNodeInfo.new_for_xml(DisplayConfigInterface).interfaces[0],
            DISPLAY_CONFIG_BUS_NAME,
            DISPLAY_CONFIG_PATH,
            DISPLAY_CONFIG_INTERFACE,
            null,
            (source, result) => {
                try {
                    this._displayConfigProxy = Gio.DBusProxy.new_for_bus_finish(result);
                    this._log('DisplayConfig proxy initialized');
                    
                    // Now that proxy is ready, do initial check
                    this._checkRunningApps();
                } catch (e) {
                    this._log(`Error initializing DisplayConfig proxy: ${e}`);
                }
            }
        );
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

        // Apply HDR state - only if it needs to change
        if (shouldEnableHDR && !shouldDisableHDR) {
            if (!this._hdrEnabled) {
                this._setHDR(true);
            }
        } else if (shouldDisableHDR && !shouldEnableHDR) {
            if (this._hdrEnabled) {
                this._setHDR(false);
            }
        } else if (!shouldEnableHDR && !shouldDisableHDR) {
            // No HDR-on or HDR-off apps running
            if (this._hdrEnabled) {
                this._setHDR(false);
            }
        }
    }

    _setHDR(enable) {
        if (!this._displayConfigProxy) {
            this._log('DisplayConfig proxy not available for HDR control');
            return;
        }

        // Use async call to avoid blocking and timeout issues
        this._displayConfigProxy.call(
            'GetCurrentState',
            null,
            Gio.DBusCallFlags.NONE,
            30000, // 30 second timeout
            null,
            (proxy, result) => {
                try {
                    const reply = proxy.call_finish(result);
                    const [serial, monitors, logicalMonitors, properties] = reply.deep_unpack();
                    this._log(`Current display state retrieved (serial: ${serial})`);

                    // Build a map of connector -> current mode ID from monitors info
                    const monitorModes = new Map();
                    monitors.forEach(monitor => {
                        const [monitorSpec, modes, monitorProps] = monitor;
                        const connector = monitorSpec[0]; // First element is connector name
                        
                        // Find the current mode in the modes array
                        // Each mode is: [modeId, width, height, refresh, ?, scales, properties]
                        // Look for the mode with 'is-current' property
                        const currentMode = modes.find(mode => {
                            const modeProperties = mode[6]; // 7th element contains properties
                            return modeProperties && modeProperties['is-current'] !== undefined;
                        });
                        
                        if (currentMode) {
                            const currentModeId = currentMode[0]; // First element is the mode ID
                            monitorModes.set(connector, currentModeId);
                            this._log(`Found current mode ${currentModeId} for monitor ${connector}`);
                        } else {
                            this._log(`Warning: No current mode found for monitor ${connector}`);
                        }
                    });

                    // Get selected monitors from settings, or use all if empty
                    const selectedMonitors = this._settings.get_strv('selected-monitors');
                    let modifiedCount = 0;

                    // Modify logical monitors to set HDR mode
                    const modifiedLogicalMonitors = logicalMonitors.map(logicalMonitor => {
                        const [x, y, scale, transform, isPrimary, monitorsInLogical, logicalProps] = logicalMonitor;
                        
                        // Log the structure for debugging
                        this._log(`Logical monitor structure - monitors count: ${monitorsInLogical.length}`);
                        if (monitorsInLogical.length > 0) {
                            this._log(`First monitor structure: ${JSON.stringify(monitorsInLogical[0])}`);
                            this._log(`First monitor tuple length: ${monitorsInLogical[0].length}`);
                        }
                        
                        const modifiedMonitorsInLogical = monitorsInLogical.map(monitorSpec => {
                            // GetCurrentState returns monitor specs as (ssss) - connector, vendor, product, serial
                            // ApplyMonitorsConfig expects (ssa{sv}) - connector, mode, properties
                            const connector = monitorSpec[0];  // connector name
                            const modeId = monitorModes.get(connector);
                            
                            if (!modeId) {
                                this._log(`Warning: No mode found for monitor ${connector}`);
                                return [connector, '', {}];
                            }
                            
                            this._log(`Monitor: ${connector}, mode ID: ${modeId}`);
                            
                            // Check if this monitor should be modified
                            const shouldModify = selectedMonitors.length === 0 || selectedMonitors.includes(connector);
                            
                            if (shouldModify) {
                                // For HDR: color-mode property is a u32 integer
                                // 0 = Default (SDR), 1 = BT2100 (HDR10)
                                // Based on Mutter DisplayConfig API specification
                                const colorMode = enable ? 1 : 0;
                                
                                // Create monitor properties with color-mode as u32
                                // ApplyMonitorsConfig expects (ssa{sv}) format
                                const monitorProps = {
                                    'color-mode': GLib.Variant.new_uint32(colorMode)
                                };
                                
                                this._log(`Setting HDR ${enable ? 'ON' : 'OFF'} (color-mode: ${colorMode}) for monitor: ${connector}`);
                                modifiedCount++;
                                
                                // Return in (ssa{sv}) format for ApplyMonitorsConfig
                                return [connector, modeId, monitorProps];
                            }
                            
                            // For unmodified monitors, still need to convert to (ssa{sv}) format
                            // with empty properties dict
                            return [connector, modeId, {}];
                        });
                        
                        return [x, y, scale, transform, isPrimary, modifiedMonitorsInLogical, logicalProps];
                    });

                    if (modifiedCount === 0) {
                        this._log('No monitors modified - check if monitors support HDR or are in selected list');
                        return;
                    }

                    // Apply the modified configuration
                    // Method: 1 = temporary/verify (no persistence, no confirmation)
                    // Method: 2 = persistent (requires confirmation)
                    const applyParams = new GLib.Variant(
                        '(uua(iiduba(ssa{sv}))a{sv})',
                        [serial, 1, modifiedLogicalMonitors, properties]
                    );

                    // Apply configuration asynchronously
                    this._displayConfigProxy.call(
                        'ApplyMonitorsConfig',
                        applyParams,
                        Gio.DBusCallFlags.NONE,
                        30000, // 30 second timeout
                        null,
                        (proxy, applyResult) => {
                            try {
                                proxy.call_finish(applyResult);
                                this._hdrEnabled = enable; // Update state after successful apply
                                this._log(`HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`);
                                
                                // Notify user
                                Main.notify(
                                    'Auto HDR',
                                    `HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`
                                );
                            } catch (e) {
                                this._log(`Error applying monitor config: ${e}`);
                                this._log(`Error details: ${e.message}`);
                                Main.notify(
                                    'Auto HDR Error',
                                    `Failed to apply HDR configuration: ${e.message}`
                                );
                            }
                        }
                    );
                } catch (e) {
                    this._log(`Error getting display state: ${e}`);
                    this._log(`Error details: ${e.message}`);
                    Main.notify(
                        'Auto HDR Error',
                        `Failed to get display state: ${e.message}`
                    );
                }
            }
        );
    }
}
