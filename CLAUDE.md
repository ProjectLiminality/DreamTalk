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
