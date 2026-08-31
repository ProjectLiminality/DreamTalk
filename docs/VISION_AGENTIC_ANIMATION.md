# Vision: Agentic Animation & Digital Spirits

*The north star for DreamTalk's evolution from keyframe animation to living, intentional holons.*

---

## The Endgame: Digital Spirits

DreamTalk holons are not meshes with keyframes. They are **beings** with:
- An **essence** (what it IS - a manipulative narrative, a flame, a labyrinth)
- **Behaviors** (what it DOES - hunts, attaches, forms walls, wanders)
- **Appearance** (how it LOOKS - geometry, strokes, cables)

When you say "spawn MindViruses from a hole and build a labyrinth wall outward," you're not specifying animation curves. You're describing **intent**, and the digital spirit understands how to fulfill that intent given its nature.

### The Inversion

| Traditional Animation | Digital Spirits |
|----------------------|-----------------|
| "At frame 30, object X is at position Y with rotation Z" | "MindVirus, emerge and find your place in this wall" |
| Choreograph every detail | Invoke with intent, spirit handles the rest |
| Keyframes as source of truth | Behaviors as vocabulary |

The MindVirus *knows* how to emerge (unfold animation). It *knows* how to move (jellyfish physics). It *knows* how to find a slot (steering + formation). It *knows* how to settle (arrive + attach).

---

## Holonic Agency

Agency exists at every level of the holarchy. Intent cascades downward; emergence cascades upward.

```
┌─────────────────────────────────────────────────────────────────┐
│  SCENE / DREAM                                                   │
│  Intent: "Tell the story of infection"                          │
│  Agency: Orchestrates all holons toward narrative               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  INVISIBLE HAND (Holon)                                         │
│  Intent: "Release and control the swarm"                        │
│  Agency: Decides when to open, which target to direct toward    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MINDVIRUS SWARM (Holon)                                        │
│  Intent: "Find and infect target" / "Become the wall"           │
│  Agency: Coordinates individuals, assigns slots, manages flow   │
│  Emergence: Swarm patterns emerge from individual behaviors     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MINDVIRUS (Holon)                                              │
│  Intent: "Go to slot X" / "Pursue target Y"                     │
│  Agency: Navigates, avoids obstacles, manages own physics       │
│  Emergence: Cable behavior emerges from movement                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CABLE (Part of MindVirus)                                      │
│  Intent: "Follow the body naturally"                            │
│  Agency: Each segment responds to spring physics                │
│  Emergence: Organic motion emerges from simple forces           │
└─────────────────────────────────────────────────────────────────┘
```

Each level:
- Has agency appropriate to its scale
- Receives intent from above
- Exhibits emergence from below

This mirrors biological systems: cells have agency, organs have agency, organisms have agency, swarms have agency.

---

## The Architecture: Four Layers

Modern game engines (Unreal Engine 5, etc.) discovered that smooth character animation requires **decoupling intent from execution**. We adapt this for DreamTalk:

### Layer 1: Intent (Agentic / Scripted)

What the agent **wants** to achieve:
- Target position or object
- Behavior state (wander, pursue, attach, idle)
- Goal (find slot, infect target, form wall)

This is what AI or scripted choreography controls. Pure intent, no implementation details.

### Layer 2: Steering (Craig Reynolds' Behaviors)

How to **navigate** toward the intent. Pure functions that output desired velocity:

| Behavior | Description |
|----------|-------------|
| `seek(target)` | Move toward point |
| `flee(threat)` | Move away from point |
| `arrive(target)` | Seek with deceleration |
| `wander()` | Organic random walk |
| `pursue(target)` | Seek with prediction |
| `evade(threat)` | Flee with prediction |
| `separation(neighbors)` | Avoid crowding |
| `alignment(neighbors)` | Match group velocity |
| `cohesion(neighbors)` | Stay near group center |
| `follow_field(field)` | **MoGraph bridge** - follow C4D field |
| `seek_slot(formation)` | Find empty spot in structure |

Behaviors combine with weights: `0.5*seek + 0.3*separation + 0.2*wander`

### Layer 3: Locomotion (Physics)

How the body **physically moves** given desired velocity:
- Current velocity, angular velocity
- Thrust pulses to match desired_velocity (jellyfish physics)
- Rotation toward movement direction
- Drag, momentum, mass
- Outputs: position, rotation (keyframed or live)

