"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = "ict2613-2023-2025-past-written-type-questions.json";
const paper = JSON.parse(fs.readFileSync(path,"utf8"));
const registry=fs.readFileSync("script.js","utf8");
assert.ok(registry.includes('"'+path+'"'),"Written question collection is registered");
assert.equal(paper.module,"ICT2613");
assert.equal(paper.questions.length,26);
assert.equal(paper.totalMarks,390);
assert.deepEqual(paper.questions.map(q=>Number(q.number)),Array.from({length:26},(_,i)=>i+1));
assert.equal(paper.questions.reduce((n,q)=>n+q.marks,0),390);
assert.match(paper.sourceType,/assignments/i);
for(const q of paper.questions) {
 assert.equal(q.marks,15,"Original 15 marks for Q"+q.number);
 assert.ok(q.text.length>=100,"Question text missing for Q"+q.number);
 assert.ok(q.sourceQuestionText && q.sourceQuestionText.length>=100,"Unaltered source text absent for Q"+q.number);
 assert.ok(q.correctAnswer.length>=60,"Reference answer absent for Q"+q.number);
 assert.ok(q.aiRubric.length>=1,"AI marking rubric absent for Q"+q.number);
 assert.match(q.explanation,/Student note:/,"Student notes missing for Q"+q.number);
 assert.equal(q.grading,"ai","Written questions require AI marking");
 assert.ok(["code","ai-text"].includes(q.answerType),"Written response workspace required");
}
const q9=paper.questions[8],q13=paper.questions[12];
for(const q of [q9,q13]) {
 assert.equal(q.tables.length,2,"Two structured tables for Q"+q.number);
 assert.deepEqual(q.tables[0].rows,[["1","cookies"],["2","cakes"],["3","tarts"]]);
 assert.equal(q.tables[1].rows.length,6);
 assert.deepEqual(q.tables[1].rows[4],["5","3","Lemon tart","85.00"]);
}
assert.ok(q9.sourceQuestionText.includes("UPDATE products SET price = 15 WHERE prodID = 4"),
  "Original incorrect column names must stay in question");
assert.match(q9.explanation,/nonexistent columns/,"Issue explained in answer guide");
assert.ok(paper.questions[13].text.includes("generateFibonacci(5)"));
assert.match(paper.questions[16].text,/Mathematics.*English.*Arts.*Bible/s);
assert.match(paper.questions[25].sourceQuestionText,/strcmp\(\$input, "ICT3612"\)/);
console.log("ICT2613 written collection passed: 26 exact-source questions, 390 marks, answer/rubric/notes, database tables and source caveats.");
