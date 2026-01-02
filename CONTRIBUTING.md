# Contributing to Auto HDR Extension

Thank you for considering contributing to Auto HDR Extension! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Keep discussions professional and on-topic

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Asion001/auto-hdr-extension/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs actual behavior
   - GNOME Shell version
   - Extension version
   - Relevant logs (with debug logging enabled)

### Suggesting Features

1. Check if the feature has been suggested
2. Open an issue with:
   - Clear description of the feature
   - Use case/motivation
   - Possible implementation approach (optional)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes following the code style guidelines
4. Test your changes thoroughly
5. Commit with clear, descriptive messages
6. Push to your fork
7. Open a Pull Request with:
   - Description of changes
   - Related issue number (if applicable)
   - Testing performed

## Development Setup

1. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/auto-hdr-extension.git
   cd auto-hdr-extension
   ```

2. Install the extension in development mode:
   ```bash
   make install
   ```

3. Enable debug logging in preferences

4. Monitor logs:
   ```bash
   journalctl -f -o cat | grep "Auto HDR"
   ```

5. After making changes, restart GNOME Shell:
   - Xorg: `Alt+F2`, type `r`, Enter
   - Wayland: Log out and back in

## Code Style Guidelines

### JavaScript

- Use 4 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Use descriptive variable names
- Add comments for complex logic
- Follow ESLint rules in `.eslintrc.json`

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Keep first line under 50 characters
- Provide detailed description if needed
- Reference issues/PRs when relevant

Example:
```
Add monitor selection feature

- Implement monitor picker in preferences
- Add GSettings key for selected monitors
- Update HDR control to respect monitor selection

Fixes #123
```

## Testing

### Manual Testing

1. Install the extension
2. Configure test scenarios in preferences
3. Launch apps and verify HDR toggles
4. Check notifications appear correctly
5. Verify preferences UI works as expected
6. Test with multiple monitors (if available)

### What to Test

- [ ] App launch triggers HDR on/off
- [ ] App closure reverts HDR state
- [ ] Multiple apps interact correctly
- [ ] Preferences save and load correctly
- [ ] App picker shows installed apps
- [ ] Remove app button works
- [ ] Debug logging works
- [ ] Notifications appear
- [ ] Works on GNOME 49

## Building and Packaging

Build the extension:
```bash
make build
```

Create distribution package:
```bash
make zip
```

Clean build artifacts:
```bash
make clean
```

## CI/CD

The project uses GitHub Actions for CI/CD:

- Runs on push to main/develop branches
- Runs on pull requests
- Validates code style
- Validates JSON/XML files
- Builds extension
- Creates release packages for tags

Ensure your changes pass CI before requesting review.

## Documentation

- Update README.md if adding features
- Update code comments for complex logic
- Update this file if changing contribution process
- Keep documentation clear and concise

## Questions?

If you have questions about contributing:

1. Check existing issues and documentation
2. Open a discussion issue
3. Ask in your pull request

Thank you for contributing!
