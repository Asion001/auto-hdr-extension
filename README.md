# Auto HDR Extension for GNOME Shell

Automatically enables or disables HDR (High Dynamic Range) for specific applications on GNOME Shell 49+.

## Why This Extension?

HDR support is now available on Linux, which is great for watching HDR content and gaming. However, many HDR monitors have a common issue: they dim the display when large portions of white are shown, which can be annoying during regular desktop use or when working with productivity applications.

This extension was created to solve this problem. Since I primarily watch HDR content in MPV player and prefer SDR (Standard Dynamic Range) for everything else, this extension automatically manages HDR state based on which applications are running. This means:

- **HDR automatically enables** when you launch your media player or games
- **HDR automatically disables** when you close those apps or switch to productivity work
- **No manual toggling** needed through GNOME Settings

If you find yourself in a similar situation—enjoying HDR content but dealing with annoying dimming during regular use—this extension provides a seamless, automated solution.

## Features

- 🎮 **Automatic HDR Control**: Turn HDR on/off when specific applications launch
- 🖥️ **Monitor Selection**: Control HDR for specific monitors or all HDR-capable displays
- 🚀 **Quick Settings Integration**: Toggle HDR directly from the system menu with expandable monitor controls
- ⚙️ **Simple Configuration**: Easy-to-use preferences UI for managing apps and monitors
- 🔍 **App Detection**: Tracks running applications and responds to app launches/closures
- 🪵 **Debug Logging**: Optional logging for troubleshooting

## Requirements

