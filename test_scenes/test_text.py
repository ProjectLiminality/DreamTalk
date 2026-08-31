"""
Test scene for the new Text class.

Tests:
1. Basic stroked text
2. Filled text
3. 3D extruded text with depth parameter
"""

from DreamTalk.imports import *


class TextTestScene(ThreeDScene):
    def construct(self):
        # Test 1: Simple stroked text (left)
        stroke_text = Text("Hello", height=80, color=WHITE, stroke_width=2, x=-300)

        # Test 2: Filled text (center)
        filled_text = Text("World", height=80, filled=1, fill_color=BLUE)

        # Test 3: 3D extruded text with explicit depth (right)
        extruded_text = Text("3D", height=100, filled=1, depth=50, fill_color=PURPLE, x=300)


if __name__ == "__main__":
    scene = TextTestScene()
