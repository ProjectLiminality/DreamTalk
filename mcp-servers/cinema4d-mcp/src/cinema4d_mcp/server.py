"""Cinema 4D MCP Server."""

import socket
import json
import os
import math
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP, Context
from starlette.routing import Route
from starlette.responses import JSONResponse

from .config import C4D_HOST, C4D_PORT
from .utils import logger, check_c4d_connection


@dataclass
class C4DConnection:
    sock: Optional[socket.socket] = None
    connected: bool = False


# Asynchronous context manager for Cinema 4D connection
@asynccontextmanager
async def c4d_connection_context():
    """Asynchronous context manager for Cinema 4D connection."""
    connection = C4DConnection()
    try:
        # Initialize connection to Cinema 4D
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((C4D_HOST, C4D_PORT))
        connection.sock = sock
        connection.connected = True
        logger.info(f"✅ Connected to Cinema 4D at {C4D_HOST}:{C4D_PORT}")
        yield connection  # Yield the connection
    except Exception as e:
        logger.error(f"❌ Failed to connect to Cinema 4D: {str(e)}")
        connection.connected = False  # Ensure connection is marked as not connected
        yield connection  # Still yield the connection object
    finally:
        # Clean up on server shutdown
        if connection.sock:
            connection.sock.close()
            logger.info("🔌 Disconnected from Cinema 4D")


def send_to_c4d(connection: C4DConnection, command: Dict[str, Any]) -> Dict[str, Any]:
    """Send a command to Cinema 4D and get the response with improved timeout handling."""
    if not connection.connected or not connection.sock:
        return {"error": "Not connected to Cinema 4D"}

    # Set appropriate timeout based on command type
    command_type = command.get("command", "")

    # Long-running operations need longer timeouts
    if command_type in ["rendered_preview"]:
        timeout = 180  # 3 minutes for full renders with Sketch & Toon
        logger.info(f"Using extended timeout ({timeout}s) for {command_type}")
    elif command_type in ["viewport_preview"]:
        timeout = 60  # 1 minute for viewport preview (usually fast but multi-frame possible)
        logger.info(f"Using extended timeout ({timeout}s) for {command_type}")
    else:
        timeout = 20  # Default timeout for regular operations

    try:
        # Convert command to JSON and send it
        command_json = json.dumps(command) + "\n"  # Add newline as message delimiter
        logger.debug(f"Sending command: {command_type}")
        connection.sock.sendall(command_json.encode("utf-8"))

        # Set socket timeout
        connection.sock.settimeout(timeout)

        # Receive response
        response_data = b""
        start_time = time.time()
        max_time = start_time + timeout

        # Log for long-running operations
        if command_type in ["rendered_preview", "viewport_preview"]:
            logger.info(
                f"Waiting for response from {command_type} (timeout: {timeout}s)"
            )

        while time.time() < max_time:
            try:
                chunk = connection.sock.recv(4096)
                if not chunk:
                    # If we receive an empty chunk, the connection might be closed
                    if not response_data:
                        logger.error(
                            f"Connection closed by Cinema 4D during {command_type}"
                        )
                        return {
                            "error": f"Connection closed by Cinema 4D during {command_type}"
                        }
                    break

                response_data += chunk

                # For long operations, log progress on data receipt
                elapsed = time.time() - start_time
                if (
                    command_type in ["render_frame", "apply_mograph_fields"]
                    and elapsed > 5
                ):
                    logger.debug(
                        f"Received partial data for {command_type} ({len(response_data)} bytes, {elapsed:.1f}s elapsed)"
                    )

                if b"\n" in chunk:  # Message complete when we see a newline
                    logger.debug(f"Received complete response for {command_type}")
                    break

            except socket.timeout:
                logger.error(f"Socket timeout while receiving data for {command_type}")
                return {
                    "error": f"Timeout waiting for response from Cinema 4D ({timeout}s) for {command_type}"
                }

        # Parse and return response
        if not response_data:
            logger.error(f"No response received from Cinema 4D for {command_type}")
            return {"error": f"No response received from Cinema 4D for {command_type}"}

        response_text = response_data.decode("utf-8").strip()

        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            # If JSON parsing fails, log the exact response for debugging
            logger.error(f"Failed to parse JSON response: {str(e)}")
            logger.error(f"Raw response (first 200 chars): {response_text[:200]}...")
            return {"error": f"Invalid response from Cinema 4D: {str(e)}"}

    except socket.timeout:
        logger.error(f"Socket timeout during {command_type} ({timeout}s)")
        return {
            "error": f"Timeout communicating with Cinema 4D ({timeout}s) for {command_type}"
        }
    except Exception as e:
        logger.error(f"Communication error during {command_type}: {str(e)}")
        return {"error": f"Communication error: {str(e)}"}


