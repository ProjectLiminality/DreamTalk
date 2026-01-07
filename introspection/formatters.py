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
