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


def find_object_by_name(name, doc=None):
    """
    Find an object by name in the document.

    Args:
        name: Object name to find
        doc: Cinema 4D document (defaults to active document)

    Returns:
        c4d.BaseObject or None
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    def search_recursive(obj):
        while obj:
            if obj.GetName() == name:
                return obj
            found = search_recursive(obj.GetDown())
            if found:
                return found
            obj = obj.GetNext()
        return None

    return search_recursive(doc.GetFirstObject())


def get_all_userdata(obj):
    """
    Get all userdata parameters on an object.

    Returns:
        dict mapping group_name -> {param_name: value}
    """
    ud = obj.GetUserDataContainer()
    if not ud:
        return {}

    result = {}
    current_group = "Ungrouped"

    for desc_id, bc in ud:
        name = bc.GetString(c4d.DESC_NAME)
        dtype = desc_id[1].dtype if len(desc_id) > 1 else 0

        if dtype == 1:  # Group
            current_group = name or "Unnamed Group"
            if current_group not in result:
                result[current_group] = {}
        else:
            # Parameter
            try:
                value = obj[desc_id]
                # Convert c4d types to Python types
                if isinstance(value, c4d.Vector):
                    value = {"x": value.x, "y": value.y, "z": value.z}
                elif hasattr(value, '__float__'):
                    value = float(value)

                if current_group not in result:
                    result[current_group] = {}
                result[current_group][name] = value
            except:
                pass

    return result


def get_object_tags(obj):
    """
    Get all tags on an object with their types.

    Returns:
        list of {name, type, details}
    """
    tags = []
    for tag in obj.GetTags():
        tag_info = {
            "name": tag.GetName(),
            "type": tag.GetTypeName(),
        }

        # Extract specific tag info
        tag_type = tag.GetType()
        if tag_type == c4d.Ttexture:
            mat = tag.GetMaterial()
            if mat:
                tag_info["material"] = mat.GetName()

        tags.append(tag_info)

    return tags


def inspect_object(name, doc=None):
    """
    Deep inspection of a single object by name.

    Args:
        name: Object name to inspect
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with detailed object information
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    obj = find_object_by_name(name, doc)
    if obj is None:
        return {"error": f"Object '{name}' not found"}

    pos = obj.GetAbsPos()
    rot = obj.GetAbsRot()
    scale = obj.GetAbsScale()

    import math

    result = {
        "name": obj.GetName(),
        "type": detect_dreamtalk_class(obj),
        "c4d_type": obj.GetTypeName(),
        "transform": {
            "position": {"x": round(pos.x, 2), "y": round(pos.y, 2), "z": round(pos.z, 2)},
            "rotation": {"h": round(math.degrees(rot.x), 2), "p": round(math.degrees(rot.y), 2), "b": round(math.degrees(rot.z), 2)},
            "scale": {"x": round(scale.x, 3), "y": round(scale.y, 3), "z": round(scale.z, 3)},
        },
        "userdata": get_all_userdata(obj),
        "tags": get_object_tags(obj),
    }

    # Parent info
    parent = obj.GetUp()
    if parent:
        result["parent"] = parent.GetName()

    # Children
    children = []
    child = obj.GetDown()
    while child:
        children.append(child.GetName())
        child = child.GetNext()
    if children:
        result["children"] = children

    # Color
    color = get_color_from_object(obj)
    if color:
        result["color"] = {
            "rgb": {"r": round(color[0], 3), "g": round(color[1], 3), "b": round(color[2], 3)},
            "name": color_to_name(color)
        }

    # Bounding box
    bbox = obj.GetRad()
    if bbox:
        result["bounding_box"] = {
            "width": round(bbox.x * 2, 2),
            "height": round(bbox.y * 2, 2),
            "depth": round(bbox.z * 2, 2)
        }

    return result


