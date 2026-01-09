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
├── README.md                        # Human-readable description of this symbol
├── <SymbolName>.py                  # CustomObject class + standalone scene (if __name__ == "__main__")
├── <SymbolName>.mp4                 # Web distribution (referenced in .udd)
├── <SymbolName>.mov                 # Master with alpha (Keynote compatible)
└── submodules/
    ├── DreamTalk/                   # Core library (always present)
    └── <OtherSymbol>/               # Optional: other sovereign symbols as parts
```

**PascalCase everywhere** — `MindVirus/MindVirus.py` renders `MindVirus.mp4`. Aesthetic consistency.

**Single Python file pattern:**
```python
# MindVirus.py
from DreamTalk.imports import *

class MindVirus(CustomObject):
    # ... class definition ...

if __name__ == "__main__":
    # Renders the canonical standalone symbol
    scene = TwoDScene()
    virus = MindVirus()
    scene.play(Create(virus), run_time=3)
```

- Run directly → renders standalone symbol
- Import from elsewhere → just provides the class

**Render outputs at root, named after DreamNode.** PNG frames are transient (not committed).

### The `.udd` Schema for Symbols

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "MindVirus",
  "type": "dream",
  "dreamTalk": "MindVirus.mp4",
  "submodules": [],
  "supermodules": []
}
```

Minimal schema. Human description goes in README.md. `dreamTalk` references the MP4 at root.

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

### Quick Setup

Run the setup script (creates symlinks, installs dependencies):
```bash
./scripts/setup.sh
```

Then:
1. Restart Cinema 4D to load the plugin
2. In C4D: Extensions > Socket Server Plugin > Start Server
3. Start Claude Code in the DreamTalk directory

### Manual Setup

If you prefer manual installation:

1. **Symlink the C4D plugin** (single source of truth):
   ```bash
   ln -s /path/to/DreamTalk/mcp-servers/cinema4d-mcp/c4d_plugin/mcp_server_plugin.pyp \
         ~/Library/Preferences/Maxon/Maxon\ Cinema\ 4D\ 2025_*/plugins/
   ```

2. **Install MCP server dependencies**:
   ```bash
   cd mcp-servers/cinema4d-mcp && uv sync
   ```

3. **Configure `.mcp.json`** (already in repo - adjust paths if needed)

### AI Introspection Tools

DreamTalk provides semantic scene introspection for AI assistance:

| Tool | Purpose |
|------|---------|
| `describe_hierarchy()` | Semantic scene tree with DreamTalk types |
| `inspect_object(name)` | Deep dive into single object (userdata, tags, transform) |
| `inspect_materials()` | Material palette with usage tracking |
| `inspect_animation(start, end)` | Keyframe analysis |
| `validate_scene()` | Pre-render sanity checks |

These can be called via MCP or directly in Python:
```python
from DreamTalk.introspection import describe_hierarchy, validate_scene
result = describe_hierarchy()
validation = validate_scene()
```

### Usage

- Claude Code can execute DreamTalk scenes directly in a running C4D instance
- Enables autonomous iteration: generate scene → execute → view result → adjust
- User watches scene build in real-time and can intervene at any point

### AI-Assisted Iteration Workflow

The core workflow for iterating on DreamNodes with Claude Code:

```
1. Execute DreamNode.py → Scene created in C4D
2. Render preview → Claude views result
3. Discuss/adjust → Edit the .py file
4. Re-execute → See changes
5. Repeat until satisfied
6. Commit progress
```

**Critical principle**: All progress consolidates into the DreamNode's `.py` file. Never create one-off inline scenes — always execute the actual file so changes accumulate.

### Executing DreamNode Scripts

**Use `runpy` to execute a DreamNode's Python file as `__main__`:**

```python
# Step 1: Clear the scene
import c4d
doc = c4d.documents.GetActiveDocument()
while doc.GetFirstObject():
    doc.GetFirstObject().Remove()
while doc.GetFirstMaterial():
    doc.GetFirstMaterial().Remove()
c4d.EventAdd()

# Step 2: Execute the DreamNode's .py file directly
import runpy
runpy.run_path('/path/to/DreamNode/DreamNode.py', run_name='__main__')
```

