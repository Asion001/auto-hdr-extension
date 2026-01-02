# Testing Guide

This document describes how to test the Auto HDR Extension.

## Prerequisites

- GNOME Shell 49
- HDR-capable display
- At least one application installed (for testing)

## Installation for Testing

1. Build and install the extension:
   ```bash
   ./dev.sh install
   ```

2. Restart GNOME Shell:
   - **Xorg**: Press `Alt+F2`, type `r`, press Enter
   - **Wayland**: Log out and log back in

3. Enable the extension:
   ```bash
   ./dev.sh enable
   ```

4. Enable debug logging:
   ```bash
   gnome-extensions prefs auto-hdr@asion.dev
   ```
   Toggle "Enable Debug Logging" on

5. Open a terminal to watch logs:
   ```bash
   ./dev.sh logs
   ```

## Test Cases

### Test 1: Extension Installation

**Objective**: Verify the extension installs correctly

**Steps**:
1. Run `./dev.sh install`
2. Check for errors in output
3. Verify files exist: `ls ~/.local/share/gnome-shell/extensions/auto-hdr@asion.dev/`

**Expected**:
- Installation completes without errors
- Extension directory contains: `extension.js`, `prefs.js`, `metadata.json`, `stylesheet.css`, `schemas/`
- Compiled schema exists: `schemas/gschemas.compiled`

### Test 2: Extension Activation

**Objective**: Verify the extension can be enabled

**Steps**:
1. Run `./dev.sh enable`
2. Check extension status: `gnome-extensions list --enabled | grep auto-hdr`
3. Check logs for "Auto HDR Extension enabled" message

**Expected**:
- Extension shows in enabled list
- No error messages in logs
- Extension loads successfully

### Test 3: Preferences UI Opens

**Objective**: Verify preferences window opens

**Steps**:
1. Run `gnome-extensions prefs auto-hdr@asion.dev`
2. Observe the preferences window

**Expected**:
- Window opens without errors
- Shows sections: "Turn HDR On", "Turn HDR Off", "Monitors", "Settings"
- All UI elements are visible and properly formatted

### Test 4: Add Application to HDR-On List

**Objective**: Test adding an app to enable HDR

**Steps**:
1. Open preferences
2. Click "Turn HDR On" expander
3. Click the "+" button
4. Search for an installed app (e.g., "Files", "Terminal")
5. Select the app and click "Add"

**Expected**:
- App picker dialog opens with search
- Apps are listed with icons
- Selected app appears in "Turn HDR On" list
- App shows with icon and name

### Test 5: Remove Application from List

**Objective**: Test removing an app from the list

**Steps**:
1. Open preferences
2. Find an app in "Turn HDR On" or "Turn HDR Off" list
3. Click the trash/delete button for that app

**Expected**:
- App is removed from the list immediately
- Setting is persisted (verify by closing and reopening preferences)

### Test 6: HDR Toggle on App Launch

**Objective**: Test automatic HDR enabling

**Steps**:
1. Add an app to "Turn HDR On" list (e.g., Files)
2. Close preferences
3. Watch logs in terminal
4. Launch the configured app

**Expected**:
- Log shows "HDR-on app detected: [app-id]"
- Log shows "HDR enabled"
- Notification appears: "HDR enabled"
- Display switches to HDR mode (if supported)

### Test 7: HDR Toggle on App Close

**Objective**: Test automatic HDR disabling when app closes

**Steps**:
1. With HDR-on app still running from Test 6
2. Close the application
3. Watch logs

**Expected**:
- Log shows "Tracked app stopped: [app-id]"
- Log shows "HDR disabled"
- Notification appears: "HDR disabled"
- Display switches back from HDR mode

### Test 8: Multiple Apps (HDR-On)

**Objective**: Test behavior with multiple HDR-on apps

**Steps**:
1. Add two apps to "Turn HDR On" list
2. Launch first app
3. Verify HDR enables
4. Launch second app
5. Close first app
6. Close second app

**Expected**:
- HDR enables when first app launches
- HDR stays enabled when second app launches
- HDR stays enabled when first app closes (second still running)
- HDR disables only when second app also closes

### Test 9: HDR-Off Apps

**Objective**: Test apps that disable HDR

**Steps**:
1. Add an app to "Turn HDR Off" list
2. Manually enable HDR (via GNOME Settings or another app)
3. Launch the HDR-off app

**Expected**:
- Log shows "HDR-off app detected: [app-id]"
- Log shows "HDR disabled"
- HDR disables when app launches
- HDR re-enables when app closes (if no other HDR-off apps running)

### Test 10: Debug Logging Toggle

**Objective**: Test debug logging setting

**Steps**:
1. Open preferences
2. Toggle "Enable Debug Logging" off
3. Launch an app from the configured lists
4. Check logs - should see minimal/no output
5. Toggle logging back on
6. Launch app again
7. Check logs - should see detailed messages

**Expected**:
- With logging off: No/minimal log messages
- With logging on: Detailed messages about app detection and HDR changes

### Test 11: Settings Persistence

**Objective**: Verify settings are saved

**Steps**:
1. Configure apps in preferences
2. Close preferences
3. Disable and re-enable extension: `./dev.sh disable && ./dev.sh enable`
4. Open preferences again

**Expected**:
- All configured apps are still in their lists
- Settings (debug logging, monitors) are preserved

### Test 12: Monitor Selection

**Objective**: Test monitor configuration

**Steps**:
1. Open preferences
2. Expand "Monitors" section
3. Add a monitor connector (e.g., "HDMI-1")

**Expected**:
- Monitor can be added
- Setting is saved
- (Note: Actual per-monitor HDR control depends on GNOME/hardware support)

### Test 13: Extension Disable

**Objective**: Test clean extension disable

**Steps**:
1. With extension enabled and apps configured
2. Run `./dev.sh disable`
3. Check logs

**Expected**:
- Log shows "Auto HDR Extension disabled"
- No errors in logs
- Extension stops tracking apps

### Test 14: Reinstall/Upgrade

**Objective**: Test reinstallation

**Steps**:
1. With extension installed and configured
2. Run `./dev.sh reinstall`
3. Re-enable extension
4. Check preferences

**Expected**:
- Reinstallation completes without errors
- Settings are preserved (stored in dconf, not in extension files)
- Extension works as before

## Common Issues

### Extension doesn't load
- Check GNOME Shell version: `gnome-shell --version`
- Check for syntax errors in logs
- Try reinstalling: `./dev.sh reinstall`

### HDR doesn't toggle
- Verify display supports HDR
- Check GNOME Settings → Displays for HDR option
- Enable debug logging and check what's happening
- Verify correct app ID is used (check logs when launching app)

### Preferences don't open
- Check for errors: `journalctl -f -o cat | grep -i prefs`
- Try reinstalling

### Apps not detected
- Enable debug logging
- Launch app and check logs for app ID
- Verify app ID matches what's in settings
- Some apps might use different IDs than expected

## Reporting Issues

When reporting bugs, please include:

1. GNOME Shell version: `gnome-shell --version`
2. Extension version (from metadata.json)
3. Steps to reproduce
4. Expected vs actual behavior
5. Relevant logs (with debug logging enabled)
6. Display hardware information

## Automated Testing

Currently, the extension uses manual testing. Future enhancements could include:

- Unit tests for helper functions
- Integration tests with mock GNOME Shell objects
- CI tests for code quality and syntax

## Performance Testing

Monitor extension performance:

```bash
# Check memory usage
gnome-shell-perf-tool

# Monitor CPU usage
top -p $(pgrep -f gnome-shell)
```

Extension should have minimal impact on system resources.
