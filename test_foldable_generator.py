"""Test FoldableCube with generator_mode=True"""
# Completely purge DreamTalk modules from cache before reimporting
import sys
modules_to_delete = [key for key in sys.modules.keys() if 'DreamTalk' in key]
for mod in modules_to_delete:
    del sys.modules[mod]

from DreamTalk.imports import *

class TestScene(ThreeDScene):
    def __init__(self):
        super().__init__(sketch_mode=True)

    def construct(self):
        # Test FoldableCube with generator_mode=True
        cube = FoldableCube(color=BLUE, generator_mode=True)

        print(f"Cube obj type: {cube.obj.GetType()}")  # Should be 1023866 (Python Generator)
        print(f"Is Python Generator: {cube.obj.GetType() == 1023866}")
        print(f"Cube obj name: {cube.obj.GetName()}")

        # Check if gen attribute exists
        if hasattr(cube, 'gen'):
            print(f"cube.gen type: {cube.gen.GetType()}")
            print(f"cube.gen is same as cube.obj: {cube.gen is cube.obj}")
        else:
            print("cube.gen does not exist!")

        # Check fold parameter
        print(f"fold_parameter desc_id: {cube.fold_parameter.desc_id}")

        # Try setting fold value
        cube.obj[cube.fold_parameter.desc_id] = 0.5
        c4d.EventAdd()

        print("SUCCESS: Test completed")

if __name__ == "__main__":
    scene = TestScene()