This triggers the `if __name__ == "__main__"` block, which contains the canonical standalone scene. The DreamNode's class definition and scene setup are both in the same file:

```python
# DreamNode.py structure
class MySymbol(CustomObject):
    # Class definition - all parameters, parts, relations, creation
    ...

if __name__ == "__main__":
    class MySymbolScene(ThreeDScene):
        def construct(self):
            symbol = MySymbol(...)  # Instantiate with desired config
            self.camera.move_orbit(...)
            self.play(Create(symbol), run_time=3)

    scene = MySymbolScene()
```

**Why runpy?**
- `exec()` is blocked for security
- Importing doesn't trigger `__main__`
- `runpy.run_path(..., run_name='__main__')` properly simulates direct execution

### Rendering for AI Feedback

**After executing a scene, render a preview for visual feedback:**

```python
import c4d
import tempfile

doc = c4d.documents.GetActiveDocument()
doc.SetTime(c4d.BaseTime(FRAME_NUMBER, 30))
doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

rd = doc.GetActiveRenderData()
settings = rd.GetData()
settings[c4d.RDATA_XRES] = 640
settings[c4d.RDATA_YRES] = 360
settings[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD

bmp = c4d.bitmaps.BaseBitmap()
bmp.Init(640, 360, 24)  # 24-bit RGB - CRITICAL for Sketch & Toon

result = c4d.documents.RenderDocument(doc, settings, bmp, c4d.RENDERFLAGS_EXTERNAL)
path = tempfile.gettempdir() + "/preview.png"
bmp.Save(path, c4d.FILTER_PNG)
print(f"Saved to: {path}")
```

Then use `Read` tool on the saved PNG path to view the render.

**Key requirements:**
- Use `BaseBitmap` with 24-bit color (NOT `MultipassBitmap`)
- Use Standard renderer (NOT Redshift) for Sketch & Toon
- Ensure Sketch & Toon VideoPost is enabled in render settings
- Save to temp file and read with Claude's Read tool

### Complete Iteration Example

```python
# === EXECUTE ===
import c4d
doc = c4d.documents.GetActiveDocument()
while doc.GetFirstObject():
    doc.GetFirstObject().Remove()
while doc.GetFirstMaterial():
    doc.GetFirstMaterial().Remove()
c4d.EventAdd()

import runpy
runpy.run_path('/Users/davidrug/ProjectLiminality/MindVirus/MindVirus.py', run_name='__main__')
```

```python
# === RENDER PREVIEW ===
import c4d
import tempfile

doc = c4d.documents.GetActiveDocument()
doc.SetTime(c4d.BaseTime(90, 30))  # Frame 90
doc.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

rd = doc.GetActiveRenderData()
settings = rd.GetData()
settings[c4d.RDATA_XRES] = 640
settings[c4d.RDATA_YRES] = 360
settings[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD

bmp = c4d.bitmaps.BaseBitmap()
bmp.Init(640, 360, 24)
result = c4d.documents.RenderDocument(doc, settings, bmp, c4d.RENDERFLAGS_EXTERNAL)
path = tempfile.gettempdir() + "/preview.png"
bmp.Save(path, c4d.FILTER_PNG)
print(f"Saved to: {path}")
```

Then Claude uses `Read` tool on the path to see the result.

### Anti-Pattern: Inline Scenes

**NEVER do this:**
```python
# BAD - creates objects directly, bypassing the DreamNode class
class QuickTestScene(ThreeDScene):
    def construct(self):
        eye = ImagePlane(...)  # Direct instantiation
        cube = FoldableCube(...)  # Not using MindVirus class!
```

