/* Reusable question-specific answer workspaces.
   No module names, remote scripts, evaluation of submitted code, or paid UI calls. */
(function () {
  "use strict";
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function button(label, onClick, disabled) {
    const node = el("button", "answer-tool-button", label);
    node.type = "button";
    node.disabled = Boolean(disabled);
    node.addEventListener("click", onClick);
    return node;
  }
  function normalCell(value) {
    return String(value === undefined || value === null ? "" : value)
      .trim().replace(/\s+/g, " ").toLowerCase();
  }
  function gradeTable(question, answer) {
    const expected = Array.isArray(question.tableCorrectRows) ? question.tableCorrectRows : [];
    const cols = Array.isArray(question.tableColumns) ? question.tableColumns : [];
    const actual = answer && Array.isArray(answer.table) ? answer.table : [];
    let total=0, correct=0;
    expected.forEach((row, index) => {
      cols.forEach((column) => {
        const key=typeof column === "string" ? column : column.key;
        if (key === undefined) return;
        const reference=row && row[key];
        if (reference === undefined || reference === null || reference === "") return;
        total++;
        const got=normalCell(actual[index] && actual[index][key]);
        if (Array.isArray(reference)
          ? reference.some(item => got === normalCell(item))
          : got === normalCell(reference)) correct++;
      });
    });
    const extra = actual.slice(expected.length).some(row => cols.some(col => {
      const key=typeof col === "string" ? col : col.key;
      return normalCell(row && row[key]) !== "";
    }));
    if (extra) total++;
    const score=total ? correct / total : 0;
    return {score,correct,total,details:correct+" of "+total+" table cells correct"};
  }
  function createTable(question, initial, onChange, disabled) {
    const columns=(question.tableColumns || []).map((item) =>
      typeof item === "string" ? {key:item,label:item} : item).filter(item => item && item.key);
    const target=Math.max(1, Math.min(20,Number(question.tableRows)||3));
    const existing=initial && Array.isArray(initial.table) ? initial.table : [];
    const rows=Array.from({length:Math.max(target,Math.min(20,existing.length))},
      (_,i) => Object.assign({}, existing[i] || {}));
    const host=el("section","answer-workspace table-workspace");
    host.appendChild(el("p","answer-workspace-help",
      question.tableInstructions || "Complete each cell. Your answers are saved automatically."));
    const grid=el("div","editable-table");
    host.appendChild(grid);
    const commands=el("div","answer-workspace-actions");
    host.appendChild(commands);
    const status=el("small","answer-workspace-status","Editable table");
    host.appendChild(status);
    function emit() {
      const body=rows.map((row)=>columns.map(c => String(row[c.key] || "")).join(" | ")).join("\n");
      onChange({table:rows.map(row=>Object.assign({},row)),
        text:columns.map(c=>c.label||c.key).join(" | ")+"\n"+body});
    }
    function render() {
      grid.replaceChildren();
      if (document.body.classList.contains('new-look')) {
        const table=el('table','mockup-answer-table');
        const head=el('thead'), header=el('tr');
        columns.forEach(col=>header.appendChild(el('th','',col.label||col.key)));head.append(header);table.append(head);
        const body=el('tbody');
        rows.forEach((row,index)=>{
          const tr=el('tr');
          columns.forEach(col=>{
            const td=el('td'),input=el('input','editable-cell-input');input.type='text';input.value=String(row[col.key]||'');input.disabled=Boolean(disabled);input.autocomplete='off';input.setAttribute('aria-label',(col.label||col.key)+' row '+(index+1));
            input.addEventListener('input',()=>{row[col.key]=input.value;emit();});td.append(input);tr.append(td);
          });body.append(tr);
        });table.append(body);grid.append(table);return;
      }
      const heading=el("div","editable-table-heading");
      heading.textContent=columns.map(c=>c.label||c.key).join("  ·  ");
      grid.appendChild(heading);
      rows.forEach((row,index) => {
        const group=el("fieldset","editable-table-row");
        group.style.setProperty("--answer-table-columns",String(columns.length));
        const legend=el("legend","","Row "+(index+1)); group.appendChild(legend);
        columns.forEach(col => {
          const field=el("label","editable-table-cell");
          field.appendChild(el("span","",col.label||col.key));
          const input=el("input","editable-cell-input");
          input.type="text";
          input.value=String(row[col.key] || "");
          input.placeholder=col.placeholder || "Enter value";
          input.autocomplete="off"; input.disabled=Boolean(disabled);
          input.addEventListener("input",() => {row[col.key]=input.value;emit();});
          field.appendChild(input);group.appendChild(field);
        });
        grid.appendChild(group);
      });
      commands.replaceChildren();
      if (!question.tableFixedRows) {
        commands.appendChild(button("Add row",()=>{if(rows.length>=20)return;rows.push({});render();emit();},disabled||rows.length>=20));
        commands.appendChild(button("Remove last row",()=>{if(rows.length<=1)return;rows.pop();render();emit();},disabled||rows.length<=1));
      }
      status.textContent=rows.length+" row"+(rows.length===1?"":"s")+" · "+columns.length+" columns";
    }
    render();
    return host;
  }
  function createEditor(question, initial, onChange, disabled) {
    const type=question.answerType;
    const host=el("section","answer-workspace editor-workspace");
    host.appendChild(el("p","answer-workspace-help",
      type==="command" ? "Type the command exactly as you would use it in a terminal. Commands are not executed." :
        "Write your solution here. Use Tab to indent; code is never executed in this app."));
    const field=el("label","editor-label",type==="command"?"Command":"Code / pseudocode");
    const input=el("textarea","answer-code-input");
    input.rows=type==="command"?3:12;
    input.spellcheck=false;
    input.autocomplete="off";
    input.autocapitalize="off";
    input.setAttribute("autocorrect","off");
    input.setAttribute("aria-label",type==="command"?"Command answer":"Code answer");
    input.value=typeof initial==="string" ? initial : (initial && initial.text || "");
    input.disabled=Boolean(disabled);
    input.placeholder=type==="command"?"Enter a command, for example: ls -l /home":"Write code or pseudocode here...";
    input.addEventListener("input",()=>onChange(input.value));
    input.addEventListener("keydown",event=>{
      if(event.key!=="Tab"||event.shiftKey||disabled) return;
      event.preventDefault();
      const from=input.selectionStart,to=input.selectionEnd;
      input.setRangeText("  ",from,to,"end");onChange(input.value);
    });
    field.appendChild(input);host.appendChild(field);
    const note=el("small","answer-workspace-status",
      type==="code"?"Your code will be assessed against the stated rubric; it will not be run.":
      "Capitalisation and quoted text are preserved during command marking.");
    host.appendChild(note);
    return host;
  }
  function createImageEvidence(question, initial, onChange, disabled) {
    const state=initial && typeof initial==="object" && !Array.isArray(initial)
      ? {text:initial.text || "",image:initial.image || ""}:{text:"",image:""};
    const host=el("section","answer-workspace image-evidence-workspace");
    host.appendChild(el("p","answer-workspace-help",
      question.imageInstructions ||
      "Upload the screenshot or photo requested by the paper. Add a short note if the question also asks you to explain what the image shows."));
    const previewWrap=el("div","image-evidence-preview-wrap");
    const preview=el("img","image-evidence-preview");
    preview.alt=question.imageAlt || "Uploaded answer evidence preview";
    preview.hidden=!state.image;
    if(state.image) preview.src=state.image;
    previewWrap.appendChild(preview);host.appendChild(previewWrap);
    const actions=el("div","answer-workspace-actions");
    const uploadLabel=el("label","uml-upload",question.imageUploadLabel || "Upload screenshot / image");
    const upload=el("input");upload.type="file";upload.accept="image/png,image/jpeg,image/webp";upload.disabled=Boolean(disabled);
    upload.setAttribute("aria-label",question.imageUploadLabel || "Upload screenshot or image");
    const removeButton=button("Remove image",()=>{
      state.image="";preview.removeAttribute("src");preview.hidden=true;
      removeButton.disabled=Boolean(disabled);
      onChange({image:"",text:state.text});
    },disabled||!state.image);
    upload.addEventListener("change",()=>{
      const file=upload.files && upload.files[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){
        alert("Select PNG, JPEG or WebP, maximum 8 MB.");upload.value="";return;
      }
      const reader=new FileReader();
      reader.onload=()=>{
        state.image=String(reader.result||"");
        preview.src=state.image;preview.hidden=!state.image;
        removeButton.disabled=Boolean(disabled)||!state.image;
        onChange({image:state.image,text:state.text});upload.value="";
      };
      reader.onerror=()=>{alert("Unable to read this image.");upload.value="";};
      reader.readAsDataURL(file);
    });
    uploadLabel.appendChild(upload);actions.appendChild(uploadLabel);
    actions.appendChild(removeButton);
    host.appendChild(actions);
    const notes=el("label","editor-label",question.imageNotesLabel || "Optional notes");
    const textarea=el("textarea","text-area-input");textarea.rows=4;
    textarea.value=state.text;textarea.disabled=Boolean(disabled);
    textarea.placeholder=question.imageNotesPlaceholder || "Explain what the screenshot proves, if needed.";
    textarea.addEventListener("input",()=>{state.text=textarea.value;onChange({image:state.image,text:state.text});});
    notes.appendChild(textarea);host.appendChild(notes);
    host.appendChild(el("small","answer-workspace-status",
      "The image stays with this answer in the browser. PNG, JPEG and WebP are supported up to 8 MB."));
    return host;
  }
  function createDiagram(question, initial, onChange, disabled) {
    if (window.EditableDiagram && typeof window.EditableDiagram.create === "function") {
      return window.EditableDiagram.create(question, initial, onChange, disabled);
    }
    const state=initial && typeof initial==="object" && !Array.isArray(initial)
      ? {text:initial.text || "",image:initial.image || ""}:{text:"",image:""};
    const host=el("section","answer-workspace uml-workspace");
    host.appendChild(el("p","answer-workspace-help",question.diagramInstructions ||
      "Choose a tool, drag to place a shape or connector, and label it. On a phone, use your finger. You can also upload an image."));
    const tools=el("div","uml-tool-strip");
    tools.setAttribute("role","toolbar");tools.setAttribute("aria-label","Diagram tools");
    host.appendChild(tools);
    const labelRow=el("label","uml-label-row","Label for next shape:");
    const labelText=el("input","uml-label-input");
    labelText.type="text";labelText.maxLength=90;labelText.placeholder="e.g. Customer / Place order";
    labelText.disabled=Boolean(disabled);
    labelRow.appendChild(labelText);host.appendChild(labelRow);
    const canvas=el("canvas","diagram-canvas uml-canvas");
    canvas.width=960;canvas.height=560;
    canvas.setAttribute("aria-label","Diagram drawing area. Select a shape tool and drag, or use the upload alternative.");
    canvas.style.touchAction="none";
    host.appendChild(canvas);
    const ctx=canvas.getContext("2d");
    const W=canvas.width,H=canvas.height;
    let tool="select-ellipse",active=false,start=null,beforePixels=null,previousSnapshot="",edited=false;
    const undo=[],redo=[];
    function white() {ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);ctx.strokeStyle="#172b4d";ctx.fillStyle="#172b4d";ctx.lineWidth=2.7;ctx.lineCap="round";ctx.lineJoin="round";ctx.font="20px sans-serif";}
    white();
    function persist(){state.image=canvas.toDataURL("image/jpeg",0.83);onChange({image:state.image,text:state.text});}
    function snapshot(){return canvas.toDataURL("image/png");}
    function restore(src,save) {
      const img=new Image();
      img.onload=()=>{white();ctx.drawImage(img,0,0,W,H);if(save)persist();};
      img.src=src;
    }
    if(state.image && /^data:image\//.test(state.image)) restore(state.image,false);
    function commit(before) {
      if(!before)return;
      undo.push(before);if(undo.length>18)undo.shift();redo.length=0;
      persist();
    }
    const choices=[
      ["select-ellipse","Use case ◯"],["class","Class ▣"],["activity","Action ▭"],
      ["decision","Decision ◇"],["actor","Actor"],["start","Start ●"],["end","End ◎"],
      ["line","Line"],["arrow","Arrow →"],["dashed-arrow","Dashed ⇢"],["pen","Pen"],["erase","Eraser"],["text","Text"]
    ];
    const nodes=[];
    choices.forEach(([id,title])=>{
      const b=button(title,()=>{tool=id;nodes.forEach(item=>item.setAttribute("aria-pressed",String(item.dataset.tool===tool)));},disabled);
      b.dataset.tool=id;b.setAttribute("aria-pressed",String(id===tool));tools.appendChild(b);nodes.push(b);
    });
    function pos(e){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(W,(e.clientX-r.left)*W/r.width)),y:Math.max(0,Math.min(H,(e.clientY-r.top)*H/r.height))};}
    function labelAt(x,y,maxWidth){const label=labelText.value.trim();if(!label)return;ctx.font="20px sans-serif";ctx.fillStyle="#172b4d";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label,x,y,Math.max(80,maxWidth||280));}
    function roundRect(x,y,w,h,r){
      const a=Math.min(r,w/2,h/2);
      ctx.beginPath();ctx.moveTo(x+a,y);ctx.lineTo(x+w-a,y);ctx.quadraticCurveTo(x+w,y,x+w,y+a);
      ctx.lineTo(x+w,y+h-a);ctx.quadraticCurveTo(x+w,y+h,x+w-a,y+h);
      ctx.lineTo(x+a,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-a);
      ctx.lineTo(x,y+a);ctx.quadraticCurveTo(x,y,x+a,y);ctx.closePath();
    }
    function draw(from,to) {
      const x=Math.min(from.x,to.x),y=Math.min(from.y,to.y);
      const w=Math.max(70,Math.abs(to.x-from.x)),h=Math.max(48,Math.abs(to.y-from.y));
      const cx=x+w/2,cy=y+h/2;
      ctx.strokeStyle="#172b4d";ctx.fillStyle="#172b4d";ctx.lineWidth=2.7;
      switch(tool){
        case "select-ellipse":ctx.beginPath();ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);ctx.stroke();labelAt(cx,cy,w-16);break;
        case "class":ctx.strokeRect(x,y,w,h);ctx.beginPath();ctx.moveTo(x,y+38);ctx.lineTo(x+w,y+38);ctx.stroke();labelAt(cx,y+19,w-8);break;
        case "activity":roundRect(x,y,w,h,14);ctx.stroke();labelAt(cx,cy,w-16);break;
        case "decision":ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(x+w,cy);ctx.lineTo(cx,y+h);ctx.lineTo(x,cy);ctx.closePath();ctx.stroke();labelAt(cx,cy,w*.67);break;
        case "actor":{const c=from.x;const top=from.y;ctx.beginPath();ctx.arc(c,top+16,13,0,Math.PI*2);
          ctx.moveTo(c,top+29);ctx.lineTo(c,top+83);ctx.moveTo(c-27,top+48);ctx.lineTo(c+27,top+48);
          ctx.moveTo(c,top+83);ctx.lineTo(c-25,top+111);ctx.moveTo(c,top+83);ctx.lineTo(c+25,top+111);ctx.stroke();
          labelAt(c,top+137,140);break;}
        case "start":ctx.beginPath();ctx.arc(from.x,from.y,15,0,Math.PI*2);ctx.fill();break;
        case "end":ctx.beginPath();ctx.arc(from.x,from.y,18,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(from.x,from.y,12,0,Math.PI*2);ctx.fill();break;
        case "line":case "arrow":case "dashed-arrow":{
          if(tool==="dashed-arrow")ctx.setLineDash([9,7]);
          ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
          ctx.setLineDash([]);
          if(tool==="arrow"||tool==="dashed-arrow"){
            const a=Math.atan2(to.y-from.y,to.x-from.x),p=15;
            ctx.beginPath();ctx.moveTo(to.x,to.y);
            ctx.lineTo(to.x-p*Math.cos(a-.48),to.y-p*Math.sin(a-.48));ctx.moveTo(to.x,to.y);
            ctx.lineTo(to.x-p*Math.cos(a+.48),to.y-p*Math.sin(a+.48));ctx.stroke();
          }
          if(labelText.value.trim()) labelAt((from.x+to.x)/2,(from.y+to.y)/2-14,250);
          break;
        }
        case "text":labelAt(from.x,from.y,400);break;
      }
    }
    canvas.addEventListener("pointerdown",e=>{
      if(disabled)return;e.preventDefault();
      const p=pos(e);start=p;previousSnapshot=snapshot();
      beforePixels=ctx.getImageData(0,0,W,H);edited=true;active=true;
      try{canvas.setPointerCapture(e.pointerId);}catch(_){}
      if(tool==="pen"||tool==="erase"){ctx.strokeStyle=tool==="erase"?"#ffffff":"#172b4d";ctx.lineWidth=tool==="erase"?23:3;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();}
      else if(["start","end","actor","text"].includes(tool)){draw(p,p);}
    });
    canvas.addEventListener("pointermove",e=>{
      if(!active||disabled)return;e.preventDefault();const p=pos(e);
      if(tool==="pen"||tool==="erase"){ctx.lineTo(p.x,p.y);ctx.stroke();return;}
      if(["start","end","actor","text"].includes(tool))return;
      ctx.putImageData(beforePixels,0,0);draw(start,p);
    });
    function finish(e){
      if(!active)return;active=false;
      const p=pos(e);if(!["pen","erase","start","end","actor","text"].includes(tool)){
        ctx.putImageData(beforePixels,0,0);draw(start,p);
      }
      beforePixels=null;edited=false;commit(previousSnapshot);
    }
    canvas.addEventListener("pointerup",finish);canvas.addEventListener("pointercancel",finish);
    const controls=el("div","answer-workspace-actions");
    controls.appendChild(button("Undo",()=>{
      if(!undo.length)return;const last=undo.pop();redo.push(snapshot());restore(last,true);
    },disabled));
    controls.appendChild(button("Redo",()=>{
      if(!redo.length)return;const next=redo.pop();undo.push(snapshot());restore(next,true);
    },disabled));
    controls.appendChild(button("Clear",()=>{
      const old=snapshot();white();commit(old);
    },disabled));
    const uploadLabel=el("label","uml-upload","Upload drawing (PNG / JPG / WebP)");
    const upload=el("input");upload.type="file";upload.accept="image/png,image/jpeg,image/webp";upload.disabled=Boolean(disabled);
    upload.setAttribute("aria-label","Upload a diagram image");
    upload.addEventListener("change",()=>{
      const file=upload.files && upload.files[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8*1024*1024){alert("Select PNG, JPEG or WebP, maximum 8 MB.");upload.value="";return;}
      const src=URL.createObjectURL(file),img=new Image(),old=snapshot();
      img.onload=()=>{white();const ratio=Math.min(W/img.width,H/img.height);const w=img.width*ratio,h=img.height*ratio;
        ctx.drawImage(img,(W-w)/2,(H-h)/2,w,h);URL.revokeObjectURL(src);commit(old);upload.value="";};
      img.onerror=()=>{URL.revokeObjectURL(src);alert("Unable to read this image.");upload.value="";};
      img.src=src;
    });
    uploadLabel.appendChild(upload);controls.appendChild(uploadLabel);host.appendChild(controls);
    const explanation=el("label","editor-label","Optional notes / diagram explanation");
    const textarea=el("textarea","text-area-input");textarea.rows=4;textarea.value=state.text;
    textarea.placeholder="Describe actors, relationships, conditions, multiplicities or flows if needed.";
    textarea.disabled=Boolean(disabled);
    textarea.addEventListener("input",()=>{state.text=textarea.value;onChange({text:state.text,image:state.image});});
    explanation.appendChild(textarea);host.appendChild(explanation);
    host.appendChild(el("small","answer-workspace-status",
      "Shapes are drawn locally. Upload is also available for pen-and-paper diagrams; your work is saved with this question."));
    return host;
  }
  window.AnswerWorkspace={createTable,createEditor,createImageEvidence,createDiagram,gradeTable};
}());
