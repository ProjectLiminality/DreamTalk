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
        raw: If True, create raw C4D primitive without stroke generator wrapper.
             Used when primitive is a child of a Holon (Holon handles strokes).
             Default False for standalone primitives.
    """

    def __init__(self, color=WHITE, stroke_width=3.0, draw_completion=1.0,
                 opacity=1.0, plane="xy", raw=True, **kwargs):
        self.color = color
        self.stroke_width = stroke_width
        self.draw_completion = draw_completion
        self.opacity = opacity
        self.raw = raw

        super().__init__(plane=plane, **kwargs)

        # Store reference to spline for consistency
        self.spline = self.obj

        if self.raw:
            # Raw mode: just the C4D primitive with color/width metadata
            # Parent Holon or Scene will handle stroke generation
            self._store_color_metadata()
        else:
            # Wrapped mode: own stroke generator (for backwards compatibility)
            self._setup_stroke_generator()
            self._setup_stroke_parameters()
            self._setup_stroke_material()

    def _store_color_metadata(self):
        """Store color info on the raw primitive for parent Holon to read."""
        # Use a BaseContainer on the object to store metadata
        # ID 1000000 is safe for custom data
        bc = self.obj.GetDataInstance()
        # Store color components (C4D doesn't have a direct color container field)
        # We'll use the object's name or a custom tag approach
        # For now, store as UserData on the raw primitive
        color_bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_COLOR)
        color_bc[c4d.DESC_NAME] = "StrokeColor"
        color_id = self.obj.AddUserData(color_bc)
        self.obj[color_id] = self.color

        # Also store stroke width
        width_bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        width_bc[c4d.DESC_NAME] = "StrokeWidth"
        width_id = self.obj.AddUserData(width_bc)
        self.obj[width_id] = self.stroke_width

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
        raw: If True, create raw C4D mesh without stroke generator wrapper.
             Used when the SolidObject is a child of a Holon.
             Default True for raw primitive mode.
    """

    def __init__(self, color=WHITE, fill_color=None, stroke_color=None,
                 filled=0, stroke_width=3.0, draw_completion=1.0,
                 fill_opacity=1.0, stroke_opacity=1.0, raw=True, **kwargs):
        self.color = color
        self.fill_color = fill_color if fill_color else color
        self.stroke_color = stroke_color if stroke_color else color
        self.filled = filled
        self.stroke_width = stroke_width
        self.draw_completion = draw_completion
        self.fill_opacity = fill_opacity
        self.stroke_opacity = stroke_opacity
        self.raw = raw

        super().__init__(**kwargs)

        # Set up fill material on the mesh
        self._setup_fill_material()
        self._setup_fill_parameters()

        if self.raw:
            # Raw mode: just the mesh with fill material + stroke metadata
            # Parent Holon will handle silhouette stroke generation
            self._store_stroke_metadata()
            self.mesh = self.obj  # For consistency with wrapped mode
        else:
            # Wrapped mode: own silhouette + stroke generators
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
        # Platonic opacity: refraction=1.0 means no light bending (pure abstract transparency)
        self.fill_material[c4d.MATERIAL_TRANSPARENCY_REFRACTION] = 1.0

        self.document.InsertMaterial(self.fill_material)

        # Apply to mesh
        self.fill_tag = self.obj.MakeTag(c4d.Ttexture)
        self.fill_tag[c4d.TEXTURETAG_MATERIAL] = self.fill_material

    def _setup_fill_parameters(self):
        """Add fill UserData parameters."""
        # Fill parameter (controls transparency inversely)
        self.fill_parameter = UCompletion(name="Fill", default_value=self.filled)
        self.fill_u_group = UGroup(self.fill_parameter, target=self.obj, name="Solid")

    def _store_stroke_metadata(self):
        """Store stroke info on the raw mesh for parent Holon to read."""
        # Store stroke color
        color_bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_COLOR)
        color_bc[c4d.DESC_NAME] = "StrokeColor"
        color_id = self.obj.AddUserData(color_bc)
        self.obj[color_id] = self.stroke_color

        # Store stroke width
        width_bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        width_bc[c4d.DESC_NAME] = "StrokeWidth"
        width_id = self.obj.AddUserData(width_bc)
        self.obj[width_id] = self.stroke_width

        # Mark this as a solid object (needs silhouette detection, not just spline strokes)
        solid_bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_BOOL)
        solid_bc[c4d.DESC_NAME] = "IsSolidObject"
        solid_id = self.obj.AddUserData(solid_bc)
        self.obj[solid_id] = True

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

    def __init__(self, diameter=None, generator_mode=True, **kwargs):
        self.diameter = diameter
        # generator_mode is kept for backward compatibility with older DreamNodes
        # Default is True since all CustomObjects now use Python Generators
        self.generator_mode = generator_mode
        super().__init__(**kwargs)

        # Set up parameters FIRST so they're available in specify_parts()
        # This enables inline binding syntax: Circle(radius=self.size_parameter >> 100)
        self.parameters = []
        self.specify_parameters()
        # Collect type-hinted parameters from class annotations
        self._collect_annotated_parameters()
        self.insert_parameters()

        # Now set up parts (parameters are available for inline bindings)
        self.parts = []
        self.specify_parts()

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
    # Default Holon generator: generate strokes for all raw primitive children
    cam = get_camera()
    if cam is None:
        return None

    cam_world = cam.GetMg().off
    gen_mg = op.GetMg()

    stroke_points, stroke_polys = generate_strokes_for_children(op, cam_world, gen_mg)

    if stroke_polys:
        return build_stroke_geometry(stroke_points, stroke_polys, op.GetName() + "_Strokes")

    return None