This bypasses the actual `MindVirus` class, so:
- No cable (it's defined in MindVirus.specify_parts)
- No proper hierarchy
- Progress doesn't accumulate
- Next iteration starts from scratch

**ALWAYS do this:**
```python
# GOOD - execute the actual DreamNode file
runpy.run_path('/path/to/MindVirus/MindVirus.py', run_name='__main__')
```

This uses the real class with all its accumulated features.

## Render Pipeline

### Output Formats

| Type | Format | Use Case |
|------|--------|----------|
| Still | PNG (alpha) | Static symbols, thumbnails |
| Dynamic master | MOV ProRes 4444 (alpha) | Keynote, archival, editing |
| Dynamic web | MP4 H.264 (derived) | InterBrain, GitHub Pages |

### Pipeline Flow

```
symbol_scene.py          # Source of truth
    ↓ (C4D execute)
[PNG frames]             # Transient - delete after encoding
    ↓ (ffmpeg)
.mov (ProRes 4444)       # Master - alpha, Keynote compatible
    ↓ (ffmpeg)
.mp4 (H.264)             # Web distribution
```

**Key settings:**
- Always use Standard renderer (not Redshift) for Sketch & Toon
- `save=True` in Scene constructor configures render export
- ProRes 4444: `ffmpeg -i frames/%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le output.mov`
- H.264 derived: `ffmpeg -i output.mov -c:v libx264 -pix_fmt yuv420p -crf 23 output.mp4`

## Current Workflow

The immediate workflow is **C4D + Keynote + Claude Code**:

1. **Claude Code**: Generate/modify DreamTalk Python via natural language
2. **Cinema 4D**: Execute scenes, render with Sketch & Toon
3. **Keynote**: Compose final presentations with transparent video overlays

Claude Code integrates via MCP to:
- Execute DreamTalk scenes in running C4D instance
- Introspect scene hierarchy and validate before render
- Iterate autonomously: prompt → code → execute → view → adjust

## Future Vision

### Backend Abstraction

DreamTalk's Python API can target multiple render backends:

```
DreamTalk Python API
    │
    ├── Cinema 4D Backend (current)
    │   └── Professional: MoGraph, particles, procedural tools
    │
    └── WebGL Backend (future)
        └── Real-time: browser-native, interactive, InterBrain UI
```

### WebGL Feasibility Assessment

**Straightforward to port:**
- Primitives, splines, materials
- Animation/keyframe system
- Cloner, Fields, Effectors (math-based)
- Vertex maps, infection/growth (GPU shaders - actually faster)
- Particle systems (GPU particles)
- Basic physics (Rapier.js/WASM)

**Challenging:**
- 3D silhouette → vector spline extraction (hard in real-time)
- Spline morphing with topology mismatch (use Flubber.js)
- Complex deformers (case by case)

**C4D remains valuable for:**
- MoGraph advanced features
- Sketch & Toon outline-to-spline
- Complex procedural workflows
- Professional master renders

### WebGL + React Three Fiber

For DreamOS's 3D UI, WebGL via React Three Fiber is the path:
- Full interactivity (click, hover, drag on DreamNodes)
- Seamless React integration
- Real-time 60fps for thousands of objects
- HTML overlays for UI elements
- WebXR ready (VR/AR)

### Phased Approach

1. **Now**: Streamline C4D workflow with Claude Code MCP integration
2. **Future Phase 1**: Core WebGL port (shapes, animation, line rendering)
3. **Future Phase 2**: MoGraph subset (Cloner, Fields, Effectors)
4. **Future Phase 3**: Particles, vertex dynamics
5. **Future Phase 4**: Physics, advanced interactions

### Future: Voice Integration with WhisperModels DreamNode

Local speech-to-text for Claude Code via VoiceMode MCP. Currently blocked on whisper.cpp build issues.

**Vision**: A `WhisperModels` DreamNode containing all Whisper model formats:
- PyTorch `.pt` files (already at `~/.cache/whisper/`)
- GGML `.bin` files (for whisper.cpp / VoiceMode)
- ONNX format (for faster-whisper / InterBrain)

Symlink pattern:
```
WhisperModels/                           # Sovereign DreamNode
├── pytorch/base.pt, medium.pt, large.pt
├── ggml/ggml-base.bin, ggml-medium.bin
└── onnx/...

~/.voicemode/models/    → symlink → WhisperModels/ggml/
~/.cache/whisper/       → symlink → WhisperModels/pytorch/
InterBrain/models/      → symlink → WhisperModels/onnx/
```

This unifies all Whisper installations across the system. One source of truth, multiple consumers.

### Prompt-to-Symbol Pipeline

The ultimate vision:
```
Natural language prompt
    ↓ (AI)
DreamTalk Python code
    ↓ (WebGL or C4D backend)
Rendered symbol (MP4/real-time)
```

WebGL enables this fully browser-native. C4D requires hosted service (licensing considerations apply for commercial hosting).

## Philosophy: Platonic Construction vs Generative AI

### Why DreamTalk Matters in the Age of AI Image Generation

Generative AI (Midjourney, DALL-E, etc.) works in **latent/pixel space** — it approximates the *appearance* of things but doesn't construct them mathematically. DreamTalk constructs things **platonically** — the source code IS the thing, not a representation of it.

**Example**: A flower of life generated by AI might *look* correct but isn't actually 19 interlocking circles with precise geometric relationships. The mathematical truth is absent. State-of-the-art image generation (as of 2025) still cannot achieve platonic accuracy for complex geometric constructions.

This distinction will persist because:
- Pixel-based AI → perfects organic/messy/photorealistic imagery
- DreamTalk AI → perfects mathematical/clean/symbolic animation
- They are **complementary**, not competing

### Thoughts as Perfect Self-Representations

In an unclouded mind, thoughts are the perfect representation of themselves. DreamTalk attempts to create digital representations of thoughts with minimal friction — as close as possible to how thoughts actually work in the mind, so we can communicate them faithfully.

## Development Philosophy: Software Gardening

### Organic Growth Over Pre-Architecture

**We do NOT predict or pre-engineer.** We work the cleanest, most elegant path of least resistance toward the vision. Problems get solved as they arise, and solutions get consolidated into the correct DreamNode at the correct level of the holarchy.

**The Pattern:**
1. Create what's needed NOW for the current context
2. Move up the holarchy to the next level
3. Discover what tweaks are needed for that higher context
4. Those tweaks enrich the lower holon's DreamNode
5. Repeat upward

Everything grows organically. We're not engineering the perfect solution — we're gardening.

### Context-Dependent Construction

A single concept (e.g., MindVirus) manifests differently depending on context:
- **Spline-following version**: For predetermined artistic paths with precise control
- **Particle-cloned version**: For emergent swarm behavior from simulations
- **Simplified version**: For performance in dense scenes

All these constructions live in the **same DreamNode**. The symbol (thumbnail) provides human-facing unity; the multiple constructions provide technical versatility that accumulates organically as needed.

### The Thumbnail Test

At each holon level, the goal is always: **create a beautiful DreamTalk render that can serve as the thumbnail** — the sovereign face of that DreamNode. If you can imagine it on a YouTube thumbnail for a video about that concept, it's good enough.

### DreamNode Enrichment Pattern

When working up the holarchy:
```
MindVirus (standalone symbol)
    ↓ used in
DoubleWall (discovers: need back-to-back construction)
    ↓ enriches
MindVirus (gains: back-to-back variant)
    ↓ used in
Labyrinth (discovers: need performance-optimized version)
    ↓ enriches
MindVirus (gains: simplified/instanced variant)
```

Each higher context enriches the lower holons with new construction variants. The DreamNode becomes more versatile precisely in the measure that it is actually necessary.

### Where Changes Go (Critical Rule)

**All learning and tweaking consolidates into the Python file of the specific DreamNode.**

When iterating on a symbol (e.g., MindVirus):
- Adjustments to geometry, positioning, parameters → `MindVirus/MindVirus.py`
- New construction variants (tracer mode, static cable mode) → `MindVirus/MindVirus.py`
- Bug fixes discovered during use → `MindVirus/MindVirus.py`

**NOT** into:
- The scene script that's using it (that's just instantiation)
- The DreamTalk core library (unless it's truly general infrastructure)
- Scattered helper files

The goal is a **versatile Python class** that can be instantiated in different configurations. The DreamNode's `.py` file is the single source of truth for that symbol's behavior and construction options.

## Current Holarchic Symbols

### TheLabyrinth Holarchy (reference implementation)

```
Square/Rectangle (LineObject)
    └── The atomic truth unit — relative truth

FoldableCube (CustomObject)
    ├── BottomRectangle (base)
    ├── LeftAxis → LeftRectangle (hinge-fold)
    ├── RightAxis → RightRectangle
    ├── BackAxis → BackRectangle
    └── FrontAxis → FrontRectangle
    └── Params: Fold (0-1), Creation (draw-on)
    └── Meaning: Illusion built from truth, the narrative/story

MindVirus (CustomObject)
    ├── Circle/MolochEye (the control string)
    └── FoldableCube
    └── Params: Forward, Thrust, Creation
    └── Tags: Align to Spline, XPresso
    └── Meaning: Manipulative narrative that controls and extracts energy

DoubleWall (CustomObject) [to be implemented]
    ├── MindVirus (facing outward, left)
    └── MindVirus (facing outward, right)
    └── Strings hidden inside the wall
    └── Meaning: Controlled opposition, divide-and-conquer infrastructure

Labyrinth (Scene)
    ├── Circular maze SVG paths
    ├── DoubleWalls cloned along paths (outer rings)
    └── SingleWalls for inner circle
    └── Meaning: Memetic caste system where higher caste controls
        the divisions that trap the lower caste
```

### Symbolism Key

- **Square**: Relative truth (facts)
- **Cube**: Illusion constructed from facts (narrative)
- **MindVirus**: Narrative with control mechanism (jellyfish + string)
- **DoubleWall**: Hidden tunnels between apparent divisions (elite access)
- **Labyrinth**: The full caste system made visible

## Future: Submodule DreamTalk Auto-Loading for Style References

When iterating on sketch-to-vector cleanup using AI image editing (Gemini), naive prompting hits limits. The solution: **dynamically load DreamTalk renders from submodules as style references**.

**The Vision:**
- When working in a DreamNode, automatically load the `dreamTalk` media from all submodules into conversation context
- These serve as style references for AI image editing - showing the target aesthetic
- The DreamTalk of the current DreamNode also loads for continuity

**Implementation Pattern:**
```
ShineAwayTheGatesToHeaven/
├── .udd (dreamTalk: current render)
├── submodules/
│   ├── MindVirus/ (dreamTalk: MindVirus.mp4 frame)
│   ├── LiminalMind/ (dreamTalk: shows the bust style)
│   └── Love/ (dreamTalk: flower of life with light)
```

When iterating on the parent DreamNode's image, Claude automatically has visual context from all component symbols. This enables:
- "Make the cubes look like the MindVirus style"
- "The bust should match the LiminalMind aesthetic"
- Consistent visual language across the holarchy

**Status:** Future planning - requires automation to extract frames from video dreamTalks and load into context

## Known Limitations & Challenges

### 1. Easing Cascade Problem

**Issue:** When nested CustomObjects each define their own `specify_creation()` with easing, the easings compound through the holarchy, producing non-visually-appealing effects.

**Example:**
```
Scene plays Create(MindVirus) with ease_in_out
  → MindVirus.creation triggers FoldableCube.creation with ease_in_out
    → FoldableCube.creation triggers each Rectangle.creation with ease_in_out
```

Each level applies its own easing curve to an already-eased input, resulting in extreme acceleration/deceleration at boundaries.

**Current workaround:** Manually coordinate creation animations at the top level, or use linear interpolation for child objects.

**Future solution needed:** A system where easing is applied only at the outermost level, with children receiving "raw" normalized time. Or a way to detect nesting depth and adjust accordingly.

### 2. Animation State Management

**Issue:** CustomObjects may have multiple distinct animation "modes" or "states" (e.g., MindVirus has: creation, thrust/locomotion, capture/attachment). Currently there's no standard pattern for managing these states.

**Current approach:**
- `creation` parameter handles entering the scene
- Additional parameters (e.g., `fold`, `thrust`) can be animated manually
- Complex state transitions require custom XPresso or scene-level orchestration

**Desired pattern:** A state machine or mode system where:
- Each CustomObject declares its animation modes
- Modes can have entry/exit animations
- Higher holons can trigger mode transitions on child objects
- State changes propagate cleanly through the hierarchy

**Design questions:**
- Should modes be discrete (enum) or continuous (blend between states)?
- How do physics-driven animations interact with keyframe-driven modes?
- How does a parent holon override or extend a child's mode behavior?

### 3. Physics vs Keyframe Animation

**Issue:** Some animations are best expressed as keyframes (precise choreography), others as physics simulations (organic movement). DreamTalk currently focuses on keyframes via XPresso.

**Example:** MindVirus jellyfish locomotion wants:
- Tentacle fold: keyframeable (controls the "pulse")
- Position/momentum: physics-driven (rapid pulse → forward thrust → drift)

**Challenge:** Mixing these paradigms requires either:
- C4D Dynamics (rigid/soft body) — heavy, hard to control precisely
- Custom physics in XPresso — complex to implement
- Baking physics to keyframes — loses interactivity

**Potential approach:** A "thrust" parameter that internally manages both the tentacle animation AND the resulting position change via XPresso formulas that simulate momentum.

### 4. Holarchic Animation Inheritance

**Issue:** When a symbol is used as a submodule in a higher holon, the parent may need to:
- Trigger the child's built-in animations
- Override specific animation parameters
- Add new animation behaviors that the child didn't anticipate

**Example:** MindVirus defines thrust locomotion. InfectedMind (higher holon) needs:
- MindVirus to swim toward a target (use thrust)
- MindVirus to flip and wrap around head (new behavior not in MindVirus)

**Question:** Should the flip/wrap behavior be:
- Added to MindVirus as a mode (polluting it with context-specific behavior)?
- Defined in InfectedMind using MindVirus's exposed parameters?
- A branch of MindVirus specific to InfectedMind context?

The "software gardening" philosophy suggests: implement in InfectedMind first, then extract reusable parts back to MindVirus only if they prove generally useful.

### 5. Organic Motion Patterns

**Issue:** Natural movement (jellyfish pulse, breathing, organic drift) requires specific timing curves that are hard to express with standard ease functions.

**Jellyfish locomotion pattern:**
```
Time:     |----rapid----|--------slow drift--------|----rapid----|
Fold:     0 ━━━━━━━━━━━▶ 1 ━━━━━━━━━━━━━━━━━━━━━━━▶ 0 ━━━━━━━━━━━▶ 1
Velocity: 0 ━━━━━▶ peak ━━━━▶ decay ━━━━▶ ~0 ━━━━━━▶ 0 ━━━━━▶ peak
```

**Needed:**
- Custom easing curves (spline-based)
- Velocity coupling (fold rate → position change)
- Loopable pulse cycles with natural variation

**Potential implementation:**
- `UPulse` parameter type with frequency, attack, decay
- XPresso formula linking pulse phase to position delta
- Optional noise/variation overlay for organic feel

## MoGraph + Python Generator Integration (R&D Breakthrough)

### The Challenge

DreamTalk CustomObjects use XPresso and UserData parameters for animation. MoGraph's standard Cloner can clone objects but only linearly interpolates parameters between blend states - it doesn't re-evaluate generators or XPresso for intermediate states. This makes it impossible to clone a MindVirus and have each clone at a different fold state.

### The Solution: Python Generator + Cloner

**Key Discovery:** A Python Generator placed inside a MoGraph Cloner IS evaluated separately for each clone, and `op.GetMg()` returns the clone's unique world position (including cloner offsets).

**Critical Setting:** In the Python Generator's attributes, **disable "Optimize Cache"** - otherwise the generator caches its output and won't respond to external changes (like moving a field object).

### Proof of Concept: Laptop Hinge Test

Minimal test proving per-clone geometry generation:

```python
# Python Generator code
import c4d
import math

def main():
    PI = math.pi
    mg = op.GetMg()
    x = mg.off.x

    # Derive fold from world X position (or from field lookup)
    fold = min(1.0, max(0.0, x / 400.0))
    angle = fold * PI  # 0 to 180 degrees

    size = 80
    half = size / 2

    root = c4d.BaseObject(c4d.Onull)
    root.SetName(f"L_f{fold:.2f}")

    # BASE - flat on XZ plane
    base = c4d.BaseObject(c4d.Osplinerectangle)
    base[c4d.PRIM_RECTANGLE_WIDTH] = size
    base[c4d.PRIM_RECTANGLE_HEIGHT] = size
    base.SetRelRot(c4d.Vector(PI/2, 0, 0))  # Lie flat
    base.InsertUnder(root)

    # HINGE at back edge, rotates based on fold
    hinge = c4d.BaseObject(c4d.Onull)
    hinge.SetRelPos(c4d.Vector(0, 0, -half))
    hinge.SetRelRot(c4d.Vector(-angle, 0, 0))  # Fold upward
    hinge.InsertUnder(root)

    # LID attached to hinge
    lid = c4d.BaseObject(c4d.Osplinerectangle)
    lid[c4d.PRIM_RECTANGLE_WIDTH] = size
    lid[c4d.PRIM_RECTANGLE_HEIGHT] = size
    lid.SetRelRot(c4d.Vector(PI/2, 0, 0))
    lid.SetRelPos(c4d.Vector(0, 0, -half))
    lid.InsertUnder(hinge)

    return root
```

**Result:** 5 clones along X axis each show different hinge angles - proving the generator re-evaluates geometry per clone, not just interpolating.

### Field-Driven Parameters

The generator can look up external objects and calculate parameters from them:

```python
def main():
    doc = c4d.documents.GetActiveDocument()
    mg = op.GetMg()
    pos = mg.off

    # Find a field/null and calculate distance-based falloff
    field = doc.SearchObject("MyField")
    if field:
        field_pos = field.GetMg().off
        radius = 150.0
        dist = (pos - field_pos).GetLength()
        fold = max(0.0, 1.0 - dist / radius)
    else:
        fold = 0.5  # fallback

    # ... generate geometry based on fold ...
```

**With "Optimize Cache" OFF:** Moving the field object in the viewport causes all clones to update in real-time!

### Python MoGraph Tools Reference

| Tool | ID | Executes | Key Capability |
|------|-----|----------|----------------|
| Python Generator | 1023866 | Per-clone when in Cloner | `op.GetMg()` gives unique position |
| Python Effector | 1025800 | Once per evaluation | Access to all MoData arrays |
| Python Field | 440000277 | When sampled | Custom `Sample()` returns weights per position |
| Python Tag | 1022749 | Per frame | Attached to objects |

### Cloner Setup

```python
# Create Linear Cloner
cloner = c4d.BaseObject(c4d.Omgcloner)
cloner[c4d.ID_MG_MOTIONGENERATOR_MODE] = 1  # 1 = Linear mode (NOT 0!)
cloner[1270] = 5  # MG_LINEAR_COUNT
cloner[1273] = c4d.Vector(100, 0, 0)  # MG_LINEAR_OBJECT_POSITION (step)

# Parent generator under cloner
generator.InsertUnder(cloner)
```

### Architecture for DreamTalk-MoGraph Bridge

**Vision:** A compatibility layer where DreamTalk CustomObjects can be cloned with MoGraph while respecting their procedural parameters.

**Approach:**
1. Create a "MoGraph Wrapper" Python Generator
2. Wrapper reads a child DreamTalk CustomObject
3. Wrapper samples fields/effectors and sets UserData parameters
4. Child CustomObject generates geometry based on those parameters
5. Each clone gets unique parameter values based on position/field

**Key Insight:** The Python Generator can access `doc.SearchObject()` to find any object in the scene, enabling it to:
- Read field positions and calculate custom falloffs
- Sample actual C4D fields (via Python Field integration)
- Look up animation curves on other objects
- Create true procedural cloning with full DreamTalk parameter control

### Generator-as-Controller Architecture (Major Breakthrough)

**Problem Solved:** XPresso-based CustomObjects don't work in MoGraph Cloners because XPresso stores object references that break when cloned.

**Solution:** Replace XPresso with Python Generators that **modify their children** rather than generating geometry.

#### The Pattern

```
Cloner
  └─ ParentGenerator (Python Generator)     ← reads position, pushes params down
        └─ ChildGenerator (Python Generator) ← reads params, modifies children
              ├─ Null (axis/transform)
              │    └─ Spline (geometry)
              └─ ...more children
```

#### Key Principles

1. **Generator modifies children, returns None:**
   ```python
   def main():
       fold = op[FOLD_USERDATA_ID]  # Read parameter

       child = op.GetDown()
       while child:
           if child.GetName() == "LeftAxis":
               child.SetRelRot(c4d.Vector(0, 0, fold * PI/2))
           child = child.GetNext()

       return None  # Children ARE the output
   ```

2. **Children remain visible in Object Manager** - holonic structure preserved

3. **Nested generators communicate via UserData:**
   ```python
   # Parent generator pushes value to child generator
   child_gen[CHILD_FOLD_ID] = fold
   ```

4. **Each clone gets unique values** via `op.GetMg()`:
   ```python
   mg = op.GetMg()
   x = mg.off.x
   fold = x / 600.0  # Position-based parameter
   ```

5. **Disable "Optimize Cache"** on all generators (`op[c4d.OPYTHON_OPTIMIZE] = False`)

#### Benefits Over XPresso

| XPresso | Generator-as-Controller |
|---------|------------------------|
| Object references break on clone | Position-based calculation per clone |
| Visual node graph (C4D-specific) | Python code (portable) |
| Hard to version control | Git-friendly |
| Opaque to AI | AI can read/modify |
| Requires manual wiring | Relationships defined in code |

#### Migration Path

The existing `CustomObject` class can be extended:

```python
class FoldableCube(CustomObject):
    # Traditional XPresso-based approach
    def specify_parts(self): ...
    def specify_relations(self): ...

    # NEW: Generator-based approach for MoGraph
    @classmethod
    def create_generator(cls, **params):
        """Create a Python Generator version of this object."""
        gen = c4d.BaseObject(1023866)
        gen[c4d.OPYTHON_CODE] = cls._generator_code()
        gen[c4d.OPYTHON_OPTIMIZE] = False
        # Add UserData, create children...
        return gen
```

#### Proven Working

- ✅ Single generator modifying children
- ✅ Nested generators (MindVirus > FoldableCube)
- ✅ Linear Cloner with position-based fold
- ✅ UserData propagation between generator levels
- ✅ Holonic hierarchy visible in Object Manager

### Future Architecture Vision

**Goal:** DreamTalk objects that work seamlessly with both:
- Direct scene use (current CustomObject pattern)
- MoGraph cloning (Generator-as-Controller pattern)

**Long-term:** Move ALL relationship logic into Python, making DreamTalk:
- Backend-agnostic (can target WebGL, other 3D software)
- Fully version-controlled (no binary XPresso data)
- AI-native (Claude can understand and modify all relationships)

### Implementation Status

**Completed:**
- ✅ `GeneratorMixin` class in `generator.py` - provides `create_as_generator()` method
- ✅ `generator_mode=True` flag in `CustomObject.__init__()` - automatic conversion
- ✅ Auto-generation of code from `XIdentity` relations
- ✅ Recursive conversion of child CustomObjects with GeneratorMixin
- ✅ FoldableCube updated with GeneratorMixin
- ✅ MindVirus updated with GeneratorMixin

**Usage:**
```python
# Standard mode (XPresso) - traditional use
virus = MindVirus(color=BLUE)

# Generator mode - MoGraph compatible
virus = MindVirus(color=BLUE, generator_mode=True)
```

**Remaining Work:**
1. Test full MindVirus with `generator_mode=True` in Cloner
2. Add auto-translation for `XRelation` with formulas
3. Handle complex XPresso patterns (XAction, XBoundingBox, etc.)
4. Test with MoGraph Fields for dynamic parameter control
5. Consider position-driven mode for automatic clone variation
