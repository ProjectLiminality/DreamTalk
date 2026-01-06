# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DreamTalk is a Python-based programmatic animation library for Cinema 4D, inspired by 3blue1brown's manim. It extends the principles of SandTalk (indigenous symbolic communication) into the digital domain with constraints: line-based rendering, 2D/3D support, basic coloring/shading, and animations.

## Vision: DreamTalk in the DreamOS Ecosystem

DreamTalk is the **symbol creation tool** for DreamOS — a decentralized operating system where knowledge is organized as git repositories called **DreamNodes**.

### Core Concepts

- **DreamNode**: A git repository representing a unit of knowledge (idea, symbol, scene, or person)
- **DreamTalk**: The visual symbol that serves as the "face" of a DreamNode (like an app icon or YouTube thumbnail)
- **DreamSong**: Any composition of multiple DreamTalk symbols into a coherent narrative

### The Key Insight

Every DreamNode has a **symbol** (rendered animation) and the **source code that created it**. The source travels with the product. When AI helps you modify a symbol, it reads the DreamTalk code and adjusts it — operating in vector/mathematical space rather than pixel space.

This is the **platonic counterpart** to AI image generation:
- Pixel-based AI → perfects organic/messy imagery
- DreamTalk AI → perfects mathematical/clean symbolic animation

### Symbol as Sovereign Entity

A DreamTalk symbol can represent:
- A mathematical concept (Taylor expansion) — contains the math libraries that created it
- A character (MindVirus) — an animatable creature with multiple behaviors
- A scene (Labyrinth) — a composition of multiple symbols

The symbol **contains the logic that created it**, which can be applied elsewhere. A Fourier transform symbol carries the Fourier libraries. The visual and the functional are unified.

## DreamNode Ontology

### Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: DreamTalk Core Library (this repo)                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Primitives wrapping Cinema 4D: Circle, Cube, Sphere, etc.    │
│  • Abstract base classes: ProtoObject, VisibleObject,           │
│    CustomObject, LineObject, SolidObject                        │
│  • Animation system: Scene, Animator, Animation                 │
│  • XPresso/parameter infrastructure                             │
│  • This is VOCABULARY — atoms that don't need sovereignty       │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ submodule
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Sovereign Symbols (each its own DreamNode repo)       │
│  ─────────────────────────────────────────────────────────────  │
│  • CustomObjects that MEAN something: MindVirus, TaylorSeries   │
│  • Each is a git repo with:                                     │
│    - .udd (metadata, points to rendered symbol)                 │
│    - CLAUDE.md (AI instructions for this symbol)                │
│    - <name>.py (the CustomObject definition)                    │
│    - symbol_scene.py (renders the canonical symbol)             │
│    - renders/ (output GIF/MP4)                                  │
│    - submodules/DreamTalk/ (core library)                       │
│    - submodules/<OtherSymbol>/ (composing other symbols)        │
│  • Can have branches per-context for divergent implementations  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ submodule
                              │
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Scenes/DreamSongs (also DreamNode repos)              │
│  ─────────────────────────────────────────────────────────────  │
│  • Compose multiple symbols into narrative animations           │
│  • Same structure as Layer 2, scene.py is the main output       │
│  • Renders to full videos, not just looping symbols             │
└─────────────────────────────────────────────────────────────────┘
```

### Sovereign Symbol Template

```
<SymbolName>/                        # Git repo = DreamNode
├── .udd                             # DreamNode metadata (JSON)
├── CLAUDE.md                        # AI instructions for this symbol
├── <symbol_name>.py                 # The CustomObject class definition
├── symbol_scene.py                  # Scene that renders the canonical symbol
├── renders/
│   └── symbol.gif                   # The face of this DreamNode
└── submodules/
    ├── DreamTalk/                   # Core library (always present)
    └── <OtherSymbol>/               # Optional: other sovereign symbols as parts
```

### The `.udd` Schema for Symbols

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Mind Virus",
  "type": "dream",
  "dreamTalk": "./renders/symbol.gif",
  "submodules": ["<DreamTalk-uuid>", "<OtherSymbol-uuid>"],
  "supermodules": ["<Labyrinth-uuid>"],
  "tags": ["animation", "dreamtalk", "symbol"],
  "description": "A cube that opens into a jellyfish-like creature"
}
```

### Holarchic Submodule Pattern

Symbols can compose other symbols to infinite depth:

```
Labyrinth/
├── submodules/
│   ├── DreamTalk/                      # ✓ INITIALIZED
│   └── MindVirus/
│       └── submodules/
│           ├── DreamTalk/              # ✗ NOT INITIALIZED (pointer only)
│           └── JellyfishMotion/
│               └── submodules/
│                   └── DreamTalk/      # ✗ NOT INITIALIZED (pointer only)
```

**Key principle**: Only initialize DreamTalk at the root level. Nested DreamTalk submodules remain as pointers (sovereignty preserved) but aren't initialized (no duplication).

**Selective initialization**:
```bash
# Clone without initializing submodules
git clone <repo>

# Initialize only top-level DreamTalk
git submodule update --init submodules/DreamTalk

# Initialize symbol submodules (but not their nested DreamTalk)
git submodule update --init submodules/MindVirus
# Do NOT use --recursive
```

### Python Path Resolution

Symbols use `dreamtalk_init.py` to find the nearest initialized DreamTalk:

```python
# At top of any symbol's .py file
from dreamtalk_init import init
init()

from DreamTalk.imports import *
```

The resolver walks up the directory tree to find an initialized DreamTalk, ensuring all code in the holarchy uses the same module instance.

### Branch-Per-Context Pattern

When a symbol is used in different scenes with divergent needs:

