
// Safety: remove any old service workers if they exist (from earlier builds)
if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister())).catch(()=>{});}

(function(){
  let map, marker, polyline; let watchId=null; let points=[]; let totalKm=0; let startTime=null, stopTime=null;
  const $=id=>document.getElementById(id);
  const statusEl=$('status'), kmEl=$('km');

  function init(){
    map=L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    polyline=L.polyline([], {color:'#1976d2',weight:5}).addTo(map);
    map.setView([58.5877,16.1924],12);
  }
  init();

  function dist(a,b){const R=6371;const dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;const la1=a.lat*Math.PI/180,la2=b.lat*Math.PI/180;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  function updateKm(){ kmEl.textContent=`Totalt: ${totalKm.toFixed(2)} km`; }

  $('startBtn').onclick=()=>{
    points=[]; totalKm=0; startTime=new Date(); stopTime=null; updateKm();
    statusEl.textContent='Status: Registrerar…';
    polyline.setLatLngs([]); if(marker){ map.removeLayer(marker); marker=null; }
    watchId=navigator.geolocation.watchPosition(onPos,onErr,{enableHighAccuracy:true,maximumAge:1000,timeout:15000});
    $('startBtn').disabled=true; $('stopBtn').disabled=false;
    $('exportExcelBtn').disabled=true; $('exportPdfBtn').disabled=true;
  };

  function onPos(pos){
    const {latitude,longitude}=pos.coords; const p={lat:latitude,lon:longitude,ts:Date.now()};
    if(points.length){ const km=dist(points[points.length-1],p); if(km<2){ totalKm+=km; updateKm(); } }
    else { map.setView([p.lat,p.lon],15); }
    points.push(p); polyline.addLatLng([p.lat,p.lon]);
    if(!marker) marker=L.marker([p.lat,p.lon]).addTo(map); marker.setLatLng([p.lat,p.lon]);
  }
  function onErr(err){ statusEl.textContent='Geo-fel: '+err.message; }

  $('stopBtn').onclick=()=>{
    if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; }
    stopTime=new Date(); statusEl.textContent='Status: Klar';
    $('startBtn').disabled=false; $('stopBtn').disabled=true;
    const enabled=points.length>0; $('exportExcelBtn').disabled = $('exportPdfBtn').disabled = !enabled;
  };

  function buildTrip(){ return { date:(startTime||new Date()).toISOString().slice(0,10), startTime:startTime?startTime.toISOString():null, stopTime:stopTime?stopTime.toISOString():null, totalKm:Number(totalKm.toFixed(3)), points:points.slice() }; }

  function rowsFromTrip(t){ const r=[["Datum",t.date],["Starttid",t.startTime||''],["Stopptid",t.stopTime||''],["Total km",t.totalKm],[],["Tid (ISO)","Lat","Lon"]]; for(const p of t.points) r.push([new Date(p.ts).toISOString(),p.lat,p.lon]); return r; }
  $('exportExcelBtn').onclick=()=>{ const t=buildTrip(); const wb=XLSX.utils.book_new(), ws=XLSX.utils.aoa_to_sheet(rowsFromTrip(t)); XLSX.utils.book_append_sheet(wb,ws,'Resa'); const safe=(t.date||'resa').replace(/[^0-9A-Za-z_-]/g,'-'); XLSX.writeFile(wb,`resa_${safe}.xlsx`); };
  $('exportPdfBtn').onclick=()=>{ const t=buildTrip(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:'a4'}); let y=40; doc.setFontSize(16); doc.text('Reselogger – Rapport',40,y); y+=24; doc.setFontSize(12); for(const line of [`Datum: ${t.date}`,`Starttid: ${t.startTime||''}`,`Stopptid: ${t.stopTime||''}`,`Total sträcka: ${t.totalKm.toFixed(2)} km`]){ doc.text(line,40,y); y+=18; } y+=8; doc.text('Tid (ISO)',40,y); doc.text('Lat',280,y); doc.text('Lon',380,y); y+=16; const step=Math.max(1,Math.floor(t.points.length/40)); for(let i=0;i<t.points.length;i+=step){ const p=t.points[i]; doc.text(new Date(p.ts).toISOString(),40,y); doc.text((p.lat||0).toFixed(6),280,y); doc.text((p.lon||0).toFixed(6),380,y); y+=16; if(y>800){ doc.addPage(); y=40; } } const safe=(t.date||'resa').replace(/[^0-9A-Za-z_-]/g,'-'); doc.save(`resa_${safe}.pdf`); };
})();
