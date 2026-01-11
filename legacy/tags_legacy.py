from abc import ABC, abstractmethod
from DreamTalk.constants import WHITE
import c4d


class Tag():

    def __init__(self, target=None, name=None):
        self.document = c4d.documents.GetActiveDocument()  # get document
        self.specify_tag_type()
        self.set_tag_properties()
        self.set_name(name)
        self.apply_to_object(target)
        self.set_unique_desc_ids()

    def set_name(self, name):
        if name:
            self.obj.SetName(name)

    @abstractmethod
    def specify_tag_type(self):
        pass

    def apply_to_object(self, target):
        target.obj.InsertTag(self.obj)
        self.linked_object = target

    def set_tag_properties(self):
        pass

    def set_unique_desc_ids(self):
        pass


class MaterialTag(Tag):

    def __init__(self, material=None, **kwargs):
        super().__init__(**kwargs)
        self.link_to_material(material)

    @ abstractmethod
    def specify_tag_type(self):
        pass

    @ abstractmethod
    def link_to_material(self):
        pass

    @ abstractmethod
    def set_tag_properties(self):
        pass


class SketchTag(MaterialTag):

    def __init__(self, outline=False, folds=False, creases=False, border=False, contour=False, splines=True,
                 hidden_material=True,
                 contour_position=2, contour_spacing_mode=1, contour_spacing=15,
                 **kwargs):
        """
        Create a Sketch Style tag for Sketch & Toon rendering.

        Args:
            outline: Enable outline rendering
            folds: Enable fold lines
            creases: Enable crease lines
            border: Enable border lines
            contour: Enable contour lines
            splines: Enable spline rendering
            hidden_material: Control hidden line rendering:
                - True (default): Use same material for hidden lines (solid look)
                - False/None: No hidden material (X-ray see-through effect)
                - Material object: Use specific material for hidden lines
            contour_position: Contour position mode (0=World, 1=Camera, 2=ObjectZ, etc.) Default 2 (ObjectZ)
            contour_spacing_mode: 0=Relative, 1=Absolute. Default 1 (Absolute)
            contour_spacing: Spacing value in cm (default 15)
            **kwargs: Parent class arguments (target, material, name)
        """
        self.outline = outline
        self.folds = folds
        self.creases = creases
        self.border = border
        self.contour = contour
        self.splines = splines
        self.hidden_material = hidden_material
        self.contour_position = contour_position
        self.contour_spacing_mode = contour_spacing_mode
        self.contour_spacing = contour_spacing
        super().__init__(**kwargs)

    def specify_tag_type(self):
        self.obj = c4d.BaseTag(1011012)  # create sketch tag

    def link_to_material(self, material):
        # Visible material - always set
        self.obj[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_V] = material.obj

        # Hidden material - configurable
        if self.hidden_material is True:
            # Default: use same material for hidden lines (solid look)
            self.obj[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_H] = material.obj
        elif self.hidden_material is False or self.hidden_material is None:
            # X-ray effect: no hidden material (see-through)
            self.obj[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_H] = None
        else:
            # Custom hidden material provided
            self.obj[c4d.OUTLINEMAT_LINE_DEFAULT_MAT_H] = self.hidden_material.obj

        self.linked_material = material
        material.linked_tag = self

    def set_tag_properties(self):
        # Line type enables
        self.obj[c4d.OUTLINEMAT_LINE_SPLINES] = self.splines
        self.obj[c4d.OUTLINEMAT_LINE_FOLD] = self.folds
        self.obj[c4d.OUTLINEMAT_LINE_CREASE] = self.creases
        self.obj[c4d.OUTLINEMAT_LINE_BORDER] = self.border
        self.obj[c4d.OUTLINEMAT_LINE_CONTOUR] = self.contour
        self.obj[c4d.OUTLINEMAT_LINE_OUTLINE] = self.outline
        # Contour settings
        self.obj[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION] = self.contour_position
        self.obj[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION_SPACING] = self.contour_spacing_mode
        self.obj[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION_SPACE] = self.contour_spacing

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "render_splines": c4d.DescID(c4d.DescLevel(c4d.OUTLINEMAT_LINE_SPLINES, c4d.DTYPE_BOOL, 0))
        }



class FillTag(MaterialTag):

    def specify_tag_type(self):
        self.obj = c4d.BaseTag(c4d.Ttexture)  # create fill tag

    def link_to_material(self, material):
        self.obj.SetMaterial(material.obj)
        self.linked_material = material
        material.linked_tag = self

    def set_tag_properties(self):
        pass


class XPressoTag(Tag):

    def __init__(self, priority=0, priority_mode="animation", **kwargs):
        super().__init__(**kwargs)
        self.set_priority(priority, mode=priority_mode)

    def specify_tag_type(self):
        self.obj = c4d.BaseTag(c4d.Texpresso)

    def set_priority(self, value, mode="animation"):
        # define priority modes
        modes = {
            "initial": c4d.CYCLE_INITIAL,
            "animation": c4d.CYCLE_ANIMATION,
            "expression": c4d.CYCLE_EXPRESSION
        }
        # set execution priority
        priority_data = self.obj[c4d.EXPRESSION_PRIORITY]
        # set priority value
        priority_data.SetPriorityValue(c4d.PRIORITYVALUE_PRIORITY, value)
        # set mode to initial
        priority_data.SetPriorityValue(c4d.PRIORITYVALUE_MODE, modes[mode])
        self.obj[c4d.EXPRESSION_PRIORITY] = priority_data


class TargetTag(Tag):

    def __init__(self, focus_point=None, **kwargs):
        self.focus_point = focus_point
        super().__init__(**kwargs)
        self.set_target(self.focus_point)

    def specify_tag_type(self):
        self.obj = c4d.BaseTag(c4d.Ttargetexpression)

    def set_target(self, target):
        """Set the target object for this tag to look at.

        Args:
            target: A DreamTalk object (with .obj attribute) or c4d.BaseObject
        """
        if hasattr(target, 'obj'):
            self.obj[c4d.TARGETEXPRESSIONTAG_LINK] = target.obj
        else:
            self.obj[c4d.TARGETEXPRESSIONTAG_LINK] = target
        self.focus_point = target


class AlignToSplineTag(Tag):

    def __init__(self, spline=None, tangential=True, **kwargs):
        self.spline = spline
        self.tangential = tangential
        super().__init__(**kwargs)
        self.set_spline()

    def specify_tag_type(self):
        self.obj = c4d.BaseTag(c4d.Taligntospline)

    def set_spline(self):
        self.obj[c4d.ALIGNTOSPLINETAG_LINK] = self.spline.obj
        self.obj[c4d.ALIGNTOSPLINETAG_TANGENTIAL] = self.tangential

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "position": c4d.DescID(c4d.DescLevel(c4d.ALIGNTOSPLINETAG_POSITION, c4d.DTYPE_REAL, 0)),
        }