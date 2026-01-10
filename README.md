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

CustomObjects may have multiple animation "modes" (creation, thrust/locomotion, capture). Currently no standard pattern for managing state transitions.

**Desired pattern:** State machine where each CustomObject declares modes with entry/exit animations, and state changes propagate cleanly through hierarchy.

### Physics vs Keyframe Animation

Some animations work best as keyframes (precise choreography), others as physics (organic movement). DreamTalk focuses on keyframes.

**Potential approach:** Parameters that internally manage both animation AND physics-like position changes via XPresso formulas.

### Holarchic Animation Inheritance

When a symbol is used in a higher holon, the parent may need to trigger child animations, override parameters, or add new behaviors the child didn't anticipate.

The "software gardening" philosophy suggests: implement in the higher holon first, then extract reusable parts back to the child only if they prove generally useful.

### Organic Motion Patterns

Natural movement (jellyfish pulse, breathing) requires specific timing curves hard to express with standard ease functions.

**Potential implementation:**
- `UPulse` parameter type with frequency, attack, decay
- XPresso formula linking pulse phase to position delta
- Optional noise/variation overlay
