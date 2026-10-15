/**
 * webcam.ts — hands from any camera, through MediaPipe's Hand Landmarker.
 *
 * MediaPipe gives each hand twice: 21 image landmarks (normalised x, y) and
 * 21 "world" landmarks (metres, true hand shape, centred on the hand, axes
 * as the camera's: x right, y down, z away). What it does not give is where
 * the hand is. `placeHand` finds it: the translation T that makes the metric
 * hand, moved by T, project through a pinhole onto its image landmarks — 42
 * linear equations in (tx, ty, tz), solved least-squares. A tilted palm is
 * no trap (the shape is 3D), only the lens's field of view is assumed
 * (`?fov=`, horizontal degrees; a MacBook's FaceTime camera is ~65°).
 *
 * Then into the hand frame (src/hands.ts): the user faces the camera, so the
 * user's right is the image's left (x = −x_cam), up is −y_cam, and toward the
 * user is away from the lens (z = z_cam − WEBCAM_DEPTH). MediaPipe's
 * handedness label is taken as is: on unmirrored camera frames it names the
 * true hand (checked 2026-10-15 on MediaPipe's own pointing_up / thumb_up /
 * victory photos against the hand's geometric chirality — curled fingertips
 * vs. the knuckle cross product — despite the docs' "assumes a mirrored
 * image").
 */

import {
  HandEmitter,
  palmOf,
  WEBCAM_BOX,
  WEBCAM_DEPTH,
  type Hand,
  type HandSource,
  type Side,
  type Vec3,
} from "../src/hands"

export interface Landmark {
  x: number
  y: number
  z: number
}

/** The camera-space (mm; x right, y down, z away) translation placing `world` (m) onto `image` (normalised). */
export const placeHand = (image: readonly Landmark[], world: readonly Landmark[], width: number, height: number, hfovDeg: number): Vec3 => {
  const f = width / 2 / Math.tan(((hfovDeg * Math.PI) / 180) / 2)
  // Normal equations AᵀA x = Aᵀb over rows [f, 0, −px] · T = px·Z − f·X and [0, f, −py] · T = py·Z − f·Y.
  const M = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const r = [0, 0, 0]
  const row = (a: number, b: number, c: number, rhs: number) => {
    const v = [a, b, c]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) M[i * 3 + j]! += v[i]! * v[j]!
      r[i]! += v[i]! * rhs
    }
  }
  for (let i = 0; i < Math.min(image.length, world.length); i++) {
    const px = (image[i]!.x - 0.5) * width
    const py = (image[i]!.y - 0.5) * height
    const X = world[i]!.x * 1000
    const Y = world[i]!.y * 1000
    const Z = world[i]!.z * 1000
    row(f, 0, -px, px * Z - f * X)
    row(0, f, -py, py * Z - f * Y)
  }
  return solve3(M, r)
}

/** 3×3 solve by Cramer's rule (the system is small and well-posed when a hand is seen). */
const solve3 = (m: number[], b: number[]): Vec3 => {
  const det = (a: number[]) =>
    a[0]! * (a[4]! * a[8]! - a[5]! * a[7]!) - a[1]! * (a[3]! * a[8]! - a[5]! * a[6]!) + a[2]! * (a[3]! * a[7]! - a[4]! * a[6]!)
  const d = det(m)
  if (Math.abs(d) < 1e-9) return [0, 0, WEBCAM_DEPTH]
  const col = (k: number) => m.map((v, i) => (i % 3 === k ? b[Math.floor(i / 3)]! : v))
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d]
}

/** One MediaPipe hand → a canonical Hand in the webcam's frame. */
export const webcamHand = (
  image: readonly Landmark[],
  world: readonly Landmark[],
  label: string,
  score: number,
  width: number,
  height: number,
  hfovDeg: number,
  id: number,
): Hand => {
  const T = placeHand(image, world, width, height, hfovDeg)
  const joints: Vec3[] = world.map((w) => [-(w.x * 1000 + T[0]), -(w.y * 1000 + T[1]), w.z * 1000 + T[2] - WEBCAM_DEPTH])
  const side: Side = label.toLowerCase() === "left" ? "left" : "right"
  return { id, side, joints, palm: palmOf(joints, side), confidence: score }
}

