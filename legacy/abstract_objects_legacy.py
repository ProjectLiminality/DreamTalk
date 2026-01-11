import importlib
import DreamTalk.materials
importlib.reload(DreamTalk.materials)
from DreamTalk.materials import FillMaterial, SketchMaterial
from DreamTalk.tags import FillTag, SketchTag, XPressoTag, AlignToSplineTag
from DreamTalk.objects.stroke_objects import StrokeGen, StrokeMaterial, SilhouetteSplineGen, MeshStroke
from DreamTalk.constants import WHITE, SCALE_X, SCALE_Y, SCALE_Z
from DreamTalk.animation.animation import VectorAnimation, ScalarAnimation, ColorAnimation
from DreamTalk.xpresso.userdata import *
from DreamTalk.xpresso.xpressions import XRelation, XIdentity, XSplineLength, XBoundingBox, XAction, Movement
# Lazy imports to avoid circular dependencies - these modules import from this file
# Import them inside methods that need them instead of at module level
# import DreamTalk.objects.effect_objects as effect_objects
# import DreamTalk.objects.helper_objects as helper_objects
# import DreamTalk.objects.custom_objects as custom_objects
from abc import ABC, abstractmethod
import c4d.utils
import c4d


def _get_effect_objects():
    """Lazy import to avoid circular dependency"""
    import DreamTalk.objects.effect_objects as effect_objects
    return effect_objects


def _get_helper_objects():
    """Lazy import to avoid circular dependency"""
    import DreamTalk.objects.helper_objects as helper_objects
    return helper_objects


def _get_custom_objects():
    """Lazy import to avoid circular dependency"""
    import DreamTalk.objects.custom_objects as custom_objects
    return custom_objects


class ProtoObject(ABC):

    def __init__(self, name=None, x=0, y=0, z=0, h=0, p=0, b=0, scale=1, position=None, rotation=None, plane="xy"):
        self.document = c4d.documents.GetActiveDocument()  # get document
        self.specify_object()
        self.set_xpresso_tags()
        self.set_unique_desc_ids()
        self.insert_to_document()
        self.set_name(name=name)
        self.set_position(x=x, y=y, z=z, position=position)
        self.set_rotation(h=h, p=p, b=b, rotation=rotation)
        self.set_scale(scale=scale)
        self.set_object_properties()
        self.plane = plane
        self.set_plane()
        self.relations = []
        self.actions = []
        self.xpressions = {}  # keeps track of animators, composers etc.
        self.accessed_parameters = {}  # keeps track which parameters have AccessControl
        self.helper_objects = {}  # keeps track of helper objects created by Animators
        self.parent = None

    def __repr__(self):
        """sets the string representation for printing"""
        return self.name

    @abstractmethod
    def specify_object(self):
        pass

    def set_xpresso_tags(self):
        """initializes the necessary xpresso tags on the object"""
        # the composition tags hold the hierarchy of compositions and ensure execution from highest to lowest
        #self.composition_tags = []
        # the animator tag holds the acting of the animators on the actual parameters
        # set priority to be executed last
        # self.animator_tag = XPressoTag(
        #    target=self, name="AnimatorTag", priority=1, priority_mode="expression")
        # the freeze tag holds the freezing xpressions that are executed before the animators
        # set priority to be executed after compositions and before animators
        # self.freeze_tag = XPressoTag(
        #    target=self, name="FreezeTag", priority=0, priority_mode="animation")
        # inserts an xpresso tag used for custom xpressions
        self.custom_tag = XPressoTag(
            target=self, name="CustomTag", priority_mode="expression")

    def add_composition_tag(self):
        """adds another layer to the composition hierarchy"""
        # set priority according to position in composition hierarchy
        tag_name = "CompositionTag" + str(len(self.composition_tags))
        tag_priority = -len(self.composition_tags)
        composition_tag = XPressoTag(
            target=self, name=tag_name, priority=tag_priority, priority_mode="initial")
        self.composition_tags.append(composition_tag)
        return composition_tag.obj

    def set_unique_desc_ids(self):
        """optional method to make unique descIds easily accessible"""
        pass

    def set_name(self, name=None):
        if name is None:
            self.name = self.__class__.__name__
        else:
            self.name = name
        self.obj.SetName(self.name)

    def set_plane(self):
        """sets the plane of the custom object"""
        if self.plane == "xy":
            self.rotate(rotation=(0, 0, 0))
        elif self.plane == "yz":
            self.rotate(rotation=(PI / 2, 0, 0))
        elif self.plane == "xz":
            self.rotate(rotation=(0, -PI / 2, 0))

    def specify_parameters(self):
        """specifies optional parameters for the custom object"""
        pass

    def insert_parameters(self):
        """inserts the specified parameters as userdata"""
        if self.parameters:
            self.parameters_u_group = UGroup(
                *self.parameters, target=self.obj, name=self.name + "Parameters")

    def specify_relations(self):
        """specifies the relations between the part's parameters using xpresso"""
        pass

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

    def set_frozen_rotation(self, h=0, p=0, b=0, rotation=None, relative=False):
        if rotation is None:
            rotation = c4d.Vector(h, p, b)
        if relative:
            self.obj[c4d.ID_BASEOBJECT_FROZEN_ROTATION] += rotation
        else:
            self.obj[c4d.ID_BASEOBJECT_FROZEN_ROTATION] = rotation

    def set_scale(self, scale=1, relative=False):
        if relative:
            self.obj[c4d.ID_BASEOBJECT_SCALE] *= scale
        else:
            scale = c4d.Vector(scale, scale, scale)
            self.obj[c4d.ID_BASEOBJECT_SCALE] = scale

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

    def insert_to_document(self):
        self.document.InsertObject(self.obj)

    def get_segment_count(self):
        # returns the length of the spline or a specific segment
        spline_help = c4d.utils.SplineHelp()
        spline_help.InitSplineWith(self.obj)
        segment_count = spline_help.GetSegmentCount()
        return segment_count

    def get_length(self, segment=None):
        # returns the length of the spline or a specific segment
        spline_help = c4d.utils.SplineHelp()
        spline_help.InitSplineWith(self.obj)

        if segment:
            segment_length = spline_help.GetSegmentLength(segment)
            return segment_length
        else:
            spline_length = spline_help.GetSplineLength()
            return spline_length

    def get_spline_segment_lengths(self):
        # get the length of each segment
        segment_lengths = []
        for i in range(self.get_segment_count()):
            segment_lengths.append(self.get_length(segment=i))
        return segment_lengths

    def set_object_properties(self):
        """used to set the unique properties of a specific object"""
        pass

    def sort_relations_by_priority(self):
        """sorts the relations by priority"""

        # right now it oly ensures that the actions are inserted above the relations
        # in the future we will implement priority and sorting by sub-xpression dependencies

        # get node master
        master = self.custom_tag.obj.GetNodeMaster()
        parent = master.GetRoot()

        """
        # resort by parent reference
        for relation in self.relations:
            if relation.parent:
                self.relations.remove(relation)
                parent_idx = self.relations.index(relation.parent)
                self.relations.insert(parent_idx, relation)
        for action in self.actions:
            if action.parent:
                self.actions.remove(action)
                parent_idx = self.actions.index(action.parent)
                self.actions.insert(parent_idx, action)
        """
        if self.relations:
            for relation in self.relations:
                master.InsertFirst(parent, relation.obj)
        if self.actions:
            for action in self.actions:
                master.InsertFirst(parent, action.obj)


