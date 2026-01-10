"""
Output Formatters for AI Consumption

Transforms hierarchy descriptions into formats optimized for AI context windows.
"""

import json


def format_json(hierarchy_result):
    """
    Format hierarchy result as JSON string.

    Args:
        hierarchy_result: dict from describe_hierarchy()

    Returns:
        JSON string
    """
    return json.dumps(hierarchy_result, indent=2)


def format_markdown(hierarchy_result):
    """
    Format hierarchy result as markdown for AI context.

    Produces a tree-like structure that's easy to scan and understand.

    Args:
        hierarchy_result: dict from describe_hierarchy()

    Returns:
        Markdown string
    """
    lines = []

    # Header
    doc_name = hierarchy_result.get("document_name", "Untitled")
    lines.append(f"# Scene: {doc_name}")
    lines.append("")

    # Summary
    lines.append(f"**{hierarchy_result.get('summary', 'No objects')}**")
    lines.append("")

    # Object tree
    if hierarchy_result.get("objects"):
        lines.append("## Hierarchy")
        lines.append("")
        lines.append("```")

        for obj in hierarchy_result["objects"]:
            lines.extend(_format_object_tree(obj, prefix="", is_last=True))

        lines.append("```")
        lines.append("")

    # Stats
    stats = hierarchy_result.get("stats", {})
    if stats:
        lines.append("## Stats")
        lines.append("")
        lines.append(f"- Total objects: {stats.get('total_objects', 0)}")
        if stats.get("custom_objects"):
            lines.append(f"- CustomObjects: {stats['custom_objects']}")
        if stats.get("line_objects"):
            lines.append(f"- LineObjects: {stats['line_objects']}")
        if stats.get("solid_objects"):
            lines.append(f"- SolidObjects: {stats['solid_objects']}")
        lines.append(f"- Max depth: {stats.get('max_depth', 0)}")

    return "\n".join(lines)


def _format_object_tree(obj, prefix="", is_last=True):
    """
    Recursively format an object and its children as a tree.

    Args:
        obj: object description dict
        prefix: current line prefix for indentation
        is_last: whether this is the last sibling

    Returns:
        list of formatted lines
    """
    lines = []

    # Build the connector
    connector = "└── " if is_last else "├── "

    # Build object description line
    name = obj.get("name", "Unknown")
    obj_type = obj.get("type", "Unknown")

    # Start with name and type
    desc_parts = [f"{name} ({obj_type})"]

    # Add position if not at origin
    pos = obj.get("position", {})
    if pos.get("x", 0) != 0 or pos.get("y", 0) != 0 or pos.get("z", 0) != 0:
        desc_parts.append(f"@ ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})")

    # Add color
    if obj.get("color"):
        desc_parts.append(f"[{obj['color']}]")

    # Add creation progress
    if obj.get("creation") is not None:
        desc_parts.append(f"creation:{obj['creation']}%")

    # Add draw progress
    if obj.get("draw") is not None and obj.get("draw") != 100:
        desc_parts.append(f"draw:{obj['draw']}%")

    # Add scale if non-default
    if obj.get("scale") and obj["scale"] != 1:
        desc_parts.append(f"scale:{obj['scale']}")

    line = prefix + connector + " ".join(desc_parts)
    lines.append(line)

    # Process children
    children = obj.get("children", [])
    if children:
        # Update prefix for children
        child_prefix = prefix + ("    " if is_last else "│   ")

        for i, child in enumerate(children):
            child_is_last = (i == len(children) - 1)
            lines.extend(_format_object_tree(child, child_prefix, child_is_last))

    return lines


def format_for_ai(hierarchy_result, format_type="markdown"):
    """
    Format hierarchy result for AI consumption.

    Args:
        hierarchy_result: dict from describe_hierarchy()
        format_type: "markdown" or "json"

    Returns:
        Formatted string
    """
    if format_type == "json":
        return format_json(hierarchy_result)
    else:
        return format_markdown(hierarchy_result)


