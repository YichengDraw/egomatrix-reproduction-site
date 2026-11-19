'use strict';
const el=id=>document.getElementById(id), part=location.pathname.split('/rounds/')[0], base=part.endsWith('/')?part:part+'/', root=new URL(base,location.origin);
function mediaRoot(){
    return manifest?.media_revision && location.hostname.endsWith('github.io')
        ? new URL('https://cdn.jsdelivr.net/gh/YichengDraw/egomatrix-reproduction-site@'+manifest.media_revision+'/') : root;
}
function assetURL(path){
    return path?.startsWith('../../media/') && path.endsWith('.json.gz') && manifest?.media_revision
        ? new URL('media/'+path.split('/').pop(),mediaRoot()) : new URL(path,folder);
}
async function json(u){
    let url=new URL(u),r;
    try{r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);}
    catch(err){
        if(url.hostname!=='cdn.jsdelivr.net')throw err;
        const parts=url.pathname.match(/^\/gh\/([^/]+)\/([^@]+)@([^/]+)\/(.*)$/);
        if(!parts)throw err;
        r=await fetch('https://raw.githubusercontent.com/'+parts.slice(1).join('/'));if(!r.ok)throw Error(r.status+' '+url);
    }
    if(url.pathname.endsWith('.json.gz'))return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
    return r.json();
}
const lab=v=>v===true?'通过':v===false?'失败':'未知', fmt=v=>v==null?'—':String(v);
let manifest,rows,active,playData,epoch=0,index=0,playing=false,folder;
function select(id,values,all=true){const s=el(id),before=s.value;s.replaceChildren();for(const v of [...(all?['全部']:[]),...new Set(values)])s.add(new Option(v,v));if([...s.options].some(o=>o.value===before))s.value=before}
function table(id,heads,values,ids){const t=el(id);t.replaceChildren();const h=t.createTHead().insertRow();heads.forEach(x=>{const c=document.createElement('th');c.textContent=x;h.append(c)});const b=t.createTBody();values.forEach((row,i)=>{const tr=b.insertRow();for(const v of row)tr.insertCell().textContent=fmt(v);if(ids){tr.dataset.id=ids[i];tr.onclick=()=>show(ids[i]);tr.classList.toggle('selected',active===ids[i])}})}
function filtered(){const f=[['device','device'],['robot','robot'],['method','method'],['dt','physics_dt']];return rows.filter(r=>f.every(([id,k])=>el(id).value==='全部'||String(r[k])===el(id).value))}
function list(){const a=filtered();table('rows',['片段','设备','机器手','手侧','方法','动作版本','控制方式','秒/步','状态','S','C','J'],a.map(r=>[r.episode,r.device,r.robot,r.side,r.method,r.variant,r.product==='frozen_feedback'?'冻结反馈':r.product==='fixed_actions'?'固定动作':'',r.physics_dt,r.status,lab(r.S),lab(r.C),lab(r.J)]),a.map(r=>rows.indexOf(r)))}
function reports(){return JSON.parse(localStorage.getItem('gtcontact-stereo-notes')||'{}')}
function key(){const r=rows[active];return JSON.stringify([manifest.round,r.source,r.episode,r.robot,r.side,r.method,r.seed,r.physics_dt,r.control_id])}
async function show(i){const seq=++epoch;playing=false;el('play').textContent='播放';active=i;const r=rows[i];list();el('caseTitle').textContent=r.episode+' · '+r.robot+' · '+r.method;el('details').textContent=[r.object,'源帧 '+r.source_frames.join('–'),r.initial_state,r.variant,r.product,r.hypothesis,r.task_scope,r.task_type,r.reason,r.cost_text].filter(Boolean).join(' ｜ ');el('error').textContent='';el('player').hidden=true;playData=null;el("more").open=false;el("more").hidden=!r.score_record;el("metrics").textContent="";const n=reports()[key()]||{};el('vote').value=n.vote||'不确定';el('note').value=n.note||'';
const baselineTitle=document.querySelector('[data-scene=baseline] figcaption');if(baselineTitle)baselineTitle.firstChild.textContent=r.baseline_label?'配对参照 · '+r.baseline_label:'直接执行 · B0';
if(!r.media)return;
try{const source=assetURL(r.media.source),tr=async path=>path?json(assetURL(path)):null;const [s,b,a,trace,world]=await Promise.all([json(source),tr(r.media.baseline),tr(r.media.actual),tr(r.timeline),tr(r.world)]);if(seq!==epoch)return;
playData={s,b,a,trace,world};configureWorldLayers(world,r.hypothesis);el('frame').max=s.time.length-1;setStereoSource(r);select('chart',s.charts||[],false);el('player').hidden=false;resetCamerasForEpisode();draw(0)}catch(e){if(seq===epoch)el('error').textContent='回放读取失败 '+e}}
function setStereoSource(row) {
    const version = el('stereoOverlay').checked ? '.undistorted.mp4' : '.undistorted-clean.mp4';
    const url = new URL(row.media.stereo, folder);
    url.pathname = url.pathname.replace(/\.mp4$/, version);
    if (el('stereo').src !== url.href) el('stereo').src = url.href;
}
el('stereoOverlay').onchange = () => {
    if (playData) setStereoSource(rows[active]);
};
function dots(ctx,points,c,r,project){ctx.fillStyle=c;for(const p of points||[]){const [x,y]=project(p);ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}}
function canvas(id){const o=el(id),w=o.width=600,h=o.height=id==='uv'?260:370,ctx=o.getContext('2d');ctx.clearRect(0,0,w,h);return ctx}
const sceneIds = ['gt', 'baseline', 'actual'];
const cameraDefaults = () => ({
    yaw: .55, pitch: .32, zoom: 1, panX: 0, panY: 0,
    diameter: .25, worldCenter: [0, 0, 0]
});
const comparisonCamera = cameraDefaults();
const cadCamera = cameraDefaults();
let currentGeometry, pendingOrbitFrame;

