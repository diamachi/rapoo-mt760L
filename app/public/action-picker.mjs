// Enhances the action select; the select remains the source of truth for encoding.
let closeCurrent;
export function createActionPicker(select, name) {
  const root=document.createElement('div');root.className='action-picker';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='action-picker-trigger';trigger.id=select.id+'-picker';
  trigger.setAttribute('aria-label',name+' action');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const popup=document.createElement('div');popup.className='action-picker-popup';popup.hidden=true;popup.id=select.id+'-choices';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Choose '+name.toLowerCase()+' action');trigger.setAttribute('aria-controls',popup.id);
  const search=document.createElement('input');search.type='search';search.placeholder='Search actions…';search.setAttribute('aria-label','Search '+name.toLowerCase()+' actions');search.autocomplete='off';
  const list=document.createElement('div');list.className='action-picker-options';
  const close=(restore=false)=>{popup.hidden=true;trigger.setAttribute('aria-expanded','false');if(closeCurrent===close)closeCurrent=null;if(restore)trigger.focus();};
  const render=()=>{
    list.replaceChildren();const query=search.value.trim().toLowerCase();
    for(const group of select.querySelectorAll('optgroup')){
      const matches=[...group.children].filter(option=>(group.label+' '+option.textContent).toLowerCase().includes(query));if(!matches.length)continue;
      const title=document.createElement('p');title.className='action-picker-group';title.textContent=group.label;list.append(title);
      for(const option of matches){const choice=document.createElement('button');choice.type='button';choice.className='action-picker-option';choice.textContent=option.textContent;choice.setAttribute('aria-pressed',String(option.value===select.value));choice.addEventListener('click',()=>{if(select.disabled)return;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);});list.append(choice);}
    }
    if(!list.children.length){const empty=document.createElement('p');empty.className='action-picker-empty';empty.textContent='No matching actions';list.append(empty);}
  };
  const open=()=>{if(select.disabled)return;closeCurrent?.();closeCurrent=close;search.value='';render();const rect=trigger.getBoundingClientRect(),below=innerHeight-rect.bottom-18,above=rect.top-18,up=below<220&&above>below;root.classList.toggle('opens-up',up);list.style.maxHeight=Math.max(100,Math.min(290,(up?above:below)-88))+'px';popup.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus();};
  const sync=()=>{trigger.textContent=select.selectedOptions[0]?.textContent||'Choose an action';trigger.disabled=select.disabled;if(select.disabled)close();};
  trigger.addEventListener('click',()=>popup.hidden?open():close());
  trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open();}});
  search.addEventListener('input',render);
  popup.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close(true);return;}
    const choices=[...list.querySelectorAll('button')];if(!choices.length)return;
    const index=choices.indexOf(document.activeElement);
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();choices[(index+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length].focus();}
    if(event.key==='Home'&&index>=0){event.preventDefault();choices[0].focus();}
    if(event.key==='End'&&index>=0){event.preventDefault();choices.at(-1).focus();}
  });
  root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))close();});
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close();});
  select.hidden=true;select.tabIndex=-1;popup.append(search,list);root.append(trigger,popup);sync();
  return {element:root,sync,close,trigger};
}