def inspect_materials(doc=None):
    """
    Describe all materials in the scene.

    Args:
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with material descriptions and usage
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    materials = []
    mat = doc.GetFirstMaterial()

    while mat:
        mat_info = {
            "name": mat.GetName(),
            "type": mat.GetTypeName(),
        }

        # Try to get color
        try:
            if mat[c4d.MATERIAL_USE_COLOR]:
                color = mat[c4d.MATERIAL_COLOR_COLOR]
                mat_info["color"] = {
                    "rgb": {"r": round(color.x, 3), "g": round(color.y, 3), "b": round(color.z, 3)},
                    "name": color_to_name((color.x, color.y, color.z))
                }
        except:
            pass

        # Try to get transparency
        try:
            if mat[c4d.MATERIAL_USE_TRANSPARENCY]:
                mat_info["has_transparency"] = True
        except:
            pass

        # Try to get luminance/glow
        try:
            if mat[c4d.MATERIAL_USE_LUMINANCE]:
                mat_info["has_luminance"] = True
        except:
            pass

        # Find objects using this material
        used_by = []

        def find_usage(obj):
            while obj:
                for tag in obj.GetTags():
                    if tag.GetType() == c4d.Ttexture:
                        tag_mat = tag.GetMaterial()
                        if tag_mat and tag_mat.GetName() == mat.GetName():
                            used_by.append(obj.GetName())
                find_usage(obj.GetDown())
                obj = obj.GetNext()

        find_usage(doc.GetFirstObject())
        if used_by:
            mat_info["used_by"] = used_by

        materials.append(mat_info)
        mat = mat.GetNext()

    return {
        "materials": materials,
        "count": len(materials),
        "summary": f"Scene has {len(materials)} material(s)"
    }


def inspect_animation(start_frame=None, end_frame=None, doc=None):
    """
    Describe what happens in the animation between frames.

    Args:
        start_frame: Start frame (defaults to document start)
        end_frame: End frame (defaults to document end)
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with animation description
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    fps = doc.GetFps()
    doc_start = doc.GetMinTime().GetFrame(fps)
    doc_end = doc.GetMaxTime().GetFrame(fps)

    if start_frame is None:
        start_frame = doc_start
    if end_frame is None:
        end_frame = doc_end

    # Collect all animated objects and their keyframes
    animated_objects = []

    def find_animated(obj):
        while obj:
            tracks = obj.GetCTracks()
            if tracks:
                obj_info = {
                    "name": obj.GetName(),
                    "type": detect_dreamtalk_class(obj),
                    "tracks": []
                }

                for track in tracks:
                    desc_id = track.GetDescriptionID()
                    curve = track.GetCurve()
                    if curve:
                        keyframes = []
                        for i in range(curve.GetKeyCount()):
                            key = curve.GetKey(i)
                            frame = key.GetTime().GetFrame(fps)
                            if start_frame <= frame <= end_frame:
                                keyframes.append({
                                    "frame": frame,
                                    "value": round(key.GetValue(), 3)
                                })

                        if keyframes:
                            # Try to get parameter name
                            param_name = "Unknown"
                            try:
                                # Check common DreamTalk parameters
                                ud = obj.GetUserDataContainer()
                                if ud:
                                    for ud_id, bc in ud:
                                        if ud_id == desc_id:
                                            param_name = bc.GetString(c4d.DESC_NAME)
                                            break
                            except:
                                pass

                            obj_info["tracks"].append({
                                "parameter": param_name,
                                "keyframes": keyframes
                            })

                if obj_info["tracks"]:
                    animated_objects.append(obj_info)

            find_animated(obj.GetDown())
            obj = obj.GetNext()

    find_animated(doc.GetFirstObject())

    # Generate summary
    total_keyframes = sum(
        len(track["keyframes"])
        for obj in animated_objects
        for track in obj["tracks"]
    )

    return {
        "frame_range": {"start": start_frame, "end": end_frame},
        "fps": fps,
        "duration_seconds": round((end_frame - start_frame) / fps, 2),
        "animated_objects": animated_objects,
        "stats": {
            "animated_object_count": len(animated_objects),
            "total_keyframes": total_keyframes
        },
        "summary": f"Animation from frame {start_frame} to {end_frame} ({round((end_frame - start_frame) / fps, 2)}s): {len(animated_objects)} animated object(s), {total_keyframes} keyframe(s)"
    }


