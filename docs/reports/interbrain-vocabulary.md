# InterBrain Vocabulary Report — "The InterBrain – How Collective DreamWeaving Can Heal the World" (2025-05-29, 47:15)

Reconnaissance for corpus #14 (CORPUS.md tier T4). The richest single
statement of the larger vision, and its production folder (Keynote deck,
Manim code, C4D projects) is lost. So this report reads everything from the
pixels and the voice, and its main output is not a segment table but a
**concept ↔ symbol ontology**: every central idea the narration names, the
symbol the frames give it, and whether that symbol already lives in the
framework. The goal is modular: each concept becomes ONE holon, and every
chapter becomes a composition that imports them.

**The headline.** About two thirds of the cast already exists under other
names. The video *is* the framework's own vocabulary seen from the other
side: its domesticated eye is `MolochEye`, its "Vision" seed is the `SMark`
inside `Regenaissance`, its DreamTalk symbol is `LightNode`, its fragmented
Earth is the blue lobe of the Web3 `YinYang`, its "third axis" is the founding
`Cylinder`, its arms-race curve is `Plot`, and its closing frame is `Logo`.
The genuinely new symbols are the ones the InterBrain ontology itself names —
DreamNode, the domesticated/liminal Mind, SandTalk and the Tribe, the War
Machine, the Noosphere in its states, the Worldview prism, the SongLine,
DreamGarden, the Coherence Beacon — plus one stateful particle field that
carries the whole film's mood (red fragmentation ↔ cyan wholeness).

**Sources analysed** (read-only; media in gitignored `refs/interbrain/`):

- `refs/interbrain/IB14_InterBrain.mkv` — YouTube `v5dBRmjF8mc`, 1080p30
  h264 + opus, 2835.0 s. `.info.json` and `.description` beside it. No
  official or auto subtitles were offered for download.
- `refs/interbrain/frames5/f_00001..f_14174.jpg` — 5 fps at 1280×720
  (`f_N` ≈ t = (N−1)/5 s), 746 MB.
