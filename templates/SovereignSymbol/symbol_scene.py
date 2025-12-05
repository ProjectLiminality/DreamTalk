"""
Symbol Scene - Renders the canonical DreamTalk for this symbol

This scene produces the visual representation (renders/symbol.gif) that
serves as the "face" of this DreamNode.
"""

# Initialize DreamTalk path resolution
from dreamtalk_init import init; init()

from DreamTalk.imports import *
from symbol_name import SymbolName


class SymbolScene(TwoDScene):
    """
    Renders the canonical symbol animation.

    The output should be a looping animation that captures the essence
    of what this symbol represents — its "DreamTalk".
    """

    def construct(self):
        # Create the symbol
        symbol = SymbolName()

        # Animate it into existence
        self.play(Create(symbol), run_time=2)

        # Hold for viewing
        self.wait(1)

        # Optional: show key behaviors
        # self.play(symbol.custom_animation(), run_time=1)

        # Optional: loop back to start for GIF
        # self.play(UnCreate(symbol), run_time=1)


# For Cinema 4D execution
if __name__ == "__main__":
    scene = SymbolScene()
