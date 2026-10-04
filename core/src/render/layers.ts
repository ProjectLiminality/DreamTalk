/**
 * Layered fades — a whole fading as ONE picture.
 *
 * Opacity in this framework is per leaf: a stroke's fade scales its own
 * ink, a fill's its own alpha. That is right for a holon fading among
 * others, and wrong for a whole picture fading as one: half-faded leaf by
 * leaf, a translucent fill shows whatever the same picture drew beneath it
 * (Web3's dive — the globe's sea let the lattice behind it through). Film
 * does not fade pictures that way. A dissolve flattens each picture first
 * and mixes the flat pictures by weight: A·a + B·b.
 *
 * So a layer is rendered alone, at full strength, into an offscreen target
 * cleared to transparent black, and then ADDED onto the frame scaled by its
 * weight. Everything that is not a fading layer is drawn first, exactly as
 * an unlayered frame draws it. The background is black, so a lone layer at
 * weight 1 is the picture itself; two layers mid-dissolve sum, which is
 * what the song's own measurements describe (Web3Song: "the Vitruvian's
 * brightest line and the globe's sum to one all the way through").
 *
 * Frames with no layer strictly between 0 and 1 never come here — the host
 * renders them in its single ordinary pass, unchanged.
 */

import * as THREE from "three/webgpu"
import * as TSLTyped from "three/tsl"

/** Same @types/three TSL lag as ribbon.ts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSL = TSLTyped as any
const { Fn, texture, uniform, uv, vec4 } = TSL

export class LayerCompositor {
  private readonly target: THREE.RenderTarget
  private readonly weight = uniform(1)
  private readonly quad: THREE.QuadMesh

  constructor(samples: number) {
    // Half-float keeps the picture's precision through the extra hop; the
    // samples match the canvas's own antialiasing.
    this.target = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, samples })
    const material = new THREE.NodeMaterial()
    material.transparent = true
    material.depthTest = false
    material.depthWrite = false
    material.blending = THREE.CustomBlending
    material.blendEquation = THREE.AddEquation
    material.blendSrc = THREE.OneFactor
    material.blendDst = THREE.OneFactor
    material.blendEquationAlpha = THREE.AddEquation
    material.blendSrcAlpha = THREE.OneFactor
    material.blendDstAlpha = THREE.OneFactor
    const picture = texture(this.target.texture, uv())
    material.fragmentNode = Fn(() => vec4(picture.rgb.mul(this.weight), picture.a.mul(this.weight)))()
    this.quad = new THREE.QuadMesh(material)
  }

  /**
   * Render one frame with `layers` composited by weight. `show` toggles a
   * set of top-level objects; the caller hands in, per layer, the objects
   * that ARE that layer. Weight-0 layers are simply hidden; weight-1
   * layers would draw normally, so the caller leaves them out.
   */
  async render(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    layers: readonly { objects: readonly THREE.Object3D[]; weight: number }[],
  ): Promise<void> {
    const all = layers.flatMap((l) => l.objects)
    const was = all.map((o) => o.visible)
    try {
      // 1. Everything that is not a fading layer, as an ordinary frame.
      for (const o of all) o.visible = false
      await renderer.render(scene, camera)

      // 2. Each layer alone, flat, then added in by its weight.
      const size = renderer.getDrawingBufferSize(new THREE.Vector2())
      if (this.target.width !== size.x || this.target.height !== size.y) {
        this.target.setSize(size.x, size.y)
      }
      const background = scene.background
      const clear = renderer.getClearColor(new THREE.Color())
      const clearAlpha = renderer.getClearAlpha()
      const autoClear = renderer.autoClear
      const others = scene.children.filter((c) => c.visible)
      try {
        scene.background = null
        for (const layer of layers) {
          if (!(layer.weight > 0)) continue
          for (const c of others) c.visible = false
          for (const o of layer.objects) o.visible = true
          renderer.setRenderTarget(this.target)
          renderer.setClearColor(0x000000, 0)
          renderer.autoClear = true
          await renderer.render(scene, camera)
          for (const o of layer.objects) o.visible = false
          for (const c of others) c.visible = true

          renderer.setRenderTarget(null)
          renderer.autoClear = false
          this.weight.value = layer.weight
          this.quad.render(renderer)
        }
      } finally {
        scene.background = background
        renderer.setRenderTarget(null)
        renderer.setClearColor(clear, clearAlpha)
        renderer.autoClear = autoClear
        for (const c of others) c.visible = true
      }
    } finally {
      all.forEach((o, i) => (o.visible = was[i]!))
    }
  }

  dispose(): void {
    this.target.dispose()
    ;(this.quad.material as THREE.Material).dispose()
  }
}
