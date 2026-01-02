# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-02

### Added
- Initial release of Auto HDR Extension
- Automatic HDR enable/disable based on running applications
- Preferences UI with app picker for "Turn HDR On" apps
- Preferences UI with app picker for "Turn HDR Off" apps
- Monitor selection support (configure specific monitors or all HDR-capable displays)
- Application tracking system that monitors app launches and closures
- Debug logging option for troubleshooting
- Notifications when HDR state changes
- Support for GNOME Shell 49
- Complete CI/CD pipeline with GitHub Actions
  - Linting workflow
  - Build and validation workflow
  - Automated release creation on version tags
- Comprehensive documentation
  - Installation guide
  - Usage instructions
  - Contributing guidelines
  - Troubleshooting section
- GSettings schema for persistent configuration
- Makefile for easy building and installation

### Features
- Automatically enables HDR when configured apps launch
- Automatically disables HDR when configured apps close
- Handles multiple apps intelligently (HDR stays on if any HDR-on app is running)
- Reverses HDR state when HDR-off apps launch
- User-friendly preferences window built with Adwaita/GTK4
- App picker with search functionality
- Visual app icons in preferences
- Easy app management (add/remove with single click)

### Technical Details
- Uses Shell.AppSystem for application tracking
- Uses Shell.WindowTracker for window-to-app mapping
- Uses global.context.get_debug_control() for HDR control on GNOME 47+
- Implements proper signal handling and cleanup
- ES6 module syntax
- Modern GNOME extension structure

[1.0.0]: https://github.com/Asion001/auto-hdr-extension/releases/tag/v1.0.0
