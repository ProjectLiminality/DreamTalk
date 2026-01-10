"""
Stroke Objects - Geometry-based stroke rendering for DreamTalk.

This module provides Python Generator-based stroke rendering that replaces
Sketch & Toon. All strokes are real 3D geometry that:
- Works natively with MoGraph (unique per clone)
- Renders with Standard renderer (no post-effects)
- Exports cleanly to GLTF/USD/WebGL
- Is 10-50x faster than Sketch & Toon

Key classes:
- StrokeGen: Universal spline → camera-facing stroke geometry
- SilhouetteSplineGen: Mesh → perspective silhouette spline
- StrokeMaterial: Luminance material helper for strokes
"""

import c4d
from DreamTalk.constants import WHITE, BLACK


# =============================================================================
# GENERATOR CODE TEMPLATES
# =============================================================================

STROKE_GEN_CODE = '''import c4d
import math

def main():
    """Convert any spline child to camera-facing stroke geometry. Universal."""
    doc = c4d.documents.GetActiveDocument()

    # Get UserData parameters
    stroke_width = 3.0
    draw_completion = 1.0
    ud = op.GetUserDataContainer()
    for desc_id, bc in ud:
        name = bc[c4d.DESC_NAME]
        if name == "Stroke Width":
            stroke_width = op[desc_id]
        elif name == "Draw":
            draw_completion = op[desc_id]

    # Get camera
    bd = doc.GetActiveBaseDraw()
    cam = bd.GetSceneCamera(doc) if bd else None
    if not cam:
        obj = doc.GetFirstObject()
        while obj:
            if obj.GetType() == c4d.Ocamera:
                cam = obj
                break
            obj = obj.GetNext()

    if not cam:
        return None

    cam_world = cam.GetMg().off
    gen_mg = op.GetMg()

    child = op.GetDown()
    if not child:
        return None

    # Get spline - handle generators, primitives, and MoGraph context
    spline = child.GetCache()
    if spline is None:
        # In MoGraph context, try GetDeformCache
        spline = child.GetDeformCache()
    if spline is None:
        # For spline primitives without cache, use CurrentStateToObject
        child_clone = child.GetClone()
        result = c4d.utils.SendModelingCommand(
            command=c4d.MCOMMAND_CURRENTSTATETOOBJECT,
            list=[child_clone],
            doc=doc
        )
        if result and len(result) > 0:
            spline = result[0]
    if spline is None:
        # Last resort - use child directly if it's already a spline type
        spline = child

    # Check if it's a spline-like object (LineObject type 5137 or SplineObject)
    is_line_object = spline.GetType() == 5137
    is_spline_object = spline.IsInstanceOf(c4d.Ospline)

    if not (is_line_object or is_spline_object):
        return None

    child_ml = child.GetMl()
    points = spline.GetAllPoints()

    if len(points) < 2:
        return None

    # Transform points to world space
    world_points = []
    for p in points:
        local_p = child_ml * p
        world_p = gen_mg * local_p
        world_points.append(world_p)

    stroke_points = []
    stroke_polys = []
    gen_mg_inv = ~gen_mg

    # Determine if closed - check child type for known closed primitives
    is_closed = False
    child_type = child.GetType()
    # Circle=5181, Flower=5176, 4Side=5180, Cogwheel=5178, Rectangle=5186, Star=5175
    if child_type in [5181, 5176, 5180, 5178, 5186, 5175]:
        is_closed = True
    elif is_spline_object:
        try:
            is_closed = spline.IsClosed()
        except:
            pass
    else:
        # Heuristic: check if first and last points are close
        dist = (points[0] - points[-1]).GetLength()
        avg_edge = 0
        for i in range(min(5, len(points)-1)):
            avg_edge += (points[i+1] - points[i]).GetLength()
        if len(points) > 1:
            avg_edge /= min(5, len(points)-1)
            is_closed = dist < avg_edge * 1.5

    # Handle segmented splines (like silhouette output)
    seg_count = 0
    if hasattr(spline, 'GetSegmentCount'):
        seg_count = spline.GetSegmentCount()

    if seg_count <= 1:
        # Single segment or no segments
        num_pts = len(world_points)
        total_edges = num_pts if is_closed else num_pts - 1
        # Limit edges based on draw completion (0-1)
        num_edges = max(0, int(total_edges * draw_completion))
        if num_edges == 0 and draw_completion > 0:
            num_edges = 1  # Show at least one edge if any completion

        for i in range(num_edges):
            p1_world = world_points[i]
            p2_world = world_points[(i + 1) % num_pts]

            mid = (p1_world + p2_world) * 0.5
            to_cam = (cam_world - mid).GetNormalized()
            tangent = (p2_world - p1_world).GetNormalized()
            perp = tangent.Cross(to_cam).GetNormalized() * stroke_width

            q0 = gen_mg_inv * (p1_world - perp)
            q1 = gen_mg_inv * (p1_world + perp)
            q2 = gen_mg_inv * (p2_world + perp)
            q3 = gen_mg_inv * (p2_world - perp)

            base_idx = len(stroke_points)
            stroke_points.extend([q0, q1, q2, q3])
            stroke_polys.append(c4d.CPolygon(base_idx, base_idx+1, base_idx+2, base_idx+3))
    else:
        # Multiple segments - process each with draw completion
        pt_idx = 0
        # Count total edges first
        total_edges = 0
        for seg_i in range(seg_count):
            seg_info = spline.GetSegment(seg_i)
            seg_cnt = seg_info["cnt"]
            seg_closed = seg_info["closed"]
            total_edges += seg_cnt if seg_closed else seg_cnt - 1

        # Calculate how many edges to draw based on completion
        target_edges = max(0, int(total_edges * draw_completion))
        if target_edges == 0 and draw_completion > 0:
            target_edges = 1

        edges_drawn = 0
        for seg_i in range(seg_count):
            if edges_drawn >= target_edges:
                break

            seg_info = spline.GetSegment(seg_i)
            seg_cnt = seg_info["cnt"]
            seg_closed = seg_info["closed"]

            seg_points = world_points[pt_idx:pt_idx + seg_cnt]
            pt_idx += seg_cnt

            num_pts = len(seg_points)
            num_edges = num_pts if seg_closed else num_pts - 1
            # Limit edges in this segment based on remaining budget
            edges_this_seg = min(num_edges, target_edges - edges_drawn)

            for i in range(edges_this_seg):
                p1_world = seg_points[i]
                p2_world = seg_points[(i + 1) % num_pts]

                mid = (p1_world + p2_world) * 0.5
                to_cam = (cam_world - mid).GetNormalized()
                tangent = (p2_world - p1_world).GetNormalized()
                perp = tangent.Cross(to_cam).GetNormalized() * stroke_width

                q0 = gen_mg_inv * (p1_world - perp)
                q1 = gen_mg_inv * (p1_world + perp)
                q2 = gen_mg_inv * (p2_world + perp)
                q3 = gen_mg_inv * (p2_world - perp)

                base_idx = len(stroke_points)
                stroke_points.extend([q0, q1, q2, q3])
                stroke_polys.append(c4d.CPolygon(base_idx, base_idx+1, base_idx+2, base_idx+3))
                edges_drawn += 1

    if not stroke_polys:
        return None

    result = c4d.PolygonObject(len(stroke_points), len(stroke_polys))
    result.SetAllPoints(stroke_points)
    for i, poly in enumerate(stroke_polys):
        result.SetPolygon(i, poly)

    result.Message(c4d.MSG_UPDATE)
    result.SetName("StrokeGeometry")

    return result
'''

