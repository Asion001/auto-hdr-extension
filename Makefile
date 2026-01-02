# Makefile for Auto HDR Extension

UUID = auto-hdr@asion.dev
SCHEMA_DIR = schemas
BUILD_DIR = build
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

FILES = extension.js prefs.js metadata.json stylesheet.css
SCHEMA_FILES = $(SCHEMA_DIR)/org.gnome.shell.extensions.auto-hdr.gschema.xml

.PHONY: all build install uninstall clean zip

all: build

# Compile schemas
build: $(SCHEMA_DIR)/gschemas.compiled
	@echo "Extension built successfully"

$(SCHEMA_DIR)/gschemas.compiled: $(SCHEMA_FILES)
	@echo "Compiling schemas..."
	glib-compile-schemas $(SCHEMA_DIR)/

# Install extension
install: build
	@echo "Installing extension..."
	@mkdir -p $(INSTALL_DIR)
	@mkdir -p $(INSTALL_DIR)/schemas
	@cp $(FILES) $(INSTALL_DIR)/
	@cp -r $(SCHEMA_DIR)/* $(INSTALL_DIR)/schemas/
	@echo "Extension installed to $(INSTALL_DIR)"
	@echo "Please restart GNOME Shell (Alt+F2, then type 'r' and press Enter)"
	@echo "Then enable the extension with: gnome-extensions enable $(UUID)"

# Uninstall extension
uninstall:
	@echo "Uninstalling extension..."
	@rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -f $(SCHEMA_DIR)/gschemas.compiled
	@rm -rf $(BUILD_DIR)
	@echo "Clean complete"

# Create a zip file for distribution
zip: clean build
	@echo "Creating distribution package..."
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(BUILD_DIR)/$(UUID)
	@mkdir -p $(BUILD_DIR)/$(UUID)/schemas
	@cp $(FILES) $(BUILD_DIR)/$(UUID)/
	@cp -r $(SCHEMA_DIR)/* $(BUILD_DIR)/$(UUID)/schemas/
	@cd $(BUILD_DIR) && zip -r $(UUID).zip $(UUID)
	@echo "Package created: $(BUILD_DIR)/$(UUID).zip"

# Validate extension
validate: build
	@echo "Validating extension..."
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		echo "TODO: Add validation checks"; \
	else \
		echo "gnome-extensions command not found. Skipping validation."; \
	fi
