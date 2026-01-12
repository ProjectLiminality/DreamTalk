"""
Test scene for the new Text class.

Tests:
1. Basic stroked text
2. Filled text
3. 3D extruded text
"""

from DreamTalk.imports import *


class TextTestScene(ThreeDScene):
    def construct(self):
        # Test 1: Simple stroked text
        stroke_text = Text("Hello", height=80, color=WHITE, stroke_width=2)

        # Test 2: Filled text (below)
        filled_text = Text("World", height=80, filled=1, fill_color=BLUE, y=-120)

        # Test 3: 3D extruded text (to the right)
        extruded_text = Text("3D", height=100, filled=1, depth=20, fill_color=PURPLE, x=300)


if __name__ == "__main__":
    scene = TextTestScene()
