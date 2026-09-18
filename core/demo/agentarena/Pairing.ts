/**
 * Pairing — one blue arena and its one red agent, at a given scale.
 *
 * This is the board's central claim made into a holon. David drew three
 * examples, one above the other, and then ran a single arrow down all
 * three labelled "one continuous pattern":
 *
 *   text  (blue)  ←→  cursor  (red)      a field of letters, and a caret
 *   GUI   (blue)  ←→  mouse   (red)      a window of icons, and a pointer
 *   game  (blue)  ←→  avatar  (red)      a world, and the body you have in it
 *
 * They are not three facts. They are ONE fact at three scales, and the
 * scene's job is to make that unmistakable — which is why they share a
 * class rather than being drawn three separate ways. The `kind` chooses
 * which container/inhabitant pair gets built; everything else about
 * them — colour, the label pair, the blue-then-red draw order — is the
 * same code for all three, because it is the same idea.
 *
 * The draw order is deliberate and shared: the CONTAINER draws first,
 * the INHABITANT second. The arena precedes the agent, in motion as
 * well as in the picture.
 */

import { Ellipse, Group, Line, Null, Rectangle, Square } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { BLUE, RED } from "../../src/constants"

export type PairingKind = "text" | "gui" | "game"

/** The label size shared by every pair, matching the scene's other nouns. */
const LABEL = 30

export class Pairing extends Null {
  /** Which of the board's three examples this is. */
  kind: PairingKind = "text"

  /** The blue side — the arena. */
  container!: Group
  /** The red side — the agent's extension into it. */
  inhabitant!: Group
  containerLabel!: Text
  inhabitantLabel!: Text

  protected override compose(): void {
    const { container, inhabitant, names } = build(this.kind)
    this.containerLabel = new Text({
      content: names[0],
      size: LABEL,
      tint: BLUE,
      x: -330,
      y: 70,
    })
    this.inhabitantLabel = new Text({
      content: names[1],
      size: LABEL,
      tint: RED,
      x: 250,
      y: 70,
    })
    this.container = this.add(container)
    this.inhabitant = this.add(inhabitant)
    this.add(this.containerLabel)
    this.add(this.inhabitantLabel)
  }
}

/**
 * The three drawings. Each returns a blue container, a red inhabitant,
 * and the two nouns the board writes above them.
 *
 * Kept as a pure function of `kind` so the pair's SHAPE is the only
 * thing that varies — the relation, the colours and the choreography
 * are stated once, in the class.
 */
const build = (
  kind: PairingKind,
): { container: Group; inhabitant: Group; names: [string, string] } => {
  if (kind === "text") {
    // A field of letters with a caret standing in it. The letters are
    // drawn as short strokes rather than set as Text: the board's
    // "abcd|efg" is a picture of text, not text itself, and glyphs here
    // would read as content instead of as container.
    const glyphs: Line[] = []
    for (let i = 0; i < 7; i++) {
      const x = -150 + i * 44
      // The caret's slot is left empty — that gap IS the selection.
      if (i === 3) continue
      glyphs.push(
        new Line({
          points: [{ x, y: -18, z: 0 }, { x, y: 18, z: 0 }],
          tint: BLUE,
          stroke: 5,
        }),
      )
    }
    const frame = new Rectangle({ width: 400, height: 90, tint: BLUE })
    const caret = new Line({
      points: [{ x: -18, y: -26, z: 0 }, { x: -18, y: 26, z: 0 }],
      tint: RED,
      stroke: 7,
    })
    return {
      container: new Group({ members: [frame, ...glyphs] }),
      inhabitant: new Group({ members: [caret] }),
      names: ["text", "cursor"],
    }
  }

  if (kind === "gui") {
    // A window of icons with a pointer on it.
    const win = new Rectangle({ width: 380, height: 210, tint: BLUE })
    const icons: Square[] = []
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        icons.push(
          new Square({
            size: 64,
            x: -90 + c * 150,
            y: 48 - r * 96,
            tint: BLUE,
          }),
        )
      }
    }
    // The mouse pointer: the familiar arrow, as two strokes.
    const pointer = new Line({
      points: [
        { x: 120, y: 60, z: 0 },
        { x: 120, y: -46, z: 0 },
        { x: 150, y: -18, z: 0 },
      ],
      tint: RED,
      stroke: 6,
    })
    return {
      container: new Group({ members: [win, ...icons] }),
      inhabitant: new Group({ members: [pointer] }),
      names: ["GUI", "mouse"],
    }
  }

  // game ←→ avatar: the world you enter, and the body you have in it.
  // The board draws this one as a figure, an arrow, and a marker — the
  // person on one side, the thing they become on the other.
  const world = new Rectangle({ width: 400, height: 150, tint: BLUE })
  const ground = new Line({
    points: [{ x: -170, y: -45, z: 0 }, { x: 170, y: -45, z: 0 }],
    tint: BLUE,
  })
  const crossing = new Line({
    points: [{ x: -60, y: 0, z: 0 }, { x: 60, y: 0, z: 0 }],
    tint: RED,
    arrowEnd: true,
  })
  const avatar = new Ellipse({ radiusX: 26, radiusY: 26, x: 120, filled: true, tint: RED })
  return {
    container: new Group({ members: [world, ground] }),
    inhabitant: new Group({ members: [crossing, avatar] }),
    names: ["game", "avatar"],
  }
}
