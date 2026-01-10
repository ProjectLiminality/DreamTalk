# XPresso Migration Plan

## Goal
Migrate DreamTalk from XPresso-based parameter relationships to Python Generator-based approach, enabling:
- MoGraph Cloner compatibility
- Faster rendering (no XPresso evaluation overhead)
- Cleaner GLTF/USD export
- No Sketch & Toon dependency (using geometry-based strokes)

## Migration Patterns

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

## Classes to Migrate

### Phase 1: Camera System (COMPLETED)
- [x] ThreeDCamera - spherical coordinates, zoom interpolation
- [x] TwoDCamera - zoom relation

### Phase 2: Core Objects (PARTIALLY COMPLETED)
- [x] FoldableCube - fold relations (uses GeneratorMixin)
- [ ] CustomObject - XIdentity for visibility
- [ ] Group - bounding box relations

### Phase 3: Effects/Animators (FUTURE)
- [ ] Morpher - complex spline segment mapping (uses extensive XPresso)
- [ ] Breathing - sinusoidal animation
- [ ] Explosion - multi-part animation

### Phase 4: Stroke Mode Integration (COMPLETED)
- [x] stroke_mode already in SolidObject base class
- [x] USD class inherits stroke_mode support
- [x] SweepNurbs class inherits stroke_mode support
- [x] HumanMind updated with explicit stroke_mode parameter

## Implementation Status

### Completed
1. **FoldableCube**: `generator_mode=True` parameter uses Python Generator for fold relations
2. **ThreeDCamera**: Generator-based spherical coordinate camera control
3. **TwoDCamera**: Generator-based zoom control
4. **MindVirus**: Updated with `generator_mode` support, passes to FoldableCube
5. **HumanMind**: Added explicit `stroke_mode` parameter
6. **Test Suite**: `test_full_migration.py` validates complete scene

### Remaining Work
- CustomObject: General XIdentity patterns for visibility
- Group: Bounding box relations
- Morpher: Complex spline segment mapping (low priority)
- Breathing/Explosion: Animation effects (low priority)

## Key Design Decisions

### Generator Mode Flag
Add `generator_mode=False` parameter to CustomObject base class:
- When `True`, wraps object in Python Generator
- Generator code reads UserData and sets child properties
- Enables MoGraph compatibility

### Stroke Mode Flag
Already implemented in LineObject and SolidObject:
- When `True`, uses geometry-based strokes instead of Sketch & Toon
- Combined with `sketch_mode=False` on Scene for full independence

### Animation System
Keep keyframe-based animation system (ScalarAnimation, VectorAnimation):
- Already works without XPresso
- Just need to ensure all creation animations use this pattern

### MindVirus Generator Mode
MindVirus uses helper methods to abstract fold control:
- `_get_fold_target_and_desc()`: Returns correct target for animations
- `_set_fold_value(value)`: Sets fold on appropriate target
- In generator_mode, animates cube's UserData directly (no XIdentity needed)