class VisibleObject(ProtoObject):
    # visible objects

    def __init__(self, visible=True, creation=0, **kwargs):
        super().__init__(**kwargs)
        self.creation = creation
        self.visible = visible
        self.specify_visibility_parameter()
        self.insert_visibility_parameter()
        self.specify_visibility_relation()
        self.specify_live_bounding_box_parameters()
        self.insert_live_bounding_box_parameters()
        self.specify_live_bounding_box_relation()
        self.add_bounding_box_information()

    def specify_action_parameters(self):
        pass

    def specify_creation_parameter(self):
        self.creation_parameter = UCompletion(
            name="Creation", default_value=self.creation)
        self.action_parameters += [self.creation_parameter]

    def insert_action_parameters(self):
        """inserts the specified action_parameters as userdata"""
        if self.action_parameters:
            self.actions_u_group = UGroup(
                *self.action_parameters, target=self.obj, name=self.name + "Actions")

    def specify_actions(self):
        """specifies actions that coordinate parameters"""
        pass

    def specify_creation(self):
        """specifies the creation action"""
        pass

    def get_clone(self):
        """clones an object and inserts it into the scene"""
        clone = self.obj.GetClone()
        self.document.InsertObject(clone)
        return clone

    def get_editable(self):
        """returns an editable clone of the object"""
        clone = self.get_clone()
        editable_clone = c4d.utils.SendModelingCommand(command=c4d.MCOMMAND_MAKEEDITABLE, list=[
            clone], mode=c4d.MODELINGCOMMANDMODE_ALL, doc=self.document)[0]
        return editable_clone

    def attach_to(self, target, direction="front", offset=0):
        """places the object such that the bounding boxes touch along a given direction and makes object child of target"""
        bounding_box = self.obj.GetRad()
        bounding_box_position = self.obj.GetMp()
        bounding_box_target = target.obj.GetRad()
        bounding_box_position_target = target.obj.GetMp()
        new_position = bounding_box_position_target - bounding_box_position
        if direction == "top":
            new_position.y += bounding_box_target.y + bounding_box.y + offset
        if direction == "bottom":
            new_position.y -= bounding_box_target.y + bounding_box.y + offset
        if direction == "left":
            new_position.x -= bounding_box_target.x + bounding_box.x + offset
        if direction == "right":
            new_position.x += bounding_box_target.x + bounding_box.x + offset
        if direction == "front":
            new_position.z -= bounding_box_target.z + bounding_box.z + offset
        if direction == "back":
            new_position.z += bounding_box_target.z + bounding_box.z + offset
        if direction == "center":
            new_position = bounding_box_position_target - bounding_box_position
        self.obj.InsertUnder(target.obj)
        self.set_position(position=new_position)

    def specify_visibility_parameter(self):
        """specifies visibility parameter"""
        self.visibility_parameter = UCheckBox(
            name="Visibility", default_value=self.visible)

    def insert_visibility_parameter(self):
        """inserts the visibility parameter as userdata"""
        self.visibility_u_group = UGroup(
            self.visibility_parameter, target=self.obj, name="Visibility")

    def specify_visibility_relation(self):
        """link parameter to visibility"""
        visibility_relation = XRelation(part=self, whole=self, desc_ids=[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR, c4d.ID_BASEOBJECT_VISIBILITY_RENDER],
                                        parameters=[self.visibility_parameter], formula=f"1-{self.visibility_parameter.name}")

    def specify_live_bounding_box_parameters(self):
        """specifies bounding box parameters"""
        self.width_parameter = ULength(name="Width")
        self.height_parameter = ULength(name="Height")
        self.depth_parameter = ULength(name="Depth")
        self.center_parameter = UVector(name="Center")
        self.center_x_parameter = ULength(name="CenterX")
        self.center_y_parameter = ULength(name="CenterY")
        self.center_z_parameter = ULength(name="CenterZ")
        self.live_bounding_box_parameters = [self.width_parameter,
                                             self.height_parameter,
                                             self.depth_parameter,
                                             self.center_parameter,
                                             self.center_x_parameter,
                                             self.center_y_parameter,
                                             self.center_z_parameter]

    def insert_live_bounding_box_parameters(self):
        """inserts the bounding box parameters as userdata"""
        self.live_bounding_box_u_group = UGroup(
            *self.live_bounding_box_parameters, target=self.obj, name="LiveBoundingBox")

    def specify_live_bounding_box_relation(self):
        """feed bounding box information into parameters"""
        live_bounding_box_relation = XBoundingBox(self, target=self, width_parameter=self.width_parameter, height_parameter=self.height_parameter,
                                                  depth_parameter=self.depth_parameter, center_parameter=self.center_parameter,
                                                  center_x_parameter=self.center_x_parameter, center_y_parameter=self.center_y_parameter, center_z_parameter=self.center_z_parameter)

    def add_bounding_box_information(self):
        bounding_box_center, bounding_radius = c4d.utils.GetBBox(
            self.obj, self.obj.GetMg())
        self.width = bounding_radius.x * 2
        self.height = bounding_radius.y * 2
        self.depth = bounding_radius.z * 2
        self.center = bounding_box_center

    def get_center(self):
        # returns the center position from the live bounding box information
        center_position = self.obj.GetMp() * self.obj.GetMg()
        return center_position

    def get_radius(self):
        # returns the radius from the live bounding box information
        __, radius = c4d.utils.GetBBox(self.obj, self.obj.GetMg())
        return radius

    def get_diameter(self):
        # returns the diameter from the longest radius dimension
        radius = self.get_radius()
        diameter = max(radius.x, radius.y, radius.z) * 2
        return diameter

    def register_connections(self, connections):
        # saves the connections for later functionality of UnConnect
        self.connections = connections

    def create(self, completion=1):
        """specifies the creation animation"""
        desc_id = self.creation_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_create(self, completion=0):
        """specifies the uncreation animation"""
        desc_id = self.creation_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def align_to_spline(self, spline=None):
        self.align_to_spline_tag = AlignToSplineTag(target=self, spline=spline)

    def wrap_around(self, target=None):
        helper_objects = _get_helper_objects()
        self.shrink_wrap = helper_objects.ShrinkWrap(target=target)
        self.shrink_wrap.obj.InsertUnder(self.obj)

    def project_to_surface(self, projection_surface=None, **kwargs):
        helper_objects = _get_helper_objects()
        self.projection = helper_objects.Projection(target=self, projection_surface=projection_surface, **kwargs)

    def move_axis(self, position=(0, 0, 0)):
        """moves the axis without moving the geometry"""
        vec = c4d.Vector(*position)
        print(vec)
        print(position)
        points = self.obj.GetAllPoints()
        for i, point in enumerate(points):
            points[i] = point - vec
            if i < 3:
                print(points[i] - point)
        self.obj.SetAbsPos(self.obj.GetAbsPos() + vec)
        self.obj.SetAllPoints(points)
        self.obj.Message(c4d.MSG_UPDATE)
        c4d.EventAdd()


