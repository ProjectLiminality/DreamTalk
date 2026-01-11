"""
DreamTalk Camera Objects - Fresh Architecture (v2.0)

Camera/Observer classes for DreamTalk dreams.
All use Python Generators for parameter relationships (no XPresso).

Classes:
- Camera: Basic C4D camera object (internal)
- Observer: Unified observer with 2D and 3D capabilities
- TwoDCamera: Legacy alias (use Observer instead)
- ThreeDCamera: Legacy alias (use Observer instead)

Philosophy:
The Observer is the consciousness perceiving the dream.
A "2D scene" is simply an Observer looking at the XY plane.
A "3D scene" uses the same Observer with orbital controls.
There is no fundamental distinction - just different configurations.
"""

from DreamTalk.objects.abstract_objects import ProtoObject, CustomObject
from DreamTalk.objects.custom_objects import Group
from DreamTalk.objects.helper_objects import Null
from DreamTalk.xpresso.userdata import ULength, UCompletion, UAngle
from DreamTalk.animation.animation import ScalarAnimation, VectorAnimation, AnimationGroup
from DreamTalk.constants import ASPECT_RATIO, PI
import c4d


class Camera(ProtoObject):
    """Basic Cinema 4D camera."""

    def __init__(self, projection="perspective", **kwargs):
        self.projection = projection
        super().__init__(**kwargs)

    def set_object_properties(self):
        projection_types = {
            "perspective": 0,
            "front": 4,
        }
        self.obj[c4d.CAMERA_PROJECTION] = projection_types[self.projection]

    def specify_object(self):
        self.obj = c4d.BaseObject(c4d.Ocamera)

    def set_unique_desc_ids(self):
        self.desc_ids = {
            "zoom": c4d.DescID(c4d.DescLevel(c4d.CAMERA_ZOOM, c4d.DTYPE_REAL, 0))
        }


class TwoDCamera(CustomObject):
    """
    2D orthographic camera with zoom control.

    Uses a Python Generator to compute camera zoom from frame width.
    The relationship is: zoom = 1023 / FrameWidth

    Args:
        frame_width: Width of the visible frame in scene units (default 500)
    """

    def __init__(self, frame_width=500, **kwargs):
        self.frame_width = frame_width
        super().__init__(**kwargs)

    def specify_parts(self):
        self.camera = Camera(projection="front", z=-1000)
        self.parts = [self.camera]

    def specify_parameters(self):
        self.frame_width_parameter = ULength(
            name="FrameWidth", default_value=self.frame_width)
        self.parameters = [self.frame_width_parameter]

    def specify_generator_code(self):
        """Compute camera zoom from frame width."""
        return '''
def main():
    frame_width = get_userdata_by_name(op, "FrameWidth") or 500.0

    # Zoom relation: zoom = 1023 / FrameWidth
    if frame_width > 0:
        zoom = 1023.0 / frame_width
    else:
        zoom = 1.0

    # Find and update Camera child
    child = op.GetDown()
    while child:
        if child.GetName() == "Camera" or child.GetType() == 5103:
            child[c4d.CAMERA_ZOOM] = zoom
            break
        child = child.GetNext()

    return None
'''

    def focus_on(self, target, border=0.2):
        """Move and zoom to frame the target object."""
        center = target.get_center()
        radius = target.get_radius()
        if radius[0] <= radius[1]:
            self.frame_width = 2 * radius[1] * (1 + border) * ASPECT_RATIO
        else:
            self.frame_width = 2 * radius[0] * (1 + border)

        desc_id = self.frame_width_parameter.desc_id
        move_animation = self.move(x=center[0], y=center[1])
        zoom_animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=self.frame_width)
        self.obj[desc_id] = self.frame_width
        animation = AnimationGroup(move_animation, zoom_animation)
        return animation

    def zoom(self, frame_width=None, **kwargs):
        """Animate zoom to frame_width."""
        if frame_width is None:
            frame_width = self.frame_width
        desc_id = self.frame_width_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=frame_width, **kwargs)
        self.obj[desc_id] = frame_width
        return animation


