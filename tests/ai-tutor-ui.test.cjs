const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const config = fs.readFileSync("app-config.js", "utf8");
const backend = fs.readFileSync("netlify/functions/teach-topic.mts", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.match(index, /AI study tools/, "Settings should expose the shared AI study opt-in");
assert.match(index, /Teach me more/, "Settings copy should explain the question tutor");
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
assert.match(script, /Student note:/, "Tutor lesson should include an extra student note");
assert.match(config, /aiTutorEndpoint:[\s\S]*\/api\/teach-topic/, "Tutor endpoint should be configured");
assert.match(backend, /path:"\/api\/teach-topic"/, "Backend should expose the teach-topic route");
assert.doesNotMatch(backend, /userAnswers|studentAnswer/, "Tutor backend must not require student answers");
assert.match(styles, /\.ai-tutor-wrap/, "Tutor UI styles should exist");

console.log("AI tutor checks passed: opt-in visibility, study/review guard, lesson UI and no student-answer payload.");
