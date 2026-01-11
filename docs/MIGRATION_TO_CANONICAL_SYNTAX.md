# Migration to Canonical DreamTalk Syntax

This document outlines the changes needed to evolve the DreamTalk library
from its current state to support the canonical syntax defined in `docs/SYNTAX.md`.

## Overview

The migration preserves backward compatibility while adding the new syntax.
Old code continues to work; new code can use the cleaner syntax.

---

## Phase 1: Naming (Aliases)

### 1.1 Holon (alias for CustomObject)

**File:** `objects/abstract_objects.py`

```python
# At the end of the file, add alias
Holon = CustomObject
```

**File:** `imports.py`

```python
# Export the alias
from DreamTalk.objects.abstract_objects import Holon
```

### 1.2 Dream (alias for Scene classes)

**File:** `scene.py`

```python
# At the end of the file, add aliases
Dream = Scene  # Abstract base
TwoDDream = TwoDScene
ThreeDDream = ThreeDScene
```

### 1.3 unfold() (alias for construct())

**File:** `scene.py`

In the `Scene` base class, check for both methods:

```python
def __init__(self, ...):
    ...
    # Support both construct() and unfold()
    if hasattr(self, 'unfold') and callable(self.unfold):
        self.unfold()
    else:
        self.construct()
```

---

## Phase 2: Type-Hinted Parameters

### 2.1 Parameter Type Classes

**File:** `xpresso/types.py` (NEW)

```python
"""
DreamTalk Parameter Types

These classes serve as type hints AND default value containers.
The library introspects class annotations to create UserData.
"""

class ParameterType:
    """Base class for parameter types."""
    def __init__(self, default=None):
        self.default = default

class Length(ParameterType):
    """Length parameter (0 → ∞)"""
    c4d_type = "DTYPE_REAL"
    unit = "DESC_UNIT_METER"

class Angle(ParameterType):
    """Angle parameter (0 → 2π)"""
    c4d_type = "DTYPE_REAL"
    unit = "DESC_UNIT_DEGREE"

class Bipolar(ParameterType):
    """Bipolar parameter (-1 → 1)"""
    c4d_type = "DTYPE_REAL"
    min_val = -1
    max_val = 1

class Completion(ParameterType):
    """Completion parameter (0 → 1)"""
    c4d_type = "DTYPE_REAL"
    min_val = 0
    max_val = 1

class Color(ParameterType):
    """Color parameter"""
    c4d_type = "DTYPE_COLOR"

class Integer(ParameterType):
    """Integer parameter"""
    c4d_type = "DTYPE_LONG"

class Bool(ParameterType):
    """Boolean parameter"""
    c4d_type = "DTYPE_BOOL"
```

### 2.2 Auto-Parameter Detection in CustomObject/Holon

**File:** `objects/abstract_objects.py`

Modify `CustomObject.__init__()` to introspect class annotations:

```python
def __init__(self, **kwargs):
    # Collect type-hinted parameters from class annotations
    self._collect_annotated_parameters()
    ...

def _collect_annotated_parameters(self):
    """Introspect class annotations to create parameters."""
    from DreamTalk.xpresso.types import ParameterType

    annotations = getattr(self.__class__, '__annotations__', {})
    for name, type_hint in annotations.items():
        # Skip non-parameter annotations
        if not isinstance(type_hint, type) or not issubclass(type_hint, ParameterType):
            continue

        # Get default value from class attribute
        default = getattr(self.__class__, name, None)
        if isinstance(default, ParameterType):
            default = default.default

        # Create UserData parameter
        param = self._create_parameter_from_type(name, type_hint, default)
        self.parameters.append(param)

        # Also set as instance attribute for binding access
        setattr(self, name, param)
```

---

## Phase 3: Inline Bindings

### 3.1 Binding Collection in Part Constructors

The current `<<` operator creates `Binding` objects. We need to:

1. Allow bindings to be passed to part constructors
2. Collect bindings during `specify_parts()`
3. Compile bindings to generator code

**File:** `xpresso/bindings.py`

