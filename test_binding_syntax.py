"""
Test: Declarative Binding Syntax

Demonstrates the << binding operator for parameter relationships.
"""

import sys
import math

# Add DreamTalk to path
sys.path.insert(0, '/Users/davidrug/ProjectLiminality/DreamTalk')

from xpresso.bindings import (
    ParameterRef, PartProxy, BindingExpression,
    sin, cos, sqrt, PI, BindingCollector
)


def test_basic_binding():
    """Test basic << binding syntax."""
    print("=" * 60)
    print("Test: Basic << Binding Syntax")
    print("=" * 60)

    # Create parameter references (like self.radius in specify_relationships)
    radius = ParameterRef("Radius")
    distance = ParameterRef("Distance")

    # Create part proxy (like accessing self.circle in specify_relationships)
    circle = PartProxy("Circle")

    # Test 1: Identity binding
    print("\n[Test 1] Identity: circle.radius << radius")
    binding1 = circle.radius << radius
    print(f"  Result: {binding1}")
    print(f"  Generated code:{binding1.to_code()}")

    # Test 2: Formula binding with multiplication
    print("\n[Test 2] Formula: circle.x << distance * 0.5")
    binding2 = circle.x << distance * 0.5
    print(f"  Result: {binding2}")
    print(f"  Generated code:{binding2.to_code()}")

    # Test 3: Formula with trig functions
    print("\n[Test 3] Trig: circle.x << distance * cos(PI/3)")
    binding3 = circle.x << distance * cos(PI/3)
    print(f"  Result: {binding3}")
    print(f"  Generated code:{binding3.to_code()}")

    # Test 4: Complex formula
    print("\n[Test 4] Complex: circle.y << distance * sin(PI/3) + radius * 0.1")
    binding4 = circle.y << distance * sin(PI/3) + radius * 0.1
    print(f"  Result: {binding4}")
    print(f"  Generated code:{binding4.to_code()}")


def test_flower_of_life_pattern():
    """Test the FlowerOfLife relationship pattern."""
    print("\n" + "=" * 60)
    print("Test: FlowerOfLife Relationship Pattern")
    print("=" * 60)

    # Parameters
    radius = ParameterRef("Radius")
    distance = ParameterRef("Distance")

    # Parts
    center = PartProxy("CenterCircle")
    petals = [PartProxy(f"Petal{i}") for i in range(6)]

    # Collect bindings
    bindings = []

    # Center circle radius
    bindings.append(center.radius << radius)

    # Petal positions and radii
    for i, petal in enumerate(petals):
        angle = i * PI / 3  # 60 degrees apart
        bindings.append(petal.x << distance * cos(angle))
        bindings.append(petal.y << distance * sin(angle))
        bindings.append(petal.radius << radius)

    print(f"\nCollected {len(bindings)} bindings:")
    for b in bindings:
        print(f"  {b.target.part_name}.{b.target.property_name} << ...")

    # Generate combined code
    print("\n--- Generated Generator Code ---")

    # Collect all params
    all_params = set()
    for b in bindings:
        all_params.update(b.expression.dependencies)

    print("def main():")
    print("    import math")
    print()
    print("    # Read parameters")
    for param in sorted(all_params):
        print(f'    {param.lower()} = get_userdata_by_name(op, "{param}") or 0.0')
    print()
    print("    # Apply bindings")
    for b in bindings:
        print(b.to_code())
    print()
    print("    return None")


def test_what_user_writes():
    """Show what the user would actually write."""
    print("\n" + "=" * 60)
    print("What User Writes vs What Gets Generated")
    print("=" * 60)

    user_code = '''
class FlowerOfLife(CustomObject):
    """The Flower of Life sacred geometry symbol."""

    # Parameters - what the user can control
    radius = ULength(default=100)
    distance = ULength(default=100)

    def specify_parts(self):
        self.center = Circle()
        self.petals = [Circle() for _ in range(6)]
        self.parts = [self.center, *self.petals]

    def specify_relationships(self):
        # Center circle inherits radius
        self.center.radius << self.radius

        # Petals positioned in hexagonal pattern
        for i, petal in enumerate(self.petals):
            angle = i * PI / 3
            petal.x << self.distance * cos(angle)
            petal.y << self.distance * sin(angle)
            petal.radius << self.radius
'''

    print("\n--- User Writes (specify_relationships) ---")
    print(user_code)

    print("\n--- System Generates (specify_generator_code) ---")
    generated = '''
def main():
    import math

    # Read parameters
    radius = get_userdata_by_name(op, "Radius") or 100.0
    distance = get_userdata_by_name(op, "Distance") or 100.0

    # Center circle
    child = find_child_by_name(op, "CenterCircle")
    if child:
        child[c4d.PRIM_CIRCLE_RADIUS] = radius

    # Petals
    for i in range(6):
        angle = i * math.pi / 3
        child = find_child_by_name(op, f"Petal{i}")
        if child:
            pos = child.GetRelPos()
            pos.x = distance * math.cos(angle)
            pos.y = distance * math.sin(angle)
            child.SetRelPos(pos)
            child[c4d.PRIM_CIRCLE_RADIUS] = radius

    return None
'''
    print(generated)


if __name__ == "__main__":
    test_basic_binding()
    test_flower_of_life_pattern()
    test_what_user_writes()

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("""
The << binding syntax provides:

1. MINIMAL SYNTAX
   child.property << expression

2. DECLARATIVE
   Describe WHAT relates, not HOW to wire it

3. COMPOSABLE
   Parameters work with +, -, *, /, sin(), cos(), etc.

4. AUTO-GENERATED
   System compiles relationships to generator code

Compare:
  OLD: XIdentity(part=self.circle, whole=self,
                 desc_ids=[self.circle.desc_ids["radius"]],
                 parameter=self.radius_parameter)

  NEW: self.circle.radius << self.radius
""")
