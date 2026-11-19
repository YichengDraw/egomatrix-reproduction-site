'use strict';
const traceLanes = [
    ['完整真值接触区域', f => [Object.keys(f.full_gt || {}).length], '个区域'],
    ['选入优化的区域', f => [Object.keys(f.selected || {}).length], '个区域'],
    ['理想与实际手面误差', f => [f.errors?.ideal_mm, f.errors?.actual_mm], 'mm · 理想 / 实际'],
    ['正确、错误及未知接触冲量', f => [f.force?.correct_Ns, f.force?.wrong_Ns,
        (f.force?.gt_unknown_Ns || 0) + (f.force?.measurement_unmapped_Ns || 0)], 'N·s · 正确 / 错误 / 未知'],
    ['手和环境的竖直支撑力', f => [f.support?.hand_z_N, f.support?.ground_z_N], 'N · 手 / 环境'],
    ['实际物体与真值物体的位移', f => [f.task?.actual_displacement_from_start_m, f.task?.source_displacement_from_start_m], 'm · 实际 / 真值']
];
let traceSelection=null;
function renderContactTraces(doc, frame, row) {
    const panel=document.getElementById('tracePanel');
    panel.hidden=!doc;
    if (!doc) return;
    const frames=doc.frames, index=Math.min(frame,frames.length-1), current=frames[index];
    if (!current) return;
    if (traceSelection!==doc) {
        traceSelection=doc;
        const list=document.getElementById('tracePlots');list.replaceChildren();
        for (const [title, measure, units] of traceLanes) {
            const figure=document.createElement('figure'), caption=document.createElement('figcaption');
            const label=document.createElement('strong');label.textContent=title;
            const span=document.createElement('span');span.textContent=units;caption.append(label,span);
            const canvas=document.createElement('canvas');canvas.width=850;canvas.height=70;
            const series=frames.map(measure),values=series.flat().filter(Number.isFinite);
            const low=Math.min(0,...values),high=Math.max(low+.00001,...values);
            const ctx=canvas.getContext('2d');ctx.clearRect(0,0,850,70);
            const end=frames.at(-1).time_s || .001;
            for (let c=0;c<series[0].length;c++) {
                ctx.strokeStyle=['#21685c','#a44c2e','#725fa2'][c];ctx.lineWidth=2;ctx.beginPath();let linked=false;
                series.forEach((v,k)=>{
                    if (!Number.isFinite(v[c])) {linked=false;return;}
                    const x=frames[k].time_s/end*848+1,y=65-(v[c]-low)/(high-low)*60;
                    if (linked)ctx.lineTo(x,y);else ctx.moveTo(x,y);
                    linked=true;
                });
                ctx.stroke();
            }
            const box=document.createElement('div');box.className='tracePlot';box.append(canvas,document.createElement('i'));
            box.onclick=e=>{const r=box.getBoundingClientRect(),time=(e.clientX-r.left)/r.width*end;
                let k=0;frames.forEach((f,i)=>{if(Math.abs(f.time_s-time)<Math.abs(frames[k].time_s-time)) k=i;});draw(k);};
            figure.append(caption,box);list.append(figure);
        }
    }
    const percent=current.time_s/Math.max(.001,frames.at(-1).time_s)*100;
    panel.querySelectorAll('.tracePlot i').forEach(marker=>{marker.style.left=percent+'%';});
    const display={};
    for(const [name,value] of Object.entries({完整真值:current.full_gt,选入目标与权重:current.selected,
        手面误差:current.errors,接触冲量:current.force,支撑与滑移:current.support,物体任务:current.task})) display[name]=value;
    document.getElementById('traceValues').textContent=JSON.stringify(display,null,2);
    document.getElementById('traceClock').textContent=current.time_s.toFixed(3)+' s · 源帧 '+current.source_frame+
        ' · '+(current.support?.phase || '')+' · S '+lab(row.S)+' / C '+lab(row.C)+' / J '+lab(row.J);
}