For MindVirus, this is the jellyfish pulse system - steering says "go left," locomotion figures out how many thrust pulses and rotations achieve that.

### Layer 4: Animation (Visual Expression)

How movement **looks**:
- Thrust → fold pulse animation
- Idle → gentle breathing
- Attach → wrap animation
- Derived from locomotion state, not driving it

The fold animation is a **consequence** of thrusting, not something separately choreographed.

---

## The Verb System: Behaviors as Vocabulary

Instead of choreographing keyframes, we give holons a **vocabulary of verbs** they understand:

```python
# Current (algorithmic)
virus.simulate([
    (0, 'thrust', {'power': 1.0}),
    (30, 'yaw', {'amount': 0.5}),
    ...
])

# Endgame (intentional)
virus.emerge_from(hole)
virus.wander(duration=2)
virus.find_place_in(wall)

# Or chained fluently
virus.emerge_from(hole).wander(duration=2).find_place_in(wall)
```

### Core Verbs for MindVirus

| Verb | Meaning | Implementation |
|------|---------|----------------|
| `emerge_from(point)` | Spawn at point, unfold, begin moving | Set position, play create animation, enable physics |
| `wander(duration)` | Float aimlessly with organic movement | Noise-driven steering, jellyfish locomotion |
| `seek(target)` | Move toward target | Seek steering behavior |
| `pursue(target)` | Hunt target with prediction | Pursue steering behavior |
| `find_place_in(formation)` | Claim and navigate to a slot | Slot claiming + arrive steering |
| `attach_to(target)` | Arrive and wrap around target | Arrive steering + wrap animation |

Verbs compose naturally. The implementation details (steering weights, physics parameters) are hidden inside the spirit's understanding of each verb.

### The LLM Endgame

Eventually, behavior itself could be LLM-driven:

```python
def decide(self, perception):
    """Given what I perceive, what should I do?"""
    response = llm.query(f"""
        You are a MindVirus - a manipulative narrative entity.
        You see: {perception}
        Your current goal: {self.goal}
        What do you do? Respond with a verb and parameters.
    """)
    return parse_verb(response)
```

But the verb system gives us intuitive syntax now, without requiring LLM inference per frame.

---

## MoGraph Integration: The Bridge

MoGraph and agentic animation serve different purposes:

| Aspect | MoGraph | Agentic |
|--------|---------|---------|
| **Model** | Declarative (describe arrangement) | Imperative (agents decide) |
| **State** | Stateless function of (index, position, fields) | Persistent memory between frames |
| **Movement** | Cloner dictates position | Agents move themselves |
| **Communication** | No clone-to-clone awareness | Agents perceive neighbors |
| **Scale** | Thousands efficiently | Hundreds with full behavior |

### The Hard Limitation

**MoGraph clones cannot move themselves.** The Cloner dictates position. A clone can vary its appearance based on position, but cannot say "I want to move 10 units left next frame."

### The Bridge: `follow_field()`

```python
def follow_field(agent, field):
    """
    Steering behavior that follows a C4D MoGraph field.

    This lets agents USE all of MoGraph's field types:
    - Linear fields for directional flow
    - Spherical fields for attraction/repulsion
    - Spline fields for path following
    - Random fields for variation

    But the AGENT decides when/how much to follow.
    """
    field_value = field.sample(agent.position)
    field_direction = field.sample_direction(agent.position)
    return field_direction * field_value * agent.field_sensitivity
```

An agent can:
- Follow a field when wandering (MoGraph-like behavior)
- Ignore the field when pursuing a target (agentic override)
- Blend field influence with other steering (hybrid)

### Three Approaches for Swarms

| Scenario | Approach | Description |
|----------|----------|-------------|
| **Small swarm (5-20), full agency** | Pure Python | Spawn N actual MindVirus instances, each runs own simulation |
| **Medium swarm (50-100), moderate agency** | Hybrid | Python simulation writes positions to targets, Cloner renders |
| **Massive swarm (1000+), simple rules** | Pure MoGraph | Cloner + Fields, choreographed appearance of agency |

### The Synthesis Path

1. Build agentic system in pure Python first
2. Create **baking** step that writes agent positions to MoGraph-consumable format
3. Use MoGraph for final rendering at scale

MoGraph becomes a **rendering/instancing** optimization, not the simulation system.

---

## Formations: Self-Organization