- `refs/interbrain/audio.m4a`, `audio16k.wav`.
- `refs/interbrain/transcript/narration.{srt,vtt,txt,tsv,json}` +
  `narration.lines.txt` — mlx_whisper large-v3-turbo, word timestamps,
  `--condition-on-previous-text False --hallucination-silence-threshold 2`.
  Good, not perfect: "Noosphere" comes out as "Neuosphere/Newell sphere", a
  handful of clause-starts are dropped at segment joins (e.g. 1:17 "…order
  becomes", 3:55 "two unstable attractors", 14:05 "…a war machine"). Quote
  the audio, not the text, where wording matters.
- `refs/interbrain/analysis/scan.json` — per-frame luminance / ink /
  saturation / motion over all 14,174 frames.
- `refs/interbrain/sheets/` — 3-second contact sheets of the whole film
  (all 20 viewed).
- In this repo: `docs/reports/interbrain/concept-atlas.jpg` (60 labelled key
  frames, one per concept) and `docs/reports/interbrain/ch{1..8}-sheet.jpg`
  (48 evenly spaced frames per chapter).

## 0. Timing model (measured)

The video has a declared chapter list (YouTube description) and one
continuous narration over the 3Blue1Brown score (Vincent Rubinetti; credited
in the description). Unlike PL02 there is no deck to read durations from, so
**every timing here is measured** (DECISIONS 2026-09-07, refused-fits rule).

- **Chapters are music-bridged.** Each chapter closes with the narration
  stopping, an 8–25 s music-only bridge, a 2–4 s dip to black, then a
  serif title card (white, centred; "In Search of the Third Attractor" is
  two lines) held ≈5–8 s, then the chapter's first image. Whisper's silence
  gaps put the bridges at 318–343, 634–648, 967–977, 1393–1402, 1590–1602,
  2061–2085, 2442–2456 s (+ 2651–2666, the music beat before the talking
  head).
- **The film opens before the voice**: 0–20 s is the domesticated eye
  opening, its red particle swarm, and the first title.
- **Pace is steady**: 122–134 words/min in every chapter.
- **Motion share differs sharply by technique** (frames with no change,
  threshold 0.0015, 160×90 grey): ch1 48 % still (particle-heavy), ch2 81 %,
  ch3 76 %, ch4 69 %, ch5 74 %, ch6 75 %, ch7 55 % (particles + C4D), ch8
  28 % (particles, then live footage). Like PL02, most of the middle of the
  film is held tableaux with short builds; ch1, ch7 and ch8 are continuously
  animated.
- **Only two hard cuts** in the whole film (2733.4 s and 2763.8 s — inside
  the talking-head footage). Everything else is dissolves, Magic-Move-style
  morphs, and draws — i.e. it was assembled as one continuous Keynote
  timeline with rendered movies placed on slides.

## 1. Chapter table

| # | Chapter (YouTube) | Window (s) | Title card | Dominant technique |
|---|---|---|---|---|
| 1 | In Search of the Third Attractor | 0–333 | ≈12–17 s | Keynote line-art + **particle field** (red/cyan streaks, C4D or Manim) + the founding cylinder |
| 2 | The Ancient Arms Race | 333–638 | ≈335–343 | Keynote line-art + Keynote icons; spheres, prism, war-machine triangles, generations chart |
| 3 | The Vicious Cycle | 638–971 | ≈640–648 | Keynote: Worldview prism, divide-and-conquer fractal, war-machine pyramid; one SVG-sketch asset (hands); one footage collage (news anchors, 16:06) |
| 4 | Going Upstream | 971–1395 | ≈973–981 | Keynote; Engineering│Gardening divide (grid vs flower of life); SandTalk; tribes; particle "resonance" ripples |
| 5 | Fixing The Lens | 1395–1593 | ≈1397–1403 | Keynote; domesticated → liminal mind; Noosphere disk ↔ fragmented vortex; **C4D** freedom-ball / order-cube; the prism again; a third-party app logo |
| 6 | Introducing the InterBrain | 1593–2070 | ≈1596–1603 | Keynote; DreamTalk, DreamNode, DreamGarden, liminal web, digital campfire (**C4D**-shaded app icon), SongLine, Earth (Keynote 3D) |
| 7 | Breaking the Spell | 2070–2446 | ≈2072–2080 | Keynote + **C4D** (3D holarchy, hyperspace tunnel of DreamNodes) + particles; DreamSong, DreamWeaving, Coherence Beacon |
| 8 | A New Beginning | 2446–2835 | ≈2448–2454 | Keynote + particles; InterBrain sphere, applications ring, war machine → hyper-agent of love; **live footage** 2664–2820 (David under a tree, symbol picture-in-picture); Logo end card 2820–2835 |

Corpus note: #15 "In Search of the Third Attractor" (2025-05-30, 5:47) is
very likely chapter 1 re-cut as a standalone — same title, one day later,
346 s vs 333 s. Unverified (not downloaded).

## 2. Beats per chapter (timestamps = video time; key frame = `frames5` index)

### Ch 1 — In Search of the Third Attractor (0–333)

| t | Beat | Key frame |
|---|---|---|
| 0–11 | The **domesticated eye** (almond lids, circle iris holding a blue perspective cube) opens from a slit; red streak particles burst off it and dissolve | f31, f46 |
| 12–17 | Title card | f61 |
| 20–34 | The eye zooms through the iris cube; blue light bars; **the fragmented Earth** (Earth in blue flower-of-life ring, lightning bolts, red spiral field lines) | f121, f166 |
| 36–56 | Africa map → **two boxed tribes** (people on a disc inside blue perspective cubes, i.e. narrative cages); a yellow glow (each tribe's value) in each; a bolt between | f226, f271 |
| 57–89 | "freedom-order dialectic": **red circle "freedom" ⚡ blue square "order"**; morph to triangles that turn and point, bolt flipping — "freedom becomes an attack on order…" | f346, f436 |
| 96–108 | Bolts explode out: **Chaos** (red circle radiating bolts) / **Oppression** (blue square radiating bolts); red particle storm | f541, f556 |
| 117–128 | Equations: freedom × [domesticated eye] = Chaos; order × [eye] = Oppression ("× fragmentation") | f601 |
| 129–170 | Oscillation: a glowing ball shuttles between circle and square inside the red field; a sine trace grows under it (the endless cycle) | f736, f781 |
| 168–188 | **Arms-race plot**: exponential curve with Keynote weapon icons (spear… tank… bomb… satellite… drone/laptop) | f931 |
| 189–196 | Equations again with **exp(…)** — the pathologies grow | f976 |
| 198–255 | The oscillation speeds up; split-screen timelines collapse into chaos or oppression; "middle path" = a dim compromise box between the two | f1036, f1171 |
| 258–275 | Clean diagram: circle — ball on a line — square, the domesticated eye below it | f1306 |
| 276–310 | **The orthogonal axis**: a vertical line rises from the ball to a **cylinder** with the **liminal eye** (S-mark iris) above it — fragmentation → wholeness; the ball travels up into the cylinder | f1381, f1516 |
| 310–333 | Particle field turns from red to **cyan**; the cylinder flies through a cyan starburst ("third attractor of wholeness … freedom enriches order, order nourishes freedom") | f1606, f1621 |

### Ch 2 — The Ancient Arms Race (333–638)

| t | Beat | Key frame |
|---|---|---|
| 343–352 | Recap of the oscillation in the red field | f1741 |
| 354–368 | Arms-race plot again | f1801 |
| 369–400 | **War as engineering**: two minds in blue triangles ⚡; one grows with weapon icons around it, the other shrinks — "maximise the asymmetry in agency" | f1861, f1966 |
| 402–440 | **Three spheres**: Earth (Physical Engineering → Infra-structure → **Biosphere**), circle of tiny figures (Social Engineering → Social-structure → **Social Sphere**), geodesic lattice sphere (Narrative Engineering → Super-structure → **Noosphere**); Keynote icon rows above each (factory/bus/train · courthouse/school/hospital · ☪ ✡ ✝ ⚛) | f2056, f2236 |
| 450–455 | The three spheres in an S-arc (integrated whole) | f2251 |
| 455–475 | **Noosphere as lens**: Earth → light → lattice sphere (glow) → rainbow → social sphere | f2311, f2341 |
| 477–510 | Vertical stack: **Order of influence** (red ↓) and **Ladder of leverage** (blue ↑); the **War Machine** (eye-in-triangle) climbs the ladder: Physical → Social → Narrative Engineering | f2416, f2506, f2566 |
| 518–534 | Two minds ⚡ → **divide and conquer fractal** (triangles of minds, puppeteer hands on top) | f2641, f2671 |
| 535–585 | **Generations of warfare**: axes Breadth × Depth; diagonal bands of Keynote icons (gun, tank, bomb, satellite · flag, troops, compass · antenna, phone/laptop, eye-in-triangle) labelled "Psychological / Narrative Warfare" | f2746, f2836 |
| 588–608 | **Nuke vs psy-war**: Earth + bomb → mushroom cloud; noosphere + phone/laptop → fragmented tribe cycle | f2986, f3031 |
| 612–634 | The **vicious cycle** glyph: two minds ⚡ in a ring of two boxed heads, red spiral field lines, rotating | f3091 |

### Ch 3 — The Vicious Cycle (638–971)

| t | Beat | Key frame |
|---|---|---|
| 650–672 | **Worldview**: Earth → eye; direct path crossed out (✗, "?") | f3256, f3331 |
| 672–690 | A **prism** (triangle) between them: light → rainbow → eye; a feedback loop around it; the prism becomes the lattice sphere (the Noosphere is the lens) | f3391, f3451, f3466 |
| 700–711 | **The manipulated lens**: fragmented Earth → prism with a cube inside → *smeared* rainbow → eye "?"; **puppeteer fists** (marionette controls) above the prism | f3511, f3541 |
| 711–720 | Narrative cube in prism + bust → the mind inside the triangle, strings to the fist | f3556, f3586 |
| 720–770 | **Divide and conquer** builds recursively: triangle of minds ⚡ → triangles of triangles, puppeteer hands at each corner | f3661, f3781 |
| 762–768 | SVG sketch: **two hands holding a tilted frame** (a controller) | f3826 |
| 770–800 | Two fractal pyramids ⚡; boxed tribes return (cube cages) | f3871, f4021 |
| 806–815 | Domesticated eye replaces the apex: **"spirit of fragmentation"** sits above the pyramid; the hands hold the eye | f4141, f4186 |
| 840–895 | **The War Machine**: full pyramid (eye at apex, fist-marionettes, minds in triangles, bolts everywhere), "Power" arrows up both flanks | f4351 |
| 897–940 | **Multipolar**: several fists pull the prism in different directions; the rainbow shreds; many "?" | f4561 |
| 915–930 | Hands holding the noosphere; red field with the oscillation | f4591, f4636 |
| 955–962 | Chaos ⚡ "censorship" (blue square) — the freedom-order dilemma in the noosphere | f4786 |
| 962–967 | A head inside a blue box with strings; **news-anchor collage** (external footage) | f4816, f4831 |

### Ch 4 — Going Upstream (971–1395)

| t | Beat | Key frame |
|---|---|---|
| 978–990 | War Machine ladder recap; the noosphere sphere (blue flower of life) | f4906 |
| 990–1012 | Hands hold the noosphere-with-eye; red field; war-machine pyramid | f4936, f5026 |
| 1020–1028 | **Narrative-engineered noosphere** (blue flower-of-life sphere) ringed by six boxed heads ⚡ | f5146 |
| 1035–1100 | **The boxed web**: a blue hexagonal network of cube-headed busts ("our contemporary communication media … tuned to amplify narrative engineering"); boxes appear/disappear on heads; a glow travels it | f5221, f5341 |
| 1101–1112 | Narrative Engineering → ? | f5536 |
| 1113–1126 | **Engineering │ Gardening**: an S-curve divides a blue grid (a ziggurat being built) from a red flower-of-life field (a seed of light grows into a tree) | f5581, f5626 |
| 1128–1146 | **Narrative → Vision**: cube-in-blue-ring → S-mark-in-red-ring; blue flower-of-life sphere → red ringlet sphere (Narrative Engineering → Vision Gardening) | f5686, f5716 |
| 1150–1170 | The divide again: Narrative Engineering (cube) │ Vision Gardening (S-mark with a growing light) | f5821 |
| 1170–1176 | S-arc: Narrative-Engineering sphere → Vision-Gardening sphere | f5851 |
| 1178–1215 | **SandTalk**: two heads and a campfire in a red ellipse; a symbol drawn in the sand; **Seed** (sand symbol) / **Soil** (the circle) | f5941, f5986, f6016 |
| 1215–1230 | Many campfires → the **Tribe**: red hexagon of seven minds with campfires on the edges; **cyan resonance ripples** run round it | f6091, f6106 |
| 1233–1240 | freedom of speech × [vision particle burst] → order (the ancient medium) | f6166 |
| 1250–1290 | Tribes of tribes (dim red hexagon lattice); Dunbar scale | f6286, f6376 |
| 1293–1305 | **Ancient → Book → Radio tower → Modern** timeline (red tribe hex → blue boxed web) | f6496 |
| 1305–1320 | Book alone; a radio tower rises out of it in a red burst | f6526, f6586 |
| 1322–1336 | freedom of speech × [book+tower in red swarm] ⚡ order | f6646, f6691 |
| 1340–1373 | The boxed web grows huge; red infection swarms through it ("mind viruses go viral") | f6736, f6826 |
| 1380–1395 | **Spirit** (red tribe) vs **Scale** (blue web); S-arc between them ("a synthesis of the modern with the ancient") | f6931, f6961 |

### Ch 5 — Fixing The Lens (1395–1593)

| t | Beat | Key frame |
|---|---|---|
| 1403–1418 | **Domesticated → liminal**: domesticated eye over a cube-headed mind in a blue triangle → liminal eye over an S-headed mind in a red circle | f7021 |
| 1418–1437 | Manipulated-lens image; the liminal eye inside a ring of minds in flower-of-life circles (the collective of liminal minds) | f7096, f7186 |
| 1437–1450 | Collective condenses into a **red flower-of-life disk** (the whole noosphere); bolts around it; it splits into six | f7231, f7261 |
| 1455–1470 | **C4D**: a glass cylinder; a red ball (freedom) and a blue ice cube (order) ⚡ over cube-in-ring and S-in-ring badges ("break a nuanced topic into partial truths") | f7291, f7366 |
| 1470–1490 | Disk → hexagon → **fragmented vortex**: six blue lattice triangles turning around a knot of fists, bolts between, red spiral field lines | f7441, f7471 |
| 1490–1510 | Worldview (world-prism-eye) ↔ vortex ("fragmentation within worldviews mirrors fragmentation between") | f7501 |
| 1512–1532 | Scissors cut the puppet strings; the arrow reverses: the eye **looks at the lens** rather than through it | f7561, f7606 |
| 1540–1555 | The Earth is replaced by a **second-brain app icon** (third-party PKM logo; external brand) in a box: a "digital twin" of the worldview | f7726, f7741 |
| 1557–1574 | Bust ⇅ second brain = "Personal Knowledge Management"; the boxed web becomes a web of second brains | f7801, f7846, f7891 |
| 1575–1590 | Worldview ↔ vortex again | f7921 |

### Ch 6 — Introducing the InterBrain (1593–2070)

| t | Beat | Key frame |
|---|---|---|
| 1602–1620 | Personal Knowledge Management recap | f8011 |
| 1620–1650 | **Personal → Collective**: bust ⇅ second brain → three liminal minds ⇅ **InterBrain** (app icon carrying the Logo, in overlapping red circles) | f8146, f8221 |
| 1653–1668 | **The Vault**: a hierarchy of Category boxes and documents (knowledge "managed") | f8281, f8341 |
| 1670–1688 | Ancient → Modern timeline recap | f8386 |
| 1688–1700 | Personal Knowledge **Management** → Collective Knowledge **Gardening** | f8491 |
| 1700–1718 | Second brain → InterBrain; document → "?" (the new fundamental unit) | f8506, f8551 |
| 1718–1740 | **SandTalk** close-up: two heads, fire, a radiant sand symbol ("Sand Talk") | f8656 |
| 1740–1758 | → **Digital SandTalk** → **DreamTalk**: the radiant Earth in a red ring with twelve rays | f8716, f8761 |
| 1764–1810 | + blue ring = **GitRepo** → **DreamNode**; film / book / music / game-controller icons around it ("anything that can be expressed digitally") | f8836, f8986, f9076 |
| 1812–1835 | Inside a DreamNode: commit history (a chain of linked frames); the InterBrain app's own DreamNode | f9166, f9211 |
| 1836–1860 | **Dreamer** (portrait sketch in red ring) and **Dream** (blue ring) — the two node types | f9256, f9271 |
| 1862–1888 | **DreamGarden**: a big red circle holding DreamNodes, no structure | f9346, f9406 |
| 1888–1925 | **Digital campfire**: two InterBrains, overlapping red ellipses (shared space), heads at a fire with the S-mark; **C4D**-shaded app icons with node menus | f9451, f9541 |
| 1926–1955 | **Liminal web**: a node at the centre, its dreamers/dreams orbiting; a story ↔ its peers (a portrait in the centre, then a dream in the centre) | f9646, f9721, f9751 |
| 1955–1980 | Ancient/Modern; two heads around a node; digital campfire again | f9796, f9826 |
| 1975–1985 | Earth with call-arcs ("the digital campfire, i.e. video calls … around the globe") | f9886, f9916 |
| 1985–2000 | Two InterBrains → the **InterBrain lattice** (red triangular web of app icons) scaling past Dunbar | f9946, f9991 |
| 2015–2040 | **SongLine**: a DreamNode with a stack of campfire clips above it ("a chain of provenance") | f10096, f10141 |
| 2040–2060 | Lattice; a node blooms and **resonance ripples** run out | f10216, f10321 |

### Ch 7 — Breaking the Spell (2070–2446)

| t | Beat | Key frame |
|---|---|---|
| 2085–2100 | Ancient/Modern with only the broadcast tower left | f10441 |
| 2100–2118 | **C4D**: the InterBrain lattice tilted in 3D, a blue mesh above it | f10531 |
| 2118–2130 | Vortex → hexagon → **C4D** red ball / blue cube → a glass cylinder (circle + square) | f10606, f10681, f10696 |
| 2130–2135 | **C4D** cylinder with broadcast rings | f10711 |
| 2135–2178 | **DreamNode import**: InterBrain + DreamTalk + liminal-eyes nodes are imported into a higher-order node (blue enclosing circles, tangent lines) — recursively | f10756, f10831, f10861 |
| 2178–2195 | **DreamSong**: a node holding symbols and text lines; DreamTalk ↔ DreamSong | f10906, f10921 |
| 2190–2200 | **DreamWeaving**: an S-arc from DreamTalk up to DreamSong | f10951 |
| 2196–2203 | **DreamTalk** of a DreamSong = the Logo (Λ in two circles) — compressing a song into one symbol | f10981 |
| 2205–2212 | The emergent **holarchy**: nodes radiating from a central DreamTalk | f11026 |
| 2213–2222 | DreamWeaving ── broadcast tower (coupling) | f11071 |
| 2223–2265 | **Resonance through the liminal web**: a node's adjacent tribes (red rings) light; cyan ripples spread | f11131, f11161, f11221 |
| 2256–2265 | **Circle × Square = Cylinder** inside a DreamNode (the dialectic resolved as a song) | f11281, f11311 |
| 2265–2280 | Cylinder node in the dim lattice → its tribe resonates → a flower-of-life of cylinders | f11341, f11371 |
| 2280–2285 | Circle + square = (a red square): the incoherent sum fades | f11401 |
| 2288–2300 | **Coherence Beacon**: a node bursting with cyan rays, broadcast rings, a red (incoherent) node below that fails | f11446, f11491 |
| 2300–2312 | freedom of speech × [beacon] → order | f11566 |
| 2315–2355 | Red field → oscillation → ball enters the cylinder → cyan starburst → **hyperspace tunnel** of DreamNodes and cylinders (**C4D**) | f11611, f11716 |
| 2357–2380 | Healed lens: radiant Earth (DreamTalk) → flower-of-life prism → clean rainbow → eye; vortex → hexagon → red disk | f11791, f11806, f11851 |
| 2380–2400 | **InterBrain sphere** (red geodesic flower-of-life sphere studded with app icons); boxed heads ring it, are attacked by red swarms, are transmuted (S-marks appear) | f11896, f11971, f12016 |
| 2400–2430 | Sphere shrinks/grows; boxes → S-marks; cyan field | f12076, f12121, f12151 |
| 2430–2442 | The hands holding the sphere → **Escher-like drawing hands** drawing the red flower-of-life sphere | f12166, f12211 |

### Ch 8 — A New Beginning (2446–2835)

| t | Beat | Key frame |
|---|---|---|
| 2455–2470 | InterBrain sphere → "Ending Narrative Warfare" | f12301 |
| 2470–2480 | Vault → second brain → InterBrain icon → sphere (paradigm shift) | f12346, f12376 |
| 2480–2500 | Ladder of leverage; the healing trickles down: blue noosphere → red, social sphere → red, Earth radiant | f12451, f12496 |
| 2505–2520 | **Applications** around the sphere: Podcasting, Investigative Journalism, P2P Education, Community Engine, Decentralised Industry, Open Science, Content Creation | f12586 |
| 2520–2535 | The War Machine overlays and collapses; the domesticated eye; its iris cube dissolves into red particles | f12631, f12661 |
| 2538–2552 | **Liminal eye** (S-mark iris) with cyan ray burst; dissolves into the red flower-of-life disk → InterBrain sphere | f12691, f12721, f12781 |
| 2562–2570 | Pyramid flashes; sphere | f12826, f12856 |
| 2570–2595 | Blue triangle grid → cyan burst → red flower-of-life field (the medium changes); liminal eye in the field | f12871, f12931, f12961 |
| 2595–2630 | **War machine → hyper-agent of love**: the pyramid's eye becomes the liminal eye; the triangles become circles; a flower-of-life of minds around the liminal eye | f13006, f13051, f13111 |
| 2625–2640 | Hyperspace tunnel → InterBrain sphere close-up → full sphere | f13141, f13201, f13231 |
| 2640–2651 | The sphere → radiant Earth (DreamTalk) | f13276 |
| 2664–2820 | **Live footage**: David sitting under a tree (talking head); 2672–2700 a picture-in-picture circle shows a DreamGarden / liminal web | f13336, f13591 |
| 2820–2835 | **Logo** draws in (blue ring, red circle, Λ), "Project Liminality" | f14131 |

## 3. Production technique per segment

| Technique | Where | Reproduction stance |
|---|---|---|
| **Keynote line-art + Magic Move** (the bulk) | every chapter | the framework's home ground: strokes + `Slides`-style builds/transitions; symbols re-made as holons |
| **Keynote built-in icons** (Head with Shoulders bust, Fire, Radio Tower, Book, weapons, buildings, religious marks, film/music/game, phone/laptop) | ch1–ch7 | the same icon library PL02's deck carries as bezier paths (`refs/pitch/pl02/key`, `vocabulary/Slides/assets/pl02/*`); lift each needed icon ONCE into a holon instead of per-slide |
| **Particle field** (red streaks radiating from a point; turns cyan; cyan "ray burst" around a symbol; red "infection swarm") | ch1, ch2 start, ch3, ch4, ch7, ch8 | T3: one stateful holon (see §4 `Field`), not per scene |
| **Resonance ripples** (dashed cyan rings travelling round a group) | ch4, ch6, ch7 | one ability, applied to any group |
| **C4D renders** (glass cylinder, red ball / blue ice cube, shaded app icons, 3D holarchy, hyperspace tunnel, InterBrain sphere close-up) | ch5–ch8 | reproduce the symbolic layer only (TASTE: no photoreal); the tunnel and sphere are geometry the framework can draw as strokes |
| **SVG sketches** (hands holding a frame; Escher-like drawing hands; David's and others' portrait line-drawings) | ch3, ch4, ch6, ch7 | `Sketch` assets (svg import), if the SVGs are found; otherwise to be traced |
| **External footage / brand marks** (news-anchor collage 16:06; a third-party PKM app logo ch5–ch8; live talking head 44:25–47:00) | ch3, ch5–ch8 | out of scope (T5 / not ours to redraw); the app icon needs David's call (§6) |
| **Text** | title cards (serif), labels (serif italic for freedom/order/Chaos/Oppression, plain serif elsewhere) | `Text`/`Write`; title cards are a chapter transition |

## 4. THE CONCEPT ↔ SYMBOL ONTOLOGY

Definitions are short paraphrases of the narration (timestamp = where it is
said). "Uses" lists chapters. **Status**: EXISTS (path) / ALIAS (exists under
another name — same symbol, import it) / POP-OUT (exists but buried in a demo
or another holon — promote it) / NEW.

### 4.1 The pathology (chapters 1–3)

| Concept | Symbol in the frames | Definition (narration) | Uses | Status |
|---|---|---|---|---|
| **Fragmentation** | the red streak particle field; red spiral field lines; shattered/boxed things | "the human family … divided against itself" (0:20); the primal distortion: reality as separate parts in boxes (13:03) | 1,2,3,4,5,7,8 | NEW → `Field` (state red) |
| **Wholeness** | the cyan particle field / cyan ray burst; the red flower-of-life disk | "the natural state of unity in which the paradox is resolved" (5:00) | 1,5,7,8 | NEW → `Field` (state cyan) |
| **Conflict** | the white lightning bolt ⚡ (between two things; radiating from a pathology) | conflict lines; "using conflict itself as a weapon" (8:52) | all | POP-OUT: the bolt glyph is traced in `demo/web3/YinYang.ts` (`lightning`, l. 256) and redrawn in `demo/pl02/SetPieces.ts`/`Arc01.ts` — one `Conflict` holon, retire the copies |
| **Freedom / Order** (the dialectic) | red circle labelled *freedom* / blue square labelled *order* | two equally essential values that conflict under fragmentation (0:56) | 1,3,4,7 | EXISTS as parts: Circle/Square of the founding holon (`holons/Circle`, `holons/Square`); the labelled pair is a composition |
| **Chaos / Oppression** (the two pathological attractors) | red circle radiating bolts "Chaos"; blue square radiating bolts "Oppression" | freedom × fragmentation = chaos; order × fragmentation = oppression (1:57) | 1,3 | NEW → `Attractor` (kind chaos / oppression) composing Circle/Square + `Conflict` |
| **The endless oscillation** | a glowing ball shuttling between circle and square, a sine trace | "an endless cycle of continually oscillating between these two pathological attractors" (2:21) | 1,2,3,4,7 | NEW (small): chapter-level animation over `Attractor`s; the ball is a glow dot |
| **Exponential technology / the arms race** | exponential curve on axes with weapon icons climbing it | technology amplifies conflict on an exponential curve "about to go vertical" (3:06) | 1,2 | EXISTS: `vocabulary/Plot` + weapon icons |
| **The third attractor** | the vertical axis rising from the oscillation to a **cylinder** under the liminal eye; later the red flower-of-life disk | an orthogonal degree of freedom from fragmentation to wholeness (4:29); the false dichotomy dissolves | 1,5,7,8 | ALIAS: `vocabulary/Cylinder` (circle + square → cylinder IS the founding parable); the disk is `Noosphere` (whole) |
| **Domesticated eye** (the captured gaze; "spirit of fragmentation" at the apex) | almond eye, circle iris with a blue perspective cube | the primal distortion that all captured minds share; the spirit above the apex (13:38) | 1,3,8 | ALIAS: `vocabulary/MolochEye` — same construction |
| **Liminal eye** | the same eye with the red S-mark in the iris | the healed perception (ch5, ch8) | 1,5,8 | NEW ability of `MolochEye` (`iris: cube | vision`) — or a sibling; David to name (§6) |
| **Narrative** (manipulative, engineered) | a blue perspective cube (in a blue ring when standalone) | "a mechanical narrative constructed for the purpose of manipulation" (18:47) | 1,3,4,5,8 | ALIAS: the cube is `FoldableCube` at fold 1 seen from the front (the MolochEye iris); `MindVirus` is literally "a manipulative narrative" |
| **Vision** (organic, inspired) | the red S-mark (S of two semicircles, a dot, a square) in a red ring | "an organic vision that reveals itself through inspiration" (18:54) | 4,5,6,7,8 | POP-OUT: `vocabulary/Regenaissance/SMark.ts` — the mark's real name is now known: it is **Vision** |
| **Mind** — domesticated / liminal | a head-and-shoulders bust: with a cube over its head in a blue triangle (domesticated) / with the S-mark in its head in a red circle (liminal) | captured minds vs agents of wholeness (13:03, 23:27) | 2,3,4,5,6,8 | NEW → `Mind` (state param), composing the person + Narrative/Vision; see §6 on Figure vs bust. Ancestor: David's 2024 DreamNode **`DomesticatedMind`** (bust + `FoldableCube`, §8b) — the domesticated state should carry that name |
| **Asymmetry in agency** (war as engineering) | two minds ⚡, one swells with weapon icons, the other shrinks | warfare maximises the asymmetry in agency (6:06) | 2 | composition (Mind + Conflict + icons) |
| **Biosphere / Social Sphere / Noosphere** | Earth / circle of tiny figures / geodesic lattice sphere | infrastructure, social structure, superstructure — the three realms of engineering (7:00–7:30) | 2,3,4,8 | Biosphere = `vocabulary/Earth`; Social Sphere NEW (small); Noosphere NEW → `Noosphere` (see states) — near `Regenaissance`'s lattice globe |
| **Order of influence / Ladder of leverage** | the three spheres stacked; red arrow down, blue arrow up | stories → social structures → infrastructure; leverage grows upward (7:53–8:14) | 2,4,8 | composition (`Spheres` + labelled arrows) |
| **The War Machine** | eye-in-triangle (small); the full pyramid: domesticated eye at the apex, marionette fists, minds in triangles, bolts, "Power" arrows | "a collective hyper-agent rooted in fear and in service to war" (14:06); it climbs the ladder (8:20) | 2,3,4,8 | NEW → `HyperAgent` (mode war); recursion = divide and conquer. Its unit, the mind-in-a-triangle, is David's 2024 **`MolochConsciousness`** (§8b) |
| **Divide and conquer** | triangles of minds ⚡, recursively nested; puppeteer fists at the corners | "the divided and conquered divide and conquer" (12:43) | 2,3 | inside `HyperAgent` (depth param) |
| **Puppeteer** (manipulation) | a marionette control held by a fist, strings down | manipulation "requiring neither awareness nor consent" (11:44) | 3,5 | NEW (small) `Puppeteer` |
| **Generations of warfare** | Breadth × Depth axes, diagonal icon bands, "Narrative Warfare" | fifth-generation, psychological/narrative warfare (9:21) | 2 | composition (`Axes` + icons) |
| **Psy-war** | Earth + bomb → mushroom cloud vs noosphere + phone/laptop → fragmented cycle | the Psi-war equivalent of a nuke, untraceable (9:51) | 2 | composition |
| **Worldview** (the lens) | Earth → beam → prism (triangle) → rainbow → eye | a condensed representation of reality we can navigate; we look through it, never at it (11:03–11:39) | 3,5,7 | NEW → `Worldview` (params: lens content, distortion, strings, direction) — NOT the existing `Lens` holon (a magnifier; different symbol, same word) |
| **Manipulated lens** | the prism with a cube inside, a smeared rainbow, puppet fists, "?" | engineering distortions into the lens (11:44) | 3,5,7 | `Worldview` (distortion > 0) |
| **The vicious cycle** | two minds ⚡ in a ring of boxed heads, red spiral field lines, turning | weaponising the noosphere burns the collective sanity (15:12) | 2,3,8 | composition (Mind + Conflict + spiral) |
| **The fragmented Earth** | Earth in a blue flower-of-life ring with bolts and red spiral field lines | the planet under narrative warfare | 1,3,5 | POP-OUT: it is the Web3 `YinYang` LEFT-lobe node (`demo/web3/YinYang.ts` "blue node") — same symbol |
| **Censorship** | blue square "censorship" ⚡ Chaos | "controlling the narrative through censorship" (15:55) | 3,8 | Attractor composition |
| **Boxed tribes / the boxed web** (modern media) | people in blue cubes; a blue hex network of cube-headed busts | contemporary media tuned to amplify narrative engineering (17:47) | 1,3,4,6,7 | NEW → `Tribe` (mode modern) |

### 4.2 The medicine (chapters 4–5)

| Concept | Symbol | Definition | Uses | Status |
|---|---|---|---|---|
| **Engineering │ Gardening** | an S-curve splitting a blue square grid (ziggurat built top-down) from a red flower-of-life field (a seed grows a tree) | gardening plants seeds and nurtures soil; the garden emerges by itself (18:27) | 4 | POP-OUT: the S-split is the Web3 `YinYang` (as a divide) + `geometry/flower.ts` |
| **Narrative engineering → Vision gardening** | blue flower-of-life sphere → red ringlet sphere | the antithesis of narrative engineering (19:02) | 4,7,8 | `Noosphere` states |
| **SandTalk** | two heads and a campfire inside a red ellipse; a symbol drawn in the sand | the aboriginal practice of drawing symbols in the sand while talking (19:47) | 4,6 | NEW → `SandTalk` (Fire + heads + ellipse + sand symbol slot) |
| **Seed / Soil** | the sand symbol / the circle of conversation | symbols are the seeds, conversation is the soil (19:55) | 4 | `SandTalk` labels |
| **The Tribe** (ancient) | red hexagon of seven minds in circles, campfires on the edges | Dunbar-scale communities where freedom of speech yields emergent order (20:14–21:00) | 4,6,7 | NEW → `Tribe` (mode ancient), recursive (tribes of tribes) |
| **Resonance** | dashed cyan rings travelling round a group | inspiring visions travel faster and further (20:19); resonance measures coherence (37:14) | 4,6,7 | NEW ability `Resonance` (any group) |
| **Written word / Broadcast** | Book; Radio Tower; Ancient → Book → Tower → Modern | the two innovations that changed the medium's physics (21:30) | 4,6,7 | icons (Keynote Book_381, Radio Tower_245 in PL02's deck) → holons |
| **Spirit vs Scale** | red tribe vs blue boxed web, S-arc | a synthesis of the modern with the ancient (23:01) | 4 | composition |
| **Third attractor medium (whole vs fragmented noosphere)** | red flower-of-life disk with bolts → hexagon → six blue triangles in a vortex | the shared worldview broken into partial truths (24:11) | 5,7 | `Noosphere` (whole / fragmented states) |
| **Partial truths** | red ball (freedom) and blue ice cube (order) in C4D, cube/S badges | break a nuanced topic into seemingly conflicting partial truths (24:15) | 5,7 | the circle/square pair again (symbolic layer only) |
| **Looking at the lens** | arrow reversed from eye to prism; scissors cut the strings | reclaim authorship of the worldview (25:07) | 5 | `Worldview` (direction) |
| **Digital twin / Second brain / PKM** | a third-party PKM app icon in a box; bust ⇅ icon | a knowledge base of meaningful stories as a mirror (25:36–26:01) | 5,6,8 | external brand mark — §6 |

### 4.3 The instrument (chapters 6–8)

| Concept | Symbol | Definition | Uses | Status |
|---|---|---|---|---|
| **InterBrain** | the PKM icon carrying the Logo's Λ, in overlapping red circles; later the red geodesic sphere of icons | "a collectively interconnected inter-brain in which we all participate as equals" (27:07) | 5–8 | NEW; icon = §6; sphere = `Noosphere` (InterBrain state) |
| **Vault (knowledge managed)** | hierarchy: Vault → Category boxes → documents | knowledge as written documents in a hierarchy of categories (27:24) | 6,8 | NEW (small) `Vault` |
| **DreamTalk** (digital SandTalk) | the radiant Earth in a red ring, red flower-of-life petals, twelve rays | "the digital extension of SandTalk" (29:08) | 6,7,8 | ALIAS: `vocabulary/LightNode` — the same symbol, built for Web3 shot 15 |
| **DreamNode** (git repo) | a DreamTalk inside a blue ring | the digital vehicle that holds the living, evolving knowledge (29:14–30:11) | 6,7,8 | NEW → `DreamNode` (wraps ANY symbol; `kind: dream | dreamer`) — the most-reused new holon |
| **Dream / Dreamer** | blue-ringed node / red-ringed portrait line-drawing | two complementary node types (30:44) | 6,7 | `DreamNode.kind`; portraits = `Sketch` assets |
| **DreamGarden** | a large red circle holding many DreamNodes, unstructured | DreamNodes stored without imposed structure (31:10) | 6,8 | NEW → `DreamGarden` |
| **Digital campfire** | two InterBrains, overlapping red ellipses, heads at a fire | video calls carry the campfire around the globe (32:51) | 6 | `SandTalk` (digital) composition |
| **Cross-pollination** | a node cloned from one garden into the other | invoking a DreamTalk clones its node into each other's garden (31:43) | 6 | animation over `DreamGarden` |
| **Liminal web** | a node at the centre, its dreamers/dreams orbiting | each dream connects to its dreamers and vice versa; "a story becomes a place" (32:01) | 6,7 | NEW → `LiminalWeb` |
| **SongLine** | a DreamNode with a column of campfire clips above it | the chain of provenance — every transmitting conversation clipped (33:21) | 6 | NEW → `SongLine` |
| **DreamSong** | a DreamNode containing symbols and text lines | DreamTalk symbols woven into a larger story (36:14) | 7 | NEW → `DreamSong` (visual: node with content) — the framework's own term |
| **DreamWeaving** | an S-arc from DreamTalk up to DreamSong | integrating many DreamTalk symbols into one DreamSong; compress back into one symbol (36:22) | 7 | composition (S-arc = `YinYang` divide, see above) |
| **Holarchy (import)** | nodes inside enclosing blue circles with tangent lines | importing DreamNodes into a higher-order node; sovereign, like software modules (35:43) | 7 | NEW → ability of `DreamNode` (`parts`) |
| **Circle × Square = Cylinder** | inside a DreamNode | the resolved dialectic as a DreamSong — signal interferes constructively, noise destructively (35:28) | 7 | EXISTS: `holons/Circle`, `holons/Square`, `holons/Cylinder` — the founding holon |
| **Coherence Beacon** | a node bursting cyan rays with broadcast rings; an incoherent node fades | reach coupled to coherence (38:14) | 7 | NEW → `CoherenceBeacon`; the term is already in PL02's deck text corpus |
| **Hyperspace of DreamNodes** | tunnel of DreamNodes and cylinders in cyan streaks (C4D) | (visual — breaking the spell) | 7,8 | composition (`Field` + DreamNode + Cylinder) |
| **InterBrain sphere** (collective knowledge garden) | red geodesic flower-of-life sphere studded with app icons | "a collective knowledge garden" (39:27); transmutes narratives into visions | 7,8 | `Noosphere` (InterBrain state) |
| **Applications** | labels around the sphere | podcasting, journalism, education, community, industry, science, content (41:40) | 8 | composition |
| **Hyper-agent grounded in love** | flower-of-life circles of minds around the liminal eye (the pyramid morphed) | "a collective hyper-agent grounded in love … that knows no enemies" (42:30) | 8 | `HyperAgent` (mode love) — same holon as the War Machine, one param |
| **Drawing hands** (self-authorship) | two hands drawing each other drawing the sphere | (visual) | 7 | `Sketch` asset |
| **Project Liminality** | the Logo | — | 7,8 | EXISTS: `vocabulary/Logo` |

## 5. Same symbol, other name (deduplication summary)

| In this video | Already in the framework | Action |
|---|---|---|
| domesticated eye / spirit of fragmentation | `vocabulary/MolochEye` | import; add `iris` ability for the liminal eye |
| Vision (S-mark) | `vocabulary/Regenaissance/SMark.ts` | pop out to `vocabulary/Vision`, Regenaissance imports it |
| DreamTalk / Digital SandTalk | `vocabulary/LightNode` | import (alias the name in the bar, or rename — §6) |
| Narrative (blue cube) | `FoldableCube` (fold 1), the MolochEye iris | import; no new cube |
| manipulative narrative creature | `vocabulary/MindVirus` | available for "mind viruses go viral" (22:43) |
| the fragmented Earth | `demo/web3/YinYang.ts` blue-lobe node | pop out (`FragmentedEarth`, or a `state` of LightNode's sibling) |
| S-split (engineering│gardening, spirit│scale, dreamweaving) | `demo/web3/YinYang.ts` S-curve | pop out the divide as an ability/holon |
| lightning bolt | `demo/web3/YinYang.ts`, `demo/pl02/*` | pop out `Conflict`; retire both copies |
| third axis / circle × square = cylinder | `vocabulary/Cylinder`, `holons/{Circle,Square,Cylinder}` | import |
| arms-race curve | `vocabulary/Plot` | import |
| Earth (biosphere, worldview source) | `vocabulary/Earth` | import |
| geodesic noosphere | `vocabulary/Regenaissance` lattice globe (15 great circles) | `Noosphere` should own the lattice; Regenaissance imports it |
| flower-of-life fields and fills | `src/geometry/flower.ts`, `demo/web3/ClarityField.ts` | reuse the packing |
| Logo | `vocabulary/Logo` | import |
| portraits, hands | `vocabulary/Sketch` (svg) | assets |
| Keynote icons (bust, fire, tower, book, weapons…) | per-slide paths in `vocabulary/Slides/assets/pl02/*` | lift each into one icon holon (or an `Icon` asset table) — used by both films |
| person | `vocabulary/Figure` ("THE person") | the bust is a different drawing — decision needed (§6) |

## 6. Questions for David (decisions, not guesses)

1. **The bust vs Figure.** Every person in this film is the Keynote "Head
   with Shoulders" bust; `Figure` is the whole-body person and the rule is one
   person symbol. Options: a `bust` form of Figure (head + shoulders arch,
   no legs), or let the film's people be Figure as they are.
2. **The liminal eye.** One eye with an `iris` param (cube → vision), or two
   symbols (MolochEye stays the captured gaze, a new `LiminalEye`)? The film
   morphs one into the other (2520–2552), which argues for one holon.
3. **Names.** SMark → `Vision`? LightNode ↔ DreamTalk (rename, or keep the
   holon name and show "DreamTalk" in this song)?
4. **The PKM app icon.** The second brain and the InterBrain icon are a
   third-party app's brand mark (with the Λ added). Redraw our own
   InterBrain face, use a neutral placeholder, or keep the icon as an image
   asset?
5. **Out of scope by default**: the news-anchor collage (16:06), the live
   talking head (44:25–47:00) and photoreal C4D looks — reproduced as their
   symbolic layer only. Agree?

## 7. Proposed holon list and build order (most-reused first)

Counted by how many chapters each appears in (§4). Every new holon lands in
`core/vocabulary/<Name>/` with `<Name>.ts`, `README.md`, a face PNG, a
standalone `?scene=` demo and a test (the existing convention).

| Wave | Holon | Kind | Chapters | Composes |
|---|---|---|---|---|
| A | `Conflict` (pop-out) | pure | 8 | — (retires YinYang/pl02 copies) |
| A | `Vision` (pop-out of SMark) | pure | 5 | — |
| A | `MolochEye` + `iris` ability | pure | 3 (+liminal 3) | Vision, cube |
| A | `Mind` (domesticated = `DomesticatedMind`, liminal) + `MolochConsciousness` (mind in triangle) | pure | 6 | person (bust/Figure), FoldableCube, Vision |
| A | `DreamNode` | pure | 3 (most beats of 6–8) | any symbol; LightNode as default face |
| A | `Field` (particles: red fragmentation ↔ cyan wholeness, burst, swarm) | stateful | 7 | — |
| B | `Noosphere` (lattice / narrative-engineered / vision-gardened / whole disk / fragmented vortex / InterBrain sphere) | pure | 6 | flower.ts, Conflict |
| B | `Worldview` (Earth → prism → rainbow → eye; distortion, strings, direction) | pure | 3 | Earth, Eye, Puppeteer |
| B | `Tribe` (ancient hex / modern boxed web; recursive) | symbolic | 5 | Mind, Fire |
| B | `HyperAgent` (war pyramid ↔ love flower; depth) | symbolic | 4 | Mind, MolochEye, Conflict, Puppeteer |
| B | `Attractor` (chaos / oppression) | pure | 2 | Circle/Square, Conflict |
| B | `Resonance` (ability: ripples round a group) | pure | 3 | — |
| C | `SandTalk` (+ digital) | pure | 2 | Mind/bust, Fire |
| C | `DreamGarden`, `LiminalWeb`, `SongLine`, `DreamSong`, `CoherenceBeacon` | symbolic | 6–8 | DreamNode, Resonance, RadioTower |
| C | icons: `Fire`, `RadioTower`, `Book`, weapons, buildings (from PL02's deck paths) | pure | 2–7 | — |
| C | `Puppeteer`, `Vault`, `Spheres` (+ Social Sphere) | pure | 2–3 | Earth, Noosphere |
| C | pop-outs: `FragmentedEarth` and the S-divide from `demo/web3/YinYang.ts` | pure | 3–4 | Earth, Conflict |

## 8. Per-chapter composition plan

A DreamSong `InterBrainSong.ts` (song time T = video time, like Web3Song)
with eight chapter scenes under `core/demo/interbrain/`, each importing only
vocabulary holons; title cards and the music bridges are the transitions.

| Chapter scene | Imports |
|---|---|
| `Ch1ThirdAttractor` | MolochEye(+iris), FragmentedEarth, Tribe(modern, cages), Circle/Square, Conflict, Attractor, Plot+icons, Field, Cylinder, Vision |
| `Ch2ArmsRace` | Field, Attractor, Plot, Mind, Conflict, icons, Earth, Spheres/Noosphere, Worldview(prism), HyperAgent(small), Axes |
| `Ch3ViciousCycle` | Earth, Worldview, Noosphere, Puppeteer, Mind, Conflict, HyperAgent(war), MolochEye, Sketch(hands), Attractor |
| `Ch4GoingUpstream` | HyperAgent, Noosphere, Tribe(modern + ancient), S-divide, Vision, SandTalk, Resonance, Book, RadioTower, Field |
| `Ch5FixingTheLens` | MolochEye(iris), Mind, Worldview, Noosphere(whole/fragmented), Cylinder, Conflict, Vault/second-brain(§6) |
| `Ch6IntroducingInterBrain` | Mind, SandTalk, LightNode(DreamTalk), DreamNode, Sketch(portraits), DreamGarden, LiminalWeb, Earth, SongLine, Resonance, Tribe |
| `Ch7BreakingTheSpell` | DreamNode(imports), DreamSong, S-divide(weaving), Logo, RadioTower, Resonance, Circle/Square/Cylinder, CoherenceBeacon, Field, Worldview, Noosphere |
| `Ch8NewBeginning` | Noosphere(InterBrain), Vault, Spheres, HyperAgent(war → love), MolochEye(iris), Field, LightNode, Logo |

## 8b. Source recovery (read-only; nothing moved)

The production deck itself was not found (as David said). But the film's
**ancestor DreamNodes survive**, and they settle names and constructions:

- **A local collection of 2023–2024 DreamTalk DreamNodes** (≈45 nodes; each a
  git repo with `.key`, pydeation `.py`, sometimes `.c4d`, renders) — the
  same Nov-2024 symbol batch CORPUS.md lists on GitHub. The ones this film
  draws from:
  - **`DomesticatedMind`** (2024-05-19): `class DomesticatedMind` =
    `FoldableCube(color=BLUE, bottom=False)` + `Human` head;
    `DomesticatedMind3D` = the cube + **`HeadWithShoulders`** (a USDZ bust,
    its own sub-DreamNode). Face: a bust inside a blue perspective cube.
    → David's own name for the domesticated mind, and proof that the cube is
    `FoldableCube` and that the bust was a sovereign symbol.
  - **`MolochConsciousness`** (2024-05-19, `.py` + `.c4d` + `.key`):
    `DomesticatedMind3D` + a blue `Triangle`, with a `TiltTriangle`
    parameter. → David's name for the **mind-in-a-triangle**, the unit the
    War Machine pyramid is built of.
  - **`ThirdAttractor`** (2024-05-30): face = Chaos (red circle radiating
    bolts), Oppression (blue square radiating bolts), and a cylinder labelled
    "Third Attractor" ringed by yellow stars — the ch1 argument in one image.
    Its `.py` is a Manim `StreamLines` electric-field sketch (three charges),
    not the film's particle field.
  - **`SocialPolarization`** (2024-02-23): two pyramids of busts (red / blue)
    with a bolt — the conflict-between-tribes image.
  - **`OrderChaosAxes`**, **`MolochSpreading`**, **`MindVirusOutbreak`**,
    **`MolochAndMiracleField`** (a C4D red/blue field on a hex grid — a
    relative of the film's field, not the same render), **`TheLabyrinth`**
    (already reproduced as `vocabulary/Labyrinth`).
- **Small Keynote decks from the production window** (not the film's deck):
  `DreamWeaving.key` (iCloud Unclutter, 2025-03-11/13, 10 slides, 2.3 MB),
  `ThirdAttractor.key` (2025-04-06, 5 slides + an embedded
  `ThirdAttractor.mp4`), `MolochConsciousness.key` (2025-05-04),
  `PreFigurativeSociety.key` (2025-04-22), `LiminalObsidian.key`
  (2025-03-16). Worth decoding with `keynote-parser` when the matching
  chapters are built — they may hold the Keynote geometry of individual
  set-pieces.
- The **iCloud Obsidian "InterBrain" vault** that `DomesticatedMind.py`
  points at is emptied (three folders; only `TheMachine/TheMachine.mp4`,
  2024-11-16, remains — likely the War Machine render).

The parallel source sweep (GitHub InterfaceGuy/ProjectLiminality, Time
Machine snapshots, Trash, ~/Movies) is reported in the amendment below.

## 9. Artifacts

| Path | What |
|---|---|
| `refs/interbrain/IB14_InterBrain.mkv` (+ `.info.json`, `.description`) | the video, 1080p |
| `refs/interbrain/frames5/` | 5 fps ground truth, 14,174 frames |
| `refs/interbrain/transcript/` | whisper large-v3-turbo transcript, all formats |
| `refs/interbrain/analysis/scan.json` | per-frame luminance/ink/saturation/motion |
| `refs/interbrain/sheets/` | 3 s contact sheets (whole film) |
| `docs/reports/interbrain/concept-atlas.jpg` | 60 labelled concept frames |
| `docs/reports/interbrain/ch{1..8}-sheet.jpg` | per-chapter sheets |

URL: https://www.youtube.com/watch?v=v5dBRmjF8mc

## Amendment — the source sweep (2026-10-18)

Read-only sweep of Spotlight, iCloud, Keynote containers, Time Machine,
Trash, GitHub and ~/Movies. The production folder (`~/ProjectLiminality/TheInterBrain/`)
is gone and no copy turned up, but three things survive that change the
method for the build phase:

1. **The Final Cut edit survives.** `~/Movies/ProjectLiminality.fcpbundle/InterBrain/`
   (490 MB, ≈45 projects incl. the main "InterBrain" timeline,
   InSearchOfTheThirdAttractor, Teaser, CrowdfundingMonologue, DreamWeaving,
   ChaosOrderSynthesis). Timelines and edit decisions are intact; 159 of 167
   linked media are offline (they lived in the deleted folder). The offline
   clip NAMES are themselves a map of the production: `Chapters/` held 44
   `.m4v` Keynote exports — IntroducingTheInterBrain(1–5),
   TheViciousCycle(1–4), TheAncientArmsRace(1–2), GoingUpstream(1–8),
   FixingTheLens(1–4), BreakingTheSpell(1–5),
   InSearchOfTheThirdAttractor(1–7), ANewBeginning(1–2) — and
   `Recordings/Narration/` held 73 `.m4a` takes named after their opening
   words (e.g. `the_spellof_fragmentation`, `a_collective_hyperagent`). So
   the timeline gives the **exact clip boundaries** (sub-chapter segments,
   narration placement) that §0 measured from the pixels — a stronger
   timing source, readable without the media. Only low-res thumbnail media
   (`Render Files/Thumbnail Media`, 429 MB) remain of the lost clips.
   Confirms the technique reading: the chapters were Keynote exports
   assembled in Final Cut (with Pink Floyd's "Welcome To The Machine" and the
   3Blue1Brown score in the music bin).
2. **Chapter 1 survives as a master**: `DreamTalkVocabulary/InSearchOfTheThirdAttractor/InSearchOfTheThirdAttractor.mov`
   (1080p H.264, 346 s, 2025-05-30) — corpus #15, confirmed as the
   chapter-1 cut.
3. **April-2025 screen recordings and voice memos** (iCloud Unclutter):
   DreamWeaving.mov, LinkIdeasToPeople.mov, DragAndDrop.mov, … (the
   prototype being shown), InterBrainConcept.m4a (2025-03-24), and
   `InterBrain.png` / `InterBrainLogo300.png` (2025-04-06) — the InterBrain
   app face as it was then (relevant to §6 question 4).

Also from 2025, possibly feeding chapters: `DreamTalkVocabulary/Noosphere/NoosphereProjection.c4d`
(2025-04-28 — the Noosphere sphere), `DreamTalkVocabulary/FlowerOfLife/FlowerOfLifeSphere/`
(C4D + renders — the flower-of-life sphere), `CRI/ThirdAttractor/ThirdAttractor.key`
(also on GitHub as `InterfaceGuy/ThirdAttractor`), MolochConsciousness.key
(05-04), DreamWeaving.key (03-11). Nothing found in Time Machine (none
configured, no local snapshots), Trash, Keynote autosave, Desktop/Documents/
Downloads, or GitHub (`ProjectLiminality/InterBrain` postdates the video).
Not checked: iCloud "Recently Deleted" (30-day window, icloud.com only) and
external drives — David's call.

**Next step this unlocks**: parse the Final Cut project (its database is
SQLite/protobuf inside the bundle; read-only, via a copy into refs/) for
the segment table — clip names, in/out points, narration offsets — before
the chapter compositions are timed.
