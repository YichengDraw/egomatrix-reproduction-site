import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $=id=>document.getElementById(id);
const LABEL={
 A1:'A1 · Reconstruction',Scene:'Scene · Original teacher',A2:'A2 · Original DP',A3:'A3 · Original candidate',
 Scene_aligned_teacher_v1:'Scene · Aligned depth',A2_aligned_teacher_v1:'A2 · Aligned depth',
 A3_aligned_teacher_v1:'A3 · Aligned + fixed objects',A3_paper_fixed_objects_v1:'A3 · Paper-fixed object'
};
const ORDER=['A1','Scene','A2','A3','Scene_aligned_teacher_v1','A2_aligned_teacher_v1','A3_paper_fixed_objects_v1','A3_aligned_teacher_v1'];
const METRICS={
 stir:{A1:[95.019,360.878,.699,96.780],Scene:[83.703,380.258,.878,93.448],A2:[76.561,306.036,.306,97.790],A3:[76.561,242.448,1.184,83.515],Scene_aligned_teacher_v1:[85.525,376.025,.981,92.736],A2_aligned_teacher_v1:[75.733,308.037,.374,98.836],A3_aligned_teacher_v1:[76.061,239.406,1.270,83.375]},
 cut:{A1:[65.315,295.811,4.426,82.838],Scene:[76.500,303.446,5.413,80.031],A2:[40.524,275.321,.220,87.619],A3:[40.201,212.841,1.362,71.471],A3_paper_fixed_objects_v1:[41.113,232.982,1.422,69.839],Scene_aligned_teacher_v1:[78.513,309.546,5.438,80.066],A2_aligned_teacher_v1:[39.900,262.018,.213,92.060],A3_aligned_teacher_v1:[40.457,227.961,1.703,74.027]},
 brush:{A1:[40.587,393.941,1.551,83.299],Scene:[29.742,409.188,1.413,79.883],A2:[27.482,278.201,.470,80.940],A3:[26.630,199.590,1.062,63.817],Scene_aligned_teacher_v1:[29.783,402.059,1.424,77.824],A2_aligned_teacher_v1:[26.200,276.739,.435,83.053],A3_aligned_teacher_v1:[25.205,205.187,1.101,68.082]},
 brush260:{A1:[null,null,.662,91.745],Scene:[null,null,null,null],A2:[null,null,.826,67.999],A3:[null,null,1.329,55.439]}
};
const VIDEO_LABELS={baseline:'原始 A1 / Scene / A2 / A3',aligned:'Aligned teacher · 完整对照',fixed:'Paper-fixed objects · A3 对照'};
const fmt=(v,d=2)=>v==null||!Number.isFinite(v)?'N/A':v.toFixed(d);
const timeFormat=s=>'00:'+Math.max(0,s).toFixed(2).padStart(5,'0');
let catalog=null,currentCase=null,currentStage=null,stageData=null,caseToken=0,stageToken=0;
let frame=0,playing=false,speed=1,dirty=true,threeReady=false,lastTime=0;
let scene,renderer,camera,orbit,world,grid,leftHand,rightHand,meshes=[],objects=[],canvasWrap;
let viewTarget=new THREE.Vector3(),viewDist=.8;
const cvToGl=new THREE.Matrix4().set(1,0,0,0,0,-1,0,0,0,0,-1,0,0,0,0,1);
const matA=new THREE.Matrix4(),matB=new THREE.Matrix4(),pA=new THREE.Vector3(),pB=new THREE.Vector3(),qA=new THREE.Quaternion(),qB=new THREE.Quaternion(),sA=new THREE.Vector3(),sB=new THREE.Vector3();
async function getJson(u){const r=await fetch(u);if(!r.ok)throw Error(u+' HTTP '+r.status);return r.json();}
async function getBinary(u,Type){const r=await fetch(u);if(!r.ok)throw Error(u+' HTTP '+r.status);return new Type(await r.arrayBuffer());}
function loading(text){$('sceneLoading').classList.remove('hidden');$('sceneLoading').textContent=text;}
function doneLoading(){$('sceneLoading').classList.add('hidden');}
function initializeThree(){
 const canvas=$('sceneCanvas');canvasWrap=canvas.parentElement;
 scene=new THREE.Scene();scene.background=new THREE.Color('#0d1715');scene.fog=new THREE.Fog('#0d1715',3,8);
 camera=new THREE.PerspectiveCamera(45,1,.005,30);camera.up.set(0,0,1);
 world=new THREE.Group();scene.add(world);
 scene.add(new THREE.HemisphereLight(0xf2fff6,0x52675f,2));
 const key=new THREE.DirectionalLight(0xf6ffe3,3.1);key.position.set(1,-2,3);scene.add(key);
 const fill=new THREE.DirectionalLight(0xa5d3ff,1.25);fill.position.set(-2,1,1);scene.add(fill);
 grid=new THREE.GridHelper(2.5,25,0x5c8568,0x2b4137);grid.rotation.x=Math.PI/2;grid.material.transparent=true;grid.material.opacity=.4;scene.add(grid);
 renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,powerPreference:'low-power'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8));
 orbit=new OrbitControls(camera,canvas);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=.14;orbit.maxDistance=6;
 const resize=()=>{const w=Math.max(100,canvasWrap.clientWidth),h=Math.max(100,canvasWrap.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 resize();new ResizeObserver(resize).observe(canvasWrap);threeReady=true;
}
function disposeAll(){
 for(const m of meshes){world.remove(m);m.geometry.dispose();m.material.dispose();}
 meshes=[];objects=[];leftHand=null;rightHand=null;stageData=null;
}
function resetView(){
 if(!currentCase||!threeReady)return;
 $('toggleCamera').checked=false;orbit.enabled=true;
 const c=currentCase.center;viewTarget.set(c[0],c[1],c[2]);viewDist=Math.max(.65,currentCase.span*1.55);
 orbit.target.copy(viewTarget);camera.up.set(0,0,1);camera.position.set(c[0]+viewDist*.68,c[1]-viewDist*1.1,c[2]+viewDist*.78);
 camera.fov=45;camera.near=.005;camera.far=30;camera.updateProjectionMatrix();orbit.update();
}
function applyVisibility(){
 if(leftHand)leftHand.visible=$('toggleHands').checked;
 if(rightHand)rightHand.visible=$('toggleHands').checked;
 for(const obj of objects)obj.visible=$('toggleObjects').checked;
 if(grid)grid.visible=$('toggleGrid').checked;
 if(orbit)orbit.enabled=!$('toggleCamera').checked;
}
async function loadMesh(c,token){
 if(!threeReady)return;
 loading('正在读取原生三维网格…');
 const req=[getBinary(c.handFaces,Uint16Array)];
 c.objects.forEach(o=>{req.push(getBinary(o.vertices,Float32Array),getBinary(o.faces,Uint32Array));});
 const buffers=await Promise.all(req);
 if(token!==caseToken)return;
 disposeAll();const f=buffers[0];
 const handList=[];
 for(let i=0;i<2;i++){
  const geometry=new THREE.BufferGeometry();
  const position=new THREE.BufferAttribute(new Float32Array(778*3),3);position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',position);
  geometry.setIndex(new THREE.BufferAttribute(f.slice(i*1538*3,(i+1)*1538*3),1));
  const material=new THREE.MeshStandardMaterial({color:i===0?0x8bdcaa:0xe9bca0,metalness:.04,roughness:.7,side:THREE.DoubleSide,transparent:true,opacity:.96});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name=i===0?'Left MANO hand':'Right MANO hand';
  world.add(mesh);meshes.push(mesh);handList.push(mesh);
 }
 leftHand=handList[0];rightHand=handList[1];
 c.objects.forEach((o,i)=>{
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(buffers[1+2*i],3));
  geom.setIndex(new THREE.BufferAttribute(buffers[2+2*i],1));geom.computeVertexNormals();
  const palette=[0xb9ddc9,0xf1c47e,0xb1c4d9];
  const mat=new THREE.MeshStandardMaterial({color:palette[i%3],metalness:.05,roughness:.67,side:THREE.DoubleSide,transparent:true,opacity:.93});
  const mesh=new THREE.Mesh(geom,mat);mesh.name='Object '+o.id;
  world.add(mesh);meshes.push(mesh);objects.push(mesh);
 });
 grid.position.set(c.center[0],c.center[1],c.center[2]-c.span*.27);
 resetView();applyVisibility();
}
function matrixAt(matrix,src,offset){matrix.set(...src.subarray(offset,offset+16));}
function sampleIndices(f,ids){
 let a=0,b=ids.length-1;
 while(a<b){const m=Math.floor((a+b+1)/2);if(ids[m]<=f)a=m;else b=m-1;}
 const next=Math.min(a+1,ids.length-1);
 return [a,next,a===next?0:Math.max(0,Math.min(1,(f-ids[a])/(ids[next]-ids[a])))];
}
function updateThree(){
 if(!stageData||!leftHand)return;
 const d=stageData,[a,b,w]=sampleIndices(frame,d.meta.frameIds);
 const lo=d.meta.handQuantMin,sc=d.meta.handQuantScale;
 for(let h=0;h<2;h++){
  const mesh=h===0?leftHand:rightHand,pos=mesh.geometry.attributes.position.array;
  const ia=(a*2+h)*778*3,ib=(b*2+h)*778*3;
  for(let k=0;k<778*3;k++)pos[k]=lo[k%3]+(d.hands[ia+k]*(1-w)+d.hands[ib+k]*w)*sc[k%3];
  mesh.geometry.attributes.position.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.visible=$('toggleHands').checked&&Boolean(d.meta.handValid[a][h]||d.meta.handValid[b][h]);
 }
 const objCount=objects.length;
 for(let i=0;i<objCount;i++){
  matrixAt(matA,d.poses,(a*objCount+i)*16);matrixAt(matB,d.poses,(b*objCount+i)*16);
  matA.decompose(pA,qA,sA);matB.decompose(pB,qB,sB);
  objects[i].position.copy(pA).lerp(pB,w);
  objects[i].quaternion.copy(qA).slerp(qB,w);
  objects[i].scale.copy(sA).lerp(sB,w);
 }
 if($('toggleCamera').checked){
  matrixAt(matA,d.cameras,a*16);matA.multiply(cvToGl);
  matA.decompose(camera.position,camera.quaternion,sA);
  camera.fov=53;camera.updateProjectionMatrix();
 }
 dirty=false;
}
async function loadStage(stage){
 if(!currentCase?.stages[stage])return;
 const c=currentCase,token=++stageToken;currentStage=stage;
 $('stageSelect').value=stage;showMetrics();loading('正在载入 '+LABEL[stage]+' 轨迹…');
 try{
  const meta=await getJson(c.stages[stage].meta);
  const [hands,poses,cameras]=await Promise.all([
   getBinary(meta.hands,Uint16Array),getBinary(meta.poses,Float32Array),getBinary(meta.camera,Float32Array)
  ]);
  if(token!==stageToken||c!==currentCase)return;
  if(hands.length!==meta.frameCount*2*778*3||poses.length!==meta.frameCount*c.objects.length*16)throw Error('几何数据长度校验失败');
  stageData={meta:meta,hands:hands,poses:poses,cameras:cameras};dirty=true;updateThree();doneLoading();
 }catch(e){if(token===stageToken){console.error(e);$('sceneLoading').textContent='3D 读取失败：'+e.message;}}
}
function timelineUI(){
 if(!currentCase)return;
 const n=currentCase.n;
 $('timeLabel').innerHTML=timeFormat(frame/30)+' <span>/ '+timeFormat((n-1)/30)+'</span>';
 $('timeline').value=Math.round(frame);
 $('timeline').style.setProperty('--track-progress',(frame/(n-1)*100).toFixed(2)+'%');
 $('videoFrameDisplay').textContent='FRAME '+String(Math.floor(frame)+1).padStart(4,'0');
}
function scrub(f){
 if(!currentCase)return;frame=Math.max(0,Math.min(currentCase.n-1,f));dirty=true;
 const video=$('sourceVideo'),t=frame/30;
 if(video.readyState>=1&&Math.abs(video.currentTime-t)>.04)try{video.currentTime=t;}catch{}
 timelineUI();updateThree();
}
function togglePlay(){
 if(!currentCase)return;playing=!playing;
 $('playIcon').textContent=playing?'Ⅱ':'▶';
 if(playing){
  if(frame>=currentCase.n-1)scrub(0);
  const vid=$('sourceVideo');vid.playbackRate=speed;vid.play().catch(()=>{});
 }else $('sourceVideo').pause();
 lastTime=performance.now();
}
function showMetrics(){
 if(!currentCase)return;
 const all=METRICS[currentCase.id],m=all[currentStage]||all.A3||[null,null,null,null];
 const ids=['metricCD','metricSpeed','metricPen','metricSD'],units=['mm','mm/s','mm','mm'];
 ids.forEach((id,i)=>{$(id).innerHTML=fmt(m[i],i===2?3:2)+(m[i]==null?'':'<small>'+units[i]+'</small>');});
 const base=all.A1?.[1],v=m[1];
 $('metricSpeedDesc').textContent=base!=null&&v!=null?'同序列 A1 相比'+(v<=base?'下降 ':'增加 ')+Math.abs((1-v/base)*100).toFixed(1)+'%':'该序列无可靠对应 GT，动态指标 N/A';
 $('metricScope').textContent=currentCase.n+' frames / '+(currentCase.n-1)+' pairs · '+currentStage;
 $('metricFooter').textContent=currentCase.id==='brush260'?'该段原 RGB 260帧、标注262行，缺精确映射。GT动态/手物误差保留 N/A；仅评估预测物理。':'GT 仅离线评分。原候选、aligned teacher 和论文固定物体分支各自独立保留，不以 GT 选点。';
 const tbody=$('metricsTbody');tbody.replaceChildren();
 ORDER.filter(k=>currentCase.stages[k]).forEach(k=>{
  const values=all[k]||[null,null,null,null],tr=document.createElement('tr');
  if(k===currentStage)tr.classList.add('active-row');
  const title=document.createElement('td');title.textContent=LABEL[k].split(' · ')[0];
  const sub=document.createElement('small');sub.className='stage-meta';sub.textContent=LABEL[k].split(' · ').slice(1).join(' / ');title.appendChild(sub);tr.appendChild(title);
  values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=fmt(v,i===2?3:2);if(v==null)td.className='na';tr.appendChild(td);});
  tr.style.cursor='pointer';tr.addEventListener('click',()=>loadStage(k));tbody.appendChild(tr);
 });
}
function compareVideo(){
 if(!currentCase)return;
 const key=$('comparisonSelect').value,path=currentCase.videos?.[key]||currentCase.videos?.baseline;
 const video=$('comparisonVideo');video.pause();video.poster='assets/thumbs/'+currentCase.id+'.jpg';
 if(path){video.src=path;video.load();video.style.display='block';}
 else{video.removeAttribute('src');video.load();video.style.display='none';}
 $('comparisonCaption').textContent=currentCase.title+' · '+currentCase.n+' frames · '+(VIDEO_LABELS[key]||key)+' · 保存的同帧 30Hz 视频。';
}
async function selectCase(id,scroll){
 if(!catalog)return;
 const c=catalog.cases.find(x=>x.id===id);if(!c)return;
 playing=false;$('playIcon').textContent='▶';$('sourceVideo').pause();
 const token=++caseToken;stageToken++;currentCase=c;stageData=null;frame=0;
 document.querySelectorAll('[data-case]').forEach(e=>e.classList.toggle('active',e.dataset.case===id));
 $('activeSequence').textContent=c.title;
 $('activeSequenceMeta').textContent=c.sequence+' · '+c.n+' frames · 30 Hz · independent prediction';
 $('heroPhoto').querySelector('img').src='assets/thumbs/'+id+'.jpg';
 $('heroPhotoTitle').textContent=c.title;
 document.querySelector('.hero-image-badge').textContent='TACO · '+c.n+' FRAMES';
 document.querySelector('.hero-rail strong').textContent=String(c.sample_frame+1).padStart(3,'0')+' / '+c.n;
 const select=$('stageSelect');select.replaceChildren();
 ORDER.filter(k=>c.stages[k]).forEach(k=>select.add(new Option(LABEL[k],k)));
 const desired=c.stages.A3_aligned_teacher_v1?'A3_aligned_teacher_v1':c.stages.A3_paper_fixed_objects_v1?'A3_paper_fixed_objects_v1':'A3';
 currentStage=desired;
 const v=$('sourceVideo');v.src='assets/videos/'+id+'-source.mp4';v.poster='assets/thumbs/'+id+'.jpg';v.load();
 $('videoWait').classList.remove('hidden');$('videoWait').textContent='载入原 RGB 视频…';
 $('timeline').max=c.n-1;
 const choices=$('comparisonSelect');choices.replaceChildren();
 Object.keys(c.videos||{}).filter(k=>k!=='policy').forEach(k=>choices.add(new Option(VIDEO_LABELS[k]||k,k)));
 choices.value=c.videos?.aligned?'aligned':'baseline';compareVideo();
 const policy=$('policyVideo');
 if(c.videos?.policy){policy.src=c.videos.policy;policy.style.display='block';policy.load();}
 else{policy.removeAttribute('src');policy.style.display='none';policy.load();}
 $('policyVideoCaption').textContent=id==='stir'?'主样本 · epoch2000 checkpoint · frame0 失败':id==='brush260'?'此序列没有可靠对应 GT 的策略任务评价。':'8 env × 1 epoch 诊断 · 原生 frame0 失败';
 timelineUI();
 try{
  await loadMesh(c,token);
  if(token!==caseToken)return;
  await loadStage(desired);
  if(scroll)document.querySelector('#explorer').scrollIntoView({behavior:'smooth'});
 }catch(e){if(token===caseToken){console.error(e);$('sceneLoading').textContent='加载失败：'+e.message;}}
}
function bindControls(){
 document.querySelectorAll('[data-case]').forEach(e=>e.addEventListener('click',()=>{history.replaceState({},'','#'+e.dataset.case);selectCase(e.dataset.case,true);}));
 $('stageSelect').addEventListener('change',e=>loadStage(e.target.value));
 $('comparisonSelect').addEventListener('change',compareVideo);
 $('timeline').addEventListener('input',e=>scrub(Number(e.target.value)));
 $('playButton').addEventListener('click',togglePlay);
 document.querySelectorAll('.speed-control button').forEach(b=>b.addEventListener('click',()=>{
  speed=Number(b.dataset.speed);$('sourceVideo').playbackRate=speed;
  document.querySelectorAll('.speed-control button').forEach(x=>x.classList.toggle('selected',x===b));
 }));
 ['toggleHands','toggleObjects','toggleGrid','toggleCamera'].forEach(id=>$(id).addEventListener('change',()=>{
  if(id==='toggleCamera'&&!$('toggleCamera').checked)resetView();
  applyVisibility();dirty=true;
 }));
 $('resetView').addEventListener('click',resetView);
 $('sourceVideo').addEventListener('loadeddata',()=>{$('videoWait').classList.add('hidden');});
 $('sourceVideo').addEventListener('error',()=>{$('videoWait').textContent='原视频暂不可用，请看下方保存的五列对照。';});
 $('sourceVideo').addEventListener('ended',()=>{playing=false;$('playIcon').textContent='▶';scrub(currentCase.n-1);});
 document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(e.code==='Space'){e.preventDefault();togglePlay();}
  if(e.code==='ArrowLeft'){e.preventDefault();scrub(Math.round(frame)-1);}
  if(e.code==='ArrowRight'){e.preventDefault();scrub(Math.round(frame)+1);}
 });
 window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(catalog&&catalog.cases.some(x=>x.id===id)&&id!==currentCase?.id)selectCase(id,false);});
}
function animate(t){
 requestAnimationFrame(animate);
 if(playing&&currentCase){
  const video=$('sourceVideo');
  if(video.readyState>=2&&!video.paused&&Number.isFinite(video.currentTime)){
   const next=Math.max(0,Math.min(currentCase.n-1,video.currentTime*30));
   if(Math.abs(next-frame)>.02){frame=next;dirty=true;timelineUI();}
  }else{
   const dt=Math.min(.1,Math.max(0,t-lastTime)/1000),next=Math.min(currentCase.n-1,frame+dt*30*speed);
   if(next!==frame){frame=next;dirty=true;timelineUI();}
   if(next>=currentCase.n-1){playing=false;$('playIcon').textContent='▶';}
  }
 }
 lastTime=t;
 if(dirty)updateThree();
 if(threeReady){if(!$('toggleCamera').checked)orbit.update();renderer.render(scene,camera);}
}
async function bootstrap(){
 bindControls();
 try{initializeThree();}catch(e){console.warn(e);$('sceneLoading').textContent='需要支持 WebGL 的现代浏览器以显示 3D。';}
 try{
  catalog=await getJson('catalog.json');
  const requested=location.hash.substring(1);
  await selectCase(catalog.cases.some(c=>c.id===requested)?requested:'stir',false);
 }catch(e){console.error(e);$('sceneLoading').textContent='数据清单载入失败：'+e.message;}
 requestAnimationFrame(animate);
}
bootstrap();