function bounds(points) {
    const lo = [Infinity, Infinity, Infinity], hi = lo.map(() => -Infinity);
    for (const p of points) {
        for (let axis = 0; axis < 3; axis++) {
            lo[axis] = Math.min(lo[axis], p[axis]);
            hi[axis] = Math.max(hi[axis], p[axis]);
        }
    }
    return {center: lo.map((v,k) => (v+hi[k])/2), diameter: Math.hypot(...hi.map((v,k) => v-lo[k]))};
}

function geometryAt(i) {
    if (currentGeometry?.data === playData && currentGeometry.i === i) return currentGeometry.scenes;
    const {s, a, b} = playData;
    const sourceFrame = s.frames[i], target = (s.targets[i] || []).map(p => p.p);
    const recorded = frame => ({
        hand: frame?.hand || [], object: transform(s.cad, frame?.T), target: [],
        actual: transform((frame?.contacts || []).map(p => p.p), frame?.T)
    });
    const scenes = {
        gt: {hand: sourceFrame.hand, object: transform(s.cad, sourceFrame.T), target: transform(target, sourceFrame.T), actual: []},
        baseline: recorded(b?.frames[i]), actual: recorded(a?.frames[i]),
        cad: {hand: [], object:s.cad, target, actual:(a?.frames[i]?.contacts || []).map(p => p.p)}
    };
    for (const scene of Object.values(scenes)) {
        if (scene.hand.length) scene.handBounds = bounds(scene.hand);
        if (scene.object.length) {
            scene.objectBounds = bounds(scene.object);
            scene.pairBounds = bounds([...scene.hand, ...scene.object]);
        }
    }
    currentGeometry = {i, data:playData, scenes};
    return scenes;
}

function fitComparison() {
    if (!playData) return;
    const scenes = geometryAt(index), camera = comparisonCamera;
    const focus = el('focusTarget').value, reference = scenes.gt;
    if (focus === 'world') {
        const ids = el('sceneViews').dataset.expanded ? [el('sceneViews').dataset.expanded] : sceneIds;
        const points = ids.flatMap(id => [...scenes[id].hand, ...scenes[id].object]);
        const visible = bounds(points.length ? points : [...reference.hand, ...reference.object]);
        camera.worldCenter = visible.center;
        camera.diameter = Math.max(.045, visible.diameter);
    } else {
        const frame = el('sceneViews').dataset.expanded;
        const subject = (frame && scenes[frame].hand.length) ? scenes[frame] : reference;
        const box = focus === 'hand' ? subject.handBounds : subject.objectBounds;
        camera.diameter = Math.max(.10, box.diameter * 1.45);
    }
    camera.zoom = 1; camera.panX = 0; camera.panY = 0;
}

function resetCamerasForEpisode() {
    index = 0;
    currentGeometry = null;
    Object.assign(comparisonCamera, cameraDefaults());
    Object.assign(cadCamera, cameraDefaults());
    if (playData) {
        cadCamera.diameter = Math.max(.025, geometryAt(0).cad.objectBounds.diameter);
        fitComparison();
    }
}