// --- the source (browser) -----------------------------------------------------
//
// SPEED (David, 2026-10-15: "worked remarkably well but was really laggy").
// The render loop never waits on the model:
//
//   WORKER (default where MediaStreamTrackProcessor exists — Chrome, Edge):
//     the camera track's frames stream straight into a (classic) worker
//     (a transferred ReadableStream<VideoFrame>, buffer of 1 — a frame that
//     waited is dropped, never queued). The worker runs the Hand Landmarker
//     (GPU delegate, VIDEO mode, on its own OffscreenCanvas) on the newest
//     frame each time it is free, and posts landmarks back — one result in
//     flight, acked by the page once used. Detection runs at the camera's
//     rate when model and page keep up, and at the slower one's pace when
//     not — always on the freshest frame, never from a queue.
//   MAIN (fallback, or ?handsworker=0): the same, on the page's thread,
//     paced by requestVideoFrameCallback.
//
// The camera is asked for at a modest size (640×480 ideal, ?camres=WxH) and
// its highest frame rate (a 60 fps camera halves the wait for a frame); the
// model reads at 192–224 px internally, so more pixels only cost upload time.
//
// TIME. A webcam frame's `t` is when its camera frame reached the page (s, on
// performance.now), not when detection finished — the honest time of the pose.
// `stats` keeps the latency (frame in → frame out), the detection time and
// rate, and the frames dropped as stale; the overlay shows them.

const TASKS = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1"
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

interface LandmarkerResult {
  landmarks: Landmark[][]
  worldLandmarks: Landmark[][]
  handedness: { categoryName: string; score: number }[][]
}
interface Landmarker {
  detectForVideo(frame: TexImageSource | VideoFrame, t: number): LandmarkerResult
  close(): void
}

/** One detection, wherever it ran: the result, the frame's size, when the frame arrived (ms, epoch) and how long detection took. */
interface Detection {
  res: LandmarkerResult
  width: number
  height: number
  arrived: number
  detectMs: number
}

const loadLandmarker = async (tasks: string, model: string, delegate: "GPU" | "CPU"): Promise<Landmarker> => {
  const url = `${tasks}/vision_bundle.mjs`
  const vision = (await import(/* @vite-ignore */ url)) as {
    FilesetResolver: { forVisionTasks(path: string): Promise<unknown> }
    HandLandmarker: { createFromOptions(fs: unknown, o: unknown): Promise<Landmarker> }
  }
  const fileset = await vision.FilesetResolver.forVisionTasks(`${tasks}/wasm`)
  return vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: model, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  })
}

/**
 * The worker's whole program — stringified into a module worker, so it must
 * stand alone (no imports from this file; its own copy of the loader).
 */
const workerMain = () => {
  const epoch = () => performance.timeOrigin + performance.now()
  let landmarker: Landmarker | undefined
  let latest: { frame: VideoFrame; arrived: number } | undefined
  let busy = false
  // Flow control: one result in flight. The page acks each result once it has
  // used it; until then frames keep arriving (the newest replacing the last)
  // but nothing is detected — a slow page never builds a backlog, and the next
  // detection is always on the freshest frame.
  let awaitingAck = false
  let dropped = 0
  const detect = () => {
    if (awaitingAck) {
      busy = false
      return
    }
    const job = latest
    latest = undefined
    if (!job || !landmarker) {
      busy = false
      return
    }
    busy = true
    const start = epoch()
    let res: LandmarkerResult | undefined
    try {
      res = landmarker.detectForVideo(job.frame, job.frame.timestamp / 1000)
    } catch (err) {
      postMessage({ kind: "error", message: String((err as Error).message ?? err) })
    }
    const width = job.frame.displayWidth
    const height = job.frame.displayHeight
    job.frame.close()
    if (res) {
      awaitingAck = true
      postMessage({
        kind: "result",
        res: { landmarks: res.landmarks, worldLandmarks: res.worldLandmarks, handedness: res.handedness },
        width,
        height,
        arrived: job.arrived,
        detectMs: epoch() - start,
        dropped,
      })
    }
    // A macrotask, so frames that arrived meanwhile are read (and the stale ones dropped) first.
    setTimeout(detect, 0)
  }
  onmessage = async (e: MessageEvent) => {
    if ((e.data as { kind?: string }).kind === "ack") {
      awaitingAck = false
      if (!busy) detect()
      return
    }
    const { readable, tasks, model } = e.data as { readable: ReadableStream<VideoFrame>; tasks: string; model: string }
    // A classic worker and the classic bundle: MediaPipe loads its wasm glue with importScripts,
    // which a module worker lacks ("ModuleFactory not set").
    const g = self as unknown as {
      importScripts(url: string): void
      Vision: {
        FilesetResolver: { forVisionTasks(path: string): Promise<unknown> }
        HandLandmarker: { createFromOptions(fs: unknown, o: unknown): Promise<Landmarker> }
      }
    }
    g.importScripts(`${tasks}/vision_bundle.js`)
    const load = async (delegate: "GPU" | "CPU") => {
      const vision = g.Vision
      const fileset = await vision.FilesetResolver.forVisionTasks(`${tasks}/wasm`)
      return vision.HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: model, delegate }, runningMode: "VIDEO", numHands: 2 })
    }
    let delegate: "GPU" | "CPU" = "GPU"
    try {
      landmarker = await load("GPU")
    } catch {
      delegate = "CPU"
      landmarker = await load("CPU")
    }
    postMessage({ kind: "ready", delegate })
    const reader = readable.getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (latest) {
        latest.frame.close()
        dropped++
      }
      latest = { frame: value, arrived: epoch() }
      if (!busy) detect()
    }
  }
}

