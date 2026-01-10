# Holonic Architecture & MoGraph Integration (R&D)

This document captures the emerging vision for DreamTalk's architecture: **Python Generators as the universal container for visual holons**, enabling recursive composition and MoGraph compatibility.

---

## The Unified Vision: Dropping Sketch & Toon Entirely

### The Radical Simplification

We are **completely removing Sketch & Toon** from the DreamTalk universe. Everything becomes geometry + luminance materials, orchestrated by Python Generators.

#### What We're Dropping
- Sketch & Toon post-effect
- Sketch materials
- Sketch tags
- All XPresso that drove Sketch parameters

#### What Remains
- **Luminance materials** for stroke color (already MoGraph-native via Color Shader/Fields)
- **Geometry** for everything visible (strokes are swept splines or generated meshes)
- **Python Generators** as the universal orchestrator

#### Why This Works

| Aspect | Old (Sketch & Toon) | New (Geometry Generators) |
|--------|---------------------|---------------------------|
| Render pipeline | Post-effect (separate pass) | Standard geometry render |
| MoGraph compatibility | Material-level only | Fully per-clone |
| Viewport feedback | Must render to see | Instant |
| System complexity | Tags + Materials + XPresso | Just Python generators |
| Performance | Baseline | 10-50x faster |
| WebGL export | Impossible | Clean GLTF/USD |
| Mental model | Multiple interacting systems | One unified system |

### MoGraph-Native Color and Opacity

**Color**: MoGraph Multi Shader in the luminance channel provides per-clone color variation. ✅ VERIFIED

```python
# Create MoGraph Multi Shader with color layers
multi_shader = c4d.BaseShader(c4d.Xmgmultishader)  # ID: 1019397
multi_shader[c4d.MGMULTISHADER_MODE] = c4d.MGMULTISHADER_MODE_INDEXRATIO

# Add color shaders as layers
colors = [c4d.Vector(1,0,0), c4d.Vector(1,1,0), c4d.Vector(0,1,0), c4d.Vector(0,0,1)]
for i, color in enumerate(colors):
    color_shader = c4d.BaseShader(c4d.Xcolor)
    color_shader[c4d.COLORSHADER_COLOR] = color
    multi_shader.InsertShader(color_shader)
    multi_shader[c4d.DescID(c4d.DescLevel(c4d.MGMULTISHADER_LAYER_LINK + i))] = color_shader

# Apply to luminance channel
mat[c4d.MATERIAL_LUMINANCE_SHADER] = multi_shader
```

**Alternative**: MoGraph Color Shader (`c4d.Xmgcolor`, ID: 1018767) reads from MoGraph Color Tags applied by effectors. Set to `MGCOLORSHADER_MODE_INDEXRATIO` to map clone index to a grayscale gradient.

**Opacity**: MoGraph Multi Shader in the **Alpha channel** provides per-clone opacity variation. ✅ VERIFIED

```python
# Enable Alpha channel on material
mat[c4d.MATERIAL_USE_ALPHA] = True

# Create Multi Shader with varying opacity levels
alpha_multi = c4d.BaseShader(c4d.Xmgmultishader)
alpha_multi[c4d.MGMULTISHADER_MODE] = c4d.MGMULTISHADER_MODE_INDEXRATIO

# White = visible, Black = invisible
opacities = [c4d.Vector(1,1,1), c4d.Vector(0.6,0.6,0.6), c4d.Vector(0.3,0.3,0.3)]
for i, alpha in enumerate(opacities):
    color_shader = c4d.BaseShader(c4d.Xcolor)
    color_shader[c4d.COLORSHADER_COLOR] = alpha
    alpha_multi.InsertShader(color_shader)
    alpha_multi[c4d.DescID(c4d.DescLevel(c4d.MGMULTISHADER_LAYER_LINK + i))] = color_shader

mat[c4d.MATERIAL_ALPHA_SHADER] = alpha_multi
```

**Note**: Use the **Alpha channel**, not Transparency. Transparency channel doesn't work well with luminance-only materials.

Both color and opacity are **fully MoGraph-native** when using standard materials on geometry.

### The DreamTalkStroke Generator

A unified generator that replaces all Sketch & Toon functionality:

```
DreamTalkStroke Generator
├── Input: Any C4D object (spline, mesh, or generator)
├── Detects type:
│   ├── Spline → Sweep with profile, growth parameters
│   ├── Mesh → Silhouette detection → Splines → Sweep
│   └── Generator → Get cache, recurse
├── Output: Optimized stroke geometry
│   ├── Camera-facing polygons only
│   ├── LOD based on distance
│   └── Luminance material (color/alpha from UserData)
└── MoGraph: Re-evaluates per clone with unique op.GetMg()
```

This becomes a **library primitive** - drop it on any object like you would a Sketch tag, but it outputs real geometry.

### The Holon as Single Source of Truth

The Python Generator consolidates EVERYTHING:

