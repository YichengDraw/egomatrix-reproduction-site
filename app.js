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
 disposeRobotMeshes();
 for(const m of meshes){world.remove(m);m.geometry.dispose();m.material.dispose();}
 meshes=[];objects=[];leftHand=null;rightHand=null;stageData=null;
}
function resetView(){
 if(!currentCase||!threeReady)return;
 $('toggleCamera').checked=false;orbit.enabled=true;
 const rc=viewMode==='robot'&&robotRef?robotRef.meta:viewMode==='policy'&&policyTrace?policyTrace.meta:null;
 const c=rc?rc.center:currentCase.center;
 viewTarget.set(c[0],c[1],c[2]);viewDist=Math.max(.65,(rc?rc.span:currentCase.span)*1.55);
 orbit.target.copy(viewTarget);camera.up.set(0,0,1);camera.position.set(c[0]+viewDist*.68,c[1]-viewDist*1.1,c[2]+viewDist*.78);
 camera.fov=45;camera.near=.005;camera.far=30;camera.updateProjectionMatrix();orbit.update();
}
function applyVisibility(){
 if(leftHand)leftHand.visible=viewMode==='human'&&$('toggleHands').checked;
 if(rightHand)rightHand.visible=viewMode==='human'&&$('toggleHands').checked;
 for(const piece of robotMeshes)piece.mesh.visible=(viewMode==='robot'||viewMode==='policy')&&$('toggleHands').checked;
 for(const piece of policyGhosts)piece.mesh.visible=viewMode==='policy'&&$('toggleTarget').checked&&($('toggleHands').checked||piece.kind==='object');
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
 if(viewMode==='robot'){updateRobot3D();return;}
 if(viewMode==='policy'){updatePolicy3D();return;}
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
 const n=currentCase.n,max=policyMaxFrame();
 $('timeLabel').innerHTML=timeFormat(frame/30)+' <span>/ '+timeFormat(max/30)+'</span>';
 $('timeline').value=viewMode==='policy'?Math.round(frame*2)/2:Math.round(frame);
 $('timeline').style.setProperty('--track-progress',(frame/Math.max(max,.1)*100).toFixed(2)+'%');
 drawSafetyPlayhead();
 $('videoFrameDisplay').textContent='FRAME '+String(Math.floor(frame)+1).padStart(4,'0');
}
function scrub(f){
 if(!currentCase)return;frame=Math.max(0,Math.min(policyMaxFrame(),f));dirty=true;
 const video=$('sourceVideo'),t=frame/30;
 if(video.readyState>=1&&Math.abs(video.currentTime-t)>.04)try{video.currentTime=t;}catch{}
 timelineUI();updateThree();
}
function togglePlay(){
 if(!currentCase)return;playing=!playing;
 $('playIcon').textContent=playing?'Ⅱ':'▶';
 if(playing){
  if(frame>=policyMaxFrame())scrub(0);
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
 if(viewMode==='robot')$('metricFooter').textContent='当前表格是 MANO 重建阶段的独立离线评价，并非 XHand retargeting 的任务成功率。上方机器人视图展示的是完整参考轨迹。';
 const tbody=$('metricsTbody');tbody.replaceChildren();
 ORDER.filter(k=>currentCase.stages[k]).forEach(k=>{
  const values=all[k]||[null,null,null,null],tr=document.createElement('tr');
  if(k===currentStage)tr.classList.add('active-row');
  const title=document.createElement('td');title.textContent=LABEL[k].split(' · ')[0];
  const sub=document.createElement('small');sub.className='stage-meta';sub.textContent=LABEL[k].split(' · ').slice(1).join(' / ');title.appendChild(sub);tr.appendChild(title);
  values.forEach((v,i)=>{const td=document.createElement('td');td.textContent=fmt(v,i===2?3:2);if(v==null)td.className='na';tr.appendChild(td);});
  tr.style.cursor='pointer';tr.addEventListener('click',()=>loadStage(k));tbody.appendChild(tr);
 });
 updateSafety();
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
 const previousMode=viewMode;const token=++caseToken;stageToken++;++robotToken;
 currentCase=c;stageData=null;frame=0;policyTrace=null;setModeState('human');robotNotice(c);
 $('policyView').disabled=!c.rollout_3d;$('openPolicy3D').disabled=!c.rollout_3d;
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
 $('timeline').max=c.n-1;$('timeline').step='1';
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
  if(previousMode==='robot'&&Object.keys(c.retarget||{}).length)await switchView('robot');
  else if(previousMode==='policy'&&c.rollout_3d)await switchView('policy');
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
 $('sourceVideo').addEventListener('timeupdate',()=>{
  if(viewMode!=='policy'||!currentCase)return;
  const video=$('sourceVideo'),max=policyMaxFrame()/30;
  if(video.currentTime>=max-0.001){
   if(video.currentTime>max+0.018)video.currentTime=max;
   if(!video.paused)video.pause();
   playing=false;frame=policyMaxFrame();dirty=true;
   $('playIcon').textContent='▶';timelineUI();updateThree();
  }
 });
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
   const next=Math.max(0,Math.min(policyMaxFrame(),video.currentTime*30));
   if(Math.abs(next-frame)>.02){frame=next;dirty=true;timelineUI();}
   policyStopIfAtEnd();
  }else{
   const dt=Math.min(.1,Math.max(0,t-lastTime)/1000),next=Math.min(policyMaxFrame(),frame+dt*30*speed);
   if(next!==frame){frame=next;dirty=true;timelineUI();}
   if(next>=policyMaxFrame()){playing=false;$('sourceVideo').pause();$('playIcon').textContent='▶';}
  }
 }
 lastTime=t;
 if(dirty)updateThree();
 if(threeReady){if(!$('toggleCamera').checked)orbit.update();renderer.render(scene,camera);}
}
async function bootstrap(){
 bindControls();bindRetargetControls();bindPolicySafety();
 try{initializeThree();}catch(e){console.warn(e);$('sceneLoading').textContent='需要支持 WebGL 的现代浏览器以显示 3D。';}
 try{
  catalog=await getJson('catalog.json');
  const requested=location.hash.substring(1);
  await selectCase(catalog.cases.some(c=>c.id===requested)?requested:'stir',false);
  const qp=new URLSearchParams(location.search);
  if(qp.get('mode')==='policy'&&currentCase?.rollout_3d){await switchView('policy');}
  else if(qp.get('mode')==='robot'&&Object.keys(currentCase?.retarget||{}).length){
   const selected=qp.get('variant');
   if(selected&&currentCase.retarget[selected])$('retargetSelect').value=selected;
   await switchView('robot');
  }
  await loadSafetyDB();
 }catch(e){console.error(e);$('sceneLoading').textContent='数据清单载入失败：'+e.message;}
 requestAnimationFrame(animate);
}