def format_compact(hierarchy_result):
    """
    Format as a compact single-line summary.

    Useful for quick status checks.

    Args:
        hierarchy_result: dict from describe_hierarchy()

    Returns:
        Single line summary string
    """
    stats = hierarchy_result.get("stats", {})
    doc_name = hierarchy_result.get("document_name", "Untitled")

    parts = [f"Scene: {doc_name}"]
    parts.append(f"{stats.get('total_objects', 0)} objects")

    type_counts = []
    if stats.get("custom_objects"):
        type_counts.append(f"{stats['custom_objects']}C")
    if stats.get("line_objects"):
        type_counts.append(f"{stats['line_objects']}L")
    if stats.get("solid_objects"):
        type_counts.append(f"{stats['solid_objects']}S")

    if type_counts:
        parts.append(f"({'/'.join(type_counts)})")

    return " | ".join(parts)


def format_inspect_object(result):
    """
    Format inspect_object result as markdown.

    Args:
        result: dict from inspect_object()

    Returns:
        Markdown string
    """
    if "error" in result:
        return f"**Error:** {result['error']}"

    lines = []
    lines.append(f"# Object: {result['name']}")
    lines.append("")
    lines.append(f"**Type:** {result['type']} ({result.get('c4d_type', 'Unknown')})")
    lines.append("")

    # Transform
    t = result.get("transform", {})
    pos = t.get("position", {})
    rot = t.get("rotation", {})
    scale = t.get("scale", {})
    lines.append("## Transform")
    lines.append(f"- Position: ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})")
    lines.append(f"- Rotation: ({rot.get('h', 0)}°, {rot.get('p', 0)}°, {rot.get('b', 0)}°)")
    lines.append(f"- Scale: ({scale.get('x', 1)}, {scale.get('y', 1)}, {scale.get('z', 1)})")
    lines.append("")

    # Hierarchy
    if result.get("parent") or result.get("children"):
        lines.append("## Hierarchy")
        if result.get("parent"):
            lines.append(f"- Parent: {result['parent']}")
        if result.get("children"):
            lines.append(f"- Children: {', '.join(result['children'])}")
        lines.append("")

    # Color
    if result.get("color"):
        c = result["color"]
        lines.append("## Color")
        lines.append(f"- Name: {c.get('name', 'Unknown')}")
        rgb = c.get("rgb", {})
        lines.append(f"- RGB: ({rgb.get('r', 0)}, {rgb.get('g', 0)}, {rgb.get('b', 0)})")
        lines.append("")

    # Userdata
    if result.get("userdata"):
        lines.append("## Parameters")
        for group, params in result["userdata"].items():
            lines.append(f"### {group}")
            for name, value in params.items():
                if isinstance(value, dict):
                    value = f"({value.get('x', 0)}, {value.get('y', 0)}, {value.get('z', 0)})"
                elif isinstance(value, float):
                    value = round(value, 3)
                lines.append(f"- {name}: {value}")
        lines.append("")

    # Tags
    if result.get("tags"):
        lines.append("## Tags")
        for tag in result["tags"]:
            tag_line = f"- {tag['type']}"
            if tag.get("material"):
                tag_line += f" → {tag['material']}"
            lines.append(tag_line)
        lines.append("")

    # Bounding box
    if result.get("bounding_box"):
        bb = result["bounding_box"]
        lines.append("## Bounding Box")
        lines.append(f"- Size: {bb.get('width', 0)} × {bb.get('height', 0)} × {bb.get('depth', 0)}")

    return "\n".join(lines)


def format_inspect_materials(result):
    """
    Format inspect_materials result as markdown.

    Args:
        result: dict from inspect_materials()

    Returns:
        Markdown string
    """
    lines = []
    lines.append(f"# Materials ({result.get('count', 0)})")
    lines.append("")
    lines.append(f"**{result.get('summary', 'No materials')}**")
    lines.append("")

    for mat in result.get("materials", []):
        lines.append(f"## {mat['name']}")
        lines.append(f"- Type: {mat.get('type', 'Unknown')}")

        if mat.get("color"):
            c = mat["color"]
            lines.append(f"- Color: {c.get('name', 'Unknown')}")

        if mat.get("has_transparency"):
            lines.append("- Has transparency")
        if mat.get("has_luminance"):
            lines.append("- Has luminance/glow")

        if mat.get("used_by"):
            lines.append(f"- Used by: {', '.join(mat['used_by'])}")
        else:
            lines.append("- **Not used**")

        lines.append("")

    return "\n".join(lines)


