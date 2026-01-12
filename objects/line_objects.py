import DreamTalk
import importlib
importlib.reload(DreamTalk.objects.abstract_objects)
from DreamTalk.objects.abstract_objects import LineObject
from DreamTalk.objects.helper_objects import Null, MoSpline
from DreamTalk.constants import *
from DreamTalk.xpresso.xpressions import XIdentity
from DreamTalk.xpresso.bindings import BoundValue
from DreamTalk.animation.animation import ScalarAnimation
import c4d
import os


def _extract_bound_value(value, default):
    """
    Extract the actual value and binding from a possibly-bound value.

    Uses name-based type checking to handle module reload identity issues
    in Cinema 4D's persistent Python environment.

    Returns:
        (actual_value, binding_or_none)
    """
    # Use name-based check to handle module reload identity issues
    # After reload, isinstance may fail due to different class objects
    if hasattr(value, '__class__') and value.__class__.__name__ == 'BoundValue':
        return value.default, value
    return value, None


class Circle(LineObject):

    def __init__(self, radius=200, ellipse_ratio=1, ring_ratio=1, **kwargs):
        # Extract BoundValues for inline binding support
        self._pending_bindings = []
        radius, binding = _extract_bound_value(radius, 200)
        if binding:
            binding.target_property = 'radius'
            self._pending_bindings.append(('radius', binding))

        self.radius = radius
        self.ellipse_ratio = ellipse_ratio
        self.ring_ratio = ring_ratio
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinecircle)

    def set_object_properties(self):
        # check input values
        if not 0 <= self.ring_ratio <= 1:
            raise ValueError("ring_ratio must be between 0 and 1")
        if not 0 <= self.ellipse_ratio <= 1:
            raise ValueError("ring_ratio must be between 0 and 1")
        # implicit properties
        if self.ring_ratio != 1:
            self.obj[c4d.PRIM_CIRCLE_RING] = True
        inner_radius = self.radius * self.ring_ratio
        if self.ellipse_ratio != 1:
            self.obj[c4d.PRIM_CIRCLE_ELLIPSE] = True
        ellipse_radius = self.radius * self.ellipse_ratio
        # set properties
        self.obj[c4d.PRIM_CIRCLE_RADIUSY] = ellipse_radius
        self.obj[c4d.PRIM_CIRCLE_INNER] = inner_radius
        self.obj[c4d.PRIM_CIRCLE_RADIUS] = self.radius
        # set constants
        self.obj[c4d.SPLINEOBJECT_SUB] = 32

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "radius": c4d.DescID(c4d.DescLevel(c4d.PRIM_CIRCLE_RADIUS, c4d.DTYPE_REAL, 0))
        }


    def change_radius(self, radius=None):
        if radius:
            self.radius = radius
            descriptor = c4d.PRIM_CIRCLE_RADIUS
            animation = ScalarAnimation(
                target=self, descriptor=descriptor, value_fin=radius)
            self.obj[descriptor] = radius
            return animation


class Rectangle(LineObject):

    def __init__(self, width=100, height=100, rounding=False, **kwargs):
        self.width = width
        self.height = height
        self.rounding = rounding
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinerectangle)

    def set_object_properties(self):
        # check input values
        if not 0 <= self.rounding <= 1:
            raise ValueError("rounding must be between 0 and 1")
        self.obj[c4d.PRIM_RECTANGLE_WIDTH] = self.width
        self.obj[c4d.PRIM_RECTANGLE_HEIGHT] = self.height
        if self.rounding:
            self.obj[c4d.PRIM_RECTANGLE_ROUNDING] = True
            rounding_radius = self.rounding * min(self.width, self.height) / 2
            self.obj[c4d.PRIM_RECTANGLE_RADIUS] = rounding_radius

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "width": c4d.DescID(c4d.DescLevel(c4d.PRIM_RECTANGLE_WIDTH, c4d.DTYPE_REAL, 0)),
            "height": c4d.DescID(c4d.DescLevel(c4d.PRIM_RECTANGLE_HEIGHT, c4d.DTYPE_REAL, 0)),
            "rounding_radius": c4d.DescID(c4d.DescLevel(c4d.PRIM_RECTANGLE_RADIUS, c4d.DTYPE_REAL, 0))
        }


