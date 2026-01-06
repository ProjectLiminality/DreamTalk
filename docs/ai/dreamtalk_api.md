# DreamTalk API Reference

This document provides comprehensive documentation for creating DreamTalk scenes. DreamTalk is a programmatic animation library for Cinema 4D, inspired by 3blue1brown's manim.

## Quick Start

```python
from DreamTalk.imports import *

class MyScene(TwoDScene):
    def construct(self):
        circle = Circle(radius=100, color=BLUE)
        self.play(Create(circle), run_time=1)
        self.wait(0.5)

scene = MyScene(resolution="default", save=False)
```

---

## Scene Classes

### TwoDScene
2D scene with orthographic camera. Best for mathematical visualizations.

```python
class MyScene(TwoDScene):
    def construct(self):
        # Your scene construction here
        pass

scene = MyScene(resolution="default", alpha=True, save=False)
```

### ThreeDScene
3D scene with perspective camera.

```python
class My3DScene(ThreeDScene):
    def construct(self):
        sphere = Sphere(radius=100, color=RED)
        self.play(Create(sphere), run_time=1)
```

### Scene Parameters
- `resolution`: "verylow" (320x180), "low" (480x270), "default" (1280x720), "high" (2560x1440), "veryhigh" (3840x2160)
- `alpha`: Enable alpha channel (default: True)
- `save`: Auto-save render (default: False)

### Scene Methods
- `play(*animators, run_time=1)` - Execute animations over specified time
- `set(*animators)` - Instant animation (2 frames)
- `wait(seconds)` - Pause without animation
- `START()` / `STOP()` - Mark timeline boundaries

---

## Line Objects (Splines)

All line objects render as sketch/outline strokes.

### Circle
```python
circle = Circle(
    radius=200,           # Radius in units
    ellipse_ratio=1,      # 0-1, creates ellipse when < 1
    ring_ratio=1,         # 0-1, creates ring when < 1
    color=BLUE,           # Color constant or c4d.Vector
    x=0, y=0, z=0,        # Position
    name="MyCircle"       # Optional name
)

# Animation method
circle.change_radius(radius=300)  # Returns ScalarAnimation
```

### Rectangle
```python
rect = Rectangle(
    width=100,
    height=100,
    rounding=0,           # 0-1, corner rounding ratio
    color=RED
)
```

### Square
```python
square = Square(size=100, color=GREEN)
```

### Arc
```python
arc = Arc(
    radius=150,
    start_angle=0,        # Radians
    end_angle=PI/2,       # Radians
    color=PURPLE
)
```

### Triangle
```python
triangle = Triangle(radius=100, color=YELLOW)
```

### NSide (Regular Polygon)
```python
hexagon = NSide(radius=100, point_count=6, color=BLUE)
```

### Spline (Custom Points)
```python
spline = Spline(
    points=[(0, 0, 0), (100, 50, 0), (200, 0, 0)],
    spline_type="bezier",  # "linear", "cubic", "akima", "b-spline", "bezier"
    color=WHITE
)
```

### SplineText
```python
text = SplineText(
    text="Hello World",
    height=50,
    anchor="center",      # "left", "center", "right"
    seperate_letters=False,
    draw_order="left_to_right",
    color=WHITE
)
```

### Helix
```python
helix = Helix(
    start_radius=200,
    end_radius=200,
    start_angle=0,
    end_angle=2*PI,
    height=200,
    subdivision=100,
    color=BLUE
)
```

### SVG (Import SVG File)
```python
# Uses global SVG_PATH
svg = SVG(file_name="my_icon", x=0, y=0, z=0)

# Or with custom assets path (for sovereign symbols)
svg = SVG(file_name="my_icon", assets_path="/path/to/assets")
```

### SplineMask (Boolean Operations)
```python
mask = SplineMask(
    circle, rect,         # Input splines
    mode="union",         # "union", "a-b", "b-a", "and", "or", "intersection"
    axis="xz"
)
```

### SplineSymmetry
```python
sym = SplineSymmetry(spline, axis="x")  # "x", "y", "z"
```

---

## Solid Objects (3D Primitives)

All solid objects have fill materials and optional sketch outlines.

### Sphere
```python
sphere = Sphere(
    radius=100,
    filled=1,             # 0-1, fill amount
    color=RED,
    glow=False,           # Enable glow capability
    brightness=0.8        # Glow brightness if enabled
)
```

