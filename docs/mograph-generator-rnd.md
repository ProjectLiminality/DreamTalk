# Holonic Architecture & MoGraph Integration (R&D)

This document captures the emerging vision for DreamTalk's architecture: **Python Generators as the universal container for visual holons**, enabling recursive composition and MoGraph compatibility.

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

### Phase 1: MoGraph Integration (Current)

**Goal**: Full compatibility with Cinema 4D's MoGraph system - Cloners, Effectors, Fields.

- [ ] Test minimal `return None` generator in Cloner
- [ ] Verify children remain visible per-clone
- [ ] Confirm position-based parameter variation works
- [ ] Test Field sampling from generator code
- [ ] Test Effector influence on generator parameters
- [ ] Document the complete MoGraph workflow

### Phase 2: Nested Holons

**Goal**: Prove recursive composition works - a generator containing generators.

- [ ] Create simple two-level test (e.g., FoldableCube inside MindVirus)
- [ ] Verify parent can pass parameters to child generators via UserData
- [ ] Test in Cloner - do nested generators also re-evaluate per-clone?

### Phase 3: Primitive Handling

**Goal**: Decide and implement how primitives integrate with generator-based holons.

- [ ] Audit current XPresso usage on primitives (what does it actually do?)
- [ ] Test removing XPresso tags - what breaks?
- [ ] Prototype Python tag approach vs consolidated generator approach
- [ ] Decide on minimal pattern for visibility/material control

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

**Pass value to child generator's UserData:**
```python
child_gen[c4d.DescID(...)] = value
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

2. **Material assignment**: Currently XPresso drives Sketch tag parameters. What replaces this?

3. **Performance**: With deep holarchies, does generator nesting cause performance issues?

4. **Animation keyframes**: Can we keyframe UserData on generators the same way we do on Nulls?

5. **Editor visibility**: Does `return None` preserve Object Manager editability of children in all contexts?

## Session Log

### 2025-01-10: MoGraph Integration Testing
**Verified working:**
- `return None` generators work in Cloners - children visible per-clone
- Position-based parameter variation (rotation/scale based on X position)
- Field-driven parameters via distance calculation to external objects
- Dynamic response - moving field updates all clones in real-time

**Discovered limitation:**
- Generators execute BEFORE effectors - cannot see effector-modified transforms
- For effector integration, need Python Effector or field-based approach

### 2025-01-10: Vision Clarification
- Articulated holonic architecture vision
- Python Generator = universal holon container
- Separation: structural relationships (generator) vs temporal animation (keyframes)
- Created phased implementation roadmap

### Previous: MoGraph Discovery
- Proved generators re-evaluate per-clone
- Discovered "Optimize Cache" must be OFF
- Created GeneratorMixin for automatic XPresso→Generator translation
