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

const TASKS = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1"
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"

interface LandmarkerResult {
  landmarks: Landmark[][]
  worldLandmarks: Landmark[][]
  handedness: { categoryName: string; score: number }[][]
}
interface Landmarker {
  detectForVideo(video: HTMLVideoElement, t: number): LandmarkerResult
  close(): void
}

export interface WebcamOptions {
  /** Horizontal field of view, degrees. */
  fov?: number
  /** A camera whose label contains this (e.g. "FaceTime"); default: the system's. */
  camera?: string
}

/** The webcam as a HandSource. The camera is asked for only on start(). */
export class WebcamSource extends HandEmitter implements HandSource {
  readonly kind = "webcam" as const
  #opts: WebcamOptions
  #video?: HTMLVideoElement
  #stream?: MediaStream
  #landmarker?: Landmarker
  #running = false
  #t0 = 0
  #ids: Record<Side, number> = { left: 0, right: 0 }
  #seen: Record<Side, boolean> = { left: false, right: false }
  #next = 1

  constructor(opts: WebcamOptions = {}) {
    super()
    this.#opts = opts
    this.say("webcam: off")
  }

  async start(): Promise<void> {
    if (this.#running) return
    this.#running = true
    try {
      this.say("webcam: loading hand model…")
      const url = `${TASKS}/vision_bundle.mjs`
      const vision = (await import(/* @vite-ignore */ url)) as {
        FilesetResolver: { forVisionTasks(path: string): Promise<unknown> }
        HandLandmarker: { createFromOptions(fs: unknown, o: unknown): Promise<Landmarker> }
      }
      const fileset = await vision.FilesetResolver.forVisionTasks(`${TASKS}/wasm`)
      this.#landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      })
      this.say("webcam: asking for the camera…")
      const deviceId = await this.#pickCamera()
      this.#stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
        audio: false,
      })
      const video = document.createElement("video")
      video.muted = true
      video.playsInline = true
      video.srcObject = this.#stream
      await video.play()
      this.#video = video
      this.#t0 = performance.now()
      this.say("webcam: no hands")
      this.#loop()
    } catch (err) {
      this.#running = false
      this.say(`webcam: ${(err as Error).name === "NotAllowedError" ? "camera permission refused" : String((err as Error).message ?? err)}`)
    }
  }

  stop(): void {
    this.#running = false
    for (const track of this.#stream?.getTracks() ?? []) track.stop()
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

  #loop() {
    const video = this.#video
    if (!video || !this.#running) return
    const step = () => {
      if (!this.#running || !this.#landmarker) return
      const now = performance.now()
      const res = this.#landmarker.detectForVideo(video, now)
      const hands: Hand[] = []
      const seen: Record<Side, boolean> = { left: false, right: false }
      for (let i = 0; i < res.landmarks.length; i++) {
        const cat = res.handedness[i]?.[0]
        const label = cat?.categoryName ?? "Right"
        const side: Side = label.toLowerCase() === "left" ? "left" : "right"
        if (seen[side]) continue // two hands claimed the same side: keep the surer (first)
        seen[side] = true
        if (!this.#seen[side]) this.#ids[side] = this.#next++
        hands.push(
          webcamHand(res.landmarks[i]!, res.worldLandmarks[i]!, label, cat?.score ?? 0, video.videoWidth, video.videoHeight, this.#opts.fov ?? 65, this.#ids[side]),
        )
      }
      this.#seen = seen
      this.say(`webcam: ${hands.length ? `${hands.length} hand${hands.length > 1 ? "s" : ""}` : "no hands"}`)
      this.emit({ t: (now - this.#t0) / 1000, source: "webcam", hands, box: WEBCAM_BOX })
      schedule()
    }
    const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    const schedule = () => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step))
    schedule()
  }
}
