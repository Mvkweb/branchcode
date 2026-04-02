#!/bin/sh
# Branchcode installer for Linux/macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/branchcode/branchcode/main/scripts/install.sh | sh

set -e

REPO="branchcode/branchcode"
INSTALL_DIR="${HOME}/.local/bin"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
GRAY='\033[0;37m'
NC='\033[0m'

step()  { printf "${CYAN}=>${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
err()   { printf "${RED}[✗]${NC} %s\n" "$1"; exit 1; }

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux";;
        Darwin*) echo "macos";;
        *)       err "Unsupported OS: $(uname -s)";;
    esac
}

# Detect architecture
detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "x86_64";;
        arm64|aarch64) echo "aarch64";;
        *)            err "Unsupported architecture: $(uname -m)";;
    esac
}

OS=$(detect_os)
ARCH=$(detect_arch)

step "Fetching latest release..."
RELEASE=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null) || err "Failed to fetch latest release"
VERSION=$(echo "$RELEASE" | grep -m1 '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
ok "Found Branchcode v$VERSION"

# Find the right asset
if [ "$OS" = "macos" ]; then
    if [ "$ARCH" = "aarch64" ]; then
        PATTERN="aarch64.*darwin.*dmg"
    else
        PATTERN="x86_64.*darwin.*dmg"
    fi
elif [ "$OS" = "linux" ]; then
    PATTERN="AppImage"
fi

DOWNLOAD_URL=$(echo "$RELEASE" | grep "browser_download_url" | grep -i "$PATTERN" | head -1 | sed 's/.*"browser_download_url": "\(.*\)"/\1/')

if [ -z "$DOWNLOAD_URL" ]; then
    err "No installer found for $OS/$ARCH"
fi

FILENAME=$(basename "$DOWNLOAD_URL")
step "Downloading $FILENAME..."

# Download
mkdir -p "$INSTALL_DIR"
curl -fsSL -o "$INSTALL_DIR/$FILENAME" "$DOWNLOAD_URL" || err "Download failed"
chmod +x "$INSTALL_DIR/$FILENAME"

ok "Downloaded to $INSTALL_DIR/$FILENAME"

# Platform-specific install
if [ "$OS" = "macos" ]; then
    step "Opening installer..."
    open "$INSTALL_DIR/$FILENAME"
    ok "Branchcode v$VERSION installer opened"
    echo ""
    printf "${GRAY}Drag Branchcode to your Applications folder to complete install.${NC}\n"
elif [ "$OS" = "linux" ]; then
    # Create desktop entry
    DESKTOP_DIR="${HOME}/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_DIR/branchcode.desktop" << EOF
[Desktop Entry]
Name=Branchcode
Exec=$INSTALL_DIR/$FILENAME
Icon=$INSTALL_DIR/branchcode.png
Type=Application
Categories=Development;
EOF
    ok "Desktop entry created"
    ok "Branchcode v$VERSION installed"
    echo ""
    printf "${GRAY}Run with: $INSTALL_DIR/$FILENAME${NC}\n"
fi