class Square(Rectangle):

    def __init__(self, size=100, **kwargs):
        self.size = size
        super().__init__(width=size, height=size, **kwargs)


class Arc(LineObject):

    def __init__(self, radius=150, start_angle=0, end_angle=PI / 2, **kwargs):
        self.radius = radius
        self.start_angle = start_angle
        self.end_angle = end_angle
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinearc)

    def set_object_properties(self):
        self.obj[c4d.PRIM_ARC_RADIUS] = self.radius
        self.obj[c4d.PRIM_ARC_START] = self.start_angle
        self.obj[c4d.PRIM_ARC_END] = self.end_angle

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "radius": c4d.DescID(c4d.DescLevel(c4d.PRIM_ARC_RADIUS, c4d.DTYPE_REAL, 0)),
            "start_angle": c4d.DescID(c4d.DescLevel(c4d.PRIM_ARC_START, c4d.DTYPE_REAL, 0)),
            "end_angle": c4d.DescID(c4d.DescLevel(c4d.PRIM_ARC_END, c4d.DTYPE_REAL, 0))
        }


class Spline(LineObject):
    """creates a basic spline"""

    def __init__(self, points=[], spline_type="bezier", **kwargs):
        self.points = points
        self.spline_type = spline_type
        super().__init__(**kwargs)
        self.add_points_to_spline()

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ospline)

    def add_points_to_spline(self):
        if self.points:
            # convert points to c4d vectors
            c4d_points = [c4d.Vector(
                *point) if type(point) in (list, tuple) else point for point in self.points]
            point_count = len(self.points)
            self.obj.ResizeObject(point_count)
            self.obj.SetAllPoints(c4d_points)

    def set_object_properties(self):
        spline_types = {
            "linear": 0,
            "cubic": 1,
            "akima": 2,
            "b-spline": 3,
            "bezier": 4
        }
        # set interpolation
        self.obj[c4d.SPLINEOBJECT_TYPE] = spline_types[self.spline_type]


class SVG(Spline):  # takes care of importing svgs

    def __init__(self, file_name, x=0, y=0, z=0, assets_path=None, **kwargs):
        """
        Load an SVG file as a spline.

        Args:
            file_name: Name of the SVG file (without .svg extension), or full path
            x, y, z: Position offsets
            assets_path: Optional path to assets directory. If provided, looks for
                        file_name.svg in this directory. If None, uses global SVG_PATH.
                        This enables sovereign symbols to carry their own assets.
            **kwargs: Passed to Spline base class
        """
        self.file_name = file_name
        self.assets_path = assets_path
        self.x = x
        self.y = y
        self.z = z
        self.extract_spline_from_vector_import()
        super().__init__(**kwargs)
        self.fix_axes()

    def extract_spline_from_vector_import(self):
        # Determine file path based on whether assets_path is provided
        if self.assets_path is not None:
            file_path = os.path.join(self.assets_path, self.file_name + ".svg")
        else:
            file_path = os.path.join(SVG_PATH, self.file_name + ".svg")
        vector_import = c4d.BaseObject(1057899)
        self.document = c4d.documents.GetActiveDocument()
        self.document.InsertObject(vector_import)
        vector_import[c4d.ART_FILE] = file_path
        self.document.ExecutePasses(
            bt=None, animation=False, expressions=False, caches=True, flags=c4d.BUILDFLAGS_NONE)
        vector_import.Remove()
        cache = vector_import.GetCache()
        cache = cache.GetDown()
        cache = cache.GetDown()
        cache = cache.GetDownLast()
        self.spline = cache.GetClone()

    def fix_axes(self):
        self.document.SetSelection(self.obj)  # select svg
        c4d.CallCommand(1011982)  # moves svg axes to center
        self.obj[c4d.ID_BASEOBJECT_REL_POSITION] = c4d.Vector(
            0, 0, 0)  # move svg to origin
        # set specified position
        self.set_position(x=self.x, y=self.y, z=self.z)

    def specify_object(self):
        self.obj = self.spline


