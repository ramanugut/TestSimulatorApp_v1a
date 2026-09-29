# Session-only opt-in: targeted revision generation

The post-test **Your revision map** is always computed locally from marks using
`revision-insights.js`. It displays up to five topics ordered by mark
percentage and does **not** call an AI service.

### Permission and lifecycle

- The Settings checkbox `#ai-revision-enabled` is **unchecked on page load**,
  including a refreshed/reopened tab. Its value lives only in the
  `revision-controller.js` in-memory closure. No localStorage, cookies or
  saved-progress state record the consent.
- Turning it on shows **Generate 5 new questions** on a completed test that
  has some missed/partially answered questions. Merely enabling it or
  completing a test causes **no AI generation**.
- One explicit click sends only the module code, up to four missed topic names,
  short reference concepts, learning steps and common mistakes.
  Student answers, identity and complete papers are **not** sent.
- Disabling the switch while a response is in flight invalidates it before the
  generated set can be loaded. Switching/resetting the exam also invalidates
  pending generation.
- No generation occurs for an exam with full marks. An AI request returning
  invalid or incomplete content displays an error and leaves the original
  result available. There is no silent grading penalty.
- The optional five generated questions are strictly validated four-option,
  one-answer MCQs and marked locally. They open as a clearly labelled
  **AI-generated practice — not an official paper** custom session.
- Existing rubric-based AI grading for deliberately open-ended questions is
  separate; the optional Settings switch gates *new revision generation* only.

The secured Netlify function `netlify/functions/generate-practice.mts` uses the
existing server-side `GROQ_API_KEY` and limits each call to five questions. No
browser API key or extra paid service is introduced. The Netlify site must be
redeployed with that new function: committing its file to GitHub does not by
itself prove the function is live. On a free-tier quota/server failure, students
can still review the locally calculated weak topics and original explanations.

### Tests

```sh
node tests/revision-insights.test.cjs
node tests/revision-controller-ui.test.cjs
```

The second test uses the workflow's `jsdom@25` dev dependency. It verifies
consent defaults off, test results are local, toggling on does not fetch,
explicit click makes one request, disabling mid-request cancels practice
insertion, and page initialization resets the switch.
