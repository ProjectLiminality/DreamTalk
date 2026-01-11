"""
DreamTalk Canonical Imports

This module provides the clean, philosophical import syntax for DreamTalk.
It's the recommended way to import DreamTalk for new projects.

Usage:
    from DreamTalk.dreamtalk import *

Or selectively:
    from DreamTalk.dreamtalk import Holon, Dream, Length, Bipolar, State

The canonical names reflect holonic philosophy:
- Holon: A whole that is also a part (composite objects)
- Dream: A scene/animation (the composition space)
- Observer: The camera/viewpoint
- State: A discrete configuration for agentic holons

Parameter types map to C4D UserData:
- Length: Distance/size (0 to infinity)
- Angle: Rotation (0 to 2pi)
- Bipolar: Signed normalized (-1 to 1)
- Completion: Progress/opacity (0 to 1)
- Color: RGB color
- Integer: Whole number
- Bool: Boolean flag
"""

# Note: Module reloading is handled by run_dreamtalk() which clears the scene
# and provides fresh imports. No explicit reloads needed here - they cause
# circular import issues due to Cinema 4D's module caching behavior.


# =============================================================================
# Core Classes - The holonic building blocks
# =============================================================================

# Holon: A composite object - a whole that is also a part
from DreamTalk.objects.abstract_objects import Holon

# Dream: The scene/animation space
from DreamTalk.scene import Dream, TwoDDream, ThreeDDream

# Observer: The camera/viewpoint
from DreamTalk.objects.camera_objects import Observer


# =============================================================================
# Parameter Types - Semantic types for UserData
# =============================================================================

from DreamTalk.xpresso.types import (
    Length,      # Distance/size (0 to infinity)
    Angle,       # Rotation (0 to 2pi)
    Bipolar,     # Signed normalized (-1 to 1)
    Completion,  # Progress/opacity (0 to 1)
    Color,       # RGB color
    Integer,     # Whole number
    Bool,        # Boolean flag
)


# =============================================================================
# State Machine Support - For agentic holons
# =============================================================================

from DreamTalk.xpresso.states import State


# =============================================================================
# Geometry Primitives - Common shapes
# =============================================================================

from DreamTalk.objects.line_objects import (
    Circle,
    Rectangle,
    Square,
    Arc,
    Helix,
    Spline,
    Triangle,
)

from DreamTalk.objects.solid_objects import (
    Sphere,
    Cube,
    Cone,
    Plane,
)


# =============================================================================
# Constants - Colors and math
# =============================================================================

from DreamTalk.constants import (
    # Colors
    WHITE, BLACK, BLUE, RED, GREEN, YELLOW, PURPLE,
    # Math
    PI,
    # Scene settings
    FPS, ASPECT_RATIO,
)


# =============================================================================
# Animation - Animators for common operations
# =============================================================================

from DreamTalk.animation.abstract_animators import (
    Create,
    Draw,
    Move,
    Scale,
    Rotate,
    FadeIn,
    FadeOut,
)


# =============================================================================
# __all__ - What gets exported with "from dreamtalk import *"
# =============================================================================

__all__ = [
    # Core classes
    'Holon', 'Dream', 'TwoDDream', 'ThreeDDream', 'Observer',

    # Parameter types
    'Length', 'Angle', 'Bipolar', 'Completion', 'Color', 'Integer', 'Bool',

    # State machine
    'State',

    # Geometry
    'Circle', 'Rectangle', 'Square', 'Arc', 'Helix', 'Spline', 'Triangle',
    'Sphere', 'Cube', 'Cone', 'Plane',

    # Constants
    'WHITE', 'BLACK', 'BLUE', 'RED', 'GREEN', 'YELLOW', 'PURPLE',
    'PI', 'FPS', 'ASPECT_RATIO',

    # Animators
    'Create', 'Draw', 'Move', 'Scale', 'Rotate', 'FadeIn', 'FadeOut',
]