class EdgeSpline(LineObject):

    def __init__(self, solid_object, mode="outline", **kwargs):
        self.solid_object = solid_object
        self.mode = mode
        super().__init__(**kwargs)
        self.insert_solid_object()
        self.fix_visibility_behaviour()

    def specify_object(self):
        self.obj = c4d.BaseObject(1057180)

    def insert_solid_object(self):
        self.solid_object.obj.InsertUnder(self.obj)

    def set_object_properties(self):
        # set mode
        modes = {
            "standard": 0,
            "curvature": 1,
            "contour": 2,
            "outline": 3,
            "intersection": 4,
        }
        self.obj[c4d.ID_MT_EDGETOSPLINE_MODE_CYCLE] = modes[self.mode]
        self.obj[c4d.ID_MT_EDGETOSPLINE_PHONG_ANGLE] = PI / 9
        # join spline segments within 5cm threshold
        self.obj[c4d.ID_MT_EDGETOSPLINE_EDGESPLINE_JOIN] = True
        self.obj[c4d.ID_MT_EDGETOSPLINE_EDGESPLINE_JOIN_THRESHOLD] = 5

    def fix_visibility_behaviour(self):
        """we link the visibility of the object to the sketch tag spline type fix the visibility behaviour"""
        visibility_relation = XIdentity(
            part=self.sketch_tag, whole=self, desc_ids=[self.sketch_tag.desc_ids["render_splines"]], parameter=self.visibility_parameter, name="VisibilityInheritance")


class PySpline(LineObject):
    """turns a c4d spline into a DreamTalk spline"""

    def __init__(self, input_spline, spline_type="bezier", **kwargs):
        self.input_spline = self.get_spline(input_spline)
        self.spline_type = spline_type
        super().__init__(**kwargs)

    def get_spline(self, input_spline):
        # turns any primitive spline into a single editable spline
        if type(input_spline) is not c4d.SplineObject:
            pass
        return input_spline

    def specify_object(self):
        self.obj = self.input_spline.GetClone()

    def set_object_properties(self):
        spline_types = {
            "linear": 0,
            "cubic": 1,
            "akima": 2,
            "b-spline": 3,
            "bezier": 4
        }
        # set interpolation
        self.obj[c4d.SPLINEOBJECT_TYPE] = spline_types[self.spline_type]


class SplineText(LineObject):
    """creates the native text object of c4d as opposed to the customized version which has additional structure"""

    def __init__(self, text, height=50, anchor="center", seperate_letters=False, draw_order="left_to_right", **kwargs):
        self.text = text
        self.height = height
        self.anchor = anchor
        self.seperate_letters = seperate_letters
        super().__init__(name=text, draw_order=draw_order, **kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinetext)

    def set_object_properties(self):
        anchors = {"left": 0, "middle": 1, "center": 1, "right": 0}
        self.obj[c4d.PRIM_TEXT_TEXT] = self.text
        self.obj[c4d.PRIM_TEXT_HEIGHT] = self.height
        self.obj[c4d.PRIM_TEXT_ALIGN] = anchors[self.anchor]
        self.obj[c4d.PRIM_TEXT_SEPARATE] = self.seperate_letters
        # optionally center object
        if self.anchor == "center":
            center = self.get_center()
            self.move(position=-center)

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "text": c4d.DescID(c4d.DescLevel(c4d.PRIM_TEXT_TEXT, c4d.DTYPE_STRING, 0)),
            "text_height": c4d.DescID(c4d.DescLevel(c4d.PRIM_TEXT_HEIGHT, c4d.DTYPE_REAL, 0))
        }


# =============================================================================
# TEXT - Spline-first text with fill capability
# =============================================================================

