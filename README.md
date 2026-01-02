# Auto HDR Extension for GNOME Shell

Automatically enables or disables HDR (High Dynamic Range) for specific applications on GNOME Shell 49+.

## Features

- 🎮 **Automatic HDR Control**: Turn HDR on/off when specific applications launch
- 🖥️ **Monitor Selection**: Control HDR for specific monitors or all HDR-capable displays
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
   - **Settings**: Enable debug logging if needed

### Example Use Cases

- **Gaming**: Add your games to "Turn HDR On" to automatically enable HDR when playing
- **Color-critical work**: Add Photoshop/GIMP to "Turn HDR Off" to ensure accurate color representation
- **Mixed workflow**: Configure different apps based on your HDR preferences

## Usage

Once configured, the extension works automatically:

1. Launch an app in your "Turn HDR On" list → HDR enables
2. Close the app → HDR disables (if no other HDR apps are running)
3. Launch an app in your "Turn HDR Off" list → HDR disables
4. Close the app → HDR re-enables (if no other HDR-off apps are running)

Notifications will appear when HDR state changes.

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