// Retargeting reference player: saved XHand URDF FK, 60 Hz, separate from PPO rollout.
// No pretrained policy or control code runs in the browser.
let viewMode='human';
let robotRef=null, robotMeshes=[], robotMeshCase='', robotToken=0;
let robotJointText=[],robotLastJointFrame=-1,retargetMeshManifest=null;
const ROBOT_VARIANTS={
 baseline:'原始 Retargeting 参考',
 fixed:'固定物体 A3 → Retargeting',
 aligned:'Aligned teacher + fixed A3 → Retargeting'
};
const DOF_LABELS=[
 'Index · spread','Index · proximal','Index · distal',
 'Middle · proximal','Middle · distal',
 'Pinky · proximal','Pinky · distal',
 'Ring · proximal','Ring · distal',
 'Thumb · spread','Thumb · proximal','Thumb · distal'
];
function disposeRobotMeshes(){
 if(!world)return;
 disposeGhosts();policyTrace=null;
 for(const item of robotMeshes){world.remove(item.mesh);item.mesh.geometry.dispose();item.mesh.material.dispose();}
 robotMeshes=[];robotMeshCase='';robotRef=null;robotJointText=[];robotLastJointFrame=-1;
}
function robotNotice(c){
 const options=Object.keys(c.retarget||{});
 const enabled=options.length>0;
 $('referenceNotice').hidden=!enabled;
 $('robotView').disabled=!enabled;
 const samples=2*c.n-1;
 $('referenceNoticeText').textContent=enabled?samples+' 帧 · 60 Hz · 双手各 12 DOF · 已保存完整参考，未执行整段物理控制':'此序列没有保存的机器人 retargeting 参考';
 $('referenceLength').textContent=enabled?samples:'N/A';
 const sel=$('retargetSelect');sel.replaceChildren();
 for(const type of ['baseline','fixed','aligned']){
  if(!c.retarget?.[type])continue;
  sel.add(new Option(ROBOT_VARIANTS[type]+' · '+c.retarget[type].task,type));
 }
 sel.value=c.retarget?.aligned?'aligned':(c.retarget?.fixed?'fixed':'baseline');
}
function setModeState(mode){
 viewMode=mode;
 const robot=mode==='robot',policy=mode==='policy',human=mode==='human';
 if(!policy)disposeGhosts();
 for(const [id,on] of [['humanView',human],['robotView',robot],['policyView',policy]]){
  $(id).classList.toggle('selected',on);
  $(id).setAttribute('aria-pressed',String(on));
 }
 $('stageSelect').hidden=!human;
 $('retargetSelect').hidden=!robot;
 $('variantLabel').hidden=policy;
 $('variantLabel').textContent=robot?'机器人参考':'重建阶段';
 $('robotTelemetry').hidden=!robot;
 $('policyTelemetry').hidden=!policy;
 $('targetToggleLabel').hidden=!policy;
 $('toggleCamera').disabled=!human;
 if(!human)$('toggleCamera').checked=false;
 $('sceneCanvas').parentElement.parentElement.parentElement.classList.toggle('robot-view',!human);
 $('threeModeTitle').textContent=policy?'02 / PPO ACTUAL PHYSICS STATES':robot?'02 / XHAND RETARGETING REFERENCE':'02 / RECONSTRUCTED WORLD';
 $('threePaneTag').textContent=policy?'ISAAC SIM · 9 STEPS · FAILED':robot?'60 HZ TARGET · NOT PPO':'LIVE WEBGL / 3D';
 $('threeFooterType').textContent=policy?'ACTUAL PHYSICS / OBJECT CONTACT':robot?'XHAND URDF MESH / 24 DOF':'MANO 778 VERTICES / HAND';
 $('viewerNote').textContent=policy?
  '本视图逐帧重放 IsaacLab 原生 control_post 的真实物理状态；目标线框与奖励参考索引一致。9 步终止不代表完整任务成功。':
  robot?'完整 Retargeting 运动学参考由真实 12DOF 手腕/关节数据重建；尚未由 PPO 物理执行。':
  '3D MANO 与物体网格来自重建保存结果，每2帧传输一组顶点并插值；原视频为真实30Hz，GT仅用于评分。';
}
async function loadRobotMeshes(c,token){
 if(robotMeshCase===c.id&&robotMeshes.length)return;
 if(robotMeshes.length)disposeRobotMeshes();
 if(!retargetMeshManifest)retargetMeshManifest=await getJson('assets/robot/mesh_manifest.json');
 const specs=['lh','rh'].flatMap(side=>retargetMeshManifest.hand_links[side].map(item=>({...item,side})));
 const files=await Promise.all(specs.flatMap(spec=>[getBinary(spec.positions,Float32Array),getBinary(spec.faces,Uint32Array)]));
 if(token!==robotToken||c!==currentCase)return false;
 for(let i=0;i<specs.length;i++){
  const spec=specs[i];
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(files[2*i],3));
  geom.setIndex(new THREE.BufferAttribute(files[2*i+1],1));
  geom.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({
   color:spec.side==='lh'?0x89cdae:0xe5bd91,
   metalness:.33,roughness:.48,side:THREE.DoubleSide
  });
  const mesh=new THREE.Mesh(geom,mat);
  mesh.name='XHand '+spec.link;
  mesh.frustumCulled=false;
  mesh.visible=false;
  world.add(mesh);
  robotMeshes.push({mesh,link:spec.link,side:spec.side,idx:-1});
 }
 robotMeshCase=c.id;
 return true;
}
function rebuildJointInspector(){
 const root=$('jointColumns');
 root.replaceChildren();robotJointText=[];
 for(let h=0;h<2;h++){
  const table=document.createElement('table');table.className='joint-table';
  const head=document.createElement('thead'),hr=document.createElement('tr');
  const cell=document.createElement('th');cell.colSpan=2;cell.textContent=h===0?'LH · 左手 · 12DOF':'RH · 右手 · 12DOF';hr.appendChild(cell);head.appendChild(hr);table.appendChild(head);
  const tbody=document.createElement('tbody');
  for(let j=0;j<12;j++){
   const tr=document.createElement('tr'),name=document.createElement('td'),value=document.createElement('td');
   name.textContent=DOF_LABELS[j];value.textContent='—';robotJointText.push(value);
   tr.appendChild(name);tr.appendChild(value);tbody.appendChild(tr);
  }
  table.appendChild(tbody);root.appendChild(table);
 }
 robotLastJointFrame=-1;
}
async function loadRobotRef(variant){
 if(!currentCase?.retarget?.[variant])return;
 const c=currentCase,token=++robotToken;
 loading('读取 XHand 真实连杆模型及 60Hz 关节参考…');
 try{
  const meta=await getJson(c.retarget[variant].meta);
  const assets=await Promise.all([getBinary(meta.links,Float32Array),getBinary(meta.objects,Float32Array),getBinary(meta.dofs,Float32Array),loadRobotMeshes(c,token)]);
  if(token!==robotToken||c!==currentCase||viewMode!=='robot')return;
  const [links,poses,dof]=assets;
  if(links.length!==meta.frameCount*meta.linkCount*16||
     poses.length!==meta.frameCount*meta.objectCount*16||
     dof.length!==meta.frameCount*2*12)throw Error('机器人参考数组尺寸校验失败');
  const linkIdx=new Map(meta.linkNames.map((name,i)=>[name,i]));
  for(const m of robotMeshes){
   m.idx=linkIdx.get(m.link);
   if(m.idx==null)throw Error('机器人连杆名称无法对齐: '+m.link);
  }
  robotRef={meta,links,poses,dof,variant};
  rebuildJointInspector();
  $('robotReferenceStats').textContent=meta.frameCount+' / '+meta.frameCount+
   ' frames · 60 Hz · 12DOF/手 · FK 最大差 '+(meta.fk_max_error_m*1e3).toFixed(3)+'mm · '+meta.task;
  if(grid)grid.position.set(meta.center[0],meta.center[1],meta.center[2]-meta.span*.28);
  resetView();applyVisibility();dirty=true;updateThree();doneLoading();
 }catch(e){if(token===robotToken){console.error(e);$('sceneLoading').textContent='XHand 参考载入失败：'+e.message;}}
}
async function switchView(mode){
 if(mode==='policy'){await switchPolicy();return;}
 if(mode==='robot'&&!Object.keys(currentCase?.retarget||{}).length)return;
 if(mode==='human'){
  ++robotToken;policyTrace=null;setModeState('human');applyVisibility();
  $('timeline').max=currentCase.n-1;$('timeline').step='1';
  if(grid&&currentCase)grid.position.set(currentCase.center[0],currentCase.center[1],currentCase.center[2]-currentCase.span*.27);
  resetView();frame=Math.min(frame,currentCase.n-1);timelineUI();dirty=true;showMetrics();
  if($('sourceVideo').readyState>=1)try{$('sourceVideo').currentTime=frame/30;}catch{}
  if(!stageData)await loadStage(currentStage);else updateThree();
  doneLoading();return;
 }
 policyTrace=null;setModeState('robot');
 $('timeline').max=currentCase.n-1;$('timeline').step='1';
 applyVisibility();timelineUI();showMetrics();
 if($('sourceVideo').readyState>=1)try{$('sourceVideo').currentTime=frame/30;}catch{}
 await loadRobotRef($('retargetSelect').value);
}
function updateRobotTelemetry(sample){
 if(!$('jointInspector').open||!robotRef||robotLastJointFrame===sample)return;
 robotLastJointFrame=sample;
 const {meta,dof}=robotRef;
 for(let k=0;k<24;k++)robotJointText[k].textContent=dof[sample*24+k].toFixed(3);
}
function updateRobot3D(){
 if(viewMode!=='robot'||!robotRef||!robotMeshes.length)return;
 const {meta,links,poses}=robotRef,step=Math.max(0,Math.min(meta.frameCount-1,frame*2));
 const a=Math.floor(step),b=Math.ceil(step),w=step-a;
 for(const piece of robotMeshes){
  const idx=piece.idx,mesh=piece.mesh;
  matrixAt(matA,links,(a*meta.linkCount+idx)*16);
  matrixAt(matB,links,(b*meta.linkCount+idx)*16);
  matA.decompose(pA,qA,sA);matB.decompose(pB,qB,sB);
  mesh.position.copy(pA).lerp(pB,w);
  mesh.quaternion.copy(qA).slerp(qB,w);
  mesh.scale.copy(sA).lerp(sB,w);
 }
 for(let i=0;i<objects.length;i++){
  matrixAt(matA,poses,(a*meta.objectCount+i)*16);
  matrixAt(matB,poses,(b*meta.objectCount+i)*16);
  matA.decompose(pA,qA,sA);matB.decompose(pB,qB,sB);
  objects[i].position.copy(pA).lerp(pB,w);
  objects[i].quaternion.copy(qA).slerp(qB,w);
  objects[i].scale.copy(sA).lerp(sB,w);
 }
 updateRobotTelemetry(Math.round(step));
 dirty=false;
}
function bindRetargetControls(){
 $('robotView').addEventListener('click',()=>switchView('robot'));
 $('humanView').addEventListener('click',()=>switchView('human'));
 $('openRobot3D').addEventListener('click',()=>{
  switchView('robot');
  document.querySelector('#explorer').scrollIntoView({behavior:'smooth'});
 });
 $('retargetSelect').addEventListener('change',e=>loadRobotRef(e.target.value));
}
// original bootstrap below


