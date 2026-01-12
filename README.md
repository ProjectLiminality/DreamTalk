# DreamTalk
![](DreamTalk.png)
![](DreamTalk.gif)

## Philosophical Meaning

DreamTalk represents the extension of the ancient indigenous modality of SandTalk, popularised through [Tyson Yunkapurta's book](https://www.amazon.com/Sand-Talk-Indigenous-Thinking-World/dp/0062975641), into the digital domain.

SandTalk's constraints (symbols must be drawable in sand during campfire conversation):
- Line based
- Two dimensional
- No colouring, shading, or movement

DreamTalk expands these principles while retaining their essence:
- Line based (SVGs, splines)
- Two and three dimensional
- Basic colouring and shading
- Animations allowed

Photorealistic images or painterly styles (Van Gogh) are outside this class.

## Technical Implementation

A Python-based programmatic animation library inspired by 3blue1brown's manim, using Cinema 4D as its backend.

## MCP Integration

DreamTalk includes a Cinema 4D MCP server enabling Claude to interact directly with C4D via socket-based communication. This enables prompt-driven DreamTalk symbol creation and iteration.

See `CLAUDE.md` for the complete AI workflow.

---

## Future Vision

### Backend Abstraction

DreamTalk's Python API can target multiple render backends:

```
DreamTalk Python API
    │
    ├── Cinema 4D Backend (current)
    │   └── Professional: MoGraph, particles, procedural tools
    │
    └── WebGL Backend (future)
        └── Real-time: browser-native, interactive, InterBrain UI
```

### WebGL Feasibility

**Straightforward to port:**
- Primitives, splines, materials
- Animation/keyframe system
- Cloner, Fields, Effectors (math-based)
- Vertex maps, infection/growth (GPU shaders)
- Particle systems, basic physics

**Challenging:**
- 3D silhouette → vector spline extraction
- Spline morphing with topology mismatch
- Complex deformers

**C4D remains valuable for:**
- MoGraph advanced features
- Sketch & Toon outline-to-spline
- Complex procedural workflows
- Professional master renders

### Prompt-to-Symbol Pipeline

The ultimate vision:
```
Natural language prompt
    ↓ (AI)
DreamTalk Python code
    ↓ (WebGL or C4D backend)
Rendered symbol (MP4/real-time)
```

WebGL enables this fully browser-native. C4D requires hosted service.

---

## Known Limitations & Challenges

### Easing Cascade Problem

When nested CustomObjects each define `specify_creation()` with easing, the easings compound through the holarchy, producing non-visually-appealing effects.

**Current workaround:** Manually coordinate creation animations at the top level, or use linear interpolation for child objects.

**Future solution needed:** Easing applied only at outermost level, children receive "raw" normalized time.

### Animation State Management

**Status: Partially Solved**

State machines are now implemented in the syntax (`class States` with `State()` definitions). Holons like MindVirus declare states with target parameter values and can transition between them.

**Remaining work:** Automatic entry/exit animations per state, state change propagation through holarchy.

### Physics vs Keyframe Animation

**Status: Active Development**

The MindVirus holon now implements physics-based jellyfish locomotion with thrust, drag, and momentum. The `simulate()` method runs physics frame-by-frame and bakes to keyframes.

**Next phase:** Full agentic animation system with steering behaviors. See [docs/VISION_AGENTIC_ANIMATION.md](docs/VISION_AGENTIC_ANIMATION.md).

### Holarchic Animation Inheritance

When a symbol is used in a higher holon, the parent may need to trigger child animations, override parameters, or add new behaviors the child didn't anticipate.

The "software gardening" philosophy suggests: implement in the higher holon first, then extract reusable parts back to the child only if they prove generally useful.

### MoGraph vs Agentic Animation

**Status: Architecture Clarified**

MoGraph clones are stateless - they cannot move themselves or remember state between frames. For true agentic behavior (self-directed movement, neighbor awareness, goal pursuit), we use Python simulation with MoGraph optionally handling rendering at scale.

See [docs/VISION_AGENTIC_ANIMATION.md](docs/VISION_AGENTIC_ANIMATION.md) for the complete architecture.

---

## Future Vision: Agentic Animation

Beyond keyframe animation, DreamTalk is evolving toward **digital spirits** - holons with agency that understand verbs like `emerge_from()`, `wander()`, `find_place_in()`, and manifest appropriate behavior.

**Core concepts:**
- **Verb System**: Behaviors as vocabulary the holon understands
- **Holonic Agency**: Agency at every level of the holarchy
- **Steering Behaviors**: Proven algorithms (seek, arrive, separation, cohesion)
- **Formations**: Self-organization into structures
- **Emergent Cable Physics**: Organic motion as consequence of movement

**Target scenes:**
- Invisible Hand: 5 MindViruses with puppet-string cables swarm toward target
- Double Wall: 100+ MindViruses self-assemble into labyrinth structure

See [docs/VISION_AGENTIC_ANIMATION.md](docs/VISION_AGENTIC_ANIMATION.md) for the complete vision and roadmap.
