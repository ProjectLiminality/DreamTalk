"""
Hierarchy Introspection

Walks Cinema 4D document and extracts semantic information about DreamTalk objects.
"""

import c4d


# DreamTalk object type detection
DREAMTALK_TYPES = {
    # LineObjects (spline-based)
    "Circle", "Rectangle", "Arc", "Spline", "SVG", "SplineText", "Line",
    "Arrow", "Brace", "NSide", "Helix", "Formula",
    # SolidObjects (3D)
    "Sphere", "Cylinder", "Cube", "Plane", "Cone", "Torus", "Capsule",
    "Pyramid", "Platonic", "Disc", "Tube", "Landscape", "Figure",
    # CustomObjects (composites) - common ones
    "Connection", "Group", "Membrane", "Morpher",
    # Known sovereign symbols
    "Fire", "Human", "Campfire", "Camp",
}


def get_userdata_value(obj, group_name, param_name):
    """
    Get a userdata parameter value by group and parameter name.

    Returns None if not found.
    """
    ud = obj.GetUserDataContainer()
    if not ud:
        return None

    # Find the parameter by name within the group
    for desc_id, bc in ud:
        name = bc.GetString(c4d.DESC_NAME)
        if name == param_name:
            try:
                return obj[desc_id]
            except:
                return None
    return None


def get_userdata_groups(obj):
    """
    Get all userdata group names on an object.

    Returns list of group names.
    """
    groups = []
    ud = obj.GetUserDataContainer()
    if not ud:
        return groups

    for desc_id, bc in ud:
        # Groups have dtype=1 (DTYPE_GROUP) and customgui=0
        dtype = desc_id[1].dtype if len(desc_id) > 1 else 0
        if dtype == 1:  # c4d.DTYPE_GROUP
            name = bc.GetString(c4d.DESC_NAME)
            if name:
                groups.append(name)
    return groups


def _get_c4d_type(name, default=None):
    """Safely get a c4d constant, returning default if not found."""
    return getattr(c4d, name, default)


def detect_dreamtalk_class(obj):
    """
    Detect what type of DreamTalk object this is based on heuristics.

    Returns one of: "CustomObject", "LineObject", "SolidObject", "Camera", "Light", "Unknown"
    """
    obj_type = obj.GetType()
    obj_name = obj.GetName()

    # Camera
    if obj_type == _get_c4d_type('Ocamera'):
        return "Camera"

    # Light
    if obj_type == _get_c4d_type('Olight'):
        return "Light"

    # Check userdata for DreamTalk signatures
    groups = get_userdata_groups(obj)

    # CustomObject signature: has Actions group with Creation parameter
    if any("Actions" in g for g in groups):
        # Check if it's a Null (CustomObjects are Nulls with children)
        if obj_type == _get_c4d_type('Onull'):
            return "CustomObject"

    # LineObject signature: Sketch group with Draw parameter
    if "Sketch" in groups:
        # Splines are LineObjects
        spline_types = [_get_c4d_type(t) for t in
                       ('Ospline', 'Osplinecircle', 'Osplinerectangle',
                        'Osplinearc', 'Osplinetext', 'Osplinehelix',
                        'Osplinenside', 'Osplineformula', 'Ospline4side')
                       if _get_c4d_type(t) is not None]
        if obj_type in spline_types:
            return "LineObject"

    # SolidObject signature: has both Fill and Sketch groups
    if "Solid" in groups and "Sketch" in groups:
        return "SolidObject"

    # Fall back to C4D type-based detection
    if obj_type == _get_c4d_type('Onull'):
        # Null with children might be a CustomObject without full setup
        if obj.GetDown():
            return "CustomObject"
        return "Null"

    # Check if spline type
    spline_types = [_get_c4d_type(t) for t in
                   ('Ospline', 'Osplinecircle', 'Osplinerectangle',
                    'Osplinearc', 'Osplinetext', 'Osplinehelix',
                    'Osplinenside', 'Osplineformula', 'Ospline4side')
                   if _get_c4d_type(t) is not None]
    if obj_type in spline_types:
        return "LineObject"

    # Check if solid/primitive type
    solid_types = [_get_c4d_type(t) for t in
                  ('Osphere', 'Ocylinder', 'Ocube', 'Oplane',
                   'Ocone', 'Otorus', 'Ocapsule', 'Opyramid',
                   'Oplatonic', 'Odisc', 'Otube')
                  if _get_c4d_type(t) is not None]
    if obj_type in solid_types:
        return "SolidObject"

    return "Unknown"


def get_color_from_object(obj):
    """
    Try to extract the color from a DreamTalk object.

    Returns tuple (r, g, b) normalized 0-1, or None if not found.
    """
    # Try userdata Color parameter
    color = get_userdata_value(obj, "Sketch", "Color")
    if color and isinstance(color, c4d.Vector):
        return (color.x, color.y, color.z)

    # Try to get from material
    tags = obj.GetTags()
    for tag in tags:
        if tag.GetType() == c4d.Ttexture:
            mat = tag.GetMaterial()
            if mat:
                try:
                    color = mat[c4d.MATERIAL_COLOR_COLOR]
                    if color:
                        return (color.x, color.y, color.z)
                except:
                    pass
    return None