class ThreeDCamera(CustomObject):
    """
    3D perspective camera with spherical orbit control.

    Uses a Python Generator to implement orbital camera behavior:
    - Phi (heading): rotation around Y axis
    - Theta (pitch): elevation angle
    - Radius: distance from focus point
    - Tilt (bank): camera roll
    - FocusPoint: where the camera looks at

    The camera position is interpolated between the orbit point and focus point
    based on ZoomFactor, which is derived from FrameWidth / Radius.

    Args:
        frame_width: Width of the visible frame at focus distance (default 500)
        phi: Horizontal orbit angle in radians (default 0)
        theta: Vertical orbit angle in radians (default PI/8)
        tilt: Camera bank/roll in radians (default 0)
        radius: Distance from orbit center (default 1000)
        focus_point_x/y/z: Focus point coordinates (default 0, 0, 0)
    """

    def __init__(self, frame_width=500, phi=0, theta=PI/8, tilt=0, radius=1000,
                 focus_point_x=0, focus_point_y=0, focus_point_z=0, **kwargs):
        self.frame_width = frame_width
        self.phi = phi
        self.theta = theta
        self.tilt = tilt
        self.radius = radius
        self.focus_point_x = focus_point_x
        self.focus_point_y = focus_point_y
        self.focus_point_z = focus_point_z
        super().__init__(**kwargs)

    def specify_parts(self):
        self.camera = Camera()
        self.origin = Group(name="Origin")
        self.orbit_point = Null(name="OrbitPoint")
        self.origin.add(self.orbit_point)
        self.focus_point = Null(name="FocusPoint")
        self.parts = [self.camera, self.origin, self.orbit_point, self.focus_point]

    def specify_parameters(self):
        self.frame_width_parameter = ULength(name="FrameWidth", default_value=self.frame_width)
        self.phi_parameter = UAngle(name="Phi", default_value=self.phi)
        self.theta_parameter = UAngle(name="Theta", default_value=self.theta)
        self.tilt_parameter = UAngle(name="Tilt", default_value=self.tilt)
        self.radius_parameter = ULength(name="Radius", default_value=self.radius)
        self.focus_point_x_parameter = ULength(name="FocusPointX", default_value=self.focus_point_x)
        self.focus_point_y_parameter = ULength(name="FocusPointY", default_value=self.focus_point_y)
        self.focus_point_z_parameter = ULength(name="FocusPointZ", default_value=self.focus_point_z)
        self.parameters = [
            self.frame_width_parameter,
            self.phi_parameter, self.theta_parameter, self.tilt_parameter,
            self.radius_parameter,
            self.focus_point_x_parameter, self.focus_point_y_parameter, self.focus_point_z_parameter
        ]

    def specify_generator_code(self):
        """
        Compute camera orbital position and orientation.

        The orbit system uses spherical coordinates:
        - Camera orbits around focus point at given radius
        - Phi rotates around Y axis, Theta elevates
        - Camera always looks at focus point
        """
        return '''
def main():
    # Read parameters
    frame_width = get_userdata_by_name(op, "FrameWidth") or 500.0
    phi = get_userdata_by_name(op, "Phi") or 0.0
    theta = get_userdata_by_name(op, "Theta") or 0.0
    tilt = get_userdata_by_name(op, "Tilt") or 0.0
    radius = get_userdata_by_name(op, "Radius") or 1000.0
    focus_x = get_userdata_by_name(op, "FocusPointX") or 0.0
    focus_y = get_userdata_by_name(op, "FocusPointY") or 0.0
    focus_z = get_userdata_by_name(op, "FocusPointZ") or 0.0

    focus_pos = c4d.Vector(focus_x, focus_y, focus_z)

    # Calculate camera position on sphere around focus point
    # Spherical to Cartesian: camera orbits focus_pos
    # phi = azimuth (rotation around Y), theta = elevation
    cos_phi = math.cos(phi)
    sin_phi = math.sin(phi)
    cos_theta = math.cos(theta)
    sin_theta = math.sin(theta)

    # Camera offset from focus point (spherical coords)
    # At phi=0, theta=0: camera is at (0, 0, -radius) relative to focus (looking at focus from front)
    cam_offset_x = radius * cos_theta * sin_phi
    cam_offset_y = radius * sin_theta
    cam_offset_z = -radius * cos_theta * cos_phi

    camera_pos = focus_pos + c4d.Vector(cam_offset_x, cam_offset_y, cam_offset_z)

    # Apply transformations to children
    child = op.GetDown()
    while child:
        name = child.GetName()

        if name == "Origin":
            child.SetRelRot(c4d.Vector(-theta, phi, tilt))

        elif name == "FocusPoint":
            child.SetRelPos(focus_pos)

        elif name == "Camera":
            child.SetAbsPos(camera_pos)

            # Make camera look at focus point using C4D's built-in matrix utilities
            dir_vec = focus_pos - camera_pos
            if dir_vec.GetLength() > 0.001:
                # Build a look-at matrix
                # Z axis points from camera toward target (C4D cameras look down +Z after rotation)
                z_axis = dir_vec.GetNormalized()

                # Use world up as reference for right vector
                world_up = c4d.Vector(0, 1, 0)
                x_axis = world_up.Cross(z_axis).GetNormalized()

                # Recalculate up to be orthogonal
                y_axis = z_axis.Cross(x_axis).GetNormalized()

                # Build rotation matrix (camera looks down +Z in its local space after this)
                look_matrix = c4d.Matrix()
                look_matrix.v1 = x_axis  # right
                look_matrix.v2 = y_axis  # up
                look_matrix.v3 = z_axis  # forward (toward target)

                # Convert matrix to HPB and apply tilt
                hpb = c4d.utils.MatrixToHPB(look_matrix)
                hpb.z = tilt  # Apply bank/tilt
                child.SetAbsRot(hpb)

        child = child.GetNext()

    # Set OrbitPoint position (nested under Origin)
    origin = find_child_by_name(op, "Origin")
    if origin:
        orbit_child = find_child_by_name(origin, "OrbitPoint")
        if orbit_child:
            orbit_child.SetRelPos(c4d.Vector(0, 0, -radius))

    return None
'''

    def move_focus(self, x=None, y=None, z=None, **kwargs):
        """Animate focus point movement."""
        if x is None:
            x = self.focus_point_x
        if y is None:
            y = self.focus_point_y
        if z is None:
            z = self.focus_point_z
        desc_ids = [
            self.focus_point_x_parameter.desc_id,
            self.focus_point_y_parameter.desc_id,
            self.focus_point_z_parameter.desc_id
        ]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=[x, y, z], **kwargs)
        self.obj[desc_ids[0]] = x
        self.obj[desc_ids[1]] = y
        self.obj[desc_ids[2]] = z
        return animation

    def zoom(self, frame_width=None, **kwargs):
        """Animate zoom."""
        if frame_width is None:
            frame_width = self.frame_width
        desc_id = self.frame_width_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=frame_width, **kwargs)
        self.obj[desc_id] = frame_width
        return animation

    def move_orbit(self, phi=None, theta=None, radius=None, tilt=None, direction=None, **kwargs):
        """Animate orbital camera movement."""
        if phi is None:
            phi = self.phi
        if theta is None:
            theta = self.theta
        if radius is None:
            radius = self.radius
        if tilt is None:
            tilt = self.tilt

        # Shorthand directions
        directions = {
            "front": (0, 0),
            "back": (PI, 0),
            "left": (-PI/2, 0),
            "right": (PI/2, 0),
            "top": (0, PI/2),
            "bottom": (0, -PI/2),
        }
        if direction in directions:
            phi, theta = directions[direction]

        desc_ids = [
            self.phi_parameter.desc_id,
            self.theta_parameter.desc_id,
            self.radius_parameter.desc_id,
            self.tilt_parameter.desc_id
        ]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=[phi, theta, radius, tilt], **kwargs)
        self.obj[desc_ids[0]] = phi
        self.obj[desc_ids[1]] = theta
        self.obj[desc_ids[2]] = radius
        self.obj[desc_ids[3]] = tilt
        return animation

    def look_at(self, target, zoom=True, border=0.2):
        """Move focus to target and optionally zoom to fit."""
        center = target.get_center()
        move_animation = self.move_focus(x=center[0], y=center[1], z=center[2])
        if zoom:
            target_radius = target.get_radius()
            import math
            self.frame_width = math.sqrt(target_radius.x**2 + target_radius.y**2 + target_radius.z**2) * (1 + border) / 2
            zoom_animation = self.zoom(frame_width=self.frame_width)
            return AnimationGroup(move_animation, zoom_animation)
        return move_animation

    def focus_on(self, target, direction="front", zoom=True, border=0.2, center=None):
        """Move focus, rotate to direction, and optionally zoom."""
        directions = {
            "front": (0, 0),
            "back": (PI, 0),
            "left": (-PI/2, 0),
            "right": (PI/2, 0),
            "top": (0, PI/2),
            "bottom": (0, -PI/2),
        }
        phi, theta = directions.get(direction, (0, 0))

        animations = []
        if zoom:
            target_radius = target.get_radius()
            import math
            self.frame_width = 2 * math.sqrt(target_radius.x**2 + target_radius.y**2 + target_radius.z**2) * (1 + border)
            animations.append(self.zoom(frame_width=self.frame_width))

        if center is None:
            center = target.get_center()
        animations.append(self.move(x=center[0], y=center[1], z=center[2]))
        animations.append(self.move_orbit(phi=phi, theta=theta))

        return AnimationGroup(*animations)

    def follow(self, target):
        """Set focus point to target's current position."""
        pos = target.obj.GetAbsPos()
        self.obj[self.focus_point_x_parameter.desc_id] = pos.x
        self.obj[self.focus_point_y_parameter.desc_id] = pos.y
        self.obj[self.focus_point_z_parameter.desc_id] = pos.z


