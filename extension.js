import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const DISPLAY_CONFIG_INTERFACE = 'org.gnome.Mutter.DisplayConfig';
const DISPLAY_CONFIG_PATH = '/org/gnome/Mutter/DisplayConfig';
const DISPLAY_CONFIG_BUS_NAME = 'org.gnome.Mutter.DisplayConfig';
const DISPLAY_CONFIG_XML = `
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

class HDRDisplayManager {
    constructor(extension) {
        this._extension = extension;
        this._displayConfigProxy = null;
        this._displayConfigSignalId = null;
        this._externalChangeTimeout = null;
    }

    init() {
        Gio.DBusProxy.new_for_bus(
            Gio.BusType.SESSION,
            Gio.DBusProxyFlags.NONE,
            Gio.DBusNodeInfo.new_for_xml(DISPLAY_CONFIG_XML).interfaces[0],
            DISPLAY_CONFIG_BUS_NAME,
            DISPLAY_CONFIG_PATH,
            DISPLAY_CONFIG_INTERFACE,
            null,
            (source, result) => {
                this._displayConfigProxy = Gio.DBusProxy.new_for_bus_finish(result);
                this._extension._log('DisplayConfig proxy initialized');

                this._displayConfigSignalId = this._displayConfigProxy.connect('g-signal', (proxy, senderName, signalName) => {
                    if (!signalName || signalName === 'MonitorsChanged') {
                        this._extension._log(`Monitor configuration changed externally (signal: ${signalName || 'any'})`);
                        this._onExternalMonitorChange();
                    }
                });

                this._extension._checkRunningApps();
            }
        );
    }

    destroy() {
        if (this._displayConfigProxy && this._displayConfigSignalId) {
            this._displayConfigProxy.disconnect(this._displayConfigSignalId);
            this._displayConfigSignalId = null;
        }

        if (this._externalChangeTimeout) {
            GLib.source_remove(this._externalChangeTimeout);
            this._externalChangeTimeout = null;
        }

        this._displayConfigProxy = null;
    }

    _onExternalMonitorChange() {
        if (this._externalChangeTimeout) {
            GLib.source_remove(this._externalChangeTimeout);
        }

        this._externalChangeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this._externalChangeTimeout = null;

            if (this._extension._indicator) {
                this.getCurrentHDRState((hdrState) => {
                    const anyEnabled = Array.from(hdrState.values()).some(enabled => enabled);

                    this._extension._hdrEnabled = anyEnabled;
                    this._extension._indicator.updateIndicator(anyEnabled);
                    this._extension._indicator.refreshMenu();
                });
            }

            return GLib.SOURCE_REMOVE;
        });
    }

    setHDR(enable) {
        if (!this._displayConfigProxy) {
            this._extension._log('DisplayConfig proxy not available for HDR control');
            return;
        }

        this._displayConfigProxy.call(
            'GetCurrentState',
            null,
            Gio.DBusCallFlags.NONE,
            30000,
            null,
            (proxy, result) => {
                try {
                    const reply = proxy.call_finish(result);
                    const [serial, monitors, logicalMonitors, properties] = reply.deep_unpack();
                    this._extension._log(`Current display state retrieved (serial: ${serial})`);

                    const monitorModes = new Map();
                    monitors.forEach(monitor => {
                        const [monitorSpec, modes, _monitorProps] = monitor;
                        const connector = monitorSpec[0];

                        const currentMode = modes.find(mode => {
                            const modeProperties = mode[6];
                            return modeProperties && modeProperties['is-current'] !== undefined;
                        });

                        if (currentMode) {
                            const currentModeId = currentMode[0];
                            monitorModes.set(connector, currentModeId);
                            this._extension._log(`Found current mode ${currentModeId} for monitor ${connector}`);
                        } else {
                            this._extension._log(`Warning: No current mode found for monitor ${connector}`);
                        }
                    });

                    const selectedMonitors = this._extension._settings.get_strv('selected-monitors');
                    let modifiedCount = 0;

                    const modifiedLogicalMonitors = logicalMonitors.map(logicalMonitor => {
                        const [x, y, scale, transform, isPrimary, monitorsInLogical, logicalProps] = logicalMonitor;

                        this._extension._log(`Logical monitor structure - monitors count: ${monitorsInLogical.length}`);
                        if (monitorsInLogical.length > 0) {
                            this._extension._log(`First monitor structure: ${JSON.stringify(monitorsInLogical[0])}`);
                            this._extension._log(`First monitor tuple length: ${monitorsInLogical[0].length}`);
                        }

                        const modifiedMonitorsInLogical = monitorsInLogical.map(monitorSpec => {
                            const connector = monitorSpec[0];
                            const modeId = monitorModes.get(connector);

                            if (!modeId) {
                                this._extension._log(`Warning: No mode found for monitor ${connector}`);
                                return [connector, '', {}];
                            }

                            this._extension._log(`Monitor: ${connector}, mode ID: ${modeId}`);

                            const shouldModify = selectedMonitors.length === 0 || selectedMonitors.includes(connector);

                            if (shouldModify) {
                                const colorMode = enable ? 1 : 0;
                                const monitorProps = {
                                    'color-mode': GLib.Variant.new_uint32(colorMode)
                                };

                                this._extension._log(`Setting HDR ${enable ? 'ON' : 'OFF'} (color-mode: ${colorMode}) for monitor: ${connector}`);
                                modifiedCount++;

                                return [connector, modeId, monitorProps];
                            }

                            return [connector, modeId, {}];
                        });

                        return [x, y, scale, transform, isPrimary, modifiedMonitorsInLogical, logicalProps];
                    });

                    if (modifiedCount === 0) {
                        this._extension._log('No monitors modified - check if monitors support HDR or are in selected list');
                        return;
                    }

                    const applyParams = new GLib.Variant(
                        '(uua(iiduba(ssa{sv}))a{sv})',
                        [serial, 1, modifiedLogicalMonitors, properties]
                    );

                    this._displayConfigProxy.call(
                        'ApplyMonitorsConfig',
                        applyParams,
                        Gio.DBusCallFlags.NONE,
                        30000,
                        null,
                        (applyProxy, applyResult) => {
                            try {
                                applyProxy.call_finish(applyResult);
                                this._extension._hdrEnabled = enable;
                                this._extension._log(`HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`);

                                if (this._extension._indicator) {
                                    this._extension._indicator.updateIndicator(enable);
                                }

                                const showEnabledNotif = this._extension._settings.get_boolean('show-hdr-enabled-notification');
                                const showDisabledNotif = this._extension._settings.get_boolean('show-hdr-disabled-notification');

                                if ((enable && showEnabledNotif) || (!enable && showDisabledNotif)) {
                                    this._extension._showNotification(
                                        'Auto HDR',
                                        `HDR ${enable ? 'enabled' : 'disabled'} on ${modifiedCount} monitor(s)`
                                    );
                                }
                            } catch (e) {
                                this._extension._log(`Error applying monitor config: ${e}`);
                                this._extension._log(`Error details: ${e.message}`);
                                this._extension._showNotification(
                                    'Auto HDR Error',
                                    `Failed to apply HDR configuration: ${e.message}`
                                );
                            }
                        }
                    );
                } catch (e) {
                    this._extension._log(`Error getting display state: ${e}`);
                    this._extension._log(`Error details: ${e.message}`);
                    this._extension._showNotification(
                        'Auto HDR Error',
                        `Failed to get display state: ${e.message}`
                    );
                }
            }
        );
    }

    getHDRCapableMonitors(callback) {
        if (!this._displayConfigProxy) {
            callback([]);
            return;
        }

        this._displayConfigProxy.call(
            'GetCurrentState',
            null,
            Gio.DBusCallFlags.NONE,
            30000,
            null,
            (proxy, result) => {
                try {
                    const reply = proxy.call_finish(result);
                    const [_serial, monitors, _logicalMonitors, _properties] = reply.deep_unpack();

                    const hdrMonitors = [];

                    monitors.forEach(monitor => {
                        const [monitorSpec, _modes, _monitorProps] = monitor;
                        const connector = monitorSpec[0];
                        const vendor = monitorSpec[1];
                        const product = monitorSpec[2];

                        const monitorName = `${vendor} ${product}`.trim() || connector;

                        hdrMonitors.push({
                            connector: connector,
                            name: monitorName
                        });
                    });

                    callback(hdrMonitors);
                } catch (e) {
                    this._extension._log(`Error getting HDR monitors: ${e}`);
                    callback([]);
                }
            }
        );
    }

    getCurrentHDRState(callback) {
        if (!this._displayConfigProxy) {
            callback(new Map());
            return;
        }

        this._displayConfigProxy.call(
            'GetCurrentState',
            null,
            Gio.DBusCallFlags.NONE,
            30000,
            null,
            (proxy, result) => {
                try {
                    const reply = proxy.call_finish(result);
                    const [_serial, _monitors, logicalMonitors, _properties] = reply.deep_unpack();

                    const hdrState = new Map();

                    logicalMonitors.forEach(logicalMonitor => {
                        const [_x, _y, _scale, _transform, _isPrimary, monitorsInLogical, _logicalProps] = logicalMonitor;

                        monitorsInLogical.forEach(monitorSpec => {
                            const connector = monitorSpec[0];
                            hdrState.set(connector, this._extension._hdrEnabled);
                        });
                    });

                    callback(hdrState);
                } catch (e) {
                    this._extension._log(`Error getting HDR state: ${e}`);
                    callback(new Map());
                }
            }
        );
    }

    toggleMonitorHDR(connector, enable) {
        this._extension._log(`Toggle HDR for monitor ${connector}: ${enable}`);

        const previousMonitors = this._extension._settings.get_strv('selected-monitors');
        this._extension._settings.set_strv('selected-monitors', [connector]);
        this.setHDR(enable);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._extension._settings.set_strv('selected-monitors', previousMonitors);
            return GLib.SOURCE_REMOVE;
        });

        if (this._extension._indicator) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._extension._indicator.refreshMenu();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    toggleAllHDR(enable) {
        this._extension._log(`Toggle HDR for all monitors: ${enable}`);
        this.setHDR(enable);

        if (this._extension._indicator) {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._extension._indicator.refreshMenu();
                return GLib.SOURCE_REMOVE;
            });
        }
    }
}

// Individual monitor toggle in the expanded menu
const HDRMonitorToggle = GObject.registerClass(
    class HDRMonitorToggle extends PopupMenu.PopupSwitchMenuItem {
        _init(extension, monitorConnector, monitorName) {
            super._init(monitorName || monitorConnector, false);

            this._extension = extension;
            this._monitorConnector = monitorConnector;

            // Store signal ID to enable blocking during programmatic state updates
            this._toggledId = this.connect('toggled', (item, state) => {
                this._extension._displayManager.toggleMonitorHDR(this._monitorConnector, state);
            });
        }

        updateState(enabled) {
            // Block signals while updating state to prevent infinite loops
            this.block_signal_handler(this._toggledId);
            this.checked = enabled;
            this.unblock_signal_handler(this._toggledId);
        }
    });

// Main HDR Quick Settings Menu Toggle
const HDRMenuToggle = GObject.registerClass(
    class HDRMenuToggle extends QuickSettings.QuickMenuToggle {
        _init(extension) {
            super._init({
                title: 'HDR',
                subtitle: 'High Dynamic Range',
                iconName: 'preferences-color-symbolic',
                toggleMode: true,
            });

            this._extension = extension;
            this._monitorToggles = new Map();

            // Connect main toggle handler
            this.connect('clicked', () => {
            // When the main toggle is clicked, toggle HDR for all selected monitors
                this._extension._displayManager.toggleAllHDR(this.checked);
            });

            // Build the menu with monitor toggles - defer to next tick
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._buildMenu();
                return GLib.SOURCE_REMOVE;
            });

            // Update states when the menu is opened
            this.menu.connect('open-state-changed', (menu, isOpen) => {
                if (isOpen) {
                    this._updateStates();
                }
            });
        }

        _buildMenu() {
        // Get monitors from extension's display config
            this._extension._displayManager.getHDRCapableMonitors((monitors) => {
            // Clear existing menu items
                this.menu.removeAll();
                this._monitorToggles.clear();

                if (monitors.length === 0) {
                // No HDR monitors found - just add a simple label
                    const noMonitorsItem = new PopupMenu.PopupMenuItem('No HDR monitors detected', {
                        reactive: false,
                        can_focus: false
                    });
                    this.menu.addMenuItem(noMonitorsItem);
                    return;
                }

                // Add toggle for each monitor
                monitors.forEach(monitor => {
                    const toggle = new HDRMonitorToggle(
                        this._extension,
                        monitor.connector,
                        monitor.name
                    );
                    this._monitorToggles.set(monitor.connector, toggle);
                    this.menu.addMenuItem(toggle);
                });

                // Add separator
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                // Add Auto HDR toggle
                const autoHDRToggle = new PopupMenu.PopupSwitchMenuItem('Automatic HDR', this._extension._settings.get_boolean('enable-auto-hdr'));
                autoHDRToggle.connect('toggled', (item, state) => {
                    this._extension._settings.set_boolean('enable-auto-hdr', state);
                });
                this.menu.addMenuItem(autoHDRToggle);

                // Update initial states
                this._updateStates();
            });
        }

        _updateStates() {
        // Update the state of all toggles based on current HDR state
            this._extension._displayManager.getCurrentHDRState((hdrState) => {
                let anyEnabled = false;

                this._monitorToggles.forEach((toggle, connector) => {
                    const enabled = hdrState.get(connector) || false;
                    toggle.updateState(enabled);

                    if (enabled) anyEnabled = true;
                });

                // Update main toggle state
                this.checked = anyEnabled;

                // Update icon based on state
                this.iconName = anyEnabled ?
                    'preferences-color-symbolic' :
                    'preferences-desktop-display-symbolic';
            });
        }

        refreshMenu() {
            this._buildMenu();
        }
    });

// Indicator to hold the menu toggle
const HDRIndicator = GObject.registerClass(
    class HDRIndicator extends QuickSettings.SystemIndicator {
        _init(extension) {
            super._init();

            this._extension = extension;

            // Create the menu toggle
            this._menuToggle = new HDRMenuToggle(extension);

            // Add to quick settings
            this.quickSettingsItems.push(this._menuToggle);

            // Add indicator icon (optional - shows in top bar)
            this._indicator = this._addIndicator();
            this._indicator.icon_name = 'preferences-color-symbolic';
            this._indicator.visible = false; // Hide by default, show when HDR is on
        }

        updateIndicator(hdrEnabled) {
            this._indicator.visible = hdrEnabled;
        }

        refreshMenu() {
            this._menuToggle.refreshMenu();
        }

        destroy() {
            this.quickSettingsItems.forEach(item => item.destroy());
            super.destroy();
        }
    });

export default class AutoHDRExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings = null;
        this._appSystem = null;
        this._windowTracker = null;
        this._runningAppsChangedId = null;
        this._settingsChangedId = null;
        this._windowsChangedIds = [];
        this._windowCreatedId = null;
        this._displayManager = null;
        this._trackedApps = new Set();
        this._hdrEnabled = false; // Track current HDR state
        this._indicator = null; // Quick Settings indicator
    }

    enable() {
        this._settings = this.getSettings();
        this._appSystem = Shell.AppSystem.get_default();
        this._windowTracker = Shell.WindowTracker.get_default();

        // Initialize DBus proxy for DisplayConfig asynchronously
        this._displayManager = new HDRDisplayManager(this);
        this._displayManager.init();

        // Create and add Quick Settings indicator if enabled
        if (this._settings.get_boolean('show-quick-settings-toggle')) {
            this._indicator = new HDRIndicator(this);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        }

        // Watch for changes to the quick settings toggle setting
        this._settingsChangedId = this._settings.connect('changed::show-quick-settings-toggle', () => {
            this._updateQuickSettingsVisibility();
        });

        // Connect to app system changes
        this._runningAppsChangedId = this._appSystem.connect(
            'app-state-changed',
            this._onAppStateChanged.bind(this)
        );

        // Track window changes for better detection
        this._windowCreatedId = global.display.connect('window-created', (display, window) => {
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

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        this._windowsChangedIds.forEach(id => {
            global.window_manager.disconnect(id);
        });
        this._windowsChangedIds = [];

        if (this._windowCreatedId) {
            global.display.disconnect(this._windowCreatedId);
            this._windowCreatedId = null;
        }

        if (this._displayManager) {
            this._displayManager.destroy();
            this._displayManager = null;
        }

        // Cleanup Quick Settings indicator
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        // Cleanup
        this._trackedApps.clear();
        this._hdrEnabled = false;
        this._settings = null;
        this._appSystem = null;
        this._windowTracker = null;

        this._log('Auto HDR Extension disabled');
    }

    _updateQuickSettingsVisibility() {
        const shouldShow = this._settings.get_boolean('show-quick-settings-toggle');

        if (shouldShow && !this._indicator) {
            // Create and add indicator
            this._indicator = new HDRIndicator(this);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
            this._log('Quick Settings toggle enabled');
        } else if (!shouldShow && this._indicator) {
            // Remove and destroy indicator
            this._indicator.destroy();
            this._indicator = null;
            this._log('Quick Settings toggle disabled');
        }
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
        // Check if automatic HDR is enabled
        if (!this._settings.get_boolean('enable-auto-hdr')) {
            this._log('Automatic HDR is disabled, skipping app check');
            return;
        }

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
                    this._displayManager.setHDR(false);
                }
            }

            if (hdrOffApps.includes(appId)) {
                // HDR-off app closed, enable HDR if no other HDR-off apps running
                const otherHdrOffAppsRunning = runningAppIds.some(id => hdrOffApps.includes(id));
                if (!otherHdrOffAppsRunning) {
                    this._displayManager.setHDR(true);
                }
            }
        }

        // Apply HDR state - only if it needs to change
        if (shouldEnableHDR && !shouldDisableHDR) {
            if (!this._hdrEnabled) {
                this._displayManager.setHDR(true);
            }
        } else if (shouldDisableHDR && !shouldEnableHDR) {
            if (this._hdrEnabled) {
                this._displayManager.setHDR(false);
            }
        } else if (!shouldEnableHDR && !shouldDisableHDR) {
            // No HDR-on or HDR-off apps running
            if (this._hdrEnabled) {
                this._displayManager.setHDR(false);
            }
        }
    }

    _showNotification(title, message) {
        // Use Main.notify() for simple transient notifications in GNOME Shell 49
        // This is the recommended approach for extensions
        Main.notify(title, message);
    }

}
