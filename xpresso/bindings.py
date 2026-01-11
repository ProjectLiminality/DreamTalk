"""
DreamTalk Declarative Bindings (v2.0)

A minimal, declarative syntax for expressing parameter relationships.
Replaces XPresso with Python-native binding expressions.

Usage (specify_relationships style):
    class MyObject(CustomObject):
        radius = ULength(default=100)

        def specify_parts(self):
            self.circle = Circle()
            self.parts = [self.circle]

        def specify_relationships(self):
            self.circle.radius << self.radius  # Identity
            self.circle.x << self.radius * 0.5  # Formula

Usage (inline binding style - Phase 3):
    class MyObject(Holon):
        radius: Length = 100

        def specify_parts(self):
            # Bind circle radius to parent's radius parameter
            self.circle = Circle(radius=self.radius_parameter >> 100)
            self.parts = [self.circle]

The << operator creates a Binding for relationships.
The >> operator creates a BoundValue for inline bindings in constructors.
"""

import math
from typing import Any, List, Union, Optional


class BindingExpression:
    """
    Represents a mathematical expression involving parameters.
    Supports operator overloading to build expression trees.
    """

    def __init__(self, expr_str: str, dependencies: List[str] = None):
        self.expr_str = expr_str
        self.dependencies = dependencies or []

    def __repr__(self):
        return f"Expr({self.expr_str})"

    # Arithmetic operators - build expression strings
    def __add__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({self.expr_str} + {other_expr})",
            self.dependencies + other_deps
        )

    def __radd__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({other_expr} + {self.expr_str})",
            other_deps + self.dependencies
        )

    def __sub__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({self.expr_str} - {other_expr})",
            self.dependencies + other_deps
        )

    def __rsub__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({other_expr} - {self.expr_str})",
            other_deps + self.dependencies
        )

    def __mul__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({self.expr_str} * {other_expr})",
            self.dependencies + other_deps
        )

    def __rmul__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({other_expr} * {self.expr_str})",
            other_deps + self.dependencies
        )

    def __truediv__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({self.expr_str} / {other_expr})",
            self.dependencies + other_deps
        )

    def __rtruediv__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({other_expr} / {self.expr_str})",
            other_deps + self.dependencies
        )

    def __neg__(self):
        return BindingExpression(f"(-{self.expr_str})", self.dependencies)

    def __pow__(self, other):
        other_expr, other_deps = self._unwrap(other)
        return BindingExpression(
            f"({self.expr_str} ** {other_expr})",
            self.dependencies + other_deps
        )

    def __rshift__(self, default_value):
        """
        Create a BoundValue for inline binding syntax.

        Usage:
            Circle(radius=(self.size_parameter * 0.5) >> 50)

        This allows binding expressions (not just parameters) to be
        used with inline binding syntax.
        """
        return BoundValue(expression=self, default=default_value)

    def _unwrap(self, other):
        """Extract expression string and dependencies from any value."""
        if isinstance(other, BindingExpression):
            return other.expr_str, other.dependencies
        elif isinstance(other, ParameterRef):
            return other.to_expr().expr_str, other.to_expr().dependencies
        else:
            return str(other), []


class ParameterRef:
    """
    Reference to a UserData parameter on the parent object.
    Created when accessing a parameter in a relationship context.
    """

    def __init__(self, name: str):
        self.name = name

    def to_expr(self) -> BindingExpression:
        """Convert to expression that reads this parameter."""
        return BindingExpression(
            f'get_userdata_by_name(op, "{self.name}")',
            [self.name]
        )

    def __repr__(self):
        return f"Param({self.name})"

    # >> operator for inline bindings: self.param >> default_value
    def __rshift__(self, default_value):
        """
        Create a BoundValue for inline binding syntax.

        Usage in part constructors:
            Circle(radius=self.radius_parameter >> 100)

        This means: bind the circle's radius to the parent's radius parameter,
        using 100 as the default/initial value.
        """
        return BoundValue(expression=self.to_expr(), default=default_value, param_name=self.name)

    # Delegate arithmetic to BindingExpression
    def __add__(self, other):
        return self.to_expr() + other

    def __radd__(self, other):
        return other + self.to_expr()

    def __sub__(self, other):
        return self.to_expr() - other

    def __rsub__(self, other):
        return other - self.to_expr()

    def __mul__(self, other):
        return self.to_expr() * other

    def __rmul__(self, other):
        return other * self.to_expr()

    def __truediv__(self, other):
        return self.to_expr() / other

    def __rtruediv__(self, other):
        return other / self.to_expr()

    def __neg__(self):
        return -self.to_expr()

    def __pow__(self, other):
        return self.to_expr() ** other


