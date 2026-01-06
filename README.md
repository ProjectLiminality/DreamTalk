# DreamTalk
![](DreamTalk.png)
![](DreamTalk.gif)

# Philosophical meaning:

Philosophically, DreamTalk represents the extension of the ancient indigenous modality of SandTalk, popularised through [Tyson Yunkapurta's book](https://www.amazon.com/Sand-Talk-Indigenous-Thinking-World/dp/0062975641) of the same name, into the digital domain.
The landscape of SandTalk is characterised by the constraint that for all symbols of that class it needs to be feasible to draw them in the sand during conversation around the campfire.

This translates to the following constraints:
- line based
- two dimensional
- no colouring
- no shading
- no movement
   
DreamTalk takes the fundamental principles of SandTalk and carefully expands them to span a larger space while still retaining the essential qualities of the original modality.

As such its features consist of:
- line based (SVGs, splines etc.)
- two and three dimensional
- basic colouring
- basic shading
- animations allowed
  
So a photorealistic image for example would not be considered part of that class, neither would a Van Gogh.

# Technical meaning:

Technically, these principles are being worked into a python based programmatic animation library of the same name inspired by 3blue1brown's pioneering work in this space with "manim"
In its current implementation it uses the popular computer graphics software Cinema4D as its backend.

# Future: MCP Integration

For AI-assisted 3D modeling and scene manipulation, there's a [Cinema 4D MCP server](https://github.com/ttiimmaacc/cinema4d-mcp) that enables Claude to interact directly with Cinema 4D via socket-based communication. This could enable prompt-driven DreamTalk symbol creation.