'''

    def _collect_annotated_parameters(self):
        """
        Introspect class annotations to auto-create UserData parameters.

        This enables the canonical type-hinted parameter syntax:

            class MindVirus(Holon):
                fold: Bipolar = 0
                color: Color = BLUE
                size: Length = 100

        These annotations are automatically translated to C4D UserData
        with appropriate type, range, and unit settings.

        Parameters defined here are merged with those from specify_parameters().
        Type-hinted parameters should NOT be duplicated in specify_parameters().
        """
        # Runtime reload of types to ensure fresh code in C4D's persistent Python
        import DreamTalk.xpresso.types as types_module
        try:
            from importlib import reload
        except ImportError:
            from imp import reload
        reload(types_module)

        from DreamTalk.xpresso.types import (
            get_default_value, create_userdata_from_type, PARAMETER_TYPE_NAMES
        )

        # Get annotations from the class (not instance)
        annotations = getattr(self.__class__, '__annotations__', {})

        for name, type_hint in annotations.items():
            # Determine the actual type class
            type_class = None

            # Use name-based check to handle module reload identity issues
            # After reload, issubclass may fail due to different class objects
            if isinstance(type_hint, type):
                type_name = type_hint.__name__
                if type_name in PARAMETER_TYPE_NAMES:
                    type_class = type_hint
            elif hasattr(type_hint, '__class__'):
                # Instance of parameter type (unusual but supported)
                type_name = type_hint.__class__.__name__
                if type_name in PARAMETER_TYPE_NAMES:
                    type_class = type_hint.__class__

            if type_class is None:
                # Not a parameter type annotation - skip
                continue

            # Get default value from class attribute
            class_default = getattr(self.__class__, name, None)
            default_value = get_default_value(type_hint, class_default)

            # Create the UserData parameter
            try:
                param = create_userdata_from_type(name, type_class, default_value)
            except ValueError:
                # Unknown type - skip (could be a non-parameter annotation)
                continue

            # Add to parameters list
            self.parameters.append(param)

            # Set as instance attribute with _parameter suffix for binding access
            # e.g., self.fold_parameter = param
            setattr(self, f"{name}_parameter", param)

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
        # Set up stroke material for raw primitive children
        self._setup_stroke_material_for_children()

    def _setup_stroke_material_for_children(self):
        """
        Create and apply a stroke material to the Holon based on children's colors.

        Finds the first raw primitive child (has StrokeColor UserData) and creates
        a luminance material matching that color. The material is applied to the
        Holon's generator so it gets inherited by the generated stroke geometry.
        """
        # Find first raw primitive child with StrokeColor
        stroke_color = None
        for part in self.parts:
            if hasattr(part, 'raw') and part.raw:
                # This is a raw LineObject - get its color
                stroke_color = getattr(part, 'color', None)
                if stroke_color is not None:
                    break

        if stroke_color is None:
            return  # No raw primitives with color

        # Create luminance material
        mat = c4d.Material()
        mat.SetName(f"{self.name}_StrokeMat")

        # Disable all channels except luminance
        mat[c4d.MATERIAL_USE_COLOR] = False
        mat[c4d.MATERIAL_USE_LUMINANCE] = True
        mat[c4d.MATERIAL_USE_REFLECTION] = False
        mat[c4d.MATERIAL_USE_SPECULAR] = False

        # Set luminance to stroke color
        mat[c4d.MATERIAL_LUMINANCE_COLOR] = stroke_color

        # Insert material into document
        self.document.InsertMaterial(mat)

        # Apply material to the Holon's generator
        tag = self.obj.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = mat

        # Store reference
        self.stroke_material = mat

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

def generate_strokes_for_children(op, cam_world, gen_mg):
    """
    Generate stroke geometry for all raw primitive children.

    Handles both:
    - LineObjects (splines): camera-facing stroke quads along spline
    - SolidObjects (meshes): silhouette edge detection + stroke quads

    Returns combined stroke points and polys.
    """
    gen_mg_inv = ~gen_mg
    all_stroke_points = []
    all_stroke_polys = []

    def add_stroke_quad(p1_world, p2_world, stroke_width):
        """Add a camera-facing stroke quad between two world points."""
        mid = (p1_world + p2_world) * 0.5
        to_cam = (cam_world - mid).GetNormalized()
        tangent = (p2_world - p1_world).GetNormalized()
        perp = tangent.Cross(to_cam).GetNormalized() * stroke_width

        q0 = gen_mg_inv * (p1_world - perp)
        q1 = gen_mg_inv * (p1_world + perp)
        q2 = gen_mg_inv * (p2_world + perp)
        q3 = gen_mg_inv * (p2_world - perp)

        base_idx = len(all_stroke_points)
        all_stroke_points.extend([q0, q1, q2, q3])
        all_stroke_polys.append(c4d.CPolygon(base_idx, base_idx+1, base_idx+2, base_idx+3))

    def process_spline_child(child, stroke_width):
        """Generate strokes from a spline/LineObject child."""
        # Hide source spline in editor - stroke geometry replaces it visually
        child[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR] = 1

        spline = child.GetCache()
        if spline is None:
            spline = child.GetDeformCache()
        if spline is None:
            spline = child

        # Check if it's a spline-like object
        is_line_object = spline.GetType() == 5137
        is_spline_object = spline.IsInstanceOf(c4d.Ospline)

        if not (is_line_object or is_spline_object):
            return

        child_mg = child.GetMg()
        points = spline.GetAllPoints()

        if len(points) < 2:
            return

        # Transform points to world space
        world_points = [child_mg * p for p in points]

        # Determine if closed
        child_type = child.GetType()
        is_closed = child_type in [5181, 5176, 5180, 5178, 5186, 5175]

        # Generate stroke quads
        num_pts = len(world_points)
        num_edges = num_pts if is_closed else num_pts - 1

        for i in range(num_edges):
            add_stroke_quad(world_points[i], world_points[(i + 1) % num_pts], stroke_width)

    def process_solid_child(child, stroke_width):
        """Generate silhouette strokes from a SolidObject/mesh child."""
        # Get mesh - handle cache and generators
        mesh = child.GetCache()
        if mesh is None:
            mesh = child.GetDeformCache()
        if mesh is None:
            mesh = child

        # For SweepNurbs and other generators, recurse into cache
        if mesh.GetType() == 5118:  # Osweep
            mesh = mesh.GetCache()
            if mesh is None:
                return

        if not mesh.IsInstanceOf(c4d.Opolygon):
            return

        points = mesh.GetAllPoints()
        polys = mesh.GetAllPolygons()

        if len(polys) == 0:
            return

        child_mg = child.GetMg()

        # Transform points to world space
        world_points = [child_mg * p for p in points]

        # Classify faces as front/back facing
        face_facing = []
        for poly in polys:
            p0 = world_points[poly.a]
            p1 = world_points[poly.b]
            p2 = world_points[poly.c]

            if poly.c == poly.d:
                center = (p0 + p1 + p2) / 3.0
            else:
                p3 = world_points[poly.d]
                center = (p0 + p1 + p2 + p3) / 4.0

            edge1 = p1 - p0
            edge2 = p2 - p0
            normal = edge1.Cross(edge2).GetNormalized()
            view_dir = (cam_world - center).GetNormalized()

            face_facing.append(normal.Dot(view_dir) > 0)

        # Build edge-to-face mapping
        edge_faces = {}
        for fi, poly in enumerate(polys):
            verts = [poly.a, poly.b, poly.c]
            if poly.c != poly.d:
                verts.append(poly.d)

            for i in range(len(verts)):
                v1 = verts[i]
                v2 = verts[(i + 1) % len(verts)]
                edge_key = (min(v1, v2), max(v1, v2))

                if edge_key not in edge_faces:
                    edge_faces[edge_key] = []
                edge_faces[edge_key].append(fi)

        # Find silhouette edges and generate strokes
        for edge_key, faces in edge_faces.items():
            is_silhouette = False
            if len(faces) == 2:
                is_silhouette = face_facing[faces[0]] != face_facing[faces[1]]
            elif len(faces) == 1:
                is_silhouette = face_facing[faces[0]]

            if is_silhouette:
                add_stroke_quad(world_points[edge_key[0]], world_points[edge_key[1]], stroke_width)

    def process_child(child):
        """Process a single child for stroke generation."""
        # Check if this child has stroke metadata (raw primitive)
        stroke_color = get_userdata_by_name(child, "StrokeColor")
        stroke_width = get_userdata_by_name(child, "StrokeWidth")

        if stroke_color is None:
            # Not a raw primitive - might be a sub-Holon, skip stroke gen
            return

        if stroke_width is None:
            stroke_width = 1.0

        # Check if it's a SolidObject (mesh) or LineObject (spline)
        is_solid = get_userdata_by_name(child, "IsSolidObject")

        if is_solid:
            process_solid_child(child, stroke_width)
        else:
            process_spline_child(child, stroke_width)

    # Process all children
    child = op.GetDown()
    while child:
        process_child(child)
        child = child.GetNext()

    return all_stroke_points, all_stroke_polys

def build_stroke_geometry(stroke_points, stroke_polys, name="Strokes"):
    """Build a PolygonObject from stroke points and polys."""
    if not stroke_polys:
        return None

    result = c4d.PolygonObject(len(stroke_points), len(stroke_polys))
    result.SetAllPoints(stroke_points)
    for i, poly in enumerate(stroke_polys):
        result.SetPolygon(i, poly)

    result.Message(c4d.MSG_UPDATE)
    result.SetName(name)
    return result

def get_camera():
    """Get the active camera from the document."""
    doc = c4d.documents.GetActiveDocument()
    bd = doc.GetActiveBaseDraw()
    cam = bd.GetSceneCamera(doc) if bd else None
    if not cam:
        obj = doc.GetFirstObject()
        while obj:
            if obj.GetType() == c4d.Ocamera:
                cam = obj
                break
            obj = obj.GetNext()
    return cam

'''
        # Stroke generation code to append to main()
        # This generates strokes for raw primitive children
        stroke_code = '''
    # Generate strokes for raw primitive children
    cam = get_camera()
    if cam:
        cam_world = cam.GetMg().off
        gen_mg = op.GetMg()
        stroke_points, stroke_polys = generate_strokes_for_children(op, cam_world, gen_mg)
        if stroke_polys:
            return build_stroke_geometry(stroke_points, stroke_polys, op.GetName() + "_Strokes")
    return None
'''

        # Try to collect bindings from specify_relationships() first
        # This uses the declarative << syntax
        relationship_code = collect_relationships(self, self.specify_relationships)

        # Also check for inline bindings from parts (>> syntax)
        from DreamTalk.xpresso.bindings import collect_inline_bindings
        inline_code = collect_inline_bindings(self, self.parts)

        # Helper to inject stroke generation into main()
        def inject_stroke_generation(code):
            """Replace 'return None' at end of main() with stroke generation."""
            # Find the last 'return None' and replace with stroke code
            if '    return None\n' in code:
                # Replace the trailing return None with stroke code
                return code.replace('    return None\n', stroke_code, 1)
            return code

        # Combine relationship code and inline code if both exist
        if relationship_code and inline_code:
            # Merge the two - inline bindings add to relationship bindings
            # Both produce main() functions, so we need to combine them
            # For now, prefer relationship code if it exists
            return helper_code + inject_stroke_generation(relationship_code)
        elif relationship_code:
            # Only relationship bindings
            return helper_code + inject_stroke_generation(relationship_code)
        elif inline_code:
            # Only inline bindings
            return helper_code + inject_stroke_generation(inline_code)
        else:
            # No bindings - fall back to manual specify_generator_code()
            # DON'T inject stroke generation here - the user code is responsible
            # for its own stroke handling (the default already has it, and custom
            # overrides like FoldableCube handle strokes themselves)
            user_code = self.specify_generator_code()
            return helper_code + user_code


# =============================================================================
# ALIASES - Canonical DreamTalk Syntax
# =============================================================================

# Holon is the philosophical name for a composite object
# A holon is a whole that is also a part - sovereignty at every scale
Holon = CustomObject