class CustomObject(VisibleObject):
    """this class is used to create custom objects that are basically
    groups with coupling of the childrens parameters through xpresso

    Supports two modes:
    - Standard mode (default): Uses XPresso for parameter relationships
    - Generator mode (generator_mode=True): Uses Python Generator for MoGraph compatibility
    """

    def __init__(self, diameter=None, generator_mode=False, **kwargs):
        self.generator_mode = generator_mode
        super().__init__(**kwargs)
        self.parts = []
        self.specify_parts()
        self.insert_parts()
        self.parameters = []
        self.specify_parameters()
        self.insert_parameters()
        self.relations = []  # Initialize relations list before specify_relations
        self.specify_relations()

        # Skip XPresso setup in generator mode
        if not self.generator_mode:
            self.action_parameters = []
            self.specify_action_parameters()
            self.specify_creation_parameter()
            self.insert_action_parameters()
            self.specify_actions()
            self.specify_creation()
            self.diameter = diameter
            self.add_bounding_box_information()
            self.specify_bounding_box_parameters()
            self.insert_bounding_box_parameters()
            self.specify_bounding_box_relations()
            self.specify_visibility_inheritance_relations()
            self.specify_position_inheritance()
            self.sort_relations_by_priority()
        else:
            # Generator mode: still need creation_parameter for keyframe animations
            self.action_parameters = []
            self.specify_creation_parameter()
            self.diameter = diameter
            self.insert_action_parameters()
            # Note: Subclasses with custom _convert_to_generator (like FoldableCube)
            # will override this. Otherwise, use the generic GeneratorMixin conversion.
            # The conversion happens AFTER all parameters are set up.
            self._convert_to_generator()

    def _convert_to_generator(self):
        """Convert this CustomObject to a Python Generator for MoGraph compatibility.

        This replaces self.obj (a Null) with a Python Generator that:
        - Has the same UserData parameters
        - Contains the same children (recursively converted if they have GeneratorMixin)
        - Uses Python code instead of XPresso for relationships
        """
        if not hasattr(self, 'create_as_generator'):
            # No GeneratorMixin - can't convert
            return

        # Store old obj reference
        old_obj = self.obj
        old_parent = old_obj.GetUp()
        old_pred = old_obj.GetPred()

        # Create the generator version
        gen = self.create_as_generator(recursive=True)

        # Replace old_obj with gen in the document
        if old_parent:
            if old_pred:
                gen.InsertAfter(old_pred)
            else:
                gen.InsertUnder(old_parent)
        else:
            # Was at root level
            doc = c4d.documents.GetActiveDocument()
            doc.InsertObject(gen)

        old_obj.Remove()

        # Update self.obj to point to the generator
        self.obj = gen

    def specify_creation(self):
        """used to specify the unique creation animation for each individual custom object"""
        pass

    def inherit_creation(self):
        """inheriting creation from parts"""
        movements = [Movement(part.creation_parameter, (0, 1), part=part, easing=False)
                     for part in self.parts]
        self.creation_action = XAction(*movements,
                                       target=self, completion_parameter=self.creation_parameter, name="Creation")

    def specify_position_inheritance(self):
        """used to specify how the position should be determined"""
        pass

    @abstractmethod
    def specify_parts(self):
        """save parts as attributes and write them to self.parts"""
        pass

    def insert_parts(self):
        """inserts the parts as children"""
        for part in self.parts:
            # check if part is not already child so existing hierarchies won't be disturbed
            if not part.obj.GetUp():
                part.obj.InsertUnder(self.obj)
                part.parent = self
            # check for membranes
            if hasattr(part, "membrane"):
                part.membrane.obj.InsertUnder(self.obj)
                part.membrane.parent = self

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Onull)

    def specify_visibility_inheritance_relations(self):
        """inherits visibility to parts"""
        effect_objects = _get_effect_objects()
        visibility_relations = []
        for part in self.parts:
            if hasattr(part, "visibility_parameter") and not isinstance(part, effect_objects.Morpher):
                visibility_relation = XIdentity(
                    part=part, whole=self, desc_ids=[part.visibility_parameter.desc_id], parameter=self.visibility_parameter, name="VisibilityInheritance")
                visibility_relations.append(visibility_relation)

    def specify_bounding_box_parameters(self):
        """specifies bounding box parameters"""
        default_diameter = self.diameter if self.diameter else max(
            self.width, self.height, self.depth)
        self.diameter_parameter = ULength(
            name="Diameter", default_value=default_diameter)
        self.default_width_parameter = ULength(
            name="DefaultWidth", default_value=self.width)
        self.default_height_parameter = ULength(
            name="DefaultHeight", default_value=self.height)
        self.default_depth_parameter = ULength(
            name="DefaultDepth", default_value=self.depth)
        self.bounding_box_parameters = [self.diameter_parameter, self.default_width_parameter,
                                        self.default_height_parameter, self.default_depth_parameter]

    def insert_bounding_box_parameters(self):
        """inserts the bounding box parameters"""
        self.bounding_box_u_group = UGroup(
            *self.bounding_box_parameters, target=self.obj, name="BoundingBox")

    def specify_bounding_box_relations(self):
        """gives the custom object basic control over the bounding box diameter"""
        diameter_relation = XRelation(part=self, whole=self, desc_ids=[SCALE_X, SCALE_Y, SCALE_Z], parameters=[self.diameter_parameter, self.default_width_parameter, self.default_height_parameter, self.default_depth_parameter],
                                      formula=f"{self.diameter_parameter.name}/max({self.default_width_parameter.name};max({self.default_height_parameter.name};{self.default_depth_parameter.name}))")


