"""
Full migration test: MindVirusInfection with generator_mode=True

Tests:
- ThreeDCamera as Python Generator
- FoldableCube as Python Generator
- MindVirus with generator_mode (cube control via direct UserData)
- HumanMind (USD mesh - stroke_mode pending)

This validates the XPresso-free architecture for MoGraph compatibility.
"""
import sys
from pathlib import Path

# Purge DreamTalk modules for clean import
modules_to_delete = [key for key in sys.modules.keys() if 'DreamTalk' in key]
for mod in modules_to_delete:
    del sys.modules[mod]

# Bootstrap paths for all submodules
_submodules = Path(__file__).resolve().parent.parent / 'MindVirusInfection' / 'submodules'
sys.path.insert(0, str(_submodules))

from DreamTalk.imports import *

# Import sovereign symbol modules
import importlib.util

def load_dreamnode(name):
    """Load a DreamNode's main class from submodules."""
    spec = importlib.util.spec_from_file_location(
        name,
        _submodules / name / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, name)

HumanMind = load_dreamnode("HumanMind")
MindVirus = load_dreamnode("MindVirus")


class FullMigrationTestScene(ThreeDScene):
    def __init__(self):
        # generator_mode=True for camera
        super().__init__(sketch_mode=True, generator_mode=True)

    def construct(self):
        print("=== Full Migration Test ===")

        # Human mind (USD mesh)
        human = HumanMind(scale=1.0)
        print(f"HumanMind type: {human.obj.GetTypeName()}")

        # Cable anchor
        cable_anchor = Null(z=800, name="CableOrigin")

        # MindVirus with generator_mode
        virus = MindVirus(
            color=BLUE,
            cable=True,
            cable_origin=cable_anchor,
            cable_radius=4,
            cable_color=WHITE,
            stroke_width=3,
            z=400,
            scale=0.6,
            generator_mode=True,
            name="MindVirus"
        )

        # Verify generator mode
        print(f"\n=== Generator Mode Verification ===")
        print(f"Camera: {self.camera.obj.GetTypeName()} (is_gen: {self.camera.obj.GetType() == 1023866})")
        print(f"FoldableCube: {virus.cube.obj.GetTypeName()} (is_gen: {virus.cube.obj.GetType() == 1023866})")
        print(f"MindVirus generator_mode: {virus.generator_mode}")

        # Test fold animation works via generator
        print(f"\n=== Fold Parameter Test ===")
        print(f"Initial fold (cube): {virus.cube.obj[virus.cube.fold_parameter.desc_id]}")

        # Set fold to 0.5 and verify generator updates
        virus._set_fold_value(0.5)
        c4d.EventAdd()
        print(f"After setting 0.5: {virus.cube.obj[virus.cube.fold_parameter.desc_id]}")

        # Set fold to 1.0 (fully folded)
        virus._set_fold_value(1.0)
        c4d.EventAdd()
        print(f"After setting 1.0: {virus.cube.obj[virus.cube.fold_parameter.desc_id]}")

        print("\n=== Test Complete ===")
        print("Scene created with XPresso-free architecture!")
        print("FoldableCube and ThreeDCamera use Python Generators")


if __name__ == "__main__":
    scene = FullMigrationTestScene()