class BoundValue:
    """
    A value bound to a parameter expression, for inline binding in constructors.

    Created via the >> operator:
        Circle(radius=self.radius_parameter >> 100)

    This stores both the binding expression and the default value.
    When parts are instantiated, ProtoObject detects BoundValues and:
    1. Uses the default value for initialization
    2. Stores the binding for later collection by the parent Holon

    Attributes:
        expression: The BindingExpression that computes the value
        default: The default/initial value to use
        param_name: Name of the source parameter (for debugging)
        target_property: Set by the part constructor to record what property this binds to
    """

    def __init__(self, expression: BindingExpression, default, param_name: str = None):
        self.expression = expression
        self.default = default
        self.param_name = param_name
        self.target_property = None  # Set when binding is collected

    def __repr__(self):
        return f"BoundValue({self.param_name} >> {self.default})"

    # Support arithmetic operations to allow expressions like:
    # Circle(radius=(self.size_parameter * 0.5) >> 50)
    def __add__(self, other):
        other_expr, other_deps = self._unwrap(other)
        new_expr = BindingExpression(
            f"({self.expression.expr_str} + {other_expr})",
            self.expression.dependencies + other_deps
        )
        return BoundValue(new_expr, self.default + other if isinstance(other, (int, float)) else self.default, self.param_name)

    def __mul__(self, other):
        other_expr, other_deps = self._unwrap(other)
        new_expr = BindingExpression(
            f"({self.expression.expr_str} * {other_expr})",
            self.expression.dependencies + other_deps
        )
        return BoundValue(new_expr, self.default * other if isinstance(other, (int, float)) else self.default, self.param_name)

    def __rmul__(self, other):
        return self.__mul__(other)

    def _unwrap(self, other):
        """Extract expression string and dependencies from any value."""
        if isinstance(other, BindingExpression):
            return other.expr_str, other.dependencies
        elif isinstance(other, ParameterRef):
            return other.to_expr().expr_str, other.to_expr().dependencies
        elif isinstance(other, BoundValue):
            return other.expression.expr_str, other.expression.dependencies
        else:
            return str(other), []


class PropertyTarget:
    """
    Target for a binding - a property on a child object.
    Receives values via the << operator.
    """

    # Class-level collector for auto-registration
    _active_collector = None

    def __init__(self, part_name: str, property_name: str, c4d_attr: str = None,
                 vector_component: str = None, setter_template: str = None):
        self.part_name = part_name
        self.property_name = property_name
        self.c4d_attr = c4d_attr  # e.g., "c4d.PRIM_CIRCLE_RADIUS"
        self.vector_component = vector_component  # e.g., "x", "y", "z" for position
        self.setter_template = setter_template  # Code template with {value} placeholder
        self._binding = None

    def __lshift__(self, expr):
        """The << operator - creates a binding from expression to this target."""
        if isinstance(expr, ParameterRef):
            expr = expr.to_expr()
        elif isinstance(expr, (int, float)):
            expr = BindingExpression(str(expr), [])

        binding = Binding(target=self, expression=expr)
        self._binding = binding

        # Auto-register with active collector if one exists
        if PropertyTarget._active_collector is not None:
            PropertyTarget._active_collector.add_binding(binding)

        return binding

    def __repr__(self):
        return f"Target({self.part_name}.{self.property_name})"

    @classmethod
    def set_collector(cls, collector):
        """Set the active collector for auto-registration."""
        cls._active_collector = collector

    @classmethod
    def clear_collector(cls):
        """Clear the active collector."""
        cls._active_collector = None


