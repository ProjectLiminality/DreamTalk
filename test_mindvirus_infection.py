"""Test MindVirusInfection scene with partial generator_mode support"""
# Completely purge DreamTalk modules from cache before reimporting
import sys
modules_to_delete = [key for key in sys.modules.keys() if 'DreamTalk' in key]
for mod in modules_to_delete:
    del sys.modules[mod]

from pathlib import Path

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


class TestScene(ThreeDScene):
    def __init__(self):
        # Test with generator_mode for camera
        super().__init__(sketch_mode=True, generator_mode=True)

    def construct(self):
        # Simple test - just create the objects without full animation
        human = HumanMind(scale=1.0)

        # Cable anchor point
        cable_anchor = Null(z=800, name="CableOrigin")

        virus = MindVirus(
            color=BLUE,
            cable=True,
            cable_origin=cable_anchor,
            cable_radius=4,
            cable_color=WHITE,
            stroke_width=3,
            z=400,  # Start behind
            scale=0.6,
            generator_mode=True,  # Test generator mode
            name="MindVirus"
        )

        print(f"Camera type: {self.camera.obj.GetTypeName()}")
        print(f"Camera is generator: {self.camera.obj.GetType() == 1023866}")

        # Check if virus.cube has generator_mode
        print(f"Virus cube type: {virus.cube.obj.GetTypeName()}")
        print(f"Virus cube is generator: {virus.cube.obj.GetType() == 1023866}")
        print(f"Virus has fold_parameter: {hasattr(virus, 'fold_parameter')}")
        print(f"Virus generator_mode: {virus.generator_mode}")

if __name__ == "__main__":
    scene = TestScene()