def validate_scene(doc=None):
    """
    Run sanity checks on the scene before rendering.

    Args:
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with validation results and any issues found
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    issues = []
    warnings = []
    info = []

    # Check for objects at origin that shouldn't be
    origin_objects = []

    def check_objects(obj, depth=0):
        while obj:
            pos = obj.GetAbsPos()
            name = obj.GetName()
            obj_type = detect_dreamtalk_class(obj)

            # Check for objects stuck at origin (except root CustomObjects)
            if depth > 0 and obj_type != "Camera":
                if pos.x == 0 and pos.y == 0 and pos.z == 0:
                    # Only flag if it has siblings at different positions
                    sibling = obj.GetNext() or obj.GetPred()
                    if sibling:
                        sib_pos = sibling.GetAbsPos()
                        if sib_pos.x != 0 or sib_pos.y != 0 or sib_pos.z != 0:
                            origin_objects.append(name)

            # Check for missing materials on visible objects
            if obj_type in ("LineObject", "SolidObject"):
                has_material = False
                for tag in obj.GetTags():
                    if tag.GetType() == c4d.Ttexture:
                        has_material = True
                        break
                if not has_material:
                    warnings.append(f"'{name}' ({obj_type}) has no material assigned")

            # Check for 0 creation on DreamTalk objects
            creation = get_userdata_value(obj, "Actions", "Creation")
            if creation is not None and creation == 0:
                info.append(f"'{name}' has creation at 0% (not animated yet)")

            check_objects(obj.GetDown(), depth + 1)
            obj = obj.GetNext()

    check_objects(doc.GetFirstObject())

    # Check materials
    mat = doc.GetFirstMaterial()
    material_count = 0
    unused_materials = []

    while mat:
        material_count += 1
        mat_name = mat.GetName()

        # Check if material is used
        is_used = False

        def check_usage(obj):
            nonlocal is_used
            while obj and not is_used:
                for tag in obj.GetTags():
                    if tag.GetType() == c4d.Ttexture:
                        tag_mat = tag.GetMaterial()
                        if tag_mat and tag_mat.GetName() == mat_name:
                            is_used = True
                            return
                check_usage(obj.GetDown())
                obj = obj.GetNext()

        check_usage(doc.GetFirstObject())
        if not is_used:
            unused_materials.append(mat_name)

        mat = mat.GetNext()

    if unused_materials:
        warnings.append(f"Unused materials: {', '.join(unused_materials)}")

    # Check render settings
    rd = doc.GetActiveRenderData()
    if rd:
        fps = rd[c4d.RDATA_FRAMERATE]
        width = rd[c4d.RDATA_XRES]
        height = rd[c4d.RDATA_YRES]
        info.append(f"Render settings: {int(width)}x{int(height)} @ {int(fps)}fps")

    # Check for camera
    has_camera = False

    def find_camera(obj):
        nonlocal has_camera
        while obj:
            if obj.GetType() == _get_c4d_type('Ocamera'):
                has_camera = True
                return
            find_camera(obj.GetDown())
            obj = obj.GetNext()

    find_camera(doc.GetFirstObject())
    if not has_camera:
        warnings.append("No camera in scene")

    # Build result
    is_valid = len(issues) == 0

    return {
        "valid": is_valid,
        "issues": issues,
        "warnings": warnings,
        "info": info,
        "stats": {
            "material_count": material_count,
            "unused_materials": len(unused_materials),
        },
        "summary": f"Scene validation: {'PASSED' if is_valid else 'FAILED'} - {len(issues)} issue(s), {len(warnings)} warning(s)"
    }


def inspect_xpresso(obj):
    """
    Deep inspection of XPresso tags on an object.

    Reveals how userdata parameters connect to object properties through XPresso.
    This is critical for understanding DreamTalk's abstraction layer where
    Creation -> XPresso -> Fill/Draw -> Material visibility.

    Args:
        obj: Cinema 4D BaseObject (or object name string)

    Returns:
        dict with XPresso structure including groups, nodes, and connections
    """
    if isinstance(obj, str):
        doc = c4d.documents.GetActiveDocument()
        obj = find_object_by_name(obj, doc)
        if obj is None:
            return {"error": f"Object not found"}

    result = {
        "object": obj.GetName(),
        "xpresso_tags": []
    }

    for tag in obj.GetTags():
        if tag.GetType() != c4d.Texpresso:
            continue

        tag_info = {
            "name": tag.GetName(),
            "groups": []
        }

        node_master = tag.GetNodeMaster()
        if not node_master:
            continue

        root = node_master.GetRoot()
        if not root:
            continue

        def traverse_nodes(node, group_info=None):
            """Traverse XPresso nodes and extract their structure."""
            nodes_list = []

            while node:
                node_name = node.GetName()
                op_id = node.GetOperatorID()

                node_info = {
                    "name": node_name,
                    "operator_id": op_id,
                    "inputs": [],
                    "outputs": []
                }

                # Get input ports
                for port in node.GetInPorts():
                    port_name = port.GetName(node)
                    node_info["inputs"].append(port_name)

                # Get output ports
                for port in node.GetOutPorts():
                    port_name = port.GetName(node)
                    node_info["outputs"].append(port_name)

                # Check if this is a group (contains children)
                child = node.GetDown()
                if child:
                    # This is a group node - extract its children
                    if op_id == 1001144:  # XGroup
                        group_data = {
                            "name": node_name,
                            "nodes": traverse_nodes(child)
                        }
                        if group_info is not None:
                            group_info.append(group_data)
                        else:
                            tag_info["groups"].append(group_data)
                    else:
                        node_info["children"] = traverse_nodes(child)
                        nodes_list.append(node_info)
                else:
                    nodes_list.append(node_info)

                node = node.GetNext()

            return nodes_list

        # Start traversal from root's children
        first_node = root.GetDown()
        if first_node:
            traverse_nodes(first_node, tag_info["groups"])

        result["xpresso_tags"].append(tag_info)

    return result


def get_scene_snapshot(doc=None):
    """
    Create a snapshot of scene state including transforms, userdata, and materials.

    Used for scene diffing - compare before and after states.
    Captures:
    - Object transforms (position, rotation, scale)
    - Userdata parameters
    - Sketch & Toon material properties

    Args:
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with 'objects' and 'materials' snapshots
    """
    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    snapshot = {"objects": {}, "materials": {}}

    def capture_object(obj):
        while obj:
            obj_name = obj.GetName()
            flat_data = {}

            # Capture transform
            pos = obj.GetAbsPos()
            rot = obj.GetAbsRot()
            scale = obj.GetAbsScale()

            flat_data["transform.x"] = round(pos.x, 2)
            flat_data["transform.y"] = round(pos.y, 2)
            flat_data["transform.z"] = round(pos.z, 2)

            # Only include rotation if non-zero
            import math
            if abs(rot.x) > 0.001 or abs(rot.y) > 0.001 or abs(rot.z) > 0.001:
                flat_data["transform.h"] = round(math.degrees(rot.x), 2)
                flat_data["transform.p"] = round(math.degrees(rot.y), 2)
                flat_data["transform.b"] = round(math.degrees(rot.z), 2)

            # Only include scale if non-uniform
            if abs(scale.x - 1) > 0.001 or abs(scale.y - 1) > 0.001 or abs(scale.z - 1) > 0.001:
                flat_data["transform.scale_x"] = round(scale.x, 3)
                flat_data["transform.scale_y"] = round(scale.y, 3)
                flat_data["transform.scale_z"] = round(scale.z, 3)

            # Capture userdata
            userdata = get_all_userdata(obj)
            for group_name, params in userdata.items():
                for param_name, value in params.items():
                    key = f"userdata.{group_name}.{param_name}"
                    # Convert complex types to comparable values
                    if isinstance(value, dict):
                        if 'x' in value and 'y' in value and 'z' in value:
                            value = (value['x'], value['y'], value['z'])
                    if isinstance(value, float):
                        value = round(value, 4)
                    flat_data[key] = value

            snapshot["objects"][obj_name] = flat_data

            # Recurse
            capture_object(obj.GetDown())
            obj = obj.GetNext()

    capture_object(doc.GetFirstObject())

    # Capture materials (especially Sketch & Toon)
    mat = doc.GetFirstMaterial()
    while mat:
        mat_name = mat.GetName()
        mat_type = mat.GetType()
        mat_data = {"type": mat.GetTypeName()}

        # Sketch & Toon material (Msketch = 1011014)
        if mat_type == _get_c4d_type('Msketch'):
            try:
                mat_data["thickness"] = round(mat[c4d.OUTLINEMAT_THICKNESS], 2)
            except: pass
            try:
                mat_data["line_contour"] = bool(mat[c4d.OUTLINEMAT_LINE_CONTOUR])
            except: pass
            try:
                mat_data["contour_mode"] = mat[c4d.OUTLINEMAT_LINE_CONTOUR_MODE]
            except: pass
            try:
                mat_data["contour_spacing_type"] = mat[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION_SPACING]
            except: pass
            try:
                mat_data["contour_spacing"] = round(mat[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION_SPACE], 2)
            except: pass
            try:
                mat_data["contour_steps"] = mat[c4d.OUTLINEMAT_LINE_CONTOUR_POSITION_STEPS]
            except: pass
            try:
                # Contour position mode (Object X/Y/Z, World X/Y/Z, View X/Y/Z)
                mat_data["contour_object_x"] = bool(mat[c4d.OUTLINEMAT_LINE_CONTOUR_OBJECT_X])
                mat_data["contour_object_y"] = bool(mat[c4d.OUTLINEMAT_LINE_CONTOUR_OBJECT_Y])
                mat_data["contour_object_z"] = bool(mat[c4d.OUTLINEMAT_LINE_CONTOUR_OBJECT_Z])
            except: pass

        snapshot["materials"][mat_name] = mat_data
        mat = mat.GetNext()

    return snapshot


# Module-level storage for scene snapshots
_last_snapshot = None


def diff_scene(doc=None):
    """
    Compare current scene state to last snapshot and show changes.

    Call this after making manual changes in C4D to see what was modified.
    Automatically stores current state for next diff.

    Detects changes to:
    - Object transforms (position, rotation, scale)
    - Userdata parameters
    - Material properties (especially Sketch & Toon)

    Args:
        doc: Cinema 4D document (defaults to active document)

    Returns:
        dict with changes grouped by category (objects, materials)
    """
    global _last_snapshot

    if doc is None:
        doc = c4d.documents.GetActiveDocument()

    current = get_scene_snapshot(doc)

    if _last_snapshot is None:
        _last_snapshot = current
        return {
            "status": "first_snapshot",
            "message": "Initial snapshot captured. Make changes and call diff_scene() again.",
            "objects_tracked": len(current["objects"]),
            "materials_tracked": len(current["materials"])
        }

    changes = {
        "objects": {"modified": {}, "added": {}, "removed": {}},
        "materials": {"modified": {}, "added": {}, "removed": {}}
    }

    def diff_dict(current_dict, old_dict, changes_dict):
        """Compare two dictionaries and populate changes."""
        # Find modifications and additions
        for name, params in current_dict.items():
            if name not in old_dict:
                changes_dict["added"][name] = params
            else:
                old_params = old_dict[name]
                item_changes = {}

                for param, value in params.items():
                    if param not in old_params:
                        item_changes[param] = {"new": value, "old": None}
                    elif old_params[param] != value:
                        item_changes[param] = {"old": old_params[param], "new": value}

                if item_changes:
                    changes_dict["modified"][name] = item_changes

        # Find removals
        for name in old_dict:
            if name not in current_dict:
                changes_dict["removed"][name] = old_dict[name]

    # Diff objects and materials
    diff_dict(current["objects"], _last_snapshot["objects"], changes["objects"])
    diff_dict(current["materials"], _last_snapshot["materials"], changes["materials"])

    # Update snapshot for next diff
    _last_snapshot = current

    # Build summary
    summary_parts = []

    # Object changes
    obj_changes = changes["objects"]
    if obj_changes["modified"]:
        for obj, params in obj_changes["modified"].items():
            for param, vals in params.items():
                summary_parts.append(f"{obj}.{param}: {vals['old']} → {vals['new']}")
    if obj_changes["added"]:
        summary_parts.append(f"Added objects: {', '.join(obj_changes['added'].keys())}")
    if obj_changes["removed"]:
        summary_parts.append(f"Removed objects: {', '.join(obj_changes['removed'].keys())}")

    # Material changes
    mat_changes = changes["materials"]
    if mat_changes["modified"]:
        for mat, params in mat_changes["modified"].items():
            for param, vals in params.items():
                summary_parts.append(f"Material {mat}.{param}: {vals['old']} → {vals['new']}")
    if mat_changes["added"]:
        summary_parts.append(f"Added materials: {', '.join(mat_changes['added'].keys())}")
    if mat_changes["removed"]:
        summary_parts.append(f"Removed materials: {', '.join(mat_changes['removed'].keys())}")

    total_changes = (
        len(obj_changes["modified"]) + len(obj_changes["added"]) + len(obj_changes["removed"]) +
        len(mat_changes["modified"]) + len(mat_changes["added"]) + len(mat_changes["removed"])
    )

    return {
        "changes": changes,
        "total_changes": total_changes,
        "summary": "; ".join(summary_parts) if summary_parts else "No changes detected"
    }


def reset_snapshot():
    """Reset the scene snapshot to force a fresh capture on next diff."""
    global _last_snapshot
    _last_snapshot = None
    return {"status": "reset", "message": "Snapshot cleared"}
