// Coordinates are percentages in the top-view diagram, not device protocol IDs.
// The named IDs themselves come from the recovered MT760 profile.
export const MOUSE_PINS = [
  { id:0, x:44, y:22 }, { id:1, x:54.6, y:28 }, { id:2, x:64, y:23 },
  { id:3, x:82, y:78, label:'DIY · underside', to:[59,79] },
  { id:4, x:54.6, y:44 },
  { id:5, x:15, y:61, label:'Forward', to:[34,61] },
  { id:6, x:15, y:73, label:'Back', to:[35,67] },
  { id:7, x:32, y:53, arrow:'←' }, { id:8, x:43, y:53, arrow:'→' },
  { id:9, x:54.6, y:18, arrow:'↑' }, { id:10, x:54.6, y:37, arrow:'↓' },
];
export function buildMouseMap(container, buttons, select) {
  const stage=document.createElement('div');stage.className='mouse-map-stage';
  const image=document.createElement('img');image.src='/assets/mouse.svg';image.alt='Rapoo MT760L, top view';image.className='mouse-map-image';image.draggable=false;
  const eyebrow=document.createElement('span');eyebrow.className='map-view-label';eyebrow.textContent='MT760L / TOP VIEW';
  const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.setAttribute('viewBox','0 0 100 100');lines.setAttribute('preserveAspectRatio','none');lines.setAttribute('aria-hidden','true');lines.classList.add('map-connectors');
  stage.append(image,eyebrow,lines);
  for(const pin of MOUSE_PINS){
    if(pin.to){const line=document.createElementNS(lines.namespaceURI,'path');line.setAttribute('d',`M ${pin.x} ${pin.y} H ${(pin.x+pin.to[0])/2} L ${pin.to[0]} ${pin.to[1]}`);lines.append(line);}
    const target=buttons.find(b=>b.id===pin.id),button=document.createElement('button');button.type='button';button.className='mouse-pin';button.dataset.inputId=pin.id;button.style.left=`${pin.x}%`;button.style.top=`${pin.y}%`;
    button.setAttribute('aria-label',`Select ${target.name}`);button.setAttribute('aria-pressed','false');button.title=target.name;
    const number=document.createElement('span');number.className='pin-number';number.textContent=String(pin.id+1).padStart(2,'0');button.append(number);
    if(pin.arrow){const arrow=document.createElement('span');arrow.className='pin-arrow';arrow.textContent=pin.arrow;button.append(arrow);}
    if(pin.label){const label=document.createElement('span');label.className='pin-caption';label.textContent=pin.label;button.append(label);}
    button.addEventListener('click',()=>select(pin.id));stage.append(button);
  }
  const note=document.createElement('p');note.className='map-note';note.textContent='Click a numbered control to assign its action. Side and underside buttons are shown as callouts.';
  container.append(stage,note);
}
