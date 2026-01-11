"""
DreamTalk Abstract Objects - Fresh Architecture (v2.0)

This module provides the base classes for all DreamTalk visual objects.
Completely rebuilt without Sketch & Toon or XPresso dependencies.

Key design principles:
- Geometry-based stroke rendering (no post-effects)
- Python Generators for all parameter relationships (no XPresso)
- MoGraph-native from the ground up
- Clean separation: structural (generator) vs temporal (keyframes)

Base classes:
- ProtoObject: Foundation for all objects (position, rotation, scale)
- VisibleObject: Objects that can be seen (visibility, creation animation)
- LineObject: Spline-based objects with stroke rendering
- SolidObject: 3D mesh objects with fill and stroke rendering
- CustomObject: Composite objects (holons) using Python Generators
"""

from abc import ABC, abstractmethod
import c4d
import c4d.utils

from DreamTalk.constants import WHITE, BLACK, PI, FPS
from DreamTalk.animation.animation import VectorAnimation, ScalarAnimation, ColorAnimation
from DreamTalk.xpresso.userdata import UGroup, UCompletion, UCheckBox, ULength, UVector, UColor
from DreamTalk.objects.stroke_objects import STROKE_GEN_CODE, SILHOUETTE_SPLINE_GEN_CODE, StrokeMaterial
from DreamTalk.xpresso.bindings import collect_relationships
from DreamTalk.xpresso.states import collect_states


# =============================================================================
# PROTO OBJECT - Foundation
# =============================================================================

class ProtoObject(ABC):
    """
    Foundation for all DreamTalk objects.

    Provides:
    - Document insertion
    - Position, rotation, scale
    - Name management
    - Plane orientation (xy, yz, xz)
    """

    def __init__(self, name=None, x=0, y=0, z=0, h=0, p=0, b=0, scale=1,
                 position=None, rotation=None, plane="xy"):
        self.document = c4d.documents.GetActiveDocument()
        self.specify_object()
        self.set_unique_desc_ids()
        self.insert_to_document()
        self.set_name(name=name)
        self.set_position(x=x, y=y, z=z, position=position)
        self.set_rotation(h=h, p=p, b=b, rotation=rotation)
        self.set_scale(scale=scale)
        self.set_object_properties()
        self.plane = plane
        self.set_plane()
        self.parent = None

    def __repr__(self):
        return self.name

    @abstractmethod
    def specify_object(self):
        """Create the C4D object. Must set self.obj."""
        pass

    def set_unique_desc_ids(self):
        """Optional: define desc_ids dict for object-specific parameters."""
        pass

    def set_object_properties(self):
        """Optional: set object-specific properties after creation."""
        pass

    def set_name(self, name=None):
        if name is None:
            self.name = self.__class__.__name__
        else:
            self.name = name
        self.obj.SetName(self.name)

    def set_plane(self):
        """Set the orientation plane for 2D objects."""
        if self.plane == "xy":
            pass  # Default orientation
        elif self.plane == "yz":
            self.obj[c4d.ID_BASEOBJECT_ROTATION] += c4d.Vector(PI / 2, 0, 0)
        elif self.plane == "xz":
            self.obj[c4d.ID_BASEOBJECT_ROTATION] += c4d.Vector(0, -PI / 2, 0)

    def insert_to_document(self):
        self.document.InsertObject(self.obj)

    def set_position(self, x=0, y=0, z=0, position=None, relative=False):
        if position is None:
            position = c4d.Vector(x, y, z)
        elif type(position) is not c4d.Vector:
            position = c4d.Vector(*position)
        if relative:
            self.obj[c4d.ID_BASEOBJECT_POSITION] += position
        else:
            self.obj[c4d.ID_BASEOBJECT_POSITION] = position

    def set_rotation(self, h=0, p=0, b=0, rotation=None, relative=False):
        if rotation is None:
            rotation = c4d.Vector(h, p, b)
        elif type(rotation) is not c4d.Vector:
            rotation = c4d.Vector(*rotation)
        if relative:
            self.obj[c4d.ID_BASEOBJECT_ROTATION] += rotation
        else:
            self.obj[c4d.ID_BASEOBJECT_ROTATION] = rotation

    def set_scale(self, scale=1, relative=False):
        if relative:
            self.obj[c4d.ID_BASEOBJECT_SCALE] *= scale
        else:
            scale_vec = c4d.Vector(scale, scale, scale)
            self.obj[c4d.ID_BASEOBJECT_SCALE] = scale_vec

    # Animation methods
    def move(self, x=0, y=0, z=0, position=None, relative=True):
        if position is None:
            position = c4d.Vector(x, y, z)
        elif type(position) is not c4d.Vector:
            position = c4d.Vector(*position)
        descriptor = c4d.ID_BASEOBJECT_POSITION
        animation = VectorAnimation(
            target=self, descriptor=descriptor, vector=position, relative=relative)
        if relative:
            self.obj[descriptor] += position
        else:
            self.obj[descriptor] = position
        return animation

    def rotate(self, h=0, p=0, b=0, rotation=None):
        if rotation is None:
            rotation = c4d.Vector(h, p, b)
        elif type(rotation) is not c4d.Vector:
            rotation = c4d.Vector(*rotation)
        descriptor = c4d.ID_BASEOBJECT_ROTATION
        animation = VectorAnimation(
            target=self, descriptor=descriptor, vector=rotation, relative=True)
        self.obj[descriptor] += rotation
        return animation

    def scale(self, x=0, y=0, z=0, scale=None):
        if scale is None:
            scale = c4d.Vector(x, y, z)
        elif type(scale) in (tuple, list):
            scale = c4d.Vector(*scale)
        elif type(scale) in (int, float):
            scale = c4d.Vector(scale, scale, scale)
        descriptor = c4d.ID_BASEOBJECT_SCALE
        animation = VectorAnimation(
            target=self, descriptor=descriptor, vector=scale, relative=True, multiplicative=True)
        self.obj[descriptor] += scale
        return animation

    @property
    def animate(self):
        """
        Fluent animation API.

        Returns an AnimatorProxy that provides attribute access for
        animating any parameter by name.

        Usage:
            # Animate a UserData parameter
            self.play(virus.animate.fold(0.5), run_time=1)

            # Animate through a sequence
            self.play(virus.animate.fold.sequence(1, 0.1, 1), run_time=2)

            # Animate position components
            self.play(circle.animate.x(100).y(50), run_time=1)

            # Chain multiple animations
            self.play(virus.animate.fold(0.5).x(100), run_time=1.5)
        """
        from DreamTalk.animation.animate import AnimatorProxy
        return AnimatorProxy(self)


