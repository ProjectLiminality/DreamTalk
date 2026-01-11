"""
DreamTalk Fluent Animation API

Provides the .animate property pattern inspired by Manim:

    # Animate a single parameter to a value
    self.play(virus.animate.fold(0.5), run_time=1)

    # Chain multiple parameter animations
    self.play(
        virus.animate.fold(0.5).scale(2),
        run_time=1.5
    )

    # Animate through a sequence of values
    self.play(virus.animate.fold.sequence(1, 0.1, 1), run_time=2)

    # Animate position components
    self.play(virus.animate.x(100).y(50), run_time=1)

The fluent API makes animations more readable and composable.
It generates the same ScalarAnimation/VectorAnimation objects
under the hood, but with cleaner syntax.
"""

import c4d
from DreamTalk.animation.animation import ScalarAnimation, VectorAnimation, AnimationGroup


class AnimatorProxy:
    """
    Proxy object returned by holon.animate

    Provides attribute access that returns ParameterAnimator objects
    for fluent animation building.

    Usage:
        virus.animate.fold(0.5)  # Returns animation for fold parameter
        virus.animate.x(100)     # Returns animation for x position
    """

    def __init__(self, target):
        self.target = target
        self._animations = []

    def __getattr__(self, name):
        """Return a ParameterAnimator for the named parameter."""
        # Avoid recursion on special attributes
        if name.startswith('_'):
            raise AttributeError(name)
        # Don't intercept attributes that Scene.get_animation checks for
        if name in ('scalar_animations', 'execute'):
            raise AttributeError(name)
        return ParameterAnimator(self.target, name, self)

    def _add_animation(self, animation):
        """Add an animation to the chain."""
        self._animations.append(animation)

    @property
    def animations(self):
        """
        Return all chained animations as an AnimationGroup.

        This property is used by Scene.get_animation() to extract
        the animations for playback.
        """
        if len(self._animations) == 0:
            return AnimationGroup()
        if len(self._animations) == 1:
            return self._animations[0]
        return AnimationGroup(*self._animations)