async def homepage(request):
    """Handle homepage requests to check if server is running."""
    c4d_available = check_c4d_connection(C4D_HOST, C4D_PORT)
    return JSONResponse(
        {
            "status": "ok",
            "cinema4d_connected": c4d_available,
            "host": C4D_HOST,
            "port": C4D_PORT,
        }
    )


# Initialize our FastMCP server
mcp = FastMCP(title="Cinema4D", routes=[Route("/", endpoint=homepage)])


# =============================================================================
# CORE TOOLS
# =============================================================================
# Minimal, universal toolset for Cinema 4D interaction.
# Philosophy: Fewer, more powerful tools that trust the model's intelligence.

@mcp.tool()
async def execute_python_script(script: str, ctx: Context) -> str:
    """
    Execute a Python script in Cinema 4D.

    This is the raw access tool for R&D, experimentation, and direct C4D manipulation.
    For running canonical DreamTalk scenes, prefer run_dreamtalk().

    Args:
        script: Python code to execute in Cinema 4D
    """
    async with c4d_connection_context() as connection:
        if not connection.connected:
            return "❌ Not connected to Cinema 4D"

        response = send_to_c4d(
            connection, {"command": "execute_python", "script": script}
        )

        if "error" in response:
            return f"❌ Error: {response['error']}"

        return response


@mcp.tool()
async def describe_scene(ctx: Context = None) -> str:
    """
    Universal scene introspection with automatic change detection.

    Returns EVERYTHING meaningful about the scene in one call:
    - Scene metadata (fps, frame range, current frame)
    - Full object hierarchy with DreamTalk semantics
    - All UserData parameters with current values
    - Materials and their assignments
    - Animation keyframes summary
    - Validation warnings
    - Changes since last call (auto-diffing)
    - Console output delta (new messages with deduplication)

    Auto-snapshots after each call for change detection on next call.
    This enables human-in-the-loop workflows where you tweak in C4D UI
    and the AI detects exactly what changed.

    Console output is captured from run_dreamtalk() and execute_python_script()
    calls, deduplicated (repeated messages show count), and truncated for safety.
    Only NEW console messages since last describe_scene() call are shown.

    Use this as the PRIMARY introspection tool. It subsumes all granular
    introspection tools (hierarchy, materials, animation, validation, diff).
    """
    async with c4d_connection_context() as connection:
        if not connection.connected:
            return "❌ Not connected to Cinema 4D"

        response = send_to_c4d(connection, {"command": "describe_scene"})

        if "error" in response:
            return f"❌ Error: {response['error']}"

        return response.get("description", "No description available")


@mcp.tool()
async def run_dreamtalk(
    path: str,
    clear_scene: bool = True,
    ctx: Context = None,
) -> str:
    """
    Execute a canonical DreamTalk Python file.

    This is THE tool for running DreamTalk scenes. It:
    1. Clears the scene (optional)
    2. Executes the .py file as __main__
    3. Triggers the `if __name__ == "__main__"` block

    Use this instead of writing inline Python when working on a DreamNode.
    All progress should accumulate in the DreamNode's .py file.

    Args:
        path: Absolute path to the DreamTalk .py file
        clear_scene: Whether to clear scene before running (default: True)
    """
    async with c4d_connection_context() as connection:
        if not connection.connected:
            return "❌ Not connected to Cinema 4D"

        response = send_to_c4d(connection, {
            "command": "run_dreamtalk",
            "path": path,
            "clear_scene": clear_scene
        })

        if "error" in response:
            return f"❌ Error: {response['error']}"

        if response.get("success"):
            return f"✅ {response.get('message', 'DreamTalk executed successfully')}"

        return str(response)


# =============================================================================
# VISUAL FEEDBACK TOOLS
# =============================================================================

@mcp.tool()
async def viewport_preview(
    frames: Optional[Union[int, List[int]]] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    ctx: Context = None,
) -> str:
    """
    ⚡ PRIMARY VISUAL FEEDBACK - Fast viewport preview (~100-200ms per frame).

    Use this tool 95% of the time for checking geometry, positioning, hierarchy,
    and general scene state. Uses hardware OpenGL renderer for speed.

    Does NOT show Sketch & Toon lines or post-effects. For those, use rendered_preview.

    After calling, use Read tool on the returned path(s) to view the image(s).

    Args:
        frames: Frame(s) to capture. Single int or list of ints.
                Examples: 30, [0, 30, 60, 90]. Default: current frame.
        width: Image width in pixels (default: 640)
        height: Image height in pixels (default: 360)

    Returns:
        Path(s) to the saved preview image(s) and timing info
    """
    async with c4d_connection_context() as connection:
        if not connection.connected:
            return "❌ Not connected to Cinema 4D"

        command = {"command": "viewport_preview"}
        if frames is not None:
            command["frames"] = frames
        if width:
            command["width"] = width
        if height:
            command["height"] = height

        response = send_to_c4d(connection, command)

        if "error" in response:
            return f"❌ Error: {response['error']}"

        if response.get("success"):
            paths = response.get("paths", [])
            frame_list = response.get("frames", [])
            total_time = response.get("total_time_ms", "?")

            if len(paths) == 1:
                return f"✅ Viewport preview captured in {total_time}ms (frame {frame_list[0]})\n\nPath: {paths[0]}\n\nUse Read tool on this path to view the image."
            else:
                paths_str = "\n".join([f"  Frame {f}: {p}" for f, p in zip(frame_list, paths)])
                return f"✅ Viewport preview captured {len(paths)} frames in {total_time}ms\n\nPaths:\n{paths_str}\n\nUse Read tool on these paths to view the images."

        return str(response)