- GNOME Shell 49
- HDR-capable display(s)
- GNOME's experimental HDR support enabled

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/Asion001/auto-hdr-extension.git
   cd auto-hdr-extension
   ```

2. Build and install:
   ```bash
   make install
   ```

3. Restart GNOME Shell:
   - On Xorg: Press `Alt+F2`, type `r`, and press Enter
   - On Wayland: Log out and log back in

4. Enable the extension:
   ```bash
   gnome-extensions enable auto-hdr@asion.dev
   ```

### From Release Package

1. Download the latest `.zip` file from the [Releases](https://github.com/Asion001/auto-hdr-extension/releases) page

2. Extract and install:
   ```bash
   gnome-extensions install auto-hdr@asion.dev.zip
   ```

3. Restart GNOME Shell and enable the extension as above

## Configuration

1. Open GNOME Extensions app or run:
   ```bash
   gnome-extensions prefs auto-hdr@asion.dev
   ```

2. Configure your preferences:
   - **Turn HDR On**: Add applications that should enable HDR when launched
   - **Turn HDR Off**: Add applications that should disable HDR when launched
   - **Monitors**: Specify monitor connectors (leave empty for all HDR-capable displays)
   - **Settings**:
     - **Show Quick Settings Toggle**: Enable/disable the HDR button in the system menu (enabled by default)
   - **Notifications**:
     - **Show HDR Enabled Notification**: Display notification when HDR is turned on (enabled by default)
     - **Show HDR Disabled Notification**: Display notification when HDR is turned off (enabled by default)
     - **Enable Debug Logging**: Turn on detailed logging for troubleshooting

### Example Use Cases

- **Gaming**: Add your games to "Turn HDR On" to automatically enable HDR when playing
- **Color-critical work**: Add Photoshop/GIMP to "Turn HDR Off" to ensure accurate color representation
- **Mixed workflow**: Configure different apps based on your HDR preferences

## Usage

The extension provides both automatic and manual HDR control:

### Automatic Mode

Once configured, the extension works automatically:

1. Launch an app in your "Turn HDR On" list → HDR enables
2. Close the app → HDR disables (if no other HDR apps are running)
3. Launch an app in your "Turn HDR Off" list → HDR disables
4. Close the app → HDR re-enables (if no other HDR-off apps are running)

### Manual Control via Quick Settings

You can also manually toggle HDR using the Quick Settings menu:

1. **Quick Toggle**: Click the system menu (power/audio/network icons) in the top-right corner
2. **HDR Button**: Look for the "HDR" toggle button with a color icon
3. **Quick Toggle**: Click the button to toggle HDR for all configured monitors
4. **Expanded View**: Click the arrow next to the HDR button to see individual monitor controls
5. **Per-Monitor Control**: Toggle HDR for specific monitors independently
6. **Automatic HDR Toggle**: In the expanded view, use the "Automatic HDR" toggle to enable/disable app-based HDR control

The HDR icon in the top bar will be visible when HDR is enabled on any monitor.

Notifications will appear when HDR state changes.

## Technical Details

### HDR Control Implementation

The extension uses the **Mutter DisplayConfig DBus API** (`org.gnome.Mutter.DisplayConfig`) to control HDR:

- **GetCurrentState**: Retrieves current display configuration
- **ApplyMonitorsConfig**: Applies new display settings including color mode
- **Color Modes**:
  - `bt2100-pq`: HDR10 mode (Perceptual Quantizer)
  - `default`: Standard Dynamic Range (SDR)

This is the proper way to control HDR in GNOME, as used by GNOME Settings and command-line tools like `gdctl`.

### Architecture

- **App Tracking**: Uses `Shell.AppSystem` and `Shell.WindowTracker` to monitor running applications
- **State Management**: Tracks which HDR-on/off apps are running to make intelligent decisions
- **DBus Integration**: Direct integration with Mutter's display configuration API
- **Per-Monitor Control**: Supports selecting specific monitors or all HDR-capable displays

## Building

Build the extension:
```bash
make build
```

Create a distribution package:
```bash
make zip
```

The package will be created in `build/auto-hdr@asion.dev.zip`

## Development

### Project Structure

```
auto-hdr-extension/
├── extension.js              # Main extension logic
├── prefs.js                  # Preferences UI
├── metadata.json             # Extension metadata
├── stylesheet.css            # Extension styles
├── schemas/                  # GSettings schemas
│   └── org.gnome.shell.extensions.auto-hdr.gschema.xml
├── scripts/                  # Utility scripts
│   └── release.sh            # Version management and release script
├── .github/workflows/        # CI/CD pipelines
│   └── ci.yml
├── Makefile                  # Build scripts
└── README.md                 # This file
```

### Testing

1. Enable debug logging in preferences
2. Monitor logs:
   ```bash
   journalctl -f -o cat | grep "Auto HDR"
   ```

### Creating a Release

To create a new release, use the provided release script:

```bash
./scripts/release.sh 1.0.2
```

This script will:
1. Update version in `package.json` and `metadata.json`
2. Increment the integer version in `metadata.json`
3. Commit the version changes
4. Create a git tag (e.g., `v1.0.2`)
5. Push commits and tags to GitHub

The GitHub Actions CI/CD pipeline will then automatically:
- Run linting and build checks
- Create a GitHub release
- Upload the extension package

## Troubleshooting

### Extension not working

1. Verify GNOME Shell version:
   ```bash
   gnome-shell --version
   ```

2. Check if extension is enabled:
   ```bash
   gnome-extensions list --enabled | grep auto-hdr
   ```

3. View extension logs:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell
   ```

### HDR not toggling

1. Verify your display supports HDR
2. Check GNOME Settings → Displays for HDR option
3. Ensure the app ID matches what you added in preferences
4. Enable debug logging to see what's happening

### Finding App IDs

Run this command to see all running apps:
```bash
gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell/Extensions/Windows
```

Or check logs with debug enabled when launching apps.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## CI/CD

This project uses GitHub Actions for continuous integration:

- **Lint**: Validates code style and JSON/XML files
- **Build**: Compiles schemas and creates distribution packages
- **Release**: Automatically creates releases when tags are pushed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [gnome-hdr-enabler](https://github.com/Saren-Arterius/gnome-hdr-enabler)
- Reference implementation: [media-controls](https://github.com/sakithb/media-controls)
- GNOME Shell extension documentation at [gjs.guide](https://gjs.guide/)

## Support

If you find this extension useful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 📖 Improving documentation

For issues and feature requests, please use the [GitHub Issues](https://github.com/Asion001/auto-hdr-extension/issues) page.