### Cube
```python
cube = Cube(
    width=100,
    height=100,
    depth=100,
    size=None,            # If set, overrides width/height/depth
    color=BLUE
)
```

### Cylinder
```python
cylinder = Cylinder(
    radius=50,
    height=150,
    orientation="x+",     # "x+", "x-", "y+", "y-", "z+", "z-"
    color=GREEN
)
```

### Cone
```python
cone = Cone(
    radius=50,
    height=150,
    orientation="y+",
    color=YELLOW
)
```

### Plane
```python
plane = Plane(
    width=400,
    height=400,
    width_segments=10,
    height_segments=10,
    orientation="z+",
    color=WHITE
)
```

### Extrude
```python
extrude = Extrude(
    circle, rect,         # Child splines to extrude
    offset=50,            # Extrusion depth
    color=BLUE
)
```

### Loft
```python
loft = Loft(color=RED)
# Add profile splines as children
```

### SweepNurbs
```python
sweep = SweepNurbs(
    rail=helix,           # Path spline
    profile=circle,       # Profile spline
    color=PURPLE
)
```

### Boole (Boolean Operations)
```python
boole = Boole(
    cube, sphere,         # Objects to combine
    mode="subtract",      # "union", "subtract", "intersect", "without"
    color=RED
)
```

### MetaBall
```python
meta = MetaBall(
    sphere1, sphere2,     # Children
    hull_value=1,
    subdivision=5,
    color=GREEN
)
```

---

## Custom Objects (Composites)

### Group
```python
group = Group(circle, rect, sphere, name="MyGroup")

# Iteration
for obj in group:
    print(obj)

# Indexing
first = group[0]

# Add children
group.add(new_circle)

# Positioning utilities
group.position_on_line(point_ini=(-200, 0, 0), point_fin=(200, 0, 0))
group.position_on_circle(radius=150, plane="xy")
group.position_on_spline(path_spline)

# Create connections between all children
connections = group.create_connections(completeness=0.5, turbulence=False)
```

### Connection
```python
connection = Connection(
    object_a, object_b,
    turbulence=False,
    arrow_end=True
)
```

---

## Animators

Animators wrap objects and call their animation methods.

### Creation/Destruction
```python
self.play(Create(obj), run_time=1)      # Animate creation
self.play(UnCreate(obj), run_time=1)    # Animate destruction
```

### Drawing (Line Objects)
```python
self.play(Draw(line_obj), run_time=1)   # Draw stroke
self.play(UnDraw(line_obj), run_time=1) # Undraw stroke
```

### Visibility
```python
self.play(FadeIn(obj), run_time=0.5)
self.play(FadeOut(obj), run_time=0.5)
```

### Fill (Solid Objects)
```python
self.play(Fill(solid_obj), run_time=1)
self.play(UnFill(solid_obj), run_time=1)
```

### Glow (Solid Objects with glow=True)
```python
self.play(Glow(sphere), run_time=0.5)
self.play(UnGlow(sphere), run_time=0.5)
```

### Transform
```python
self.play(Move(obj, x=100, y=50, z=0), run_time=1)
self.play(Rotate(obj, h=PI/2, p=0, b=0), run_time=1)
self.play(Scale(obj, scale=2), run_time=1)
```

### Color
```python
self.play(ChangeColor(obj, color=RED), run_time=0.5)
```

### Morph
```python
self.play(Morph(circle, square), run_time=1)
```

### Connect
```python
self.play(Connect(obj_a, obj_b, arrow=True), run_time=1)
self.play(UnConnect(obj_a, obj_b), run_time=1)
```

### Animator Parameters
All animators accept:
- `rel_start=0` - Relative start time (0-1)
- `rel_stop=1` - Relative stop time (0-1)
- `unpack_groups=True` - Whether to animate group children individually

---

## Animation Timing

### Sequential Animations
```python
self.play(Create(circle), run_time=1)
self.play(Move(circle, x=100), run_time=1)
```

### Simultaneous Animations
```python
self.play(
    Create(circle),
    Move(rect, x=100),
    run_time=1
)
```

### Staggered Animations
```python
self.play(
    Create(circle, rel_start=0, rel_stop=0.5),
    Create(rect, rel_start=0.5, rel_stop=1),
    run_time=2
)
```

---

## Constants

