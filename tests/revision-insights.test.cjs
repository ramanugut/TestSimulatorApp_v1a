/* node tests/revision-insights.test.cjs
   The insights engine is deterministic and makes zero network calls. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const scope={window:{}};
vm.runInNewContext(fs.readFileSync("revision-insights.js","utf8"),scope);
const revision=scope.window.RevisionInsights;
const q=[
 {marks:2,study:{title:"PHP POST",simple:"Retrieve form values safely.",pitfall:"POST does not encrypt automatically.",steps:["Choose the correct superglobal."]}},
 {marks:2,study:{title:"PHP POST",simple:"Check and validate form values.",pitfall:"Validate on server.",steps:["Check input type."]}},
 {marks:4,study:{title:"SQL query",simple:"Filter selected rows with WHERE.",pitfall:"Do not query all rows.",steps:["Choose columns."]}},
 {marks:3,study:{title:"Safe output",simple:"Escape output.",pitfall:"Do not insert raw HTML.",steps:["Escape HTML entities."]}}
];
const earned=[0,2,1,3];
const result=revision.analyse(q,(question,i)=>({hasAnswer:true,scoreValue:earned[i]}));
assert.equal(result.questionCount,4);
assert.equal(result.weakCount,2);
assert.equal(result.topics[0].title,"SQL query");
assert.equal(result.topics[0].percent,25);
assert.equal(result.topics.find(x=>x.title==="PHP POST").percent,50);
const request=revision.buildRequest(result,"ICT2613");
assert.equal(request.questionCount,5);
assert.equal(request.module,"ICT2613");
assert.equal(request.topics.length,2);
assert.ok(!JSON.stringify(request).includes("studentAnswer"),
  "Never transmit actual student answers to the generator");
const payload={questions:Array.from({length:5},(_,i)=>({
 topic:request.topics[i%2].title,text:"Scenario "+i+" asks what action is correct?",
 options:["Choice A "+i,"Choice B "+i,"Choice C "+i,"Choice D "+i],
 correctIndex:i%4,explanation:"Explanation of concept "+i+".",
 example:"For example, apply it in case "+i+".",
 studentNote:"Remember the relevant checks for this question "+i+"."
}))};
const converted=revision.generatedQuestions(payload,request);
assert.equal(converted.length,5);
assert.ok(converted.every(x=>x.options.includes(x.correctAnswer)&&
 x.explanation.includes("Student note:")&&x.study?.pitfall&&x.sourceType.includes("not an official")));
assert.equal(converted[2].correctAnswer,"Choice C 2");
assert.throws(()=>revision.generatedQuestions({questions:payload.questions.slice(0,4)},request));
const bad=JSON.parse(JSON.stringify(payload));
bad.questions[0].correctIndex=7;
assert.throws(()=>revision.generatedQuestions(bad,request));
const allRight=revision.analyse(q,(question,i)=>({scoreValue:question.marks}));
assert.equal(allRight.weakCount,0);
assert.equal(revision.buildRequest(allRight,"ICT2613"),null,
 "Do not call AI when there were no missed topics");
console.log("Revision insights tests passed: partial marks, weak topic order, safe payload, five valid fixed-answer questions and no-generation on full marks.");
