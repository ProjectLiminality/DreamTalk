/**
 * Dev server: bun scripts/serve.ts [port]
 * Serves the repo root so /refs/... reference material is reachable.
 *   /          → core/editor/index.html (the editor)
 *   /demo      → core/demo/index.html
 */
const port = Number(process.argv[2] ?? 4173)
const repoRoot = new URL("../../", import.meta.url).pathname

const routes: Record<string, string> = {
  "/": "core/editor/index.html",
  "/demo": "core/demo/index.html",
  "/demo/": "core/demo/index.html",
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    let path = decodeURIComponent(url.pathname)
    path = routes[path] ?? path.slice(1)
    // page-relative asset paths
    if (path.startsWith("dist/")) path = `core/editor/${path}`
    if (path.startsWith("demo/")) path = `core/${path}`
    const file = Bun.file(repoRoot + path)
    if (await file.exists()) return new Response(file)
    return new Response(`not found: ${path}`, { status: 404 })
  },
})

console.log(`[dreamtalk] editor at http://localhost:${port} · demo at /demo`)
