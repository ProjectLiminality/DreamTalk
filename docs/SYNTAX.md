# DreamTalk Canonical Syntax

*The platonic specification for DreamWeavings.*

---

## The Greater Trinity

DreamTalk exists within a larger metaphysical framework:

| Aspect | Domain | What it IS |
|--------|--------|------------|
| **DreamTalk** | Kairos (timeless) | Sovereign symbols - holons as relational patterns |
| **DreamSong** | Kronos (temporal) | Scenes/videos - holons expressing through time |
| **DreamWeaving** | Intersection | The Python file - bridging timeless pattern and temporal expression |

A **DreamTalk symbol** is a timeless relational structure (the class definition).
A **DreamSong** is a chronological sequence where symbols express themselves (the `unfold()` method).
A **DreamWeaving** is the act of creation itself - the living Python file that contains both.

The creative flow: You tell a story (DreamSong) using symbols (DreamTalk), and as you do,
a higher-level holon crystallizes (the file becomes a new DreamTalk symbol).

---

## The Syntax Trinity

DreamTalk encodes a metaphysical framework into its syntax:

| Concept | Domain | DreamTalk | Manifestation |
|---------|--------|-----------|---------------|
| **Kairos** | Timeless pattern | **Holon** | The class definition |
| **Kronos** | Temporal flow | **Dream** | The `unfold()` method |
| **Intersection** | Living bridge | **DreamWeaving** | The Python file itself |

- **Kairos**: The eternal now. Relationships exist outside time.
- **Kronos**: Sequential time. Events unfold in order.
- **DreamWeaving**: The act of pulling Kairos into Kronos.

---

## File Structure

Every DreamWeaving follows this pattern:

```python
"""
<HolonName>.py - A DreamWeaving

<Description of what this holon represents.>
"""

from dreamtalk import Holon, Dream
from dreamtalk.types import Length, Angle, Bipolar, Color, Completion
from dreamtalk.parts import Circle, Sphere, FoldableCube  # etc.
from dreamtalk.animation import Create, Draw, Morph

# === Kairos: The Timeless Pattern ===

class <HolonName>(Holon):
    """<What this holon IS - its essential nature.>"""

    # Parameters - degrees of freedom
    <param>: <Type> = <default>

    def specify_parts(self):
        """Define parts and their relationships to this whole."""
        self.<part> = <PartClass>(
            <property> << self.<param>,  # one-way binding
            <property> <> self.<param>,  # bidirectional constraint
        )
        self.parts = [self.<part>, ...]


# === Kronos: The Temporal Unfolding ===

if __name__ == "__main__":

    class <HolonName>Dream(Dream):
        """<What happens when this holon dreams itself into existence.>"""

        def unfold(self):
            <holon> = <HolonName>(<params>)
            self.play(Create(<holon>), run_time=1.5)
            # ... temporal sequence ...

    <HolonName>Dream()
```

---

## Parameter Types

Parameters define the degrees of freedom of a holon:

| Type | Range | Example |
|------|-------|---------|
| `Length` | 0 → ∞ | `radius: Length = 100` |
| `Angle` | 0 → 2π | `rotation: Angle = 0` |
| `Bipolar` | -1 → 1 | `fold: Bipolar = 0` |
| `Completion` | 0 → 1 | `progress: Completion = 0` |
| `Color` | RGB/named | `color: Color = BLUE` |
| `Integer` | ℤ | `count: Integer = 6` |

These are **semantic types** - they communicate intent and enable smart defaults in the UI.

---

## Binding Operators

### `<<` One-Way Binding (Whole → Part)

The part's property follows the whole's parameter:

```python
self.circle = Circle(
    radius << self.size  # circle.radius follows self.size
)
```

Data flows **downward** through the holarchy. The part receives from the whole.

### `<>` Bidirectional Constraint

Mutual relationship - neither dominates:

```python
self.a = Circle(radius <> self.b.radius)  # they stay equal
```

Use sparingly. Most relationships are hierarchical (`<<`).

---

## Behaviors

Behaviors are methods that return animations - ways of moving through Kronos:

```python
class MindVirus(Holon):
    fold: Bipolar = 0

    def specify_parts(self):
        self.cube = FoldableCube(fold << self.fold)
        self.parts = [self.cube]

    # Behaviors
    def thrust_pulse(self, distance=100):
        """Jellyfish-like locomotion."""
        return AnimationGroup(
            self.animate.fold.sequence(1, 0.1, 1),
            self.animate.z(-distance)
        )

    def hunt(self, target):
        """Move toward a target."""
        return self.animate.position(target.position)
```

Usage in a Dream:

```python
def unfold(self):
    virus = MindVirus()
    self.play(virus.thrust_pulse(200), run_time=1.2)
```

---

## The `.animate` Pattern

Fluent animation syntax (inspired by Manim):