SILHOUETTE_SPLINE_GEN_CODE = '''import c4d
import math

def main():
    """Generate silhouette SPLINE from mesh children. MoGraph compatible."""
    doc = c4d.documents.GetActiveDocument()

    # Get camera
    bd = doc.GetActiveBaseDraw()
    cam = bd.GetSceneCamera(doc) if bd else None
    if not cam:
        obj = doc.GetFirstObject()
        while obj:
            if obj.GetType() == c4d.Ocamera:
                cam = obj
                break
            obj = obj.GetNext()

    if not cam:
        return None

    cam_world = cam.GetMg().off
    gen_mg = op.GetMg()

    child = op.GetDown()
    if not child:
        return None

    # Get mesh - handle cache
    mesh = child.GetCache()
    if mesh is None:
        mesh = child.GetDeformCache()
    if mesh is None:
        mesh = child

    if not mesh.IsInstanceOf(c4d.Opolygon):
        # Try to convert parametric objects
        if mesh.GetType() == c4d.Oplatonic:
            mesh = c4d.utils.SendModelingCommand(
                command=c4d.MCOMMAND_CURRENTSTATETOOBJECT,
                list=[mesh.GetClone()],
                doc=doc
            )
            if mesh:
                mesh = mesh[0]
            else:
                return None
        else:
            return None

    points = mesh.GetAllPoints()
    polys = mesh.GetAllPolygons()

    if len(polys) == 0:
        return None

    child_ml = child.GetMl()

    # Transform points to world space
    world_points = []
    for p in points:
        local_p = child_ml * p
        world_p = gen_mg * local_p
        world_points.append(world_p)

    # Classify faces as front/back facing
    face_facing = []
    for poly in polys:
        p0 = world_points[poly.a]
        p1 = world_points[poly.b]
        p2 = world_points[poly.c]

        if poly.c == poly.d:
            center = (p0 + p1 + p2) / 3.0
        else:
            p3 = world_points[poly.d]
            center = (p0 + p1 + p2 + p3) / 4.0

        edge1 = p1 - p0
        edge2 = p2 - p0
        normal = edge1.Cross(edge2).GetNormalized()
        view_dir = (cam_world - center).GetNormalized()

        face_facing.append(normal.Dot(view_dir) > 0)

    # Build edge-to-face mapping
    edge_faces = {}
    for fi, poly in enumerate(polys):
        verts = [poly.a, poly.b, poly.c]
        if poly.c != poly.d:
            verts.append(poly.d)

        for i in range(len(verts)):
            v1 = verts[i]
            v2 = verts[(i + 1) % len(verts)]
            edge_key = (min(v1, v2), max(v1, v2))

            if edge_key not in edge_faces:
                edge_faces[edge_key] = []
            edge_faces[edge_key].append(fi)

    # Find silhouette edges
    silhouette_edges = []
    for edge_key, faces in edge_faces.items():
        if len(faces) == 2:
            if face_facing[faces[0]] != face_facing[faces[1]]:
                silhouette_edges.append(edge_key)
        elif len(faces) == 1:
            if face_facing[faces[0]]:
                silhouette_edges.append(edge_key)

    if not silhouette_edges:
        return None

    gen_mg_inv = ~gen_mg

    # Create spline with all edge segments
    spline_points = []
    for v1_idx, v2_idx in silhouette_edges:
        p1_world = world_points[v1_idx]
        p2_world = world_points[v2_idx]

        p1_local = gen_mg_inv * p1_world
        p2_local = gen_mg_inv * p2_world

        spline_points.append(p1_local)
        spline_points.append(p2_local)

    spline = c4d.SplineObject(len(spline_points), c4d.SPLINETYPE_LINEAR)
    spline.SetAllPoints(spline_points)

    # Set segments - each edge is a separate segment of 2 points
    num_segments = len(silhouette_edges)
    spline.ResizeObject(len(spline_points), num_segments)
    for i in range(num_segments):
        spline.SetSegment(i, 2, False)

    spline.Message(c4d.MSG_UPDATE)
    spline.SetName("SilhouetteSpline")

    return spline
'''