Add support for inline binding syntax:

```python
class PartProxy:
    """Wraps a part to support inline bindings in constructors."""

    def __init__(self, part_class, **kwargs):
        self.part_class = part_class
        self.bindings = []
        self.kwargs = {}

        for key, value in kwargs.items():
            if isinstance(value, Binding):
                self.bindings.append((key, value))
            else:
                self.kwargs[key] = value

    def instantiate(self, parent):
        """Create the actual part and register bindings."""
        part = self.part_class(**self.kwargs)
        for prop_name, binding in self.bindings:
            binding.target = PartPropertyRef(part, prop_name)
            parent._bindings.append(binding)
        return part
```

### 3.2 Binding-Aware Part Classes

Modify LineObject, SolidObject, etc. to detect and collect bindings:

```python
class Circle(LineObject):
    def __init__(self, radius=100, **kwargs):
        # Check for binding syntax
        if isinstance(radius, Binding):
            # Store binding for later collection
            kwargs['_bindings'] = kwargs.get('_bindings', [])
            kwargs['_bindings'].append(('radius', radius))
            radius = radius.get_default() or 100

        self._radius = radius
        super().__init__(**kwargs)
```

---

## Phase 4: .animate Fluent API

### 4.1 Animator Proxy Class

**File:** `animation/animate.py` (NEW)

```python
"""
Fluent animation API for DreamTalk.

Provides the .animate property pattern from Manim:
    virus.animate.fold(0.5)
    virus.animate.fold.sequence(1, 0.1, 1)
    virus.animate.position(target.position)
"""

class AnimatorProxy:
    """Proxy object returned by holon.animate"""

    def __init__(self, target):
        self.target = target

    def __getattr__(self, name):
        """Return a ParameterAnimator for the named parameter."""
        return ParameterAnimator(self.target, name)


class ParameterAnimator:
    """Animator for a specific parameter."""

    def __init__(self, target, param_name):
        self.target = target
        self.param_name = param_name

    def __call__(self, value):
        """Animate to a single value."""
        from DreamTalk.animation.animation import ScalarAnimation
        param = getattr(self.target, self.param_name + '_parameter', None)
        if param:
            desc_id = param.desc_id
        else:
            # Handle position components (x, y, z)
            desc_id = self._get_position_desc_id()

        return ScalarAnimation(
            target=self.target,
            descriptor=desc_id,
            value_fin=value
        )

    def sequence(self, *values):
        """Animate through a sequence of values."""
        from DreamTalk.animation.animation import AnimationGroup, ScalarAnimation
        animations = []
        n = len(values)
        for i, value in enumerate(values):
            anim = ScalarAnimation(
                target=self.target,
                descriptor=self._get_desc_id(),
                value_fin=value,
                rel_start=i/n,
                rel_stop=(i+1)/n
            )
            animations.append(anim)
        return AnimationGroup(*animations)
```

### 4.2 Add .animate Property to Holon

**File:** `objects/abstract_objects.py`

```python
class CustomObject(VisibleObject):
    ...

    @property
    def animate(self):
        """Return animator proxy for fluent animation syntax."""
        from DreamTalk.animation.animate import AnimatorProxy
        return AnimatorProxy(self)
```

---

## Phase 5: State Machines

### 5.1 State Class

**File:** `xpresso/states.py` (NEW)

```python
"""
State machine support for agentic holons.
"""

class State:
    """A discrete state configuration."""

    def __init__(self, **param_values):
        self.param_values = param_values

    def __repr__(self):
        return f"State({self.param_values})"


class StateMachine:
    """Manages state transitions for a holon."""

    def __init__(self, holon, states_class):
        self.holon = holon
        self.states = {}
        self.current_state = None

        # Collect states from class
        for name in dir(states_class):
            value = getattr(states_class, name)
            if isinstance(value, State):
                self.states[name] = value

    def transition_to(self, state):
        """Return animation to transition to a state."""
        from DreamTalk.animation.animation import AnimationGroup

        animations = []
        for param_name, value in state.param_values.items():
            param = getattr(self.holon, param_name + '_parameter', None)
            if param:
                anim = self.holon.animate.__getattr__(param_name)(value)
                animations.append(anim)

        self.current_state = state
        return AnimationGroup(*animations) if animations else None
```

