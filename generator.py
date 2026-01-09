"""
Generator-based relationship system for MoGraph compatibility.

This module enables DreamTalk CustomObjects to work with MoGraph Cloners
by automatically translating XPresso relationships into Python Generator code.

Key insight: Instead of XPresso nodes that store object references (which break
when cloned), we use Python Generators that modify their children based on
UserData parameters. The relationship logic lives in plain Python code.

Usage:
    # Simple - just pass generator_mode=True to any CustomObject
    virus = MindVirus(color=BLUE, generator_mode=True)

    # The library automatically:
    # 1. Converts the object to a Python Generator
    # 2. Translates specify_relations() XPresso patterns to Python code
    # 3. Recursively converts child CustomObjects that also have GeneratorMixin
"""

import c4d
import math

# Standard imports that generator code will need
GENERATOR_IMPORTS = '''import c4d
import math
PI = math.pi
'''


class GeneratorMixin:
    """
    Mixin class that adds generator-based relationship support to CustomObjects.

    When mixed into a CustomObject, the library can automatically:
    - Convert XIdentity/XRelation patterns to generator code
    - Create Python Generator objects instead of Null + XPresso
    - Recursively convert child CustomObjects

    The generator pattern:
    1. Generator reads UserData parameters
    2. Generator modifies children's properties (rotation, position, visibility, etc.)
    3. Generator returns None (children ARE the output)
    4. Works inside MoGraph Cloners - each clone gets unique values from op.GetMg()
    """

    def _auto_generate_code_from_relations(self):
        """
        Automatically generate Python code from specify_relations() patterns.

        Introspects the XPresso relations defined on this object and generates
        equivalent Python generator code.

        Returns:
            str: Python code for main() function, or empty string if no relations
        """
        if not hasattr(self, 'relations') or not self.relations:
            # No relations defined, return minimal pass-through code
            return '''
def main():
    return None
'''

        code_lines = []
        code_lines.append('def main():')

        # Track which parameters we need to read
        params_to_read = set()
        child_updates = []

        for relation in self.relations:
            rel_class = relation.__class__.__name__

            if rel_class == 'XIdentity':
                # XIdentity: pass parameter value directly to child
                # relation.parameter = source param on whole (self)
                # relation.part = target child object
                # relation.desc_ids = target parameter(s) on child

                param = relation.parameter
                part = relation.part
                target_desc_ids = relation.desc_ids

                # Build parameter read
                param_name = param.name.lower().replace(' ', '_')
                params_to_read.add((param_name, param))

                # Build child update
                child_name = part.obj.GetName() if hasattr(part, 'obj') else str(part)
                for desc_id in target_desc_ids:
                    child_updates.append((child_name, desc_id, param_name, None))

            elif rel_class == 'XRelation':
                # XRelation: apply formula to parameter before passing to child
                param = relation.parameters[0] if relation.parameters else None
                if param:
                    param_name = param.name.lower().replace(' ', '_')
                    params_to_read.add((param_name, param))

                    part = relation.part
                    child_name = part.obj.GetName() if hasattr(part, 'obj') else str(part)
                    formula = relation.formula if hasattr(relation, 'formula') else None

                    for desc_id in relation.desc_ids:
                        child_updates.append((child_name, desc_id, param_name, formula))

        # Generate parameter reading code
        for param_name, param in params_to_read:
            # UserData ID - need to determine the index
            # For now, use a simple approach: first param is ID 1, etc.
            param_idx = self.parameters.index(param) + 1 if param in self.parameters else 1
            code_lines.append(f'    # Read {param.name} parameter (UserData ID {param_idx})')
            code_lines.append(f'    {param_name} = op[c4d.DescID(c4d.DescLevel(c4d.ID_USERDATA, c4d.DTYPE_SUBCONTAINER, 0),')
            code_lines.append(f'                        c4d.DescLevel({param_idx}, c4d.DTYPE_REAL, 0))]')
            code_lines.append('')

        # Generate child traversal and update code
        if child_updates:
            code_lines.append('    # Update children')
            code_lines.append('    child = op.GetDown()')
            code_lines.append('    while child:')

            # Group updates by child name
            updates_by_child = {}
            for child_name, desc_id, param_name, formula in child_updates:
                if child_name not in updates_by_child:
                    updates_by_child[child_name] = []
                updates_by_child[child_name].append((desc_id, param_name, formula))

            for child_name, updates in updates_by_child.items():
                code_lines.append(f'        if child.GetName() == "{child_name}":')
                for desc_id, param_name, formula in updates:
                    # Determine what value to set
                    if formula:
                        # Apply formula - replace parameter name with variable
                        value_expr = formula.replace(param_name.replace('_', ' ').title(), param_name)
                        value_expr = value_expr.replace('PI', 'PI')
                    else:
                        value_expr = param_name

                    # Determine target - is it a UserData param or a built-in?
                    if hasattr(desc_id, '__iter__') and len(desc_id) == 2:
                        # Likely a rotation or position component
                        # Check if it's ROT_P, ROT_B, etc.
                        code_lines.append(f'            # Set parameter via UserData')
                        code_lines.append(f'            child[c4d.DescID(c4d.DescLevel(c4d.ID_USERDATA, c4d.DTYPE_SUBCONTAINER, 0),')
                        code_lines.append(f'                            c4d.DescLevel(1, c4d.DTYPE_REAL, 0))] = {value_expr}')
                    else:
                        code_lines.append(f'            child[c4d.DescID(c4d.DescLevel(c4d.ID_USERDATA, c4d.DTYPE_SUBCONTAINER, 0),')
                        code_lines.append(f'                            c4d.DescLevel(1, c4d.DTYPE_REAL, 0))] = {value_expr}')

            code_lines.append('        child = child.GetNext()')

        code_lines.append('')
        code_lines.append('    return None')

        return '\n'.join(code_lines)

    def _build_generator_code(self):
        """Build complete generator code including imports."""
        # Try auto-generation first
        auto_code = self._auto_generate_code_from_relations()
        if auto_code and 'return None' in auto_code:
            return GENERATOR_IMPORTS + '\n' + auto_code

        # Fall back to manual specify_generator_code if defined
        if hasattr(self, 'specify_generator_code'):
            user_code = self.specify_generator_code()
            if user_code:
                return GENERATOR_IMPORTS + '\n' + user_code

        # Default: minimal pass-through
        return GENERATOR_IMPORTS + '''
def main():
    return None
'''

    def create_as_generator(self, recursive=True):
        """
        Create this object as a Python Generator instead of a Null with XPresso.

        Args:
            recursive: If True, also convert child CustomObjects with GeneratorMixin

        Returns:
            c4d.BaseObject: A Python Generator object
        """
        # Create the generator object
        gen = c4d.BaseObject(1023866)  # Python Generator
        gen.SetName(self.obj.GetName() if hasattr(self, 'obj') else self.__class__.__name__)

        # Set the code
        gen[c4d.OPYTHON_CODE] = self._build_generator_code()
        gen[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!

        # Copy UserData from self.obj to generator
        self._copy_userdata_to_generator(gen)

        # Move/convert children from self.obj to generator
        self._move_children_to_generator(gen, recursive=recursive)

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

    def _move_children_to_generator(self, gen, recursive=True):
        """Move children from self.obj to the generator.

        Args:
            gen: The generator object to move children under
            recursive: If True, convert child CustomObjects with GeneratorMixin to generators
        """
        if not hasattr(self, 'obj'):
            return

        # Collect children and their DreamTalk wrapper objects
        children_to_move = []
        child = self.obj.GetDown()
        while child:
            children_to_move.append(child)
            child = child.GetNext()

        # Check if we have parts that map to these children
        parts_by_name = {}
        if hasattr(self, 'parts'):
            for part in self.parts:
                if hasattr(part, 'obj'):
                    parts_by_name[part.obj.GetName()] = part

        # Move/convert each child
        for child_obj in children_to_move:
            child_obj.Remove()

            # Check if this child has a DreamTalk wrapper with GeneratorMixin
            child_name = child_obj.GetName()
            part = parts_by_name.get(child_name)

            if recursive and part and hasattr(part, 'create_as_generator'):
                # This child is a CustomObject with GeneratorMixin - convert it
                child_gen = part.create_as_generator(recursive=True)
                child_gen.InsertUnder(gen)
            else:
                # Regular child - just move it
                child_obj.InsertUnder(gen)


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
