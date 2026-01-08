from DreamTalk.objects.abstract_objects import SolidObject
import c4d


class Sphere(SolidObject):

    def __init__(self, radius=100, **kwargs):
        self.radius = radius
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osphere)

    def set_object_properties(self):
        self.obj[c4d.PRIM_SPHERE_RAD] = self.radius
        self.obj[c4d.PRIM_SPHERE_TYPE] = 4  # set type to icosahedron


class Cylinder(SolidObject):

    def __init__(self, radius=50, height=150, orientation="x+", **kwargs):
        self.radius = radius
        self.height = height
        self.orientation = orientation
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ocylinder)

    def set_object_properties(self):
        orientations = {
            "x+": 0,
            "x-": 1,
            "y+": 2,
            "y-": 3,
            "z+": 4,
            "z-": 5
        }
        self.obj[c4d.PRIM_AXIS] = orientations[self.orientation]
        self.obj[c4d.PRIM_CYLINDER_RADIUS] = self.radius
        self.obj[c4d.PRIM_CYLINDER_HEIGHT] = self.height
        self.obj[c4d.PRIM_CYLINDER_SEG] = 32


class Cone(SolidObject):

    def __init__(self, radius=50, height=150, orientation="x+", **kwargs):
        self.radius = radius
        self.height = height
        self.orientation = orientation
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ocone)

    def set_object_properties(self):
        orientations = {
            "x+": 0,
            "x-": 1,
            "y+": 2,
            "y-": 3,
            "z+": 4,
            "z-": 5
        }
        self.obj[c4d.PRIM_AXIS] = orientations[self.orientation]
        self.obj[c4d.PRIM_CONE_BRAD] = self.radius
        self.obj[c4d.PRIM_CONE_HEIGHT] = self.height
        self.obj[c4d.PRIM_CONE_SEG] = 32


class MetaBall(SolidObject):

    def __init__(self, *children, hull_value=1, subdivision=5, **kwargs):
        self.children = children
        self.hull_value = hull_value
        self.subdivision = subdivision
        self.insert_children()
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ometaball)

    def set_object_properties(self):
        self.obj[c4d.METABALLOBJECT_THRESHOLD] = self.hull_value
        self.obj[c4d.METABALLOBJECT_SUBEDITOR] = self.subdivision
        self.obj[c4d.METABALLOBJECT_SUBRAY] = self.subdivision

    def insert_children(self):
        for child in self.children:
            child.obj.InsertUnder(self.obj)


class Plane(SolidObject):

    def __init__(self, width=400, height=400, width_segments=10, height_segments=10, orientation="z+", **kwargs):
        self.width = width
        self.height = height
        self.width_segments = width_segments
        self.height_segments = height_segments
        self.orientation = orientation
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Oplane)

    def set_object_properties(self):
        self.obj[c4d.PRIM_PLANE_WIDTH] = self.width
        self.obj[c4d.PRIM_PLANE_HEIGHT] = self.height
        self.obj[c4d.PRIM_PLANE_SUBW] = self.width_segments
        self.obj[c4d.PRIM_PLANE_SUBH] = self.height_segments
        orientations = {
            "x+": 0,
            "x-": 1,
            "y+": 2,
            "y-": 3,
            "z+": 4,
            "z-": 5
        }
        self.obj[c4d.PRIM_AXIS] = orientations[self.orientation]

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "width": c4d.DescID(c4d.DescLevel(c4d.PRIM_PLANE_WIDTH, c4d.DTYPE_REAL, 0)),
            "height": c4d.DescID(c4d.DescLevel(c4d.PRIM_PLANE_HEIGHT, c4d.DTYPE_REAL, 0))
        }


class Extrude(SolidObject):

    def __init__(self, *children, offset=0, **kwargs):
        self.children = children
        self.offset = offset
        super().__init__(**kwargs)
        self.insert_children()

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Oextrude)

    def set_object_properties(self):
        self.obj[c4d.EXTRUDEOBJECT_EXTRUSIONOFFSET] = self.offset

    def insert_children(self):
        for child in self.children:
            child.obj.InsertUnder(self.obj)

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "offset": c4d.DescID(c4d.DescLevel(c4d.EXTRUDEOBJECT_EXTRUSIONOFFSET, c4d.DTYPE_REAL, 0))
        }


class Loft(SolidObject):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Oloft)


