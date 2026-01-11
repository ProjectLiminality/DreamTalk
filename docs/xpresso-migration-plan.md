# XPresso Migration Plan

## Status: MIGRATION COMPLETE (v2.0)

As of the v2.0 architecture refactor, the migration from XPresso to Python Generators is **complete**. This document now serves as historical reference and migration guide for any DreamNodes that haven't been updated.

## What Changed in v2.0

### Breaking Changes
1. **No more `generator_mode` parameter** - All objects use generators by default
2. **No more `sketch_mode` parameter** - All strokes are geometry-based
3. **No more `stroke_mode` parameter** - All objects render with geometry strokes
4. **No Sketch & Toon VideoPost** - Scene no longer creates one
5. **No XPresso anywhere** - Pure Python Generator relationships

### New Architecture
- `LineObject`: Wraps spline in StrokeGen automatically
- `SolidObject`: Wraps mesh in SilhouetteSplineGen + StrokeGen
- `CustomObject`: Always a Python Generator container
- `Scene`: No sketch_mode, generator_mode parameters

### Legacy Files
Old implementations preserved in `/legacy/` for reference:
- `abstract_objects_legacy.py`
- `scene_legacy.py`
- `materials_legacy.py`
- `tags_legacy.py`

---

## Migration Patterns (Historical Reference)

### Pattern 1: XIdentity → Direct Setting in Generator
XIdentity links a parent parameter to a child parameter 1:1.

**Before (XPresso):**
```python
def specify_relations(self):
    XIdentity(part=self.child, whole=self, desc_ids=[POS_X], parameter=self.x_param)
```

**After (Generator):**
```python
def specify_generator_code(self):
    return '''
def main():
    x = get_userdata_by_name(op, "X")
    child = op.GetDown()
    while child:
        if child.GetName() == "ChildName":
            child[c4d.ID_BASEOBJECT_POSITION,c4d.VECTOR_X] = x
        child = child.GetNext()
    return None
'''
```

### Pattern 2: XRelation → Formula in Generator
XRelation applies a formula to transform parameter values.

**Before (XPresso):**
```python
def specify_relations(self):
    XRelation(part=self.axis, whole=self, desc_ids=[ROT_P],
              parameters=[self.fold_param], formula="PI/2 * Fold")
```

**After (Generator):**
```python
def specify_generator_code(self):
    return '''
def main():
    fold = get_userdata_by_name(op, "Fold")
    angle = fold * PI / 2
    child = op.GetDown()
    while child:
        if child.GetName() == "FrontAxis":
            child.SetRelRot(c4d.Vector(0, angle, 0))
        child = child.GetNext()
    return None
'''
```

### Pattern 3: XAction → Keyframe Animations
XAction orchestrates multiple parameter movements over a completion timeline.

**Before (XPresso):**
```python
def specify_creation(self):
    creation_action = XAction(
        Movement(self.fill_param, (0, 0.5), output=(0, 1)),
        Movement(self.draw_param, (0.5, 1), output=(0, 1)),
        target=self, completion_parameter=self.creation_parameter
    )
```

**After (Keyframes):**
```python
def create(self, completion=1):
    animations = []
    # Fill: 0-50% of timeline
    fill_anim = ScalarAnimation(
        target=self, descriptor=self.fill_param.desc_id,
        value_ini=0, value_fin=completion, rel_start=0, rel_stop=0.5
    )
    # Draw: 50-100% of timeline
    draw_anim = ScalarAnimation(
        target=self, descriptor=self.draw_param.desc_id,
        value_ini=0, value_fin=completion, rel_start=0.5, rel_stop=1
    )
    return AnimationGroup(fill_anim, draw_anim)
```

---

## Updating Existing DreamNodes

If you have DreamNodes written for the old architecture, update them as follows:

### Step 1: Remove Deprecated Parameters
```python
# Old
class MyScene(ThreeDScene):
    def __init__(self):
        super().__init__(sketch_mode=False, generator_mode=True)

# New
class MyScene(ThreeDScene):
    def __init__(self):
        super().__init__()  # No sketch_mode or generator_mode needed
```

### Step 2: Remove specify_relations()
Move all XPresso logic into `specify_generator_code()`:

```python
# Old
def specify_relations(self):
    XIdentity(part=self.part, whole=self, ...)

# New
def specify_generator_code(self):
    return '''
def main():
    # Same logic, now in Python
    return None
'''
```

### Step 3: Update CustomObjects
Remove `generator_mode=True` from CustomObject instantiation:

```python
# Old
cube = FoldableCube(generator_mode=True, ...)

# New
cube = FoldableCube(...)  # Generators are always used now
```

---

## Benefits of v2.0 Architecture

1. **MoGraph Compatible** - All objects work inside Cloners
2. **Faster Rendering** - No post-effect overhead from Sketch & Toon
3. **Simpler API** - No mode flags to worry about
4. **Cleaner Exports** - Better GLTF/USD support
5. **Git-Friendly** - Python code instead of binary XPresso
