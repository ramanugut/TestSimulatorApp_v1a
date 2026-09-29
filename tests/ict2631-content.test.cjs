/* node tests/ict2631-content.test.cjs -- original practice pack quality checks */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const names = [
  "ict2631-oct-nov-2025-inspired.json",
  "ict2631-jan-feb-2025-inspired.json",
  "ict2631-assessment-1-2026-practice.json",
  "ict2631-assessment-2-2026-practice.json"
];
const script = fs.readFileSync("script.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const mastery = fs.readFileSync("modules/ict2631-mastery.js", "utf8");
assert.ok(index.includes('src="modules/ict2631-mastery.js'), "Load ICT2631 mastery before engine");
let questionCount=0, objectiveCount=0, aiCount=0;
for (const name of names) {
  assert.ok(script.includes('"'+name+'"'), name+" missing from test picker");
  assert.ok(mastery.includes('"'+name+'"'), name+" missing from mastery source mapping");
  const data = JSON.parse(fs.readFileSync(name, "utf8"));
  assert.equal(data.module,"ICT2631");
  assert.match(data.sourceType, /[Oo]riginal/);
  assert.match(data.sourceType, /NOT the original UNISA exam|not a verified UNISA 2026 assessment/i, "Practice must not be presented as an official paper");
  assert.equal(data.preserveOrder, true);
  assert.equal(data.totalMarks, 100);
  assert.equal(data.questions.reduce((sum,q)=>sum+q.marks,0),100,"Marks mismatch: "+name);
  const numbers=new Set();
  for (const q of data.questions) {
    questionCount++;
    assert.ok(!numbers.has(q.number), "Repeated question number in "+name);
    numbers.add(q.number);
    assert.ok(q.text && q.marks>0, "Question and marks are required");
    assert.ok(q.explanation.includes("Student note:"), "Extra student learning note required");
    assert.ok(q.study && q.study.title && q.study.simple && q.study.steps.length &&
      q.study.example && q.study.pitfall && q.study.keyTerms?.length,
      "Study mode must explain every question");
    if (Array.isArray(q.options)) {
      objectiveCount++;
      assert.ok(q.options.length>=3);
      assert.ok(q.options.includes(q.correctAnswer), "Answer must exist in option values");
      assert.notEqual(q.grading,"ai","Objective questions must not need AI");
    } else {
      aiCount++;
      assert.equal(q.grading,"ai","Open writing questions require semantic grading");
      assert.ok(q.aiRubric?.length>=4 && q.aiReferenceNotes && q.correctAnswer,
        "Written answer needs a complete grading rubric and reference notes");
    }
  }
}
assert.equal(questionCount, 80);
assert.equal(objectiveCount, 68);
assert.equal(aiCount, 12);
console.log("ICT2631 assessment quality checks passed:",{papers:names.length,questions:questionCount,automatic:objectiveCount,semanticAI:aiCount,marksPerPaper:100});
