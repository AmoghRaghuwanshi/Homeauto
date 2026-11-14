// Schematic room illustrations, not measured plans or representations of hardware.
const scenes = {
  'living-room': ['M25 62V48a8 8 0 0 1 8-8h54a8 8 0 0 1 8 8v14 M20 57h12v24h56V57h12v29H20Z M28 86v6 M92 86v6 M115 82V30 M102 30l7-17h13l7 17Z M111 86h9', 'M46 40v20 M73 40v20'],
  bedroom: ['M25 82V36a7 7 0 0 1 7-7h76a7 7 0 0 1 7 7v46 M20 63h100v23H20Z M27 86v7 M113 86v7 M33 40h28v17H33Z M79 40h28v17H79Z', 'M20 75h100 M130 62v22 M122 62h16'],
  kitchen: ['M20 35h100v49H20Z M20 60h100 M48 60v24 M86 60v24 M30 44h24v9H30Z M100 34V20h-9v14 M67 43h13 M67 49h13', 'M24 28h24V12H24Z M56 28h25V12H56Z M90 15h28v13H90'],
  entrance: ['M48 92V15h59v77 M54 92V22h47v70 M40 92h76 M86 54h6 M18 70h17v22H18Z M26 69V54 M20 56l6-12 6 12', 'M61 32h31v12H61Z M61 62h31v20H61Z'],
  hallway: ['M45 94V14h68v80 M52 94V22h53v72 M61 38h35v37H61Z M85 57h5 M22 92h110 M25 18v43 M18 18h14', 'M52 84h53 M119 28h15v25h-15Z'],
};
export function roomArt(id) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  for(const [k,v]of Object.entries({viewBox:'0 0 150 110',fill:'none','aria-hidden':'true',class:'room-art'}))svg.setAttribute(k,v);
  for(const [i,d]of (scenes[id]||scenes['living-room']).entries()){const p=document.createElementNS(ns,'path');for(const [k,v]of Object.entries({d,stroke:'currentColor','stroke-width':i?'1.5':'2','stroke-linecap':'round','stroke-linejoin':'round'}))p.setAttribute(k,v);svg.append(p);}return svg;
}