# =============================================================================
# STROKE MATERIAL
# =============================================================================

class StrokeMaterial:
    """
    Luminance-based material for geometry strokes.

    Replaces SketchMaterial. Uses luminance channel for color,
    alpha channel for opacity. MoGraph compatible via Multi Shader.

    Args:
        color: Stroke color (c4d.Vector or DreamTalk color constant)
        opacity: Stroke opacity 0-1 (default 1.0)
        name: Material name
    """

    def __init__(self, color=None, opacity=1.0, name=None):
        self.color = color if color is not None else BLACK
        self.opacity = opacity
        self.name = name
        self.document = c4d.documents.GetActiveDocument()
        self._create_material()

    def _create_material(self):
        """Create the luminance material."""
        self.obj = c4d.Material()

        # Disable default channels
        self.obj[c4d.MATERIAL_USE_COLOR] = False
        self.obj[c4d.MATERIAL_USE_REFLECTION] = False

        # Enable luminance for color
        self.obj[c4d.MATERIAL_USE_LUMINANCE] = True
        self.obj[c4d.MATERIAL_LUMINANCE_COLOR] = self.color

        # Enable alpha for opacity if not fully opaque
        if self.opacity < 1.0:
            self.obj[c4d.MATERIAL_USE_ALPHA] = True
            # Create a color shader for alpha
            alpha_shader = c4d.BaseShader(c4d.Xcolor)
            alpha_val = self.opacity
            alpha_shader[c4d.COLORSHADER_COLOR] = c4d.Vector(alpha_val, alpha_val, alpha_val)
            self.obj.InsertShader(alpha_shader)
            self.obj[c4d.MATERIAL_ALPHA_SHADER] = alpha_shader

        # Set name
        if self.name:
            self.obj.SetName(self.name)
        else:
            self.obj.SetName("StrokeMaterial")

        # Insert into document
        self.document.InsertMaterial(self.obj)

    def set_color(self, color):
        """Update the stroke color."""
        self.color = color
        self.obj[c4d.MATERIAL_LUMINANCE_COLOR] = color

    def set_opacity(self, opacity):
        """Update the stroke opacity."""
        self.opacity = opacity
        if opacity < 1.0:
            if not self.obj[c4d.MATERIAL_USE_ALPHA]:
                self.obj[c4d.MATERIAL_USE_ALPHA] = True
                alpha_shader = c4d.BaseShader(c4d.Xcolor)
                self.obj.InsertShader(alpha_shader)
                self.obj[c4d.MATERIAL_ALPHA_SHADER] = alpha_shader

            alpha_shader = self.obj[c4d.MATERIAL_ALPHA_SHADER]
            if alpha_shader:
                alpha_shader[c4d.COLORSHADER_COLOR] = c4d.Vector(opacity, opacity, opacity)
        else:
            self.obj[c4d.MATERIAL_USE_ALPHA] = False


