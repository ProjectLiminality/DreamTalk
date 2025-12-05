"""
DreamTalk Path Resolver

This module enables the holarchic submodule pattern for DreamTalk symbols.
It finds the nearest initialized DreamTalk library by walking up the directory
tree, ensuring all code in a symbol holarchy uses the same module instance.

Usage (at the top of any sovereign symbol's .py file):

    from dreamtalk_init import init
    init()

    from DreamTalk.imports import *
"""

import sys
from pathlib import Path

_initialized = False
_dreamtalk_path = None


def find_dreamtalk(start_path=None):
    """
    Walk up the directory tree to find an initialized DreamTalk submodule.

    An initialized DreamTalk is identified by the presence of imports.py
    (empty submodule pointers won't have this file).

    Args:
        start_path: Starting directory for search. Defaults to caller's location.

    Returns:
        Path to the submodules/ directory containing initialized DreamTalk.

    Raises:
        ImportError: If no initialized DreamTalk is found.
    """
    if start_path is None:
        # Get the caller's file location
        import inspect
        frame = inspect.currentframe()
        if frame and frame.f_back and frame.f_back.f_back:
            caller_file = frame.f_back.f_back.f_globals.get('__file__')
            if caller_file:
                start_path = Path(caller_file).parent
        if start_path is None:
            start_path = Path.cwd()

    current = Path(start_path).resolve()

    while current != current.parent:
        # Check for DreamTalk in submodules/
        candidate = current / "submodules" / "DreamTalk"
        if (candidate / "imports.py").exists():
            return current / "submodules"

        # Also check if we ARE in DreamTalk (for development/testing)
        if (current / "imports.py").exists() and current.name == "DreamTalk":
            return current.parent

        current = current.parent

    raise ImportError(
        "No initialized DreamTalk found in parent hierarchy.\n"
        "Ensure DreamTalk is added as a submodule and initialized:\n"
        "  git submodule add <dreamtalk-url> submodules/DreamTalk\n"
        "  git submodule update --init submodules/DreamTalk"
    )


def init(start_path=None):
    """
    Initialize the Python path to use the nearest DreamTalk.

    This should be called at the top of any sovereign symbol's Python file,
    before importing from DreamTalk.

    Args:
        start_path: Starting directory for search. Defaults to caller's location.

    Returns:
        Path to the DreamTalk directory that was added to sys.path.
    """
    global _initialized, _dreamtalk_path

    if _initialized:
        return _dreamtalk_path

    submodules_path = find_dreamtalk(start_path)

    # Add to sys.path if not already present
    submodules_str = str(submodules_path)
    if submodules_str not in sys.path:
        sys.path.insert(0, submodules_str)

    _dreamtalk_path = submodules_path / "DreamTalk"
    _initialized = True

    return _dreamtalk_path


def get_dreamtalk_path():
    """
    Get the path to the initialized DreamTalk, or None if not yet initialized.
    """
    return _dreamtalk_path


def is_initialized():
    """
    Check if DreamTalk path resolution has been performed.
    """
    return _initialized