# Python Generator code for filling closed splines with polygons
TEXT_FILL_GEN_CODE = '''import c4d

def main():
    """
    Fill closed splines with polygon caps.

    Takes the text spline child and generates polygon geometry that fills
    the letterforms. Works with any closed spline (text, circles, etc.).

    UserData:
    - Fill: 0-1 opacity of fill (controls material transparency)
    - Depth: Extrusion depth (0 = flat cap, >0 = 3D extrusion)
    """
    doc = c4d.documents.GetActiveDocument()

    # Get UserData
    fill_amount = 1.0
    depth = 0.0
    ud = op.GetUserDataContainer()
    for desc_id, bc in ud:
        name = bc[c4d.DESC_NAME]
        if name == "Fill":
            fill_amount = op[desc_id]
        elif name == "Depth":
            depth = op[desc_id]

    # Get child spline
    child = op.GetDown()
    if not child:
        return None

    # Get spline cache
    spline = child.GetCache()
    if spline is None:
        spline = child.GetDeformCache()
    if spline is None:
        # Try CurrentStateToObject for primitives
        child_clone = child.GetClone()
        result = c4d.utils.SendModelingCommand(
            command=c4d.MCOMMAND_CURRENTSTATETOOBJECT,
            list=[child_clone],
            doc=doc
        )
        if result and len(result) > 0:
            spline = result[0]
    if spline is None:
        spline = child

    # Check if it's a spline
    is_line_object = spline.GetType() == 5137
    is_spline_object = spline.IsInstanceOf(c4d.Ospline)

    if not (is_line_object or is_spline_object):
        return None

    # Create extrude object to cap the spline
    extrude = c4d.BaseObject(c4d.Oextrude)

    # Set extrusion depth
    extrude[c4d.EXTRUDEOBJECT_MOVE, c4d.VECTOR_Z] = depth

    # Enable caps
    extrude[c4d.EXTRUDEOBJECT_STARTCAP] = True
    extrude[c4d.EXTRUDEOBJECT_ENDCAP] = True if depth > 0 else False

    # Clone and insert spline under extrude
    spline_clone = spline.GetClone()
    spline_clone.InsertUnder(extrude)

    # Get the polygon result from extrude
    extrude_cache = extrude.GetCache()
    if extrude_cache is None:
        # Build cache manually
        doc.InsertObject(extrude)
        doc.ExecutePasses(None, False, False, True, c4d.BUILDFLAGS_NONE)
        extrude_cache = extrude.GetCache()
        extrude.Remove()

    if extrude_cache is None:
        return None

    # Return the polygon object
    result = extrude_cache.GetClone()
    result.SetName("TextFill")

    return result
'''