export interface WebcamOptions {
  /** Horizontal field of view, degrees. */
  fov?: number
  /** A camera whose label contains this (e.g. "FaceTime"); default: the system's. */
  camera?: string
  /** Detect on a worker (default, where supported) or on the page's thread. */
  worker?: boolean
  /** The camera size asked for (default 640×480). */
  width?: number
  height?: number
}

export interface WebcamStats {
  /** Where detection runs and on what. */
  mode: string
  /** Frame arrival → hand frame emitted, ms (moving average). */
  latencyMs: number
  /** Time inside the model per frame, ms (moving average). */
  detectMs: number
  /** Detections per second. */
  hz: number
  /** Camera frames dropped as stale (the model was busy). */
  dropped: number
  width: number
  height: number
}

const hasWorkerPath = () =>
  typeof Worker !== "undefined" && typeof (globalThis as { MediaStreamTrackProcessor?: unknown }).MediaStreamTrackProcessor === "function"

/** The webcam as a HandSource. The camera is asked for only on start(). */
export class WebcamSource extends HandEmitter implements HandSource {
  readonly kind = "webcam" as const
  readonly stats: WebcamStats = { mode: "", latencyMs: 0, detectMs: 0, hz: 0, dropped: 0, width: 0, height: 0 }
  #opts: WebcamOptions
  #stream?: MediaStream
  #worker?: Worker
  #landmarker?: Landmarker
  #video?: HTMLVideoElement
  #running = false
  #ids: Record<Side, number> = { left: 0, right: 0 }
  #seen: Record<Side, boolean> = { left: false, right: false }
  #next = 1
  #count = 0
  #countSince = 0
  #hands = 0

  constructor(opts: WebcamOptions = {}) {
    super()
    this.#opts = opts
    this.say("webcam: off")
  }

