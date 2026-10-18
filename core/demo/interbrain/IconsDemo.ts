/**
 * IconsDemo.ts — the contact sheet of every icon the InterBrain film uses as
 * a prop (vocabulary/Icons, an invisible asset), with the two that carry a
 * concept and so became holons of their own — RadioTower (broadcast) and
 * Book (the written word) — and the composed entries (the War Machine's eye
 * in its triangle, the bust). Each cell is named under its icon.
 *
 * Also the two concept icons standing alone: `ib-radiotower` (the mast,
 * then the signal going out, ring by ring) and `ib-book` (f6526's open book
 * at the film's size).
 */

import { Dream, render } from "../../src/index"
import { Create } from "../../src/verbs"
import { Group } from "../../src/parts/primitives"
import { Text } from "../../src/parts/text"
import { WHITE, rgb } from "../../src/constants"
import { ICON_NAMES, icon } from "../../vocabulary/Icons/Icons"
import { RadioTower } from "../../vocabulary/RadioTower/RadioTower"
import { Book } from "../../vocabulary/Book/Book"

const PX = 720 / 1500
const COLS = 8
const CELL_X = 150 / PX
const CELL_Y = 128 / PX
const ICON = 64 / PX

const cell = (i: number) => {
  const rows = Math.ceil(ICON_NAMES.length / COLS)
  return { x: ((i % COLS) - (COLS - 1) / 2) * CELL_X, y: (((rows - 1) / 2) - Math.floor(i / COLS)) * CELL_Y + 10 / PX }
}

export class IconsDemoDream extends Dream {
  sheet = new Group({
    members: ICON_NAMES.map((name, i) => icon(name, { size: ICON, ...cell(i) })),
  })
  names = new Group({
    members: ICON_NAMES.map((name, i) => new Text({ content: name, size: 13 / PX, x: cell(i).x, y: cell(i).y - 52 / PX, tint: rgb(0xa9, 0xa9, 0xa9) })),
  })

  unfold() {
    this.play(Create(this.sheet), 3)
    this.play(Create(this.names), 1)
    this.wait(3)
  }
}

export class RadioTowerDemoDream extends Dream {
  tower = new RadioTower({ size: 300 / PX, broadcast: 0 })

  unfold() {
    this.play(Create(this.tower), 2)
    this.play(this.tower.broadcast.to(1), 1.5)
    this.wait(1)
    this.play(this.tower.broadcast.to(0), 0.8)
    this.play(this.tower.broadcast.to(1), 1.2)
    this.wait(1.5)
  }
}

export class BookDemoDream extends Dream {
  /** f6526: the book alone, 81 px tall, its centre at (587, 387.5) px. */
  book = new Book({ size: 81 / PX, x: (587 - 640) / PX, y: (360 - 387.5) / PX, tint: WHITE })

  unfold() {
    this.play(Create(this.book), 2)
    this.wait(2)
  }
}

if (import.meta.main) render(IconsDemoDream)
