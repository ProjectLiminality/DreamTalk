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
    describe_hierarchy,
    describe_object,
    inspect_object,
    inspect_materials,
    inspect_animation,
    validate_scene,
    find_object_by_name,
    # XPresso introspection
    inspect_xpresso,
    # Scene diffing
    get_scene_snapshot,
    diff_scene,
    reset_snapshot,
)
from .formatters import format_for_ai, format_markdown, format_json

__all__ = [
    # Hierarchy
    "describe_hierarchy",
    "describe_object",
    "find_object_by_name",
    # Deep inspection
    "inspect_object",
    "inspect_materials",
    "inspect_animation",
    "validate_scene",
    # XPresso
    "inspect_xpresso",
    # Scene diffing
    "get_scene_snapshot",
    "diff_scene",
    "reset_snapshot",
    # Formatters
    "format_for_ai",
    "format_markdown",
    "format_json",
]