class Binding:
    """
    A complete binding: target property <- expression.
    Collected by CustomObject to generate code.
    """

    def __init__(self, target: PropertyTarget, expression: BindingExpression):
        self.target = target
        self.expression = expression

    def __repr__(self):
        return f"Binding({self.target} << {self.expression})"

    def to_code(self, indent: int = 4) -> str:
        """Generate the Python code for this binding."""
        ind = " " * indent
        comment = f"{ind}# {self.target.part_name}.{self.target.property_name} << ..."

        # Use setter template if available (for position/rotation vector components)
        if self.target.setter_template:
            setter_code = self.target.setter_template.format(value=self.expression.expr_str)
            return f'''{comment}
{ind}child = find_child_by_name(op, "{self.target.part_name}")
{ind}if child:
{ind}    {setter_code}'''

        # Handle UserData parameters
        if self.target.c4d_attr and self.target.c4d_attr.startswith('userdata:'):
            param_name = self.target.c4d_attr.split(':')[1]
            return f'''{comment}
{ind}child = find_child_by_name(op, "{self.target.part_name}")
{ind}if child:
{ind}    set_userdata_by_name(child, "{param_name}", {self.expression.expr_str})'''

        # Default: direct property access
        return f'''{comment}
{ind}child = find_child_by_name(op, "{self.target.part_name}")
{ind}if child:
{ind}    child[{self.target.c4d_attr}] = {self.expression.expr_str}'''


class PartProxy:
    """
    Proxy object for accessing part properties in relationship definitions.
    Created when accessing self.<part_name> in specify_relationships().
    """

    # Common property mappings to C4D attributes
    # Format: property_name -> (c4d_constant, is_vector_component, setter_code_template)
    # Note: For primitive properties on LineObjects/SolidObjects, we need to find the nested
    # spline/mesh inside the StrokeGen wrapper. The setter template handles this.
    PROPERTY_MAP = {
        # Position (vector components need special handling)
        'x': ('c4d.ID_BASEOBJECT_POSITION', 'x', 'pos = child.GetRelPos(); pos.x = {value}; child.SetRelPos(pos)'),
        'y': ('c4d.ID_BASEOBJECT_POSITION', 'y', 'pos = child.GetRelPos(); pos.y = {value}; child.SetRelPos(pos)'),
        'z': ('c4d.ID_BASEOBJECT_POSITION', 'z', 'pos = child.GetRelPos(); pos.z = {value}; child.SetRelPos(pos)'),
        # Rotation
        'h': ('c4d.ID_BASEOBJECT_ROTATION', 'x', 'rot = child.GetRelRot(); rot.x = {value}; child.SetRelRot(rot)'),
        'p': ('c4d.ID_BASEOBJECT_ROTATION', 'y', 'rot = child.GetRelRot(); rot.y = {value}; child.SetRelRot(rot)'),
        'b': ('c4d.ID_BASEOBJECT_ROTATION', 'z', 'rot = child.GetRelRot(); rot.z = {value}; child.SetRelRot(rot)'),
        # Scale
        'scale_x': ('c4d.ID_BASEOBJECT_SCALE', 'x', 'scale = child.GetRelScale(); scale.x = {value}; child.SetRelScale(scale)'),
        'scale_y': ('c4d.ID_BASEOBJECT_SCALE', 'y', 'scale = child.GetRelScale(); scale.y = {value}; child.SetRelScale(scale)'),
        'scale_z': ('c4d.ID_BASEOBJECT_SCALE', 'z', 'scale = child.GetRelScale(); scale.z = {value}; child.SetRelScale(scale)'),
        # Circle primitive - look for nested spline if child is a generator
        'radius': ('c4d.PRIM_CIRCLE_RADIUS', None, 'spline = child.GetDown() if child.GetType() == 1023866 else child; spline[c4d.PRIM_CIRCLE_RADIUS] = {value}'),
        # Rectangle primitive
        'width': ('c4d.PRIM_RECTANGLE_WIDTH', None, 'spline = child.GetDown() if child.GetType() == 1023866 else child; spline[c4d.PRIM_RECTANGLE_WIDTH] = {value}'),
        'height': ('c4d.PRIM_RECTANGLE_HEIGHT', None, 'spline = child.GetDown() if child.GetType() == 1023866 else child; spline[c4d.PRIM_RECTANGLE_HEIGHT] = {value}'),
        # Sphere primitive
        'sphere_radius': ('c4d.PRIM_SPHERE_RAD', None, 'mesh = child.GetDown() if child.GetType() == 1023866 else child; mesh[c4d.PRIM_SPHERE_RAD] = {value}'),
        # Camera
        'zoom': ('c4d.CAMERA_ZOOM', None, 'child[c4d.CAMERA_ZOOM] = {value}'),
    }

    def __init__(self, part_name: str, part_obj=None):
        self.part_name = part_name
        self.part_obj = part_obj
        self._bindings = []

    def __getattr__(self, name: str) -> 'PropertyTarget':
        """Access a property on this part, returning a bindable target."""
        if name.startswith('_'):
            raise AttributeError(name)

        prop_info = self.PROPERTY_MAP.get(name)

        if prop_info:
            c4d_attr, vector_comp, setter_template = prop_info
        else:
            # Check if part has desc_ids
            if self.part_obj and hasattr(self.part_obj, 'desc_ids') and name in self.part_obj.desc_ids:
                c4d_attr = f"self.{self.part_name}.desc_ids['{name}']"
            else:
                # Fallback - assume it's a UserData parameter on the child
                c4d_attr = f'userdata:{name}'
            vector_comp = None
            setter_template = None

        target = PropertyTarget(self.part_name, name, c4d_attr, vector_comp, setter_template)
        return target