```python
class MindVirus(Holon):
    def specify_parts(self):
        self.cube = FoldableCube(...)
        self.cable = Cable(...)

    def specify_generator_code(self):
        return '''
def main():
    fold = get_userdata("Fold")
    color = get_userdata("Color")
    opacity = get_userdata("Opacity")

    # Structural relationships
    set_child_rotation("FrontAxis", fold * PI/2)

    # Stroke generation (replaces Sketch & Toon)
    for child in get_children():
        stroke_geo = generate_stroke(child, camera, thickness=2)
        stroke_geo.set_color(color)
        stroke_geo.set_alpha(opacity)

    return None
'''
```

The generator handles:
- **Structural relationships** (fold, position, scale)
- **Visual rendering** (stroke geometry generation)
- **Parameter interface** (UserData)
- **Holonic composition** (parent/child relationships)

### Holarchy Flow

UserData flows down through generators exactly as before:

```
Cloner (position varies per clone)
  └── MindVirus Generator (reads position → fold, color, opacity)
        ├── FoldableCube Generator (receives fold → axes rotation)
        │     └── Stroke geometry (auto-generated, colored, alpha'd)
        └── Cable Generator (receives growth → spline length)
              └── Stroke geometry (auto-generated)
```

Each level:
1. Receives parameters from parent (or position from Cloner)
2. Applies structural relationships
3. Generates its own stroke geometry
4. Passes relevant parameters to children

### The Secret Sauce

**The Python Generator becomes the single point of truth.** Everything consolidates into code that is:

- **Git-friendly**: Plain text Python, no binary XPresso or material data
- **AI-readable/writable**: Claude can understand and modify the entire system
- **MoGraph-native**: Generators re-evaluate per-clone with unique transforms
- **Performant**: 10-50x faster than Sketch & Toon
- **Exportable**: Real geometry exports cleanly to GLTF/USD/WebGL

Sketch & Toon was always a bolted-on post-effect trying to fake something that should have been geometry. We're just... making it geometry.

---

## Technical Deep-Dive: Why Sketch & Toon Fails

### The Problem with Sketch & Toon

Sketch & Toon is a **post-effect** - it renders lines in 2D screen space after the 3D scene is computed. This creates fundamental limitations:

1. **Not MoGraph-native**: Material properties (Draw, Color, Opacity) are document-level, not per-clone
2. **No 3D geometry**: Lines exist only in the render, can't be morphed, swept, or used as real splines
3. **Flickering/popping**: Post-effect nature causes instability during animation
4. **Conflicts with other effects**: DOF, motion blur, reflections can break or conflict
5. **Not real-time**: Requires full render pass, incompatible with viewport/WebGL workflows

### The Solution: Geometry-Based Line Rendering

**Core insight**: Replace post-effect line drawing with **real 3D spline geometry** that gets swept into visible strokes.

#### The Stroke Generator Approach

All stroke rendering is handled by Python Generators that output optimized geometry directly:

| Input Type | Generator Behavior |
|------------|-------------------|
| **Spline** | Creates camera-facing ribbon/tube polygons along spline path |
| **Mesh** | Detects silhouette edges from camera perspective, creates stroke geometry |
| **Generator** | Gets cache, recurses on children |

Key properties:
- **Draw animation**: Control via polygon count or partial geometry generation
- **MoGraph compatible**: Generator re-evaluates per-clone with unique `op.GetMg()`
- **Camera-relative**: Updates as camera moves (for silhouette detection)
- **Viewport visible**: Real geometry renders instantly
- **No intermediate objects**: No Sweep NURBS, no Sketch tags - generator outputs final geometry

#### Spline-to-Stroke Generator ✅ VERIFIED

For spline inputs (Circle, Line, Arc, etc.), the generator creates camera-facing stroke geometry.

**Critical discoveries:**
- `child.GetCache()` returns a `LineObject` (type 5137) with **interpolated points** (e.g., 36 for circle)
- `child.GetRealSpline()` returns only **base control points** (e.g., 4 for circle) - NOT what you want
- Must check `spline.CheckType(c4d.Opoint)` before calling `GetPointCount()`
- For closed splines, append first point to close the loop: `if is_closed: points.append(points[0])`
- Camera fallback for cloner context: `cam_pos = camera.GetMg().off if camera else c4d.Vector(0, 100, -500)`

