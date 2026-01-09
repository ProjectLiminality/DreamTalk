"""
Generator-based relationship system for MoGraph compatibility.

This module provides a mixin class that enables DreamTalk CustomObjects
to work with MoGraph Cloners by replacing XPresso relationships with
Python Generator code.

Key insight: Instead of XPresso nodes that store object references (which break
when cloned), we use Python Generators that modify their children based on
UserData parameters. The relationship logic lives in plain Python code.

Usage:
    class FoldableCube(CustomObject, GeneratorMixin):
        def specify_parts(self): ...

        def specify_generator_code(self):
            return '''
def main():
    fold = op[FOLD_ID]
    child = op.GetDown()
    while child:
        if child.GetName() == "LeftAxis":
            child.SetRelRot(c4d.Vector(0, 0, fold * PI/2))
        child = child.GetNext()
    return None
'''
"""

import c4d
from abc import ABC
import math

# Standard imports that generator code will need
GENERATOR_IMPORTS = '''import c4d
import math
PI = math.pi
'''


class GeneratorMixin:
    """
    Mixin class that adds generator-based relationship support to CustomObjects.

    When mixed into a CustomObject, provides:
    - create_as_generator(): Creates a Python Generator version of the object
    - Generator code is defined in specify_generator_code()
    - Children are created normally, relationships are computed in Python

    The generator pattern:
    1. Generator reads UserData parameters
    2. Generator modifies children's properties (rotation, position, visibility, etc.)
    3. Generator returns None (children ARE the output)
    4. Works inside MoGraph Cloners - each clone gets unique values from op.GetMg()
    """

    # Subclasses override this to define their relationship logic
    GENERATOR_CODE = None

    def specify_generator_code(self):
        """
        Override this method to return Python code for the generator.

        The code should define a main() function that:
        - Reads parameters from op[DESC_ID] (UserData on the generator)
        - Modifies children via op.GetDown() traversal
        - Returns None (children are the output)

        Available in the code:
        - op: The Python Generator object
        - doc: The active document (via c4d.documents.GetActiveDocument())
        - c4d: The Cinema 4D module
        - math, PI: Math utilities

        Returns:
            str: Python code string for the generator's main() function
        """
        return self.GENERATOR_CODE or ''

    def _build_generator_code(self):
        """Combines imports with the object's generator code."""
        user_code = self.specify_generator_code()
        return GENERATOR_IMPORTS + '\n' + user_code

    def create_as_generator(self, **kwargs):
        """
        Create this object as a Python Generator instead of a Null with XPresso.

        Returns a Python Generator object with:
        - The same UserData parameters as the normal object
        - Children created normally (visible in Object Manager)
        - Relationship logic in Python code instead of XPresso

        Args:
            **kwargs: Passed to the normal constructor for creating children

        Returns:
            c4d.BaseObject: A Python Generator object
        """
        # Create the generator object
        gen = c4d.BaseObject(1023866)  # Python Generator
        gen.SetName(self.name if hasattr(self, 'name') else self.__class__.__name__)

        # Set the code
        gen[c4d.OPYTHON_CODE] = self._build_generator_code()
        gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!

        # Copy UserData from self.obj to generator
        self._copy_userdata_to_generator(gen)

        # Move children from self.obj to generator
        self._move_children_to_generator(gen)

        return gen

    def _copy_userdata_to_generator(self, gen):
        """Copy UserData definitions from self.obj to the generator."""
        if not hasattr(self, 'obj'):
            return

        # Get UserData container from source
        ud = self.obj.GetUserDataContainer()
        for desc_id, bc in ud:
            # Skip group headers
            if bc[c4d.DESC_CUSTOMGUI] == c4d.CUSTOMGUI_SEPARATOR:
                continue
            # Add to generator
            new_id = gen.AddUserData(bc)
            # Copy the value
            try:
                gen[new_id] = self.obj[desc_id]
            except:
                pass

    def _move_children_to_generator(self, gen):
        """Move children from self.obj to the generator."""
        if not hasattr(self, 'obj'):
            return

        # Collect children first (modifying during iteration is unsafe)
        children = []
        child = self.obj.GetDown()
        while child:
            children.append(child)
            child = child.GetNext()

        # Move each child under the generator
        for child in children:
            child.Remove()
            child.InsertUnder(gen)


