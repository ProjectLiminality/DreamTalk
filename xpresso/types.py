"""
DreamTalk Parameter Types

Semantic type classes for holon parameters.
These serve as type hints AND default value containers.

The library introspects class annotations to create UserData:

    class MindVirus(Holon):
        fold: Bipolar = 0
        color: Color = BLUE
        size: Length = 100

These are translated to Cinema 4D UserData with appropriate
type, range, and unit settings.

Types:
- Length: Distance/size (0 → ∞)
- Angle: Rotation (0 → 2π)
- Bipolar: Signed normalized (-1 → 1)
- Completion: Progress/opacity (0 → 1)
- Color: RGB color
- Integer: Whole number
- Bool: Boolean flag
"""

from DreamTalk.constants import WHITE


class ParameterType:
    """
    Base class for parameter types.

    Subclasses define the C4D type mapping and constraints.
    """
    c4d_type = None
    unit = None
    min_val = None
    max_val = None

    def __init__(self, default=None):
        self.default = default

    def __repr__(self):
        return f"{self.__class__.__name__}(default={self.default})"


class Length(ParameterType):
    """
    Length parameter (0 → ∞).

    For sizes, distances, radii.
    Maps to C4D DTYPE_REAL with meter units.
    """
    c4d_type = "DTYPE_REAL"
    unit = "DESC_UNIT_METER"
    min_val = 0

    def __init__(self, default=100):
        super().__init__(default)


class Angle(ParameterType):
    """
    Angle parameter (0 → 2π).

    For rotations in radians.
    Maps to C4D DTYPE_REAL with degree display.
    """
    c4d_type = "DTYPE_REAL"
    unit = "DESC_UNIT_DEGREE"

    def __init__(self, default=0):
        super().__init__(default)


class Bipolar(ParameterType):
    """
    Bipolar parameter (-1 → 1).

    For signed normalized values like fold, blend, balance.
    Center (0) is neutral; extremes are -1 and 1.
    """
    c4d_type = "DTYPE_REAL"
    min_val = -1
    max_val = 1

    def __init__(self, default=0):
        super().__init__(default)


class Completion(ParameterType):
    """
    Completion parameter (0 → 1).

    For progress, opacity, draw completion.
    Maps to C4D percent slider.
    """
    c4d_type = "DTYPE_REAL"
    unit = "DESC_UNIT_PERCENT"
    min_val = 0
    max_val = 1

    def __init__(self, default=0):
        super().__init__(default)


class Color(ParameterType):
    """
    Color parameter.

    For RGB colors.
    Maps to C4D color picker.
    """
    c4d_type = "DTYPE_COLOR"

    def __init__(self, default=None):
        if default is None:
            default = WHITE
        super().__init__(default)


class Integer(ParameterType):
    """
    Integer parameter.

    For counts, indices.
    Maps to C4D DTYPE_LONG.
    """
    c4d_type = "DTYPE_LONG"

    def __init__(self, default=0):
        super().__init__(default)


class Bool(ParameterType):
    """
    Boolean parameter.

    For on/off flags.
    Maps to C4D checkbox.
    """
    c4d_type = "DTYPE_BOOL"

    def __init__(self, default=False):
        super().__init__(default)


# =============================================================================
# Type checking utilities
# =============================================================================

def is_parameter_type(obj):
    """Check if an object is a parameter type instance or class."""
    if isinstance(obj, type):
        return issubclass(obj, ParameterType)
    return isinstance(obj, ParameterType)


def get_default_value(type_hint, class_default):
    """
    Get the default value for a parameter.

    Args:
        type_hint: The type annotation (class or instance)
        class_default: The default value from the class attribute

    Returns:
        The resolved default value
    """
    # If class_default is a ParameterType instance, get its default
    if isinstance(class_default, ParameterType):
        return class_default.default

    # If class_default is a raw value (int, float, etc.), use it
    if class_default is not None:
        return class_default

    # Fall back to type's default
    if isinstance(type_hint, ParameterType):
        return type_hint.default
    elif isinstance(type_hint, type) and issubclass(type_hint, ParameterType):
        return type_hint().default

    return None


def create_userdata_from_type(name, type_class, default_value):
    """
    Create a UserData object from a type hint.

    Args:
        name: Parameter name
        type_class: The ParameterType class (Length, Bipolar, etc.)
        default_value: Default value for the parameter

    Returns:
        A UData subclass instance (ULength, UBipolar, etc.)
    """
    from DreamTalk.xpresso.userdata import (
        ULength, UAngle, UBipolar, UCompletion, UColor, UCount, UCheckBox
    )

    # Map type classes to UserData classes
    type_to_userdata = {
        Length: ULength,
        Angle: UAngle,
        Bipolar: UBipolar,
        Completion: UCompletion,
        Color: UColor,
        Integer: UCount,  # UCount is the concrete integer class
        Bool: UCheckBox,
    }

    # Get the UserData class for this type
    userdata_class = type_to_userdata.get(type_class)
    if userdata_class is None:
        raise ValueError(f"Unknown parameter type: {type_class}")

    # Create and return the UserData instance
    return userdata_class(name=name, default_value=default_value)
