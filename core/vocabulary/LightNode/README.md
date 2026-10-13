# LightNode

![LightNode](LightNode.png)

The Web3 video's decentralised node: the Earth inside a white bloom, a red
flower of life, a bold red ring and twelve rays of light. It is the hero of
shot 15, the red lobe of the yin-yang (shots 2–3), and the hero panel of
GlobeDemo. One symbol, so one holon. Before this it was drawn three times,
each copy with its own drifted constants.

**Faces**: `?scene=web3s15` (the face above is t≈8).

## Params

`radius` is the red ring's radius, and every part follows it live, so one
param swells or shrinks the whole node. `globe` is the Earth's share of the
ring (the hero measured 83/198, the lobe 0.415). The Earth turns on `spin`
and leans on `tilt`, and its land floods in on `landOpacity`. Each layer
has one presence: `bloomOpacity`, `latticeOpacity`, `rayOpacity` and
`ringOpacity`. Their tints and strokes are promoted. The bloom's shape is
set by `bloomRings`, `bloomSpread`, `bloomStrength` and `bloomFalloff`.

The Earth is set on the page (`src/parts/recede.ts`), so the bloom and
lattice pass behind its black sea and the ring lies over it. A scene whose
camera is not the default calls `node.seenFrom(this.observer)`.
