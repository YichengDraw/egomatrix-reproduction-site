/* Draw display meshes in the same coordinates and at the same recorded frame as the points. */
(() => {
  const cache = new Map();
  let selection = null;
  let assets = {};
  const colorRamp = ([r, g, b]) => Array.from({length:32}, (_,i) => {
    const light = .58 + i / 40;
    return 'rgb(' + [r,g,b].map(c => Math.min(255, Math.round(c*light))).join(',') + ')';
  });
  const handColors = colorRamp([66, 139, 147]);
  const cadColors = colorRamp([207, 142, 73]);

  function get(name) {
    const key=new URL('surfaces/'+name,mediaRoot()).href;
    if (cache.has(key)) {
      const old = cache.get(key);
      cache.delete(key);
      cache.set(key, old);
      return old;
    }
    const promise = json(key).catch(error => { cache.delete(key); throw error; });
    cache.set(key, promise);
    if (cache.size > 16) cache.delete(cache.keys().next().value);
    return promise;
  }

  function loadFor(data) {
    selection = data;
    const row = rows[active];
    const media = row.media;
    const filename = ref => ref.split('/').pop();
    const sources = {source: filename(media.source)};
    if (media.actual || media.baseline) sources.robot = row.surface_model || row.robot+'_'+row.side+'.json.gz';
    if (media.actual) sources.actual = filename(media.actual);
    if (media.baseline) sources.baseline = filename(media.baseline);
    const loaded = {};
    assets = loaded;
    for (const [key,name] of Object.entries(sources)) {
      get(name).then(value => {
        if (selection !== data) return;
        loaded[key] = value;
        requestOrbitDraw();
      }).catch(() => {
        // Original samples remain available for older rounds without a display mesh.
      });
    }
  }

  function move(points, m) {
    return points.map(([x,y,z]) => [
      m[0]*x+m[1]*y+m[2]*z+m[3],
      m[4]*x+m[5]*y+m[6]*z+m[7],
      m[8]*x+m[9]*y+m[10]*z+m[11]
    ]);
  }

  window.drawOrbitSurfaces = ({id, ctx, project, frame, data}) => {
    if (selection !== data) loadFor(data);
    const src = assets.source;
    const triangles = [];
    function add(v, faces, palette) {
      const pix = v.map(project);
      for (const [ia, ib, ic] of faces) {
        const a = v[ia], b = v[ib], c = v[ic];
        const x=b[0]-a[0], y=b[1]-a[1], z=b[2]-a[2];
        const u=c[0]-a[0], w=c[1]-a[1], t=c[2]-a[2];
        const nx=y*t-z*w, ny=z*u-x*t, nz=x*w-y*u;
        const light=Math.abs((.32*nx+.49*ny+.81*nz)/(Math.hypot(nx,ny,nz)||1));
        const p=pix[ia], q=pix[ib], r=pix[ic];
        triangles.push([p,q,r,p[2]+q[2]+r[2],palette[Math.min(31, Math.floor(31*light))]]);
      }
    }
    const result = {hand:false,object:false};
    const pose = id==='gt' ? data.s.frames[frame] : (id==='actual' ? data.a : data.b)?.frames[frame];
    if (src && (pose || id==='cad')) {
      add(id==='cad' ? src.cad.v : transform(src.cad.v, pose.T), src.cad.f, cadColors);
      result.object = true;
    }
    if (src && id==='gt') {
      const h=src.hand, packed=h.frames[frame];
      const verts=[];
      for (let i=0; i<packed.length; i+=3) {
        verts.push([h.origin[0]+packed[i]/10000, h.origin[1]+packed[i+1]/10000, h.origin[2]+packed[i+2]/10000]);
      }
      add(verts,h.f,handColors);
      result.hand=true;
    }
    if ((id==='actual' || id==='baseline') && pose && assets.robot && assets[id]) {
      const matrices=assets[id].frames[frame];
      if (matrices) {
        for (const part of assets.robot.parts) add(move(part.v,matrices[part.slot]),part.f,handColors);
        result.hand=true;
      }
    }
    triangles.sort((a,b) => a[3]-b[3]);
    for (const [p,q,r,,color] of triangles) {
      ctx.beginPath();
      ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.lineTo(r[0],r[1]); ctx.closePath();
      ctx.fillStyle=color; ctx.fill();
    }
    ctx.canvas.dataset.surfaceHand=String(result.hand);
    ctx.canvas.dataset.surfaceObject=String(result.object);
    ctx.canvas.dataset.handMesh=String(result.hand);
    ctx.canvas.dataset.objectMesh=String(result.object);
    return result;
  };
})();