def build_generator_from_class(cls, **kwargs):
    """
    Factory function to create a generator version of a CustomObject class.

    This creates an instance to get the children/structure, then
    converts it to a generator.

    Args:
        cls: A CustomObject class that uses GeneratorMixin
        **kwargs: Constructor arguments for the class

    Returns:
        c4d.BaseObject: A Python Generator with the object's structure
    """
    # Create the normal instance first
    instance = cls(**kwargs)

    # Convert to generator
    if hasattr(instance, 'create_as_generator'):
        return instance.create_as_generator()
    else:
        raise TypeError(f"{cls.__name__} must use GeneratorMixin")


# === Relationship Helper Functions ===
# These can be called from generator code to implement common patterns

def relationship_code_fold_axes(fold_param_id, axes_config):
    """
    Generate code for folding axes based on a fold parameter.

    Args:
        fold_param_id: DescID tuple for the Fold parameter
        axes_config: List of (axis_name, rotation_axis, direction) tuples
            e.g., [("LeftAxis", "z", 1), ("RightAxis", "z", -1)]

    Returns:
        str: Python code for the main() function
    """
    axis_code = []
    for name, rot_axis, direction in axes_config:
        sign = '+' if direction > 0 else '-'
        if rot_axis == 'x':
            axis_code.append(f'''
        if child.GetName() == "{name}":
            child.SetRelRot(c4d.Vector({sign}angle, 0, 0))''')
        elif rot_axis == 'y':
            axis_code.append(f'''
        if child.GetName() == "{name}":
            child.SetRelRot(c4d.Vector(0, {sign}angle, 0))''')
        elif rot_axis == 'z':
            axis_code.append(f'''
        if child.GetName() == "{name}":
            child.SetRelRot(c4d.Vector(0, 0, {sign}angle))''')

    axes_str = '\n'.join(axis_code)

    return f'''
def main():
    # Read Fold parameter
    fold = op[c4d.DescID({fold_param_id})]
    angle = fold * PI / 2  # 0 to 90 degrees

    # Modify axis children
    child = op.GetDown()
    while child:{axes_str}
        child = child.GetNext()

    return None
'''


def relationship_code_visibility(visibility_param_id):
    """
    Generate code for controlling visibility of children.

    Args:
        visibility_param_id: DescID tuple for the Visibility parameter

    Returns:
        str: Python code for the main() function
    """
    return f'''
def main():
    visible = op[c4d.DescID({visibility_param_id})]

    # Set visibility on all children
    child = op.GetDown()
    while child:
        # 0 = visible, 1 = hidden in C4D
        child[c4d.ID_BASEOBJECT_VISIBILITY_EDITOR] = 0 if visible else 1
        child[c4d.ID_BASEOBJECT_VISIBILITY_RENDER] = 0 if visible else 1
        child = child.GetNext()

    return None
'''


def relationship_code_parameter_passthrough(source_param_id, child_name, target_param_id):
    """
    Generate code for passing a parameter value to a child's parameter.

    This is the generator equivalent of XIdentity.

    Args:
        source_param_id: DescID tuple for the source parameter on parent
        child_name: Name of the child to receive the value
        target_param_id: DescID tuple for the target parameter on child

    Returns:
        str: Python code for the main() function
    """
    return f'''
def main():
    value = op[c4d.DescID({source_param_id})]

    # Pass to child
    child = op.GetDown()
    while child:
        if child.GetName() == "{child_name}":
            child[c4d.DescID({target_param_id})] = value
        child = child.GetNext()

    return None
'''


def relationship_code_position_from_clone():
    """
    Generate code that reads position from clone context (for MoGraph).

    This enables position-based parameter variation when inside a Cloner.

    Returns:
        str: Python code snippet (not full main(), to be composed)
    """
    return '''
    # Get position (unique per clone in MoGraph Cloner)
    mg = op.GetMg()
    pos = mg.off
'''


def relationship_code_field_sample(field_name, radius=200):
    """
    Generate code for sampling a field's influence based on distance.

    Args:
        field_name: Name of the field object to sample
        radius: Influence radius

    Returns:
        str: Python code snippet for field sampling
    """
    return f'''
    # Sample field influence
    field = doc.SearchObject("{field_name}")
    if field:
        field_pos = field.GetMg().off
        dist = (pos - field_pos).GetLength()
        influence = max(0.0, 1.0 - dist / {radius})
    else:
        influence = 0.0
'''