class SweepNurbs(SolidObject):

    def __init__(self, rail=None, profile=None, start_scale=1.0, end_scale=1.0, **kwargs):
        self.rail = rail
        self.profile = profile
        self.start_scale = start_scale
        self.end_scale = end_scale
        super().__init__(**kwargs)
        self.insert_children()

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Osweep)

    def set_object_properties(self):
        # SWEEPOBJECT_STARTGROWTH controls start scale (confusingly named)
        # SWEEPOBJECT_SCALE controls end scale
        self.obj[c4d.SWEEPOBJECT_STARTGROWTH] = self.start_scale
        self.obj[c4d.SWEEPOBJECT_SCALE] = self.end_scale

    def insert_children(self):
        self.rail.obj.InsertUnder(self.obj)
        self.profile.obj.InsertUnder(self.obj)

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "start_growth": c4d.DescID(c4d.DescLevel(c4d.SWEEPOBJECT_STARTGROWTH, c4d.DTYPE_REAL, 0)),
            "end_growth": c4d.DescID(c4d.DescLevel(c4d.SWEEPOBJECT_GROWTH, c4d.DTYPE_REAL, 0)),
            "start_scale": c4d.DescID(c4d.DescLevel(c4d.SWEEPOBJECT_STARTGROWTH, c4d.DTYPE_REAL, 0)),
            "end_scale": c4d.DescID(c4d.DescLevel(c4d.SWEEPOBJECT_SCALE, c4d.DTYPE_REAL, 0))
        }


class Cube(SolidObject):

    def __init__(self, width=100, height=100, depth=100, size=None, **kwargs):
        self.width = width
        self.height = height
        self.depth = depth
        self.size = size
        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ocube)

    def set_object_properties(self):
        if self.size:
            self.width = self.height = self.depth = self.size
        self.obj[c4d.PRIM_CUBE_LEN, c4d.VECTOR_X] = self.width
        self.obj[c4d.PRIM_CUBE_LEN, c4d.VECTOR_Y] = self.height
        self.obj[c4d.PRIM_CUBE_LEN, c4d.VECTOR_Z] = self.depth

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "width": c4d.DescID(c4d.DescLevel(c4d.PRIM_CUBE_LEN, c4d.DTYPE_REAL, 0)),
            "height": c4d.DescID(c4d.DescLevel(c4d.PRIM_CUBE_LEN, c4d.DTYPE_REAL, 1)),
            "depth": c4d.DescID(c4d.DescLevel(c4d.PRIM_CUBE_LEN, c4d.DTYPE_REAL, 2))
        }


class USD(SolidObject):

    def __init__(self, file_path=None, **kwargs):
        self.file_path = file_path
        self.extract_object_from_import()
        self.remove_material_tag()

        super().__init__(**kwargs)

    def specify_object(self):
        self.obj = self.mesh

    def extract_object_from_import(self):
        self.document = c4d.documents.GetActiveDocument()
        c4d.documents.MergeDocument(
            self.document, self.file_path, c4d.SCENEFILTER_NONE)
        # remove superfluous material null
        material_null = self.document.SearchObject("Materials")
        material_null.Remove()
        # get clone of mesh from root null
        root_null = self.document.SearchObject("Root")
        self.mesh = root_null.GetDown().GetClone()
        # remove root null and mesh
        root_null.Remove()

    def remove_material_tag(self):
        # Iterate over all tags of the object
        tag = self.mesh.GetFirstTag()
        while tag:
            next_tag = tag.GetNext()
            # Check if the tag is a material tag
            if tag.GetType() == c4d.Ttexture:
                tag.Remove()
            tag = next_tag



class Boole(SolidObject):

    def __init__(self, *children, mode="union", **kwargs):
        self.children = children
        self.mode = mode
        super().__init__(**kwargs)
        self.insert_children()

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Oboole)

    def set_object_properties(self):
        modes = {
            "union": 0,
            "subtract": 1,
            "intersect": 2,
            "without": 3,
        }
        self.obj[c4d.BOOLEOBJECT_TYPE] = modes[self.mode]

    def insert_children(self):
        for child in self.children:
            child.obj.InsertUnder(self.obj)