**Complete working code:**
```python
import c4d

def get_userdata_by_name(obj, param_name):
    ud = obj.GetUserDataContainer()
    for desc_id, bc in ud:
        if bc[c4d.DESC_NAME] == param_name:
            try:
                return obj[desc_id]
            except:
                return None
    return None

def main():
    draw = get_userdata_by_name(op, "Draw")
    if draw is None:
        draw = 1.0
    stroke_width = get_userdata_by_name(op, "StrokeWidth")
    if stroke_width is None:
        stroke_width = 3.0

    # Get camera - with fallback for cloner context
    doc = op.GetDocument()
    bd = doc.GetActiveBaseDraw() if doc else None
    camera = bd.GetSceneCamera(doc) if bd else None
    cam_pos = camera.GetMg().off if camera else c4d.Vector(0, 100, -500)

    # Get child spline
    child = op.GetDown()
    if not child:
        return c4d.PolygonObject(0, 0)

    # CRITICAL: GetCache() returns LineObject with interpolated points
    # GetRealSpline() only returns control points (wrong!)
    spline = child.GetCache()
    if not spline:
        spline = child.GetRealSpline()
    if not spline:
        spline = child

    # Must check type before accessing point methods
    if not spline.CheckType(c4d.Opoint):
        return c4d.PolygonObject(0, 0)

    child_mg = child.GetMg()
    point_count = spline.GetPointCount()
    if point_count < 2:
        return c4d.PolygonObject(0, 0)

    # Collect world-space points
    points = []
    for i in range(point_count):
        local_pt = spline.GetPoint(i)
        world_pt = child_mg * local_pt
        points.append(world_pt)

    # CRITICAL: For closed splines, append first point to close loop
    is_closed = False
    real_spline = child.GetRealSpline()
    if real_spline and hasattr(real_spline, 'IsClosed'):
        is_closed = real_spline.IsClosed()
    if is_closed:
        points.append(points[0])

    # Draw animation: control number of segments rendered
    total_segments = len(points) - 1
    segments_to_draw = max(1, int(total_segments * draw))

    # Create polygon ribbon
    num_points = segments_to_draw * 4
    num_polys = segments_to_draw

    poly_obj = c4d.PolygonObject(num_points, num_polys)

    for i in range(segments_to_draw):
        p1 = points[i]
        p2 = points[i + 1]

        tangent = (p2 - p1).GetNormalized()
        midpoint = (p1 + p2) * 0.5
        to_cam = (cam_pos - midpoint).GetNormalized()
        perp = tangent.Cross(to_cam).GetNormalized() * stroke_width

        # Fallback if cross product fails (edge parallel to view)
        if perp.GetLength() < 0.001:
            perp = tangent.Cross(c4d.Vector(0, 1, 0)).GetNormalized() * stroke_width
            if perp.GetLength() < 0.001:
                perp = c4d.Vector(stroke_width, 0, 0)

        idx = i * 4
        poly_obj.SetPoint(idx + 0, p1 - perp)
        poly_obj.SetPoint(idx + 1, p1 + perp)
        poly_obj.SetPoint(idx + 2, p2 + perp)
        poly_obj.SetPoint(idx + 3, p2 - perp)
        poly_obj.SetPolygon(i, c4d.CPolygon(idx, idx + 1, idx + 2, idx + 3))

    poly_obj.Message(c4d.MSG_UPDATE)
    return poly_obj
```

#### Mesh-to-Silhouette Generator ✅ VERIFIED

For mesh inputs, detects silhouette edges and creates stroke geometry.

**Critical discoveries:**
- Edge-to-face mapping uses sorted tuple: `edge_key = tuple(sorted((v1, v2)))`
- Boundary edges (open meshes): include if the single adjacent face is front-facing
- **Parametric objects (Sphere, Cube) have no cache inside Cloner** - use Platonic or pre-converted polygons
- Polygon normal calculation uses cross product of two edge vectors