/* Actual IsaacLab 9-step rollout and scoped native safety audit. Offline saved arrays only. */
let policyTrace=null,policyGhosts=[],safetyIndex=null,currentSafety=null;
const PFAIL_LABELS={
 thumb_tip_pos:'拇指跟踪',index_tip_pos:'食指跟踪',middle_tip_pos:'中指跟踪',ring_tip_pos:'无名指跟踪',
 pinky_tip_pos:'小指跟踪',obj_pos:'物体位置',obj_rot:'物体旋转',tip_no_contact:'指尖接触',
 level_1_pos:'手部一级关节',level_2_pos:'手部二级关节'
};
function disposeGhosts(){
 if(!world)return;
 for(const item of policyGhosts){world.remove(item.mesh);item.mesh.material.dispose();}
 policyGhosts=[];
}
function policyMaxFrame(){
 return viewMode==='policy'?(policyTrace?.meta.control_steps??9)/2:(currentCase?.n??1)-1;
}
function policyStopIfAtEnd(){
 if(viewMode!=='policy'||!playing)return;
 if(frame >= policyMaxFrame()-1.e-6){
  playing=false;$('sourceVideo').pause();$('playIcon').textContent='▶';
 }
}
function createGhostMeshes(){
 disposeGhosts();
 const matSettings={wireframe:true,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide};
 for(const piece of robotMeshes){
  const m=new THREE.Mesh(piece.mesh.geometry,new THREE.MeshBasicMaterial({...matSettings,color:0xa3f3bb}));
  m.frustumCulled=false;world.add(m);
  policyGhosts.push({mesh:m,kind:'link',index:piece.idx});
 }
 for(let i=0;i<objects.length;i++){
  const m=new THREE.Mesh(objects[i].geometry,new THREE.MeshBasicMaterial({...matSettings,color:0xc1ffad,opacity:.31}));
  m.frustumCulled=false;world.add(m);
  policyGhosts.push({mesh:m,kind:'object',index:i});
 }
}
async function switchPolicy(){
 if(!currentCase?.rollout_3d)return;
 const c=currentCase,token=++robotToken;
 ++stageToken;
 playing=false;$('sourceVideo').pause();$('playIcon').textContent='▶';
 setModeState('policy');applyVisibility();
 loading('正在读取已保存的原生 9 步物理状态…');
 try{
  const meta=await getJson(c.rollout_3d.meta);
  const [actualLinks,actualObjects,targetLinks,targetObjects,meshesAvailable]=await Promise.all([
    getBinary(meta.actual_links,Float32Array),
    getBinary(meta.actual_objects,Float32Array),
    getBinary(meta.target_links,Float32Array),
    getBinary(meta.target_objects,Float32Array),
    loadRobotMeshes(c,token)
  ]);
  if(token!==robotToken||c!==currentCase||viewMode!=='policy')return;
  const L=meta.link_count,N=meta.state_rows,O=meta.object_count;
  if(actualLinks.length!==N*L*16||targetLinks.length!==N*L*16||
     actualObjects.length!==N*O*16||targetObjects.length!==N*O*16||
     meta.reference_index_by_state.length!==N||N!==meta.control_steps+1)
    throw Error('真实仿真状态与时间索引长度不匹配');
  const indices=new Map(meta.link_names.map((x,i)=>[x,i]));
  for(const item of robotMeshes){
    item.idx=indices.get(item.link);
    if(item.idx===undefined)throw Error('native body name mapping missing '+item.link);
  }
  policyTrace={meta,actualLinks,actualObjects,targetLinks,targetObjects};
  createGhostMeshes();
  frame=0;
  if($('sourceVideo').readyState>=1)try{$('sourceVideo').currentTime=0;}catch{}
  $('timeline').max=String(meta.control_steps/2);
  $('timeline').step='.5';
  $('policyFailureReason').textContent='本次真实执行在第 '+meta.control_steps+
    ' 步停止。原生终止标志：'+meta.failure_reasons.map(x=>PFAIL_LABELS[x]||x).join('、')+
    '；所有参考点来自对应 RL Loader，且无 GT 反馈。绿色线框为奖励所用参考索引；控制完成时刻相较参考索引相差一个积分步。';
  const axes=meta.center;grid.position.set(axes[0],axes[1],axes[2]-meta.span*.28);
  resetView();applyVisibility();timelineUI();dirty=true;updateThree();doneLoading();
 }catch(e){if(token===robotToken){console.error(e);$('sceneLoading').textContent='真实 PPO 状态载入失败：'+e.message;}}
}
function assignInterpolated(mesh,arr,a,b,w,perFrame,strideIndex){
 matrixAt(matA,arr,a*perFrame+strideIndex);
 matrixAt(matB,arr,b*perFrame+strideIndex);
 matA.decompose(pA,qA,sA);matB.decompose(pB,qB,sB);
 mesh.position.copy(pA).lerp(pB,w);
 mesh.quaternion.copy(qA).slerp(qB,w);
 mesh.scale.copy(sA).lerp(sB,w);
}
function updatePolicy3D(){
 if(!policyTrace||viewMode!=='policy'||!robotMeshes.length)return;
 const d=policyTrace,meta=d.meta,N=meta.state_rows;
 const position=Math.max(0,Math.min(meta.control_steps,frame*2));
 const a=Math.floor(position),b=Math.ceil(position),w=position-a;
 const frameStride=meta.link_count*16;
 for(const part of robotMeshes)assignInterpolated(part.mesh,d.actualLinks,a,b,w,frameStride,part.idx*16);
 for(let i=0;i<objects.length;i++)assignInterpolated(objects[i],d.actualObjects,a,b,w,meta.object_count*16,i*16);
 for(const part of policyGhosts){
  const data=part.kind==='link'?d.targetLinks:d.targetObjects;
  const stride=part.kind==='link'?meta.link_count:meta.object_count;
  assignInterpolated(part.mesh,data,a,b,w,stride*16,part.index*16);
 }
 updatePolicyTelemetry(Math.round(position));
 dirty=false;
}
function updatePolicyTelemetry(step){
 if(!policyTrace||viewMode!=='policy')return;
 const m=policyTrace.meta;step=Math.max(0,Math.min(m.control_steps,step));
 $('policyStepInfo').textContent=step===0?'初始化状态 / 尚未执行物理控制':
  step===m.control_steps?'第 '+step+' / '+m.control_steps+' 步 · 已触发原生失败':
  '已实际执行 '+step+' / '+m.control_steps+' 控制步';
 for(const [side,id] of [['lh','policyLhError'],['rh','policyRhError']]){
  const list=m.mean_sim_to_target_fingertip_millimeters[side].per_control_step_mm;
  $(id).textContent=step===0?'初始匹配':list[step-1].toFixed(1)+' mm';
 }
 $('policyRefIndex').textContent=m.reference_index_by_state[step]+' / '+(2*currentCase.n-1);
}
function openPolicy3D(){
 if(!currentCase?.rollout_3d)return;
 switchView('policy');
 document.querySelector('#explorer').scrollIntoView({behavior:'smooth'});
}
async function loadSafetyDB(){
 try{safetyIndex=await getJson('assets/diagnostics/safety.json');updateSafety();}
 catch(e){console.warn('Safety audit summary unavailable',e);$('safetyDisclosure').textContent='独立安全审计暂不可用：'+e.message;}
}
function updateSafety(){
 if(!safetyIndex||!currentCase)return;
 const records=safetyIndex[currentCase.id];
 if(!records)return;
 const selected=currentStage,found=records[selected];
 const fallback=records.A3_aligned_teacher_v1? 'A3_aligned_teacher_v1':'A3';
 const stage=found?selected:fallback,data=records[stage];
 if(!data)return;
 currentSafety={data,stage};
 $('safetyAuditStage').textContent=stage.replace('A3_aligned_teacher_v1','ALIGNED A3').replace('A3_paper_fixed_objects_v1','PAPER-FIXED A3');
 $('safetyApplicable').textContent=data.applicable;
 $('safetyFailures').textContent=data.fail;
 $('safetyNA').textContent=data.not_applicable;
 $('safetyDeepest').textContent=data.deepest_bound_signed_mm.toFixed(2);
 $('safetyDisclosure').textContent=(selected!==stage?'当前所选 '+selected+' 没有相应原生 A3 safety 审计，以下显示 '+stage+'。':'当前显示 '+stage+' 独立原核审计。')+
    ' 边界判定仅适用于原算法规定的子集；全片最深 signed<0 为真实穿透，包含 N/A 边。负限值允许一定穿透。';
 const canvas=$('safetyStrip'),ctx=canvas.getContext('2d');
 const W=canvas.width,H=canvas.height,n=data.safety_strip.length;
 ctx.clearRect(0,0,W,H);
 for(let i=0;i<n;i++){
  ctx.fillStyle=data.safety_strip[i]===2?'#dc8d68':data.safety_strip[i]===1?'#91cb82':'#4a5a50';
  const x=Math.floor(i*W/n),end=Math.ceil((i+1)*W/n);
  ctx.fillRect(x,0,Math.max(1,end-x),H);
 }
 drawSafetyPlayhead();
 const failList=$('safetyFailureList');failList.replaceChildren();
 if(!data.fail){
  const p=document.createElement('p');p.textContent='本阶段原规则适用边没有报告失败；未适用的 N/A 边仍有可能出现穿透。';failList.appendChild(p);
 }else{
  for(const f of data.failures.slice(0,12)){
   const btn=document.createElement('button');btn.type='button';
   const why=f.binding_failed?'绑定对象':'非绑定障碍';
   const obs=f.obstacles_failed[0];
   const val=f.binding_failed?f.binding_signed_mm:obs?.signed_mm;
   btn.textContent=f.side+' '+f.from+'→'+f.to+' · '+why+' '+Number(val).toFixed(2)+'mm';
   btn.addEventListener('click',async()=>{
    if(viewMode!=='human')await switchView('human');
    if(currentStage!==stage)await loadStage(stage);
    scrub(f.from);
    document.querySelector('#explorer').scrollIntoView({behavior:'smooth'});
   });
   failList.appendChild(btn);
  }
 }
}
function drawSafetyPlayhead(){
 if(!currentSafety||!currentCase)return;
 const fraction=Math.max(0,Math.min(1,frame/(currentCase.n-1)));
 $('safetyPlayhead').style.left=(fraction*100)+'%';
}
function bindPolicySafety(){
 $('policyView').addEventListener('click',()=>switchView('policy'));
 $('openPolicy3D').addEventListener('click',openPolicy3D);
 $('toggleTarget').addEventListener('change',()=>{applyVisibility();dirty=true;});
 const canvas=$('safetyStrip');
 canvas.addEventListener('mousemove',e=>{
  if(!currentSafety)return;
  const width=canvas.getBoundingClientRect().width;
  const index=Math.min(currentSafety.data.safety_strip.length-1,
    Math.max(0,Math.floor((e.clientX-canvas.getBoundingClientRect().left)/width*currentSafety.data.safety_strip.length)));
  const names=['N/A · 只做几何','Pass · 原规则适用','Fail · 原规则适用'];
  canvas.title='原帧 '+(index+1)+'→'+(index+2)+'，'+names[currentSafety.data.safety_strip[index]];
 });
 canvas.addEventListener('click',async e=>{
  if(!currentSafety)return;
  const rect=canvas.getBoundingClientRect();
  const f=Math.min(currentSafety.data.safety_strip.length-1,Math.max(0,Math.round((e.clientX-rect.left)/rect.width*currentSafety.data.safety_strip.length)));
  if(viewMode!=='human')await switchView('human');
  if(currentStage!==currentSafety.stage)await loadStage(currentSafety.stage);
  scrub(f);
  document.querySelector('#explorer').scrollIntoView({behavior:'smooth'});
 });
}

bootstrap();
