"""
DreamTalk Introspection Module

Provides semantic scene analysis for AI-assisted development and creative work.
This module understands DreamTalk object semantics and returns meaningful
descriptions rather than raw Cinema 4D data.

Usage:
    from DreamTalk.introspection import describe_hierarchy, inspect_object

    # Get structured description of current scene
    result = describe_hierarchy()

    # Deep dive into a single object
    obj_info = inspect_object("Campfire")

    # Check materials
    materials = inspect_materials()

    # Analyze animation
    animation = inspect_animation(start_frame=0, end_frame=90)

    # Validate before render
    validation = validate_scene()

    # Format for AI consumption
    markdown = format_for_ai(result, "markdown")
"""

from .hierarchy import (
    # Universal introspection (primary tool)
    describe_scene,
    # Legacy/internal functions (still available if needed)
    describe_hierarchy,
    describe_object,
    inspect_object,
    inspect_materials,
    inspect_animation,
    validate_scene,
    find_object_by_name,
    # XPresso introspection
    inspect_xpresso,
    # Scene diffing (now integrated into describe_scene)
    get_scene_snapshot,
    diff_scene,
    reset_snapshot,
    # Console log tracking (for describe_scene delta)
    add_console_message,
    get_console_delta,
    reset_console_log,
)
from .formatters import format_for_ai, format_markdown, format_json, format_describe_scene

__all__ = [
    # Universal introspection (primary)
    "describe_scene",
    # Legacy/internal (still available)
    "describe_hierarchy",
    "describe_object",
    "find_object_by_name",
    "inspect_object",
    "inspect_materials",
    "inspect_animation",
    "validate_scene",
    "inspect_xpresso",
    "get_scene_snapshot",
    "diff_scene",
    "reset_snapshot",
    # Console log tracking
    "add_console_message",
    "get_console_delta",
    "reset_console_log",
    # Formatters
    "format_for_ai",
    "format_markdown",
    "format_json",
    "format_describe_scene",
]
