// Render the actual composite shader with isolated background inputs. This
// checks visible dust/geometry behavior, not a parallel imitation of the shader.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, frame, init, sampler, storage, target, texture } from "vgpu/node";

async function load(name) {
  const source = ts.transpileModule(readFileSync(`src/game/${name}.ts`, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const { DEFAULT_LOOK, ROOM_STYLES } = await load("look");
const cameraModule = await load("material-room");
const width = 640, height = 400;
const gpu = await init();
const errors = [];
gpu.onError(e => errors.push(e.message));
gpu.gpu.addEventListener("uncapturederror", e => { errors.push(e.error.message); e.preventDefault(); });
const results = [];
try {
  const shader = await resolveShader({entry:"src/game/wgsl/composite.wgsl",validate:"require"});
  const pass = effect(gpu, shader.wgsl);
  // Isolate the nearest slice for tracking a persistent world-space point.
  // Its actual dust code and camera math remain unchanged.
  const sliceShader = shader.wgsl.replace(/(fn\s+\w*dust_motes\w*\b[\s\S]*?i\s*<\s*)4/, (_match,prefix)=>prefix+"1");
  assert.notEqual(sliceShader,shader.wgsl,"Nearest-slice diagnostic must isolate the actual dust loop");
  const slice = effect(gpu,sliceShader);
  const image = target(gpu,{size:[width,height],format:"rgba8unorm"});
  const black = texture(gpu,{kind:"2d",size:[1,1],format:"rgba8unorm",usage:["texture_binding","copy_dst"]});
  const white = texture(gpu,{kind:"2d",size:[1,1],format:"rgba8unorm",usage:["texture_binding","copy_dst"]});
  gpu.gpu.queue.writeTexture({texture:black.gpu},new Uint8Array([0,0,0,255]),{},[1,1]);
  gpu.gpu.queue.writeTexture({texture:white.gpu},new Uint8Array([255,255,255,255]),{},[1,1]);
  const zero = storage(gpu,4096,"read");
  zero.write(new Float32Array(1024));
  const pads = n => Array.from({length:n},()=>[0,0,0,0]);
  const base = {};
  const configStruct = readFileSync("src/game/wgsl/composite.wgsl","utf8").match(/struct Config\s*\{([\s\S]*?)\}/)[1];
  for (const [,name,type] of configStruct.matchAll(/(\w+):\s*(\w+)/g)) base[name] = type.startsWith("vec") ? Array(Number(type[3])).fill(0) : 0;
  Object.assign(base,{world:[width,height],dye_size:[2,2],room_on:1,room_depth:5,room_cx:.5,room_cy:.5,room_hw:.9,room_hh:.62,material_height:height});
  async function render(style,pan=[0,0],extra={},active=pass) {
    const look={...DEFAULT_LOOK,roomStyle:style,parallaxX:pan[0],parallaxY:pan[1]};
    const view = cameraModule.roomViewConfig?.(width,height,look) ?? {};
    active.set({
      config:{...base,visual_style:["geometry","pixel","cosmos","stone","wood","empty"].indexOf(style),parallax:pan,...view,...extra},
      balls:{xy_r_thick:pads(18),modes0:pads(18),modes1:pads(18),pop_seed:pads(18),smoke:pads(18)},
      gadgets:{count:[0,0,0,0],pose:pads(16),body:pads(16),flow:pads(16)},
      dye:zero,lut:zero,particles:zero,environmentMap:black,wallMap:black,floorMap:black,windowMap:white,
      materialSampler:sampler(gpu,{magFilter:"linear",minFilter:"linear"}),
    });
    frame(gpu,f=>f.pass({target:image,clear:true},active));
    return new Uint8Array(await image.color.read({mipLevel:0,region:"all"}));
  }
  const count = pixels => { let n=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i]>8)n++; return n; };
  for(const pan of [[0,0],[20,0],[-20,0],[20,.65],[-20,-.65]]) {
    const n = count(await render("geometry",pan,{dust_on:1}));
    results.push({case:"continuous geometry dust",pan,visiblePixels:n,pass:n>100});
  }
  if (cameraModule.roomCamera) {
    const before=await render("geometry",[0,0],{dust_on:1},slice);
    const after=await render("geometry",[.12,0],{dust_on:1},slice);
    const a=cameraModule.roomCamera(width,height,{...DEFAULT_LOOK,roomStyle:"geometry",parallaxX:0});
    const b=cameraModule.roomCamera(width,height,{...DEFAULT_LOOK,roomStyle:"geometry",parallaxX:.12});
    const dx=-(b.x-a.x)*height*a.focal/.9;
    let total=0,matched=0;
    for(let y=30;y<height-30;y++)for(let x=80;x<width-80;x++)if(before[(y*width+x)*4]>12){
      total++;
      const at=Math.round(x+dx);
      if([-1,0,1].some(ox=>after[(y*width+at+ox)*4]>8)) matched++;
    }
    results.push({case:"same-depth dust follows architectural camera displacement",expectedShift:dx,trackedPixels:total,matchedPixels:matched,pass:total>=10&&matched/total>.85});
  }
  for (const style of ["wood","stone","pixel"]) {
    const windowPixels=await render(style);
    let minY=height,maxY=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++) if(windowPixels[(y*width+x)*4]>100){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const coverage=(maxY-minY+1)/height;
    results.push({case:"tall architectural window",style,heightFraction:coverage,pass:coverage>=.45});
    const atLimit=await render(style,[.24,-.24],{dust_on:1});
    const overscroll=await render(style,[20,-20],{dust_on:1});
    const reversed=await render(style,[.23,-.23],{dust_on:1});
    results.push({case:"dust and room stop together at camera limits",style,pass:atLimit.every((v,i)=>v===overscroll[i])&&atLimit.some((v,i)=>v!==reversed[i])});
  }
  const empty = await render("empty",[0,0],{dust_on:1,rays:1,depth:3,grain:1,palette:3});
  results.push({case:"smoke-only empty background",visiblePixels:count(empty),pass:count(empty)===0&&ROOM_STYLES.some(s=>s.id==="empty")&&DEFAULT_LOOK.roomStyle==="empty"});
  zero.write(new Float32Array(1024).fill(.12));
  const smoke=await render("empty");
  results.push({case:"Empty still displays actual fluid density",visiblePixels:count(smoke),pass:count(smoke)>width*height*.9});
  results.push({case:"native GPU validation",errors,pass:errors.length===0});
  console.log(JSON.stringify(results,null,2));
  if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+"\n");
  assert.ok(results.every(r=>r.pass),"Spatial background regressions remain; see measured cases above");
} finally {gpu.dispose();}
