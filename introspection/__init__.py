"""
DreamTalk Introspection Module

Provides semantic scene analysis for AI-assisted development and creative work.
This module understands DreamTalk object semantics and returns meaningful
descriptions rather than raw Cinema 4D data.

Usage:
    from DreamTalk.introspection import describe_hierarchy

    # Get structured description of current scene
    result = describe_hierarchy()

    # Format for AI consumption
    markdown = format_for_ai(result, "markdown")
"""

from .hierarchy import describe_hierarchy, describe_object
from .formatters import format_for_ai, format_markdown, format_json

__all__ = [
    "describe_hierarchy",
    "describe_object",
    "format_for_ai",
    "format_markdown",
    "format_json",
]