function projectAxes(ctx, width, height, axes, pixelsPerMetre) {
    ctx.lineCap = 'round'; ctx.lineWidth = 1.6; ctx.font = '11px system-ui';
    const base = [31, height-29];
    [['X','#a54539'], ['Y','#34684f'], ['Z','#3f6493']].forEach(([label,color],k) => {
        const x = base[0] + 16*axes[0][k], y = base[1]-16*axes[1][k];
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(...base); ctx.lineTo(x,y); ctx.stroke();
        ctx.fillText(label, x+2, y-2);
    });
    const desired = 66 / pixelsPerMetre, power = 10 ** Math.floor(Math.log10(desired));
    const nice = [1,2,5,10].reduce((a,b) =>
        Math.abs(b*power-desired) < Math.abs(a*power-desired) ? b : a);
    const metres = nice*power, span = metres*pixelsPerMetre, right = width-15, y = height-17;
    ctx.strokeStyle=ctx.fillStyle='#536358';
    ctx.beginPath(); ctx.moveTo(right-span,y-3); ctx.lineTo(right-span,y);
    ctx.lineTo(right,y); ctx.lineTo(right,y-3); ctx.stroke();
    const mm = +(metres*1000).toPrecision(3);
    ctx.textAlign='right'; ctx.fillText(mm >= 1000 ? (mm/1000)+' m' : mm+' mm',right,y-6);
    ctx.textAlign='left';
}

function view(id, scene) {
    const canvas = el(id);
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width*dpr), h = Math.round(height*dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(w/width,0,0,h/height,0,0); ctx.clearRect(0,0,width,height);
    if (!scene.objectBounds) {
        ctx.font='14px system-ui'; ctx.fillStyle='#536358';ctx.textAlign='center';
        ctx.fillText('此帧无实际回放',width/2,height/2); ctx.textAlign='left';return;
    }
    const camera = id === 'cad' ? cadCamera : comparisonCamera;
    const mode = id === 'cad' ? 'object' : el('focusTarget').value;
    const center = mode === 'world' ? camera.worldCenter : mode === 'pair' ? scene.pairBounds.center : mode === 'hand' ? scene.handBounds.center : scene.objectBounds.center;
    const expanded = el('sceneViews').dataset.expanded;
    const visible = expanded ? [expanded] : sceneIds;
    const diameter = mode === 'pair' ? Math.max(.045,...visible.map(s => geometryAt(index)[s].pairBounds?.diameter || 0)) : camera.diameter;
    const unit = Math.min(width,height), scale = .90*unit*camera.zoom/diameter;
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const axes = [[cy,-sy,0],[sy*sp,cy*sp,cp],[-sy*cp,-cy*cp,sp]];
    const project = p => {
        const x=p[0]-center[0], y=p[1]-center[1], z=p[2]-center[2];
        const u=cy*x-sy*y, v=sy*x+cy*y;
        return [width/2+unit*camera.panX+scale*u,height/2+unit*camera.panY-scale*(z*cp+v*sp),-v*cp+z*sp];
    };
    drawWorldLayer(ctx,project,playData.world,index,id,id==='actual'?playData.a?.frames[index]:playData.b?.frames[index]);
    const surfaced = window.drawOrbitSurfaces?.({id,ctx,project,frame:index,data:playData});
    const points = [];
    function include(vertices, color, radius) {
        for (const p of vertices) {
            const [x,y,depth]=project(p);
            if (x > -radius && x < width+radius && y > -radius && y < height+radius) points.push({x,y,depth,color,radius});
        }
    }
    const radius = Math.min(4, Math.max(1.5, unit*.006*Math.sqrt(camera.zoom)));
    if (!surfaced?.hand) include(scene.hand,'#266c79',radius);
    if (!surfaced?.object) include(scene.object,'#ac632f',radius);
    points.sort((a,b) => a.depth-b.depth);
    for (const p of points) {
        ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();
    }
    for (const [list, color] of [[scene.target,'#17803c'],[scene.actual,'#b13134']]) {
        for (const p of list) {
            const [x,y] = project(p);
            ctx.beginPath();ctx.arc(x,y,radius+1.5,0,Math.PI*2);
            ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#ffffffe0';ctx.lineWidth=.8;ctx.stroke();
        }
    }
    projectAxes(ctx,width,height,axes,scale);
}