# =============================================================================
# STROKE GENERATOR
# =============================================================================

class StrokeGen:
    """
    Universal spline-to-stroke generator.

    Converts any spline child into camera-facing stroke geometry.
    Works with Circle, Arc, Rectangle, or any spline including
    SilhouetteSplineGen output.

    MoGraph compatible - each clone gets unique camera-facing geometry.

    Args:
        child: A DreamTalk spline object (Circle, Arc, etc.) or c4d spline
        stroke_width: Width of the stroke in scene units (default 3.0)
        draw: Draw completion 0-1, for animation (default 1.0)
        color: Stroke color (default BLACK)
        opacity: Stroke opacity 0-1 (default 1.0)
        name: Generator name
        x, y, z: Position

    Example:
        circle = Circle(radius=100)
        stroke = StrokeGen(circle, stroke_width=4, color=BLUE)

        # Animate draw-on:
        stroke = StrokeGen(circle, draw=0.5)  # Half drawn

        # Or wrap a silhouette:
        mesh = Icosahedron(radius=50)
        silhouette = SilhouetteSplineGen(mesh)
        stroke = StrokeGen(silhouette, stroke_width=3)
    """

    def __init__(self, child=None, stroke_width=3.0, draw=1.0, color=None, opacity=1.0,
                 name=None, x=0, y=0, z=0, position=None):
        self.stroke_width = stroke_width
        self.draw = draw
        self.color = color if color is not None else BLACK
        self.opacity = opacity
        self.child = child
        self.document = c4d.documents.GetActiveDocument()

        # Create the generator
        self._create_generator()

        # Set name
        if name:
            self.obj.SetName(name)
        elif child and hasattr(child, 'obj'):
            self.obj.SetName(f"Stroke_{child.obj.GetName()}")
        else:
            self.obj.SetName("StrokeGen")

        # Set position
        if position is not None:
            self.obj.SetAbsPos(position)
        else:
            self.obj.SetAbsPos(c4d.Vector(x, y, z))

        # Insert child
        if child:
            self._insert_child(child)

        # Create and apply material
        self._create_material()

        # Insert into document
        self.document.InsertObject(self.obj)

    def _create_generator(self):
        """Create the Python Generator object."""
        self.obj = c4d.BaseObject(1023866)  # Python Generator
        self.obj[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.obj[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!

        # Add Stroke Width UserData
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_METER
        self.stroke_width_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_width_id] = self.stroke_width

        # Add Draw UserData (0-1 completion for animation)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.draw_id = self.obj.AddUserData(bc)
        self.obj[self.draw_id] = self.draw

    def _insert_child(self, child):
        """Insert the child spline under the generator."""
        if hasattr(child, 'obj'):
            # DreamTalk object
            child.obj.Remove()
            child.obj.InsertUnder(self.obj)
        else:
            # Raw c4d object
            child.Remove()
            child.InsertUnder(self.obj)

    def _create_material(self):
        """Create and apply the stroke material."""
        self.material = StrokeMaterial(
            color=self.color,
            opacity=self.opacity,
            name=f"{self.obj.GetName()}_Mat"
        )

        # Apply material tag
        tag = self.obj.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.material.obj

    def set_stroke_width(self, width):
        """Update the stroke width."""
        self.stroke_width = width
        self.obj[self.stroke_width_id] = width

    def set_draw(self, draw):
        """Update the draw completion (0-1)."""
        self.draw = draw
        self.obj[self.draw_id] = draw

    def set_color(self, color):
        """Update the stroke color."""
        self.color = color
        self.material.set_color(color)

    def set_opacity(self, opacity):
        """Update the stroke opacity."""
        self.opacity = opacity
        self.material.set_opacity(opacity)


# =============================================================================
# SILHOUETTE SPLINE GENERATOR
# =============================================================================

class SilhouetteSplineGen:
    """
    Mesh-to-silhouette spline generator.

    Takes a mesh child and outputs a spline representing the silhouette
    edges from the current camera perspective. The output is a MoGraph-
    compatible spline that can be:
    - Fed into StrokeGen for rendering
    - Used with MoSpline for effects
    - Morphed using standard spline tools

    MoGraph compatible - each clone gets unique silhouette based on
    its position relative to the camera.

    Args:
        child: A DreamTalk mesh object (Cube, Sphere, Platonic, etc.) or c4d mesh
        name: Generator name
        x, y, z: Position

    Example:
        mesh = Icosahedron(radius=50)
        silhouette = SilhouetteSplineGen(mesh)
        stroke = StrokeGen(silhouette, stroke_width=3)
    """

    def __init__(self, child=None, name=None, x=0, y=0, z=0, position=None):
        self.child = child
        self.document = c4d.documents.GetActiveDocument()

        # Create the generator
        self._create_generator()

        # Set name
        if name:
            self.obj.SetName(name)
        elif child and hasattr(child, 'obj'):
            self.obj.SetName(f"Silhouette_{child.obj.GetName()}")
        else:
            self.obj.SetName("SilhouetteSplineGen")

        # Set position
        if position is not None:
            self.obj.SetAbsPos(position)
        else:
            self.obj.SetAbsPos(c4d.Vector(x, y, z))

        # Insert child
        if child:
            self._insert_child(child)

        # Insert into document
        self.document.InsertObject(self.obj)

    def _create_generator(self):
        """Create the Python Generator object."""
        self.obj = c4d.BaseObject(1023866)  # Python Generator
        self.obj[c4d.OPYTHON_CODE] = SILHOUETTE_SPLINE_GEN_CODE
        self.obj[c4d.OPYTHON_OPTIMIZE] = False  # Critical for MoGraph!

    def _insert_child(self, child):
        """Insert the child mesh under the generator."""
        if hasattr(child, 'obj'):
            # DreamTalk object
            child.obj.Remove()
            child.obj.InsertUnder(self.obj)
        else:
            # Raw c4d object
            child.Remove()
            child.InsertUnder(self.obj)


# =============================================================================
# COMBINED STROKE (CONVENIENCE CLASS)
# =============================================================================

class MeshStroke:
    """
    Convenience class that combines SilhouetteSplineGen + StrokeGen.

    Takes a mesh and directly outputs stroked silhouette geometry.

    Args:
        child: A DreamTalk mesh object or c4d mesh
        stroke_width: Width of the stroke (default 3.0)
        draw: Draw completion 0-1 for animation (default 1.0)
        color: Stroke color (default BLACK)
        opacity: Stroke opacity 0-1 (default 1.0)
        name: Name for the stroke generator
        x, y, z: Position

    Example:
        mesh = Icosahedron(radius=50)
        stroked = MeshStroke(mesh, stroke_width=4, color=BLUE)
    """

    def __init__(self, child=None, stroke_width=3.0, draw=1.0, color=None, opacity=1.0,
                 name=None, x=0, y=0, z=0, position=None):
        self.draw = draw
        self.document = c4d.documents.GetActiveDocument()

        # Create silhouette generator (don't insert to doc yet)
        self.silhouette_gen = c4d.BaseObject(1023866)
        self.silhouette_gen[c4d.OPYTHON_CODE] = SILHOUETTE_SPLINE_GEN_CODE
        self.silhouette_gen[c4d.OPYTHON_OPTIMIZE] = False
        self.silhouette_gen.SetName("SilhouetteSpline")

        # Insert mesh child under silhouette gen
        if child:
            if hasattr(child, 'obj'):
                child.obj.Remove()
                child.obj.InsertUnder(self.silhouette_gen)
                child_name = child.obj.GetName()
            else:
                child.Remove()
                child.InsertUnder(self.silhouette_gen)
                child_name = child.GetName()
        else:
            child_name = "Mesh"

        # Create stroke generator
        self.obj = c4d.BaseObject(1023866)
        self.obj[c4d.OPYTHON_CODE] = STROKE_GEN_CODE
        self.obj[c4d.OPYTHON_OPTIMIZE] = False

        # Add Stroke Width UserData
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Stroke Width"
        bc[c4d.DESC_DEFAULT] = 3.0
        bc[c4d.DESC_MIN] = 0.1
        bc[c4d.DESC_MAX] = 100.0
        bc[c4d.DESC_STEP] = 0.5
        self.stroke_width_id = self.obj.AddUserData(bc)
        self.obj[self.stroke_width_id] = stroke_width

        # Add Draw UserData (0-1 completion for animation)
        bc = c4d.GetCustomDataTypeDefault(c4d.DTYPE_REAL)
        bc[c4d.DESC_NAME] = "Draw"
        bc[c4d.DESC_DEFAULT] = 1.0
        bc[c4d.DESC_MIN] = 0.0
        bc[c4d.DESC_MAX] = 1.0
        bc[c4d.DESC_STEP] = 0.01
        bc[c4d.DESC_UNIT] = c4d.DESC_UNIT_PERCENT
        self.draw_id = self.obj.AddUserData(bc)
        self.obj[self.draw_id] = self.draw

        # Set name
        if name:
            self.obj.SetName(name)
        else:
            self.obj.SetName(f"MeshStroke_{child_name}")

        # Set position
        if position is not None:
            self.obj.SetAbsPos(position)
        else:
            self.obj.SetAbsPos(c4d.Vector(x, y, z))

        # Insert silhouette gen under stroke gen
        self.silhouette_gen.InsertUnder(self.obj)

        # Create and apply material
        self.color = color if color is not None else BLACK
        self.opacity = opacity
        self.material = StrokeMaterial(
            color=self.color,
            opacity=self.opacity,
            name=f"{self.obj.GetName()}_Mat"
        )
        tag = self.obj.MakeTag(c4d.Ttexture)
        tag[c4d.TEXTURETAG_MATERIAL] = self.material.obj

        # Insert into document
        self.document.InsertObject(self.obj)

    def set_stroke_width(self, width):
        """Update the stroke width."""
        self.obj[self.stroke_width_id] = width

    def set_draw(self, draw):
        """Update the draw completion (0-1)."""
        self.draw = draw
        self.obj[self.draw_id] = draw

    def set_color(self, color):
        """Update the stroke color."""
        self.color = color
        self.material.set_color(color)

    def set_opacity(self, opacity):
        """Update the stroke opacity."""
        self.opacity = opacity
        self.material.set_opacity(opacity)
