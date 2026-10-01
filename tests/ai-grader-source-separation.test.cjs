const assert = require("node:assert/strict");
const fs = require("node:fs");

const backend = fs.readFileSync("netlify/functions/grade-answer.mts", "utf8");
const script = fs.readFileSync("script.js", "utf8");

assert.match(
  backend,
  /only the field named studentAnswer and any submitted diagram image are the learner's work/i,
  "Marker must define the learner submission source explicitly"
);
assert.match(
  backend,
  /reference material written for marking\/study support\. They are NOT statements made by the learner/i,
  "Marker must keep reference material separate from learner work"
);
assert.match(
  backend,
  /Every item in strengths must be supported by something the learner actually wrote or drew/i,
  "Strengths must be grounded only in the learner submission"
);
assert.match(
  backend,
  /referenceMaterialDoNotAttributeToLearner/,
  "Reference material should be structurally labelled as non-learner content"
);
assert.match(
  backend,
  /learnerSubmission:\s*\{[\s\S]*studentAnswer/,
  "Learner work should be placed in a dedicated learnerSubmission object"
);

const requestStart = script.indexOf("async function requestAiGrade");
const requestEnd = script.indexOf("async function gradeAiQuestions", requestStart);
assert.ok(requestStart >= 0 && requestEnd > requestStart, "AI grade request region should exist");
const requestRegion = script.slice(requestStart, requestEnd);
assert.match(requestRegion, /studentAnswer:\s*answerText/, "Only the typed answer should populate studentAnswer");
assert.match(requestRegion, /referenceNotes:/, "Study notes should be sent separately as referenceNotes");

console.log("AI grader source-separation checks passed: learner submission and study/reference material stay distinct.");
