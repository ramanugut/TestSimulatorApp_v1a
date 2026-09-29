/* node tests/editable-diagram-ui.test.cjs; requires jsdom@25 only. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const dom=new JSDOM("<!doctype html><html><body></body></html>",{
  url:"http://localhost/",runScripts:"outside-only"
});
const win=dom.window;
const paintCalls=[];
const ctx={
  fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},ellipse(){},
  arc(){},fill(){},stroke(){},quadraticCurveTo(){},closePath(){},setLineDash(){},
  drawImage(){},fillText(label){paintCalls.push(label);},
  measureText(value){return {width:String(value).length*9};},
  lineWidth:2,fillStyle:"#fff",strokeStyle:"#123",lineCap:"round",lineJoin:"round"
};
win.HTMLCanvasElement.prototype.getContext=function(){return ctx;};
win.HTMLCanvasElement.prototype.toDataURL=function(type){
  return "data:image/"+(type==="image/png"?"png":"jpeg")+";base64,dGVzdA==";
};
win.eval(fs.readFileSync("editable-diagram.js","utf8"));
win.eval(fs.readFileSync("answer-workspace.js","utf8"));
let saved=null,events=0;
const question={answerType:"uml-diagram"};
const host=win.AnswerWorkspace.createDiagram(question,null,value=>{saved=value;events++;},false);
win.document.body.appendChild(host);
const canvas=host.querySelector("canvas");
canvas.getBoundingClientRect=()=>({left:0,top:0,width:960,height:560});
const label=host.querySelector(".uml-label-input");
const ptr=(name,x,y)=>canvas.dispatchEvent(new win.MouseEvent(name,{clientX:x,clientY:y,bubbles:true,cancelable:true}));
const tool=id=>{
  const target=host.querySelector('[data-tool="'+id+'"]');
  assert.ok(target,"Available tool "+id);
  target.click();
};
label.value="Place order";
ptr("pointerdown",100,80);ptr("pointermove",310,170);ptr("pointerup",310,170);
assert.ok(saved?.image?.startsWith("data:image/jpeg;base64,"),"Image preview is available to AI");
assert.equal(saved.diagramModel.objects.length,1);
const firstId=saved.diagramModel.objects[0].id;
assert.deepEqual([saved.diagramModel.objects[0].x,saved.diagramModel.objects[0].y],[100,80]);
assert.equal(host.querySelector('[data-tool="move"]').getAttribute("aria-pressed"),"true",
  "Switch to Move automatically after drawing");
ptr("pointerdown",175,115);ptr("pointermove",230,145);ptr("pointerup",230,145);
assert.deepEqual([saved.diagramModel.objects[0].x,saved.diagramModel.objects[0].y],[155,110],
  "Pointer drag moves an existing shape instead of painting over it");
tool("class");label.value="Order";
ptr("pointerdown",500,180);ptr("pointermove",730,340);ptr("pointerup",730,340);
assert.equal(saved.diagramModel.objects.length,2);
const secondId=saved.diagramModel.objects[1].id;
tool("arrow");ptr("pointerdown",230,145);ptr("pointermove",610,250);ptr("pointerup",610,250);
assert.equal(saved.diagramModel.objects.length,3);
const arrow=saved.diagramModel.objects[2];
assert.equal(arrow.fromId,firstId,"Connector snaps to first shape");
assert.equal(arrow.toId,secondId,"Connector snaps to second shape");
tool("move");
ptr("pointerdown",610,240);ptr("pointermove",660,290);ptr("pointerup",660,290);
assert.equal(saved.diagramModel.objects[1].x,550,"A connected shape remains movable");
assert.equal(saved.diagramModel.objects[1].y,230);
assert.equal(saved.diagramModel.objects[2].toId,secondId,"Arrow remains attached after a move");
label.value="Purchase";
label.dispatchEvent(new win.Event("input",{bubbles:true}));
assert.equal(saved.diagramModel.objects[1].label,"Purchase","Selected label can be changed");
assert.ok(paintCalls.includes("Purchase"),"New label appears in the drawing");
label.dispatchEvent(new win.Event("blur"));
const undo=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Undo");
const redo=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Redo");
undo.click();
assert.equal(saved.diagramModel.objects[1].label,"Order","Undo restores the previous label");
redo.click();
assert.equal(saved.diagramModel.objects[1].label,"Purchase","Redo reapplies the label");
ptr("pointerdown",655,295);
ptr("pointerup",655,295);
ptr("pointerdown",780,390);
ptr("pointermove",815,415);
ptr("pointerup",815,415);
assert.ok(saved.diagramModel.objects[1].w>=260,"Corner handle resizes the shape");
assert.ok(host.textContent.includes("Upload"),"Upload alternative retained");
assert.ok(events>=7,"Edits publish persistence updates");
const oldImage=saved.image;
let reopenedValue=null;
const reloaded=win.AnswerWorkspace.createDiagram(question,saved,value=>{reopenedValue=value;},false);
assert.equal(reloaded.querySelectorAll('[data-tool]').length>=14,true);
const resumedCanvas=reloaded.querySelector("canvas");
resumedCanvas.getBoundingClientRect=()=>({left:0,top:0,width:960,height:560});
const move=(type,x,y)=>resumedCanvas.dispatchEvent(new win.MouseEvent(type,{
  clientX:x,clientY:y,bubbles:true,cancelable:true
}));
move("pointerdown",650,290);move("pointermove",690,310);move("pointerup",690,310);
assert.ok(reopenedValue?.diagramModel?.objects[1].x>saved.diagramModel.objects[1].x,
  "Editable objects survive saving and reopening; they do not become flat pixels");
assert.ok(oldImage.startsWith("data:image/jpeg;base64,"));
let textOnly=null;
const blank=win.AnswerWorkspace.createDiagram(question,null,value=>{textOnly=value;},false);
const textarea=blank.querySelector("textarea");
textarea.value="Explanation only.";
textarea.dispatchEvent(new win.Event("input",{bubbles:true}));
assert.equal(textOnly.image,"","Text alone must not masquerade as an actual drawing");
console.log("Movable diagram UI tests passed: create, move, resize, attached arrow, rename, undo/redo, reopen, notes-only and upload.");
dom.window.close();
