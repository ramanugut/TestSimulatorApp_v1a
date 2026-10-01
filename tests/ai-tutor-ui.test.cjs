const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const config = fs.readFileSync("app-config.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.match(index, /AI study tools/, "Settings should expose the shared AI study opt-in");
assert.match(index, /interactive .*Teach me more/i, "Settings should describe the interactive question tutor");
assert.match(script, /function aiTutorEnabled\(\)/, "Tutor should have an explicit enabled check");
assert.match(
  script,
  /aiStudyToolsSetting\s*&&\s*aiStudyToolsSetting\.checked/,
  "Tutor should depend on the session AI checkbox"
);
assert.match(
  script,
  /!aiTutorEnabled\(\)\s*\|\|\s*\(!isStudyMode\s*&&\s*!testSubmitted\)/,
  "Tutor should not appear during an active normal test"
);
assert.match(script, /Teach me more/, "Question UI should include the tutor action");
assert.match(script, /Simpler/, "Tutor should offer a simpler explanation path");
assert.match(script, /Why other options\?/, "MCQ tutor should explain distractors");
assert.match(script, /Quiz me/, "Tutor should create a transfer-practice question");
assert.match(script, /Still confused/, "Tutor should include a confidence check");
assert.match(script, /Compare answer/, "Tutor quiz should require retrieval before revealing the model answer");
assert.match(
  script,
  /Your answer above stays on this device\. It is not sent to the AI tutor\./,
  "Tutor quiz should clearly keep the learner's typed answer local"
);
assert.match(
  config,
  /aiTutorEndpoint:[\s\S]*\/api\/grade-answer/,
  "Tutor should use the already deployed AI backend"
);
const tutorStart = script.indexOf("const aiTutorCache");
const tutorEnd = script.indexOf("const MOBILE_BREAKPOINT", tutorStart);
assert.ok(tutorStart >= 0 && tutorEnd > tutorStart, "Tutor implementation region should be present");
const tutorRegion = script.slice(tutorStart, tutorEnd);
assert.doesNotMatch(
  tutorRegion,
  /userAnswers\s*\[/,
  "Tutor requests must not send the student's real test answers"
);
assert.match(styles, /\.ai-tutor-menu/, "Tutor choice chips should be styled");
assert.match(styles, /\.ai-tutor-confidence/, "Tutor confidence controls should be styled");
assert.match(styles, /\.ai-tutor-quiz-input/, "Tutor transfer-practice input should be styled");

console.log("AI tutor checks passed: opt-in guard, interactive teaching paths, retrieval quiz, confidence routing and local-answer privacy.");