def color_to_name(rgb):
    """Convert RGB tuple to approximate color name."""
    if rgb is None:
        return None

    r, g, b = rgb

    # Check for common DreamTalk colors
    if r > 0.8 and g < 0.3 and b < 0.3:
        return "RED"
    if r < 0.3 and g < 0.3 and b > 0.8:
        return "BLUE"
    if r < 0.3 and g > 0.8 and b < 0.3:
        return "GREEN"
    if r > 0.8 and g > 0.8 and b < 0.3:
        return "YELLOW"
    if r > 0.8 and g < 0.5 and b > 0.8:
        return "PURPLE"
    if r > 0.8 and g > 0.4 and b < 0.3:
        return "ORANGE"
    if r > 0.8 and g > 0.8 and b > 0.8:
        return "WHITE"
    if r < 0.2 and g < 0.2 and b < 0.2:
        return "BLACK"

    return f"rgb({r:.2f},{g:.2f},{b:.2f})"


def describe_object(obj, depth=0, include_children=True):
    """
    Create a semantic description of a single object.

    Args:
        obj: Cinema 4D BaseObject
        depth: Current depth in hierarchy (for indentation)
        include_children: Whether to recursively describe children

    Returns:
        dict with object description
    """
    if obj is None:
        return None

    pos = obj.GetAbsPos()
    rot = obj.GetAbsRot()
    scale = obj.GetAbsScale()

    # Get DreamTalk class
    dt_class = detect_dreamtalk_class(obj)

    # Build description
    desc = {
        "name": obj.GetName(),
        "type": dt_class,
        "depth": depth,
        "position": {
            "x": round(pos.x, 1),
            "y": round(pos.y, 1),
            "z": round(pos.z, 1)
        },
    }

    # Only include rotation/scale if non-default
    if abs(rot.x) > 0.01 or abs(rot.y) > 0.01 or abs(rot.z) > 0.01:
        import math
        desc["rotation"] = {
            "h": round(math.degrees(rot.x), 1),
            "p": round(math.degrees(rot.y), 1),
            "b": round(math.degrees(rot.z), 1)
        }

    if abs(scale.x - 1) > 0.01 or abs(scale.y - 1) > 0.01 or abs(scale.z - 1) > 0.01:
        desc["scale"] = round(scale.x, 2)  # Assume uniform scale

    # DreamTalk-specific info
    creation = get_userdata_value(obj, "Actions", "Creation")
    if creation is not None:
        desc["creation"] = round(creation * 100, 1)  # As percentage

    draw = get_userdata_value(obj, "Sketch", "Draw")
    if draw is not None:
        desc["draw"] = round(draw * 100, 1)

    opacity = get_userdata_value(obj, "Sketch", "Opacity")
    if opacity is not None and opacity < 1.0:
        desc["opacity"] = round(opacity * 100, 1)

    # Color
    color = get_color_from_object(obj)
    color_name = color_to_name(color)
    if color_name:
        desc["color"] = color_name

    # Children
    if include_children:
        children = []
        child = obj.GetDown()
        while child:
            child_desc = describe_object(child, depth + 1, include_children=True)
            if child_desc:
                children.append(child_desc)
            child = child.GetNext()

        if children:
            desc["children"] = children
            desc["child_count"] = len(children)

    return desc


def describe_hierarchy(doc=None):
    """
    Generate a semantic description of the entire scene hierarchy.

    Args:
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with:
        - objects: list of root-level object descriptions
        - stats: scene statistics
        - summary: human-readable summary
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    # Collect root objects
    root_objects = []
    obj = doc.GetFirstObject()
    while obj:
        desc = describe_object(obj, depth=0)
        if desc:
            root_objects.append(desc)
        obj = obj.GetNext()

    # Calculate stats
    stats = {
        "total_objects": 0,
        "custom_objects": 0,
        "line_objects": 0,
        "solid_objects": 0,
        "max_depth": 0,
    }

    def count_recursive(objects, depth=0):
        for o in objects:
            stats["total_objects"] += 1
            stats["max_depth"] = max(stats["max_depth"], depth)

            obj_type = o.get("type", "Unknown")
            if obj_type == "CustomObject":
                stats["custom_objects"] += 1
            elif obj_type == "LineObject":
                stats["line_objects"] += 1
            elif obj_type == "SolidObject":
                stats["solid_objects"] += 1

            if "children" in o:
                count_recursive(o["children"], depth + 1)

    count_recursive(root_objects)

    # Generate summary
    parts = []
    if stats["custom_objects"]:
        parts.append(f"{stats['custom_objects']} CustomObject(s)")
    if stats["line_objects"]:
        parts.append(f"{stats['line_objects']} LineObject(s)")
    if stats["solid_objects"]:
        parts.append(f"{stats['solid_objects']} SolidObject(s)")

    summary = f"Scene contains {stats['total_objects']} objects"
    if parts:
        summary += f": {', '.join(parts)}"
    if stats["max_depth"] > 0:
        summary += f" (max depth: {stats['max_depth']})"

    return {
        "objects": root_objects,
        "stats": stats,
        "summary": summary,
        "document_name": doc.GetDocumentName() or "Untitled"
    }