class ImagePlane(SolidObject):
    """
    A plane textured with a PNG image, with proper alpha transparency.

    Loads a PNG file, creates a plane with the correct aspect ratio,
    and applies a luminance material with alpha channel support.

    The plane is sized based on a reference dimension (height by default),
    with width automatically calculated from the image's aspect ratio.

    Note: This class bypasses the standard SolidObject sketch/fill materials
    to use its own texture material with alpha channel support.

    Args:
        image_path: Path to the PNG file (must have alpha channel for transparency)
        height: Height of the plane in C4D units (default 100)
        width: Width override - if specified, height is calculated from aspect ratio
        orientation: Plane orientation (default "z+" faces forward)
        **kwargs: Additional arguments passed to SolidObject (x, y, z, h, p, b, etc.)

    Example:
        eye = ImagePlane("/path/to/eye.png", height=50)
        eye = ImagePlane("/path/to/eye.png", width=200)  # Height auto-calculated
    """

    def __init__(self, image_path, height=100, width=None, orientation="z+", **kwargs):
        self.image_path = image_path
        self.requested_height = height
        self.requested_width = width
        self.orientation = orientation

        # Load image and calculate dimensions
        self._load_image_dimensions()
        self._calculate_plane_dimensions()

        super().__init__(**kwargs)

        # Create and apply our texture material (after object is created)
        self._create_texture_material()
        self._apply_texture_material()

    # Override SolidObject's material methods to do nothing
    # We use our own texture material instead of sketch/fill materials
    def set_fill_material(self):
        pass

    def set_fill_tag(self):
        pass

    def set_sketch_material(self):
        pass

    def set_sketch_tag(self):
        pass

    def fill_parameter_setup(self):
        pass

    def sketch_parameter_setup(self):
        pass

    def specify_creation(self):
        # ImagePlane doesn't have animated creation - it's just visible
        pass

    def _load_image_dimensions(self):
        """Load the image to get its pixel dimensions."""
        bmp = c4d.bitmaps.BaseBitmap()
        result = bmp.InitWith(self.image_path)
        if result[0] != c4d.IMAGERESULT_OK:
            raise ValueError(f"Failed to load image: {self.image_path}")

        self.image_width = bmp.GetBw()
        self.image_height = bmp.GetBh()
        self.aspect_ratio = self.image_width / self.image_height

    def _calculate_plane_dimensions(self):
        """Calculate plane dimensions preserving aspect ratio."""
        if self.requested_width is not None:
            # Width specified, calculate height
            self.plane_width = self.requested_width
            self.plane_height = self.requested_width / self.aspect_ratio
        else:
            # Height specified (default), calculate width
            self.plane_height = self.requested_height
            self.plane_width = self.requested_height * self.aspect_ratio

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Oplane)

    def set_object_properties(self):
        self.obj[c4d.PRIM_PLANE_WIDTH] = self.plane_width
        self.obj[c4d.PRIM_PLANE_HEIGHT] = self.plane_height
        self.obj[c4d.PRIM_PLANE_SUBW] = 1  # Minimal subdivisions
        self.obj[c4d.PRIM_PLANE_SUBH] = 1

        orientations = {
            "x+": 0, "x-": 1,
            "y+": 2, "y-": 3,
            "z+": 4, "z-": 5
        }
        self.obj[c4d.PRIM_AXIS] = orientations[self.orientation]

    def _create_texture_material(self):
        """Create a luminance material with alpha channel for the image."""
        self.texture_material = c4d.BaseMaterial(c4d.Mmaterial)
        self.texture_material.SetName(f"ImageMat_{self.obj.GetName()}")

        # Disable unused channels
        self.texture_material[c4d.MATERIAL_USE_REFLECTION] = False
        self.texture_material[c4d.MATERIAL_USE_COLOR] = False

        # Enable luminance (self-illuminated, no lighting needed)
        self.texture_material[c4d.MATERIAL_USE_LUMINANCE] = True

        # Create bitmap shader for luminance
        lum_shader = c4d.BaseShader(c4d.Xbitmap)
        lum_shader[c4d.BITMAPSHADER_FILENAME] = self.image_path
        self.texture_material[c4d.MATERIAL_LUMINANCE_SHADER] = lum_shader
        self.texture_material.InsertShader(lum_shader)

        # Enable alpha channel
        self.texture_material[c4d.MATERIAL_USE_ALPHA] = True

        # Create bitmap shader for alpha (same image, uses embedded alpha)
        alpha_shader = c4d.BaseShader(c4d.Xbitmap)
        alpha_shader[c4d.BITMAPSHADER_FILENAME] = self.image_path
        self.texture_material[c4d.MATERIAL_ALPHA_SHADER] = alpha_shader
        self.texture_material.InsertShader(alpha_shader)

        # Use the PNG's embedded alpha channel
        self.texture_material[c4d.MATERIAL_ALPHA_IMAGEALPHA] = True
        # Disable soft for crisp edges
        self.texture_material[c4d.MATERIAL_ALPHA_SOFT] = False

        # Insert material into document
        self.document.InsertMaterial(self.texture_material)

    def _apply_texture_material(self):
        """Apply the texture material to the plane with flat projection."""
        tag = self.obj.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.texture_material
        tag[c4d.TEXTURETAG_PROJECTION] = 6  # Flat projection

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "width": c4d.DescID(c4d.DescLevel(c4d.PRIM_PLANE_WIDTH, c4d.DTYPE_REAL, 0)),
            "height": c4d.DescID(c4d.DescLevel(c4d.PRIM_PLANE_HEIGHT, c4d.DTYPE_REAL, 0))
        }