@mcp.tool()
async def rendered_preview(
    frames: Optional[Union[int, List[int]]] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    ctx: Context = None,
) -> str:
    """
    🎨 DETAILED VISUAL FEEDBACK - Full render with Sketch & Toon (~2-10s per frame).

    Use this tool when you need to verify:
    - Sketch & Toon line drawing and stroke completion
    - Creation/draw-on animations
    - Final rendered appearance with all post-effects

    Much slower than viewport_preview. Use sparingly.

    After calling, use Read tool on the returned path(s) to view the image(s).

    Args:
        frames: Frame(s) to render. Single int or list of ints.
                Examples: 30, [0, 30, 60, 90]. Default: current frame.
        width: Image width in pixels (default: 640)
        height: Image height in pixels (default: 360)

    Returns:
        Path(s) to the saved rendered image(s) and timing info
    """
    async with c4d_connection_context() as connection:
        if not connection.connected:
            return "❌ Not connected to Cinema 4D"

        command = {"command": "rendered_preview"}
        if frames is not None:
            command["frames"] = frames
        if width:
            command["width"] = width
        if height:
            command["height"] = height

        response = send_to_c4d(connection, command)

        if "error" in response:
            return f"❌ Error: {response['error']}"

        if response.get("success"):
            paths = response.get("paths", [])
            frame_list = response.get("frames", [])
            total_time = response.get("total_time_ms", "?")

            if len(paths) == 1:
                return f"✅ Rendered preview completed in {total_time}ms (frame {frame_list[0]})\n\nPath: {paths[0]}\n\nUse Read tool on this path to view the image."
            else:
                paths_str = "\n".join([f"  Frame {f}: {p}" for f, p in zip(frame_list, paths)])
                return f"✅ Rendered preview completed {len(paths)} frames in {total_time}ms\n\nPaths:\n{paths_str}\n\nUse Read tool on these paths to view the images."

        return str(response)


@mcp.resource("c4d://primitives")
def get_primitives_info() -> str:
    """Get information about available Cinema 4D primitives."""
    return """
# Cinema 4D Primitive Objects

## Cube
- **Parameters**: size, segments

## Sphere
- **Parameters**: radius, segments

## Cylinder
- **Parameters**: radius, height, segments

## Cone
- **Parameters**: radius, height, segments

## Plane
- **Parameters**: width, height, segments

## Torus
- **Parameters**: outer radius, inner radius, segments

## Pyramid
- **Parameters**: width, height, depth

## Platonic
- **Parameters**: radius, type (tetrahedron, hexahedron, octahedron, dodecahedron, icosahedron)
"""


@mcp.resource("c4d://material_types")
def get_material_types() -> str:
    """Get information about available Cinema 4D material types and their properties."""
    return """
# Cinema 4D Material Types

## Standard Material
- **Color**: Base diffuse color
- **Specular**: Highlight color and intensity
- **Reflection**: Surface reflectivity
- **Transparency**: Surface transparency
- **Bump**: Surface bumpiness or displacement

## Physical Material
- **Base Color**: Main surface color
- **Specular**: Surface glossiness and reflectivity
- **Roughness**: Surface irregularity
- **Metallic**: Metal-like properties
- **Transparency**: Light transmission properties
- **Emission**: Self-illumination properties
- **Normal**: Surface detail without geometry
- **Displacement**: Surface geometry modification
"""


@mcp.resource("c4d://status")
def get_connection_status() -> str:
    """Get the current connection status to Cinema 4D."""
    is_connected = check_c4d_connection(C4D_HOST, C4D_PORT)
    status = (
        "✅ Connected to Cinema 4D" if is_connected else "❌ Not connected to Cinema 4D"
    )

    return f"""
# Cinema 4D Connection Status
{status}

## Connection Details
- **Host**: {C4D_HOST}
- **Port**: {C4D_PORT}
"""


mcp_app = mcp
