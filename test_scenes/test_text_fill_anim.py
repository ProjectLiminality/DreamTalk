"""
Test scene for Text fill animation with holes.
Tests that letters like O, D properly animate fill with holes preserved.
"""

from DreamTalk.imports import *


class TextFillAnimScene(ThreeDScene):
    def construct(self):
        # Create text with letters that have holes (O, D, a)
        title = Text("DreamTalk", height=100, filled=0, fill_color=BLUE, color=WHITE)

        # Animate fill from 0 to 1 over 2 seconds
        self.play(title.fill(1), run_time=2)


if __name__ == "__main__":
    scene = TextFillAnimScene()