For scenes like the labyrinth wall, agents need to self-organize into structures. This requires the concept of **Formations** - predefined positions that agents claim:

```python
class Formation:
    """
    A set of target positions that agents can claim.
    Generated from mesh, cloner, or procedural definition.
    """

    def __init__(self, mesh=None, cloner=None, grid=None):
        self.slots = []  # List of (position, rotation, claimed_by)

        if mesh:
            # Generate slots from mesh faces/edges
            self.slots = self._slots_from_mesh(mesh)
        elif cloner:
            # Extract clone positions from MoGraph cloner
            self.slots = self._slots_from_cloner(cloner)

    def nearest_unclaimed(self, position):
        """Find the closest slot not yet claimed."""
        ...

    def claim(self, slot_index, agent):
        """Agent claims a slot as their destination."""
        ...
```

### The `seek_slot()` Steering Behavior

```python
def seek_slot(agent, formation):
    """
    Steering: find and move toward an unclaimed slot.
    This is how agents self-organize into structures.
    """
    if agent.claimed_slot is None:
        slot = formation.nearest_unclaimed(agent.position)
        if slot:
            formation.claim(slot, agent)
            agent.claimed_slot = slot

    if agent.claimed_slot:
        return arrive(agent, agent.claimed_slot.position)
    else:
        return wander(agent)
```

### The Labyrinth Vision

```python
class LabyrinthGrowth(Holon):
    """MindViruses self-assemble into a labyrinth structure."""

    def __init__(self, labyrinth_mesh, num_agents=200):
        # Generate formation slots from mesh (double-wall structure)
        self.formation = Formation(mesh=labyrinth_mesh, mode="double_wall")

        # Create flow field inside the corridors
        self.corridor_field = SplineField(labyrinth_mesh.centerline)

        # Spawn agents
        self.agents = [MindVirus(agent=True) for _ in range(num_agents)]

    def simulate(self):
        for frame in range(total_frames):
            for agent in self.agents:
                if agent.state == "SEEK_SLOT":
                    steering = (
                        0.6 * seek_slot(agent, self.formation) +
                        0.2 * separation(agent, self.agents) +
                        0.2 * follow_field(agent, self.corridor_field)
                    )
                agent.apply_steering(steering)
                agent.update_physics()
```

---

## Cable Physics: Emergent Organic Motion

The cable trailing the MindVirus should behave naturally as a **consequence** of movement, not as a separately choreographed element.

### Two Approaches

**Approach A: Procedural Spring Chain (Pure Python)**
- Model cable as chain of points connected by springs
- Each point has: spring forces to neighbors, drag, optional gravity
- First point anchored to spawn/finger, last point follows MindVirus
- Full artistic control, deterministic, reproducible

**Approach B: Cinema 4D Dynamics**
- Use C4D's built-in hair/spline dynamics
- Attach to anchor, constrain end to MindVirus
- Hardware-accelerated, less control

### Recommended: Approach A

For the puppet-master aesthetic (Spider-Man 2 tentacles, marionette strings):

1. Cable **grows** from anchor point (not pre-existing at full length)
2. Precise control over stiffness, sway, tension feel
3. Deterministic animation (no simulation variance between renders)
4. Cable-to-cable interaction possible (future)

### Cable Properties

| Property | Description |
|----------|-------------|
| `anchor` | World position or object the cable emerges from |
| `stiffness` | How rigid vs floppy (spring constant) |
| `damping` | How quickly oscillations settle |
| `segments` | Number of chain links (detail level) |
| `growth_rate` | How fast cable extends as agent moves away |

The cable's motion is **emergent** from the spring physics responding to the MindVirus's movement. No explicit cable animation needed.

---

## Target Scenes

### Scene 1: Invisible Hand

A hand opens, releasing 5 MindViruses that swarm toward a target.

```python
class InvisibleHand(Holon):
    """A hand that spawns and controls 5 MindViruses."""

    def specify_parts(self):
        self.hand_mesh = HandMesh(...)
        self.mind_viruses = [
            MindVirus(
                cable_anchor=self.hand_mesh.finger_tips[i],
                agent=True,
            )
            for i in range(5)
        ]

    def release_swarm(self, target):
        """Hand opens, MindViruses swarm toward target."""
        return AnimationGroup(
            self.hand_mesh.open(),
            *[virus.emerge_from(self.palm).pursue(target)
              for virus in self.mind_viruses]
        )
```