class Text(LineObject):
    """
    Text as a spline with optional polygon fill.

    The spline is the source of truth. Fill is generated by capping the spline
    with polygons via a Python Generator. This enables:
    - Draw-on stroke animation (inherited from LineObject)
    - Fill opacity animation
    - Morphing between text and other splines
    - 3D extrusion via depth parameter

    The text spline can be used directly for:
    - Morphing to other shapes (morph_to)
    - Cloning objects along the letterforms
    - Any spline-based operations

    Args:
        text: The text string to display
        height: Character height in scene units (default 50)
        font: Font name (default: system default)
        align: Text alignment - "left", "center", "right" (default "center")
        filled: Fill opacity 0-1 (default 0 = stroke only)
        fill_color: Color for fill (default: same as stroke color)
        depth: Extrusion depth for 3D text (default 0 = flat)
        separate_letters: If True, each letter is a separate segment (default False)
        **kwargs: LineObject arguments (color, stroke_width, etc.)

    Example:
        # Simple stroked text
        title = Text("Hello World", height=100, color=WHITE)

        # Filled text
        title = Text("Hello", height=80, filled=1, fill_color=BLUE)

        # 3D extruded text
        title = Text("3D", height=120, filled=1, depth=20)

        # Animate fill
        self.play(title.fill(1), run_time=1)
    """

    def __init__(self, text, height=50, font=None, align="center",
                 filled=0, fill_color=None, depth=0,
                 separate_letters=False, **kwargs):
        self.text = text
        self.height = height
        self.font = font
        self.align = align
        self.filled = filled
        self.fill_color = fill_color
        self.depth = depth
        self.separate_letters = separate_letters

        # Initialize as LineObject (handles stroke)
        super().__init__(name=text, **kwargs)

        # Set up fill generator if filled or depth
        if self.filled > 0 or self.depth > 0:
            self._setup_fill_generator()

    def specify_object(self):
        """Create the C4D text spline primitive."""
        self.obj = c4d.BaseObject(c4d.Osplinetext)

    def set_object_properties(self):
        """Configure text spline properties."""
        # Set text content
        self.obj[c4d.PRIM_TEXT_TEXT] = self.text
        self.obj[c4d.PRIM_TEXT_HEIGHT] = self.height

        # Set alignment
        alignments = {"left": 0, "center": 1, "middle": 1, "right": 2}
        self.obj[c4d.PRIM_TEXT_ALIGN] = alignments.get(self.align, 1)

        # Set font if specified
        if self.font:
            # C4D uses a BaseContainer for font settings
            # Font name is set via PRIM_TEXT_FONT
            bc = c4d.BaseContainer()
            bc[c4d.FONT_NAME] = self.font
            self.obj[c4d.PRIM_TEXT_FONT] = bc

        # Separate letters option
        self.obj[c4d.PRIM_TEXT_SEPARATE] = self.separate_letters

    def set_unique_desc_ids(self):
        """Define DescIDs for animatable parameters."""
        self.desc_ids = {
            "text": c4d.DescID(c4d.DescLevel(c4d.PRIM_TEXT_TEXT, c4d.DTYPE_STRING, 0)),
            "height": c4d.DescID(c4d.DescLevel(c4d.PRIM_TEXT_HEIGHT, c4d.DTYPE_REAL, 0))
        }

    def _setup_fill_generator(self):
        """
        Wrap the text spline in a Python Generator for fill geometry.

        The generator creates polygon caps for the closed spline segments,
        giving the text a filled appearance. Fill opacity is controlled
        via material transparency.
        """
        # Store original spline reference
        self.spline = self.obj

        # Create fill generator
        self.fill_gen = c4d.BaseObject(1023866)  # Python Generator
        self.fill_gen[c4d.OPYTHON_CODE] = TEXT_FILL_GEN_CODE
        self.fill_gen[c4d.OPYTHON_OPTIMIZE] = False
        self.fill_gen.SetName(f"{self.name}_Fill")

        # Add Fill UserData (0-1)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Fill"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.fill_id = self.fill_gen.AddUserData(bc)
        self.fill_gen[self.fill_id] = self.filled

        # Add Depth UserData
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Depth"
        bc[c4d.DESC_DEFAULT] = 0.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_STEP] = 1.0
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_METER
        self.depth_id = self.fill_gen.AddUserData(bc)
        self.fill_gen[self.depth_id] = self.depth

        # Copy position from spline to generator
        self.fill_gen.SetAbsPos(self.spline.GetAbsPos())
        self.fill_gen.SetAbsRot(self.spline.GetAbsRot())
        self.fill_gen.SetAbsScale(self.spline.GetAbsScale())

        # Reset spline transforms (now relative to generator)
        self.spline.SetAbsPos(c4d.Vector(0, 0, 0))
        self.spline.SetAbsRot(c4d.Vector(0, 0, 0))
        self.spline.SetAbsScale(c4d.Vector(1, 1, 1))

        # Insert generator and parent spline under it
        self.document.InsertObject(self.fill_gen)
        self.spline.Remove()
        self.spline.InsertUnder(self.fill_gen)

        # Create fill material
        self._setup_fill_material()

        # Note: self.obj still points to spline for LineObject compatibility
        # The fill_gen is a sibling that generates fill geometry

    def _setup_fill_material(self):
        """Create and apply luminance material for fill."""
        fill_color = self.fill_color if self.fill_color else self.color

        self.fill_material = c4d.Material()
        self.fill_material.SetName(f"{self.name}_FillMat")

        # Disable unused channels
        self.fill_material[c4d.MATERIAL_USE_COLOR] = False
        self.fill_material[c4d.MATERIAL_USE_REFLECTION] = False

        # Enable luminance for self-illuminated look
        self.fill_material[c4d.MATERIAL_USE_LUMINANCE] = True
        self.fill_material[c4d.MATERIAL_LUMINANCE_COLOR] = fill_color

        # Enable transparency for fill control
        if self.filled < 1.0:
            self.fill_material[c4d.MATERIAL_USE_TRANSPARENCY] = True
            transparency = 1.0 - self.filled
            self.fill_material[c4d.MATERIAL_TRANSPARENCY_BRIGHTNESS] = transparency
            self.fill_material[c4d.MATERIAL_TRANSPARENCY_REFRACTION] = 1.0

        self.document.InsertMaterial(self.fill_material)

        # Apply to fill generator
        tag = self.fill_gen.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.fill_material

    # =========================================================================
    # FILL ANIMATION
    # =========================================================================

    def fill(self, completion=1):
        """
        Animate fill opacity.

        Args:
            completion: Target fill opacity 0-1

        Returns:
            Animation for the fill parameter
        """
        if not hasattr(self, 'fill_gen'):
            # Set up fill generator if not already done
            self._setup_fill_generator()

        from DreamTalk.animation.animation import ScalarAnimation

        animation = ScalarAnimation(
            target=self.fill_gen, descriptor=self.fill_id, value_fin=completion)
        self.fill_gen[self.fill_id] = completion

        # Update material transparency
        self.fill_material[c4d.MATERIAL_USE_TRANSPARENCY] = completion < 1.0
        self.fill_material[c4d.MATERIAL_TRANSPARENCY_BRIGHTNESS] = 1.0 - completion

        return animation

    def un_fill(self, completion=0):
        """Animate fill removal."""
        return self.fill(completion)

    def set_depth(self, depth):
        """Set the extrusion depth."""
        if hasattr(self, 'fill_gen'):
            self.fill_gen[self.depth_id] = depth
        self.depth = depth


