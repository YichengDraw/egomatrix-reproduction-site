'use strict';
const $=x=>document.getElementById(x), base=new URL('./',document.currentScript.src), q=new URLSearchParams(location.search);
if($('contents'))$('contents').href=new URL('research.html',base);$('models').href=new URL('assets.html',base);$('prior').href=new URL('../gtcontact-stereo-v3/research-summary.html',base);
let pageNumber=0;let graphs=null,overlay=null,comparison=null;
let doc,rows=[],row,seq=0,data,parts,frame=0,playing=false,clocktime=0,saved=JSON.parse(localStorage.getItem('egowm-v4-notes')||'{}');
const camera={yaw:.5,pitch:-.24,scale:1,px:0,py:0},cn=$('scene'),ctx=cn.getContext('2d');
async function get(url,zip=false){
 const r=await fetch(url,{signal:AbortSignal.timeout(17000)});if(!r.ok)throw Error(r.status+' '+url);
 return zip?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json():r.json();
}
function external(path){if(doc.local_media?.includes(path)||!doc.media_commit)return new URL('media/'+path,base).href;
 return 'https://cdn.jsdelivr.net/gh/YichengDraw/egomatrix-reproduction-site@'+doc.media_commit+'/v4/'+path}
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
 const f=$('search').value.trim().toLowerCase(),visible=rows.filter(r=>[r.episode,r.robot,r.method,r.track,r.status,r.parent,r.seed,r.physics_dt].join(' ').toLowerCase().includes(f));$('count').textContent=visible.length+' / '+rows.length+' 条记录';
 const paged=visible.length>900,limit=100,pages=Math.ceil(visible.length/limit);
 if($('paging')){$('paging').hidden=!paged;pageNumber=Math.max(0,Math.min(pageNumber,pages-1));$('pagenum').textContent=(pageNumber+1)+' / '+pages;$('prevpage').disabled=!pageNumber;$('nextpage').disabled=pageNumber+1>=pages}
 const shown=paged?visible.slice(pageNumber*limit,(pageNumber+1)*limit):visible;
 const t=$('table');t.replaceChildren();const h=t.createTHead().insertRow();
 for(const s of ['录像或任务','机器手','方法','组别','状态','行为','物理','几何','接触','联合验证'])add('th',s,h);
 const b=t.createTBody();for(const r of shown){const tr=b.insertRow();tr.dataset.key=r.id;tr.setAttribute('aria-selected',r===row);[r.episode,r.robot,r.method+(r.seed?' · '+r.seed:'')+(r.physics_dt?' · '+(1000*r.physics_dt)+' ms':''),r.track,r.status,...['S_behavior','Q_phys','Q_geom','C_native','J_validated'].map(k=>lab(r.score?.[k]))].forEach(v=>add('td',v||'—',tr));tr.onclick=()=>show(r)}
}
function pose(v,t){const [x,y,z,w]=t.slice(3),[a,b,c]=v,k=2*(y*c-z*b),l=2*(z*a-x*c),m=2*(x*b-y*a);return [t[0]+a+w*k+y*m-z*l,t[1]+b+w*l+z*k-x*m,t[2]+c+w*m+x*l-y*k]}
function proj(v){const c=data.center,[a,b,e]=v.map((x,i)=>x-c[i]),co=Math.cos(camera.yaw),si=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),h=si*a+co*b,s=Math.min(cn.width,cn.height)*2.8*camera.scale;return [cn.width/2+s*(co*a-si*b)+camera.px,cn.height/2-s*(cp*e-sp*h)+camera.py,cp*h+sp*e]}
const palette={matched:'#098848',wrong:'#c63728',unknown:'#b18912',unmapped:'#42484c'};
function graphData(){const classes=Object.keys(palette),heat={};const force=data.witness.map(ws=>{const a=[0,0,0,0];for(const v of ws){const i=classes.indexOf(v[4]);if(i>=0)a[i]+=v[3];if(!v[6])continue;const bins=heat[v[5]]??=new Float64Array(24*24),x=Math.max(0,Math.min(23,Math.floor(v[6][0]*24))),y=Math.max(0,Math.min(23,Math.floor(v[6][1]*24)));bins[x+24*y]+=v[3]}return a});graphs={force,heat,classes,peak:Math.max(1,...force.flat())}}
function paintGraphs(k,marks,top){if(!$('historyplot')||!$('uvplot'))return;if(!graphs)graphData();
 const c=$('historyplot'),a=c.getContext('2d'),w=c.width,h=c.height,t=data.t,end=Math.max(t.at(-1),.001),x=time=>50+(w-63)*time/end,y=N=>h-32-(h-55)*N/graphs.peak;
 a.fillStyle='#fbfbf7';a.fillRect(0,0,w,h);a.strokeStyle='#949d94';a.beginPath();a.moveTo(50,18);a.lineTo(50,h-32);a.lineTo(w-12,h-32);a.stroke();a.font='14px system-ui';a.fillStyle='#29453c';a.fillText(graphs.peak.toFixed(1)+' N',3,21);a.fillText('0',28,h-32);a.fillText('0 s',45,h-7);a.fillText(end.toFixed(2)+' s',w-60,h-7);
 graphs.classes.forEach((v,j)=>{a.strokeStyle=palette[v];a.lineWidth=2;a.beginPath();graphs.force.forEach((r,i)=>i?a.lineTo(x(t[i]),y(r[j])):a.moveTo(x(t[i]),y(r[j])));a.stroke()});a.strokeStyle='#876abc';a.beginPath();a.moveTo(x(t[k]),15);a.lineTo(x(t[k]),h-32);a.stroke();
 const b=$('uvplot'),g=b.getContext('2d');g.fillStyle='#fbfbf7';g.fillRect(0,0,b.width,b.height);
 const region=top?.[5]||Object.keys(graphs.heat)[0],bin=graphs.heat[region];g.font='16px system-ui';g.fillStyle='#29453c';g.fillText(region||'缺少已映射触点',25,33);if(!bin)return;
 const size=155,x0=b.width/2-size/2,y0=24,step=size/24;let max=Math.max(...bin);for(let j=0;j<24;j++)for(let i=0;i<24;i++){const v=Math.log1p(bin[i+j*24])/Math.log1p(max||1);g.fillStyle='rgba(20,115,115,'+(.08+.8*v)+')';g.fillRect(x0+i*step,y0+(23-j)*step,step+.5,step+.5)}
 g.strokeStyle='#586b63';g.strokeRect(x0,y0,size,size);g.fillStyle='#29453c';g.fillText('u',x0+size+6,y0+size);g.fillText('v',x0-15,y0);for(const v of marks){if(v[5]!==region)continue;if(v[6]){g.fillStyle=palette[v[4]];g.beginPath();g.arc(x0+v[6][0]*size,y0+(1-v[6][1])*size,3.5,0,2*Math.PI);g.fill()}if(v[7]){g.strokeStyle='#6a4696';g.lineWidth=1.6;g.strokeRect(x0+v[7][0]*size-3,y0+(1-v[7][1])*size-3,6,6)}}}
