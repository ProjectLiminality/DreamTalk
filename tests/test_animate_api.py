"""
test_animate_api.py - Test the fluent .animate API

Tests:
1. Basic parameter animation: circle.animate.x(100)
2. Sequence animation: breath.animate.expansion.sequence(0, 1, 0)
3. Chained animations: circle.animate.x(100).y(50)
4. UserData parameter animation via name lookup

The fluent API should make animations more readable:
    # Old style
    self.play(Move(circle, x=100), run_time=1)

    # New fluent style
    self.play(circle.animate.x(100), run_time=1)
"""

from DreamTalk.imports import *


class AnimateAPITest(Dream):
    """Test the fluent animation API."""

    def unfold(self):
        # Create a simple circle
        circle = Circle(radius=100, color=WHITE)

        # Test 1: Basic position animation using .animate
        self.play(circle.animate.x(150), run_time=1)

        # Test 2: Chain x and y
        self.play(circle.animate.x(-150).y(100), run_time=1)

        # Test 3: Back to center
        self.play(circle.animate.x(0).y(0), run_time=0.5)

        self.wait(0.5)


if __name__ == "__main__":
    AnimateAPITest()
