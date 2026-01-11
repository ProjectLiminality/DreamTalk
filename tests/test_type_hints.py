"""
test_type_hints.py - Test type-hinted parameter system (Phase 2)

This tests the canonical syntax where class annotations auto-create UserData:

    class MindVirus(Holon):
        fold: Bipolar = 0
        color: Color = BLUE
        size: Length = 100

These annotations should automatically translate to C4D UserData
with appropriate type, range, and unit settings.

The test creates a simple "pulsing" holon that has:
- expansion: Completion (0-1) controlling circle radius
- phase: Angle (0-2π) for animation offset

The circle radius is bound to expansion, and we animate it.
"""

from DreamTalk.imports import *


class Pulse(Holon):
    """
    A simple holon with type-hinted parameters.

    This tests the canonical syntax - no need for specify_parameters()
    because the annotations auto-create the UserData.
    """
    # Type-hinted parameters - these auto-create UserData!
    expansion: Completion = 0.5
    phase: Angle = 0

    def specify_parts(self):
        # A circle whose radius responds to expansion
        self.circle = Circle(radius=100, color=WHITE)
        self.parts = [self.circle]

    def specify_relationships(self):
        # Bind circle radius to expansion (scaled by 100)
        # radius = expansion * 100
        self.circle.radius << self.expansion_parameter * 100


class TypeHintTest(Dream):
    """Test the type-hinted parameter system."""

    def unfold(self):
        # Create a Pulse holon
        pulse = Pulse()

        # The expansion_parameter should have been auto-created
        # Let's animate it from 0.5 to 1 and back to 0.2
        self.play(pulse.animate.expansion(1.0), run_time=1)
        self.play(pulse.animate.expansion(0.2), run_time=1)
        self.play(pulse.animate.expansion(0.5), run_time=0.5)

        self.wait(0.5)


if __name__ == "__main__":
    TypeHintTest()