def format_inspect_animation(result):
    """
    Format inspect_animation result as markdown.

    Args:
        result: dict from inspect_animation()

    Returns:
        Markdown string
    """
    lines = []
    fr = result.get("frame_range", {})
    lines.append(f"# Animation: Frames {fr.get('start', 0)} - {fr.get('end', 0)}")
    lines.append("")
    lines.append(f"**{result.get('summary', 'No animation')}**")
    lines.append("")
    lines.append(f"- FPS: {result.get('fps', 30)}")
    lines.append(f"- Duration: {result.get('duration_seconds', 0)}s")
    lines.append("")

    for obj in result.get("animated_objects", []):
        lines.append(f"## {obj['name']} ({obj.get('type', 'Unknown')})")
        for track in obj.get("tracks", []):
            param = track.get("parameter", "Unknown")
            keyframes = track.get("keyframes", [])
            if keyframes:
                kf_summary = ", ".join([f"f{kf['frame']}={kf['value']}" for kf in keyframes[:5]])
                if len(keyframes) > 5:
                    kf_summary += f" ... (+{len(keyframes) - 5} more)"
                lines.append(f"- {param}: {kf_summary}")
        lines.append("")

    return "\n".join(lines)


def format_validate_scene(result):
    """
    Format validate_scene result as markdown.

    Args:
        result: dict from validate_scene()

    Returns:
        Markdown string
    """
    lines = []
    status = "✅ PASSED" if result.get("valid") else "❌ FAILED"
    lines.append(f"# Scene Validation: {status}")
    lines.append("")
    lines.append(f"**{result.get('summary', 'No validation')}**")
    lines.append("")

    if result.get("issues"):
        lines.append("## Issues (must fix)")
        for issue in result["issues"]:
            lines.append(f"- ❌ {issue}")
        lines.append("")

    if result.get("warnings"):
        lines.append("## Warnings")
        for warning in result["warnings"]:
            lines.append(f"- ⚠️ {warning}")
        lines.append("")

    if result.get("info"):
        lines.append("## Info")
        for info in result["info"]:
            lines.append(f"- ℹ️ {info}")
        lines.append("")

    stats = result.get("stats", {})
    if stats:
        lines.append("## Stats")
        lines.append(f"- Materials: {stats.get('material_count', 0)}")
        if stats.get("unused_materials"):
            lines.append(f"- Unused materials: {stats['unused_materials']}")

    return "\n".join(lines)


def format_describe_scene(result):
    """
    Format describe_scene result as markdown.

    Universal formatter for the consolidated introspection tool.

    Args:
        result: dict from describe_scene()

    Returns:
        Markdown string
    """
    lines = []

    # Header with scene name and frame info
    doc_name = result.get("document_name", "Untitled")
    frame = result.get("frame", {})
    lines.append(f"# Scene: {doc_name}")
    lines.append(f"Frame {frame.get('current', 0)}/{frame.get('end', 0)} @ {frame.get('fps', 30)}fps")
    lines.append("")

    # Changes section (most important - at top)
    changes = result.get("changes")
    if changes:
        lines.append("## Changes Detected")
        lines.append("")
        _format_changes(changes, lines)
        lines.append("")
    elif result.get("changes") is None:
        lines.append("*First inspection - baseline captured for change detection*")
        lines.append("")

    # Hierarchy
    hierarchy = result.get("hierarchy", {})
    if hierarchy.get("objects"):
        lines.append("## Hierarchy")
        lines.append(f"*{hierarchy.get('summary', '')}*")
        lines.append("")
        for obj in hierarchy["objects"]:
            _format_object_compact(obj, lines, indent=0)
        lines.append("")

    # Materials (compact)
    materials = result.get("materials", {})
    mat_list = materials.get("materials", [])
    if mat_list:
        lines.append(f"## Materials ({len(mat_list)})")
        for mat in mat_list:
            mat_line = f"- **{mat['name']}**"
            if mat.get("color"):
                mat_line += f" [{mat['color'].get('name', '')}]"
            if mat.get("used_by"):
                mat_line += f" → {', '.join(mat['used_by'])}"
            else:
                mat_line += " (unused)"
            lines.append(mat_line)
        lines.append("")

    # Animation (compact)
    animation = result.get("animation", {})
    animated = animation.get("animated_objects", [])
    if animated:
        lines.append(f"## Animation")
        lines.append(f"*{animation.get('summary', '')}*")
        for obj in animated:
            tracks_summary = ", ".join([t.get("parameter", "?") for t in obj.get("tracks", [])])
            lines.append(f"- {obj['name']}: {tracks_summary}")
        lines.append("")

    # Validation warnings (compact)
    validation = result.get("validation", {})
    warnings = validation.get("warnings", [])
    issues = validation.get("issues", [])
    if warnings or issues:
        lines.append("## Validation")
        for issue in issues:
            lines.append(f"- ❌ {issue}")
        for warning in warnings:
            lines.append(f"- ⚠️ {warning}")
        lines.append("")

    return "\n".join(lines)