# =============================================================================
# VISIBLE OBJECT - Objects that can be seen
# =============================================================================

class VisibleObject(ProtoObject):
    """
    Base class for objects that can be rendered.

    Provides:
    - Visibility parameter and control
    - Creation parameter for animation
    - Bounding box information
    """

    def __init__(self, visible=True, creation=0, **kwargs):
        super().__init__(**kwargs)
        self.creation = creation
        self.visible = visible
        self._setup_visibility()
        self._setup_creation()
        self._update_bounding_box()

    def _setup_visibility(self):
        """Set up visibility UserData parameter."""
        self.visibility_parameter = UCheckBox(
            name="Visibility", default_value=self.visible)
        self.visibility_u_group = UGroup(
            self.visibility_parameter, target=self.obj, name="Visibility")

        # Set initial visibility
        if not self.visible:
            self.obj[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR] = 1
            self.obj[c4d.ID_BASEOBJECT_VISIBILITY_RENDER] = 1

    def _setup_creation(self):
        """Set up creation parameter for animation."""
        self.creation_parameter = UCompletion(
            name="Creation", default_value=self.creation)
        self.action_parameters = [self.creation_parameter]
        self.actions_u_group = UGroup(
            *self.action_parameters, target=self.obj, name="Actions")

    def _update_bounding_box(self):
        """Calculate and store bounding box information."""
        bounding_box_center, bounding_radius = c4d.utils.GetBBox(
            self.obj, self.obj.GetMg())
        self.width = bounding_radius.x * 2
        self.height = bounding_radius.y * 2
        self.depth = bounding_radius.z * 2
        self.center = bounding_box_center

    def get_center(self):
        """Return the center position in world space."""
        return self.obj.GetMp() * self.obj.GetMg()

    def get_radius(self):
        """Return the bounding radius."""
        __, radius = c4d.utils.GetBBox(self.obj, self.obj.GetMg())
        return radius

    def get_diameter(self):
        """Return the longest diameter."""
        radius = self.get_radius()
        return max(radius.x, radius.y, radius.z) * 2

    def get_clone(self):
        """Clone the object and insert into scene."""
        clone = self.obj.GetClone()
        self.document.InsertObject(clone)
        return clone

    def get_editable(self):
        """Return an editable polygon clone."""
        clone = self.get_clone()
        editable = c4d.utils.SendModelingCommand(
            command=c4d.MCOMMAND_MAKEEDITABLE,
            list=[clone],
            mode=c4d.MODELINGCOMMANDMODE_ALL,
            doc=self.document)[0]
        return editable

    # Animation methods
    def create(self, completion=1):
        """Animate creation from current value to completion."""
        desc_id = self.creation_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_create(self, completion=0):
        """Animate un-creation."""
        desc_id = self.creation_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation


# =============================================================================
# LINE OBJECT - Spline-based stroke rendering
# =============================================================================

class LineObject(VisibleObject):
    """
    Base class for spline objects with geometry-based stroke rendering.

    All strokes are real 3D geometry rendered via Python Generators.
    No Sketch & Toon dependency - MoGraph native.

    Args:
        color: Stroke color (default WHITE)
        stroke_width: Line thickness in scene units (default 3.0)
        draw_completion: Initial draw state 0-1 (default 1.0 = fully drawn)
        opacity: Stroke opacity 0-1 (default 1.0)
        plane: Spline plane "xy", "yz", "xz" (default "xy")
    """

    def __init__(self, color=WHITE, stroke_width=3.0, draw_completion=1.0,
                 opacity=1.0, plane="xy", **kwargs):
        self.color = color
        self.stroke_width = stroke_width
        self.draw_completion = draw_completion
        self.opacity = opacity

        super().__init__(plane=plane, **kwargs)

        # Set up stroke rendering
        self._setup_stroke_generator()
        self._setup_stroke_parameters()
        self._setup_stroke_material()

    def _setup_stroke_generator(self):
        """Wrap the spline in a StrokeGen for geometry-based rendering."""
        # Store the original spline
        self.spline = self.obj

        # Create the stroke generator
        self.stroke_gen = c4d.BaseObject(1023866)  # Python Generator
        self.stroke_gen[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.stroke_gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!
        self.stroke_gen.SetName(self.name)

        # Copy position/rotation from spline to generator
        self.stroke_gen.SetAbsPos(self.spline.GetAbsPos())
        self.stroke_gen.SetAbsRot(self.spline.GetAbsRot())
        self.stroke_gen.SetAbsScale(self.spline.GetAbsScale())

        # Reset spline transforms (now relative to generator)
        self.spline.SetAbsPos(c4d.Vector(0, 0, 0))
        self.spline.SetAbsRot(c4d.Vector(0, 0, 0))
        self.spline.SetAbsScale(c4d.Vector(1, 1, 1))

        # Insert generator and parent spline under it
        self.document.InsertObject(self.stroke_gen)
        self.spline.Remove()
        self.spline.InsertUnder(self.stroke_gen)

        # Swap obj reference - stroke_gen is now "the object"
        self.obj = self.stroke_gen

    def _setup_stroke_parameters(self):
        """Add UserData parameters to stroke generator."""
        # Stroke Width
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_METER
        self.stroke_width_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_width_id] = self.stroke_width

        # Draw (0-1 completion)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.draw_id = self.obj.AddUserData(bc)
        self.obj[self.draw_id] = self.draw_completion

        # Create parameter object for animation compatibility
        self.draw_parameter = UCompletion(name="Draw", default_value=self.draw_completion)
        self.draw_parameter.desc_id = self.draw_id

        # Opacity
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Opacity"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.opacity_id = self.obj.AddUserData(bc)
        self.obj[self.opacity_id] = self.opacity

        self.opacity_parameter = UCompletion(name="Opacity", default_value=self.opacity)
        self.opacity_parameter.desc_id = self.opacity_id

        # Color
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_COLOR)
        bc[c4d.DESC_NAME] = "Color"
        self.color_id = self.obj.AddUserData(bc)
        self.obj[self.color_id] = self.color

        self.color_parameter = UColor(name="Color", default_value=self.color)
        self.color_parameter.desc_id = self.color_id

    def _setup_stroke_material(self):
        """Create and apply luminance material for stroke."""
        self.stroke_material = StrokeMaterial(
            color=self.color,
            opacity=self.opacity,
            name=f"{self.name}_StrokeMat"
        )
        tag = self.obj.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.stroke_material.obj

    def set_plane(self):
        """Override to set plane on spline primitive, not generator."""
        planes = {"xy": 0, "zy": 1, "xz": 2}
        if hasattr(self, 'spline'):
            # Called after stroke setup
            self.spline[c4d.PRIM_PLANE] = planes.get(self.plane, 0)
        else:
            # Called during initial setup - will set on obj which becomes spline
            self.obj[c4d.PRIM_PLANE] = planes.get(self.plane, 0)

    # Animation methods
    def draw(self, completion=1):
        """Animate draw completion."""
        animation = ScalarAnimation(
            target=self, descriptor=self.draw_id, value_fin=completion)
        self.obj[self.draw_id] = completion
        return animation

    def un_draw(self, completion=0):
        """Animate undraw."""
        return self.draw(completion)

    def fade_in(self, completion=1):
        """Animate opacity fade in."""
        animation = ScalarAnimation(
            target=self, descriptor=self.opacity_id, value_fin=completion)
        self.obj[self.opacity_id] = completion
        self.stroke_material.set_opacity(completion)
        return animation

    def fade_out(self, completion=0):
        """Animate opacity fade out."""
        return self.fade_in(completion)

    def change_color(self, color):
        """Animate color change."""
        animation = ColorAnimation(
            target=self, descriptor=self.color_id, vector=color)
        self.obj[self.color_id] = color
        self.stroke_material.set_color(color)
        return animation