```
MindVirus (repo)
├── main                    # Canonical definition
├── labyrinth              # Physics-driven for Labyrinth scene
└── domesticated-mind      # Math-driven for DomesticatedMind scene
```

Branches cherry-pick from each other. AI manages resonance between branches — changes propagate where appropriate, divergence is allowed where necessary.

## Architecture

### Core Class Hierarchy

**Scene System** (`scene.py`):
- `Scene` (ABC) - Base scene class handling document lifecycle, render settings, animation execution
- `TwoDScene` / `ThreeDScene` - Concrete scene classes with appropriate camera setups
- Key methods: `play(*animators, run_time)`, `set(*animators)`, `wait(seconds)`

**Object Hierarchy** (`objects/abstract_objects.py`):
- `ProtoObject` (ABC) → `VisibleObject` → `CustomObject` (for grouped objects)
- `ProtoObject` (ABC) → `VisibleObject` → `LineObject` (splines with sketch materials)
- `ProtoObject` (ABC) → `VisibleObject` → `SolidObject` (3D objects with fill + sketch materials)

**Animation System**:
- `animation/animation.py`: `ScalarAnimation`, `VectorAnimation`, `ColorAnimation`, `AnimationGroup`
- `animation/abstract_animators.py`: `ProtoAnimator` and concrete animators (`Create`, `Draw`, `Move`, `Scale`, `Rotate`, `Morph`, `Connect`, etc.)

**XPresso Integration** (`xpresso/`):
- `xpresso.py`: XPresso node wrappers (`XObject`, `XFormula`, `XGroup`, etc.)
- `xpressions.py`: High-level XPressions (`XRelation`, `XIdentity`, `XAction`, etc.)
- `userdata.py`: User data parameter definitions (`UParameter`, `UCompletion`, `ULength`, etc.)

### How Animation Works

1. Scene's `play()` method receives Animator objects
2. Animators wrap objects and call their animation methods (e.g., `obj.draw()`, `obj.move()`)
3. Animation methods return Animation objects with keyframe data
4. Animations are grouped, flattened, and executed by setting Cinema 4D keyframes
5. Timeline advances by `run_time`

### Object Types

**Line Objects** (`objects/line_objects.py`): `Circle`, `Rectangle`, `Arc`, `Spline`, `SVG`, `SplineText`, etc.
**Solid Objects** (`objects/solid_objects.py`): `Sphere`, `Cylinder`, `Cube`, `Plane`, `Extrude`, `Loft`, etc.
**Custom Objects** (`objects/custom_objects.py`): Composite objects like `Connection`, `Group`, `Membrane`

### Key Patterns

- Objects automatically create XPresso tags for parameter relationships
- Materials (`FillMaterial`, `SketchMaterial`) control visual appearance
- Tags (`FillTag`, `SketchTag`, `XPressoTag`) are applied to objects for functionality
- Parameters use Cinema 4D DescIDs for animation targeting

## Usage

Import via: `from DreamTalk.imports import *`

Scene scripts are executed within Cinema 4D's Python environment. The library automatically reloads modules on import.

## Constants

Key constants in `constants.py`:
- Colors: `BLUE`, `RED`, `PURPLE`, `YELLOW`, `GREEN`, `WHITE`, `BLACK`
- `PI`, `FPS` (30), `ASPECT_RATIO` (16/9)
- Position/rotation DescIDs: `POS`, `POS_X`, `ROT_H`, `SCALE_X`, etc.

## Cinema 4D Integration

The library requires Cinema 4D R26+ and uses the `c4d` module extensively. Objects are created as `c4d.BaseObject` instances and inserted into the active document.

## Design Principles

### Abilities Over Separate Classes

When an object has an optional capability (like Fire's glow), add it as a parameter rather than creating a separate class. Example:

```python
# Good: Fire with optional glow
fire = Fire(glow=True, brightness=0.8)

# Avoid: Separate PhysicalFire class (redundant)
```

This keeps the ontology clean — one concept, multiple abilities.

### Core Library vs Sovereign Symbols

**Core Library contains**:
- Primitives wrapping Cinema 4D objects (Circle, Cube, etc.)
- Base classes (Sketch, CustomObject, etc.)
- Infrastructure (animation system, XPresso, materials)

**Sovereign Symbols contain**:
- Objects with semantic meaning (Fire, Human, MindVirus)
- Their own assets (SVG files, textures)
- Can be Sketch-based (single SVG) or CustomObject-based (composite)

The `Sketch` class accepts `assets_path` parameter, allowing sovereign symbols to carry their own SVG assets rather than relying on the global `SVG_PATH`.

## Current Sovereign Symbols

- **Fire** (`/Users/davidrug/RealDealVault/Fire`): Fire symbol with optional `glow=True` for illumination

## AI Documentation

For scene creation, refer to **`docs/ai/dreamtalk_api.md`** - comprehensive API reference optimized for AI consumption.

For library development (extending DreamTalk itself), the c4d SDK patterns are documented throughout the codebase.

## MCP Integration (Claude Code ↔ Cinema 4D)

DreamTalk supports bidirectional communication with Cinema 4D via MCP (Model Context Protocol).

**Setup**:
1. Install the MCP server: `mcp-servers/cinema4d-mcp/`
2. Install the C4D plugin: Copy `mcp_server_plugin.pyp` to C4D plugins folder
3. Configure `.mcp.json` with the cinema4d server
4. In C4D: Extensions > Socket Server Plugin > Start Server

**Usage**:
- Claude Code can execute DreamTalk scenes directly in a running C4D instance
- Enables autonomous iteration: generate scene → execute → view result → adjust
- User watches scene build in real-time and can intervene at any point

## Future Vision

- Real-time web-based implementation (replacing Cinema 4D rendering)
- AI-driven symbol creation from natural language
- Full DreamOS integration where symbols populate DreamNodes automatically
