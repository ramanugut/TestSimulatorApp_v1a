/* Browser-like answer workspace tests: npm i --no-save jsdom@25 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
const dom=new JSDOM("<!doctype html><html><body></body></html>",{
  url:"http://localhost/",runScripts:"outside-only"
});
const win=dom.window;
let labels=[];
const context={
  fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},ellipse(){},
  arc(){},fill(){},stroke(){},quadraticCurveTo(){},closePath(){},setLineDash(){},
  getImageData(){return {data:[],width:960,height:560};},putImageData(){},drawImage(){},
  fillText(text){labels.push(text);},font:"",fillStyle:"",strokeStyle:"",lineWidth:3
};
win.HTMLCanvasElement.prototype.getContext=function(){return context;};
win.HTMLCanvasElement.prototype.toDataURL=function(type){
  return "data:image/"+(type==="image/png"?"png":"jpeg")+";base64,ZGlhZ3JhbQ==";
};
win.eval(fs.readFileSync("answer-workspace.js","utf8"));
const ws=win.AnswerWorkspace;
assert.ok(ws && ws.createDiagram && ws.createTable && ws.createEditor && ws.gradeTable);
const tableQ={
  tableColumns:[{key:"name",label:"Name"},{key:"role",label:"Role"}],
  tableCorrectRows:[{name:"Customer",role:"Buyer"},{name:"Order",role:"Purchase"}],
  tableRows:2,tableFixedRows:true
};
let savedTable=null;
const table=ws.createTable(tableQ,null,value=>{savedTable=value;},false);
win.document.body.appendChild(table);
const inputs=table.querySelectorAll(".editable-cell-input");
assert.equal(inputs.length,4);
inputs[0].value="Customer";inputs[0].dispatchEvent(new win.Event("input",{bubbles:true}));
inputs[1].value="Buyer";inputs[1].dispatchEvent(new win.Event("input",{bubbles:true}));
assert.equal(savedTable.table[0].name,"Customer");
assert.equal(ws.gradeTable(tableQ,savedTable).score,.5,"Two of four cells earn partial credit");
assert.ok(!table.textContent.includes("Add row"),"Fixed rows do not show unnecessary controls");
let commandValue="";
const command=ws.createEditor({answerType:"command"},"",value=>commandValue=value,false);
win.document.body.appendChild(command);
const commandInput=command.querySelector("textarea");
commandInput.value="SELECT id FROM Orders WHERE state = 'paid';";
commandInput.dispatchEvent(new win.Event("input",{bubbles:true}));
assert.ok(commandValue.startsWith("SELECT"),"Command is captured as text without being run");
let codeValue="";
const editor=ws.createEditor({answerType:"code"},"",value=>codeValue=value,false);
win.document.body.appendChild(editor);
const codeInput=editor.querySelector("textarea");
codeInput.value="if valid:";
codeInput.selectionStart=codeInput.selectionEnd=codeInput.value.length;
codeInput.dispatchEvent(new win.KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}));
assert.equal(codeValue,"if valid:  ","Tab inserts spaces rather than shifting focus");
let diagramValue=null;
const diagram=ws.createDiagram({answerType:"uml-diagram"},null,value=>{diagramValue=value;},false);
win.document.body.appendChild(diagram);
assert.ok(diagram.querySelectorAll("[data-tool]").length>=12,"Drawer exposes UML shapes, arrows, pen and text");
const label=diagram.querySelector(".uml-label-input");
label.value="Place order";
const canvas=diagram.querySelector("canvas");
canvas.getBoundingClientRect=()=>({left:0,top:0,width:960,height:560});
canvas.dispatchEvent(new win.MouseEvent("pointerdown",{clientX:50,clientY:50,bubbles:true,cancelable:true}));
canvas.dispatchEvent(new win.MouseEvent("pointerup",{clientX:320,clientY:140,bubbles:true,cancelable:true}));
assert.ok(diagramValue?.image?.startsWith("data:image/jpeg;base64,"),"Pointer drawing persists an image");
assert.ok(labels.includes("Place order"),"Shape label is rendered");
assert.ok(diagram.textContent.includes("Upload drawing"),"Students can upload an existing drawing");
console.log("Answer-workspace UI tests passed: partial table marks, fixed rows, command text, code Tab, labelled UML drawing and upload.");
dom.window.close();