# Math functions that work with BindingExpressions
def sin(x) -> BindingExpression:
    if isinstance(x, BindingExpression):
        return BindingExpression(f"math.sin({x.expr_str})", x.dependencies)
    elif isinstance(x, ParameterRef):
        expr = x.to_expr()
        return BindingExpression(f"math.sin({expr.expr_str})", expr.dependencies)
    else:
        return BindingExpression(f"math.sin({x})", [])

def cos(x) -> BindingExpression:
    if isinstance(x, BindingExpression):
        return BindingExpression(f"math.cos({x.expr_str})", x.dependencies)
    elif isinstance(x, ParameterRef):
        expr = x.to_expr()
        return BindingExpression(f"math.cos({expr.expr_str})", expr.dependencies)
    else:
        return BindingExpression(f"math.cos({x})", [])

def sqrt(x) -> BindingExpression:
    if isinstance(x, BindingExpression):
        return BindingExpression(f"math.sqrt({x.expr_str})", x.dependencies)
    elif isinstance(x, ParameterRef):
        expr = x.to_expr()
        return BindingExpression(f"math.sqrt({expr.expr_str})", expr.dependencies)
    else:
        return BindingExpression(f"math.sqrt({x})", [])


class BindingCollector:
    """
    Collects bindings created during specify_relationships().
    Used by CustomObject to gather bindings and compile them to generator code.
    """

    def __init__(self):
        self.bindings: List[Binding] = []
        self._part_proxies = {}
        self._param_refs = {}

    def get_part_proxy(self, name: str, part_obj=None) -> PartProxy:
        """Get or create a proxy for a part."""
        if name not in self._part_proxies:
            self._part_proxies[name] = PartProxy(name, part_obj)
        return self._part_proxies[name]

    def get_param_ref(self, name: str) -> ParameterRef:
        """Get or create a reference to a parameter."""
        if name not in self._param_refs:
            self._param_refs[name] = ParameterRef(name)
        return self._param_refs[name]

    def add_binding(self, binding: Binding):
        """Add a binding to the collection."""
        self.bindings.append(binding)

    def compile_to_generator_code(self) -> str:
        """Compile collected bindings into generator Python code."""
        if not self.bindings:
            return None

        # Collect all parameter dependencies
        all_params = set()
        for binding in self.bindings:
            all_params.update(binding.expression.dependencies)

        # Generate parameter reading code
        param_code = []
        for param in sorted(all_params):
            # Use lowercase variable name for the local
            var_name = param.lower().replace(' ', '_')
            param_code.append(f'    {var_name} = get_userdata_by_name(op, "{param}") or 0.0')

        # Generate binding code
        binding_code = []
        for binding in self.bindings:
            binding_code.append(binding.to_code(indent=4))

        code = '''def main():
    # Read parameters
'''
        if param_code:
            code += '\n'.join(param_code) + '\n'

        code += '''
    # Apply bindings
'''
        code += '\n'.join(binding_code)
        code += '''

    return None
'''
        return code


