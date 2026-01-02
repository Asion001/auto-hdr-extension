#!/bin/bash

# Release script for Auto HDR Extension
# Updates version in all files, creates git tag, and pushes to remote

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 <version>"
    echo ""
    echo "Example: $0 1.0.2"
    echo ""
    echo "This script will:"
    echo "  1. Update version in package.json, metadata.json"
    echo "  2. Increment integer version in metadata.json"
    echo "  3. Commit the changes"
    echo "  4. Create a git tag (v<version>)"
    echo "  5. Push commits and tags to remote"
    exit 1
}

# Check if version argument is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Version number is required${NC}"
    usage
fi

VERSION="$1"

# Validate version format (semantic versioning)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Version must be in format X.Y.Z (e.g., 1.0.2)${NC}"
    exit 1
fi

# Get the repository root directory
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo -e "${YELLOW}Preparing release v${VERSION}${NC}"
echo ""

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Working directory is not clean. Please commit or stash changes first.${NC}"
    git status --short
    exit 1
fi

# Check if tag already exists
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
    echo -e "${RED}Error: Tag v${VERSION} already exists${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Working directory is clean${NC}"

# Get current integer version from metadata.json
CURRENT_INT_VERSION=$(jq -r '.version' metadata.json)
NEW_INT_VERSION=$((CURRENT_INT_VERSION + 1))

echo -e "${YELLOW}Updating version numbers...${NC}"

# Update package.json
jq --arg version "$VERSION" '.version = $version' package.json > package.json.tmp
mv package.json.tmp package.json
echo -e "${GREEN}✓ Updated package.json to ${VERSION}${NC}"

# Update metadata.json (both version and version-name)
jq --arg version "$VERSION" --argjson intVersion "$NEW_INT_VERSION" \
    '.version = $intVersion | ."version-name" = $version' metadata.json > metadata.json.tmp
mv metadata.json.tmp metadata.json
echo -e "${GREEN}✓ Updated metadata.json to ${VERSION} (integer version: ${NEW_INT_VERSION})${NC}"

echo ""
echo -e "${YELLOW}Changes to be committed:${NC}"
git diff package.json metadata.json

echo ""
read -p "Do you want to continue with these changes? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Release cancelled. Reverting changes...${NC}"
    git restore package.json metadata.json
    exit 0
fi

# Commit changes
echo -e "${YELLOW}Committing changes...${NC}"
git add package.json metadata.json
git commit -m "chore: Bump version to ${VERSION}"
echo -e "${GREEN}✓ Changes committed${NC}"

# Create git tag
echo -e "${YELLOW}Creating tag v${VERSION}...${NC}"
git tag -a "v${VERSION}" -m "Release version ${VERSION}"
echo -e "${GREEN}✓ Tag v${VERSION} created${NC}"

# Push to remote
echo ""
echo -e "${YELLOW}Pushing to remote...${NC}"
echo "This will push:"
echo "  - Commits to current branch"
echo "  - Tag v${VERSION}"
echo ""
read -p "Continue with push? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Push cancelled. You can push manually with:${NC}"
    echo "  git push"
    echo "  git push --tags"
    exit 0
fi

git push
git push --tags

echo ""
echo -e "${GREEN}✓ Release v${VERSION} completed successfully!${NC}"
echo ""
echo "GitHub Actions will now:"
echo "  1. Run linting and build checks"
echo "  2. Create a GitHub release"
echo "  3. Upload the extension package"
echo ""
echo "Check the Actions tab: https://github.com/Asion001/auto-hdr-extension/actions"
