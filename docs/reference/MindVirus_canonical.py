"""
MindVirus.py - A DreamWeaving

A manipulative narrative with folding control mechanism.
The eye sees; the cube entraps. The MindVirus is a memetic entity
representing narratives that trap and control minds.

This file demonstrates the CANONICAL DreamTalk syntax as specified
in docs/SYNTAX.md. It serves as the reference implementation for
refactoring both the MindVirus DreamNode and the DreamTalk library.
"""

from dreamtalk import Holon, Dream
from dreamtalk.types import Bipolar, Color, Length, Bool
from dreamtalk.parts import Circle, FoldableCube, ImagePlane, Null, Tracer, SweepNurbs
from dreamtalk.animation import Create, AnimationGroup
from dreamtalk.constants import BLUE, WHITE, BLACK, PURPLE, PI

# Platonic geometry constants
CUBE_HALF_SIZE = 50
MOLOCH_EYE_Z = 0
CABLE_ORIGIN_Z = 500


# === Kairos: The Timeless Pattern ===

class MindVirus(Holon):
    """
    A self-replicating thought-form that attaches to minds.

    The MindVirus combines:
    - MolochEye: The control mechanism at the center (the "face")
    - FoldableCube: The narrative container built from "truths" (rectangles)

    The cube is open-topped — the illusion is incomplete but the trapped
    mind doesn't see it. The face points forward along +Z, representing
    the MindVirus's movement direction.
    """

    # Parameters - degrees of freedom
    fold: Bipolar = 0           # -1 (wrapped around) to 1 (fully open)
    color: Color = BLUE
    eye_height: Length = 35
    cable_enabled: Bool = False

    # States - discrete relational configurations
    class States:
        idle = State(fold=1)
        hunting = State(fold=0.5)
        attached = State(fold=-1)

    def specify_parts(self):
        """Define parts and their relationships to this whole."""

        # The MolochEye - at cube center
        self.eye = ImagePlane(
            path="submodules/MolochEye/MolochEye.png",
            height << self.eye_height,
            orientation="z-",
            z=MOLOCH_EYE_Z,
            name="MolochEye"
        )

        # The FoldableCube - narrative container
        # Rotated -90° so bottom faces forward (+Z)
        self.cube = FoldableCube(
            fold << self.fold,
            color << self.color,
            bottom=True,
            p=-PI/2,
            name="FoldableCube"
        )

        self.parts = [self.eye, self.cube]

        # Optional cable - connects to external anchor
        # (In full implementation, cable_origin would be passed in)
        if self.cable_enabled:
            self._setup_cable()

    def _setup_cable(self):
        """Set up the cable subsystem (conditional part)."""
        # Cable tracer connects eye to external origin
        self.cable_tracer = Tracer(
            self.eye, self.cable_origin,
            tracing_mode="objects",
            spline_type="linear",
            name="CableTracer"
        )

        self.cable_profile = Circle(
            radius=4,
            plane="xy",
            name="CableProfile"
        )

        self.cable = SweepNurbs(
            rail=self.cable_tracer,
            profile=self.cable_profile,
            start_scale=0.01,
            end_scale=0.2,
            name="Cable"
        )

        self.parts += [self.cable_tracer, self.cable_profile, self.cable]

    # Behaviors - ways of moving through Kronos

    def thrust_pulse(self, distance=100):
        """
        Jellyfish-like locomotion through the void.

        Three phases:
        1. Open (30%): Tentacles slowly open, minimal movement
        2. Thrust (20%): Tentacles close rapidly, maximum speed burst
        3. Glide (50%): Tentacles stay closed, coasting
        """
        return AnimationGroup(
            self.animate.fold.sequence(1, 0.1, 1),  # Open → thrust → closed
            self.animate.z(-distance)
        )

    def wrap(self):
        """Wrap around a target (fold goes negative)."""
        return self.animate.fold(-1)

    def enclose(self, distance=100):
        """
        Final thrust + wrap as one fluid motion.

        The tentacles open, then close while simultaneously wrapping
        (fold goes 1 → 0.1 → -1). Movement and wrapping happen together.
        """
        return AnimationGroup(
            self.animate.fold.sequence(1, 0.1, -1),
            self.animate.z(-distance)
        )


# === Kronos: The Temporal Unfolding ===

if __name__ == "__main__":

    class MindVirusDream(Dream):
        """A MindVirus awakens, pulses through the void, and hunts."""

        def unfold(self):
            # Create cable anchor point
            cable_anchor = Null(z=CABLE_ORIGIN_Z, name="CableOrigin")

            # The virus emerges
            virus = MindVirus(
                color=BLUE,
                eye_height=35,
                cable_enabled=True,
                cable_origin=cable_anchor
            )

            # Position camera at nice 3/4 angle
            self.camera.move_orbit(phi=PI*24/180, theta=PI*8/180)

            # Emerge from nothing
            self.play(Create(virus), run_time=1.5)

            # Pulse through space - jellyfish locomotion
            self.play(virus.thrust_pulse(200), run_time=1.2)
            self.play(virus.thrust_pulse(200), run_time=1.2)
            self.play(virus.thrust_pulse(200), run_time=1.2)

            # Rest
            self.wait(1)

    MindVirusDream()


# =============================================================================
# MIGRATION NOTES
# =============================================================================
#
# This file shows the IDEAL syntax. To achieve this, the DreamTalk library
# needs the following changes:
#
# 1. RENAME BASE CLASSES:
#    - CustomObject → Holon
#    - Scene → Dream
#    - construct() → unfold()
#
# 2. TYPE-HINTED PARAMETERS:
#    - Replace ULength, UBipolar, etc. with type hints
#    - Class-level declarations: `fold: Bipolar = 0`
#    - Library introspects __annotations__ to create UserData
#
# 3. INLINE BINDINGS IN specify_parts():
#    - `fold << self.fold` inside part constructor
#    - Bindings collected at part instantiation time
#    - No separate specify_relationships() needed (but still supported)
#
# 4. .animate FLUENT API:
#    - `self.animate.fold(0.5)` returns animation
#    - `self.animate.fold.sequence(1, 0.1, 1)` for multi-value
#    - `self.animate.z(-100)` for position components
#
# 5. State CLASS:
#    - `class States:` with State() instances
#    - `virus.transition_to(virus.States.hunting)` returns animation
#
# 6. SIMPLIFIED IMPORTS:
#    - `from dreamtalk import Holon, Dream`
#    - `from dreamtalk.types import Bipolar, Color, Length`
#    - `from dreamtalk.parts import Circle, FoldableCube`
#    - `from dreamtalk.animation import Create, AnimationGroup`
#
# 7. REMOVE IMPLEMENTATION DETAILS FROM API:
#    - No generator_mode flag (auto-detected)
#    - No specify_generator_code() for most holons (auto-generated)
#    - No desc_id manipulation in behaviors
#
# =============================================================================