class RelationshipContext:
    """
    Context for defining relationships between parameters and parts.

    Provides a clean namespace where:
    - Accessing self.<param> returns a ParameterRef
    - Accessing self.<part> returns a PartProxy
    - Using << creates bindings that get collected

    Usage in CustomObject:
        def specify_relationships(self):
            self.circle.radius << self.radius
            self.circle.x << self.distance * cos(PI/6)
    """

    def __init__(self, custom_object, collector: BindingCollector):
        object.__setattr__(self, '_custom_object', custom_object)
        object.__setattr__(self, '_collector', collector)
        object.__setattr__(self, '_part_names', set())
        object.__setattr__(self, '_param_names', set())

        # Discover parts (objects with .obj attribute that are children)
        for attr_name in dir(custom_object):
            if attr_name.startswith('_'):
                continue
            try:
                attr = getattr(custom_object, attr_name)
                # Check if it's a part (has .obj attribute - is a DreamTalk object)
                if hasattr(attr, 'obj'):
                    self._part_names.add(attr_name)
                # Check if it's a parameter (has .desc_id or is a parameter class)
                elif hasattr(attr, 'desc_id') or (hasattr(attr, 'name') and hasattr(attr, 'default_value')):
                    self._param_names.add(attr_name)
            except:
                pass

        # Also check the parameters list
        if hasattr(custom_object, 'parameters'):
            for param in custom_object.parameters:
                if hasattr(param, 'name'):
                    # Store by name for lookup
                    self._param_names.add(param.name)

    def __getattr__(self, name: str):
        """Return a PartProxy or ParameterRef based on what's being accessed."""
        custom_obj = object.__getattribute__(self, '_custom_object')
        collector = object.__getattribute__(self, '_collector')
        part_names = object.__getattribute__(self, '_part_names')
        param_names = object.__getattribute__(self, '_param_names')

        # Check if it's a known part
        if name in part_names:
            part_obj = getattr(custom_obj, name, None)
            return collector.get_part_proxy(name, part_obj)

        # Check if it's a known parameter (by attribute name)
        if name in param_names:
            # Get the actual parameter name from the parameter object
            param_obj = getattr(custom_obj, name, None)
            if hasattr(param_obj, 'name'):
                return collector.get_param_ref(param_obj.name)
            return collector.get_param_ref(name)

        # Check if accessing a parameter by its name directly
        # e.g., self.Radius where the parameter's name is "Radius"
        if hasattr(custom_obj, 'parameters'):
            for param in custom_obj.parameters:
                if hasattr(param, 'name') and param.name == name:
                    return collector.get_param_ref(name)

        # Fall back to actual attribute on custom object
        return getattr(custom_obj, name)


# Convenience: PI constant that works in expressions
PI = math.pi