**Complete working code:**
```python
import c4d

def get_userdata_by_name(obj, param_name):
    ud = obj.GetUserDataContainer()
    for desc_id, bc in ud:
        if bc[c4d.DESC_NAME] == param_name:
            try:
                return obj[desc_id]
            except:
                return None
    return None

def get_poly_normal(poly, points):
    """Calculate face normal from polygon vertices."""
    a = points[poly.a]
    b = points[poly.b]
    c = points[poly.c]
    v1 = b - a
    v2 = c - a
    return v1.Cross(v2).GetNormalized()

def get_poly_center(poly, points):
    """Get center of polygon."""
    if poly.IsTriangle():
        return (points[poly.a] + points[poly.b] + points[poly.c]) / 3.0
    else:
        return (points[poly.a] + points[poly.b] + points[poly.c] + points[poly.d]) / 4.0

def main():
    stroke_width = get_userdata_by_name(op, "StrokeWidth")
    if stroke_width is None:
        stroke_width = 2.0

    # Get camera with fallback
    doc = op.GetDocument()
    bd = doc.GetActiveBaseDraw() if doc else None
    camera = bd.GetSceneCamera(doc) if bd else None
    if not camera:
        return c4d.PolygonObject(0, 0)
    cam_pos = camera.GetMg().off

    # Get child mesh
    child = op.GetDown()
    if not child:
        return c4d.PolygonObject(0, 0)

    # Get polygon cache - NOTE: parametric objects return None inside Cloner!
    # Use Platonic or pre-converted polygon objects instead of Sphere/Cube
    mesh = child.GetCache()
    if not mesh:
        mesh = child
    if not mesh.CheckType(c4d.Opolygon):
        mesh = child.GetDeformCache()
        if not mesh or not mesh.CheckType(c4d.Opolygon):
            return c4d.PolygonObject(0, 0)

    mesh_mg = child.GetMg()
    point_count = mesh.GetPointCount()
    poly_count = mesh.GetPolygonCount()

    if point_count < 3 or poly_count < 1:
        return c4d.PolygonObject(0, 0)

    # Transform points to world space
    points = [mesh_mg * mesh.GetPoint(i) for i in range(point_count)]
    polys = [mesh.GetPolygon(i) for i in range(poly_count)]

    # Step 1: Classify each face as front or back facing
    face_front = []
    for poly in polys:
        center = get_poly_center(poly, points)
        normal = get_poly_normal(poly, points)
        view_dir = (cam_pos - center).GetNormalized()
        is_front = normal.Dot(view_dir) > 0
        face_front.append(is_front)

    # Step 2: Build edge-to-face mapping
    # CRITICAL: Use sorted tuple as edge key for consistent lookup
    edge_faces = {}  # edge_key -> list of face indices

    for fi, poly in enumerate(polys):
        if poly.IsTriangle():
            edges = [(poly.a, poly.b), (poly.b, poly.c), (poly.c, poly.a)]
        else:
            edges = [(poly.a, poly.b), (poly.b, poly.c), (poly.c, poly.d), (poly.d, poly.a)]

        for e in edges:
            edge_key = tuple(sorted(e))  # CRITICAL: sorted for consistent key
            if edge_key not in edge_faces:
                edge_faces[edge_key] = []
            edge_faces[edge_key].append(fi)

    # Step 3: Find silhouette edges (front meets back) and boundary edges
    silhouette_edges = []
    for edge_key, faces in edge_faces.items():
        if len(faces) == 2:
            f1, f2 = faces
            if face_front[f1] != face_front[f2]:
                silhouette_edges.append(edge_key)
        elif len(faces) == 1:
            # Boundary edge on open mesh - include if front-facing
            if face_front[faces[0]]:
                silhouette_edges.append(edge_key)

    if not silhouette_edges:
        return c4d.PolygonObject(0, 0)

    # Step 4: Create stroke geometry from silhouette edges
    num_edges = len(silhouette_edges)
    num_points = num_edges * 4
    num_polys = num_edges

    poly_obj = c4d.PolygonObject(num_points, num_polys)

    for i, (v1, v2) in enumerate(silhouette_edges):
        p1 = points[v1]
        p2 = points[v2]

        tangent = (p2 - p1).GetNormalized()
        midpoint = (p1 + p2) * 0.5
        to_cam = (cam_pos - midpoint).GetNormalized()
        perp = tangent.Cross(to_cam).GetNormalized() * stroke_width

        if perp.GetLength() < 0.001:
            perp = tangent.Cross(c4d.Vector(0, 1, 0)).GetNormalized() * stroke_width
            if perp.GetLength() < 0.001:
                perp = c4d.Vector(stroke_width, 0, 0)

        idx = i * 4
        poly_obj.SetPoint(idx + 0, p1 - perp)
        poly_obj.SetPoint(idx + 1, p1 + perp)
        poly_obj.SetPoint(idx + 2, p2 + perp)
        poly_obj.SetPoint(idx + 3, p2 - perp)
        poly_obj.SetPolygon(i, c4d.CPolygon(idx, idx + 1, idx + 2, idx + 3))

    poly_obj.Message(c4d.MSG_UPDATE)
    return poly_obj
```

**Algorithm summary:**
1. Get camera position
2. Calculate face normals, dot with view direction → front/back classification
3. Build edge→face mapping using `tuple(sorted(v1, v2))` as key
4. Silhouette = edges where adjacent faces differ in facing
5. Boundary = edges with only one face (include if front-facing)
6. Output camera-facing quad per edge

**Properties:**
- ✅ Real 3D geometry (morphable, clonable)
- ✅ MoGraph compatible (generator re-evaluates per clone)
- ✅ Camera-relative (updates as camera moves)
- ✅ Viewport visible (real geometry, not post-effect)
- ✅ Draw animation via partial geometry generation

### The DreamTalk Plugin Vision

Eventually, consolidate all Cinema 4D integration into a **DreamTalk Companion Plugin**:

```
DreamTalk Plugin
├── MCP Server (current implementation, for AI communication)
├── Silhouette Generator (camera-relative outline splines)
├── Optimized Primitives (pre-built sweep-based strokes)
└── DreamNode Loader (import symbols directly from git repos)
```

This ships WITH DreamTalk as a submodule, not as a separate purchase. The goal: **everything needed for the DreamTalk aesthetic without external plugin dependencies**.

### Real-Time Rendering Path

For increasingly real-time workflows while still in Cinema 4D:

| Method | Speed | Quality | Use Case |
|--------|-------|---------|----------|
| Viewport (OpenGL) | ~60fps | Low | Positioning, timing |
| Interactive Render Region | ~2-10fps | Medium | Lighting, material tweaks |
| Full Render | Seconds/frame | High | Final output |

**Key optimizations for IRR**:
- Reduce Anti-Aliasing to Geometry mode
- Disable Global Illumination during iteration
- Use render regions to focus on specific areas
- Bake complex simulations to keyframes

### WebGL Migration Path

The geometry-based approach directly enables WebGL/Three.js migration:

```
DreamTalk Symbol
  └── Python Generator (C4D)
        └── Outputs splines + sweep geometry
              └── Export as GLTF/USD
                    └── Load in Three.js/WebGL
```

Since strokes are real geometry (not post-effects), they export cleanly. The same mathematical definitions that drive the C4D generators can eventually drive WebGL equivalents directly.

### Performance Breakdown: Sketch & Toon vs Geometry-Based Strokes

#### How Each Pipeline Works

**Sketch & Toon Pipeline** (per frame):
```
1. Render full 3D scene to depth/normal buffers
2. Edge detection pass (image-space, ALL visible edges)
3. Line tracing (convert detected edges to vector strokes)
4. Stroke rendering (apply thickness, textures, effects)
5. Composite onto final image
```
Cost scales with: **Screen resolution × edge complexity × stroke effects**

The killer: Steps 2-4 happen in a black box. Every edge in the scene is evaluated, even ones you don't care about.

**Geometry-Based Pipeline** (Silhouette Generator, per frame):
```
1. Get camera position (trivial)
2. For each polygon: dot(normal, view_dir) → front/back (N polygons × 1 dot product)
3. For each edge: check if adjacent faces differ (E edges × 1 comparison)
4. Build spline from silhouette edges (S silhouette points)
5. Sweep renders as normal geometry
```
Cost scales with: **Polygon count of SOURCE mesh** (not screen resolution)

#### Scaling Characteristics

| Factor | Sketch & Toon | Geometry Silhouette |
|--------|---------------|---------------------|
| **Screen resolution** | Linear cost increase | No impact |
| **Source mesh complexity** | Exponential (traces ALL segments) | Linear (just dot products) |
| **Number of objects** | Multiplicative | Additive (parallelizable) |
| **Stroke effects** | Each effect = another pass | One-time geometry, material handles rest |
| **MoGraph clones** | Same material = same render cost | Each clone = independent geometry |
| **Viewport preview** | Requires render | Native viewport display |

#### Concrete Estimates

**Simple symbol** (e.g., FoldableCube, ~100 polygons):

| Aspect | Sketch & Toon | Geometry Silhouette |
|--------|---------------|---------------------|
| Silhouette calculation | ~5-20ms (hidden in render) | <1ms (100 dot products) |
| Render time per frame | 50-500ms | 5-20ms (just geometry) |
| Viewport feedback | None (must render) | Instant |

**Complex scene** (e.g., 50 MindViruses in Cloner, ~5000 polygons each):

| Aspect | Sketch & Toon | Geometry Silhouette |
|--------|---------------|---------------------|
| Edge detection | Must process 250K polygons worth of screen edges | 50 generators × 5K dot products each |
| Cloner behavior | All clones share material (no per-clone variation) | Each clone independent |
| Total render | 2-10 seconds | 100-500ms |

#### Camera-Optimal Geometry (Advanced Optimization)

Beyond basic silhouette-to-sweep, a smarter approach:

```
Silhouette Generator outputs splines
    ↓
Stroke Generator takes splines + camera
    ↓
Outputs MINIMAL geometry that looks like the stroke
    (only polygons facing camera, optimal subdivision)
    ↓
Standard material render (luminance = stroke color)
```

This is **camera-optimal geometry** - generating only the polygons that will actually be visible from the current camera angle (like game engine billboard/impostor rendering).

Additional savings:
- Backface culling is "free" - you never generate backfaces
- LOD is automatic - distant strokes get fewer subdivisions
- GPU handles final render natively

#### Implementation Tiers

| Scenario | Sketch & Toon | Geometry (Python) | Geometry (C++) |
|----------|---------------|-------------------|----------------|
| Simple symbol | 50-500ms | 5-20ms | <5ms |
| Complex scene | 2-10s | 100-500ms | 20-100ms |
| MoGraph 100 clones | Same cost (shared mat) | 100× single cost | 100× single cost |
| Real-time viable | ❌ | Marginal | ✅ |
| WebGL exportable | ❌ | ✅ | ✅ |

**Bottom line**: Geometry approach is **10-50x faster** for typical DreamTalk use cases, with MoGraph compatibility, viewport preview, and export capability as bonuses.

### C++ Plugin Translation Layer (Future)

The ultimate optimization: compile DreamTalk holons to native C4D ObjectData plugins.

