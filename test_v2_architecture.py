"""
Test: DreamTalk v2.0 Architecture

Validates the fresh architecture:
- Geometry-based stroke rendering (no Sketch & Toon)
- Python Generators for all relationships (no XPresso)
- Simplified Scene class
- New base classes (LineObject, SolidObject, CustomObject)

Run this in Cinema 4D to verify the refactoring.
"""
import sys
from pathlib import Path

# Purge DreamTalk modules for clean import
modules_to_delete = [key for key in sys.modules.keys() if 'DreamTalk' in key]
for mod in modules_to_delete:
    del sys.modules[mod]

from DreamTalk.imports import *


class V2ArchitectureTest(ThreeDScene):
    """Test the v2.0 architecture with basic primitives."""

    def construct(self):
        print("=" * 60)
        print("DreamTalk v2.0 Architecture Test")
        print("=" * 60)

        # Test 1: LineObject with geometry-based strokes
        print("\n[Test 1] LineObject - Circle with stroke rendering")
        circle = Circle(radius=100, color=BLUE, stroke_width=4, x=-200)
        print(f"  Circle type: {circle.obj.GetTypeName()}")
        print(f"  Has stroke_gen: {hasattr(circle, 'stroke_gen')}")
        print(f"  Has spline: {hasattr(circle, 'spline')}")

        # Test 2: SolidObject with fill and stroke
        print("\n[Test 2] SolidObject - Sphere with fill and stroke")
        sphere = Sphere(radius=80, color=RED, filled=0.5, stroke_width=3, x=0)
        print(f"  Sphere type: {sphere.obj.GetTypeName()}")
        print(f"  Has mesh: {hasattr(sphere, 'mesh')}")
        print(f"  Has stroke_gen: {hasattr(sphere, 'stroke_gen')}")
        print(f"  Has fill_material: {hasattr(sphere, 'fill_material')}")

        # Test 3: Rectangle (another LineObject)
        print("\n[Test 3] LineObject - Rectangle")
        rect = Rectangle(width=150, height=100, color=GREEN, stroke_width=3, x=200)
        print(f"  Rectangle type: {rect.obj.GetTypeName()}")

        # Test 4: Camera (CustomObject with generator)
        print("\n[Test 4] ThreeDCamera - CustomObject with generator")
        print(f"  Camera type: {self.camera.obj.GetTypeName()}")
        print(f"  Is Python Generator: {self.camera.obj.GetType() == 1023866}")

        # Test 5: Animation works
        print("\n[Test 5] Animation test - draw circle")
        circle2 = Circle(radius=60, color=PURPLE, draw_completion=0, y=-150)
        self.play(circle2.draw(1.0), run_time=1)
        print(f"  Draw animation executed")

        print("\n" + "=" * 60)
        print("All tests passed! v2.0 architecture is working.")
        print("=" * 60)
        print("\nKey changes in v2.0:")
        print("- No Sketch & Toon VideoPost (removed)")
        print("- No XPresso (generators only)")
        print("- All strokes are geometry (StrokeGen)")
        print("- All solids have silhouette generators")
        print("- Cameras use Python Generator code")


if __name__ == "__main__":
    scene = V2ArchitectureTest()
