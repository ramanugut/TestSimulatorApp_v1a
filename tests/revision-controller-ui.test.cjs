/* node tests/revision-controller-ui.test.cjs; jsdom@25. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {JSDOM}=require("jsdom");
async function main(){
  const dom=new JSDOM('<!doctype html><html><body><input type="checkbox" id="opt"><section id="report" class="hidden"></section></body></html>',
    {url:"https://ramanugut.github.io",runScripts:"outside-only"});
  const win=dom.window;
  win.eval(fs.readFileSync("revision-insights.js","utf8"));
  win.eval(fs.readFileSync("revision-controller.js","utf8"));
  const setting=win.document.getElementById("opt"),panel=win.document.getElementById("report");
  setting.checked=true;
  let calls=0,started=0,saved=[];
  const topics=[
    {marks:2,study:{title:"PHP form validation",simple:"Validate POST fields.",pitfall:"POST is not encryption."}},
    {marks:1,study:{title:"SQL filters",simple:"Use WHERE to filter records.",pitfall:"Avoid unfiltered queries."}}
  ];
  const scores=[0,0];
  const validTopic=["PHP form validation","SQL filters"];
  const response=()=>({questions:Array.from({length:5},(_,i)=>({
    topic:validTopic[i%2],text:"Original question number "+i,
    options:["Option A "+i,"Option B "+i,"Option C "+i,"Option D "+i],
    correctIndex:i%4,explanation:"Teach topic "+i,
    example:"Example "+i,studentNote:"Student note "+i
  }))});
  win.fetch=async(_url,params)=>{
    calls++;saved.push(JSON.parse(params.body));
    return {ok:true,json:async()=>response()};
  };
  const controller=win.RevisionController.create({
    setting,panel,endpoint:"https://studyflow-ai-grader.netlify.app/api/generate-practice",
    onStartPractice:questions=>{started++;assert.equal(questions.length,5);}
  });
  assert.equal(setting.checked,false,"AI consent must not persist when page reloads");
  controller.showResults({questions:topics,getGrade:(q,i)=>({scoreValue:scores[i]}),moduleName:"ICT2613"});
  assert.equal(panel.classList.contains("hidden"),false);
  assert.ok(panel.textContent.includes("AI practice is off"));
  assert.equal(panel.querySelector(".revision-actions button"),null);
  assert.equal(calls,0);
  setting.checked=true;setting.dispatchEvent(new win.Event("change",{bubbles:true}));
  assert.equal(controller.isEnabled(),true);
  assert.equal(calls,0,"Enabling in Settings is NOT permission to make automatic AI calls");
  const generate=panel.querySelector(".revision-actions button");
  assert.ok(generate&&generate.textContent.includes("Generate 5"));
  generate.click();
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(calls,1,"Only the explicit generate button calls the remote endpoint");
  assert.equal(started,1);
  assert.equal(saved[0].questionCount,5);
  assert.ok(!JSON.stringify(saved[0]).includes("studentAnswer"));
  controller.reset();
  assert.equal(setting.checked,true,"Consent lasts within the current tab session after test reset");
  assert.equal(panel.classList.contains("hidden"),true);
  // Test cancellation while the network request is in flight.
  let finishRequest;
  win.fetch=()=>{calls++;return new Promise(resolve=>{finishRequest=resolve;});};
  controller.showResults({questions:topics,getGrade:(q,i)=>({scoreValue:0}),moduleName:"ICT2613"});
  panel.querySelector(".revision-actions button").click();
  setting.checked=false;
  setting.dispatchEvent(new win.Event("change",{bubbles:true}));
  finishRequest({ok:true,json:async()=>response()});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(started,1,"Turning the feature off invalidates a pending generated result");
  assert.equal(panel.querySelector(".revision-actions button"),null);
  assert.equal(controller.isEnabled(),false);
  // An older Netlify deploy returns an HTML 404, not JSON. Explain what needs
  // updating instead of reporting a vague generation or answer-key failure.
  setting.checked=true;
  setting.dispatchEvent(new win.Event("change",{bubbles:true}));
  controller.showResults({questions:topics,getGrade:()=>({scoreValue:0}),moduleName:"ICT2613"});
  win.fetch=async()=>({ok:false,status:404,json:async()=>{throw new SyntaxError("HTML 404");}});
  panel.querySelector(".revision-actions button").click();
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.match(panel.querySelector(".revision-feedback").textContent,
    /not deployed on the backend yet/,"404 has useful deployment guidance");
  assert.equal(started,1,"An endpoint 404 never starts generated practice");
  const reloaded=win.RevisionController.create({
    setting,panel,endpoint:"",onStartPractice:()=>{}
  });
  assert.equal(reloaded.isEnabled(),false);
  assert.equal(setting.checked,false);
  console.log("AI consent UI tests passed: default off, local results, no auto-call, explicit generate only, session-only, mid-flight cancellation, and missing-endpoint guidance.");
  dom.window.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