if($('historyplot'))$('historyplot').onclick=e=>{if(!data)return;const r=e.target.getBoundingClientRect(),p=((e.clientX-r.left)*e.target.width/r.width-50)/(e.target.width-63),t=data.t.at(-1)*p;stop();sync(data.t.reduce((i,v,j)=>Math.abs(v-t)<Math.abs(data.t[i]-t)?j:i,0))};
function draw(){
 if(!data||!parts)return;const k=frame,tx=data.trans[k],fs=[];ctx.fillStyle='#e4eae5';ctx.fillRect(0,0,cn.width,cn.height);
 for(const part of parts){const vs=part.v.map(v=>proj(pose(v,tx[part.b])));for(const f of part.f){const a=vs[f[0]],b=vs[f[1]],c=vs[f[2]];if(!a||!b||!c)continue;
 const dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],norm=Math.abs(dx*ey-dy*ex)/(Math.hypot(dx,dy)*Math.hypot(ex,ey)+1e-8);
 const shade=.68+.32*norm, rgb=part.k==='object'?[221,145,78]:part.k==='hand'?[53,133,138]:[164,170,156];fs.push([(a[2]+b[2]+c[2])/3,a,b,c,'rgb('+rgb.map(x=>Math.round(x*shade)).join(',')+')'])}}
 fs.sort((a,b)=>b[0]-a[0]);for(const [,a,b,c,color] of fs){ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=.5;ctx.stroke()}
 function dot(v,color,r){const [x,y]=proj(v);ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill()}
 if($('hand').checked && data.source?.joints?.[k]){let j=data.source.joints[k];ctx.lineWidth=2;ctx.strokeStyle='#5744ae';for(const chain of [[5,6,7,0],[5,8,9,10,1],[5,11,12,13,2],[5,14,15,16,3],[5,17,18,19,4]]){ctx.beginPath();chain.forEach((i,n)=>{const [x,y]=proj(j[i]);n?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}}
 if($('points').checked)for(const v of data.target[k])dot(v,'#4634a1',2.7);
 if($('sourceobject')?.checked && data.source?.object_T?.[k]){const t=data.source.object_T[k];ctx.strokeStyle='#854a9e';ctx.lineWidth=.8;
 for(const part of parts.filter(a=>a.k==='object')){const vs=part.v.map(v=>proj(t.slice(0,3).map(r=>r[3]+r[0]*v[0]+r[1]*v[1]+r[2]*v[2])));ctx.beginPath();for(const [i,j,l] of part.f){ctx.moveTo(...vs[i].slice(0,2));ctx.lineTo(...vs[j].slice(0,2));ctx.lineTo(...vs[l].slice(0,2));}ctx.stroke()}}
 if($('compare')?.checked && overlay){const b=overlay.data;let i=0;while(i+1<b.t.length&&b.t[i+1]<=data.t[k])i++;ctx.strokeStyle='rgba(116,56,113,.43)';ctx.lineWidth=.8;
 for(const part of overlay.parts.filter(x=>x.k==='object'||x.k==='hand')){const verts=part.v.map(v=>proj(pose(v,b.trans[i][part.b])));ctx.beginPath();for(const [a,j,l] of part.f){ctx.moveTo(...verts[a].slice(0,2));ctx.lineTo(...verts[j].slice(0,2));ctx.lineTo(...verts[l].slice(0,2))}ctx.stroke()}}
 const marks=data.witness[k];if($('forces').checked)for(const v of marks){const col={matched:'#0b9a29',wrong:'#d52d1f',unknown:'#afa124',unmapped:'#313131'}[v[4]];
 dot(v.slice(0,3),col,Math.min(9,3+Math.sqrt(v[3])));if(v[8]){const f=v[8],sc=.025/Math.max(1,Math.hypot(...f)),a=proj(v.slice(0,3)),b=proj(v.slice(0,3).map((x,i)=>x+sc*f[i]));
 const angle=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);for(const h of [-.55,.55]){ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-5*Math.cos(angle+h),b[1]-5*Math.sin(angle+h))}ctx.stroke()}}
 const top=marks.reduce((m,v)=>!m||m[3]<v[3]?v:m,null);$('witness').textContent=top?'此帧最大受力点 '+top[3]+' N · '+top[5]+' · 实际手面 '+(top[6]?.join(', ')||'未知')+' · 最近相容源手面 '+(top[7]?.join(', ')||'未知')+'。绿色为双位置容差内，红色为偏离，黄色为源参考未知，黑色为映射缺失。':'此帧没有已记录的正向受力点。';
 paintGraphs(k,marks,top);$('frame').value=k;$('clock').textContent=data.t[k].toFixed(3)+' 秒'+(data.source?.ids?' · 源帧 '+data.source.ids[k]:'');
}
function sync(k,video=true){frame=Math.max(0,Math.min(data.t.length-1,k));draw();if(video&&row.stereo&&!playing&&Number.isFinite($('stereo').duration))$('stereo').currentTime=data.t[frame]}
function tick(t){if(!playing||!data)return;const time=(t-clocktime)/1000;while(frame+1<data.t.length&&data.t[frame+1]<=time)frame++;draw();if(frame+1==data.t.length){stop();return}requestAnimationFrame(tick)}
function stop(){playing=false;$('play').textContent='播放';$('stereo').pause()}
function reset(){Object.assign(camera,{yaw:.55,pitch:-.23,scale:1,px:0,py:0});draw()}
$('frame').oninput=()=>{stop();sync(+$('frame').value)};$('play').onclick=()=>{if(playing){stop();return}if(frame===data.t.length-1)sync(0);playing=true;clocktime=performance.now()-data.t[frame]*1000;$('play').textContent='暂停';if(row.stereo){$('stereo').currentTime=data.t[frame];$('stereo').play().catch(()=>{})}requestAnimationFrame(tick)};
for(const k of ['hand','points','forces','sourceobject']){if($(k))$(k).onchange=draw};
function zoom(v){camera.scale=Math.max(.15,Math.min(16,camera.scale*v));draw()}
$('reset').onclick=reset;$('zoomin').onclick=()=>zoom(1.3);$('zoomout').onclick=()=>zoom(1/1.3);$('full').onclick=()=>cn.requestFullscreen();
let old=null;cn.onpointerdown=e=>{old=[e.clientX,e.clientY,e.shiftKey||e.button!==0];cn.setPointerCapture(e.pointerId)};cn.onpointermove=e=>{if(!old)return;const dx=e.clientX-old[0],dy=e.clientY-old[1];if(old[2]){camera.px+=dx*cn.width/cn.clientWidth;camera.py+=dy*cn.height/cn.clientHeight}else{camera.yaw+=dx*.009;camera.pitch=Math.min(1.55,Math.max(-1.55,camera.pitch+dy*.009))}old=[e.clientX,e.clientY,old[2]];draw()};cn.onpointerup=cn.onpointercancel=()=>old=null;cn.oncontextmenu=e=>e.preventDefault();cn.onwheel=e=>{e.preventDefault();zoom(Math.exp(-Math.sign(e.deltaY)*.15))};cn.addEventListener('wheel',()=>{},{passive:false});
if($('compare'))$('compare').onchange=async()=>{const active=row;try{if($('compare').checked && comparison && !overlay){const v=await media(comparison.media),p=await media(v.geom);if(row!==active)return;overlay={data:v,parts:p}}draw()}catch(e){$('status').textContent='配对回放读取失败 '+e}};
function link(label,url){const a=add('a',label,$('links'));a.href=new URL(url,base);$('links').append('　')}
async function show(r){
 const id=++seq;row=r;stop();graphs=null;overlay=null;comparison=rows.find(a=>a.id===r.compareTo);
 if(!comparison && doc.round==='R3')comparison=rows.find(a=>a.episode===r.episode&&a.robot===r.robot&&a.method==='old_init · '+r.method.split(' · ').pop()&&a.id!==r.id);
 if($('comparebox'))$('comparebox').hidden=!comparison;if($('compare'))$('compare').checked=false;data=null;parts=null;$('player').hidden=true;$('case').textContent=[r.episode,r.robot,r.method].filter(Boolean).join(' · ');$('links').replaceChildren();$('status').textContent='';$('notes').value=saved[r.id]||'';$('evidence').textContent=JSON.stringify(r.score||r.evidence||r,null,2);
 if(r.stereoMedia)r.stereo=external(r.stereoMedia);table();if(r.review)link('逐帧查看双目、单目与时序预测',r.review);if(r.reference)link('同源既有回放',r.reference);if(r.archive)link('观看这条原始回放',r.archive);if(r.detail)link('下载逐项数据',r.detail);if(r.stereo)link('打开去畸变双目视频',r.stereo);if(!r.media)return;
 $('status').textContent='正在读取原生回放…';try{const v=await media(r.media),g=await media(v.geom);if(seq!==id)return;data=v;parts=g;frame=0;$('frame').max=data.t.length-1;$('player').hidden=false;$('stereobox').hidden=!r.stereo;if(r.stereo)$('stereo').src=new URL(r.stereo,base);else $('stereo').removeAttribute('src');$('status').textContent='';reset()}catch(e){if(seq===id)$('status').textContent='回放读取失败 '+e}
}
let archivalScores;
$('details').ontoggle=async()=>{if(!$('details').open)return;const active=row;if(active?.detailMedia){try{const grades=await media(active.detailMedia);if(row===active)$('evidence').textContent=JSON.stringify(grades[active.detailKey],null,2)}catch(e){$('status').textContent=String(e)}return}if(doc?.round!=='R0')return;try{archivalScores??=get(new URL('r0-full.json.gz',base),true);const grades=await archivalScores;if(row===active)$('evidence').textContent=JSON.stringify({...active.score,...grades[active.id]},null,2)}catch(e){$('status').textContent='逐条证据读取失败 '+e}};
function currentfile(){return new URL('rounds/'+doc.round+'/manifest.json',base)}
async function init(){
 const list=await get(new URL('rounds.json',base));for(const r of list.rounds)$('round').add(new Option(r,r));
 const r=location.pathname.match(/\/rounds\/(R[\w-]+)/)?.[1]||q.get('round')||list.latest;$('round').value=r;$('round').onchange=()=>location.assign(new URL('rounds/'+$('round').value+'/',base));
 try{doc=await get(new URL('rounds/'+r+'/manifest.json.gz',base),true)}catch(e){doc=await get(new URL('rounds/'+r+'/manifest.json',base))};rows=doc.rows;$('heading').textContent=r+' · '+doc.title;$('intro').replaceChildren();for(const p of doc.summary)add('p',p,$('intro'));
 if(r==='R6'){const v=add('p','原登记中四条降低支撑面的回放在运行时移动了静态几何。更正版先从 XML 重新编译碰撞模型，再执行相同条件。',$('intro'));if(list.rounds.includes('R6-correction')){const l=add('a','查看更正和追加放置结果',v);l.href=new URL('rounds/R6-correction/',base)}}
 if(r==='R1'&&list.rounds.includes('R1-followup')){const p=add('p','原登记之外的放置修复另表报告。',$('intro'));add('a','查看追加放置回放',p).href=new URL('rounds/R1-followup/',base)}
 const applicable=rows.filter(x=>x.score && Object.hasOwn(x.score,'J_validated'));if(applicable.length){const m=document.createElement('table'),h=m.createTHead().insertRow();for(const t of ['指标','通过','失败','未知','有该项判定的记录'])add('th',t,h);
 for(const [k,label] of [['S_behavior','任务行为'],['Q_phys','运行物理'],['Q_geom','场景几何'],['C_native','原生接触'],['J_validated','联合验证']]){const vals=applicable.filter(x=>Object.hasOwn(x.score,k)).map(x=>x.score[k]),tr=m.insertRow();for(const v of [label,vals.filter(x=>x===true).length,vals.filter(x=>x===false).length,vals.filter(x=>x===null).length,vals.length])add('td',v,tr)}$('intro').append(m)}$('download').href=currentfile();
 $('search').oninput=()=>{pageNumber=0;table()};if($('paging')){$('prevpage').onclick=()=>{pageNumber--;table()};$('nextpage').onclick=()=>{pageNumber++;table()}};const preferred=rows.find(x=>x.id===q.get('row'))||rows.find(x=>x.media)||rows[0];if(preferred)await show(preferred)
}
$('save').onclick=()=>{saved[row.id]=$('notes').value;localStorage.setItem('egowm-v4-notes',JSON.stringify(saved))};$('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)]));a.download='v4-review.json';a.click()};$('import').onchange=async e=>{const x=JSON.parse(await e.target.files[0].text());for(const [k,v] of Object.entries(x))if(typeof v==='string')saved[k]=v;localStorage.setItem('egowm-v4-notes',JSON.stringify(saved));$('notes').value=saved[row.id]||''};
init().catch(e=>$('status').textContent=String(e));