  async start(): Promise<void> {
    if (this.#running) return
    this.#running = true
    try {
      this.say("webcam: asking for the camera…")
      const deviceId = await this.#pickCamera()
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.#opts.width ?? 640 },
          height: { ideal: this.#opts.height ?? 480 },
          frameRate: { ideal: 60 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        audio: false,
      })
      this.say("webcam: loading hand model…")
      if (this.#opts.worker !== false && hasWorkerPath()) await this.#startWorker()
      else await this.#startMain()
      this.#countSince = performance.now()
    } catch (err) {
      this.#running = false
      this.say(`webcam: ${(err as Error).name === "NotAllowedError" ? "camera permission refused" : String((err as Error).message ?? err)}`)
    }
  }

  stop(): void {
    this.#running = false
    for (const track of this.#stream?.getTracks() ?? []) track.stop()
    this.#worker?.terminate()
    this.#worker = undefined
    this.#landmarker?.close()
    this.#landmarker = undefined
    this.say("webcam: off")
  }

  async #pickCamera(): Promise<string | undefined> {
    if (!this.#opts.camera) return undefined
    // Labels are only readable once permission is granted; ask once, then choose.
    const probe = await navigator.mediaDevices.getUserMedia({ video: true })
    for (const t of probe.getTracks()) t.stop()
    const want = this.#opts.camera.toLowerCase()
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
    return cams.find((d) => d.label.toLowerCase().includes(want))?.deviceId
  }

  async #startWorker() {
    const track = this.#stream!.getVideoTracks()[0]!
    const MSTP = (globalThis as unknown as { MediaStreamTrackProcessor: new (o: { track: MediaStreamTrack; maxBufferSize?: number }) => { readable: ReadableStream<VideoFrame> } })
      .MediaStreamTrackProcessor
    const { readable } = new MSTP({ track, maxBufferSize: 1 })
    const src = `const workerMain = ${workerMain.toString()}; workerMain()`
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })))
    this.#worker = worker
    await new Promise<void>((resolve, reject) => {
      worker.onerror = (e) => reject(new Error(e.message || "hand worker failed"))
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { kind: string; delegate?: string; message?: string; dropped?: number } & Detection
        if (m.kind === "ready") {
          this.stats.mode = `worker · ${m.delegate}`
          this.say(`webcam: ${this.stats.mode} · no hands`)
          resolve()
        } else if (m.kind === "result") {
          this.stats.dropped = m.dropped ?? 0
          this.#detected({ ...m, arrived: m.arrived - performance.timeOrigin })
          worker.postMessage({ kind: "ack" })
        } else if (m.kind === "error") this.say(`webcam: ${m.message}`)
      }
      worker.postMessage({ readable, tasks: TASKS, model: MODEL }, [readable as unknown as Transferable])
    })
  }

  async #startMain() {
    let delegate: "GPU" | "CPU" = "GPU"
    try {
      this.#landmarker = await loadLandmarker(TASKS, MODEL, "GPU")
    } catch {
      delegate = "CPU"
      this.#landmarker = await loadLandmarker(TASKS, MODEL, "CPU")
    }
    this.stats.mode = `main · ${delegate}`
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.srcObject = this.#stream!
    await video.play()
    this.#video = video
    this.say(`webcam: ${this.stats.mode} · no hands`)
    type Meta = { presentationTime?: number; mediaTime?: number }
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: Meta) => void) => number }
    let lastMedia = -1
    const step = (now: number, meta?: Meta) => {
      if (!this.#running || !this.#landmarker) return
      const media = meta?.mediaTime ?? now
      if (media !== lastMedia) {
        lastMedia = media
        const arrived = meta?.presentationTime ?? now
        const start = performance.now()
        const res = this.#landmarker.detectForVideo(video, start)
        this.#detected({ res, width: video.videoWidth, height: video.videoHeight, arrived, detectMs: performance.now() - start })
      }
      schedule()
    }
    const schedule = () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame((n) => step(n)))
    schedule()
  }

  /** A detection (arrived on this page's performance clock, ms) → a HandFrame. */
  #detected(d: Detection) {
    if (!this.#running) return
    const res = d.res
    const hands: Hand[] = []
    const seen: Record<Side, boolean> = { left: false, right: false }
    for (let i = 0; i < res.landmarks.length; i++) {
      const cat = res.handedness[i]?.[0]
      const label = cat?.categoryName ?? "Right"
      const side: Side = label.toLowerCase() === "left" ? "left" : "right"
      if (seen[side]) continue // two hands claimed the same side: keep the surer (first)
      seen[side] = true
      if (!this.#seen[side]) this.#ids[side] = this.#next++
      hands.push(webcamHand(res.landmarks[i]!, res.worldLandmarks[i]!, label, cat?.score ?? 0, d.width, d.height, this.#opts.fov ?? 65, this.#ids[side]))
    }
    this.#seen = seen
    const now = performance.now()
    const ema = (a: number, b: number) => (a === 0 ? b : a * 0.9 + b * 0.1)
    this.stats.latencyMs = ema(this.stats.latencyMs, now - d.arrived)
    this.stats.detectMs = ema(this.stats.detectMs, d.detectMs)
    this.stats.width = d.width
    this.stats.height = d.height
    this.#count++
    this.#hands = hands.length
    if (now - this.#countSince >= 1000) {
      this.stats.hz = (this.#count * 1000) / (now - this.#countSince)
      this.#count = 0
      this.#countSince = now
      this.say(
        `webcam: ${this.#hands ? `${this.#hands} hand${this.#hands > 1 ? "s" : ""}` : "no hands"} · ${this.stats.hz.toFixed(0)} Hz · ` +
          `${this.stats.latencyMs.toFixed(0)} ms (model ${this.stats.detectMs.toFixed(0)}) · ${this.stats.mode}`,
      )
    }
    this.emit({ t: d.arrived / 1000, source: "webcam", hands, box: WEBCAM_BOX }, { ageMs: now - d.arrived })
  }
}
