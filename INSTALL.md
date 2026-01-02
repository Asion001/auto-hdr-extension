# Installation Guide

## Quick Install

### Method 1: From Source (Recommended for Development)

```bash
# Clone the repository
git clone https://github.com/Asion001/auto-hdr-extension.git
cd auto-hdr-extension

# Build and install
make install

# Restart GNOME Shell
# On Xorg: Press Alt+F2, type 'r' and press Enter
# On Wayland: Log out and log back in

# Enable the extension
gnome-extensions enable auto-hdr@asion.dev
```

### Method 2: From Release Package

```bash
# Download the latest release
wget https://github.com/Asion001/auto-hdr-extension/releases/latest/download/auto-hdr@asion.dev.zip

# Install the extension
gnome-extensions install auto-hdr@asion.dev.zip

# Restart GNOME Shell (see above)

# Enable the extension
gnome-extensions enable auto-hdr@asion.dev
```

### Method 3: Manual Installation

```bash
# Clone the repository
git clone https://github.com/Asion001/auto-hdr-extension.git
cd auto-hdr-extension

# Compile schemas
glib-compile-schemas schemas/

# Copy to extensions directory
mkdir -p ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev
cp -r extension.js prefs.js metadata.json stylesheet.css schemas ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev/

# Restart GNOME Shell (see above)

# Enable the extension
gnome-extensions enable auto-hdr@asion.dev
```

## Verification

Check if the extension is installed and enabled:

```bash
gnome-extensions list --enabled | grep auto-hdr
```

If you see `auto-hdr@asion.dev`, the extension is installed and enabled!

## Configuration

Open the preferences:

```bash
gnome-extensions prefs auto-hdr@asion.dev
```

Or use the GNOME Extensions app.

## Troubleshooting

### Extension not showing up

1. Make sure you've restarted GNOME Shell
2. Check for errors:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

### Extension fails to enable

1. Verify GNOME Shell version:
   ```bash
   gnome-shell --version
   ```
   Must be version 49 or compatible.

2. Check schema compilation:
   ```bash
   ls ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev/schemas/gschemas.compiled
   ```
   If missing, run:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev/schemas/
   ```

### Preferences won't open

1. Check for errors in the log:
   ```bash
   journalctl -f -o cat | grep -i "auto-hdr\|prefs"
   ```

2. Reinstall the extension

## Uninstallation

```bash
# Disable the extension
gnome-extensions disable auto-hdr@asion.dev

# Remove the extension
rm -rf ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev

# Or use the Makefile
make uninstall
```

## Next Steps

After installation, configure the extension:

1. Open preferences
2. Add applications to "Turn HDR On" or "Turn HDR Off"
3. Optionally configure specific monitors
4. Enable debug logging if you want to troubleshoot
5. Launch an app and verify HDR toggles!

For more details, see the [README](README.md).
