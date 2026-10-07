/* node tests/ict2631-content.test.cjs -- ICT2631 paper and practice-pack quality checks */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const officialNames = [
  "ict2631-oct-nov-2025-exam.json",
  "ict2631-jan-feb-2025-exam.json",
  "ict2631-oct-nov-2022-exam.json"
];
const practiceNames = [
  "ict2631-assessment-1-2026-practice.json",
  "ict2631-assessment-2-2026-practice.json"
];
const names = [...officialNames, ...practiceNames];

const script = fs.readFileSync("script.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const mastery = fs.readFileSync("modules/ict2631-mastery.js", "utf8");

assert.ok(index.includes('src="modules/ict2631-mastery.js'), "Load ICT2631 mastery before engine");
assert.ok(script.includes("buildStudyGuideData(question)"),
  "Study mode must build structured notes for every module, including explanation-only papers");
assert.ok(script.includes('"What this means"'),
  "Study mode must explain the meaning of the concept");
assert.ok(script.includes('"Why this answer is correct"'),
  "Study mode must explicitly explain why the answer is correct");
assert.ok(script.includes('"Study notes"'),
  "Study mode must include topic-specific study notes");

let questionCount = 0;
let objectiveCount = 0;
let aiCount = 0;

for (const name of names) {
  assert.ok(script.includes('"'+name+'"'), name+" missing from test picker");
  assert.ok(mastery.includes('"'+name+'"'), name+" missing from mastery source mapping");

  const data = JSON.parse(fs.readFileSync(name, "utf8"));
  assert.equal(data.module, "ICT2631");
  assert.equal(data.preserveOrder, true);
  assert.equal(data.totalMarks, 100);
  assert.equal(data.questions.reduce((sum,q)=>sum+q.marks,0), 100, "Marks mismatch: "+name);

  if (officialNames.includes(name)) {
    assert.match(data.sourceType, /Exact question transcription/i, "Official paper must be labelled as an exact transcription");
    assert.match(data.sourceNote, /Original question wording/i, "Official paper must state that wording is preserved");
  } else {
    assert.match(data.sourceType, /[Oo]riginal/);
    assert.match(data.sourceType, /not a verified UNISA 2026 assessment/i, "Practice must not be presented as an official paper");
  }

  const numbers = new Set();
  for (const q of data.questions) {
    questionCount++;
    assert.ok(!numbers.has(q.number), "Repeated question number in "+name);
    numbers.add(q.number);
    assert.ok(q.text && q.marks > 0, "Question and marks are required");
    assert.ok(q.explanation, "Explanation required");

    if (officialNames.includes(name)) {
      assert.ok(q.studentNote, "Exact papers require a separate student note");
    } else {
      assert.ok(q.explanation.includes("Student note:"), "Practice explanation must include a student note");
      assert.ok(q.study && q.study.title && q.study.simple && q.study.steps.length &&
        q.study.example && q.study.pitfall && q.study.keyTerms?.length,
        "Practice Study mode must explain every question");
      assert.ok(Array.isArray(q.study.whyCorrect) && q.study.whyCorrect.length &&
        q.study.whyCorrect.join(" ").length >= 80,
        "Practice Study mode must clearly explain why the fixed answer is correct");
      assert.ok(Array.isArray(q.study.notes) && q.study.notes.length >= 2,
        "Practice Study mode must include topic-specific study notes");
    }

    if (Array.isArray(q.options)) {
      objectiveCount++;
      assert.ok(q.options.length >= 3);
      assert.ok(q.options.includes(q.correctAnswer), "Answer must exist in option values");
      assert.notEqual(q.grading, "ai", "Objective questions must not need AI");
    } else {
      aiCount++;
      assert.equal(q.grading, "ai", "Open writing questions require semantic grading");
      assert.ok(q.aiRubric?.length >= 1 && q.aiReferenceNotes && q.correctAnswer,
        "Written answer needs a grading rubric and reference notes");
    }
  }
}

assert.equal(officialNames.length, 3);
assert.equal(practiceNames.length, 2);
assert.ok(questionCount >= 80, "Expected full ICT2631 coverage across exact papers and practice packs");
assert.ok(aiCount >= officialNames.reduce((sum,name)=>{
  const data=JSON.parse(fs.readFileSync(name,"utf8"));
  return sum+data.questions.length;
},0), "All exact written papers should support semantic marking");

console.log("ICT2631 content quality checks passed:", {
  papers:names.length,
  exactPapers:officialNames.length,
  questions:questionCount,
  automatic:objectiveCount,
  semanticAI:aiCount,
  marksPerPaper:100
});
