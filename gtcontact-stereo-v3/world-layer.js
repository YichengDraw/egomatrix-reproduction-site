'use strict';
function configureWorldLayers(world) {
    const panel=document.getElementById('worldLayers');
    panel.hidden=!world;
    if (!world) return;
    const selector=document.getElementById('worldHypothesis');
    selector.replaceChildren(...Object.keys(world.hypotheses).map(k=>new Option(k,k)));
    const text=document.getElementById('worldDescription');
    const update=()=>{const h=world.hypotheses[selector.value];text.textContent=h.description;requestOrbitDraw();};
    selector.onchange=update;
    document.getElementById('worldCloud').onchange=requestOrbitDraw;
    update();
}
function drawWorldLayer(ctx,project,world,frame,id,actual) {
    if (!world || id==='cad') return;
    const board=world.hypotheses[document.getElementById('worldHypothesis').value];
    ctx.lineWidth=1.4;
    for (const poly of board.boards) {
        if (!poly.length)continue;
        ctx.strokeStyle='#52766f';ctx.fillStyle='#6e917c22';ctx.beginPath();
        poly.forEach((p,i)=>{const [x,y]=project(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        ctx.closePath();ctx.fill();ctx.stroke();
    }
    if(document.getElementById('worldCloud').checked){ctx.fillStyle='#657a7288';for(const p of world.cloud){const [x,y]=project(p);ctx.fillRect(x,y,1.4,1.4);}}
    if(id==='gt' && world.otherHand?.[frame]){
        ctx.fillStyle='#586595';for(const p of world.otherHand[frame]){const [x,y]=project(p);ctx.fillRect(x-1.7,y-1.7,3.4,3.4);}
    }
    for(const [uid,pts] of Object.entries(world.neighborPoints || {})){
        const T=(id==='gt'?world.referenceNeighbors?.[uid]?.[frame]:actual?.neighbors?.[uid]);
        if(!T)continue; ctx.fillStyle='#7f7466';
        for(const p of pts){const point=T.slice(0,3).map(r=>r[3]+r[0]*p[0]+r[1]*p[1]+r[2]*p[2]);const [x,y]=project(point);ctx.fillRect(x,y,1.8,1.8);}
    }
}
