'use strict';
const $=x=>document.getElementById(x), base=new URL('./',document.currentScript.src), q=new URLSearchParams(location.search);
$('models').href=new URL('assets.html',base);$('prior').href=new URL('../gtcontact-stereo-v3/research-summary.html',base);
let doc,rows=[],row,seq=0,data,parts,frame=0,playing=false,clocktime=0,saved=JSON.parse(localStorage.getItem('egowm-v4-notes')||'{}');
const camera={yaw:.5,pitch:-.24,scale:1,px:0,py:0},cn=$('scene'),ctx=cn.getContext('2d');
async function get(url,zip=false){
 const r=await fetch(url,{signal:AbortSignal.timeout(17000)});if(!r.ok)throw Error(r.status+' '+url);
 return zip?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():r.json();
}
async function media(path){
 if(!doc.media_commit || doc.local_media?.includes(path))return get(new URL('media/'+path,base),true);
 const repo='YichengDraw/egomatrix-reproduction-site',id=doc.media_commit;
 for(const url of ['https://cdn.jsdelivr.net/gh/'+repo+'@'+id+'/v4/'+path,'https://raw.githubusercontent.com/'+repo+'/'+id+'/v4/'+path]){
  try{return await get(url,true)}catch(e){}
 }
 const u='https://api.github.com/repos/'+repo+'/contents/v4/'+path+'?ref='+id;
 const r=await fetch(u,{headers:{Accept:'application/vnd.github.raw+json'}});if(!r.ok)throw Error('读取回放 '+r.status);
 return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
function lab(x){return x===true?'通过':x===false?'失败':x===null?'未知':'—'}
function add(t,v,p){const e=document.createElement(t);e.textContent=v;p.append(e);return e}
function table(){
 const f=$('search').value.trim().toLowerCase(),visible=rows.filter(r=>[r.episode,r.robot,r.method,r.track,r.status].join(' ').toLowerCase().includes(f));$('count').textContent=visible.length+' / '+rows.length+' 条记录';
 const t=$('table');t.replaceChildren();const h=t.createTHead().insertRow();
 for(const s of ['录像或任务','机器手','方法','状态','行为','物理','几何','接触','联合验证'])add('th',s,h);
 const b=t.createTBody();for(const r of visible){const tr=b.insertRow();tr.dataset.key=r.id;tr.setAttribute('aria-selected',r===row);[r.episode,r.robot,r.method,r.status,...['S_behavior','Q_phys','Q_geom','C_native','J_validated'].map(k=>lab(r.score?.[k]))].forEach(v=>add('td',v||'—',tr));tr.onclick=()=>show(r)}
}
function pose(v,t){const [x,y,z,w]=t.slice(3),[a,b,c]=v,k=2*(y*c-z*b),l=2*(z*a-x*c),m=2*(x*b-y*a);return [t[0]+a+w*k+y*m-z*l,t[1]+b+w*l+z*k-x*m,t[2]+c+w*m+x*l-y*k]}
function proj(v){const c=data.center,[a,b,e]=v.map((x,i)=>x-c[i]),co=Math.cos(camera.yaw),si=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),h=si*a+co*b,s=Math.min(cn.width,cn.height)*2.8*camera.scale;return [cn.width/2+s*(co*a-si*b)+camera.px,cn.height/2-s*(cp*e-sp*h)+camera.py,cp*h+sp*e]}
function draw(){
 if(!data||!parts)return;const k=frame,tx=data.trans[k],fs=[];ctx.fillStyle='#e4eae5';ctx.fillRect(0,0,cn.width,cn.height);
 for(const part of parts){const vs=part.v.map(v=>proj(pose(v,tx[part.b])));for(const f of part.f){const a=vs[f[0]],b=vs[f[1]],c=vs[f[2]];if(!a||!b||!c)continue;
 const dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],norm=Math.abs(dx*ey-dy*ex)/(Math.hypot(dx,dy)*Math.hypot(ex,ey)+1e-8);
 const shade=.68+.32*norm, rgb=part.k==='object'?[221,145,78]:part.k==='hand'?[53,133,138]:[164,170,156];fs.push([(a[2]+b[2]+c[2])/3,a,b,c,'rgb('+rgb.map(x=>Math.round(x*shade)).join(',')+')'])}}
 fs.sort((a,b)=>b[0]-a[0]);for(const [,a,b,c,color] of fs){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.5;ctx.stroke()}
 function dot(v,color,r){const [x,y]=proj(v);ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill()}
 if($('hand').checked && data.source?.joints?.[k]){let j=data.source.joints[k];ctx.lineWidth=2;ctx.strokeStyle='#5744ae';for(const chain of [[5,6,7,0],[5,8,9,10,1],[5,11,12,13,2],[5,14,15,16,3],[5,17,18,19,4]]){ctx.beginPath();chain.forEach((i,n)=>{const [x,y]=proj(j[i]);n?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}}
 if($('points').checked)for(const v of data.target[k])dot(v,'#4634a1',2.7);
 if($('sourceobject').checked && data.source?.object_T?.[k]){const t=data.source.object_T[k];ctx.strokeStyle='#854a9e';ctx.lineWidth=.8;
 for(const part of parts.filter(a=>a.k==='object')){const vs=part.v.map(v=>proj(t.slice(0,3).map(r=>r[3]+r[0]*v[0]+r[1]*v[1]+r[2]*v[2])));ctx.beginPath();for(const [i,j,l] of part.f){ctx.moveTo(...vs[i].slice(0,2));ctx.lineTo(...vs[j].slice(0,2));ctx.lineTo(...vs[l].slice(0,2));}ctx.stroke()}}
 const marks=data.witness[k];if($('forces').checked)for(const v of marks){const col={matched:'#0b9a29',wrong:'#d52d1f',unknown:'#afa124',unmapped:'#313131'}[v[4]];
 dot(v.slice(0,3),col,Math.min(9,3+Math.sqrt(v[3])));if(v[8]){const f=v[8],sc=.025/Math.max(1,Math.hypot(...f)),a=proj(v.slice(0,3)),b=proj(v.slice(0,3).map((x,i)=>x+sc*f[i]));
 const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);for(const h of [-.55,.55]){ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-5*Math.cos(angle+h),b[1]-5*Math.sin(angle+h))}ctx.stroke()}}
 const top=marks.reduce((m,v)=>!m||m[3]<v[3]?v:m,null);$('witness').textContent=top?'此帧最大受力点 '+top[3]+' N · '+top[5]+' · 实际手面 '+(top[6]?.join(', ')||'未知')+' · 最近相容源手面 '+(top[7]?.join(', ')||'未知')+'。绿色为双位置容差内，红色为偏离，黄色为源参考未知，黑色为映射缺失。':'此帧没有已记录的正向受力点。';
 $('frame').value=k;$('clock').textContent=data.t[k].toFixed(3)+' 秒'+(data.source?.ids?' · 源帧 '+data.source.ids[k]:'');
}
function sync(k,video=true){frame=Math.max(0,Math.min(data.t.length-1,k));draw();if(video&&row.stereo&&!playing&&Number.isFinite($('stereo').duration))$('stereo').currentTime=data.t[frame]}
function tick(t){if(!playing||!data)return;const time=(t-clocktime)/1000;while(frame+1<data.t.length&&data.t[frame+1]<=time)frame++;draw();if(frame+1==data.t.length){stop();return}requestAnimationFrame(tick)}
function stop(){playing=false;$('play').textContent='播放';$('stereo').pause()}
function reset(){Object.assign(camera,{yaw:.55,pitch:-.23,scale:1,px:0,py:0});draw()}
$('frame').oninput=()=>{stop();sync(+$('frame').value)};$('play').onclick=()=>{if(playing){stop();return}if(frame===data.t.length-1)sync(0);playing=true;clocktime=performance.now()-data.t[frame]*1000;$('play').textContent='暂停';if(row.stereo){$('stereo').currentTime=data.t[frame];$('stereo').play().catch(()=>{})}requestAnimationFrame(tick)};
for(const k of ['hand','points','forces','sourceobject'])$(k).onchange=draw;
function zoom(v){camera.scale=Math.max(.15,Math.min(16,camera.scale*v));draw()}
$('reset').onclick=reset;$('zoomin').onclick=()=>zoom(1.3);$('zoomout').onclick=()=>zoom(1/1.3);$('full').onclick=()=>cn.requestFullscreen();
let old=null;cn.onpointerdown=e=>{old=[e.clientX,e.clientY,e.shiftKey||e.button!==0];cn.setPointerCapture(e.pointerId)};cn.onpointermove=e=>{if(!old)return;const dx=e.clientX-old[0],dy=e.clientY-old[1];if(old[2]){camera.px+=dx*cn.width/cn.clientWidth;camera.py+=dy*cn.height/cn.clientHeight}else{camera.yaw+=dx*.009;camera.pitch=Math.min(1.55,Math.max(-1.55,camera.pitch+dy*.009))}old=[e.clientX,e.clientY,old[2]];draw()};cn.onpointerup=cn.onpointercancel=()=>old=null;cn.oncontextmenu=e=>e.preventDefault();cn.onwheel=e=>{e.preventDefault();zoom(Math.exp(-Math.sign(e.deltaY)*.15))};cn.addEventListener('wheel',()=>{},{passive:false});
function link(label,url){const a=add('a',label,$('links'));a.href=new URL(url,base);$('links').append('　')}
async function show(r){
 const id=++seq;row=r;stop();data=null;parts=null;$('player').hidden=true;$('case').textContent=[r.episode,r.robot,r.method].filter(Boolean).join(' · ');$('links').replaceChildren();$('status').textContent='';$('notes').value=saved[r.id]||'';$('evidence').textContent=JSON.stringify(r.score||r.evidence||r,null,2);
 table();if(r.reference)link('同源既有回放',r.reference);if(r.archive)link('观看这条原始回放',r.archive);if(r.detail)link('下载逐项数据',r.detail);if(r.stereo)link('打开去畸变双目视频',r.stereo);if(!r.media)return;
 $('status').textContent='正在读取原生回放…';try{const v=await media(r.media),g=await media(v.geom);if(seq!==id)return;data=v;parts=g;frame=0;$('frame').max=data.t.length-1;$('player').hidden=false;$('stereobox').hidden=!r.stereo;if(r.stereo)$('stereo').src=new URL(r.stereo,base);else $('stereo').removeAttribute('src');$('status').textContent='';reset()}catch(e){if(seq===id)$('status').textContent='回放读取失败 '+e}
}
let archivalScores;
$('details').ontoggle=async()=>{if(!$('details').open || doc?.round!=='R0')return;const active=row;try{archivalScores??=get(new URL('r0-full.json.gz',base),true);const grades=await archivalScores;if(row===active)$('evidence').textContent=JSON.stringify({...active.score,...grades[active.id]},null,2)}catch(e){$('status').textContent='逐条证据读取失败 '+e}};
function currentfile(){return new URL('rounds/'+doc.round+'/manifest.json',base)}
async function init(){
 const list=await get(new URL('rounds.json',base));for(const r of list.rounds)$('round').add(new Option(r,r));
 const r=location.pathname.match(/\/rounds\/(R[\w-]+)/)?.[1]||q.get('round')||list.latest;$('round').value=r;$('round').onchange=()=>location.assign(new URL('rounds/'+$('round').value+'/',base));
 try{doc=await get(new URL('rounds/'+r+'/manifest.json.gz',base),true)}catch(e){doc=await get(new URL('rounds/'+r+'/manifest.json',base))};rows=doc.rows;$('heading').textContent=r+' · '+doc.title;$('intro').replaceChildren();for(const p of doc.summary)add('p',p,$('intro'));
 const applicable=rows.filter(x=>x.score && Object.hasOwn(x.score,'J_validated'));if(applicable.length){const m=document.createElement('table'),h=m.createTHead().insertRow();for(const t of ['指标','通过','失败','未知','有该项判定的记录'])add('th',t,h);
 for(const [k,label] of [['S_behavior','任务行为'],['Q_phys','运行物理'],['Q_geom','场景几何'],['C_native','原生接触'],['J_validated','联合验证']]){const vals=applicable.filter(x=>Object.hasOwn(x.score,k)).map(x=>x.score[k]),tr=m.insertRow();for(const v of [label,vals.filter(x=>x===true).length,vals.filter(x=>x===false).length,vals.filter(x=>x===null).length,vals.length])add('td',v,tr)}$('intro').append(m)}$('download').href=currentfile();
 $('search').oninput=table;const preferred=rows.find(x=>x.id===q.get('row'))||rows.find(x=>x.media)||rows[0];if(preferred)await show(preferred)
}
$('save').onclick=()=>{saved[row.id]=$('notes').value;localStorage.setItem('egowm-v4-notes',JSON.stringify(saved))};$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)]));a.download='v4-review.json';a.click()};$('import').onchange=async e=>{const x=JSON.parse(await e.target.files[0].text());for(const [k,v] of Object.entries(x))if(typeof v==='string')saved[k]=v;localStorage.setItem('egowm-v4-notes',JSON.stringify(saved));$('notes').value=saved[row.id]||''};
init().catch(e=>$('status').textContent=String(e));