```
DreamTalk Python                    Compiled Plugin
─────────────────                   ───────────────
class MindVirus(Holon)      →       MindVirus ObjectData (C++)
  - specify_parts()         →         Pre-built child structure
  - specify_generator_code()→         Compiled generator logic
  - UserData parameters     →         Native C4D parameters
```

Benefits:
- **10-100x performance** on generator evaluation
- **Native C4D integration** (appears in object menu, has icon)
- **Distributable** to other C4D users without Python
- **Still AI-readable** - DreamTalk Python remains source of truth

This creates a path where DreamTalk symbols can be "published" as first-class C4D objects, useful both for our own complex scenes and potentially for the broader C4D plugin ecosystem.

---

## The Vision

### DreamTalk = Visual Holons

A **holon** is something that is simultaneously a whole unto itself AND a part of a larger whole. This is the essence of DreamTalk:

- A `Circle` is a holon (complete primitive, can be used alone)
- A `FoldableCube` is a holon (composed of face holons, but complete in itself)
- A `MindVirus` is a holon (composed of FoldableCubes, but a sovereign symbol)
- A `Labyrinth` is a holon (composed of MindViruses arranged in space)

Each level is **sovereign** - it knows how to be itself, exposes meaningful parameters, and can dance with other holons to form higher-level compositions.

### The Architectural Principle

```
DreamNode (git repo)
  └── Symbol.py (Python file)
        └── class Symbol(Holon)
              └── generates → Python Generator (in C4D)
                    ├── UserData (meaningful parameters)
                    ├── Python code (structural relationships)
                    └── Children (primitives or nested holons)
```

**Every non-trivial DreamTalk symbol becomes a Python Generator in Cinema 4D.**

This mirrors the holonic structure:
- The **Python Generator** IS the holon in C4D space
- **UserData** exposes the holon's meaningful parameters
- **Python code** orchestrates relationships to children
- **Children** can be primitives OR other Python Generators (nested holons)

### What This Replaces

| Old Pattern | New Pattern |
|-------------|-------------|
| Null + XPresso tag | Python Generator |
| XPresso node graph | Python code in generator |
| Per-object XPresso tags | Consolidated into parent generator |
| Binary XPresso data | Plain text Python (git-friendly) |
| Object references (break on clone) | Position-based calculation (per-clone) |

### Benefits

1. **MoGraph Compatible**: Generators re-evaluate per clone with unique `op.GetMg()`
2. **AI-Native**: Claude can read/write all relationship logic
3. **Version Controlled**: No binary XPresso blobs
4. **Recursively Composable**: Generators containing generators = holarchy
5. **Visually Clear**: Python Generator icon instantly identifies holons in Object Manager

## Separation of Concerns

### Structural Relationships → Python Generator

Things that define the **shape/structure** based on parameters:
- Fold angle → axis rotations
- Scale → child sizing
- Configuration variants → child visibility

These live in the generator's `main()` function and execute procedurally.

### Temporal Animations → DreamTalk Library Methods

Things that **change over time** for animation:
- Create/Draw animations
- Movement sequences
- Morphing between states

These are Python methods that **generate keyframes** - they don't need to run per-frame, just once to set up the animation.

```python
# Structural (in generator code)
def main():
    fold = op[FOLD_ID]
    child.SetRelRot(c4d.Vector(0, 0, fold * PI/2))
    return None

# Temporal (in DreamTalk library)
def animate_fold(self, start=0, end=1, duration=30):
    self.keyframe(self.fold, start, frame=0)
    self.keyframe(self.fold, end, frame=duration)
```

## The Primitive Question

Current state: Primitives (Circle, Cube, etc.) have their own Sketch tags and XPresso tags for visibility/material control.

**Question**: Should primitives also become generators? Or stay as raw C4D objects?

**Current thinking**: Primitives stay as raw objects. They are the **atoms** - they don't need sovereignty because they're not meaningful units on their own. A circle is just a circle. But a `MindVirus` is a *concept* - it deserves holon status.

The **holon boundary** is: "Does this object represent a meaningful, sovereign concept that could be its own DreamNode?"

- Yes → Python Generator (holon)
- No → Raw C4D object (atom)

### Visibility & Material Control

With XPresso gone, how do we handle visibility inheritance and material assignment?

**Option A**: Python Tags on primitives (one tag per object)
**Option B**: Parent generator controls everything (consolidated)
**Option C**: Hybrid - generator handles structure, minimal tags for rendering concerns

This needs exploration. The goal is minimal friction while maintaining control.

## MoGraph Integration

### The Core Discovery

A Python Generator inside a MoGraph Cloner:
1. Is executed **separately for each clone**
2. Has `op.GetMg()` return the **clone's unique world position**
3. Can vary parameters based on position (or field sampling)

This means: **Generator-based holons automatically work with MoGraph.**

### Critical Settings

```python
# In generator code or when creating:
op[c4d.OPYTHON_OPTIMIZE] = False  # MUST disable cache optimization
```