# =============================================================================
# OBSERVER - Unified camera for all dreams
# =============================================================================

class Observer(CustomObject):
    """
    The consciousness perceiving the dream.

    A unified observer that works for both 2D and 3D dreams.
    - For 2D work: use pan() and zoom() - the observer looks at the XY plane
    - For 3D work: use orbit(), dolly(), and full spherical controls

    There is no fundamental distinction between 2D and 3D - just different
    configurations of the same observer. A "2D scene" is simply an observer
    positioned perpendicular to the XY plane.

    Args:
        frame_width: Width of the visible frame at focus distance (default 500)
        phi: Horizontal orbit angle in radians (default 0 = front view)
        theta: Vertical orbit angle in radians (default 0 = level)
        tilt: Camera bank/roll in radians (default 0)
        radius: Distance from focus point (default 1000)
        focus: Focus point as (x, y, z) tuple (default origin)
        projection: "perspective" or "orthographic" (default "perspective")

    For 2D-style work:
        observer = Observer()  # Defaults work for 2D
        observer.pan(x=100, y=50)
        observer.zoom(frame_width=300)

    For 3D-style work:
        observer = Observer(theta=PI/8)  # Slight elevation
        observer.orbit(phi=PI/4, theta=PI/6)
        observer.dolly(radius=1500)
    """

    def __init__(self, frame_width=500, phi=0, theta=0, tilt=0, radius=1000,
                 focus=(0, 0, 0), projection="perspective", **kwargs):
        self.frame_width = frame_width
        self.phi = phi
        self.theta = theta
        self.tilt = tilt
        self.radius = radius
        self.focus_point_x = focus[0] if isinstance(focus, (tuple, list)) else 0
        self.focus_point_y = focus[1] if isinstance(focus, (tuple, list)) else 0
        self.focus_point_z = focus[2] if isinstance(focus, (tuple, list)) else 0
        self.projection = projection
        super().__init__(**kwargs)

    def specify_parts(self):
        proj = "front" if self.projection == "orthographic" else "perspective"
        self.camera = Camera(projection=proj)
        self.origin = Group(name="Origin")
        self.orbit_point = Null(name="OrbitPoint")
        self.origin.add(self.orbit_point)
        self.focus_null = Null(name="FocusPoint")
        self.parts = [self.camera, self.origin, self.orbit_point, self.focus_null]

    def specify_parameters(self):
        self.frame_width_parameter = ULength(name="FrameWidth", default_value=self.frame_width)
        self.phi_parameter = UAngle(name="Phi", default_value=self.phi)
        self.theta_parameter = UAngle(name="Theta", default_value=self.theta)
        self.tilt_parameter = UAngle(name="Tilt", default_value=self.tilt)
        self.radius_parameter = ULength(name="Radius", default_value=self.radius)
        self.focus_point_x_parameter = ULength(name="FocusPointX", default_value=self.focus_point_x)
        self.focus_point_y_parameter = ULength(name="FocusPointY", default_value=self.focus_point_y)
        self.focus_point_z_parameter = ULength(name="FocusPointZ", default_value=self.focus_point_z)
        self.parameters = [
            self.frame_width_parameter,
            self.phi_parameter, self.theta_parameter, self.tilt_parameter,
            self.radius_parameter,
            self.focus_point_x_parameter, self.focus_point_y_parameter, self.focus_point_z_parameter
        ]

    def specify_generator_code(self):
        """Compute observer position and orientation from parameters."""
        return '''
def main():
    # Read parameters
    frame_width = get_userdata_by_name(op, "FrameWidth") or 500.0
    phi = get_userdata_by_name(op, "Phi") or 0.0
    theta = get_userdata_by_name(op, "Theta") or 0.0
    tilt = get_userdata_by_name(op, "Tilt") or 0.0
    radius = get_userdata_by_name(op, "Radius") or 1000.0
    focus_x = get_userdata_by_name(op, "FocusPointX") or 0.0
    focus_y = get_userdata_by_name(op, "FocusPointY") or 0.0
    focus_z = get_userdata_by_name(op, "FocusPointZ") or 0.0

    focus_pos = c4d.Vector(focus_x, focus_y, focus_z)

    # Calculate camera position on sphere around focus point
    cos_phi = math.cos(phi)
    sin_phi = math.sin(phi)
    cos_theta = math.cos(theta)
    sin_theta = math.sin(theta)

    # Camera offset from focus point (spherical coords)
    cam_offset_x = radius * cos_theta * sin_phi
    cam_offset_y = radius * sin_theta
    cam_offset_z = -radius * cos_theta * cos_phi

    camera_pos = focus_pos + c4d.Vector(cam_offset_x, cam_offset_y, cam_offset_z)

    # Apply transformations to children
    child = op.GetDown()
    while child:
        name = child.GetName()

        if name == "Origin":
            child.SetRelRot(c4d.Vector(-theta, phi, tilt))

        elif name == "FocusPoint":
            child.SetRelPos(focus_pos)

        elif name == "Camera":
            child.SetAbsPos(camera_pos)

            # Make camera look at focus point
            dir_vec = focus_pos - camera_pos
            if dir_vec.GetLength() > 0.001:
                z_axis = dir_vec.GetNormalized()
                world_up = c4d.Vector(0, 1, 0)
                x_axis = world_up.Cross(z_axis).GetNormalized()
                y_axis = z_axis.Cross(x_axis).GetNormalized()

                look_matrix = c4d.Matrix()
                look_matrix.v1 = x_axis
                look_matrix.v2 = y_axis
                look_matrix.v3 = z_axis

                hpb = c4d.utils.MatrixToHPB(look_matrix)
                hpb.z = tilt
                child.SetAbsRot(hpb)

        child = child.GetNext()

    # Set OrbitPoint position
    origin = find_child_by_name(op, "Origin")
    if origin:
        orbit_child = find_child_by_name(origin, "OrbitPoint")
        if orbit_child:
            orbit_child.SetRelPos(c4d.Vector(0, 0, -radius))

    return None
'''

    # === 2D-style methods (subset of 3D) ===

    def pan(self, x=None, y=None, relative=False):
        """
        Pan the observer (2D-style movement in XY plane).

        Args:
            x: X position or delta
            y: Y position or delta
            relative: If True, move relative to current position
        """
        current_x = self.obj[self.focus_point_x_parameter.desc_id]
        current_y = self.obj[self.focus_point_y_parameter.desc_id]

        if x is None:
            x = current_x if not relative else 0
        if y is None:
            y = current_y if not relative else 0

        if relative:
            target_x = current_x + x
            target_y = current_y + y
        else:
            target_x = x
            target_y = y

        desc_ids = [
            self.focus_point_x_parameter.desc_id,
            self.focus_point_y_parameter.desc_id
        ]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=[target_x, target_y])
        self.obj[desc_ids[0]] = target_x
        self.obj[desc_ids[1]] = target_y
        return animation

    def zoom(self, frame_width=None, factor=None, **kwargs):
        """
        Zoom the observer (change visible frame width).

        Args:
            frame_width: Target frame width
            factor: Zoom factor (0.5 = zoom in 2x, 2 = zoom out 2x)
        """
        current = self.obj[self.frame_width_parameter.desc_id]
        if factor is not None:
            frame_width = current * factor
        elif frame_width is None:
            frame_width = self.frame_width

        desc_id = self.frame_width_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=frame_width, **kwargs)
        self.obj[desc_id] = frame_width
        return animation

    # === 3D-style methods ===

    def orbit(self, phi=None, theta=None, tilt=None, direction=None, **kwargs):
        """
        Orbit the observer around the focus point.

        Args:
            phi: Horizontal angle (azimuth)
            theta: Vertical angle (elevation)
            tilt: Camera roll
            direction: Shorthand ("front", "back", "left", "right", "top", "bottom")
        """
        directions = {
            "front": (0, 0),
            "back": (PI, 0),
            "left": (-PI/2, 0),
            "right": (PI/2, 0),
            "top": (0, PI/2),
            "bottom": (0, -PI/2),
        }
        if direction in directions:
            phi, theta = directions[direction]

        if phi is None:
            phi = self.obj[self.phi_parameter.desc_id]
        if theta is None:
            theta = self.obj[self.theta_parameter.desc_id]
        if tilt is None:
            tilt = self.obj[self.tilt_parameter.desc_id]

        desc_ids = [
            self.phi_parameter.desc_id,
            self.theta_parameter.desc_id,
            self.tilt_parameter.desc_id
        ]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=[phi, theta, tilt], **kwargs)
        self.obj[desc_ids[0]] = phi
        self.obj[desc_ids[1]] = theta
        self.obj[desc_ids[2]] = tilt
        return animation

    def dolly(self, radius=None, **kwargs):
        """
        Move the observer closer or further from focus point.

        Args:
            radius: Distance from focus point
        """
        if radius is None:
            radius = self.radius
        desc_id = self.radius_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=radius, **kwargs)
        self.obj[desc_id] = radius
        return animation

    def move_focus(self, x=None, y=None, z=None, focus=None, **kwargs):
        """
        Move the focus point (what the observer looks at).

        Args:
            x, y, z: Individual coordinates
            focus: Tuple (x, y, z)
        """
        if focus is not None:
            x, y, z = focus
        if x is None:
            x = self.obj[self.focus_point_x_parameter.desc_id]
        if y is None:
            y = self.obj[self.focus_point_y_parameter.desc_id]
        if z is None:
            z = self.obj[self.focus_point_z_parameter.desc_id]

        desc_ids = [
            self.focus_point_x_parameter.desc_id,
            self.focus_point_y_parameter.desc_id,
            self.focus_point_z_parameter.desc_id
        ]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=[x, y, z], **kwargs)
        self.obj[desc_ids[0]] = x
        self.obj[desc_ids[1]] = y
        self.obj[desc_ids[2]] = z
        return animation

    # === Convenience methods ===

    def look_at(self, target, zoom_to_fit=True, border=0.2):
        """
        Move focus to target and optionally zoom to fit.

        Args:
            target: Object to look at
            zoom_to_fit: Adjust frame_width to fit target
            border: Padding around target (0.2 = 20%)
        """
        center = target.get_center()
        animations = [self.move_focus(x=center[0], y=center[1], z=center[2])]

        if zoom_to_fit:
            target_radius = target.get_radius()
            import math
            fit_width = 2 * math.sqrt(target_radius.x**2 + target_radius.y**2 + target_radius.z**2) * (1 + border)
            animations.append(self.zoom(frame_width=fit_width))

        return AnimationGroup(*animations)

    def focus_on(self, target, direction="front", zoom_to_fit=True, border=0.2):
        """
        Look at target from a specific direction.

        Args:
            target: Object to focus on
            direction: "front", "back", "left", "right", "top", "bottom"
            zoom_to_fit: Adjust frame_width to fit target
            border: Padding around target
        """
        animations = [self.look_at(target, zoom_to_fit=zoom_to_fit, border=border)]
        animations.append(self.orbit(direction=direction))
        return AnimationGroup(*animations)

    # Legacy compatibility
    def move_orbit(self, phi=None, theta=None, radius=None, tilt=None, **kwargs):
        """Legacy method - use orbit() and dolly() instead."""
        animations = []
        if phi is not None or theta is not None or tilt is not None:
            animations.append(self.orbit(phi=phi, theta=theta, tilt=tilt, **kwargs))
        if radius is not None:
            animations.append(self.dolly(radius=radius, **kwargs))
        if len(animations) == 1:
            return animations[0]
        return AnimationGroup(*animations)


