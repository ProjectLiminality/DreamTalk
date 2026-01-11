"""
DreamTalk Imports - Fresh Architecture (v2.0)

Simplified import module for DreamTalk.
All objects use geometry-based stroke rendering and Python Generators.
No Sketch & Toon or XPresso dependencies.

Usage:
    from DreamTalk.imports import *
"""

from types import ModuleType

try:
    from importlib import reload
except ImportError:
    from imp import reload

def rreload(module):
    """Recursively reload modules."""
    reload(module)
    for attribute_name in dir(module):
        attribute = getattr(module, attribute_name)
        if type(attribute) is ModuleType:
            rreload(attribute)


# Reload submodules to pick up changes
import sys
import importlib
import DreamTalk.scene
import DreamTalk.utils
import DreamTalk.objects.abstract_objects
import DreamTalk.objects.helper_objects
import DreamTalk.objects.camera_objects
import DreamTalk.objects.custom_objects
import DreamTalk.objects.effect_objects
import DreamTalk.objects.line_objects
import DreamTalk.objects.solid_objects
import DreamTalk.objects.stroke_objects
import DreamTalk.constants
import DreamTalk.xpresso.userdata
import DreamTalk.animation.animation
import DreamTalk.animation.abstract_animators

# Resolve DreamTalk path
import os as _os
DreamTalk_path = _os.path.dirname(_os.path.abspath(__file__))

# Reload order matters - dependencies first
reload(DreamTalk.scene)
reload(DreamTalk.utils)
reload(DreamTalk.objects.abstract_objects)
reload(DreamTalk.objects.helper_objects)
reload(DreamTalk.objects.camera_objects)
reload(DreamTalk.objects.custom_objects)
reload(DreamTalk.objects.effect_objects)
reload(DreamTalk.objects.stroke_objects)
reload(DreamTalk.objects.line_objects)
reload(DreamTalk.objects.solid_objects)
reload(DreamTalk.constants)
reload(DreamTalk.xpresso.userdata)
reload(DreamTalk.animation.animation)
reload(DreamTalk.animation.abstract_animators)


# Import public API
from DreamTalk.scene import *
from DreamTalk.objects.helper_objects import *
from DreamTalk.objects.camera_objects import *
from DreamTalk.objects.custom_objects import *
from DreamTalk.objects.effect_objects import *
from DreamTalk.objects.line_objects import *
from DreamTalk.objects.solid_objects import *
from DreamTalk.objects.stroke_objects import *
from DreamTalk.constants import *
from DreamTalk.xpresso.userdata import *
from DreamTalk.animation.abstract_animators import *