# =============================================================================
# SOLID OBJECT - 3D mesh with fill and stroke
# =============================================================================

class SolidObject(VisibleObject):
    """
    Base class for 3D mesh objects with fill and stroke rendering.

    Stroke rendering uses geometry-based silhouette detection.
    Fill uses standard luminance materials.
    No Sketch & Toon dependency - MoGraph native.

    Args:
        color: Base color for both fill and stroke
        fill_color: Override fill color (default: uses color)
        stroke_color: Override stroke color (default: uses color)
        filled: Fill visibility 0-1 (default 0 = transparent)
        stroke_width: Silhouette line thickness (default 3.0)
        draw_completion: Initial stroke draw state (default 1.0)
        fill_opacity: Fill opacity 0-1 (default 1.0)
        stroke_opacity: Stroke opacity 0-1 (default 1.0)
    """

    def __init__(self, color=WHITE, fill_color=None, stroke_color=None,
                 filled=0, stroke_width=3.0, draw_completion=1.0,
                 fill_opacity=1.0, stroke_opacity=1.0, **kwargs):
        self.color = color
        self.fill_color = fill_color if fill_color else color
        self.stroke_color = stroke_color if stroke_color else color
        self.filled = filled
        self.stroke_width = stroke_width
        self.draw_completion = draw_completion
        self.fill_opacity = fill_opacity
        self.stroke_opacity = stroke_opacity

        super().__init__(**kwargs)

        # Set up fill material on the mesh
        self._setup_fill_material()
        self._setup_fill_parameters()

        # Set up stroke rendering via silhouette generator
        self._setup_stroke_generator()
        self._setup_stroke_parameters()
        self._setup_stroke_material()

    def _setup_fill_material(self):
        """Create and apply luminance material for fill."""
        self.fill_material = c4d.Material()
        self.fill_material.SetName(f"{self.name}_FillMat")

        # Disable unused channels
        self.fill_material[c4d.MATERIAL_USE_COLOR] = False
        self.fill_material[c4d.MATERIAL_USE_REFLECTION] = False

        # Enable luminance for self-illuminated look
        self.fill_material[c4d.MATERIAL_USE_LUMINANCE] = True
        self.fill_material[c4d.MATERIAL_LUMINANCE_COLOR] = self.fill_color

        # Enable transparency for fill control
        self.fill_material[c4d.MATERIAL_USE_TRANSPARENCY] = True
        transparency = 1.0 - self.filled  # 0 fill = 1 transparency
        self.fill_material[c4d.MATERIAL_TRANSPARENCY_BRIGHTNESS] = transparency

        self.document.InsertMaterial(self.fill_material)

        # Apply to mesh
        self.fill_tag = self.obj.MakeTag(c4d.Ttexture)
        self.fill_tag[c4d.TEXTURETAG_MATERIAL] = self.fill_material

    def _setup_fill_parameters(self):
        """Add fill UserData parameters."""
        # Fill parameter (controls transparency inversely)
        self.fill_parameter = UCompletion(name="Fill", default_value=self.filled)
        self.fill_u_group = UGroup(self.fill_parameter, target=self.obj, name="Solid")

    def _setup_stroke_generator(self):
        """Wrap the mesh in SilhouetteSplineGen + StrokeGen for stroke rendering."""
        # Store the original mesh
        self.mesh = self.obj

        # Create silhouette spline generator
        self.silhouette_gen = c4d.BaseObject(1023866)  # Python Generator
        self.silhouette_gen[c4d.OPYTHON_CODE] = SILHOUETTE_SPLINE_GEN_CODE
        self.silhouette_gen[c4d.OPYTHON_OPTIMIZE] = False
        self.silhouette_gen.SetName("SilhouetteSpline")

        # Create stroke generator
        self.stroke_gen = c4d.BaseObject(1023866)  # Python Generator
        self.stroke_gen[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.stroke_gen[c4d.OPYTHON_OPTIMIZE] = False
        self.stroke_gen.SetName(f"{self.name}_Stroke")

        # Copy transforms from mesh to stroke_gen
        self.stroke_gen.SetAbsPos(self.mesh.GetAbsPos())
        self.stroke_gen.SetAbsRot(self.mesh.GetAbsRot())
        self.stroke_gen.SetAbsScale(self.mesh.GetAbsScale())

        # Reset mesh transforms (now relative to generators)
        self.mesh.SetAbsPos(c4d.Vector(0, 0, 0))
        self.mesh.SetAbsRot(c4d.Vector(0, 0, 0))
        self.mesh.SetAbsScale(c4d.Vector(1, 1, 1))

        # Build hierarchy: StrokeGen > SilhouetteGen > Mesh
        self.document.InsertObject(self.stroke_gen)
        self.silhouette_gen.InsertUnder(self.stroke_gen)
        self.mesh.Remove()
        self.mesh.InsertUnder(self.silhouette_gen)

        # Keep mesh as self.obj for fill material access, but stroke_gen for positioning
        # We maintain two references:
        # - self.mesh: the actual geometry (for fill material)
        # - self.stroke_gen: the outer container (for positioning, stroke material)
        # - self.obj stays as mesh for backwards compat with set_object_properties etc.

    def _setup_stroke_parameters(self):
        """Add stroke UserData to stroke generator."""
        # Stroke Width
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        self.stroke_width_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.stroke_width_id] = self.stroke_width

        # Draw
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.draw_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.draw_id] = self.draw_completion

        self.draw_parameter = UCompletion(name="Draw", default_value=self.draw_completion)
        self.draw_parameter.desc_id = self.draw_id

    def _setup_stroke_material(self):
        """Create and apply stroke material to stroke generator."""
        self.stroke_material = StrokeMaterial(
            color=self.stroke_color,
            opacity=self.stroke_opacity,
            name=f"{self.name}_StrokeMat"
        )
        tag = self.stroke_gen.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.stroke_material.obj

    # Override position/rotation to affect stroke_gen (outer container)
    def set_position(self, x=0, y=0, z=0, position=None, relative=False):
        if position is None:
            position = c4d.Vector(x, y, z)
        elif type(position) is not c4d.Vector:
            position = c4d.Vector(*position)

        target = self.stroke_gen if hasattr(self, 'stroke_gen') else self.obj
        if relative:
            target[c4d.ID_BASEOBJECT_POSITION] += position
        else:
            target[c4d.ID_BASEOBJECT_POSITION] = position

    def set_rotation(self, h=0, p=0, b=0, rotation=None, relative=False):
        if rotation is None:
            rotation = c4d.Vector(h, p, b)
        elif type(rotation) is not c4d.Vector:
            rotation = c4d.Vector(*rotation)

        target = self.stroke_gen if hasattr(self, 'stroke_gen') else self.obj
        if relative:
            target[c4d.ID_BASEOBJECT_ROTATION] += rotation
        else:
            target[c4d.ID_BASEOBJECT_ROTATION] = rotation

    def set_scale(self, scale=1, relative=False):
        target = self.stroke_gen if hasattr(self, 'stroke_gen') else self.obj
        if relative:
            target[c4d.ID_BASEOBJECT_SCALE] *= scale
        else:
            scale_vec = c4d.Vector(scale, scale, scale)
            target[c4d.ID_BASEOBJECT_SCALE] = scale_vec

    # Animation methods
    def fill(self, completion=1):
        """Animate fill visibility."""
        desc_id = self.fill_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        # Update material transparency
        self.fill_material[c4d.MATERIAL_TRANSPARENCY_BRIGHTNESS] = 1.0 - completion
        return animation

    def un_fill(self, completion=0):
        """Animate fill removal."""
        return self.fill(completion)

    def draw(self, completion=1):
        """Animate stroke draw completion."""
        animation = ScalarAnimation(
            target=self.stroke_gen, descriptor=self.draw_id, value_fin=completion)
        self.stroke_gen[self.draw_id] = completion
        return animation

    def un_draw(self, completion=0):
        """Animate stroke undraw."""
        return self.draw(completion)


