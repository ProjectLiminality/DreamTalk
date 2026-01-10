import importlib
import DreamTalk.animation.animation
importlib.reload(DreamTalk.animation.animation)
from DreamTalk.animation.animation import ScalarAnimation, VectorAnimation
from DreamTalk.animation.abstract_animators import ProtoAnimator, AnimationGroup
from DreamTalk.objects.camera_objects import TwoDCamera, ThreeDCamera
from abc import ABC, abstractmethod
from collections import defaultdict
from DreamTalk.constants import *
import c4d
import os
import inspect
from pprint import pprint


class Scene(ABC):
    """abstract class acting as blueprint for scenes

    Args:
        resolution: Render resolution preset (default: "default")
        alpha: Enable alpha channel (default: True)
        save: Save render output (default: False)
        sketch_mode: Enable Sketch & Toon VideoPost (default: True)
            Set to False when using only stroke_mode objects for faster rendering.
    """

    def __init__(self, resolution="default", alpha=True, save=False, sketch_mode=True):
        self.resolution = resolution
        self.alpha = alpha
        self.save = save
        self.sketch_mode = sketch_mode
        self.time_ini = None
        self.time_fin = None
        self.kill_old_document()
        self.create_new_document()
        self.set_scene_name()
        self.insert_document()
        self.clear_console()
        self.set_camera()
        self.construct()
        self.set_interactive_render_region()
        self.set_render_settings()
        self.adjust_timeline()

    def START(self):
        # writes current time to variable for later use in finish method
        self.time_ini = self.document.GetTime()

    def STOP(self):
        # writes current time to variable for later use in finish method
        self.time_fin = self.document.GetTime()

    def adjust_timeline(self):
        # set minimum time
        if self.time_ini is not None:
            self.document[c4d.DOCUMENT_MINTIME] = self.time_ini
            self.document[c4d.DOCUMENT_LOOPMINTIME] = self.time_ini

        # set maximum time
        if self.time_fin is None:
            self.document[c4d.DOCUMENT_MAXTIME] = self.document.GetTime()
            self.document[c4d.DOCUMENT_LOOPMAXTIME] = self.document.GetTime()
        else:
            self.document[c4d.DOCUMENT_MAXTIME] = self.time_fin
            self.document[c4d.DOCUMENT_LOOPMAXTIME] = self.time_fin

    def set_render_settings(self):
        self.render_settings = RenderSettings(alpha=self.alpha, sketch_mode=self.sketch_mode)
        self.render_settings.set_resolution(self.resolution)
        if self.save:
            self.render_settings.set_export_settings()

    def set_camera(self):
        pass

    def create_new_document(self):
        """creates a new project and gets the active document"""
        self.document = c4d.documents.BaseDocument()
        c4d.documents.InsertBaseDocument(self.document)

    def kill_old_document(self):
        """kills the old document to always ensure only one document is active"""
        old_document = c4d.documents.GetActiveDocument()
        old_document.Remove()
        c4d.documents.KillDocument(old_document)

    def clear_console(self):
        """clears the python console"""
        c4d.CallCommand(13957)

    @abstractmethod
    def construct(self):
        """here the actual scene consisting out of objects and animations is constructed
        this method should be overwritten by the inheriting scene classes"""
        pass

    @property
    def scene_name(self):
        """holds the scene name"""
        return self._scene_name

    @scene_name.setter
    def scene_name(self, name):
        self._scene_name = name

    def set_scene_name(self):
        """sets the scene name and the document name"""
        self.scene_name = self.__class__.__name__
        self.document.SetDocumentName(self.scene_name)

    def insert_document(self):
        """inserts the document into cinema"""
        c4d.documents.InsertBaseDocument(self.document)

    def set_interactive_render_region(self):
        """creates an IRR window over the full size of the editor view"""
        c4d.CallCommand(600000022)  # call IRR script by ID
        # workaround because script needs to be executed from main thread not DreamTalk library
        # ID changes depending on machine
        # CHANGE THIS IN FUTURE TO MORE ROBUST SOLUTION

    def feed_run_time(self, animations, run_time):
        """feeds the run time to animations"""
        for animation in animations:
            animation.abs_run_time = run_time

    def execute_animations(self, animations):
        """passes the run time to animations and executes them"""
        for animation in animations:
            animation.execute()

    def add_time(self, run_time):
        """passes the run time in the document timeline"""
        time_ini = self.document.GetTime()
        time_fin = time_ini + c4d.BaseTime(run_time)
        self.document.SetTime(time_fin)
        c4d.EventAdd()  # update cinema

    def flatten(self, animations):
        """flattens animations by wrapping them in animation group"""
        animation_group = DreamTalk.animation.animation.AnimationGroup(*animations)
        flattened_animations = animation_group.animations
        return flattened_animations

    def get_animation(self, animators):
        """retreives the animations from the animators depending on type"""
        animations = []
        for animator in animators:
            if isinstance(animator, DreamTalk.animation.abstract_animators.ProtoAnimator):
                animation = animator.animations
                if issubclass(animation.__class__, DreamTalk.animation.animation.VectorAnimation):
                    vector_animation = animator
                    scalar_animations = vector_animation.scalar_animations
                    animations += scalar_animations
                    continue
            elif issubclass(animator.__class__, DreamTalk.animation.animation.ProtoAnimation):
                animation = animator
            elif animator.__class__.__name__ == "AnimationGroup":
                animation = animator
            elif issubclass(animator.__class__, DreamTalk.animation.animation.VectorAnimation):
                vector_animation = animator
                scalar_animations = vector_animation.scalar_animations
                animations += scalar_animations
                continue
            else:
                print("Unknown animator input!", animator.__class__)
            animations.append(animation)
        return animations

    def play(self, *animators, run_time=1):
        """handles several tasks for the animations:
            - handles visibility
            - flattens animations
            - links animation chains
            - feeds them the run time
            - executes the animations"""
        animations = self.get_animation(animators)
        flattened_animations = self.flatten(animations)
        self.feed_run_time(flattened_animations, run_time)
        self.execute_animations(flattened_animations)
        self.add_time(run_time)

    def set(self, *animators):
        # the set method is just the play method reduced to two frames
        # one for the initial, one for the final keyframe
        self.play(*animators, run_time=2/FPS)

    def wait(self, seconds=1):
        """adds time without any animations"""
        self.add_time(seconds)

    def render_preview_frames(self, frames=None, output_dir=None, width=640, height=360):
        """
        Render key frames to PNG files for AI-assisted iteration.

        Args:
            frames: List of frame numbers to render. If None, auto-samples 5 frames
                    across the animation range.
            output_dir: Directory for output PNGs. Defaults to /tmp/dreamtalk_preview/
            width: Preview width in pixels (default 640)
            height: Preview height in pixels (default 360)

        Returns:
            List of paths to rendered PNG files.

        Files are named preview_XXXX.png and are overwritten on each call,
        enabling fast iteration without file accumulation.
        """
        import tempfile

        # Default output directory
        if output_dir is None:
            output_dir = os.path.join(tempfile.gettempdir(), "dreamtalk_preview")
        os.makedirs(output_dir, exist_ok=True)

        # Auto-sample frames if not specified
        if frames is None:
            min_frame = int(self.document[c4d.DOCUMENT_MINTIME].GetFrame(FPS))
            max_frame = int(self.document[c4d.DOCUMENT_MAXTIME].GetFrame(FPS))
            # Sample 5 frames: start, 25%, 50%, 75%, end
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

        # Get render settings and configure for preview
        rd = self.document.GetActiveRenderData()
        original_width = rd[c4d.RDATA_XRES]
        original_height = rd[c4d.RDATA_YRES]
        original_format = rd[c4d.RDATA_FORMAT]
        original_save = rd[c4d.RDATA_SAVEIMAGE]
        original_alpha = rd[c4d.RDATA_ALPHACHANNEL]

        # Set preview settings
        rd[c4d.RDATA_XRES] = width
        rd[c4d.RDATA_YRES] = height
        rd[c4d.RDATA_FORMAT] = c4d.FILTER_PNG
        rd[c4d.RDATA_SAVEIMAGE] = False
        rd[c4d.RDATA_ALPHACHANNEL] = True
        rd[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD

        rendered_paths = []

        try:
            for frame in frames:
                # Set frame
                self.document.SetTime(c4d.BaseTime(frame, FPS))
                self.document.ExecutePasses(None, True, True, True, c4d.BUILDFLAGS_NONE)

                # Create bitmap
                bmp = c4d.bitmaps.BaseBitmap()
                if bmp.Init(width, height, 32) != c4d.IMAGERESULT_OK:
                    print(f"[DreamTalk] Failed to init bitmap for frame {frame}")
                    continue

                # Render
                render_flags = c4d.RENDERFLAGS_EXTERNAL | c4d.RENDERFLAGS_NODOCUMENTCLONE
                result = c4d.documents.RenderDocument(self.document, rd.GetData(), bmp, render_flags)

                if result != c4d.RENDERRESULT_OK:
                    print(f"[DreamTalk] Render failed for frame {frame}: {result}")
                    continue

                # Save to file (overwriting)
                output_path = os.path.join(output_dir, f"preview_{frame:04d}.png")
                if bmp.Save(output_path, c4d.FILTER_PNG) == c4d.IMAGERESULT_OK:
                    rendered_paths.append(output_path)
                    print(f"[DreamTalk] Rendered frame {frame} -> {output_path}")
                else:
                    print(f"[DreamTalk] Failed to save frame {frame}")

                bmp.FlushAll()

        finally:
            # Restore original settings
            rd[c4d.RDATA_XRES] = original_width
            rd[c4d.RDATA_YRES] = original_height
            rd[c4d.RDATA_FORMAT] = original_format
            rd[c4d.RDATA_SAVEIMAGE] = original_save
            rd[c4d.RDATA_ALPHACHANNEL] = original_alpha
            c4d.EventAdd()

        return rendered_paths


class RenderSettings():
    """holds and writes the render settings to cinema

    Args:
        alpha: Enable alpha channel (default: True)
        sketch_mode: Enable Sketch & Toon VideoPost (default: True)
            Set to False when using only stroke_mode objects for faster rendering.
    """

    def __init__(self, alpha=True, sketch_mode=True):
        self.alpha = alpha
        self.sketch_mode = sketch_mode
        self.document = c4d.documents.GetActiveDocument()  # get document
        self.set_base_settings()
        if self.sketch_mode:
            self.set_sketch_settings()

    def set_export_settings(self):
        """sets the export settings"""
        # get the caller's directory
        # get directory from path
        directory = os.path.dirname(inspect.stack()[3].filename)
        # get the caller's class name
        frame = inspect.currentframe().f_back
        class_name = frame.f_locals.get('self', None).__class__.__name__
        # get the path
        if self.alpha:
            path = os.path.join(directory, class_name + "_alpha", class_name) # add folder for alpha channel pngs
        else:
            path = os.path.join(directory, class_name)
        self.settings[c4d.RDATA_PATH] = path
        if self.alpha:
            self.settings[c4d.RDATA_ALPHACHANNEL] = True  # Enable alpha channel
        self.settings[c4d.RDATA_SAVEIMAGE] = True # set to save image

    def set_base_settings(self):
        """sets the base settings"""
        self.settings = self.document.GetActiveRenderData()

        # set parameters
        self.settings[c4d.RDATA_RENDERENGINE] = c4d.RDATA_RENDERENGINE_STANDARD  # ensure Standard renderer (not Redshift)
        self.settings[c4d.RDATA_FRAMESEQUENCE] = 3  # set range to preview
        if self.alpha:
            self.settings[c4d.RDATA_FORMAT] = 1023671 # Set to PNG
        else:
            self.settings[c4d.RDATA_FORMAT] = 1125  # set to MP4
        self.settings[c4d.RDATA_ALPHACHANNEL] = False  # set alpha channel
        self.settings[c4d.RDATA_SAVEIMAGE] = False  # set to not save image

    def set_resolution(self, resolution):
        """sets the resolution for the render

        DreamTalk symbols default to square 1:1 aspect ratio for thumbnail compatibility.
        DreamSong videos use 16:9 aspect ratio.

        Square presets (DreamTalk symbols):
            - "default": 1080x1080 (recommended for symbols)
            - "low": 540x540
            - "verylow": 270x270
            - "high": 1440x1440
            - "veryhigh": 2160x2160 (4K square)

        Widescreen presets (DreamSong videos):
            - "wide": 1920x1080 (1080p)
            - "wide_low": 1280x720 (720p)
            - "wide_high": 2560x1440 (1440p)
            - "wide_veryhigh": 3840x2160 (4K)
        """
        # Square presets (DreamTalk symbols - 1:1 aspect ratio)
        if resolution == "verylow":
            self.settings[c4d.RDATA_XRES] = 270
            self.settings[c4d.RDATA_YRES] = 270
        elif resolution == "low":
            self.settings[c4d.RDATA_XRES] = 540
            self.settings[c4d.RDATA_YRES] = 540
        elif resolution == "default":
            self.settings[c4d.RDATA_XRES] = 1080
            self.settings[c4d.RDATA_YRES] = 1080
        elif resolution == "high":
            self.settings[c4d.RDATA_XRES] = 1440
            self.settings[c4d.RDATA_YRES] = 1440
        elif resolution == "veryhigh":
            self.settings[c4d.RDATA_XRES] = 2160
            self.settings[c4d.RDATA_YRES] = 2160
        # Widescreen presets (DreamSong videos - 16:9 aspect ratio)
        elif resolution == "wide_verylow":
            self.settings[c4d.RDATA_XRES] = 640
            self.settings[c4d.RDATA_YRES] = 360
        elif resolution == "wide_low":
            self.settings[c4d.RDATA_XRES] = 1280
            self.settings[c4d.RDATA_YRES] = 720
        elif resolution == "wide":
            self.settings[c4d.RDATA_XRES] = 1920
            self.settings[c4d.RDATA_YRES] = 1080
        elif resolution == "wide_high":
            self.settings[c4d.RDATA_XRES] = 2560
            self.settings[c4d.RDATA_YRES] = 1440
        elif resolution == "wide_veryhigh":
            self.settings[c4d.RDATA_XRES] = 3840
            self.settings[c4d.RDATA_YRES] = 2160

    def set_sketch_settings(self):
        """sets the sketch and toon settings"""

        sketch_vp = c4d.documents.BaseVideoPost(
            1011015)  # add sketch render settings
        # set parameters
        sketch_vp[c4d.OUTLINEMAT_SHADING_BACK] = False  # disable background color
        sketch_vp[c4d.OUTLINEMAT_SHADING_OBJECT] = False  # disable shading
        # set independent of pixel units
        sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_INDEPENDENT] = True
        # show lines in editor view
        sketch_vp[c4d.OUTLINEMAT_EDLINES_SHOWLINES] = True
        sketch_vp[c4d.OUTLINEMAT_EDLINES_LINE_DRAW] = 1  # 3D lines in editor
        # set to custom mode
        sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_INDEPENDENT_MODE] = 1
        sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEW] = 1080  # set custom width (square)
        sketch_vp[c4d.OUTLINEMAT_PIXELUNITS_BASEH] = 1080  # set custom height (square)
        sketch_vp[c4d.OUTLINEMAT_EDLINES_REDRAW_FULL] = True  # redraw lines
        sketch_vp[c4d.OUTLINEMAT_LINE_SPLINES] = True  # enable splines

        self.settings.InsertVideoPost(
            sketch_vp)  # insert sketch settings


class TwoDScene(Scene):
    """a 2D scene uses a 2D camera setup"""

    def set_camera(self):
        self.camera = TwoDCamera()
        # get basedraw of scene
        bd = self.document.GetActiveBaseDraw()
        # set camera of basedraw to scene camera
        bd.SetSceneCamera(self.camera.camera.obj)


class ThreeDScene(Scene):
    """a 3D scene uses a 3D camera setup"""

    def set_camera(self):
        self.camera = ThreeDCamera()
        # get basedraw of scene
        bd = self.document.GetActiveBaseDraw()
        # set camera of basedraw to scene camera
        bd.SetSceneCamera(self.camera.camera.obj)