class SplineMask(LineObject):
    """creates a spline mask"""

    def __init__(self, *input_splines, mode="union", axis="xz", **kwargs):
        self.input_splines = input_splines
        self.mode = mode
        self.axis = axis
        super().__init__(**kwargs)
        self.insert_input_splines()

    def specify_object(self):
        self.obj = c4d.BaseObject(1019396)

    def set_object_properties(self):
        modes = {
            "union": 0,
            "a-b": 1,
            "b-a": 2,
            "and": 3,
            "or": 4,
            "intersection": 5
        }
        self.obj[c4d.MGSPLINEMASKOBJECT_MODE] = modes[self.mode]
        axes = {
            "xy": 0,
            "zy": 1,
            "xz": 2,
            "viewpoer": 3,
        }
        self.obj[c4d.MGSPLINEMASKOBJECT_AXIS] = axes[self.axis]

    def insert_input_splines(self):
        for spline in self.input_splines:
            spline.obj.InsertUnder(self.obj)

    def specify_relations(self):
        for input_spline in self.input_splines:
            if hasattr(input_spline, "visibility_parameter"):
                visibility_relation = XIdentity(
                    part=input_spline, whole=self, desc_ids=[input_spline.visibility_parameter.desc_id], parameter=self.visibility_parameter, name="VisibilityInheritance")


class VisibleMoSpline(LineObject):
    """creates a visible MoSpline"""

    def __init__(self, mode="spline", generation_mode="even", point_count=100, source_spline=None, destination_spline=None, effectors=[], **kwargs):
        self.mode = mode
        self.generation_mode = generation_mode
        self.point_count = point_count
        self.source_spline = source_spline
        self.effectors = effectors
        self.destination_spline = destination_spline
        super().__init__(**kwargs)
        self.add_effectors()

    def specify_object(self):
        self.obj = c4d.BaseObject(440000054)

    def set_object_properties(self):
        # implicit properties
        modes = {"simple": 0, "spline": 1, "turtle": 2}
        generation_modes = {"vertex": 0, "count": 1, "even": 2, "step": 3}
        # set properties
        self.obj[c4d.MGMOSPLINEOBJECT_MODE] = modes[self.mode]
        self.obj[c4d.MGMOSPLINEOBJECT_SPLINE_MODE] = generation_modes[self.generation_mode]
        self.obj[c4d.MGMOSPLINEOBJECT_SPLINE_COUNT] = self.point_count
        # display as regular spline
        self.obj[c4d.MGMOSPLINEOBJECT_DISPLAYMODE] = 0
        if self.source_spline:
            self.obj[c4d.MGMOSPLINEOBJECT_SOURCE_SPLINE] = self.source_spline.obj
        if self.destination_spline:
            self.obj[c4d.MGMOSPLINEOBJECT_DEST_SPLINE] = self.destination_spline.obj

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "point_count": c4d.DescID(c4d.DescLevel(c4d.MGMOSPLINEOBJECT_SPLINE_COUNT, c4d.DTYPE_LONG, 0))
        }

    def add_effectors(self):
        self.effector_list = c4d.InExcludeData()
        for effector in self.effectors:
            self.effector_list.InsertObject(effector.obj, 1)
        self.obj[c4d.ID_MG_MOTIONGENERATOR_EFFECTORLIST] = self.effector_list

    def add_effector(self, effector):
        self.effector_list.InsertObject(effector.obj, 1)
        self.obj[c4d.MGMOSPLINEOBJECT_EFFECTORLIST] = self.effector_list