function renderScenes() {
    if (!playData || el('player').hidden) return;
    const scenes = geometryAt(index);
    for (const id of [...sceneIds,'cad']) view(id,scenes[id]);
}
function requestOrbitDraw() {
    if (pendingOrbitFrame) return;
    pendingOrbitFrame=requestAnimationFrame(() => {pendingOrbitFrame=0;renderScenes();});
}

function zoomAt(camera, ratio, canvas, anchor) {
    const next=Math.min(24, Math.max(.06,camera.zoom*ratio));
    if (canvas && anchor) {
        const box=canvas.getBoundingClientRect(), unit=Math.min(box.width,box.height);
        const x=(anchor.x-box.left-box.width/2)/unit, y=(anchor.y-box.top-box.height/2)/unit;
        camera.panX=x+(camera.panX-x)*next/camera.zoom;
        camera.panY=y+(camera.panY-y)*next/camera.zoom;
    }
    camera.zoom=next;
}

function orbitControls(id) {
    const canvas=el(id), camera=id==='cad'?cadCamera:comparisonCamera;
    const pointers=new Map();
    const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const pan=(dx,dy)=>{
        const unit=Math.min(canvas.clientWidth,canvas.clientHeight);
        camera.panX+=dx/unit;camera.panY+=dy/unit;
    };
    canvas.addEventListener('contextmenu', e=>e.preventDefault());
    canvas.addEventListener('pointerdown', e=>{
        if (e.button>2) return;
        pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button!==0});
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e=>{
        const previous=pointers.get(e.pointerId);
        if (!previous) return;
        const others=[...pointers.entries()].filter(([key])=>key!==e.pointerId);
        const next={x:e.clientX,y:e.clientY,pan:previous.pan};
        pointers.set(e.pointerId,next);
        if (others.length) {
            const other=others[0][1], before=midpoint(previous,other), after=midpoint(next,other);
            zoomAt(camera,distance(next,other)/Math.max(1,distance(previous,other)),canvas,before);
            pan(after.x-before.x,after.y-before.y);
        } else if (previous.pan || e.shiftKey) pan(next.x-previous.x,next.y-previous.y);
        else {
            camera.yaw+=(next.x-previous.x)*.008;
            camera.pitch=Math.max(-1.55,Math.min(1.55,camera.pitch+(next.y-previous.y)*.008));
        }
        requestOrbitDraw();
    });
    for (const event of ['pointerup','pointercancel','lostpointercapture'])
        canvas.addEventListener(event,e=>pointers.delete(e.pointerId));
    canvas.addEventListener('wheel',e=>{
        e.preventDefault();
        const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
        zoomAt(camera,Math.exp(-Math.max(-250,Math.min(250,dy))*.002),canvas,{x:e.clientX,y:e.clientY});
        requestOrbitDraw();
    },{passive:false});
    canvas.addEventListener('keydown',e=>{
        if (e.key==='+'||e.key==='=') zoomAt(camera,1.25);
        else if(e.key==='-') zoomAt(camera,.8);
        else if(e.key==='ArrowLeft') camera.yaw-=.12;
        else if(e.key==='ArrowRight') camera.yaw+=.12;
        else if(e.key==='ArrowUp') camera.pitch=Math.min(1.55,camera.pitch+.12);
        else if(e.key==='ArrowDown') camera.pitch=Math.max(-1.55,camera.pitch-.12);
        else return;
        e.preventDefault();requestOrbitDraw();
    });
    new ResizeObserver(requestOrbitDraw).observe(canvas);
}
for (const id of [...sceneIds,'cad']) orbitControls(id);
for (const button of document.querySelectorAll('[data-expand]')) {
    button.addEventListener('click',()=>{
        const wrap=el('sceneViews'), target=button.dataset.expand;
        if(wrap.dataset.expanded===target) delete wrap.dataset.expanded;
        else wrap.dataset.expanded=target;
        for(const card of wrap.querySelectorAll('figure')) {
            const selected=wrap.dataset.expanded===card.dataset.scene, toggle=card.querySelector('button');
            card.hidden=Boolean(wrap.dataset.expanded)&&!selected;
            toggle.textContent=selected?'三视图对照':'单独查看';
            toggle.setAttribute('aria-pressed',String(selected));
            toggle.setAttribute('aria-label',selected?'返回三视图对照':'放大'+card.querySelector('canvas').getAttribute('aria-label'));
        }
        requestOrbitDraw();
    });
}
el('focusTarget').onchange=el('fitView').onclick=()=>{fitComparison();requestOrbitDraw();};
el('resetView').onclick=()=>{
    el('focusTarget').value='pair';
    Object.assign(comparisonCamera,cameraDefaults());fitComparison();requestOrbitDraw();
};
el('zoomIn').onclick=()=>{zoomAt(comparisonCamera,1.3);requestOrbitDraw();};
el('zoomOut').onclick=()=>{zoomAt(comparisonCamera,1/1.3);requestOrbitDraw();};
el('resetCad').onclick=()=>{
    const diameter=cadCamera.diameter;
    Object.assign(cadCamera,cameraDefaults(),{diameter});requestOrbitDraw();
};
function transform(v,T){if(!T)return [];return v.map(p=>T.slice(0,3).map(r=>r[3]+p.reduce((a,x,i)=>a+x*r[i],0)))}
function draw(i,seek=true){if(!playData)return;index=Math.max(0,Math.min(+i,playData.s.time.length-1));i=index;const {s,b,a}=playData,goal=s.targets[i]||[],get=(q)=>q&&q.frames[i];const f=get(a);
renderScenes();
timeline(s,a,i);renderContactTraces(playData.trace,i,rows[active]);
const ctx=canvas('uv'),chart=el('chart').value,proj=p=>[30+540*p[0],235-210*p[1]];ctx.strokeStyle='#bac5bd';ctx.strokeRect(30,25,540,210);for(const [v,c] of [[goal,'#27903c'],[f?.contacts||[],'#ba3332']])dots(ctx,v.filter(p=>p.chart===chart).map(p=>p.uv),c,5,proj);
el('clock').textContent=s.time[i].toFixed(3)+' s · 源帧 '+s.source_frames[i];el('frame').value=i;el('instant').textContent='目标锚点 '+goal.length+'，实际碰撞记录 '+(f?.contacts||[]).length+'。'+(f?.support||'');
if(seek&&Number.isFinite(el('stereo').duration)){el('stereo').currentTime=Math.min(el('stereo').duration-.001,i/(s.video_fps||30))}}
el('frame').oninput=e=>draw(e.target.value);el('chart').onchange=()=>draw(index);el('stereo').onloadedmetadata=()=>draw(index);el('play').onclick=()=>{if(!playData)return;playing=!playing;el('play').textContent=playing?'暂停':'播放';if(!playing)return;const t=performance.now(),start=index===playData.s.time.length-1?0:index,seq=epoch;function tick(now){if(!playing||epoch!==seq)return;const times=playData.s.time,tm=times[start]+(now-t)/1000;let j=start;while(j+1<times.length&&times[j+1]<=tm)j++;if(j!==index)draw(j);if(j+1===times.length){playing=false;el('play').textContent='播放'}else requestAnimationFrame(tick)}requestAnimationFrame(tick)};
el('save').onclick=()=>{let notes=reports();notes[key()]={vote:el('vote').value,note:el('note').value};localStorage.setItem('gtcontact-stereo-notes',JSON.stringify(notes));el('saved').textContent='已保存到此浏览器'};
el('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(reports(),null,2)],{type:'application/json'}));a.download='gtcontact-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
el('import').onchange=async e=>{try{const n=JSON.parse(await e.target.files[0].text());if(!n||Array.isArray(n)||typeof n!=='object'||!Object.values(n).every(x=>x&&typeof x.note==='string'&&['成功','失败','不确定'].includes(x.vote)))throw Error('格式错误');localStorage.setItem('gtcontact-stereo-notes',JSON.stringify({...reports(),...n}));show(active)}catch(err){el('saved').textContent=String(err)}};
async function init(){const pathRound=location.pathname.match(/\/rounds\/([^/]+)/)?.[1],latest=await json(new URL('latest.json',root)).catch(()=>null),requested=pathRound||latest?.round;if(!pathRound && requested?.startsWith('V3-B')){location.replace(new URL('rounds/'+encodeURIComponent(requested)+'/',root));return;}if(!requested)throw Error('尚无已核验的完整轮次');folder=new URL('rounds/'+encodeURIComponent(requested)+'/',root);manifest=await json(new URL('manifest.json',folder));rows=manifest.rows;if(manifest.pilot_rows){el('splitBox').hidden=false;el('decisionLine').hidden=false;el('decision').href=new URL('pilot_decision.json',folder);el('split').onchange=()=>{rows=el('split').value==='pilot'?manifest.pilot_rows:manifest.rows;for(const [id,k] of [['device','device'],['robot','robot'],['method','method'],['dt','physics_dt']])select(id,rows.map(r=>r[k]));list();show(Math.max(0,rows.findIndex(r=>r.media?.actual)))}}el('manifest').href=new URL('manifest.json',folder);for(const [id,url] of [['coverage','coverage.csv'],['changes','transitions.csv'],['cost','budget.json']])el(id).href=new URL(url,folder);el('roundTitle').textContent=requested;el('scope').textContent=manifest.scope;
for(const [label,file] of Object.entries(manifest.downloads||{})){
 const link=document.createElement('a');link.href=new URL(file,folder);link.textContent=label;
 el('scope').append(document.createElement('br'),link);
}
select('history',Array.from(new Set([...(latest?.history||[]),requested])),false);el('history').value=requested;el('history').onchange=e=>location.assign(new URL('rounds/'+e.target.value+'/',root));
table('summary',['设备','手','方法','初态','积分步长','控制方式','任务 S','接触 C','联合 J','C 已知'],manifest.summary.map(r=>[r.device,r.robot,r.method,r.initial_state,r.physics_dt,r.product==='frozen_feedback'?'冻结反馈':r.product==='fixed_actions'?'固定动作':'',...['S','C','J','C_known'].map(k=>r[k]+'/'+r.N)]));
for(const [id,k] of [['device','device'],['robot','robot'],['method','method'],['dt','physics_dt']]){select(id,rows.map(r=>r[k]));el(id).onchange=()=>{list();const a=filtered();if(a.length)show(rows.indexOf(a[0]))}}list();
if(rows.length) {
    const ready = r => r.status === 'complete' && r.physics_dt === .005 && r.media?.actual;
    const preferred = ['B3','B2','B1','B0'].map(method=>rows.findIndex(r=>ready(r)&&r.method===method)).find(i=>i>=0);
    await show(preferred ?? Math.max(0, rows.findIndex(r=>r.media?.actual)));
}}
init().catch(e=>el('error').textContent=String(e));

function timeline(s,a,index){const c=el('timeline'),w=c.width=1000,h=c.height=90,x=k=>20+(w-40)*s.time[k]/Math.max(.001,s.time.at(-1));const ctx=c.getContext('2d'),err=s.frames.map((f,k)=>a?.frames[k]?Math.hypot(...[0,1,2].map(j=>f.T[j][3]-a.frames[k].T[j][3])):null),max=Math.max(.01,...err.filter(v=>v!=null));ctx.strokeStyle='#b96929';ctx.beginPath();err.forEach((v,k)=>{if(v!=null)ctx.lineTo(x(k),61-48*v/max)});ctx.stroke();ctx.fillStyle='#423d36';ctx.fillText((max*1000).toFixed(0)+' mm',2,11);s.frames.forEach((_,k)=>{const width=Math.max(2,(w-40)/s.frames.length);if(s.targets[k]?.length){ctx.fillStyle='#27903c';ctx.fillRect(x(k),68,width,5)}if(a?.frames[k]?.contacts.length){ctx.fillStyle='#ba3332';ctx.fillRect(x(k),76,width,5)}});ctx.fillStyle='#182b28';ctx.fillRect(x(index),5,1,80);c.onclick=e=>draw(Math.round(Math.max(0,Math.min(1,(e.offsetX/c.clientWidth*w-20)/(w-40)))*(s.time.length-1)))}

let scores;
el('more').ontoggle=async()=>{if(!el('more').open)return;const r=rows[active];try{scores??=json(new URL('scores.json.gz',folder));const result=(await scores)[r.score_record];el('metrics').textContent=JSON.stringify(result,null,2)}catch(e){el('metrics').textContent=String(e)}};
el('uv').onmousemove=e=>{if(!playData)return;const box=e.target.getBoundingClientRect(),u=((e.clientX-box.left)/box.width*600-30)/540,v=(235-(e.clientY-box.top)/box.height*260)/210,chart=el('chart').value;
const q=[...(playData.s.targets[index]||[]).filter(x=>x.chart===chart).map(x=>({...x,kind:'目标'})),...(playData.a?.frames[index]?.contacts||[]).filter(x=>x.chart===chart).map(x=>({...x,kind:'实际'}))].sort((a,b)=>Math.hypot(a.uv[0]-u,a.uv[1]-v)-Math.hypot(b.uv[0]-u,b.uv[1]-v))[0];
e.target.title=q?q.kind+' '+chart+' · u '+q.uv[0].toFixed(2)+' · v '+q.uv[1].toFixed(2)+' · CAD '+q.p.map(n=>(n*1000).toFixed(1)).join(', ')+' mm':''};
