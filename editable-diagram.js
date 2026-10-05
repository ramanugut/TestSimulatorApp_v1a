/* Retained-object diagram editor shared by all modules. Runs offline.
   Saved answers include diagramModel (editable objects) and image (AI preview).
   Older image-only drawings load as a flat background; new objects remain editable. */
(function () {
  "use strict";
  const W=960,H=560;
  const TYPES=[
    ["move","Move"],
    ["box","Box"],
    ["usecase","Use case ◯"],
    ["actor","Actor"],
    ["class","Class ▣"],
    ["entity","ERD Entity ▭"],
    ["attribute","ERD Attribute ◯"],
    ["relationship","ERD Relationship ◇"],
    ["boundary","Boundary □"],
    ["action","Action ▭"],
    ["decision","Decision ◇"],
    ["start","Start ●"],
    ["end","End ◎"],
    ["line","Line"],
    ["arrow","Arrow →"],
    ["dashed","Dashed ⇢"],
    ["text","Text"],
    ["pen","Pen"]
  ];
  const NODE_TYPES=new Set(["box","usecase","actor","class","entity","attribute","relationship","boundary","action","decision","start","end","text"]);
  const LINE_TYPES=new Set(["line","arrow","dashed"]);
  const button=(label,callback,disabled)=>{
    const b=document.createElement("button");
    b.type="button";b.className="answer-tool-button";b.textContent=label;
    b.disabled=!!disabled;b.addEventListener("click",callback);
    return b;
  };
  const elem=(tag,cls,text)=>{
    const node=document.createElement(tag);if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const shapeDefaults=type=>{
    switch(type){
      case "actor":return [95,154];
      case "usecase":return [195,84];
      case "attribute":return [175,72];
      case "class":return [195,135];
      case "entity":return [205,92];
      case "relationship":return [145,95];
      case "boundary":return [450,310];
      case "action":return [190,78];
      case "decision":return [125,95];
      case "start":case "end":return [44,44];
      case "text":return [210,40];
      default:return [140,80];
    }
  };
  const centre=node=>({x:node.x+node.w/2,y:node.y+node.h/2});
  const distance=(p,a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1):0;
    return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
  };
  function create(question,initial,onChange,disabled) {
    const saved=initial && typeof initial==="object" && initial.diagramModel;
    let model=saved && saved.version===1 && Array.isArray(saved.objects)
      ? clone(saved)
      : {version:1,objects:[],backgroundSrc:initial && initial.image || ""};
    model.objects=model.objects.slice(0,180);
    let selected=null, tool=model.objects.length?"move":"usecase", gesture=null, background=null, imageRequest=0;
    const undo=[],redo=[];
    const host=elem("section","answer-workspace uml-workspace editable-uml-workspace");
    host.appendChild(elem("p","answer-workspace-help",
      question.diagramInstructions ||
      "Choose a shape and drag to create it. New shapes can be selected, moved, resized and renamed. Connectors follow their shapes."));
    const bar=elem("div","uml-tool-strip");bar.setAttribute("role","toolbar");bar.setAttribute("aria-label","Diagram drawing tools");
    host.appendChild(bar);
    const toolButtons=new Map();
    const tools=Array.isArray(question.diagramTools) && question.diagramTools.length
      ? ["move",...question.diagramTools.filter(id=>id!=="move")].map(id=>TYPES.find(type=>type[0]===id)).filter(Boolean) : TYPES.filter(([id])=>id!=="box");
    function setTool(next){
      if(next!=="move"&&selected){
        selected=null;
        labelInput.value="";
        paint(true);
      }
      tool=next;
      for(const [id,b] of toolButtons) b.setAttribute("aria-pressed",String(id===next));
      canvas.style.cursor=next==="move"?"grab":next==="pen"?"crosshair":"crosshair";
      announce(next==="move"?"Tap a shape to select it, then drag to move. Drag the corner handle to resize.":
        "Drag on the page to place "+next+". New shapes switch to Move after creation.");
    }
    tools.forEach(([id,label])=>{
      const b=button(label,()=>setTool(id),disabled);
      b.dataset.tool=id;b.setAttribute("aria-pressed",String(id===tool));
      bar.appendChild(b);toolButtons.set(id,b);
    });
    const labelRow=elem("label","uml-label-row","Shape label");
    const labelInput=elem("input","uml-label-input");
    labelInput.type="text";labelInput.maxLength=120;
    labelInput.placeholder="e.g. Customer or Check stock";labelInput.disabled=!!disabled;
    labelInput.setAttribute("aria-label","New shape or selected shape label");
    labelRow.appendChild(labelInput);host.appendChild(labelRow);
    const canvas=elem("canvas","diagram-canvas uml-canvas");
    canvas.width=W;canvas.height=H;canvas.tabIndex=disabled?-1:0;
    canvas.setAttribute("aria-label","Editable diagram canvas: tap or click a shape using Move, drag to move it, and drag its bottom-right handle to resize.");
    canvas.style.touchAction="none";host.appendChild(canvas);
    const ctx=canvas.getContext("2d");
    const controls=elem("div","answer-workspace-actions");host.appendChild(controls);
    const status=elem("small","answer-workspace-status","Choose a shape and drag to add it.");
    status.setAttribute("role","status");host.appendChild(status);
    const announce=message=>{status.textContent=message;};
    let keySerial=0;
    function nextId(){return "shape-"+Date.now().toString(36)+"-"+(++keySerial);}
    function getNode(id){return model.objects.find(o=>o.id===id&&NODE_TYPES.has(o.type));}
    function getObject(id){return model.objects.find(o=>o.id===id);}
    function point(e){
      const box=canvas.getBoundingClientRect();
      return {x:clamp((e.clientX-box.left)*W/Math.max(1,box.width),0,W),
        y:clamp((e.clientY-box.top)*H/Math.max(1,box.height),0,H)};
    }
    function nearShape(p) {
      for(let i=model.objects.length-1;i>=0;i--){
        const o=model.objects[i];
        if(!NODE_TYPES.has(o.type))continue;
        const pad=o.type==="boundary"?8:13;
        // Boundary should not absorb a click in its large empty centre.
        if(o.type==="boundary"){
          const inside=p.x>=o.x-pad&&p.x<=o.x+o.w+pad&&p.y>=o.y-pad&&p.y<=o.y+o.h+pad;
          const close=inside&&(Math.min(Math.abs(p.x-o.x),Math.abs(p.x-o.x-o.w),
            Math.abs(p.y-o.y),Math.abs(p.y-o.y-o.h))<=pad);
          if(close)return o;continue;
        }
        if(p.x>=o.x-pad&&p.x<=o.x+o.w+pad&&p.y>=o.y-pad&&p.y<=o.y+o.h+pad)return o;
      }
      return null;
    }
    function anchor(node,toward) {
      const c=centre(node),dx=toward.x-c.x,dy=toward.y-c.y;
      if(Math.abs(dx)+Math.abs(dy)<.01)return c;
      const rx=Math.max(8,node.w/2),ry=Math.max(8,node.h/2);
      const ellipse=["usecase","start","end"].includes(node.type);
      let scale=ellipse?1/Math.sqrt((dx*dx)/(rx*rx)+(dy*dy)/(ry*ry)):
        1/Math.max(Math.abs(dx)/rx,Math.abs(dy)/ry);
      if(node.type==="actor"||node.type==="text")scale=.68*scale;
      return {x:c.x+dx*scale,y:c.y+dy*scale};
    }
    function ends(o){
      const left=getNode(o.fromId),right=getNode(o.toId);
      let a={x:o.x1,y:o.y1},b={x:o.x2,y:o.y2};
      if(left&&right){a=anchor(left,centre(right));b=anchor(right,centre(left));}
      else if(left)a=anchor(left,b);
      else if(right)b=anchor(right,a);
      return [a,b];
    }
    function objectAt(p) {
      const hit=nearShape(p);if(hit)return hit;
      for(let i=model.objects.length-1;i>=0;i--){
        const o=model.objects[i];
        if(LINE_TYPES.has(o.type)){
          const [a,b]=ends(o);
          if(distance(p,a,b)<=16)return o;
        }else if(o.type==="pen"&&Array.isArray(o.points)){
          if(o.points.some((pt,i)=>i>0&&distance(p,o.points[i-1],pt)<=13))return o;
        }
      }
      return null;
    }
    function setupContext(){
      ctx.fillStyle="#ffffff";ctx.fillRect(0,0,W,H);
      if(background&&background.complete&&background.naturalWidth){
        ctx.drawImage(background,0,0,W,H);
      }
      ctx.strokeStyle="#172b4d";ctx.fillStyle="#172b4d";ctx.lineWidth=2.8;
      ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash([]);
      ctx.font="20px Arial, sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    }
    function drawLabel(text,x,y,width){
      if(!text)return;
      ctx.fillStyle="#172b4d";ctx.font="19px Arial, sans-serif";
      ctx.textAlign="center";ctx.textBaseline="middle";
      const words=String(text).split(/\s+/),rows=[],max=Math.max(72,width);
      let line="";
      for(const word of words){
        const check=line?line+" "+word:word;
        if(line&&ctx.measureText(check).width>max){rows.push(line);line=word;}else line=check;
      }
      if(line)rows.push(line);
      rows.slice(0,4).forEach((row,i)=>ctx.fillText(row,x,y+(i-(Math.min(rows.length,4)-1)/2)*22,max));
    }
    function rectRound(x,y,w,h,r){
      const a=Math.min(r,w/2,h/2);
      ctx.beginPath();ctx.moveTo(x+a,y);ctx.lineTo(x+w-a,y);ctx.quadraticCurveTo(x+w,y,x+w,y+a);
      ctx.lineTo(x+w,y+h-a);ctx.quadraticCurveTo(x+w,y+h,x+w-a,y+h);
      ctx.lineTo(x+a,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-a);
      ctx.lineTo(x,y+a);ctx.quadraticCurveTo(x,y,x+a,y);ctx.closePath();
    }
    function drawNode(o){
      const x=o.x,y=o.y,w=o.w,h=o.h,c=centre(o);
      ctx.lineWidth=2.8;ctx.strokeStyle="#172b4d";ctx.fillStyle="#fff";ctx.setLineDash([]);
      switch(o.type){
        case "usecase":case "attribute":
          ctx.beginPath();ctx.ellipse(c.x,c.y,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
          drawLabel(o.label,c.x,c.y,w-28);break;
        case "boundary":
          ctx.strokeRect(x,y,w,h);if(o.label){ctx.fillStyle="#172b4d";ctx.textAlign="left";
            ctx.fillText(o.label,x+12,y+18,w-20);}break;
        case "box":case "entity":
          ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
          drawLabel(o.label,c.x,c.y,w-18);break;
        case "class":
          ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
          ctx.beginPath();ctx.moveTo(x,y+40);ctx.lineTo(x+w,y+40);
          ctx.moveTo(x,y+Math.min(h-18,80));ctx.lineTo(x+w,y+Math.min(h-18,80));ctx.stroke();
          drawLabel(o.label,c.x,y+20,w-12);break;
        case "action":
          rectRound(x,y,w,h,13);ctx.fill();ctx.stroke();drawLabel(o.label,c.x,c.y,w-24);break;
        case "decision":case "relationship":
          ctx.beginPath();ctx.moveTo(c.x,y);ctx.lineTo(x+w,c.y);ctx.lineTo(c.x,y+h);
          ctx.lineTo(x,c.y);ctx.closePath();ctx.fill();ctx.stroke();
          drawLabel(o.label,c.x,c.y,w*.65);break;
        case "start":case "end":
          ctx.fillStyle="#172b4d";ctx.beginPath();ctx.arc(c.x,c.y,Math.min(w,h)*.34,0,Math.PI*2);
          if(o.type==="end"){ctx.stroke();ctx.beginPath();ctx.arc(c.x,c.y,Math.min(w,h)*.23,0,Math.PI*2);}
          ctx.fill();break;
        case "actor":{
          const head=Math.max(10,Math.min(w*.16,h*.1)),top=y+8;
          ctx.fillStyle="#172b4d";ctx.beginPath();ctx.arc(c.x,top+head,head,0,Math.PI*2);
          ctx.moveTo(c.x,top+head*2);ctx.lineTo(c.x,y+h*.65);
          ctx.moveTo(x+w*.21,y+h*.4);ctx.lineTo(x+w*.79,y+h*.4);
          ctx.moveTo(c.x,y+h*.65);ctx.lineTo(x+w*.24,y+h*.86);
          ctx.moveTo(c.x,y+h*.65);ctx.lineTo(x+w*.76,y+h*.86);ctx.stroke();
          drawLabel(o.label,c.x,y+h*.95,Math.max(110,w*1.5));break;
        }
        case "text":drawLabel(o.label,c.x,c.y,w);break;
      }
    }
    function drawLine(o){
      const [a,b]=ends(o);
      ctx.strokeStyle="#172b4d";ctx.fillStyle="#172b4d";ctx.lineWidth=2.6;
      ctx.setLineDash(o.type==="dashed"?[10,7]:[]);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
      if(o.type!=="line"){
        const angle=Math.atan2(b.y-a.y,b.x-a.x),len=15;
        ctx.beginPath();ctx.moveTo(b.x,b.y);
        ctx.lineTo(b.x-len*Math.cos(angle-.48),b.y-len*Math.sin(angle-.48));
        ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-len*Math.cos(angle+.48),b.y-len*Math.sin(angle+.48));ctx.stroke();
      }
      if(o.label){
        const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2-15};
        ctx.fillStyle="#ffffff";const tw=Math.min(230,Math.max(48,o.label.length*10));
        ctx.fillRect(m.x-tw/2-5,m.y-13,tw+10,26);
        drawLabel(o.label,m.x,m.y,tw);
      }
    }
    function drawPen(o){
      if(!o.points||!o.points.length)return;
      ctx.strokeStyle="#172b4d";ctx.lineWidth=3;ctx.setLineDash([]);
      ctx.beginPath();o.points.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.stroke();
    }
    function paint(selection=true){
      if(!ctx)return;
      setupContext();
      model.objects.forEach(o=>{if(LINE_TYPES.has(o.type))drawLine(o);});
      model.objects.forEach(o=>{if(NODE_TYPES.has(o.type))drawNode(o);});
      model.objects.forEach(o=>{if(o.type==="pen")drawPen(o);});
      if(selection&&selected){
        const o=getObject(selected);if(o){
          ctx.strokeStyle="#168056";ctx.fillStyle="#168056";ctx.setLineDash([7,5]);ctx.lineWidth=2;
          if(NODE_TYPES.has(o.type)){
            ctx.strokeRect(o.x-5,o.y-5,o.w+10,o.h+10);ctx.setLineDash([]);
            ctx.fillRect(o.x+o.w-5,o.y+o.h-5,14,14);
          }else if(LINE_TYPES.has(o.type)){
            const [a,b]=ends(o);ctx.beginPath();ctx.arc(a.x,a.y,6,0,Math.PI*2);
            ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();
          }else ctx.strokeRect(0,0,W,H);
          ctx.setLineDash([]);
        }
      }
    }
    function exportImage(){paint(false);const image=canvas.toDataURL("image/jpeg",.82);paint(true);return image;}
    function persist(){
      // Do not send a white canvas as proof of a drawing when only notes exist.
      const hasVisual=model.objects.length>0||Boolean(model.backgroundSrc);
      onChange({text:notes.value,image:hasVisual?exportImage():"",diagramModel:clone(model)});
    }
    function pushUndo(){
      undo.push(clone(model));if(undo.length>24)undo.shift();redo.length=0;
      updateControls();
    }
    function updateControls(){
      undoButton.disabled=!!disabled||undo.length===0;
      redoButton.disabled=!!disabled||redo.length===0;
      deleteButton.disabled=!!disabled||!selected;
    }
    function changeSelection(o){
      selected=o?o.id:null;
      labelInput.value=o?(o.label||""):"";
      updateControls();paint(true);
      if(o)announce("Selected "+o.type+". Drag to move, corner to resize, or edit the Shape label.");
    }
    let labelHistory=false;
    labelInput.addEventListener("focus",()=>{labelHistory=false;});
    labelInput.addEventListener("input",()=>{
      if(disabled||!selected)return;
      const o=getObject(selected);if(!o)return;
      if(!labelHistory){pushUndo();labelHistory=true;}
      o.label=labelInput.value;paint(true);persist();
    });
    labelInput.addEventListener("blur",()=>{labelHistory=false;});
    function setBackground(src,saveAfterLoad=false){
      const seq=++imageRequest;
      background=null;
      if(!src){paint(true);if(saveAfterLoad)persist();return;}
      const img=new Image();
      img.onload=()=>{if(seq!==imageRequest)return;background=img;paint(true);if(saveAfterLoad)persist();};
      img.onerror=()=>{if(seq!==imageRequest)return;announce("Previous image could not be loaded.");paint(true);if(saveAfterLoad)persist();};
      img.src=src;
    }
    function createShape(type,start,end){
      const [dw,dh]=shapeDefaults(type);
      const dx=Math.abs(end.x-start.x),dy=Math.abs(end.y-start.y);
      const click=dx<15&&dy<15;
      let x=click?start.x-dw/2:Math.min(start.x,end.x);
      let y=click?start.y-dh/2:Math.min(start.y,end.y);
      let w=click?dw:Math.max(type==="start"||type==="end"?32:55,dx);
      let h=click?dh:Math.max(type==="start"||type==="end"?32:38,dy);
      if(type==="start"||type==="end"){const diameter=Math.max(w,h);w=diameter;h=diameter;}
      x=clamp(x,0,W-w);y=clamp(y,0,H-h);
      return {id:nextId(),type,x,y,w,h,label:labelInput.value.trim()};
    }
    function shiftBy(o,dx,dy){
      if(NODE_TYPES.has(o.type)){
        o.x=clamp(o.x+dx,0,W-o.w);o.y=clamp(o.y+dy,0,H-o.h);
      } else if(LINE_TYPES.has(o.type)){
        if(!o.fromId){o.x1=clamp(o.x1+dx,0,W);o.y1=clamp(o.y1+dy,0,H);}
        if(!o.toId){o.x2=clamp(o.x2+dx,0,W);o.y2=clamp(o.y2+dy,0,H);}
      } else if(o.points) o.points.forEach(p=>{p.x=clamp(p.x+dx,0,W);p.y=clamp(p.y+dy,0,H);});
    }
    function resetSelect(){setTool("move");}
    canvas.addEventListener("pointerdown",e=>{
      if(disabled)return;
      e.preventDefault();const p=point(e),hit=objectAt(p);
      try{canvas.setPointerCapture(e.pointerId);}catch(_){}
      if(tool==="move"){
        if(!hit){changeSelection(null);gesture=null;return;}
        changeSelection(hit);
        const resize=NODE_TYPES.has(hit.type)&&hit.type!=="text"&&
          Math.abs(p.x-(hit.x+hit.w))<=23&&Math.abs(p.y-(hit.y+hit.h))<=23;
        gesture={type:resize?"resize":"move",id:hit.id,last:p,original:p,previous:p,changed:false};
        return;
      }
      if(model.objects.length>=180){announce("Diagram has reached its 180-element limit.");return;}
      if(LINE_TYPES.has(tool)){
        const from=nearShape(p);
        gesture={type:"link",fromId:from?from.id:null,start:p,last:p};
      }else if(tool==="pen"){
        gesture={type:"pen",start:p,last:p,points:[p]};
      }else {
        gesture={type:"create",kind:tool,start:p,last:p};
      }
    });
    canvas.addEventListener("pointermove",e=>{
      if(!gesture||disabled)return;e.preventDefault();
      const p=point(e),g=gesture;g.last=p;
      if(g.type==="move"||g.type==="resize"){
        const o=getObject(g.id);if(!o)return;
        if(!g.changed){pushUndo();g.changed=true;}
        const xDelta=p.x-g.previous.x;
        const yDelta=p.y-g.previous.y;
        if(g.type==="move")shiftBy(o,xDelta,yDelta);
        else {o.w=clamp(o.w+xDelta,32,W-o.x);o.h=clamp(o.h+yDelta,30,H-o.y);}
        g.previous=p;paint(true);return;
      }
      if(g.type==="pen"){if(Math.hypot(p.x-g.points[g.points.length-1].x,p.y-g.points[g.points.length-1].y)>=2)g.points.push(p);}
      paint(true);
      // Non-destructive preview until the pointer is released.
      if(g.type==="create")drawNode(createShape(g.kind,g.start,p));
      if(g.type==="link")drawLine({type:tool,x1:g.start.x,y1:g.start.y,x2:p.x,y2:p.y,label:labelInput.value.trim()});
      if(g.type==="pen")drawPen({points:g.points});
    });
    function finish(e){
      if(!gesture)return;
      const g=gesture;gesture=null;
      if(disabled)return;
      const p=point(e);
      if(g.type==="move"||g.type==="resize"){
        if(g.changed){paint(true);persist();announce(g.type==="move"?"Shape moved.":"Shape resized.");}
        return;
      }
      if(g.type==="create"){
        pushUndo();const o=createShape(g.kind,g.start,p);
        model.objects.push(o);changeSelection(o);resetSelect();persist();
      }else if(g.type==="link"){
        const from=g.fromId?getNode(g.fromId):null,to=nearShape(p);
        if(Math.hypot(p.x-g.start.x,p.y-g.start.y)<12&&!to){paint(true);return;}
        pushUndo();
        const o={id:nextId(),type:tool,x1:g.start.x,y1:g.start.y,x2:p.x,y2:p.y,
          fromId:from?from.id:null,toId:to?to.id:null,label:labelInput.value.trim()};
        model.objects.push(o);changeSelection(o);resetSelect();persist();
      }else if(g.type==="pen"&&g.points.length){
        pushUndo();const o={id:nextId(),type:"pen",points:g.points,label:""};
        model.objects.push(o);changeSelection(o);resetSelect();persist();
      }
    }
    canvas.addEventListener("pointerup",finish);
    canvas.addEventListener("pointercancel",finish);
    canvas.addEventListener("lostpointercapture",()=>{ /* pointerup/pointercancel performs commit */ });
    canvas.addEventListener("dblclick",event=>{
      if(disabled || !document.body.classList.contains('new-look')) return;
      const position=point(event), object=objectAt(position);
      if(!object || LINE_TYPES.has(object.type) || object.type==='pen') return;
      const label=prompt('Label',object.label||'');
      if(label!==null){pushUndo();object.label=label;selected=object.id;labelInput.value=label;paint(true);persist();}
    });
    const undoButton=button("Undo",()=>{
      if(!undo.length)return;redo.push(clone(model));model=undo.pop();selected=null;
      setBackground(model.backgroundSrc,true);updateControls();
    },disabled);
    const redoButton=button("Redo",()=>{
      if(!redo.length)return;undo.push(clone(model));model=redo.pop();selected=null;
      setBackground(model.backgroundSrc,true);updateControls();
    },disabled);
    const deleteButton=button("Delete selected",()=>{
      if(!selected)return;pushUndo();const id=selected;
      model.objects=model.objects.filter(o=>o.id!==id);
      for(const o of model.objects){if(LINE_TYPES.has(o.type)){
        if(o.fromId===id){o.fromId=null;}if(o.toId===id){o.toId=null;}
      }}
      selected=null;updateControls();paint(true);persist();
    },disabled);
    const clearButton=button("Clear",()=>{
      if(!confirm("Clear this entire diagram? You can still Undo."))return;
      pushUndo();model.objects=[];model.backgroundSrc="";selected=null;
      setBackground("");updateControls();paint(true);persist();
    },disabled);
    controls.append(undoButton,redoButton,deleteButton,clearButton);
    const uploadLabel=elem("label","uml-upload","Upload a diagram image");
    const upload=elem("input");upload.type="file";upload.accept="image/png,image/jpeg,image/webp";
    upload.disabled=!!disabled;upload.setAttribute("aria-label","Upload a diagram");
    upload.addEventListener("change",()=>{
      const file=upload.files&&upload.files[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){
        announce("Choose a PNG, JPEG or WebP image under 8 MB.");upload.value="";return;
      }
      const url=URL.createObjectURL(file),img=new Image();
      img.onload=()=>{
        const temp=document.createElement("canvas");temp.width=W;temp.height=H;
        const x=temp.getContext("2d");x.fillStyle="#ffffff";x.fillRect(0,0,W,H);
        const ratio=Math.min(W/img.width,H/img.height);
        const w=img.width*ratio,h=img.height*ratio;
        x.drawImage(img,(W-w)/2,(H-h)/2,w,h);
        pushUndo();model.objects=[];model.backgroundSrc=temp.toDataURL("image/jpeg",.8);
        selected=null;setBackground(model.backgroundSrc,true);updateControls();
        announce("Image uploaded as a background. You can draw and move new shapes on top.");
        URL.revokeObjectURL(url);upload.value="";
      };
      img.onerror=()=>{URL.revokeObjectURL(url);announce("Unable to read image.");upload.value="";};
      img.src=url;
    });
    uploadLabel.appendChild(upload);controls.appendChild(uploadLabel);
    const explanation=elem("label","editor-label","Optional notes / explanation");
    const notes=elem("textarea","text-area-input");notes.rows=4;
    notes.disabled=!!disabled;notes.value=initial&&typeof initial==="object"?initial.text||"":"";
    notes.placeholder="Explain any decision, relationship or special notation if needed.";
    notes.addEventListener("input",()=>persist());
    explanation.appendChild(notes);host.appendChild(explanation);
    canvas.addEventListener("keydown",e=>{
      if(disabled||!selected)return;
      if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();deleteButton.click();return;}
      const offsets={ArrowLeft:[-4,0],ArrowRight:[4,0],ArrowUp:[0,-4],ArrowDown:[0,4]};
      if(offsets[e.key]){e.preventDefault();pushUndo();shiftBy(getObject(selected),...offsets[e.key]);paint(true);persist();}
    });
    if(model.backgroundSrc) setBackground(model.backgroundSrc);
    updateControls();paint(true);
    host.appendChild(elem("small","answer-workspace-status",
      "Drag a selected shape to move it. Use its bottom-right handle to resize. Connectors attached to shapes follow when they move. Your diagram is saved automatically."));
    return host;
  }
  window.EditableDiagram={create};
}());
