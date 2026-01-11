"""
test_clean_imports.py - Test the clean dreamtalk.py import syntax (Phase 6)

This tests the canonical import pattern:

    from DreamTalk.dreamtalk import *

Which provides clean, philosophical naming for all core DreamTalk concepts.
"""

# The canonical import - clean and readable
from DreamTalk.dreamtalk import *


class PulsingOrb(Holon):
    """
    A simple holon demonstrating the canonical syntax.

    All imports come from the clean dreamtalk module:
    - Holon for the base class
    - Completion for the parameter type
    - Circle for geometry
    - State for state machine
    """

    # Type-hinted parameter
    pulse: Completion = 0.5

    # State machine
    class States:
        expanded = State(pulse=1.0)
        contracted = State(pulse=0.2)

    def specify_parts(self):
        # Inline binding with >> syntax
        self.orb = Circle(radius=self.pulse_parameter >> 50, color=BLUE)
        self.parts = [self.orb]


class CleanImportTest(Dream):
    """Test the clean import syntax with a full scene."""

    def unfold(self):
        # Create the holon
        orb = PulsingOrb()

        # Use state machine
        self.play(orb.transition_to(PulsingOrb.States.expanded), run_time=1)
        self.play(orb.transition_to(PulsingOrb.States.contracted), run_time=1)

        # Use fluent animation
        self.play(orb.animate.pulse(0.5), run_time=0.5)

        self.wait(0.5)


if __name__ == "__main__":
    CleanImportTest()
