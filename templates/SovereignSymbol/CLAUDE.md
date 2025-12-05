# CLAUDE.md

This file provides guidance to Claude Code when working with this DreamTalk symbol.

## Symbol Overview

**Name**: SymbolName
**Description**: [What this symbol represents]

## Structure

This is a **sovereign symbol** — a DreamNode containing a DreamTalk CustomObject that can be:
- Rendered standalone via `symbol_scene.py`
- Composed into larger symbols/scenes as a submodule
- Modified by AI through natural language prompts

## Files

- `symbol_name.py` — The CustomObject class definition
- `symbol_scene.py` — Scene that renders the canonical symbol animation
- `renders/symbol.gif` — The rendered face of this DreamNode
- `.udd` — DreamNode metadata

## Usage

### Standalone Execution

```bash
# Initialize submodules
git submodule update --init submodules/DreamTalk

# Run in Cinema 4D
# Execute symbol_scene.py in Cinema 4D's Python environment
```

### As a Submodule

```bash
# From parent repo
git submodule add <this-repo-url> submodules/SymbolName
git submodule update --init submodules/SymbolName
# Do NOT use --recursive (parent provides DreamTalk)
```

```python
# In parent's code
from dreamtalk_init import init; init()
from SymbolName.symbol_name import SymbolName
```

## Parameters

[Document the key parameters exposed by this symbol]

## Animations

[Document the animation methods available: create(), custom_animation(), etc.]

## Parts

[If this symbol composes other symbols, list them here]

## Branches

- `main` — Canonical definition
- [List context-specific branches if any]
