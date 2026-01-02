#!/bin/bash
# Development helper script for Auto HDR Extension

set -e

UUID="auto-hdr@asion.dev"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

function show_help() {
    echo "Auto HDR Extension - Development Helper"
    echo ""
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  install    - Build and install the extension"
    echo "  reinstall  - Uninstall, build, and install the extension"
    echo "  enable     - Enable the extension"
    echo "  disable    - Disable the extension"
    echo "  logs       - Show extension logs"
    echo "  reload     - Reload GNOME Shell (Xorg only)"
    echo "  test       - Run tests (if available)"
    echo "  clean      - Clean build artifacts"
    echo "  help       - Show this help message"
    echo ""
}

function install_extension() {
    echo "Building and installing extension..."
    make install
    echo "Extension installed!"
    echo ""
    echo "Next steps:"
    echo "1. Restart GNOME Shell (Alt+F2, type 'r', press Enter on Xorg)"
    echo "   Or log out and back in on Wayland"
    echo "2. Enable the extension: ./dev.sh enable"
}

function reinstall_extension() {
    echo "Reinstalling extension..."
    make uninstall || true
    make clean
    make install
    echo "Extension reinstalled!"
}

function enable_extension() {
    echo "Enabling extension..."
    gnome-extensions enable "$UUID"
    echo "Extension enabled!"
}

function disable_extension() {
    echo "Disabling extension..."
    gnome-extensions disable "$UUID"
    echo "Extension disabled!"
}

function show_logs() {
    echo "Showing extension logs (Ctrl+C to stop)..."
    echo ""
    journalctl -f -o cat | grep -i "auto.hdr\|auto-hdr" --color=always
}

function reload_shell() {
    if [ "$XDG_SESSION_TYPE" = "wayland" ]; then
        echo "Cannot reload GNOME Shell on Wayland"
        echo "Please log out and back in"
        exit 1
    fi
    
    echo "Reloading GNOME Shell..."
    busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting…")'
}

function run_tests() {
    echo "Running tests..."
    if [ -f "test.sh" ]; then
        ./test.sh
    else
        echo "No tests configured yet"
    fi
}

function clean_build() {
    echo "Cleaning build artifacts..."
    make clean
    echo "Clean complete!"
}

# Main script
case "${1:-help}" in
    install)
        install_extension
        ;;
    reinstall)
        reinstall_extension
        ;;
    enable)
        enable_extension
        ;;
    disable)
        disable_extension
        ;;
    logs)
        show_logs
        ;;
    reload)
        reload_shell
        ;;
    test)
        run_tests
        ;;
    clean)
        clean_build
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
