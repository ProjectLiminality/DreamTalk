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