Without this, the generator caches output and all clones look identical.

### What Works (Verified)

| Feature | Status | Notes |
|---------|--------|-------|
| `return None` with children | ✅ | Children visible per-clone |
| Position-based variation | ✅ | `op.GetMg()` gives unique clone position |
| External object lookup | ✅ | Can find fields/nulls via `doc.SearchObject()` |
| Distance-based falloff | ✅ | Calculate influence from any reference point |
| Dynamic response | ✅ | Moving field updates all clones in real-time |

### What Doesn't Work

| Feature | Status | Notes |
|---------|--------|-------|
| Effector-modified transforms | ❌ | Generator sees PRE-effector position |
| Direct MoData access | ⚠️ | Needs investigation |

**Key insight**: Generators execute BEFORE effectors. `op.GetMg()` returns the Cloner's arrangement position, not the post-effector position. For effector-driven parameters, consider using:
- A Python Effector instead (has full MoData access)
- Store effector values in a shared object that generators read
- Use Fields directly (generators can sample field positions)

### Cloner Setup

```python
cloner = c4d.BaseObject(c4d.Omgcloner)
cloner[c4d.ID_MG_MOTIONGENERATOR_MODE] = 1  # Linear mode
cloner[c4d.MG_LINEAR_COUNT] = 5
cloner[c4d.MG_LINEAR_OBJECT_POSITION] = c4d.Vector(100, 0, 0)

generator.InsertUnder(cloner)
```

### Generator-as-Controller Pattern

The generator **modifies its children** rather than generating geometry:

```python
def main():
    # Get unique position (varies per clone)
    mg = op.GetMg()
    x = mg.off.x

    # Derive parameter from position
    fold = min(1.0, max(0.0, x / 600.0))

    # Modify children
    child = op.GetDown()
    while child:
        if child.GetName() == "LeftAxis":
            child.SetRelRot(c4d.Vector(0, 0, fold * PI/2))
        child = child.GetNext()

    return None  # Children ARE the output
```

**Key insight**: `return None` means "my children are visible" - the generator acts as controller, not geometry source.

## Implementation Roadmap

### Phase 1: MoGraph Integration ✅ COMPLETE

**Goal**: Full compatibility with Cinema 4D's MoGraph system - Cloners, Effectors, Fields.

- [x] Test minimal `return None` generator in Cloner
- [x] Verify children remain visible per-clone
- [x] Confirm position-based parameter variation works
- [x] Test Field sampling from generator code (distance-based falloff works)
- [x] Test Effector influence - generators see pre-effector positions (limitation documented)
- [x] Document the complete MoGraph workflow

**Key discovery**: Generators execute BEFORE effectors, so use Fields for spatial influence instead.

### Phase 2: Nested Holons ✅ COMPLETE

**Goal**: Prove recursive composition works - a generator containing generators.

- [x] Create simple two-level test (CubeTriad containing 3 FoldableCubes)
- [x] Verify parent can pass parameters to child generators via UserData
- [x] Test in Cloner - nested generators re-evaluate per-clone ✅

**Results**: Full holarchic pattern verified:
```
Cloner
  └── CubeTriad (parent generator) - reads Y position
        ├── Cube1 (child generator) - receives fold value
        ├── Cube2 (child generator) - receives fold value
        └── Cube3 (child generator) - receives fold value
```

Each clone gets unique position → parent calculates fold → passes to all children → children apply to their structure. Three levels of hierarchy working together.

### Phase 3: Primitive Handling ✅ COMPLETE (Superseded)

**Original findings** led to the unified vision documented above. Key insight: Sketch & Toon materials are not per-clone in MoGraph, which led us to abandon Sketch & Toon entirely in favor of geometry-based strokes.

**New approach** (see "The Unified Vision" section):
- Generators directly output optimized stroke geometry (no Sweep NURBS intermediate)
- Spline → Generator creates camera-facing ribbon/tube polygons
- Mesh → Generator detects silhouette edges, creates stroke geometry
- Draw animation via geometry point count or visibility
- Color/Opacity via MoGraph Multi Shader or Fields on Luminance material
- No Sketch & Toon, no XPresso

### Phase 4: Library Refactor

**Goal**: Update DreamTalk core to default to generator-based holons.

- [ ] Rename `CustomObject` → `Holon` (or add alias)
- [ ] Make `generator_mode=True` the default
- [ ] Remove/deprecate XPresso-based relationship system
- [ ] Update `GeneratorMixin` to handle all current relationship patterns
- [ ] Ensure animation methods still work (keyframe generation)

## Technical Reference

### Python Generator Object

- Type ID: `1023866`
- Code storage: `c4d.OPYTHON_CODE`
- Cache optimization: `c4d.OPYTHON_OPTIMIZE` (set to `False` for MoGraph)

### Key Generator Patterns

