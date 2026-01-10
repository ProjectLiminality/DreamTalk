import importlib
import DreamTalk.tags
importlib.reload(DreamTalk.tags)
from DreamTalk.objects.abstract_objects import ProtoObject, CustomObject
from DreamTalk.objects.custom_objects import Group
from DreamTalk.objects.helper_objects import Null
from DreamTalk.tags import TargetTag
from DreamTalk.xpresso.userdata import *
from DreamTalk.xpresso.xpressions import *
from DreamTalk.animation.animation import ScalarAnimation, VectorAnimation, AnimationGroup
from DreamTalk.constants import ASPECT_RATIO, PI
from DreamTalk.generator import GeneratorMixin
import c4d

# desried features:
# ThreeDCamera:
# - continuous rotation around point
# - focus on specific object with optional normal vector
# - zoom in and out
# TwoDCamera:
# - move around in 2D
# - zoom in and out
# - focus on specific object


class Camera(ProtoObject):

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


class TwoDCamera(GeneratorMixin, CustomObject):

    def __init__(self, frame_width=500, generator_mode=False, **kwargs):
        self.frame_width = frame_width
        super().__init__(generator_mode=generator_mode, **kwargs)

    def specify_parts(self):
        self.camera = Camera(projection="front", z=-1000)  # the z offset avoids intersection with objects at z=0
        self.parts.append(self.camera)

    def specify_parameters(self):
        self.frame_width_parameter = ULength(
            name="FrameWidth", default_value=self.frame_width)
        self.parameters += [self.frame_width_parameter]

    def specify_relations(self):
        # Skip XPresso in generator mode
        if self.generator_mode:
            return

        # zooming is reduced to the width of the camera frame as a function of the cameras distance from the xy plane
        zoom_to_frame_width_ratio = 1023
        frame_width_relation = XRelation(part=self.camera, whole=self, desc_ids=[self.camera.desc_ids["zoom"]],
                                        parameters=[self.frame_width_parameter], formula=f"{zoom_to_frame_width_ratio}/{self.frame_width_parameter.name}")

    def specify_generator_code(self):
        """Python Generator code for 2D camera zoom control.

        The zoom is calculated as: camera_zoom = 1023 / FrameWidth
        """
        return '''
def main():
    # Read FrameWidth parameter
    frame_width = get_userdata_by_name(op, "FrameWidth") or 500.0

    # Zoom relation: zoom = 1023 / FrameWidth
    zoom_to_frame_width_ratio = 1023
    if frame_width > 0:
        zoom = zoom_to_frame_width_ratio / frame_width
    else:
        zoom = 1.0

    # Find and update Camera child
    child = op.GetDown()
    while child:
        if child.GetName() == "Camera" or child.GetType() == 5103:  # Ocamera type
            child[c4d.CAMERA_ZOOM] = zoom
            break
        child = child.GetNext()

    return None
'''

    def specify_creation_parameter(self):
        # camera object does not have a creation animation
        pass

    def focus_on(self, target, border=0.2):
        # moves and zooms such that the tragets bounding box is in the frame
        center = target.get_center()
        radius = target.get_radius()
        if radius[0] <= radius[1]:
            self.frame_width = 2 * radius[1] * (1 +  border) * ASPECT_RATIO
        else:
            self.frame_width = 2 * radius[0] * (1 + border)

        desc_id = self.frame_width_parameter.desc_id
        move_animation = self.move(x=center[0], y=center[1])
        zoom_animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=self.frame_width)
        self.obj[desc_id] = self.frame_width
        animation = AnimationGroup(move_animation, zoom_animation)
        return animation

    def zoom(self, frame_width=None, **kwargs):
        if frame_width is None:
            frame_width = self.frame_width
        desc_id = self.frame_width_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=frame_width, **kwargs)
        self.obj[desc_id] = frame_width
        return animation


