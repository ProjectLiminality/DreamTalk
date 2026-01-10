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

### Phase 1: Camera System
- [ ] ThreeDCamera - spherical coordinates, zoom interpolation
- [ ] TwoDCamera - zoom relation

### Phase 2: Core Objects
- [ ] FoldableCube - fold relations (already has GeneratorMixin)
- [ ] CustomObject - XIdentity for visibility
- [ ] Group - bounding box relations

### Phase 3: Effects/Animators
- [ ] Morpher - complex spline segment mapping
- [ ] Breathing - sinusoidal animation
- [ ] Explosion - multi-part animation

### Phase 4: Stroke Mode Integration
- [ ] Add stroke_mode to USD class
- [ ] Add stroke_mode to SweepNurbs class
- [ ] Update all solid objects to support stroke_mode

## Implementation Order

1. **FoldableCube**: Add `generator_mode=True` parameter that uses Python Generator instead of XPresso
2. **ThreeDCamera**: Create generator-based implementation
3. **MindVirus**: Update to use `generator_mode=True` for FoldableCube
4. **Test MindVirusInfection**: Validate complete scene works
5. **Clean up**: Remove unused XPresso code

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
