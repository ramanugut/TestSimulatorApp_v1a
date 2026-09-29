/* node tests/ict2622-content.test.cjs. Run without an API key. */
"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const paths=[
  "ict2622-jan-feb-2025-practice.json",
  "ict2622-oct-nov-2025-practice.json",
  "ict2622-jan-feb-2026-practice.json",
  "ict2622-assessment-1-2026-practice.json",
  "ict2622-assessment-2-2026-practice.json",
  "ict2622-practical-skills-lab.json"
];
const marks=[75,60,60,30,32,50];
const counts=[13,15,14,30,32,6];
const script=fs.readFileSync("script.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const mastery=fs.readFileSync("modules/ict2622-mastery.js","utf8");
const workspace=fs.readFileSync("answer-workspace.js","utf8");
assert.ok(index.includes('src="answer-workspace.js'),"Contextual answer tools are loaded");
assert.ok(index.includes('src="modules/ict2622-mastery.js'),"Topic mastery is loaded");
assert.ok(index.indexOf('src="answer-workspace.js') < index.indexOf('src="script.js'),"Answer tools load before script");
assert.ok(!/ICT2622|ict2622/.test(workspace),"Workspace must be reusable across modules");
let total=0,auto=0,ai=0,tables=0,commands=0,diagrams=0,codes=0;
paths.forEach((path,i)=>{
  assert.ok(script.includes('"'+path+'"'),path+" not registered in test picker");
  assert.ok(mastery.includes('"'+path+'"'),path+" missing from mastery pack");
  const data=JSON.parse(fs.readFileSync(path,"utf8"));
  assert.equal(data.module,"ICT2622");
  assert.match(data.sourceType,/original/i);
  assert.equal(data.questions.length,counts[i],path+" question count");
  assert.equal(data.totalMarks,marks[i]);
  assert.equal(data.questions.reduce((s,q)=>s+q.marks,0),marks[i]);
  assert.equal(data.preserveOrder,true);
  const numbers=new Set();
  data.questions.forEach(q=>{
    total++;
    assert.ok(q.text && q.correctAnswer && q.marks>0,"Complete question + reference");
    assert.ok(q.number && !numbers.has(q.number),"Unique number");
    numbers.add(q.number);
    assert.ok(q.explanation.includes("Student note:"),q.number+" student explanation");
    assert.ok(q.study?.simple && q.study?.steps?.length && q.study?.example &&
      q.study?.pitfall && q.study?.keyTerms?.length,q.number+" full Study Mode notes");
    if(q.options) {
      auto++;
      assert.ok(q.options.length>=3 && q.options.includes(q.correctAnswer));
      assert.notEqual(q.grading,"ai","MCQ must never call AI");
    } else if(q.answerType==="table") {
      tables++;
      assert.equal(q.grading,"table","Fixed table should mark without AI");
      assert.ok(q.tableColumns.length>=2 && q.tableCorrectRows.length);
    } else if(q.answerType==="command") {
      commands++;
      assert.equal(q.grading,"command","Known command should mark without AI");
      assert.ok(q.acceptedAnswers?.length);
    } else {
      ai++;
      assert.equal(q.grading,"ai");
      assert.ok(q.aiRubric?.length>=2 && q.aiReferenceNotes);
      if(q.answerType==="code") codes++;
      if(q.answerType==="uml-diagram") {
        diagrams++;
        assert.equal(q.diagramRequired,true);
        assert.equal(q.diagramNoDrawingCapPercent,0);
      }
    }
  });
});
assert.equal(total,110);
assert.equal(auto,87);
assert.equal(ai,20);
assert.equal(tables,2);
assert.equal(commands,1);
assert.ok(diagrams>=6 && codes===1);
const sandbox={window:{}};
vm.runInNewContext(workspace,sandbox);
const check=sandbox.window.AnswerWorkspace.gradeTable(
 {tableColumns:[{key:"concept"},{key:"value"}],tableCorrectRows:[{concept:"Client",value:["1","one"]}]},
 {table:[{concept:"Client",value:"wrong"}]}
);
assert.equal(check.correct,1);
assert.equal(check.total,2);
assert.equal(check.score,0.5,"Local table grading gives partial marks");
console.log("ICT2622 validation passed:",{papers:paths.length,questions:total,automaticChoices:auto,
 aiWrittenAndDiagrams:ai,tables,commands,diagrams,codes,totalMarks:marks.reduce((a,b)=>a+b,0)});
