"""
test_inline_bindings.py - Test inline binding syntax (Phase 3)

This tests the >> operator for inline bindings in part constructors:

    class Pulse(Holon):
        size: Length = 100

        def specify_parts(self):
            # Inline binding: circle radius bound to size parameter
            self.circle = Circle(radius=self.size_parameter >> 100)
            self.parts = [self.circle]

The >> operator creates a BoundValue that:
1. Uses the default value (100) for initial construction
2. Stores the binding for compilation into generator code

This is more concise than the separate specify_relationships() approach.
"""

from DreamTalk.imports import *


class InlinePulse(Holon):
    """
    A holon using inline binding syntax.

    The circle's radius is bound to the size parameter using >>.
    """
    # Type-hinted parameter
    size: Length = 100

    def specify_parts(self):
        # Inline binding: circle radius <- size parameter
        # The >> operator means: "bind this, using 100 as default"
        self.circle = Circle(radius=self.size_parameter >> 100)
        self.parts = [self.circle]


class InlineBindingTest(Dream):
    """Test the inline binding syntax."""

    def unfold(self):
        # Create a pulse with inline binding
        pulse = InlinePulse()

        # The size parameter should control the circle radius
        # Animate size from 100 to 200 to 50
        self.play(pulse.animate.size(200), run_time=1)
        self.play(pulse.animate.size(50), run_time=1)
        self.play(pulse.animate.size(100), run_time=0.5)

        self.wait(0.5)


if __name__ == "__main__":
    InlineBindingTest()