**Key elements:**
- Cables grow from fingertips as MindViruses move away
- Each MindVirus has full agency (pursuit, obstacle avoidance)
- Cables exhibit organic spring physics
- Final wrap animation when MindViruses reach target

### Scene 2: Double Wall / Labyrinth

MindViruses self-assemble into a labyrinth structure.

```python
class DoubleWall(Holon):
    """Two mirrored walls forming a hidden corridor."""

    def specify_parts(self):
        self.formation = Formation(
            grid=(10, 5),  # 10 wide, 5 tall
            mode="double_wall",  # Mirrored, cables inward
        )
        self.swarm = MindVirusSwarm(
            count=100,
            spawn_point=self.corridor_entrance,
        )

    def grow_outward(self):
        """Wall grows from center outward."""
        return self.swarm.find_places_in(
            self.formation,
            order="center_out",
            travel_path=self.corridor_field,
        )
```

**Key elements:**
- Formation generated from geometry
- Agents travel through hidden corridor
- 90-degree turn to settle into wall position
- Cable physics with potential inter-cable interaction
- Growth animation via Linear Field or agent spawning order

---

## Performance Considerations

### Scaling Characteristics

| Agent Count | Neighbor Queries | Approach |
|-------------|------------------|----------|
| 5-20 | O(n²) = 400 max | Pure Python, real-time possible |
| 50-100 | O(n²) = 10,000 | Python simulation, sub-second per frame |
| 500+ | O(n²) = 250,000 | Needs spatial partitioning (grid/octree) |

### Spatial Partitioning

For large swarms, divide space into cells. Only check neighbors in adjacent cells:
- Average case: O(n) instead of O(n²)
- Implementation: Grid hash or octree
- When needed: 200+ agents with separation/cohesion behaviors

### Our Advantage: Offline Rendering

Unlike games requiring 60fps, DreamTalk can afford expensive simulation:
- Seconds per frame is acceptable for final render
- Simulation can be cached/baked to keyframes
- Quality over real-time performance

---

## The Horizon: What's Coming

### Behavior Distillation (The "Nanite for Agents")

Just as Nanite lets artists author detailed meshes and the engine handles LOD:

1. Define rich, expensive agent behaviors
2. System trains small neural net to approximate them
3. At runtime, neural net runs on GPU for thousands of agents

This is likely coming (research labs are working on it). For now, we don't need it - our scenes have tens to hundreds of agents.

### LLM-Driven Behavior

The verb system is the stepping stone. Eventually:
- Natural language describes behavior
- LLM translates to verb chains
- Or LLM sits in the OODA loop making per-frame decisions

The architecture supports this - Intent layer is already decoupled from implementation.

---

## Implementation Roadmap

### Phase 1: Core Steering Behaviors
- Implement seek, arrive, wander, flee as pure Python functions
- Test with single MindVirus navigating to target
- Integrate with existing jellyfish locomotion

### Phase 2: Verb System
- Create chainable verb API on MindVirus
- Implement `emerge_from()`, `wander()`, `seek()`, `find_place_in()`
- Each verb manages state transitions internally

### Phase 3: Cable Spring Physics
- Replace tracer-based cable with spring chain
- Implement anchor system (cable grows from point)
- Tune stiffness/damping for organic feel

### Phase 4: Formations
- Create Formation class (from mesh, grid, or cloner)
- Implement slot claiming and `seek_slot()` behavior
- Test with small self-organizing swarm

### Phase 5: Swarm Orchestration
- Create MindVirusSwarm holon
- Implement separation/cohesion behaviors
- Build Invisible Hand scene

### Phase 6: MoGraph Bridge
- Create baking system (simulation → keyframes/targets)
- Test hybrid approach for larger swarms
- Optimize for 100+ agents

---

## Philosophy Encoded

The architecture itself teaches:

1. **Intent over implementation** - Describe what you want, not how to achieve it
2. **Emergence over choreography** - Complex behavior emerges from simple rules
3. **Holonic agency** - Every level has appropriate autonomy
4. **Verbs as vocabulary** - Behaviors are words the spirit understands
5. **Physics as truth** - Movement follows physical laws, animation is consequence

DreamTalk evolves from an animation library to a **conjuring system** - you describe a spirit's nature and intent, and it manifests appropriately in whatever context it finds itself.

---

*"The goal is not to animate, but to give life."*
