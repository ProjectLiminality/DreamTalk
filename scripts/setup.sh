#!/bin/bash
#
# DreamTalk Setup Script
# Sets up symlinks and dependencies for DreamTalk development
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DREAMTALK_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🎬 DreamTalk Setup"
echo "=================="
echo "DreamTalk root: $DREAMTALK_ROOT"
echo ""

# Detect Cinema 4D version and plugins folder
detect_c4d_plugins_folder() {
    local prefs_dir="$HOME/Library/Preferences/Maxon"

    if [ ! -d "$prefs_dir" ]; then
        echo "❌ Maxon preferences folder not found at $prefs_dir"
        echo "   Is Cinema 4D installed?"
        return 1
    fi

    # Find the most recent C4D version folder
    local c4d_folder=$(ls -td "$prefs_dir"/Maxon\ Cinema\ 4D\ * 2>/dev/null | head -1)

    if [ -z "$c4d_folder" ]; then
        echo "❌ No Cinema 4D preferences folder found"
        return 1
    fi

    local plugins_folder="$c4d_folder/plugins"

    if [ ! -d "$plugins_folder" ]; then
        echo "Creating plugins folder: $plugins_folder"
        mkdir -p "$plugins_folder"
    fi

    echo "$plugins_folder"
}

# Setup C4D plugin symlink
setup_c4d_plugin() {
    echo "📦 Setting up Cinema 4D plugin..."

    local plugins_folder=$(detect_c4d_plugins_folder)
    if [ $? -ne 0 ]; then
        echo "⚠️  Skipping C4D plugin setup"
        return 1
    fi

    local source="$DREAMTALK_ROOT/mcp-servers/cinema4d-mcp/c4d_plugin/mcp_server_plugin.pyp"
    local target="$plugins_folder/mcp_server_plugin.pyp"

    if [ ! -f "$source" ]; then
        echo "❌ Plugin source not found: $source"
        return 1
    fi

    # Remove existing file or symlink
    if [ -e "$target" ] || [ -L "$target" ]; then
        echo "   Removing existing plugin at $target"
        rm "$target"
    fi

    # Create symlink
    ln -s "$source" "$target"
    echo "✅ Symlinked plugin:"
    echo "   $target -> $source"
}

# Setup Python environment for MCP server
setup_mcp_server() {
    echo ""
    echo "📦 Setting up MCP server dependencies..."

    local mcp_dir="$DREAMTALK_ROOT/mcp-servers/cinema4d-mcp"

    if [ ! -d "$mcp_dir" ]; then
        echo "❌ MCP server directory not found: $mcp_dir"
        return 1
    fi

    if command -v uv &> /dev/null; then
        echo "   Using uv to install dependencies..."
        (cd "$mcp_dir" && uv sync)
        echo "✅ MCP server dependencies installed"
    else
        echo "⚠️  uv not found. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
        echo "   Then run this script again."
        return 1
    fi
}

# Main
echo ""
setup_c4d_plugin
setup_mcp_server

echo ""
echo "=================="
echo "✅ DreamTalk setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Cinema 4D to load the plugin"
echo "  2. In C4D: Extensions > Socket Server Plugin > Start Server"
echo "  3. Start Claude Code in the DreamTalk directory"
echo ""