class ParameterAnimator:
    """
    Animator for a specific parameter.

    Can be called to animate to a value, or accessed for .sequence()
    to animate through multiple values.

    Usage:
        virus.animate.fold(0.5)           # Animate fold to 0.5
        virus.animate.fold.sequence(1, 0) # Animate fold through 1, then 0
    """

    def __init__(self, target, param_name, proxy=None):
        self.target = target
        self.param_name = param_name
        self.proxy = proxy

    def __call__(self, value, relative=False):
        """
        Animate the parameter to a single value.

        Args:
            value: Target value to animate to
            relative: If True, add to current value instead of setting absolute

        Returns:
            AnimatorProxy for chaining, or ScalarAnimation if not chaining
        """
        desc_id = self._get_desc_id()
        if desc_id is None:
            raise ValueError(f"Parameter '{self.param_name}' not found on {self.target}")

        animation = ScalarAnimation(
            target=self.target,
            descriptor=desc_id,
            value_fin=value,
            relative=relative
        )

        # Update the actual value on the object
        self.target.obj[desc_id] = value

        if self.proxy:
            self.proxy._add_animation(animation)
            return self.proxy
        return animation

    def sequence(self, *values):
        """
        Animate through a sequence of values.

        Each value gets an equal portion of the total run_time.

        Args:
            *values: Values to animate through in order

        Returns:
            AnimationGroup containing the sequenced animations

        Example:
            virus.animate.fold.sequence(1, 0.1, 1)  # Open, close, open
        """
        desc_id = self._get_desc_id()
        if desc_id is None:
            raise ValueError(f"Parameter '{self.param_name}' not found on {self.target}")

        animations = []
        n = len(values)

        for i, value in enumerate(values):
            anim = ScalarAnimation(
                target=self.target,
                descriptor=desc_id,
                value_fin=value,
                rel_start=i / n,
                rel_stop=(i + 1) / n
            )
            animations.append(anim)

        # Set final value on object
        if values:
            self.target.obj[desc_id] = values[-1]

        animation_group = AnimationGroup(*animations)

        if self.proxy:
            self.proxy._add_animation(animation_group)
            return self.proxy
        return animation_group

    def _get_desc_id(self):
        """
        Get the C4D DescID for this parameter.

        Checks in order:
        1. UserData parameter with matching name (e.g., fold_parameter)
        2. Built-in position/rotation/scale components (x, y, z, h, p, b)
        3. UserData by searching the container
        """
        # Check for parameter object attribute (e.g., self.fold_parameter)
        param_attr = self.param_name + '_parameter'
        if hasattr(self.target, param_attr):
            param = getattr(self.target, param_attr)
            if hasattr(param, 'desc_id'):
                return param.desc_id

        # Check for direct desc_id attribute (e.g., self.fold_id)
        id_attr = self.param_name + '_id'
        if hasattr(self.target, id_attr):
            return getattr(self.target, id_attr)

        # Handle built-in position components
        position_map = {
            'x': (c4d.ID_BASEOBJECT_POSITION, c4d.VECTOR_X),
            'y': (c4d.ID_BASEOBJECT_POSITION, c4d.VECTOR_Y),
            'z': (c4d.ID_BASEOBJECT_POSITION, c4d.VECTOR_Z),
        }
        if self.param_name in position_map:
            base, component = position_map[self.param_name]
            return c4d.DescID(
                c4d.DescLevel(base, c4d.DTYPE_VECTOR, 0),
                c4d.DescLevel(component, c4d.DTYPE_REAL, 0)
            )

        # Handle built-in rotation components
        rotation_map = {
            'h': (c4d.ID_BASEOBJECT_ROTATION, c4d.VECTOR_X),
            'p': (c4d.ID_BASEOBJECT_ROTATION, c4d.VECTOR_Y),
            'b': (c4d.ID_BASEOBJECT_ROTATION, c4d.VECTOR_Z),
        }
        if self.param_name in rotation_map:
            base, component = rotation_map[self.param_name]
            return c4d.DescID(
                c4d.DescLevel(base, c4d.DTYPE_VECTOR, 0),
                c4d.DescLevel(component, c4d.DTYPE_REAL, 0)
            )

        # Handle built-in scale components
        scale_map = {
            'scale_x': (c4d.ID_BASEOBJECT_SCALE, c4d.VECTOR_X),
            'scale_y': (c4d.ID_BASEOBJECT_SCALE, c4d.VECTOR_Y),
            'scale_z': (c4d.ID_BASEOBJECT_SCALE, c4d.VECTOR_Z),
        }
        if self.param_name in scale_map:
            base, component = scale_map[self.param_name]
            return c4d.DescID(
                c4d.DescLevel(base, c4d.DTYPE_VECTOR, 0),
                c4d.DescLevel(component, c4d.DTYPE_REAL, 0)
            )

        # Handle uniform scale
        if self.param_name == 'scale':
            # For uniform scale, we'd need to return multiple animations
            # For now, just use scale_x as proxy
            return c4d.DescID(
                c4d.DescLevel(c4d.ID_BASEOBJECT_SCALE, c4d.DTYPE_VECTOR, 0),
                c4d.DescLevel(c4d.VECTOR_X, c4d.DTYPE_REAL, 0)
            )

        # Search UserData by name
        if hasattr(self.target, 'obj'):
            ud = self.target.obj.GetUserDataContainer()
            for desc_id, bc in ud:
                if bc[c4d.DESC_NAME] == self.param_name:
                    return desc_id

        return None


class VectorAnimatorProxy:
    """
    Proxy for animating vector parameters (position, rotation, scale).

    Usage:
        virus.animate.position(100, 50, 0)
        virus.animate.rotation(h=PI/4)
    """

    def __init__(self, target, vector_type):
        self.target = target
        self.vector_type = vector_type  # 'position', 'rotation', 'scale'

    def __call__(self, x=None, y=None, z=None, vector=None, relative=False):
        """Animate the vector to target values."""
        if vector is not None:
            if isinstance(vector, c4d.Vector):
                x, y, z = vector.x, vector.y, vector.z
            else:
                x, y, z = vector

        descriptors = {
            'position': c4d.ID_BASEOBJECT_POSITION,
            'rotation': c4d.ID_BASEOBJECT_ROTATION,
            'scale': c4d.ID_BASEOBJECT_SCALE,
        }

        descriptor = descriptors.get(self.vector_type)
        if descriptor is None:
            raise ValueError(f"Unknown vector type: {self.vector_type}")

        # Get current values for any unspecified components
        current = self.target.obj[descriptor]
        if x is None:
            x = current.x
        if y is None:
            y = current.y
        if z is None:
            z = current.z

        target_vector = c4d.Vector(x, y, z)

        animation = VectorAnimation(
            target=self.target,
            descriptor=descriptor,
            vector=target_vector,
            relative=relative
        )

        self.target.obj[descriptor] = target_vector

        return animation