class ThreeDCamera(GeneratorMixin, CustomObject):

    def __init__(self, frame_width=500, zoom_factor=0, phi=0, theta=PI/8, tilt=0, radius=1000, focus_point_x=0, focus_point_y=0, focus_point_z=0, generator_mode=False, **kwargs):
        self.frame_width = frame_width  # the frame width at the focus point
        self.zoom_factor = zoom_factor  # the progression along the line between orbit and focus point
        self.phi = phi
        self.theta = theta
        self.tilt = tilt
        self.radius = radius
        self.focus_point_x = focus_point_x
        self.focus_point_y = focus_point_y
        self.focus_point_z = focus_point_z
        super().__init__(generator_mode=generator_mode, **kwargs)
        if not generator_mode:
            self.add_target_tag()

    def specify_creation_parameter(self):
        # camera object does not have a creation animation
        pass

    def add_target_tag(self):
        # adds a target tag to the camera object
        self.target_tag = TargetTag(focus_point=self.focus_point, target=self)
        self.camera.obj.InsertTag(self.target_tag.obj)

    def specify_parts(self):
        self.camera = Camera()
        self.origin = Group(name="Origin")
        self.orbit_point = Null(name="OrbitPoint")
        self.origin.add(self.orbit_point)
        self.focus_point = Null(name="FocusPoint")
        self.parts += [self.camera, self.origin, self.orbit_point, self.focus_point]

    def specify_parameters(self):
        self.frame_width_parameter = ULength(
            name="FrameWidth", default_value=self.frame_width)
        self.zoom_factor_parameter = UCompletion(
            name="ZoomFactor", default_value=self.zoom_factor)
        self.phi_parameter = UAngle(
            name="Phi", default_value=self.phi)
        self.theta_parameter = UAngle(
            name="Theta", default_value=self.theta)
        self.tilt_parameter = UAngle(
            name="Tilt", default_value=self.tilt)
        self.radius_parameter = ULength(
            name="Radius", default_value=self.radius)
        self.focus_point_x_parameter = ULength(
            name="FocusPointX", default_value=self.focus_point_x)
        self.focus_point_y_parameter = ULength(
            name="FocusPointY", default_value=self.focus_point_y)
        self.focus_point_z_parameter = ULength(
            name="FocusPointZ", default_value=self.focus_point_z)
        self.parameters += [self.frame_width_parameter, self.zoom_factor_parameter, self.phi_parameter, self.theta_parameter,
                            self.tilt_parameter, self.radius_parameter, self.focus_point_x_parameter,
                            self.focus_point_y_parameter, self.focus_point_z_parameter]

    def specify_relations(self):
        # Skip XPresso in generator mode - relationships handled by Python code
        if self.generator_mode:
            return

        # zooming is reduced to the width of the camera frame as a function of the cameras distance from the xy plane
        frame_width_relation = XRelation(part=self, whole=self, desc_ids=[self.zoom_factor_parameter.desc_id],
                                        parameters=[self.frame_width_parameter, self.radius_parameter], formula=f"1-({self.frame_width_parameter.name}/{self.radius_parameter.name})")
        # zooming is reduced to the position on the line between orbit point and focus point point
        zoom_relation = XPlaceBetweenPoints(target=self, placed_object=self.camera, point_a=self.orbit_point, point_b=self.focus_point, interpolation_parameter=self.zoom_factor_parameter)
        # the movement is reduced to spherical coordinates of the orbit points position including tilt
        phi_inheritance = XIdentity(part=self.origin, whole=self, desc_ids=[ROT_H], parameter=self.phi_parameter)
        theta_inheritance = XRelation(part=self.origin, whole=self, desc_ids=[ROT_P], parameters=[self.theta_parameter], formula=f"-{self.theta_parameter.name}")
        tilt_inheritance = XIdentity(part=self.origin, whole=self, desc_ids=[ROT_B], parameter=self.tilt_parameter)
        radius_relation = XRelation(part=self.orbit_point, whole=self, desc_ids=[POS_Z], parameters=[self.radius_parameter], formula=f"-{self.radius_parameter.name}")
        # the rotation is reduced to the position of the focus point using cartesian coordinates
        focus_point_x_inheritance = XIdentity(part=self.focus_point, whole=self, desc_ids=[POS_X], parameter=self.focus_point_x_parameter)
        focus_point_y_inheritance = XIdentity(part=self.focus_point, whole=self, desc_ids=[POS_Y], parameter=self.focus_point_y_parameter)
        focus_point_z_inheritance = XIdentity(part=self.focus_point, whole=self, desc_ids=[POS_Z], parameter=self.focus_point_z_parameter)

    def specify_generator_code(self):
        """Python Generator code for camera transformations.

        Implements the same logic as the XPresso relations:
        1. Origin rotation (phi=H, theta=-P, tilt=B) for spherical coordinates
        2. OrbitPoint position (Z = -Radius)
        3. FocusPoint position (X, Y, Z from parameters)
        4. Camera position interpolated between OrbitPoint and FocusPoint by ZoomFactor
        5. ZoomFactor computed from FrameWidth / Radius
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

    # Compute zoom_factor from frame_width and radius
    # zoom_factor = 1 - (FrameWidth / Radius)
    if radius > 0:
        zoom_factor = 1.0 - (frame_width / radius)
    else:
        zoom_factor = 0.0
    zoom_factor = max(0.0, min(1.0, zoom_factor))  # clamp

    # Calculate orbit point position in world space
    # OrbitPoint is at (0, 0, -radius) in Origin's rotated local space
    # Origin rotation: H=phi, P=-theta, B=tilt
    cos_phi = math.cos(phi)
    sin_phi = math.sin(phi)
    cos_theta = math.cos(theta)
    sin_theta = math.sin(theta)

    # OrbitPoint local position before rotation: (0, 0, -radius)
    # After rotation by phi around Y (heading) and theta around X (pitch):
    # First, theta rotation around X axis
    orbit_local_z = -radius
    orbit_after_theta_y = orbit_local_z * sin_theta
    orbit_after_theta_z = orbit_local_z * cos_theta
    # Then, phi rotation around Y axis
    orbit_world_x = -orbit_after_theta_z * sin_phi
    orbit_world_y = orbit_after_theta_y
    orbit_world_z = orbit_after_theta_z * cos_phi

    orbit_pos = c4d.Vector(orbit_world_x, orbit_world_y, orbit_world_z)
    focus_pos = c4d.Vector(focus_x, focus_y, focus_z)

    # Camera position: linear interpolation between orbit and focus
    # zoom_factor=0 -> at orbit, zoom_factor=1 -> at focus
    camera_pos = orbit_pos + (focus_pos - orbit_pos) * zoom_factor

    # Apply transformations to children
    child = op.GetDown()
    while child:
        name = child.GetName()

        if name == "Origin":
            # Spherical coordinate rotation: H=phi, P=-theta, B=tilt
            child.SetRelRot(c4d.Vector(-theta, phi, tilt))

        elif name == "FocusPoint":
            # Focus point position
            child.SetRelPos(c4d.Vector(focus_x, focus_y, focus_z))

        elif name == "Camera":
            # Set camera position (interpolated between orbit and focus)
            child.SetAbsPos(camera_pos)

        child = child.GetNext()

    # Find nested OrbitPoint (under Origin) and set its position
    origin = None
    child = op.GetDown()
    while child:
        if child.GetName() == "Origin":
            origin = child
            break
        child = child.GetNext()

    if origin:
        orbit_child = origin.GetDown()
        while orbit_child:
            if orbit_child.GetName() == "OrbitPoint":
                # OrbitPoint Z position = -Radius in local space
                orbit_child.SetRelPos(c4d.Vector(0, 0, -radius))
                break
            orbit_child = orbit_child.GetNext()

    return None
'''

    def move_focus(self, x=None, y=None, z=None, **kwargs):
        if x is None:
            x = self.focus_point_x
        if y is None:
            y = self.focus_point_y
        if z is None:
            z = self.focus_point_z
        desc_ids = [self.focus_point_x_parameter.desc_id, self.focus_point_y_parameter.desc_id, self.focus_point_z_parameter.desc_id]
        values = [x, y, z]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=values, **kwargs)
        self.obj[desc_ids[0]] = x
        self.obj[desc_ids[1]] = y
        self.obj[desc_ids[2]] = z
        return animation

    def zoom(self, frame_width=None, **kwargs):
        if frame_width is None:
            frame_width = self.frame_width
        desc_id = self.frame_width_parameter.desc_id
        animation = ScalarAnimation(target=self, descriptor=desc_id, value_fin=frame_width, **kwargs)
        self.obj[desc_id] = frame_width
        return animation

    def move_orbit(self, phi=None, theta=None, radius=None, tilt=None, direction=None, **kwargs):
        # moves the cameras orbit point to the specified spherical coordinates
        if phi is None:
            phi = self.phi
        if theta is None:
            theta = self.theta
        if radius is None:
            radius = self.radius
        if tilt is None:
            tilt = self.tilt
        # coordinates can be specified by shorthand directions
        if direction == "front":
            phi = 0
            theta = 0
        elif direction == "back":
            phi = PI
            theta = 0
        elif direction == "left":
            phi = -PI/2
            theta = 0
        elif direction == "right":
            phi = PI/2
            theta = 0
        elif direction == "top":
            phi = 0
            theta = PI/2
        elif direction == "bottom":
            phi = 0
            theta = -PI/2
        desc_ids = [self.phi_parameter.desc_id, self.theta_parameter.desc_id, self.radius_parameter.desc_id, self.tilt_parameter.desc_id]
        values = [phi, theta, radius, tilt]
        animation = VectorAnimation(target=self, descriptor=desc_ids, vector=values, **kwargs)
        self.obj[desc_ids[0]] = phi
        self.obj[desc_ids[1]] = theta
        self.obj[desc_ids[2]] = radius
        self.obj[desc_ids[3]] = tilt
        return animation

    def look_at(self, target, zoom=True, border=0.2):
        # moves focus and zooms such that the tragets bounding box is in the frame
        center = target.get_center()
        radius = target.get_radius()
        move_animation = self.move_focus(x=center[0], y=center[1], z=center[2])
        if zoom:
            target_radius = target.get_radius()
            self.frame_width = np.sqrt(target_radius.x**2 + target_radius.y**2 + target_radius.z**2) * (1 + border) / 2
            zoom_animation = self.zoom(frame_width=self.frame_width)
            animations = AnimationGroup(move_animation, zoom_animation)
        else:
            animations = move_animation
        return animations


    def focus_on(self, target, direction="front", zoom=True, border=0.2, center=None):
        # moves focus and zooms such that the traget is in the center of the frame
        if direction == "front":
            phi = 0
            theta = 0
        elif direction == "back":
            phi = PI
            theta = 0
        elif direction == "left":
            phi = -PI/2
            theta = 0
        elif direction == "right":
            phi = PI/2
            theta = 0
        elif direction == "top":
            phi = 0
            theta = PI/2
        elif direction == "bottom":
            phi = 0
            theta = -PI/2
        animations = []
        if zoom:
            target_radius = target.get_radius()
            self.frame_width = 2 * np.sqrt(target_radius.x**2 + target_radius.y**2 + target_radius.z**2) * (1 + border)
            zoom_animation = self.zoom(frame_width=self.frame_width)
            animations.append(zoom_animation)
        if center is None:
            center = target.get_center()
        move_animation = self.move(x=center[0], y=center[1], z=center[2])
        rotate_animation = self.move_orbit(phi=phi, theta=theta)
        animations += [rotate_animation, move_animation]
        animations = AnimationGroup(*animations)
        return animations

    def follow(self, target):
        """Make the camera follow a target object.

        Changes the target of the camera's TargetTag so it looks at
        the specified object instead of the default focus_point Null.

        Args:
            target: A DreamTalk object to follow
        """
        self.target_tag.set_target(target)
