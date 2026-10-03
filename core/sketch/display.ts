/**
 * display.ts — the display list in transit (protocol.ts: DisplayOp), pure.
 *
 * Three holders of the same list, one module:
 *
 *   - the PAGE diffs what it shows against what it last sent (DisplayDiff)
 *     and sends only the change, as one JSON array per batch;
 *   - the DAEMON keeps the merged list (DisplayStore) so a subscriber that
 *     arrives late — the bridge after a restart — starts from a snapshot,
 *     and relays every batch to everyone else (displayHub);
 *   - the BRIDGE keeps it too, for the same reason one hop further: a
 *     tablet app that (re)connects gets a snapshot first, then the stream,
 *     one op per line (toLines).
 *
 * No DOM, no sockets of its own: the daemon, the bridge, the page and the
 * tests all drive these functions.
 */

import type { DisplayItem, DisplayOp } from "./protocol"

/** One item as the page encodes it: its id and its `put` op, already JSON. */
export interface EncodedItem {
  id: string
  json: string
}

export const encodeItem = (item: DisplayItem): EncodedItem => ({ id: item.id, json: JSON.stringify({ op: "put", ...item }) })

const CLEAR = '{"op":"clear"}'
const FLUSH = '{"op":"flush"}'

/**
 * The page's side: what the tablet was last told, and the ops that bring it
 * to `items`. Items are compared by their encoded JSON, so an unchanged
 * stroke whose encoding is cached costs one string compare.
 */
export class DisplayDiff {
  private sent = new Map<string, string>()

  /** Everything, from nothing: clear, every item, flush. */
  full(items: readonly EncodedItem[]): string {
    this.sent = new Map(items.map((e) => [e.id, e.json]))
    return `[${[CLEAR, ...items.map((e) => e.json), FLUSH].join(",")}]`
  }

  /** Just the change as a JSON array of ops ending in flush — or undefined if nothing changed. */
  diff(items: readonly EncodedItem[]): string | undefined {
    const parts: string[] = []
    const seen = new Set<string>()
    for (const e of items) {
      seen.add(e.id)
      if (this.sent.get(e.id) === e.json) continue
      this.sent.set(e.id, e.json)
      parts.push(e.json)
    }
    for (const id of [...this.sent.keys()]) {
      if (seen.has(id)) continue
      this.sent.delete(id)
      parts.push(JSON.stringify({ op: "del", id }))
    }
    return parts.length ? `[${[...parts, FLUSH].join(",")}]` : undefined
  }

  /** Forget what was sent (the socket dropped): the next batch must be `full`. */
  reset(): void {
    this.sent.clear()
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null

/** JSON from the wire → ops, dropping anything malformed (one bad op never sinks a batch). */
export const parseDisplayOps = (raw: unknown): DisplayOp[] => {
  const list = Array.isArray(raw) ? raw : [raw]
  const out: DisplayOp[] = []
  for (const v of list) {
    if (!isObj(v) || typeof v.op !== "string") continue
    if (v.op === "clear" || v.op === "flush") out.push({ op: v.op })
    else if (v.op === "del" && typeof v.id === "string") out.push({ op: "del", id: v.id })
    else if (v.op === "put" && typeof v.id === "string" && Array.isArray(v.prims))
      out.push({ ...(v as unknown as DisplayItem), op: "put", z: typeof v.z === "number" ? v.z : 0 })
  }
  return out
}

/**
 * The merged list. Insertion order is kept (a re-put item keeps its place),
 * which is the tie-break for equal z on every screen that draws it.
 */
export class DisplayStore {
  private items = new Map<string, DisplayItem>()

  apply(ops: readonly DisplayOp[]): void {
    for (const op of ops) {
      if (op.op === "clear") this.items.clear()
      else if (op.op === "del") this.items.delete(op.id)
      else if (op.op === "put") {
        const { op: _, ...item } = op
        this.items.set(item.id, item)
      }
    }
  }

  get size(): number {
    return this.items.size
  }

  has(id: string): boolean {
    return this.items.has(id)
  }

  /** Everything, as a batch that rebuilds it from nothing. */
  snapshot(): DisplayOp[] {
    return [{ op: "clear" }, ...[...this.items.values()].map((item) => ({ op: "put" as const, ...item })), { op: "flush" }]
  }
}

/** Ops → the tablet's wire: one JSON op per line. */
export const toLines = (ops: readonly DisplayOp[]): string => ops.map((op) => JSON.stringify(op) + "\n").join("")

/** The slice of a Bun ServerWebSocket the hub needs (so tests can fake it). */
export interface HubSocket {
  send(data: string): unknown
  publish(topic: string, data: string): unknown
  subscribe(topic: string): unknown
  unsubscribe(topic: string): unknown
}

export const DISPLAY_TOPIC = "display"

/**
 * The daemon's /ws/display: whatever one client sends, every OTHER client
 * receives (the page → the bridge), and the merged list is kept so a client
 * that opens later is sent a snapshot at once.
 */
export const displayHub = () => {
  const store = new DisplayStore()
  return {
    store,
    open(ws: HubSocket) {
      ws.subscribe(DISPLAY_TOPIC)
      if (store.size) ws.send(JSON.stringify(store.snapshot()))
    },
    message(ws: HubSocket, raw: string | Buffer) {
      const text = typeof raw === "string" ? raw : raw.toString()
      let ops: DisplayOp[]
      try {
        ops = parseDisplayOps(JSON.parse(text))
      } catch {
        return
      }
      if (ops.length === 0) return
      store.apply(ops)
      ws.publish(DISPLAY_TOPIC, JSON.stringify(ops))
    },
    close(ws: HubSocket) {
      ws.unsubscribe(DISPLAY_TOPIC)
    },
  }
}