def collect_relationships(custom_object, specify_relationships_func) -> str:
    """
    Execute specify_relationships() and collect bindings into generator code.

    The key insight is that we can't easily intercept `self.part.prop << self.param`
    inside the method. Instead, we temporarily replace the object's attributes
    with proxies before calling the method.

    Args:
        custom_object: The CustomObject instance
        specify_relationships_func: The specify_relationships method (bound)

    Returns:
        Generated Python code string for the generator, or None if no bindings
    """
    collector = BindingCollector()

    # Set up the collector for auto-registration
    PropertyTarget.set_collector(collector)

    # Store original attributes so we can restore them
    original_attrs = {}

    try:
        # Discover and replace parts with proxies
        for attr_name in list(vars(custom_object).keys()):
            if attr_name.startswith('_'):
                continue
            attr = getattr(custom_object, attr_name)
            # Check if it's a part (has .obj attribute - is a DreamTalk object)
            if hasattr(attr, 'obj'):
                original_attrs[attr_name] = attr
                # Get the actual name the part uses in the hierarchy
                part_name = attr.obj.GetName() if hasattr(attr.obj, 'GetName') else attr_name
                setattr(custom_object, attr_name, collector.get_part_proxy(part_name, attr))

        # Replace parameters with refs
        for attr_name in list(vars(custom_object).keys()):
            if attr_name.startswith('_'):
                continue
            attr = original_attrs.get(attr_name) or getattr(custom_object, attr_name, None)
            # Check if it's a parameter
            if hasattr(attr, 'name') and hasattr(attr, 'default_value'):
                if attr_name not in original_attrs:
                    original_attrs[attr_name] = attr
                setattr(custom_object, attr_name, collector.get_param_ref(attr.name))

        # Now call the method - it will use our proxies
        specify_relationships_func()

    finally:
        # Restore original attributes
        for attr_name, attr in original_attrs.items():
            setattr(custom_object, attr_name, attr)

        # Always clean up
        PropertyTarget.clear_collector()

    return collector.compile_to_generator_code()


def extract_bound_values(kwargs: dict) -> tuple:
    """
    Extract BoundValues from constructor kwargs.

    Returns:
        (clean_kwargs, bindings_list)
        - clean_kwargs: dict with BoundValues replaced by their defaults
        - bindings_list: list of (property_name, BoundValue) tuples

    Usage in part constructors:
        def __init__(self, radius=100, **kwargs):
            kwargs, bindings = extract_bound_values({'radius': radius, **kwargs})
            radius = kwargs.pop('radius', 100)
            # ... use radius as the value
            # Store bindings on self._pending_bindings for collection
    """
    clean_kwargs = {}
    bindings = []

    for key, value in kwargs.items():
        if isinstance(value, BoundValue):
            # Replace with default value
            clean_kwargs[key] = value.default
            # Record the binding
            value.target_property = key
            bindings.append((key, value))
        else:
            clean_kwargs[key] = value

    return clean_kwargs, bindings


def collect_inline_bindings(holon, parts: list) -> str:
    """
    Collect inline bindings from parts and compile them to generator code.

    Called by CustomObject after specify_parts() to gather any bindings
    that were created via the >> inline syntax.

    Args:
        holon: The parent Holon/CustomObject
        parts: List of parts to scan for bindings

    Returns:
        Generated Python code string, or None if no bindings
    """
    collector = BindingCollector()

    for part in parts:
        # Check if part has pending bindings
        pending = getattr(part, '_pending_bindings', [])
        for prop_name, bound_value in pending:
            # Get the part's name in the hierarchy
            part_name = part.obj.GetName() if hasattr(part, 'obj') and hasattr(part.obj, 'GetName') else part.__class__.__name__

            # Look up property mapping
            prop_info = PartProxy.PROPERTY_MAP.get(prop_name)
            if prop_info:
                c4d_attr, vector_comp, setter_template = prop_info
            else:
                # Assume UserData
                c4d_attr = f'userdata:{prop_name}'
                vector_comp = None
                setter_template = None

            # Create PropertyTarget and Binding
            target = PropertyTarget(part_name, prop_name, c4d_attr, vector_comp, setter_template)
            binding = Binding(target=target, expression=bound_value.expression)
            collector.add_binding(binding)

    return collector.compile_to_generator_code()