### 5.2 State Support in Holon

**File:** `objects/abstract_objects.py`

```python
class CustomObject(VisibleObject):
    def __init__(self, **kwargs):
        ...
        # Set up state machine if States class is defined
        if hasattr(self.__class__, 'States'):
            from DreamTalk.xpresso.states import StateMachine
            self._state_machine = StateMachine(self, self.__class__.States)

    def transition_to(self, state):
        """Transition to a state (returns animation)."""
        if hasattr(self, '_state_machine'):
            return self._state_machine.transition_to(state)
        raise ValueError("No States class defined on this holon")
```

---

## Phase 6: Clean Imports

### 6.1 New Import Structure

**File:** `dreamtalk/__init__.py` (NEW top-level package)

For the cleanest imports (`from dreamtalk import Holon, Dream`), we can
either rename the package or create a new entry point.

**Option A: Aliased imports in current structure**

**File:** `imports.py`

```python
# Type aliases for canonical syntax
from DreamTalk.xpresso.types import Length, Angle, Bipolar, Completion, Color, Integer, Bool
from DreamTalk.xpresso.states import State

# Class aliases
Holon = CustomObject
Dream = Scene
TwoDDream = TwoDScene
ThreeDDream = ThreeDScene
```

**Option B: Create dreamtalk package alias**

Create `DreamTalk/dreamtalk.py`:

```python
"""
Canonical DreamTalk imports.

Usage:
    from DreamTalk.dreamtalk import Holon, Dream
    from DreamTalk.dreamtalk import Length, Bipolar, Color
"""

from DreamTalk.objects.abstract_objects import CustomObject as Holon
from DreamTalk.scene import Scene as Dream, TwoDScene as TwoDDream, ThreeDScene as ThreeDDream
from DreamTalk.xpresso.types import Length, Angle, Bipolar, Completion, Color, Integer, Bool
from DreamTalk.xpresso.states import State
```

---

## Implementation Order

1. **Phase 1: Naming** - Quick wins, no breaking changes
2. **Phase 4: .animate API** - High value, isolated change
3. **Phase 5: State Machines** - Builds on .animate
4. **Phase 2: Type-Hinted Parameters** - Requires careful design
5. **Phase 3: Inline Bindings** - Most complex, depends on Phase 2
6. **Phase 6: Clean Imports** - Final polish

---

## Backward Compatibility

All changes maintain backward compatibility:

- `CustomObject` still works (Holon is alias)
- `Scene` still works (Dream is alias)
- `construct()` still works (unfold() is alternative)
- `ULength`, `UBipolar` still work (type hints are alternative)
- `specify_relationships()` still works (inline bindings are alternative)
- `specify_generator_code()` still works (auto-generation is alternative)

Existing DreamNodes continue to function without modification.

---

## Testing Strategy

1. Ensure all existing tests pass after each phase
2. Add new tests for canonical syntax
3. Create reference implementations:
   - `docs/reference/MindVirus_canonical.py` ✓
   - `docs/reference/FlowerOfLife_canonical.py`
   - `docs/reference/Swarm_canonical.py` (state machines)

---

## Files to Create/Modify

### New Files
- `xpresso/types.py` - Parameter type classes
- `xpresso/states.py` - State machine support
- `animation/animate.py` - Fluent animation API
- `dreamtalk.py` - Clean import entry point
- `docs/reference/` - Reference implementations

### Modified Files
- `objects/abstract_objects.py` - Holon alias, .animate property, state support
- `scene.py` - Dream alias, unfold() support
- `imports.py` - Export new names
- `xpresso/bindings.py` - Inline binding support

---

*This migration transforms DreamTalk from a technical animation library
into a philosophical language where the syntax itself teaches holonic thinking.*
