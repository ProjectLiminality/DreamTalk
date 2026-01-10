"""Test ThreeDCamera with generator_mode=True"""
# Completely purge DreamTalk modules from cache before reimporting
import sys
modules_to_delete = [key for key in sys.modules.keys() if 'DreamTalk' in key]
for mod in modules_to_delete:
    del sys.modules[mod]

from DreamTalk.imports import *

class TestScene(ThreeDScene):
    def __init__(self):
        super().__init__(sketch_mode=True, generator_mode=True)

    def construct(self):
        # Create a simple cube to have something to look at
        cube = FoldableCube(color=BLUE)

        print(f"Camera type: {self.camera.obj.GetType()}")
        print(f"Is Python Generator: {self.camera.obj.GetType() == 1023866}")
        print(f"Camera obj name: {self.camera.obj.GetName()}")

        # Test camera orbiting
        print("Testing camera orbit movement...")

if __name__ == "__main__":
    scene = TestScene()
