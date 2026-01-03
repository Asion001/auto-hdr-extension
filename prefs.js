import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AutoHDRPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // HDR On Apps Group
        const hdrOnGroup = new Adw.PreferencesGroup({
            title: 'Turn HDR On',
            description: 'Applications that will enable HDR when launched',
        });
        page.add(hdrOnGroup);

        // HDR On Apps List
        const hdrOnAppsRow = this._createAppListRow(
            settings,
            'hdr-on-apps',
            'HDR On Applications',
            'Select apps that should turn HDR on'
        );
        hdrOnGroup.add(hdrOnAppsRow);

        // HDR Off Apps Group
        const hdrOffGroup = new Adw.PreferencesGroup({
            title: 'Turn HDR Off',
            description: 'Applications that will disable HDR when launched',
        });
        page.add(hdrOffGroup);

        // HDR Off Apps List
        const hdrOffAppsRow = this._createAppListRow(
            settings,
            'hdr-off-apps',
            'HDR Off Applications',
            'Select apps that should turn HDR off'
        );
        hdrOffGroup.add(hdrOffAppsRow);

        // Monitors Group
        const monitorsGroup = new Adw.PreferencesGroup({
            title: 'Monitors',
            description: 'Select monitors to control (leave empty for all HDR-capable monitors)',
        });
        page.add(monitorsGroup);

        // Monitor selection row
        const monitorRow = this._createMonitorRow(settings);
        monitorsGroup.add(monitorRow);

        // Settings Group
        const settingsGroup = new Adw.PreferencesGroup({
            title: 'Settings',
            description: 'Extension settings',
        });
        page.add(settingsGroup);

        // Debug logging switch
        const loggingRow = new Adw.ActionRow({
            title: 'Enable Debug Logging',
            subtitle: 'Log extension activity to system journal',
        });
        const loggingSwitch = new Gtk.Switch({
            active: settings.get_boolean('enable-logging'),
            valign: Gtk.Align.CENTER,
        });
        settings.bind(
            'enable-logging',
            loggingSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        loggingRow.add_suffix(loggingSwitch);
        loggingRow.activatable_widget = loggingSwitch;
        settingsGroup.add(loggingRow);
    }

    _createAppListRow(settings, key, title, subtitle) {
        const row = new Adw.ExpanderRow({
            title: title,
            subtitle: subtitle,
        });

        // Get current apps
        const apps = settings.get_strv(key);

        // Add current apps to the list
        apps.forEach(appId => {
            const appRow = this._createAppRow(settings, key, appId);
            if (appRow) {
                row.add_row(appRow);
            }
        });

        // Add button to add new app
        const addButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        addButton.connect('clicked', () => {
            this._showAppChooserDialog(settings, key, row);
        });
        row.add_suffix(addButton);

        return row;
    }

    _createAppRow(settings, key, appId) {
        const appInfo = Gio.DesktopAppInfo.new(appId);

        if (!appInfo) {
            return null;
        }

        const appRow = new Adw.ActionRow({
            title: appInfo.get_display_name(),
            subtitle: appId,
        });

        // Add icon
        const icon = appInfo.get_icon();
        if (icon) {
            const image = new Gtk.Image({
                gicon: icon,
                pixel_size: 32,
            });
            appRow.add_prefix(image);
        }

        // Add remove button
        const removeButton = new Gtk.Button({
            icon_name: 'edit-delete-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'destructive-action'],
        });
        removeButton.connect('clicked', () => {
            const apps = settings.get_strv(key);
            const index = apps.indexOf(appId);
            if (index > -1) {
                apps.splice(index, 1);
                settings.set_strv(key, apps);
            }
            appRow.get_parent().remove(appRow);
        });
        appRow.add_suffix(removeButton);

        return appRow;
    }

    _showAppChooserDialog(settings, key, expanderRow) {
        const dialog = new Gtk.Dialog({
            title: 'Select Application',
            modal: true,
            use_header_bar: 1,
        });

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button('Add', Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);

        const contentArea = dialog.get_content_area();
        contentArea.set_margin_top(12);
        contentArea.set_margin_bottom(12);
        contentArea.set_margin_start(12);
        contentArea.set_margin_end(12);

        // Create search entry
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Search applications...',
            hexpand: true,
        });
        contentArea.append(searchEntry);

        // Create scrolled window for app list
        const scrolled = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
            min_content_height: 300,
            min_content_width: 400,
        });
        contentArea.append(scrolled);

        // Create list box
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            css_classes: ['boxed-list'],
        });
        scrolled.set_child(listBox);

        // Populate with apps
        const apps = Gio.AppInfo.get_all();
        const currentApps = settings.get_strv(key);

        let selectedAppId = null;

        apps.forEach(appInfo => {
            const appId = appInfo.get_id();

            if (!appId || !appInfo.should_show()) {
                return;
            }

            // Skip already added apps
            if (currentApps.includes(appId)) {
                return;
            }

            const row = new Gtk.ListBoxRow();
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            const icon = appInfo.get_icon();
            if (icon) {
                const image = new Gtk.Image({
                    gicon: icon,
                    pixel_size: 32,
                });
                box.append(image);
            }

            const label = new Gtk.Label({
                label: appInfo.get_display_name(),
                xalign: 0,
                hexpand: true,
            });
            box.append(label);

            row.set_child(box);
            row._appId = appId;
            row._appName = appInfo.get_display_name().toLowerCase();
            listBox.append(row);
        });

        // Filter function
        const filterApps = () => {
            const searchText = searchEntry.get_text().toLowerCase();
            let child = listBox.get_first_child();
            while (child) {
                const visible = !searchText || child._appName.includes(searchText);
                child.set_visible(visible);
                child = child.get_next_sibling();
            }
        };

        searchEntry.connect('search-changed', filterApps);

        listBox.connect('row-activated', (listBox, row) => {
            selectedAppId = row._appId;
        });

        dialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.OK) {
                const selectedRow = listBox.get_selected_row();
                if (selectedRow) {
                    selectedAppId = selectedRow._appId;
                }

                if (selectedAppId) {
                    const apps = settings.get_strv(key);
                    if (!apps.includes(selectedAppId)) {
                        apps.push(selectedAppId);
                        settings.set_strv(key, apps);

                        const appRow = this._createAppRow(settings, key, selectedAppId);
                        if (appRow) {
                            expanderRow.add_row(appRow);
                        }
                    }
                }
            }
            dialog.destroy();
        });

        dialog.present();
    }

    _createMonitorRow(settings) {
        const row = new Adw.ExpanderRow({
            title: 'Selected Monitors',
            subtitle: 'Choose which monitors to control (empty = all)',
        });

        const selectedMonitors = settings.get_strv('selected-monitors');

        // Add info label if no specific monitors selected
        if (selectedMonitors.length === 0) {
            const infoRow = new Adw.ActionRow({
                title: 'All HDR-capable monitors',
                subtitle: 'HDR will be controlled on all capable displays',
            });
            row.add_row(infoRow);
        }

        // Note: Monitor selection would require querying the display backend
        // For now, we'll add a simple text entry for monitor connectors
        const addMonitorRow = new Adw.ActionRow({
            title: 'Add Monitor',
            subtitle: 'Enter monitor connector name (e.g., HDMI-1)',
        });

        const monitorEntry = new Gtk.Entry({
            placeholder_text: 'Monitor connector',
            valign: Gtk.Align.CENTER,
        });

        const addButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });

        addButton.connect('clicked', () => {
            const connector = monitorEntry.get_text().trim();
            if (connector) {
                const monitors = settings.get_strv('selected-monitors');
                if (!monitors.includes(connector)) {
                    monitors.push(connector);
                    settings.set_strv('selected-monitors', monitors);
                    monitorEntry.set_text('');
                }
            }
        });

        addMonitorRow.add_suffix(monitorEntry);
        addMonitorRow.add_suffix(addButton);
        row.add_row(addMonitorRow);

        return row;
    }
}
