"""
Breath.py - A State Machine Test

A circle that breathes between contraction and expansion.
The simplest holon with states - yet it contains the fundamental rhythm:
    systole/diastole, inhale/exhale, tension/release.

This test validates:
1. State class definition within a Holon
2. State machine collection on __init__
3. transition_to() returning animations
4. Multiple states with different parameter values

But more deeply, it demonstrates:
- States are not just parameter snapshots, they are modes of BEING
- The transition IS the life - a holon frozen in one state is dead
- Rhythm emerges from the oscillation between complementary states
"""

from DreamTalk.imports import *


class Breath(Holon):
    """A breathing circle - the simplest rhythm."""

    class States:
        inhale = State(expansion=1.0)
        exhale = State(expansion=0.3)

    def __init__(self, radius=100, **kwargs):
        self.radius = radius
        super().__init__(**kwargs)

    def specify_parts(self):
        self.circle = Circle(radius=self.radius, color=WHITE)
        self.parts = [self.circle]

    def specify_parameters(self):
        self.expansion_param = UCompletion(name="expansion", default_value=0.5)
        self.parameters = [self.expansion_param]

    def specify_generator_code(self):
        return '''
def main():
    expansion = get_userdata_by_name(op, "expansion")
    child = op.GetDown()
    while child:
        # Scale the circle based on expansion
        scale = 0.5 + expansion * 0.5  # 0.5 to 1.0
        child.SetAbsScale(c4d.Vector(scale, scale, scale))
        child = child.GetNext()
    return None
'''


if __name__ == "__main__":

    class BreathDream(Dream):
        """
        Watch a circle breathe.

        The implication: all life is oscillation between states.
        A single breath contains the pattern of all rhythms.
        """

        def unfold(self):
            breath = Breath(radius=150)

            # Begin in exhale (contracted)
            self.play(breath.transition_to(Breath.States.exhale), run_time=0.5)

            # Three breaths - the minimum to establish rhythm
            for _ in range(3):
                self.play(breath.transition_to(Breath.States.inhale), run_time=1.2)
                self.play(breath.transition_to(Breath.States.exhale), run_time=1.0)

            # End expanded - potential, not closure
            self.play(breath.transition_to(Breath.States.inhale), run_time=1.5)
            self.wait(0.5)

    BreathDream()