class LineObject(VisibleObject):
    """line objects consist of splines and only require a sketch material

    Supports two rendering modes:
    - Sketch mode (default): Uses Sketch & Toon post-effect
    - Stroke mode (stroke_mode=True): Uses geometry-based strokes (MoGraph compatible, faster)
    """

    def __init__(self, color=WHITE, plane="xy", arrow_start=False, arrow_end=False, draw_completion=0, opacity=1, helper_mode=False, draw_order="long_to_short", filled=False, fill_color=None, stroke_width=None, stroke_mode=False, **kwargs):
        self.stroke_width = stroke_width if stroke_width is not None else 3.0
        self.stroke_mode = stroke_mode
        super().__init__(**kwargs)
        self.color = color
        self.plane = plane
        self.arrow_start = arrow_start
        self.arrow_end = arrow_end
        self.draw_completion = draw_completion
        self.opacity = opacity
        self.draw_order = draw_order
        if not helper_mode:
            if self.stroke_mode:
                # Geometry-based stroke rendering
                self._setup_stroke_mode()
                self.sketch_parameter_setup()  # Sets up Draw, Opacity, Color parameters
            else:
                # Traditional Sketch & Toon rendering
                self.set_sketch_material()
                self.set_sketch_tag()
                self.sketch_parameter_setup()
            self.set_plane()
            self.spline_length_parameter_setup()
            self.parameters = []
            self.specify_parameters()
            self.insert_parameters()
            self.specify_relations()
            self.action_parameters = []
            self.specify_action_parameters()
            self.specify_creation_parameter()
            self.insert_action_parameters()
            self.specify_actions()
            self.specify_creation()
            self.sort_relations_by_priority()
        self.filled = filled
        self.fill_color = fill_color
        if self.filled:
            self.create_membrane()

    def create_membrane(self):
        custom_objects = _get_custom_objects()
        if self.fill_color:
            color = self.fill_color
        else:
            color = self.color

        self.membrane = custom_objects.Membrane(
            self, name=self.name + "Membrane", creation=True, color=color)

    def _setup_stroke_mode(self):
        """Set up geometry-based stroke rendering using StrokeGen.

        In stroke mode:
        - self.spline holds the original spline object
        - self.obj becomes the StrokeGen (for position/rotation/UserData compatibility)
        - The spline is a child of the stroke generator

        This maintains the mental model that self.obj is "the thing" while
        enabling geometry-based stroke rendering.
        """
        from DreamTalk.objects.stroke_objects import STROKE_GEN_CODE, StrokeMaterial

        # Store spline reference
        self.spline = self.obj

        # Create the stroke generator
        self.stroke_gen = c4d.BaseObject(1023866)  # Python Generator
        self.stroke_gen[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.stroke_gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!
        self.stroke_gen.SetName(self.name)

        # Add Stroke Width UserData
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_METER
        self.stroke_width_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.stroke_width_id] = self.stroke_width

        # Add Draw UserData (0-1 completion for animation)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.stroke_draw_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.stroke_draw_id] = self.draw_completion

        # Insert stroke gen into document
        self.document.InsertObject(self.stroke_gen)

        # Move spline under stroke gen
        self.spline.Remove()
        self.spline.InsertUnder(self.stroke_gen)

        # Create and apply stroke material
        self.stroke_material = StrokeMaterial(
            color=self.color,
            opacity=self.opacity,
            name=f"{self.name}_StrokeMat"
        )
        tag = self.stroke_gen.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.stroke_material.obj

        # Swap obj to be the stroke_gen - this is the "main" object now
        self.obj = self.stroke_gen

    def _stroke_sketch_parameter_setup(self):
        """Set up parameters for stroke mode that mirror sketch parameters.

        In stroke mode, Draw/Opacity/Color UserData already exists on
        the stroke generator (self.obj). We just need to create parameter
        wrappers that reference the existing desc_ids.
        """
        # Draw parameter - already on stroke_gen via _setup_stroke_mode
        self.draw_parameter = UCompletion(
            name="Draw", default_value=self.draw_completion)
        self.draw_parameter.desc_id = self.stroke_draw_id  # Point to existing

        # For Opacity and Color, we use the material directly
        # Create parameter objects but they'll control the material
        self.opacity_parameter = UCompletion(
            name="Opacity", default_value=self.opacity)
        self.color_parameter = UColor(
            name="Color", default_value=self.color)

        self.sketch_parameters = [self.draw_parameter,
                                  self.opacity_parameter, self.color_parameter]

    def spline_length_parameter_setup(self):
        self.specify_spline_length_parameter()
        self.insert_spline_length_parameter()
        self.specify_spline_length_relation()

    def sketch_parameter_setup(self):
        if self.stroke_mode:
            self._stroke_sketch_parameter_setup()
            self._insert_stroke_sketch_parameters()
            self._specify_stroke_sketch_relations()
        else:
            self.specify_sketch_parameters()
            self.insert_sketch_parameters()
            self.specify_sketch_relations()

    def _insert_stroke_sketch_parameters(self):
        """Insert additional UserData on stroke_gen for Opacity and Color.

        Draw is already on the generator (read by generator code).
        Opacity and Color are added for animation compatibility but
        actually control the material programmatically.
        """
        # Opacity UserData (for animation keyframing)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Opacity"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.stroke_opacity_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_opacity_id] = self.opacity
        self.opacity_parameter.desc_id = self.stroke_opacity_id

        # Color UserData (for animation keyframing)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_COLOR)
        bc[c4d.DESC_NAME] = "Color"
        self.stroke_color_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_color_id] = self.color
        self.color_parameter.desc_id = self.stroke_color_id

    def _specify_stroke_sketch_relations(self):
        """Link UserData to stroke material.

        In stroke mode:
        - Draw is handled by the generator code directly (reads UserData by name)
        - Opacity and Color are set at construction time on the material

        For animated opacity/color, use set_opacity() and set_color() methods
        or animate via Python Generator code.
        """
        # No XPresso relations needed - generator reads Draw directly
        # Opacity/Color are set on material at construction time
        pass

    def specify_creation(self):
        """specifies the creation action"""
        if self.stroke_mode:
            # In stroke mode, creation animation is simpler - just animate the Draw UserData
            # XAction uses XPresso which is complex; stroke_mode uses direct UserData access
            # The Create animator will animate the creation_parameter which maps to draw
            pass
        else:
            creation_action = XAction(
                Movement(self.draw_parameter, (0, 1)),
                target=self, completion_parameter=self.creation_parameter, name="Creation")
            self.actions.append(creation_action)

    def set_sketch_material(self):
        self.sketch_material = SketchMaterial(
            name=self.__class__.__name__, draw_order=self.draw_order, color=self.color, arrow_start=self.arrow_start, arrow_end=self.arrow_end, stroke_width=self.stroke_width)

    def set_sketch_tag(self):
        self.sketch_tag = SketchTag(target=self, material=self.sketch_material)

    def specify_sketch_parameters(self):
        self.draw_parameter = UCompletion(
            name="Draw", default_value=self.draw_completion)
        self.opacity_parameter = UCompletion(
            name="Opacity", default_value=self.opacity)
        self.color_parameter = UColor(
            name="Color", default_value=self.color)
        self.sketch_parameters = [self.draw_parameter,
                                  self.opacity_parameter, self.color_parameter]

    def insert_sketch_parameters(self):
        self.draw_u_group = UGroup(
            *self.sketch_parameters, target=self.obj, name="Sketch")

    def specify_sketch_relations(self):
        draw_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["draw_completion"]],
                                  parameter=self.draw_parameter)
        opacity_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["opacity"]],
                                     parameter=self.opacity_parameter)
        color_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["color"]],
                                   parameter=self.color_parameter)

    def set_plane(self):
        planes = {"xy": 0, "zy": 1, "xz": 2}
        self.obj[c4d.PRIM_PLANE] = planes[self.plane]

    def specify_spline_length_parameter(self):
        self.spline_length_parameter = ULength(name="SplineLength")

    def insert_spline_length_parameter(self):
        self.spline_length_u_group = UGroup(
            self.spline_length_parameter, target=self.obj, name="Spline")

    def specify_spline_length_relation(self):
        self.spline_length_relation = XSplineLength(
            spline=self, whole=self, parameter=self.spline_length_parameter)

    def draw(self, completion=1):
        """specifies the draw animation"""
        desc_id = self.draw_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_draw(self, completion=0):
        """specifies the undraw animation"""
        desc_id = self.draw_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def fade_in(self, completion=1):
        """specifies the fade in animation"""
        desc_id = self.opacity_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def fade_out(self, completion=0):
        """specifies the fade out animation"""
        desc_id = self.opacity_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def change_color(self, color):
        """specifies the color change animation"""
        desc_id = self.color_parameter.desc_id
        animation = ColorAnimation(
            target=self, descriptor=desc_id, vector=color)
        self.obj[desc_id] = color
        return animation


