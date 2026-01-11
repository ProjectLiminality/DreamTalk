"""
DreamTalk Scene - Fresh Architecture (v2.0)

Scene classes for DreamTalk animations.
No Sketch & Toon dependency - uses geometry-based stroke rendering.

Classes:
- Scene: Abstract base class for all scenes
- TwoDScene: 2D orthographic camera setup
- ThreeDScene: 3D perspective camera setup
- RenderSettings: Configure render output
"""

import importlib
import DreamTalk.animation.animation
importlib.reload(DreamTalk.animation.animation)
from DreamTalk.animation.animation import ScalarAnimation, VectorAnimation
from DreamTalk.animation.abstract_animators import ProtoAnimator, AnimationGroup
from DreamTalk.objects.camera_objects import TwoDCamera, ThreeDCamera, Observer
from abc import ABC, abstractmethod
from collections import defaultdict
from DreamTalk.constants import *
import c4d
import os
import inspect
from pprint import pprint


class Scene(ABC):
    """
    Abstract base class for DreamTalk scenes.

    All scenes use geometry-based stroke rendering and Python Generators.
    No Sketch & Toon or XPresso dependencies.

    Args:
        resolution: Render resolution preset (default: "default")
        alpha: Enable alpha channel (default: True)
        save: Save render output (default: False)
    """

    def __init__(self, resolution="default", alpha=True, save=False):
        self.resolution = resolution
        self.alpha = alpha
        self.save = save
        self.time_ini = None
        self.time_fin = None
        self.kill_old_document()
        self.create_new_document()
        self.set_scene_name()
        self.insert_document()
        self.setup_realtime_viewport()
        self.clear_console()
        self.set_camera()
        self.construct()
        self.set_interactive_render_region()
        self.set_render_settings()
        self.adjust_timeline()

    def START(self):
        """Mark the start time for timeline trimming."""
        self.time_ini = self.document.GetTime()

    def STOP(self):
        """Mark the stop time for timeline trimming."""
        self.time_fin = self.document.GetTime()

    def adjust_timeline(self):
        """Adjust timeline to START/STOP markers."""
        if self.time_ini is not None:
            self.document[c4d.DOCUMENT_MINTIME] = self.time_ini
            self.document[c4d.DOCUMENT_LOOPMINTIME] = self.time_ini

        if self.time_fin is None:
            self.document[c4d.DOCUMENT_MAXTIME] = self.document.GetTime()
            self.document[c4d.DOCUMENT_LOOPMAXTIME] = self.document.GetTime()
        else:
            self.document[c4d.DOCUMENT_MAXTIME] = self.time_fin
            self.document[c4d.DOCUMENT_LOOPMAXTIME] = self.time_fin

    def set_render_settings(self):
        """Configure render settings."""
        self.render_settings = RenderSettings(alpha=self.alpha)
        self.render_settings.set_resolution(self.resolution)
        if self.save:
            self.render_settings.set_export_settings()

    def set_camera(self):
        """Override in subclass to set up camera."""
        pass

    def create_new_document(self):
        """Create a new C4D document."""
        self.document = c4d.documents.BaseDocument()
        c4d.documents.InsertBaseDocument(self.document)

    def kill_old_document(self):
        """Remove any existing document."""
        old_document = c4d.documents.GetActiveDocument()
        old_document.Remove()
        c4d.documents.KillDocument(old_document)

    def clear_console(self):
        """Clear the Python console."""
        c4d.CallCommand(13957)

    def construct(self):
        """
        Construct the scene (Kronos domain).

        Override this method OR unfold() to create objects and animations.
        unfold() is the preferred name in canonical DreamTalk syntax.
        """
        # Check if subclass defines unfold() - use that if available
        if hasattr(self, 'unfold') and callable(getattr(self, 'unfold')) and \
           type(self).unfold is not Scene.unfold:
            self.unfold()
        else:
            # Abstract - subclass must override either construct() or unfold()
            pass

    def unfold(self):
        """
        Unfold the dream (Kronos domain).

        The canonical name for the temporal sequence method.
        Override this method to create objects and animations.

        This is the preferred method name in DreamTalk syntax.
        construct() is maintained for backward compatibility.
        """
        pass

    @property
    def scene_name(self):
        return self._scene_name

    @scene_name.setter
    def scene_name(self, name):
        self._scene_name = name

    def set_scene_name(self):
        """Set scene name from class name."""
        self.scene_name = self.__class__.__name__
        self.document.SetDocumentName(self.scene_name)

    def insert_document(self):
        """Insert document into C4D."""
        c4d.documents.InsertBaseDocument(self.document)

    def setup_realtime_viewport(self):
        """
        Configure viewport for render-like real-time output.

        Sets up:
        - Black background (matches render output)
        - No grid, horizon, world axis
        - No handles, HUD, null objects
        - Geometry remains visible (generators, polygons, splines)

        This enables real-time preview that matches final render,
        eliminating the need for slow renderer feedback during development.
        """
        bd = self.document.GetActiveBaseDraw()
        if not bd:
            return

        # === Set background and grid colors to black ===
        c4d.SetViewColor(c4d.VIEWCOLOR_C4DBACKGROUND, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_C4DBACKGROUND_GRAD1, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_C4DBACKGROUND_GRAD2, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_GRID_MAJOR, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_GRID_MINOR, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_BASEGRID, c4d.Vector(0, 0, 0))
        c4d.SetViewColor(c4d.VIEWCOLOR_HORIZON, c4d.Vector(0, 0, 0))

        # === Disable visual aids, keep geometry visible ===
        bc = bd.GetDataInstance()

        # Hide world/scene visual aids
        bc[c4d.BASEDRAW_DISPLAYFILTER_GRID] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_BASEGRID] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_HORIZON] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_WORLDAXIS] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_HUD] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_NULL] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_CAMERA] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_LIGHT] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_JOINT] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_DEFORMER] = False
        bc[c4d.BASEDRAW_DISPLAYFILTER_FIELD] = False

        # Keep object interaction handles visible (axis gizmo on selection)
        bc[c4d.BASEDRAW_DISPLAYFILTER_HANDLES] = True
        bc[c4d.BASEDRAW_DISPLAYFILTER_OBJECTHANDLES] = True
        bc[c4d.BASEDRAW_DISPLAYFILTER_HIGHLIGHTING] = True

        # Keep geometry visible
        bc[c4d.BASEDRAW_DISPLAYFILTER_GENERATOR] = True
        bc[c4d.BASEDRAW_DISPLAYFILTER_POLYGON] = True
        bc[c4d.BASEDRAW_DISPLAYFILTER_SPLINE] = True
        bc[c4d.BASEDRAW_DISPLAYFILTER_HYPERNURBS] = True

        # Enable supersampling for smoother edges
        # Options: 0=none, 2, 3, 4, 5, 8, 16
        bc[c4d.BASEDRAW_DATA_SUPERSAMPLING] = 4  # 4x anti-aliasing

        bd.SetData(bc)
        c4d.EventAdd()

    def set_interactive_render_region(self):
        """Create IRR window for live preview."""
        c4d.CallCommand(600000022)  # IRR script by ID

    def feed_run_time(self, animations, run_time):
        """Feed run time to animations."""
        for animation in animations:
            animation.abs_run_time = run_time

    def execute_animations(self, animations):
        """Execute animations."""
        for animation in animations:
            animation.execute()

    def add_time(self, run_time):
        """Advance timeline by run_time seconds."""
        time_ini = self.document.GetTime()
        time_fin = time_ini + c4d.BaseTime(run_time)
        self.document.SetTime(time_fin)
        c4d.EventAdd()

    def flatten(self, animations):
        """Flatten animation groups."""
        animation_group = DreamTalk.animation.animation.AnimationGroup(*animations)
        flattened_animations = animation_group.animations
        return flattened_animations

    def get_animation(self, animators):
        """Extract animations from animators."""
        animations = []
        for animator in animators:
            class_name = animator.__class__.__name__
            # Check VectorAnimation first (it has scalar_animations to extract)
            if class_name == "VectorAnimation" or (hasattr(animator, 'scalar_animations') and animator.scalar_animations):
                scalar_animations = animator.scalar_animations
                animations += scalar_animations
                continue
            # AnimationGroup - check BEFORE 'animations' attribute since AnimationGroup has that attribute
            elif class_name == "AnimationGroup":
                animations.append(animator)
                continue
            # ProtoAnimator wraps animations (check after AnimationGroup to avoid mishandling)
            elif hasattr(animator, 'animations'):
                animation = animator.animations
                if hasattr(animation, 'scalar_animations') and animation.scalar_animations:
                    scalar_animations = animation.scalar_animations
                    animations += scalar_animations
                    continue
                else:
                    animations.append(animation)
                    continue
            # Direct animation objects (ScalarAnimation, etc.)
            elif hasattr(animator, 'execute'):
                animations.append(animator)
                continue
            else:
                print("Unknown animator input!", animator.__class__)
                continue
        return animations

    def play(self, *animators, run_time=1):
        """
        Play animations over run_time seconds.

        Args:
            *animators: Animation objects to play
            run_time: Duration in seconds (default 1)
        """
        animations = self.get_animation(animators)
        flattened_animations = self.flatten(animations)
        self.feed_run_time(flattened_animations, run_time)
        self.execute_animations(flattened_animations)
        self.add_time(run_time)

    def set(self, *animators):
        """Set animations instantly (2 frames)."""
        self.play(*animators, run_time=2/FPS)

    def wait(self, seconds=1):
        """Wait without animations."""
        self.add_time(seconds)

    def render_preview_frames(self, frames=None, output_dir=None, width=640, height=360):
        """
        Render key frames to PNG files for AI-assisted iteration.

        Args:
            frames: List of frame numbers. If None, auto-samples 5 frames.
            output_dir: Output directory. Defaults to /tmp/dreamtalk_preview/
            width: Preview width (default 640)
            height: Preview height (default 360)

        Returns:
            List of paths to rendered PNG files.
        """
        import tempfile

        if output_dir is None:
            output_dir = os.path.join(tempfile.gettempdir(), "dreamtalk_preview")
        os.makedirs(output_dir, exist_ok=True)

        if frames is None:
            min_frame = int(self.document[c4d.DOCUMENT_MINTIME].GetFrame(FPS))
            max_frame = int(self.document[c4d.DOCUMENT_MAXTIME].GetFrame(FPS))
            if max_frame > min_frame:
                frames = [
                    min_frame,
                    min_frame + (max_frame - min_frame) // 4,
                    min_frame + (max_frame - min_frame) // 2,
                    min_frame + 3 * (max_frame - min_frame) // 4,
                    max_frame
                ]
            else:
                frames = [min_frame]

        rd = self.document.GetActiveRenderData()
        original_width = rd[c4d.RDATA_XRES]
        original_height = rd[c4d.RDATA_YRES]
        original_format = rd[c4d.RDATA_FORMAT]
        original_save = rd[c4d.RDATA_SAVEIMAGE]
        original_alpha = rd[c4d.RDATA_ALPHACHANNEL]

        rd[c4d.RDATA_XRES] = width
        rd[c4d.RDATA_YRES] = height
        rd[c4d.RDATA_FORMAT] = c4d.FILTER_PNG
        rd[c4d.RDATA_SAVEIMAGE] = False
        rd[c4d.RDATA_ALPHACHANNEL] = True
        rd[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD

        rendered_paths = []

        try:
            for frame in frames:
                self.document.SetTime(c4d.BaseTime(frame, FPS))
                self.document.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

                bmp = c4d.bitmaps.BaseBitmap()
                if bmp.Init(width, height, 32) != c4d.IMAGERESULT_OK:
                    print(f"[DreamTalk] Failed to init bitmap for frame {frame}")
                    continue

                render_flags = c4d.RENDERFLAGS_EXTERNAL | c4d.RENDERFLAGS_NODOCUMENTCLONE
                result = c4d.documents.RenderDocument(self.document, rd.GetData(), bmp, render_flags)

                if result != c4d.RENDERRESULT_OK:
                    print(f"[DreamTalk] Render failed for frame {frame}: {result}")
                    continue

                output_path = os.path.join(output_dir, f"preview_{frame:04d}.png")
                if bmp.Save(output_path, c4d.FILTER_PNG) == c4d.IMAGERESULT_OK:
                    rendered_paths.append(output_path)
                    print(f"[DreamTalk] Rendered frame {frame} -> {output_path}")
                else:
                    print(f"[DreamTalk] Failed to save frame {frame}")

                bmp.FlushAll()

        finally:
            rd[c4d.RDATA_XRES] = original_width
            rd[c4d.RDATA_YRES] = original_height
            rd[c4d.RDATA_FORMAT] = original_format
            rd[c4d.RDATA_SAVEIMAGE] = original_save
            rd[c4d.RDATA_ALPHACHANNEL] = original_alpha
            c4d.EventAdd()

        return rendered_paths


class RenderSettings:
    """
    Configure render settings for DreamTalk scenes.

    Uses Standard renderer only - no Sketch & Toon.

    Args:
        alpha: Enable alpha channel (default: True)
    """

    def __init__(self, alpha=True):
        self.alpha = alpha
        self.document = c4d.documents.GetActiveDocument()
        self.set_base_settings()

    def set_export_settings(self):
        """Configure export path and format."""
        directory = os.path.dirname(inspect.stack()[3].filename)
        frame = inspect.currentframe().f_back
        class_name = frame.f_locals.get('self', None).__class__.__name__
        if self.alpha:
            path = os.path.join(directory, class_name + "_alpha", class_name)
        else:
            path = os.path.join(directory, class_name)
        self.settings[c4d.RDATA_PATH] = path
        if self.alpha:
            self.settings[c4d.RDATA_ALPHACHANNEL] = True
        self.settings[c4d.RDATA_SAVEIMAGE] = True

    def set_base_settings(self):
        """Set base render settings."""
        self.settings = self.document.GetActiveRenderData()

        self.settings[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD
        self.settings[c4d.RDATA_FRAMESEQUENCE] = 3  # preview range
        if self.alpha:
            self.settings[c4d.RDATA_FORMAT] = 1023671  # PNG
        else:
            self.settings[c4d.RDATA_FORMAT] = 1125  # MP4
        self.settings[c4d.RDATA_ALPHACHANNEL] = False
        self.settings[c4d.RDATA_SAVEIMAGE] = False

    def set_resolution(self, resolution):
        """
        Set render resolution.

        Square presets (DreamTalk symbols - 1:1):
            - "verylow": 270x270
            - "low": 540x540
            - "default": 1080x1080
            - "high": 1440x1440
            - "veryhigh": 2160x2160

        Widescreen presets (DreamSong videos - 16:9):
            - "wide_verylow": 640x360
            - "wide_low": 1280x720
            - "wide": 1920x1080
            - "wide_high": 2560x1440
            - "wide_veryhigh": 3840x2160
        """
        resolutions = {
            "verylow": (270, 270),
            "low": (540, 540),
            "default": (1080, 1080),
            "high": (1440, 1440),
            "veryhigh": (2160, 2160),
            "wide_verylow": (640, 360),
            "wide_low": (1280, 720),
            "wide": (1920, 1080),
            "wide_high": (2560, 1440),
            "wide_veryhigh": (3840, 2160),
        }

        if resolution in resolutions:
            w, h = resolutions[resolution]
            self.settings[c4d.RDATA_XRES] = w
            self.settings[c4d.RDATA_YRES] = h


class TwoDScene(Scene):
    """2D scene with orthographic camera."""

    def set_camera(self):
        self.camera = TwoDCamera()
        bd = self.document.GetActiveBaseDraw()
        bd.SetSceneCamera(self.camera.camera.obj)


class ThreeDScene(Scene):
    """3D scene with perspective camera."""

    def set_camera(self):
        self.camera = ThreeDCamera()
        bd = self.document.GetActiveBaseDraw()
        bd.SetSceneCamera(self.camera.camera.obj)


# =============================================================================
# UNIFIED DREAM - Canonical DreamTalk Syntax
# =============================================================================

class Dream(Scene):
    """
    Where holons unfold through time (Kronos domain).

    Dream is the unified scene class for all DreamTalk work.
    There is no fundamental distinction between 2D and 3D - just different
    observer configurations.

    The observer can be configured for:
    - 2D work: looking at XY plane, using pan() and zoom()
    - 3D work: orbital controls with orbit(), dolly(), move_focus()

    Args:
        resolution: Render resolution preset (default: "default")
        alpha: Enable alpha channel (default: True)
        save: Save render output (default: False)
        observer_theta: Initial elevation angle (default: 0 for 2D-style)

    Example:
        class MyDream(Dream):
            def unfold(self):
                circle = Circle(radius=100)
                self.play(Create(circle), run_time=1)

                # 2D-style navigation
                self.play(self.observer.pan(x=100), run_time=0.5)
                self.play(self.observer.zoom(factor=0.5), run_time=0.5)

                # 3D-style navigation
                self.play(self.observer.orbit(theta=PI/6), run_time=1)
    """

    def __init__(self, observer_theta=0, **kwargs):
        self._observer_theta = observer_theta
        super().__init__(**kwargs)

    def set_camera(self):
        """Set up the unified observer."""
        self.observer = Observer(theta=self._observer_theta)
        bd = self.document.GetActiveBaseDraw()
        bd.SetSceneCamera(self.observer.camera.obj)

        # Legacy alias
        self.camera = self.observer


# =============================================================================
# LEGACY ALIASES - For backward compatibility
# =============================================================================

# TwoDScene and ThreeDScene are kept for backward compatibility
# New code should use Dream directly

TwoDDream = TwoDScene   # Legacy
ThreeDDream = ThreeDScene  # Legacy
