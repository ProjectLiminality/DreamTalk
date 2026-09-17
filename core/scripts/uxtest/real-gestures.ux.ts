import puppeteer from "puppeteer-core"
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new","--enable-unsafe-webgpu","--enable-features=WebGPU","--use-angle=metal","--window-size=1600,900"] })
const p = await b.newPage(); await p.setViewport({width:1600,height:900})
const R:any[]=[]; const ck=(n:string,pass:boolean,d?:any)=>R.push({n,pass,...(d!==undefined?{d}:{})})
await p.goto("http://localhost:4174/?scene=s01",{waitUntil:"networkidle0",timeout:90000})
await p.waitForFunction("window.__dt && window.__dt.ready",{timeout:90000})
await p.evaluate(()=>(window as any).__dt.setT(2.0)); await new Promise(r=>setTimeout(r,300))

// REAL pointer click on the canvas at a holon's screen position
const hitNdc = await p.evaluate(()=>{const dt=(window as any).__dt; for(let y=-0.6;y<=0.6;y+=0.1)for(let x=-0.4;x<=0.4;x+=0.1){if(dt.pick(x,y))return{x,y}}return null})
// convert ndc → canvas px (viewport is the left region up to the panel at x=1328, canvas ~ 256..1328 wide, 0..900 tall... use actual canvas rect)
const canvasRect = await p.evaluate(()=>{const c=document.querySelector("canvas"); const r=c!.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})
const px = { x: canvasRect.x + (hitNdc.x*0.5+0.5)*canvasRect.w, y: canvasRect.y + (1-(hitNdc.y*0.5+0.5))*canvasRect.h }
await p.mouse.click(px.x, px.y); await new Promise(r=>setTimeout(r,300))
const afterClick = await p.evaluate(()=>({has:document.querySelector("#panel")?.classList.contains("has-selection")||false, name:document.querySelector("#scenename")?.textContent}))
ck("REAL canvas click selects + shows panel", afterClick.has, afterClick)

// mic button click focuses the textarea (its documented behavior)
if(afterClick.has){
  await p.evaluate(()=>document.querySelector(".micbtn")?.scrollIntoView())
  await p.click(".micbtn"); await new Promise(r=>setTimeout(r,120))
  const focused = await p.evaluate(()=>document.activeElement?.classList.contains("commentinput")||false)
  ck("mic button focuses the text input (voice-first placeholder)", focused)
}

// clicking empty canvas deselects gracefully (no crash, panel clears)
await p.mouse.click(canvasRect.x+20, canvasRect.y+20); await new Promise(r=>setTimeout(r,200))
const afterEmpty = await p.evaluate(()=>({has:document.querySelector("#panel")?.classList.contains("has-selection")||false}))
ck("clicking empty space deselects cleanly", !afterEmpty.has, afterEmpty)

// gizmo switch by REAL button click
await p.evaluate((h)=>(window as any).__dt.selectAt(h.x,h.y), hitNdc); await new Promise(r=>setTimeout(r,200))
const gizBtns = await p.$$(".gizbtn")
let moveClicked=false
for(const gb of gizBtns){ const t=await gb.evaluate((e:any)=>e.textContent); if(t==="Move"){ await gb.click(); moveClicked=true; break } }
await new Promise(r=>setTimeout(r,150))
ck("REAL click on 'Move' button activates move mode", moveClicked && await p.evaluate(()=>(window as any).__dt.gizmoMode())==="move")

console.log(JSON.stringify(R,null,2))
const f=R.filter(r=>!r.pass); console.log(`\n${R.length-f.length}/${R.length} PASS`+(f.length?`\nFAILS:${JSON.stringify(f)}`:""))
await b.close()