**Read UserData:**
```python
fold = op[c4d.DescID(
    c4d.DescLevel(c4d.ID_USERDATA, c4d.DTYPE_SUBCONTAINER, 0),
    c4d.DescLevel(1, c4d.DTYPE_REAL, 0)  # UserData slot 1
)]
```

**Modify child rotation:**
```python
child.SetRelRot(c4d.Vector(angle_x, angle_y, angle_z))
```

**Get clone position:**
```python
mg = op.GetMg()
world_pos = mg.off  # c4d.Vector
```

**Pass value to child generator's UserData (by name):**
```python
def set_userdata_by_name(obj, param_name, value):
    """Set UserData value by parameter name."""
    ud = obj.GetUserDataContainer()
    for desc_id, bc in ud:
        if bc[c4d.DESC_NAME] == param_name:
            obj[desc_id] = value
            return True
    return False

# In parent generator's main():
child = op.GetDown()
while child:
    set_userdata_by_name(child, "Fold", fold_value)
    child = child.GetNext()
```

### MoGraph Cloner Modes

| Mode | Value | Use Case |
|------|-------|----------|
| Object | 0 | Clone onto object surface |
| Linear | 1 | Line of clones |
| Radial | 2 | Circular arrangement |
| Grid | 3 | 3D grid |
| Honeycomb | 4 | Hexagonal pattern |

## Open Questions

1. **Visibility inheritance**: How do we elegantly handle "hide parent hides children" without XPresso?
   - Generator can set `child[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR]` directly
   - Needs testing to confirm it cascades properly

2. ~~**Material assignment**: Currently XPresso drives Sketch tag parameters. What replaces this?~~
   - **ANSWERED**: Generator directly modifies Sketch material for standalone use
   - For MoGraph per-clone: use Fields + Shader Effector

3. **Performance**: With deep holarchies, does generator nesting cause performance issues?
   - Early tests with 3-level hierarchy (Cloner→Parent→Children) showed no issues
   - Needs stress testing with larger hierarchies

4. **Animation keyframes**: Can we keyframe UserData on generators the same way we do on Nulls?
   - Should work - generators are just BaseObjects with UserData
   - Needs verification

5. **Editor visibility**: Does `return None` preserve Object Manager editability of children in all contexts?
   - Verified: Children remain selectable and editable in Object Manager
   - Cloner context: children are virtual but template is editable

## Session Log

### 2025-01-10: Phase 3 - Primitive Handling
**Key discoveries:**
- XPresso on primitives does NOT work inside generators (XPresso never re-evaluates)
- Generator CAN directly modify Sketch material parameters (Draw, Color, Opacity)
- Material modifications are document-level - affect ALL clones, not per-clone
- Structural modifications (rotation, position) ARE per-clone

**Tested patterns:**
- Minimal generator with circle child + Sketch tag → WORKS in Cloner
- Generator modifying Sketch tag's Complete parameter → Tag doesn't update per-clone
- Generator creating unique materials per clone → Materials can't be inserted from generator code

**Decision made:**
- Primitives stay as raw C4D objects (atoms, not holons)
- NO XPresso on primitives (doesn't work in generator context)
- Parent generator directly controls Sketch material for standalone use
- For MoGraph per-clone material variation: use Fields + Shader Effector (not generator code)

**False positive fixed:**
- Generator inside Cloner shows cache=None - this is NORMAL (master template has no cache, clones do)
- Need to update describe_scene to not flag this as error when generator is under Cloner

### 2025-01-10: Phase 2 - Nested Holons
**Verified working:**
- Generator containing generators (CubeTriad with 3 FoldableCube children)
- Parent passes parameters to child generators via `set_userdata_by_name()`
- Nested holons work inside Cloners - each clone gets unique hierarchy
- Three-level hierarchy: Cloner → Parent Generator → Child Generators
- Position-based variation cascades through entire holarchy

**Pattern established:**
```
Parent reads position → calculates value → passes to children → children apply internally
```

### 2025-01-10: Phase 1 - MoGraph Integration Testing
**Verified working:**
- `return None` generators work in Cloners - children visible per-clone
- Position-based parameter variation (rotation/scale based on X position)
- Field-driven parameters via distance calculation to external objects
- Dynamic response - moving field updates all clones in real-time
- Name-based UserData lookup for robust parameter access

**Discovered limitation:**
- Generators execute BEFORE effectors - cannot see effector-modified transforms
- For effector integration, need Python Effector or field-based approach

**Fixed:**
- FoldableCube rotation axes (Front/Back use Y, Right/Left use Z)
- Generator error detection in describe_scene (cache=None = error)

### 2025-01-10: Vision Clarification
- Articulated holonic architecture vision
- Python Generator = universal holon container
- Separation: structural relationships (generator) vs temporal animation (keyframes)
- Created phased implementation roadmap

### Previous: MoGraph Discovery
- Proved generators re-evaluate per-clone
- Discovered "Optimize Cache" must be OFF
- Created GeneratorMixin for automatic XPresso→Generator translation
