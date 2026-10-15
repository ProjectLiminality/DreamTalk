/**
 * `window.__dt` — the headless harness's handle on a page. The editor, the
 * player and the text harness each fill in their own fields (the editor's
 * are spelled out as `EditorHarness` in editor/main.ts); the drivers in
 * scripts/ read them untyped. ONE declaration, so every page type-checks
 * in the same program.
 */
export interface DtHandle {
  ready: boolean
  duration: number
  error?: string
  setT: (t: number) => Promise<void>
  play: () => void
  pause: () => void
  [field: string]: unknown
}

declare global {
  interface Window {
    __dt?: DtHandle
  }
}
