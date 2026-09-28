# Reusable learning engine

The existing Test Simulator keeps its assessment JSON files and its Study Mode
question/voice/flashcard experience. An optional **Topic mastery** disclosure
appears above Study Mode questions when a matching module is loaded. Opening it
replaces the question workspace temporarily (closing it restores questions);
this avoids adding another top navigation tab or squeezing the existing layout.

## Separation of concerns

- learning-engine.js: shared DOM renderer, checking, progress and review logic.
- learning-engine.css: responsive styling using the existing light/dark palette.
- learning-modules.js: creates the global registry.
- modules/inf3708-mastery.js: INF3708 content only, based on the supplied
  INF3708 Summary PDF (13 chapters). This module is the first content pack.
- tests/mastery-content.test.cjs: no-package schema/content checks.

For another module, create e.g. modules/my-module-mastery.js, push another
module object into window.MasteryModules, and add that script to index.html
**after** learning-modules.js and **before** learning-engine.js:

    window.MasteryModules.push({
      id: "my-module",
      name: "My Module",
      sourceFiles: ["my-test.json"],
      chapters: [{
        title: "1 · Topic area",
        topics: [{
          id: "my-topic", title: "Basic concept",
          summary: "A simple, complete explanation.",
          reference: "Source p. 3",
          terms: [{ term: "Term", meaning: "Clear definition." }],
          notes: ["Additional student note."],
          exercises: [{
            id: "my-first-exercise",
            kind: "choice",
            prompt: "Which option demonstrates the concept?",
            options: ["First", "Second"], answer: 1,
            explanation: "A worked explanation.",
            studentNote: "A useful related fact."
          }]
        }]
      }]
    });

### Supported exercise kinds

- choice: options array and numeric zero-based answer; optional caseStudy.
- number: formula plus examples (each has givens, answer and worked); optional
  tolerance and hint. Multiple examples rotate with "Different numbers".
- node: diagram nodes, edges, and a correct node ID; all visible nodes are
  tap targets, including on mobile.
- sequence: items array and answer array in the correct order; the engine
  presents accessible ordered selection inputs rather than drag-only controls.

The optional diagram on a choice or numeric activity uses:
    {
      alt: "Text description",
      nodes: [{ id: "A", label: "A · 5 days", x: 20, y: 40 }],
      edges: [["A", "B"]]
    }
Node positions are percentages of the canvas. All student-facing exercises
should explain why the answer is correct and add further study notes.
Do not insert raw HTML or evaluate expression strings from data packs.

## Progress and free usage

Progress is keyed by module ID in localStorage:
test-simulator:mastery:v1:<module-id>. This does not mix progress across
modules or change saved assessment marks. A student moves from Not started to
Learning to Practising. Mastered requires a correct attempt on **each**
activity and a correct review at least 24 hours later for each activity.
Reviews are due after 1, 3, 7 and 14 days of consecutive success; incorrect
answers reset that activity's current streak.

The engine uses ordinary browser JavaScript and browser speech synthesis. It
needs no paid API, account, server or AI provider. Voice availability and
quality depend on the device/browser; the existing question reader is kept
intact. The INF3708 content is a practice adaptation of the uploaded summary,
which itself warns of possible gaps. Check it against official learning
materials before treating it as a complete examination syllabus.

Validate syntax and content with:
    node --check script.js
    node --check learning-engine.js
    node --check learning-modules.js
    node --check modules/inf3708-mastery.js
    node tests/mastery-content.test.cjs