# =============================================================================
# LEGACY ALIASES - For backward compatibility
# =============================================================================

# TwoDCamera and ThreeDCamera are now just Observer with different defaults
# Kept for backward compatibility with existing code

def _create_twod_camera_class():
    """Create TwoDCamera as Observer configured for 2D."""
    class TwoDCamera(Observer):
        """Legacy: Use Observer instead. 2D is just Observer looking at XY plane."""
        def __init__(self, frame_width=500, **kwargs):
            super().__init__(
                frame_width=frame_width,
                phi=0, theta=0, tilt=0,
                radius=1000,
                projection="perspective",  # Works fine for 2D
                **kwargs
            )
    return TwoDCamera

def _create_threed_camera_class():
    """Create ThreeDCamera as Observer with 3D defaults."""
    class ThreeDCamera(Observer):
        """Legacy: Use Observer instead."""
        def __init__(self, frame_width=500, phi=0, theta=PI/8, tilt=0, radius=1000,
                     focus_point_x=0, focus_point_y=0, focus_point_z=0, **kwargs):
            super().__init__(
                frame_width=frame_width,
                phi=phi, theta=theta, tilt=tilt,
                radius=radius,
                focus=(focus_point_x, focus_point_y, focus_point_z),
                **kwargs
            )
    return ThreeDCamera

# Create the legacy classes
TwoDCamera = _create_twod_camera_class()
ThreeDCamera = _create_threed_camera_class()