class SplineSymmetry(LineObject):
    """the symmetry object used to mirror spline geometry"""

    def __init__(self, *input_splines, axis="x", **kwargs):
        self.input_splines = input_splines
        self.axis = axis
        super().__init__(**kwargs)
        self.insert_input_splines()

    def specify_object(self):
        self.obj = c4d.BaseObject(5142)

    def set_object_properties(self):
        axes = {"x": 1, "y": 2, "z": 0}
        self.obj[c4d.SYMMETRYOBJECT_PLANE] = axes[self.axis]

    def insert_input_splines(self):
        for spline in self.input_splines:
            spline.obj.InsertUnder(self.obj)


class Helix(LineObject):
    """the helix object"""

    def __init__(self, start_radius=200, start_angle=0, end_radius=200, end_angle=2 * PI, radial_bias=1 / 2, height=200, height_bias=1 / 2, subdivision=100, **kwargs):
        self.start_radius = start_radius
        self.start_angle = start_angle
        self.end_radius = end_radius
        self.end_angle = end_angle
        self.radial_bias = radial_bias
        self.height = height
        self.height_bias = height_bias
        self.subdivision = subdivision
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinehelix)

    def set_object_properties(self):
        self.obj[c4d.PRIM_HELIX_RADIUS1] = self.start_radius
        self.obj[c4d.PRIM_HELIX_RADIUS2] = self.end_radius
        self.obj[c4d.PRIM_HELIX_START] = self.start_angle
        self.obj[c4d.PRIM_HELIX_END] = self.end_angle
        self.obj[c4d.PRIM_HELIX_RADIALBIAS] = self.radial_bias
        self.obj[c4d.PRIM_HELIX_HEIGHT] = self.height
        self.obj[c4d.PRIM_HELIX_HEIGHTBIAS] = self.height_bias
        self.obj[c4d.PRIM_HELIX_SUB] = self.subdivision


class NSide(LineObject):
    def __init__(self, radius=100, point_count=3, **kwargs):
        self.radius = radius
        self.point_count = point_count
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osplinenside)

    def set_object_properties(self):
        self.obj[c4d.PRIM_NSIDE_RADIUS] = self.radius
        self.obj[c4d.PRIM_NSIDE_SIDES] = self.point_count
        # Additional properties like angle can be set here if necessary.

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "radius": c4d.DescID(c4d.DescLevel(c4d.PRIM_NSIDE_RADIUS, c4d.DTYPE_REAL, 0)),
            "point_count": c4d.DescID(c4d.DescLevel(c4d.PRIM_NSIDE_SIDES, c4d.DTYPE_LONG, 0)),
            # Add DescIDs for additional properties here
        }


class Triangle(NSide):
    def __init__(self, radius=100, **kwargs):
        super().__init__(radius=radius, point_count=3, **kwargs)

    def set_object_properties(self):
        super().set_object_properties()
        # Rotate by -90 degrees to make the triangle point upwards.
        self.obj[ROT_B] = -c4d.utils.Rad(90)

    def set_unique_desc_ids(self):
        super().set_unique_desc_ids()
        # Add DescID for the orientation and rotation if necessary for animation purposes.