def _format_changes(changes_result, lines):
    """Format change detection results.

    Handles both DreamTalk param changes and native C4D param changes.
    Native changes include the DescID for direct use in code.
    """
    changes = changes_result.get("changes", {})

    # Object changes
    obj_changes = changes.get("objects", {})

    # DreamTalk param changes (userdata, transforms, etc.)
    if obj_changes.get("dreamtalk_modified"):
        for obj_name, params in obj_changes["dreamtalk_modified"].items():
            for param, vals in params.items():
                old_val = vals.get('old')
                new_val = vals.get('new')
                # Format values nicely
                if isinstance(old_val, float):
                    old_val = round(old_val, 3)
                if isinstance(new_val, float):
                    new_val = round(new_val, 3)
                lines.append(f"- **{obj_name}**.{param}: `{old_val}` → `{new_val}`")

    # Native C4D param changes (only shown when changed)
    if obj_changes.get("native_modified"):
        for obj_name, params in obj_changes["native_modified"].items():
            for desc_id_str, vals in params.items():
                old_val = vals.get('old')
                new_val = vals.get('new')
                param_name = vals.get('name', '')
                ident = vals.get('ident', '')
                old_label = vals.get('old_label')
                new_label = vals.get('new_label')

                # Format values nicely
                if isinstance(old_val, float):
                    old_val = round(old_val, 3)
                if isinstance(new_val, float):
                    new_val = round(new_val, 3)

                # Build the change description
                # If we have labels (dropdown/enum), show "Label (value)"
                if old_label and new_label:
                    old_display = f"{old_label} ({old_val})"
                    new_display = f"{new_label} ({new_val})"
                else:
                    old_display = str(old_val)
                    new_display = str(new_val)

                # Build parameter identifier: "Name" or "Name (ID_CONSTANT)"
                if param_name and ident:
                    param_display = f"{param_name} ({ident})"
                elif param_name:
                    param_display = param_name
                elif ident:
                    param_display = ident
                else:
                    param_display = f"DescID {desc_id_str}"

                lines.append(f"- **{obj_name}**.{param_display}: `{old_display}` → `{new_display}`")

    # Added/removed objects
    if obj_changes.get("added"):
        for name in obj_changes["added"]:
            lines.append(f"- **+ Added**: {name}")

    if obj_changes.get("removed"):
        for name in obj_changes["removed"]:
            lines.append(f"- **- Removed**: {name}")

    # Material changes
    mat_changes = changes.get("materials", {})
    if mat_changes.get("modified"):
        for mat_name, params in mat_changes["modified"].items():
            for param, vals in params.items():
                lines.append(f"- Material **{mat_name}**.{param}: `{vals.get('old')}` → `{vals.get('new')}`")

    if mat_changes.get("added"):
        for name in mat_changes["added"]:
            lines.append(f"- **+ Added Material**: {name}")

    if mat_changes.get("removed"):
        for name in mat_changes["removed"]:
            lines.append(f"- **- Removed Material**: {name}")


def _format_object_compact(obj, lines, indent=0):
    """Format a single object compactly with its key parameters."""
    prefix = "  " * indent

    # Build object line
    name = obj.get("name", "Unknown")
    obj_type = obj.get("type", "Unknown")

    parts = [f"{name} ({obj_type})"]

    # Position (only if non-zero)
    pos = obj.get("position", {})
    if pos.get("x", 0) != 0 or pos.get("y", 0) != 0 or pos.get("z", 0) != 0:
        parts.append(f"@ ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})")

    # Key DreamTalk params
    if obj.get("creation") is not None:
        parts.append(f"creation:{obj['creation']}%")
    if obj.get("draw") is not None and obj.get("draw") != 100:
        parts.append(f"draw:{obj['draw']}%")
    if obj.get("color"):
        parts.append(f"[{obj['color']}]")

    lines.append(f"{prefix}- {' '.join(parts)}")

    # Recurse children
    for child in obj.get("children", []):
        _format_object_compact(child, lines, indent + 1)
