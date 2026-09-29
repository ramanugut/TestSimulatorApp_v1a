/* node tests/mastery-content.test.cjs - no dependencies required */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.runInNewContext(fs.readFileSync("learning-modules.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("modules/inf3708-mastery.js", "utf8"), context);
vm.runInNewContext(fs.readFileSync("modules/ict2631-mastery.js", "utf8"), context);
const modules = context.window.MasteryModules;
assert.ok(Array.isArray(modules) && modules.length > 0, "Expected a learning-module registry");
const moduleIds = new Set();
const exerciseIds = new Set();
let topicCount = 0;
let activityCount = 0;
let calculationCount = 0;
let diagramCount = 0;

for (const module of modules) {
  assert.ok(module.id && !moduleIds.has(module.id), "Each module needs a unique ID");
  moduleIds.add(module.id);
  assert.ok(Array.isArray(module.sourceFiles) && module.sourceFiles.length, "A module maps to exam files");
  assert.ok(Array.isArray(module.chapters) && module.chapters.length, "Modules contain chapters");
  const topicIds = new Set();
  for (const chapter of module.chapters) {
    assert.ok(chapter.title && Array.isArray(chapter.topics));
    for (const topic of chapter.topics) {
      topicCount++;
      assert.ok(topic.id && !topicIds.has(topic.id), "Topic IDs must be unique within the module");
      topicIds.add(topic.id);
      assert.ok(topic.title && topic.summary && topic.reference && topic.notes?.length,
        topic.id + " needs meaningful study notes and a reference");
      assert.ok(Array.isArray(topic.exercises) && topic.exercises.length, topic.id + " needs practice");
      for (const exercise of topic.exercises) {
        activityCount++;
        const fullId = module.id + ":" + exercise.id;
        assert.ok(exercise.id && !exerciseIds.has(fullId), "Duplicate activity ID: " + fullId);
        exerciseIds.add(fullId);
        assert.ok(exercise.prompt && exercise.explanation && exercise.studentNote,
          fullId + " needs question, explanation and student note");
        assert.ok(["choice", "number", "node", "sequence"].includes(exercise.kind),
          fullId + " uses an unsupported activity kind");
        if (exercise.kind === "choice") {
          assert.ok(exercise.options.length >= 2);
          assert.ok(Number.isInteger(exercise.answer) && exercise.answer >= 0 &&
            exercise.answer < exercise.options.length);
        }
        if (exercise.kind === "number") {
          calculationCount++;
          assert.ok(exercise.formula && exercise.hint && exercise.examples.length);
          for (const example of exercise.examples) {
            assert.ok(example.givens.length && example.worked && Number.isFinite(example.answer));
          }
        }
        if (exercise.kind === "sequence") {
          assert.equal(exercise.items.length, exercise.answer.length);
          assert.ok(exercise.answer.every(item => exercise.items.includes(item)));
        }
        if (exercise.diagram) {
          diagramCount++;
          const ids = new Set(exercise.diagram.nodes.map(node => node.id));
          for (const node of exercise.diagram.nodes) {
            assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
            assert.ok(node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100);
          }
          for (const [a, b] of exercise.diagram.edges) {
            assert.ok(ids.has(a) && ids.has(b), fullId + " has an invalid diagram edge");
          }
          if (exercise.kind === "node") assert.ok(ids.has(exercise.answer));
        }
      }
    }
  }
  if (module.id === "inf3708") {
    assert.equal(module.chapters.length, 13, "INF3708 PDF must map its 13 chapters");
  }
}
const engineSource = fs.readFileSync("learning-engine.js", "utf8");
assert.ok(!/INF3708|inf3708|test36\.json/.test(engineSource), "Engine may not contain subject-specific rules");
console.log("Learning content validation passed:", {
  modules: modules.length, topics: topicCount, activities: activityCount,
  calculationActivities: calculationCount, diagramActivities: diagramCount
});
