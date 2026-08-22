/** Static demo server: bun scripts/serve.ts [port] */
const port = Number(process.argv[2] ?? 4173)
const rootDir = new URL("../demo/", import.meta.url).pathname

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname === "/" ? "/index.html" : url.pathname
    const file = Bun.file(rootDir + path.slice(1))
    if (await file.exists()) return new Response(file)
    return new Response("not found", { status: 404 })
  },
})

console.log(`[dreamtalk] demo at http://localhost:${port}`)