# =============================================================================
# CUSTOM OBJECT - Composite holons using Python Generators
# =============================================================================

class CustomObject(VisibleObject):
    """
    Base class for composite objects (holons) using Python Generators.

    All structural relationships are handled by Python Generator code.
    No XPresso - clean, git-friendly, MoGraph-native.

    Subclasses must implement:
    - specify_parts(): Define child objects
    - specify_parameters(): Define UserData parameters (optional)
    - specify_generator_code(): Return Python code string for generator

    The generator code has access to:
    - op: The generator object (read UserData from here)
    - op.GetMg(): World matrix (unique per clone in MoGraph)
    - op.GetDown(): First child object

    Args:
        diameter: Optional diameter override for bounding
        **kwargs: Position, rotation, scale, etc.
    """

    def __init__(self, diameter=None, **kwargs):
        self.diameter = diameter
        super().__init__(**kwargs)

        # Set up parts and parameters
        self.parts = []
        self.specify_parts()
        self.parameters = []
        self.specify_parameters()
        self.insert_parameters()

        # Convert to generator and insert parts
        self._setup_as_generator()
        self.insert_parts()

        # Set up generator code
        self._write_generator_code()

        # Set up state machine if States class is defined
        self._state_machine = collect_states(self)

    def specify_object(self):
        """Create a Python Generator as the container."""
        self.obj = c4d.BaseObject(1023866)  # Python Generator
        self.obj[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!

    @abstractmethod
    def specify_parts(self):
        """
        Define the parts (children) of this holon.

        Store parts as attributes and add to self.parts list:

            def specify_parts(self):
                self.cube = FoldableCube(...)
                self.cable = Cable(...)
                self.parts = [self.cube, self.cable]
        """
        pass

    def specify_parameters(self):
        """
        Define UserData parameters for this holon.

        Override to add custom parameters:

            def specify_parameters(self):
                self.fold_param = UCompletion(name="Fold", default_value=0)
                self.parameters = [self.fold_param]
        """
        pass

    def specify_relationships(self):
        """
        Define parameter relationships using declarative binding syntax.

        This is the PREFERRED way to define relationships. Uses the << operator:

            def specify_relationships(self):
                # Simple identity binding
                self.circle.radius << self.radius_parameter

                # Formula binding with math
                self.circle.x << self.distance * cos(PI/6)
                self.circle.y << self.distance * sin(PI/6)

        The bindings are automatically compiled to generator code.
        Override specify_generator_code() only for complex logic that
        can't be expressed with bindings.
        """
        pass  # Default: no relationships

    def specify_generator_code(self):
        """
        Return Python code string for the generator.

        PREFER using specify_relationships() instead - it's cleaner and
        auto-generates the code. Only override this for complex logic.

        If specify_relationships() defines bindings, this method is ignored.

            def specify_generator_code(self):
                return '''
        def main():
            fold = get_userdata_by_name(op, "Fold")
            child = op.GetDown()
            while child:
                if child.GetName() == "FrontAxis":
                    child.SetRelRot(c4d.Vector(0, fold * PI/2, 0))
                child = child.GetNext()
            return None
        '''

        The generator should return None to make children visible,
        or return a PolygonObject/SplineObject to generate geometry.
        """
        return '''
def main():
    # Default: just show children
    return None
'''

    def insert_parameters(self):
        """Insert parameters as UserData."""
        if self.parameters:
            self.parameters_u_group = UGroup(
                *self.parameters, target=self.obj, name=self.name + "Parameters")

    def insert_parts(self):
        """Insert parts as children of the generator."""
        for part in self.parts:
            if not part.obj.GetUp():
                part.obj.InsertUnder(self.obj)
                part.parent = self

    def _setup_as_generator(self):
        """Configure the generator object."""
        # Generator is already created in specify_object
        # Just ensure settings are correct
        self.obj[c4d.OPYTHON_OPTIMIZE] = False

    def transition_to(self, state):
        """
        Transition to a state (returns animation).

        Used with the States class pattern for agentic holons:

            class MindVirus(Holon):
                class States:
                    idle = State(fold=1)
                    hunting = State(fold=0.5)

            # In a Dream:
            self.play(virus.transition_to(virus.States.hunting))

        Args:
            state: State instance to transition to

        Returns:
            Animation or AnimationGroup for the state transition
        """
        if self._state_machine is None:
            raise ValueError(
                f"{self.__class__.__name__} has no States class defined. "
                "Add a States class with State() instances to use transition_to()."
            )
        return self._state_machine.transition_to(state)

    def _write_generator_code(self):
        """Write the generator code to the Python Generator."""
        code = self._get_full_generator_code()
        self.obj[c4d.OPYTHON_CODE] = code

    def _get_full_generator_code(self):
        """
        Get the full generator code including helpers.

        First tries to collect bindings from specify_relationships().
        If no bindings, falls back to specify_generator_code().
        """
        helper_code = '''import c4d
import math

PI = math.pi

def get_userdata_by_name(obj, param_name):
    """Get UserData value by parameter name."""
    ud = obj.GetUserDataContainer()
    for desc_id, bc in ud:
        if bc[c4d.DESC_NAME] == param_name:
            return obj[desc_id]
    return None

def set_userdata_by_name(obj, param_name, value):
    """Set UserData value by parameter name."""
    ud = obj.GetUserDataContainer()
    for desc_id, bc in ud:
        if bc[c4d.DESC_NAME] == param_name:
            obj[desc_id] = value
            return True
    return False

def find_child_by_name(parent, name):
    """Find a child object by name."""
    child = parent.GetDown()
    while child:
        if child.GetName() == name:
            return child
        child = child.GetNext()
    return None

'''
        # Try to collect bindings from specify_relationships() first
        # This uses the declarative << syntax
        relationship_code = collect_relationships(self, self.specify_relationships)

        if relationship_code:
            # Bindings were defined - use the auto-generated code
            return helper_code + relationship_code
        else:
            # No bindings - fall back to manual specify_generator_code()
            user_code = self.specify_generator_code()
            return helper_code + user_code


# =============================================================================
# ALIASES - Canonical DreamTalk Syntax
# =============================================================================

# Holon is the philosophical name for a composite object
# A holon is a whole that is also a part - sovereignty at every scale
Holon = CustomObject
