"""
Test: Binding Syntax Integration

Tests the << binding syntax in actual C4D scene.
"""

import sys
sys.path.insert(0, '/Users/davidrug/ProjectLiminality/DreamTalk')

from DreamTalk.scene import TwoDScene
from DreamTalk.objects.abstract_objects import CustomObject
from DreamTalk.objects.line_objects import Circle
from DreamTalk.xpresso.userdata import ULength
from DreamTalk.xpresso.bindings import sin, cos, PI


class SimpleFlower(CustomObject):
    """
    A simple flower pattern using the new binding syntax.

    6 circles arranged in a hexagonal pattern around a center.
    All circles share the same radius parameter.
    """

    def __init__(self, radius=50, distance=100, **kwargs):
        self._init_radius = radius
        self._init_distance = distance
        super().__init__(**kwargs)

    def specify_parts(self):
        # Create center circle and 6 petals
        self.center = Circle(name="Center")
        self.petal0 = Circle(name="Petal0")
        self.petal1 = Circle(name="Petal1")
        self.petal2 = Circle(name="Petal2")
        self.petal3 = Circle(name="Petal3")
        self.petal4 = Circle(name="Petal4")
        self.petal5 = Circle(name="Petal5")

        self.parts = [
            self.center,
            self.petal0, self.petal1, self.petal2,
            self.petal3, self.petal4, self.petal5
        ]

    def specify_parameters(self):
        self.radius_param = ULength(name="Radius", default_value=self._init_radius)
        self.distance_param = ULength(name="Distance", default_value=self._init_distance)
        self.parameters = [self.radius_param, self.distance_param]

    def specify_relationships(self):
        """Define relationships using << binding syntax."""
        # Center circle radius
        self.center.radius << self.radius_param

        # Petal 0: angle = 0
        self.petal0.x << self.distance_param * cos(0)
        self.petal0.y << self.distance_param * sin(0)
        self.petal0.radius << self.radius_param

        # Petal 1: angle = PI/3 (60 degrees)
        self.petal1.x << self.distance_param * cos(PI/3)
        self.petal1.y << self.distance_param * sin(PI/3)
        self.petal1.radius << self.radius_param

        # Petal 2: angle = 2*PI/3 (120 degrees)
        self.petal2.x << self.distance_param * cos(2*PI/3)
        self.petal2.y << self.distance_param * sin(2*PI/3)
        self.petal2.radius << self.radius_param

        # Petal 3: angle = PI (180 degrees)
        self.petal3.x << self.distance_param * cos(PI)
        self.petal3.y << self.distance_param * sin(PI)
        self.petal3.radius << self.radius_param

        # Petal 4: angle = 4*PI/3 (240 degrees)
        self.petal4.x << self.distance_param * cos(4*PI/3)
        self.petal4.y << self.distance_param * sin(4*PI/3)
        self.petal4.radius << self.radius_param

        # Petal 5: angle = 5*PI/3 (300 degrees)
        self.petal5.x << self.distance_param * cos(5*PI/3)
        self.petal5.y << self.distance_param * sin(5*PI/3)
        self.petal5.radius << self.radius_param


class TestBindingScene(TwoDScene):
    """Test scene for the binding syntax."""

    def construct(self):
        # Create flower using binding syntax
        flower = SimpleFlower(radius=50, distance=100)

        # Wait to see the result
        self.wait(1)


if __name__ == "__main__":
    scene = TestBindingScene()
