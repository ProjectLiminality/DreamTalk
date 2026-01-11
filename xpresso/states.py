"""
DreamTalk State Machines

Support for agentic holons with discrete states.

States represent relational configurations - specific parameter values
that define a mode of being. Transitions between states are animations.

Usage:
    class MindVirus(Holon):
        fold: Bipolar = 0

        class States:
            idle = State(fold=1)
            hunting = State(fold=0.5)
            attached = State(fold=-1)

    # In a Dream:
    virus = MindVirus()
    self.play(virus.transition_to(virus.States.hunting), run_time=0.5)
"""


class State:
    """
    A discrete state configuration.

    Defines specific parameter values for a mode of being.

    Args:
        **param_values: Parameter name → value mappings
    """

    def __init__(self, **param_values):
        self.param_values = param_values
        self.name = None  # Set when collected from States class

    def __repr__(self):
        if self.name:
            return f"State.{self.name}({self.param_values})"
        return f"State({self.param_values})"


class StateMachine:
    """
    Manages state transitions for a holon.

    Created automatically when a Holon has a States class defined.
    """

    def __init__(self, holon, states_class):
        """
        Initialize state machine from a States class.

        Args:
            holon: The holon this state machine controls
            states_class: The class containing State definitions
        """
        self.holon = holon
        self.states = {}
        self.current_state = None

        # Collect states from class attributes
        for name in dir(states_class):
            if name.startswith('_'):
                continue
            value = getattr(states_class, name)
            if isinstance(value, State):
                value.name = name
                self.states[name] = value

    def get_state(self, name):
        """Get a state by name."""
        return self.states.get(name)

    def transition_to(self, state):
        """
        Create animation to transition to a state.

        Args:
            state: State instance or state name

        Returns:
            AnimationGroup animating all parameters to their state values
        """
        from DreamTalk.animation.animation import ScalarAnimation
        from DreamTalk.animation.abstract_animators import AnimationGroup

        # Handle state name string
        if isinstance(state, str):
            state = self.states.get(state)
            if state is None:
                raise ValueError(f"Unknown state: {state}")

        animations = []

        for param_name, target_value in state.param_values.items():
            # Try to find the parameter on the holon
            param = None

            # Check for parameter object (e.g., fold_parameter)
            param_attr = f"{param_name}_parameter"
            if hasattr(self.holon, param_attr):
                param = getattr(self.holon, param_attr)

            # Check for parameter in parameters list
            if param is None and hasattr(self.holon, 'parameters'):
                for p in self.holon.parameters:
                    if hasattr(p, 'name') and p.name.lower() == param_name.lower():
                        param = p
                        break

            if param is not None and hasattr(param, 'desc_id'):
                # Determine the correct target object
                # In generator_mode, parameters may need to target child objects
                target_obj = self.holon

                anim = ScalarAnimation(
                    target=target_obj,
                    descriptor=param.desc_id,
                    value_fin=target_value
                )
                animations.append(anim)

                # Update the actual value
                target_obj.obj[param.desc_id] = target_value

        self.current_state = state

        if len(animations) == 0:
            return None
        elif len(animations) == 1:
            return animations[0]
        else:
            return AnimationGroup(*animations)


def collect_states(holon):
    """
    Collect states from a holon's States class.

    Called during holon initialization.

    Args:
        holon: The holon instance

    Returns:
        StateMachine if States class exists, None otherwise
    """
    states_class = getattr(holon.__class__, 'States', None)
    if states_class is None:
        return None

    return StateMachine(holon, states_class)
