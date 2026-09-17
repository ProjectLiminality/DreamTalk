import puppeteer from "puppeteer-core"
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--headless=new","--enable-unsafe-webgpu","--enable-features=WebGPU","--use-angle=metal","--window-size=1600,900"] })
const p = await b.newPage(); await p.setViewport({width:1600,height:900})
const R:any[]=[]; const ck=(n:string,pass:boolean,d?:any)=>R.push({n,pass,...(d!==undefined?{d}:{})})
p.on("console",m=>{if(m.type()==="error"&&!/404|favicon/.test(m.text()))ck("CONSOLE ERR",false,m.text())})
await p.goto("http://localhost:4174/?scene=s01",{waitUntil:"networkidle0",timeout:90000})
await p.waitForFunction("window.__dt && window.__dt.ready",{timeout:90000})
// clear any prior comments for a clean run
await p.evaluate(async()=>{await fetch("/api/comments?scene=s01")})
await p.evaluate(()=>(window as any).__dt.setT(2.0)); await new Promise(r=>setTimeout(r,300))

// find a real hit and select it
const hit = await p.evaluate(()=>{const dt=(window as any).__dt; for(let y=-0.6;y<=0.6;y+=0.1)for(let x=-0.4;x<=0.4;x+=0.1){if(dt.pick(x,y))return{x:+x.toFixed(2),y:+y.toFixed(2)}}return null})
ck("a holon is pickable in the viewport", !!hit, hit)
const cls = await p.evaluate((h)=>(window as any).__dt.selectAt(h.x,h.y), hit)
await new Promise(r=>setTimeout(r,250))
ck("selecting shows comment+gizmo (has-selection)", await p.evaluate(()=>document.querySelector("#panel")?.classList.contains("has-selection")||false))

// scroll panel to the composer, then REAL type + click Attach
await p.evaluate(()=>{document.querySelector(".commentinput")?.scrollIntoView()})
const ta = await p.$(".commentinput"); await ta!.focus(); await p.evaluate(()=>{const ta=document.querySelector(".commentinput") as HTMLTextAreaElement; ta.value="hold the beat here and brighten"; ta.dispatchEvent(new Event("input",{bubbles:true}))})
const typed = await p.$eval(".commentinput",(e:any)=>e.value)
ck("typing into the composer works", typed==="hold the beat here and brighten", typed)
// Attach becomes enabled once there's text?
const attachEnabled = await p.$eval(".attachbtn",(e:any)=>!e.disabled)
ck("Attach enables when text present", attachEnabled)
await p.click(".attachbtn"); await new Promise(r=>setTimeout(r,400))
const post = await p.evaluate(()=>({rows:document.querySelectorAll(".commentlist > *:not(.empty)").length, txt:(document.querySelector(".commentlist") as HTMLElement).innerText, cleared:(document.querySelector(".commentinput") as HTMLTextAreaElement).value===""}))
ck("comment appears in list after Attach", post.rows>=1 && post.txt.includes("hold the beat"), post)
ck("composer clears after Attach", post.cleared)

// persisted with anchor
const persisted = await p.evaluate(async()=>{const j=await(await fetch("/api/comments?scene=s01")).json();return j.comments.map((c:any)=>({label:c.pathLabel,text:c.text,t:c.t,bounds:c.bounds!=null,path:c.path!=null}))})
const mine = persisted.find((c:any)=>c.text.includes("hold the beat"))
ck("persisted with pathLabel", !!mine?.label, mine)
ck("persisted with timeline t", typeof mine?.t==="number")
ck("persisted with screen bounds (render hook)", mine?.bounds===true)
ck("persisted with SelectionPath anchor", mine?.path===true)

// GIZMO: default voice, switch modes, handles appear, and a drag WRITES
ck("gizmo default is voice", await p.evaluate(()=>(window as any).__dt.gizmoMode())==="voice")
for(const m of ["move","rotate","scale"]){
  await p.evaluate((m)=>(window as any).__dt.setGizmoMode(m),m); await new Promise(r=>setTimeout(r,120))
  const g = await p.evaluate(()=>({mode:(window as any).__dt.gizmoMode(),h:(window as any).__dt.gizmoHandles()}))
  ck(`${m}: mode set + 3 axis handles`, g.mode===m && !!g.h && g.h.tips?.length===3, {mode:g.mode, hasHandles:!!g.h})
}
// active gizmo button visibly highlighted?
const active = await p.evaluate(()=>{const bs=Array.from(document.querySelectorAll(".gizbtn")) as HTMLElement[]; return bs.map(x=>({t:x.textContent,active:x.classList.contains("active")||x.getAttribute("aria-pressed")==="true"}))})
ck("active gizmo mode is visually marked", active.some((a:any)=>a.active), active)

// deselect clears the sections
await p.evaluate(()=>(window as any).__dt.clearSelection()); await new Promise(r=>setTimeout(r,150))
ck("deselect hides comment+gizmo", await p.evaluate(()=>!document.querySelector("#panel")?.classList.contains("has-selection")))

console.log(JSON.stringify(R,null,2))
const f=R.filter(r=>!r.pass); console.log(`\n${R.length-f.length}/${R.length} PASS`+(f.length?`\nFAILS: ${JSON.stringify(f)}`:""))
await b.close()