```python
# Animate a single parameter
self.play(virus.animate.fold(0.5), run_time=1)

# Chain multiple animations
self.play(
    virus.animate.fold(0.5).color(RED).scale(2),
    run_time=1.5
)

# Sequence of values
self.play(virus.animate.fold.sequence(1, 0.1, 1), run_time=2)
```

---

## State Machines

For agentic holons with discrete modes:

```python
class MindVirus(Holon):
    fold: Bipolar = 0

    class States:
        idle = State(fold=1)
        hunting = State(fold=0.5)
        attached = State(fold=-1)

    def specify_parts(self):
        # ...
```

Transition between states:

```python
def unfold(self):
    virus = MindVirus()
    self.play(virus.transition_to(virus.States.hunting), run_time=0.5)
```

---

## Fields (Spatial Relationships)

For MoGraph-like spatial distributions:

```python
class Swarm(Holon):
    attraction: Length = 100

    def specify_parts(self):
        self.field = AttractionField(strength=self.attraction)
        self.viruses = [MindVirus() for _ in range(10)]

        for virus in self.viruses:
            virus.velocity << self.field.at(virus.position)

        self.parts = [self.field, *self.viruses]
```

---

## Temporal Bindings

For time-entangled relationships:

```python
# Delayed binding - b follows a with 0.5s delay
self.b.position << self.a.position.delayed(0.5)

# Creates trailing/following effects
```

---

## Morphing (Transform)

Morphing is a **capability** of spline-based holons, not a separate class.

```python
# Morph one shape into another
self.play(word.morph_to(logo), run_time=2)

# Or using Transform (Manim-style naming)
self.play(Transform(word, logo), run_time=2)
```

The morph handles:
- Spline interpolation between source and target
- Automatic visibility handoff at midpoint
- Stroke completion animation during transition

**Design principle**: Abilities belong to objects, not to separate "stuntman" classes.
If a LineObject can draw itself, it can also morph itself.

---

## Complete Example

```python
"""
MindVirus.py - A DreamWeaving

A manipulative narrative with folding control mechanism.
The eye sees; the cube entraps.
"""

from dreamtalk import Holon, Dream
from dreamtalk.types import Bipolar, Color, Length
from dreamtalk.parts import Circle, FoldableCube
from dreamtalk.animation import Create, AnimationGroup

# === Kairos: The Timeless Pattern ===

class MindVirus(Holon):
    """A self-replicating thought-form that attaches to minds."""

    # Parameters
    fold: Bipolar = 0        # -1 (wrapped) to 1 (open)
    color: Color = BLUE
    size: Length = 100

    # States
    class States:
        idle = State(fold=1)
        hunting = State(fold=0.5)
        attached = State(fold=-1)

    def specify_parts(self):
        self.eye = Circle(
            radius << self.size * 0.2
        )
        self.cube = FoldableCube(
            fold << self.fold,
            color << self.color,
            size << self.size
        )
        self.parts = [self.eye, self.cube]

    # Behaviors
    def thrust_pulse(self, distance=100):
        """Jellyfish-like locomotion through the void."""
        return AnimationGroup(
            self.animate.fold.sequence(1, 0.1, 1),
            self.animate.z(-distance)
        )


# === Kronos: The Temporal Unfolding ===

if __name__ == "__main__":

    class MindVirusDream(Dream):
        """A MindVirus awakens, pulses, and hunts."""

        def unfold(self):
            virus = MindVirus(color=PURPLE, size=150)

            # Emerge from nothing
            self.play(Create(virus), run_time=1.5)

            # Pulse through space
            self.play(virus.thrust_pulse(200), run_time=1.2)
            self.play(virus.thrust_pulse(150), run_time=1.0)

            # Settle into hunting stance
            self.play(
                virus.transition_to(virus.States.hunting),
                run_time=0.8
            )

            self.wait(1)

    MindVirusDream()
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Holon class | PascalCase | `MindVirus`, `FlowerOfLife` |
| Dream class | `<Holon>Dream` | `MindVirusDream` |
| Parameters | snake_case | `fold`, `inner_radius` |
| Parts | snake_case | `self.eye`, `self.cube` |
| Behaviors | snake_case verb | `thrust_pulse`, `hunt` |
| States | snake_case | `States.idle`, `States.hunting` |
| File | `<Holon>.py` | `MindVirus.py` |

---

## Philosophy Encoded

The syntax itself teaches:

1. **Holon** - Every whole is also a part. Sovereignty at every scale.

2. **`<<` flows downward** - The whole provides for its parts. Masculine serves feminine.

3. **`unfold()` not `construct()`** - We don't build; we allow revelation.

4. **Dream not Scene** - Creation is dreaming, not engineering.

5. **The file IS the holon** - Code and manifestation are one. The map is the territory.

6. **Kairos contains Kronos** - The timeless class definition contains all possible temporal unfoldings.

---

*DreamTalk: Where mathematics dreams itself into motion.*