### Colors
```python
BLUE = c4d.Vector(0, 162, 255) / 255
RED = c4d.Vector(255, 100, 78) / 255
PURPLE = average_color(RED, BLUE)
YELLOW = c4d.Vector(218, 218, 88) / 255
GREEN = c4d.Vector(71, 196, 143) / 255
WHITE = c4d.Vector(255, 255, 255) / 255
BLACK = c4d.Vector(0, 0, 0) / 255
```

### Math
```python
PI = 3.141592653589793
```

### Project Settings
```python
FPS = 30
ASPECT_RATIO = 16/9
```

---

## Common Object Parameters

All objects accept these base parameters:
- `x`, `y`, `z` - Initial position
- `color` - Color (use constants or c4d.Vector)
- `name` - Object name
- `visible` - Initial visibility (default: True)
- `plane` - Orientation plane: "xy", "yz", "xz"

### LineObject Additional Parameters
- `draw_order` - "left_to_right", "right_to_left", "short_to_long", "long_to_short"
- `arrow_start`, `arrow_end` - Add arrows
- `stroke_width` - Line thickness (default: 5)

### SolidObject Additional Parameters
- `filled` - Fill amount 0-1
- `glow` - Enable glow (default: False)
- `brightness` - Glow brightness

---

## Object Methods

### All Objects
```python
obj.set_position(x=0, y=0, z=0)
obj.set_position(position=c4d.Vector(x, y, z))
obj.set_rotation(h=0, p=0, b=0)
obj.set_scale(scale=1)  # Uniform
obj.set_scale(x=1, y=1, z=1)  # Non-uniform

obj.move(x=100)  # Returns VectorAnimation
obj.rotate(h=PI/2)  # Returns VectorAnimation
obj.scale(scale=2)  # Returns ScalarAnimation

obj.get_center()  # Returns c4d.Vector
obj.get_bounding_box()  # Returns (width, height, depth)
```

### LineObject Methods
```python
line.draw(completion=1)  # Returns ScalarAnimation
line.un_draw(completion=0)
line.fade_in(completion=1)
line.fade_out(completion=0)
line.change_color(color=RED)  # Returns ColorAnimation
```

### SolidObject Methods
```python
solid.fill(completion=1)
solid.un_fill(completion=0)
solid.glow(completion=1)  # If glow=True
solid.un_glow(completion=0)
solid.draw(completion=1)  # Sketch outline
solid.un_draw(completion=0)
```

### CustomObject Methods
```python
custom.create(completion=1)
custom.un_create(completion=0)
```

---

## Complete Example

```python
from DreamTalk.imports import *

class TaylorSeriesDemo(TwoDScene):
    def construct(self):
        # Create objects
        title = SplineText("Taylor Series", height=40, color=WHITE, y=300)
        circle = Circle(radius=100, color=BLUE)
        squares = Group(*[
            Square(size=30, color=RED, x=-150 + i*50)
            for i in range(7)
        ])

        # Animate title
        self.play(Draw(title), run_time=1)
        self.wait(0.5)

        # Create circle
        self.play(Create(circle), run_time=1)

        # Create squares with stagger
        self.play(Create(squares), run_time=2)

        # Move and transform
        self.play(
            Move(circle, y=-100),
            Scale(squares, scale=0.5),
            run_time=1
        )

        # Connect objects
        self.play(Connect(circle, squares), run_time=1)

        # Final wait
        self.wait(1)

scene = TaylorSeriesDemo(resolution="default", save=False)
```

---

## Sketch-Based Objects (Sovereign Symbols)

These objects load SVG files and are designed as reusable symbols:

```python
# Built-in symbols (in sketch_objects.py)
fire = Fire(glow=True, brightness=0.8)  # Fire symbol with optional glow
human = Human(color=BLUE)               # Human figure

# The Sketch base class for custom SVG symbols
class MySymbol(Sketch):
    def __init__(self, **kwargs):
        super().__init__(file_name="my_symbol", **kwargs)
```

---

## Tips for Scene Creation

1. **Start simple**: Create objects first, then add animations
2. **Use groups**: Group related objects for easier manipulation
3. **Timing**: Use `rel_start`/`rel_stop` for complex timing
4. **Colors**: Stick to the built-in color constants for consistency
5. **Resolution**: Use "low" for iteration, "default" or higher for final renders
6. **Wait calls**: Add `self.wait()` between sequences for breathing room