class SolidObject(VisibleObject):
    """solid objects only require a fill material

    Supports two rendering modes:
    - Sketch mode (default): Uses Sketch & Toon post-effect for silhouette lines
    - Stroke mode (stroke_mode=True): Uses geometry-based strokes (MoGraph compatible, faster)
    """

    def __init__(self, filled=0, glowing=0, color=WHITE, fill_color=None, sketch_color=None, draw_order="long_to_short", draw_completion=0, arrow_start=False, arrow_end=False, fill_opacity=1, sketch_opacity=1, hidden_material=True, stroke_width=None, sketch_outline=True, sketch_folds=False, sketch_creases=True, sketch_border=False, sketch_contour=True, sketch_splines=True, stroke_mode=False, **kwargs):
        """
        Base class for 3D solid objects with fill and sketch materials.

        Args:
            filled: Fill visibility (0-1)
            glowing: Glow intensity (0-1)
            color: Base color (used for both fill and sketch if not specified)
            fill_color: Override fill color
            sketch_color: Override sketch color
            draw_order: Sketch draw order ("long_to_short" or "short_to_long")
            draw_completion: Initial sketch draw completion (0-1)
            arrow_start: Add arrow at spline start
            arrow_end: Add arrow at spline end
            fill_opacity: Fill opacity (0-1)
            sketch_opacity: Sketch opacity (0-1)
            hidden_material: Control hidden line rendering:
                - True (default): Same material for hidden lines (solid look)
                - False/None: No hidden material (X-ray see-through effect)
                - Material object: Custom hidden line material
            stroke_width: Override sketch line thickness
            sketch_outline: Enable outline rendering (default True)
            sketch_folds: Enable fold lines (default False)
            sketch_creases: Enable crease lines (default True)
            sketch_border: Enable border lines (default False)
            sketch_contour: Enable contour lines (default True)
            sketch_splines: Enable spline rendering (default True)
            stroke_mode: Use geometry-based strokes instead of Sketch & Toon (default False)
            **kwargs: Parent class arguments
        """
        self.stroke_mode = stroke_mode
        self.stroke_width = stroke_width if stroke_width is not None else 3.0
        self.filled = filled
        self.glowing = glowing
        self.color = color
        self.fill_color = fill_color
        self.sketch_color = sketch_color
        self.draw_order = draw_order
        self.draw_completion = draw_completion
        self.arrow_start = arrow_start
        self.arrow_end = arrow_end
        self.sketch_opacity = sketch_opacity
        self.fill_opacity = fill_opacity
        self.hidden_material = hidden_material
        self.sketch_outline = sketch_outline
        self.sketch_folds = sketch_folds
        self.sketch_creases = sketch_creases
        self.sketch_border = sketch_border
        self.sketch_contour = sketch_contour
        self.sketch_splines = sketch_splines
        super().__init__(**kwargs)
        self.derive_colors()
        # fill setup
        self.set_fill_material()
        self.set_fill_tag()
        self.fill_parameter_setup()
        # sketch setup
        if self.stroke_mode:
            # Geometry-based stroke rendering
            self._setup_stroke_mode()
            self.sketch_parameter_setup()  # Sets up Draw, Opacity, Color parameters
        else:
            # Traditional Sketch & Toon rendering
            self.set_sketch_material()
            self.set_sketch_tag()
            self.sketch_parameter_setup()
        self.parameters = []
        self.specify_parameters()
        self.insert_parameters()
        self.specify_relations()
        self.action_parameters = []
        self.specify_action_parameters()
        self.specify_creation_parameter()
        self.insert_action_parameters()
        self.specify_actions()
        self.specify_creation()
        self.sort_relations_by_priority()

    def derive_colors(self):
        if not self.fill_color:
            self.fill_color = self.color
        if not self.sketch_color:
            self.sketch_color = self.color

    def _setup_stroke_mode(self):
        """Set up geometry-based stroke rendering using MeshStroke.

        In stroke mode for solids:
        - self.mesh holds the original mesh object
        - self.obj becomes the MeshStroke wrapper (for position/rotation/UserData compatibility)
        - The mesh is nested inside: StrokeGen > SilhouetteSplineGen > Mesh

        This extracts silhouette edges and renders them as geometry-based strokes.
        """
        from DreamTalk.objects.stroke_objects import STROKE_GEN_CODE, SILHOUETTE_SPLINE_GEN_CODE, StrokeMaterial

        # Store mesh reference
        self.mesh = self.obj

        # Create the silhouette spline generator
        self.silhouette_gen = c4d.BaseObject(1023866)  # Python Generator
        self.silhouette_gen[c4d.OPYTHON_CODE] = SILHOUETTE_SPLINE_GEN_CODE
        self.silhouette_gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!
        self.silhouette_gen.SetName("SilhouetteSpline")

        # Create the stroke generator
        self.stroke_gen = c4d.BaseObject(1023866)  # Python Generator
        self.stroke_gen[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.stroke_gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!
        self.stroke_gen.SetName(self.name)

        # Add Stroke Width UserData to stroke gen
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_METER
        self.stroke_width_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.stroke_width_id] = self.stroke_width

        # Add Draw UserData (0-1 completion for animation)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.stroke_draw_id = self.stroke_gen.AddUserData(bc)
        self.stroke_gen[self.stroke_draw_id] = self.draw_completion

        # Insert stroke gen into document
        self.document.InsertObject(self.stroke_gen)

        # Build hierarchy: StrokeGen > SilhouetteSplineGen > Mesh
        self.silhouette_gen.InsertUnder(self.stroke_gen)
        self.mesh.Remove()
        self.mesh.InsertUnder(self.silhouette_gen)

        # Create and apply stroke material
        self.stroke_material = StrokeMaterial(
            color=self.sketch_color,
            opacity=self.sketch_opacity,
            name=f"{self.name}_StrokeMat"
        )
        tag = self.stroke_gen.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.stroke_material.obj

        # Swap obj to be the stroke_gen - this is the "main" object now
        self.obj = self.stroke_gen

    def sketch_parameter_setup(self):
        if self.stroke_mode:
            self._stroke_sketch_parameter_setup()
            self._insert_stroke_sketch_parameters()
            self._specify_stroke_sketch_relations()
        else:
            self.specify_sketch_parameters()
            self.insert_sketch_parameters()
            self.specify_sketch_relations()

    def _stroke_sketch_parameter_setup(self):
        """Set up parameters for stroke mode that mirror sketch parameters."""
        # Draw parameter - already on stroke_gen via _setup_stroke_mode
        self.draw_parameter = UCompletion(
            name="Draw", default_value=self.draw_completion)
        self.draw_parameter.desc_id = self.stroke_draw_id  # Point to existing

        # For Opacity and Color, we use the material directly
        self.opacity_parameter = UCompletion(
            name="SketchOpacity", default_value=self.sketch_opacity)
        self.color_parameter = UColor(
            name="Color", default_value=self.sketch_color)

        self.sketch_parameters = [self.draw_parameter,
                                  self.opacity_parameter, self.color_parameter]

    def _insert_stroke_sketch_parameters(self):
        """Insert additional UserData on stroke_gen for Opacity and Color."""
        # Opacity UserData (for animation keyframing)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "SketchOpacity"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.stroke_opacity_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_opacity_id] = self.sketch_opacity
        self.opacity_parameter.desc_id = self.stroke_opacity_id

        # Color UserData (for animation keyframing)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_COLOR)
        bc[c4d.DESC_NAME] = "Color"
        self.stroke_color_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_color_id] = self.sketch_color
        self.color_parameter.desc_id = self.stroke_color_id

    def _specify_stroke_sketch_relations(self):
        """Link UserData to stroke material.

        In stroke mode:
        - Draw is handled by the generator code directly (reads UserData by name)
        - Opacity and Color are set at construction time on the material
        """
        # No XPresso relations needed - generator reads Draw directly
        pass

    def specify_creation(self):
        """specifies the creation action"""
        if self.stroke_mode:
            # In stroke mode, skip XAction - use direct UserData access
            # Create animator will animate the creation_parameter directly
            pass
        else:
            creation_action = XAction(
                Movement(self.fill_parameter, (1 / 3, 1),
                         output=(0, self.fill_opacity)),
                Movement(self.draw_parameter, (0, 2 / 3)),
                target=self, completion_parameter=self.creation_parameter, name="Creation")

    def fill_parameter_setup(self):
        self.specify_fill_parameter()
        self.insert_fill_parameter()
        self.specify_fill_relation()

    def set_fill_material(self):
        self.fill_material = FillMaterial(
            name=self.name, fill=self.filled, color=self.fill_color)

    def set_fill_tag(self):
        self.fill_tag = FillTag(target=self, material=self.fill_material)

    def specify_fill_parameter(self):
        self.fill_parameter = UCompletion(
            name="Fill", default_value=self.filled)
        self.glow_parameter = UCompletion(
            name="Glow", default_value=self.glowing)
        self.fill_parameters = [self.fill_parameter, self.glow_parameter]

    def insert_fill_parameter(self):
        self.fill_u_group = UGroup(
            *self.fill_parameters, target=self.obj, name="Solid")

    def specify_fill_relation(self):
        self.fill_relation = XRelation(part=self.fill_material, whole=self, desc_ids=[self.fill_material.desc_ids["transparency"]],
                                       parameters=[self.fill_parameter], formula=f"1-{self.fill_parameter.name}")
        self.glow_relation = XRelation(part=self.fill_material, whole=self, desc_ids=[self.fill_material.desc_ids["glow_brightness"]],
                                       parameters=[self.glow_parameter], formula=f"{self.glow_parameter.name}")

    def fill(self, completion=1):
        """specifies the fill animation"""
        desc_id = self.fill_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_fill(self, completion=0):
        """specifies the unfill animation"""
        desc_id = self.fill_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def set_sketch_material(self):
        self.sketch_material = SketchMaterial(
            name=self.__class__.__name__, draw_order=self.draw_order, color=self.sketch_color, arrow_start=self.arrow_start, arrow_end=self.arrow_end, stroke_width=self.stroke_width)

    def set_sketch_tag(self):
        self.sketch_tag = SketchTag(
            target=self,
            material=self.sketch_material,
            outline=self.sketch_outline,
            folds=self.sketch_folds,
            creases=self.sketch_creases,
            border=self.sketch_border,
            contour=self.sketch_contour,
            splines=self.sketch_splines,
            hidden_material=self.hidden_material
        )

    def specify_sketch_parameters(self):
        self.draw_parameter = UCompletion(
            name="Draw", default_value=self.draw_completion)
        self.opacity_parameter = UCompletion(
            name="SketchOpacity", default_value=self.sketch_opacity)
        self.color_parameter = UColor(
            name="Color", default_value=self.sketch_color)
        self.sketch_parameters = [self.draw_parameter,
                                  self.opacity_parameter, self.color_parameter]

    def insert_sketch_parameters(self):
        self.draw_u_group = UGroup(
            *self.sketch_parameters, target=self.obj, name="Sketch")

    def specify_sketch_relations(self):
        draw_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["draw_completion"]],
                                  parameter=self.draw_parameter)
        opacity_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["opacity"]],
                                     parameter=self.opacity_parameter)
        color_relation = XIdentity(part=self.sketch_material, whole=self, desc_ids=[self.sketch_material.desc_ids["color"]],
                                   parameter=self.color_parameter)

    def draw(self, completion=1):
        """specifies the draw animation"""
        desc_id = self.draw_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_draw(self, completion=0):
        """specifies the undraw animation"""
        desc_id = self.draw_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def glow(self, completion=1):
        """specifies the glow animation"""
        desc_id = self.glow_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation

    def un_glow(self, completion=0):
        """specifies the unglow animation"""
        desc_id = self.glow_parameter.desc_id
        animation = ScalarAnimation(
            target=self, descriptor=desc_id, value_fin=completion)
        self.obj[desc_id] = completion
        return animation
