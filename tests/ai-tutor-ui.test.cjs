const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const config = fs.readFileSync("app-config.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.match(index, /AI study tools/, "Settings should expose the shared AI study opt-in");
assert.match(index, /contextual AI chat in Study\/review/i,
  "Settings should describe the contextual tutor chat");
assert.match(index, /Nothing is generated automatically; AI only runs when you send a chat message/i,
  "Settings should explain that chat runs only after an explicit message");
assert.match(index, /stays enabled through refreshes in this tab/i,
  "Settings should explain refresh-safe session consent");
assert.match(script, /sessionStorage\.getItem\(AI_STUDY_SESSION_KEY\)/,
  "AI opt-in should restore from sessionStorage");
assert.match(script, /sessionStorage\.setItem\(AI_STUDY_SESSION_KEY, "true"\)/,
  "AI opt-in should persist for the current tab session");
assert.doesNotMatch(script, /saveAppPreferences\(\{\s*aiStudy/i,
  "AI opt-in must not be saved as a durable local preference");
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
assert.match(script, /Ask AI about this topic/, "Tutor should expose a contextual chat box");
assert.match(script, /function requestAiTutorChat\(/, "Tutor chat should have its own request flow");
assert.match(script, /aiTutorChatHistory/, "Tutor chat should preserve recent context in memory");
assert.match(script, /Learner's latest question:/, "Tutor chat should send the learner's free-form follow-up");
assert.match(script, /Tutor chat request\. Please answer the learner's question above\./,
  "Tutor chat should use a fixed backend placeholder instead of the real test answer");
assert.match(script, /mode:\s*"tutor"/,
  "Tutor requests should be explicitly separated from marking requests");
assert.match(script, /Tutor request only; no learner exam answer is supplied\./,
  "Tutor requests should use a neutral placeholder, not the saved explanation");
assert.doesNotMatch(script, /studentAnswer:\s*baselineExplanation/,
  "Saved study explanations must never be sent as the learner's answer");
assert.match(
  config,
  /aiTutorChatEndpoint:[\s\S]*\/api\/grade-answer/,
  "Contextual tutor chat should use the already-live AI backend"
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
assert.match(styles, /\.ai-tutor-chat/, "Tutor chat container should be styled");
assert.match(styles, /\.ai-tutor-chat-input/, "Tutor chat input should be styled");
assert.match(
  script,
  /Your real selected\/written test answer is not sent/,
  "Tutor chat should explain that actual test answers are not sent"
);

console.log("AI tutor checks passed: session-persistent opt-in, explicit contextual chat and answer privacy.");
