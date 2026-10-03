/* Browser-like tutor regression tests; CI installs jsdom@25. No live AI requests. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");

const consentKey = "testSimulatorAiStudyToolsEnabled";
const preferencesKey = "testSimulatorPreferences";
const endpoint = "https://ai.example.test/api/grade-answer";
const fixture = {
  preserveOrder: true,
  durationMinutes: 10,
  questions: [
    {
      text: "Explain a work breakdown structure.",
      correctAnswer: "Break a project into smaller deliverables.",
      marks: 2,
      study: { title: "WBS", simple: "Saved reference notes about deliverables." },
    },
    {
      text: "Explain a milestone.",
      correctAnswer: "An important point in the project with zero duration.",
      marks: 2,
      study: { title: "Milestones", simple: "Saved reference notes about milestones." },
    },
  ],
};

async function settle() {
  // All network and speech calls are local stubs; flush their pending DOM work.
  for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve));
}

async function openApp(consent = false) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => errors.push(error));
  virtualConsole.on("error", (...args) => errors.push(args));
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
    url: "https://app.example.test/", runScripts: "outside-only",
    pretendToBeVisual: true, virtualConsole,
  });
  const win = dom.window;
  const requests = [];
  const speech = { spoken: [], cancelled: 0 };
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = () => {};
  win.confirm = () => true;
  win.alert = message => errors.push(message);
  win.APP_CONFIG = { aiTutorChatEndpoint: endpoint };
  win.localStorage.setItem(preferencesKey, JSON.stringify({
    mode: "study", studyGuessFirst: false, questionOrder: "paper",
    lastSelectedPaper: "test36.json",
  }));
  if (consent) win.sessionStorage.setItem(consentKey, "true");
  win.SpeechSynthesisUtterance = class {
    constructor(text) { this.text = text; }
  };
  win.speechSynthesis = {
    paused: false,
    getVoices: () => [],
    addEventListener() {},
    cancel() { speech.cancelled++; },
    resume() {},
    speak(utterance) { speech.spoken.push(utterance); utterance.onstart?.(); },
  };
  win.fetch = (url, options = {}) => {
    if (options.method === "POST") {
      return new Promise(resolve => requests.push({
        url, body: JSON.parse(options.body), resolve,
      }));
    }
    assert.ok(String(url).endsWith(".json"), "Only local paper data may load automatically");
    return Promise.resolve({
      ok: true, json: async () => ({ ...fixture, testName: String(url) }),
    });
  };
  win.eval(fs.readFileSync("script.js", "utf8"));
  await new Promise(resolve =>
    win.document.addEventListener("DOMContentLoaded", resolve, { once: true })
  );
  await settle();
  assert.equal(win.document.querySelectorAll(".text-area-input").length, 2,
    "The real app should load both fixture questions");
  assert.deepEqual(errors, [], "App initialization should complete without errors");
  return { dom, win, requests, speech, errors };
}

function answer(request, feedback = "A WBS splits a project into smaller deliverables.") {
  request.resolve({ ok: true, json: async () => ({
    feedback, missingPoints: [], bookAlignment: "Focus on deliverables, not only activities.",
  }) });
}

async function main() {
  const app = await openApp();
  const { win, requests, speech, errors } = app;
  try {
    const doc = win.document;
    const setting = doc.getElementById("ai-revision-enabled");
    const enable = checked => {
      setting.checked = checked;
      setting.dispatchEvent(new win.Event("change", { bubbles: true }));
    };
    assert.equal(setting.checked, false, "AI must start off in a new tab");
    assert.equal(doc.querySelector(".ai-tutor-chat"), null);
    enable(true);
    assert.equal(win.sessionStorage.getItem(consentKey), "true");
    assert.equal(doc.querySelectorAll(".ai-tutor-chat").length, 2);
    assert.equal(requests.length, 0, "Enabling and opening chat must not call AI");
    assert.equal(doc.querySelector(".ai-tutor-trigger, .ai-tutor-menu, .ai-tutor-confidence"), null,
      "Only chat should be presented, without the retired teaching actions");

    const writtenAnswer = doc.querySelector(".text-area-input");
    writtenAnswer.value = "PRIVATE_TEST_ANSWER_DO_NOT_SEND";
    writtenAnswer.dispatchEvent(new win.Event("input", { bubbles: true }));
    const chat = doc.querySelector(".ai-tutor-chat");
    const input = chat.querySelector(".ai-tutor-chat-input");
    const send = chat.querySelector(".ai-tutor-chat-send");
    input.value = "   ";
    send.click();
    assert.equal(requests.length, 0, "An empty message must not consume an AI request");

    input.value = "How do I break a project into deliverables?";
    send.click();
    assert.equal(requests.length, 1, "One explicit message should make one request");
    assert.equal(send.disabled, true, "Sending twice while waiting should be blocked");
    assert.equal(input.disabled, true);
    send.click();
    assert.equal(requests.length, 1);
    const first = requests[0];
    assert.equal(first.url, endpoint);
    assert.equal(first.body.mode, "tutor");
    assert.match(first.body.question, /How do I break a project into deliverables\?/);
    assert.equal(first.body.studentAnswer,
      "Tutor chat request. Please answer the learner's question above.");
    assert.match(first.body.referenceNotes, /Saved reference notes about deliverables/);
    assert.doesNotMatch(JSON.stringify(first.body), /PRIVATE_TEST_ANSWER_DO_NOT_SEND/,
      "A saved written test answer must never be sent to the tutor");
    answer(first);
    await settle();
    assert.equal(send.disabled, false);
    assert.equal(input.disabled, false);
    assert.match(chat.querySelector(".is-assistant").textContent, /smaller deliverables/);
    assert.match(chat.querySelector(".ai-tutor-chat-note").textContent, /Student note:/);
    assert.equal(chat.querySelectorAll(".is-user .ai-tutor-reply-play").length, 0);
    assert.equal(chat.querySelectorAll(".is-assistant .ai-tutor-reply-play").length, 1,
      "Only assistant replies should have a play button");

    const play = chat.querySelector(".ai-tutor-reply-play");
    play.click();
    assert.match(speech.spoken[0].text, /WBS/);
    assert.match(play.getAttribute("aria-label"), /^Pause AI tutor reply/);
    play.click();
    assert.equal(speech.cancelled, 1, "Pause should stop device speech");
    assert.match(play.getAttribute("aria-label"), /^Resume AI tutor reply/);
    play.click();
    assert.equal(speech.spoken.length, 2, "Resume should continue device speech");
    assert.equal(requests.length, 1, "Device voice playback must not call AI");

    input.value = "Give me a simple example.";
    send.click();
    assert.equal(requests.length, 2);
    assert.match(requests[1].body.referenceNotes, /Recent tutor conversation:/);
    assert.match(requests[1].body.referenceNotes, /How do I break a project into deliverables/);
    answer(requests[1], "A school website can have login and reporting deliverables.");
    await settle();
    assert.equal(chat.querySelectorAll(".is-assistant .ai-tutor-reply-play").length, 2);
    const otherChat = doc.querySelectorAll(".ai-tutor-chat")[1];
    assert.equal(otherChat.querySelectorAll(".ai-tutor-chat-message").length, 0,
      "Conversation history must stay with the question it belongs to");

    input.value = "Explain that again.";
    send.click();
    requests[2].resolve({ ok: false, json: async () => ({ error: "Please try again later." }) });
    await settle();
    assert.match(chat.querySelector(".ai-tutor-chat-status").textContent, /Please try again later/);
    assert.equal(send.disabled, false, "An error should leave the chat ready for a retry");
    assert.equal(input.disabled, false);

    doc.getElementById("mode-tab-test").click();
    assert.equal(doc.querySelector(".ai-tutor-chat"), null,
      "Chat must be hidden during an unsubmitted normal test");
    doc.getElementById("mode-tab-study").click();
    assert.equal(doc.querySelectorAll(".ai-tutor-chat").length, 2);
    doc.getElementById("study-guess-first-toggle").click();
    assert.equal(doc.querySelector(".ai-tutor-chat"), null,
      "Guess First should hide chat until the learner can reveal study content");
    assert.equal(requests.length, 3, "Mode changes must not generate teaching automatically");
    enable(false);
    assert.equal(win.sessionStorage.getItem(consentKey), null);
    assert.equal(doc.querySelector(".ai-tutor-chat"), null);
    assert.doesNotMatch(win.localStorage.getItem(preferencesKey), /aiStudyTools|aiStudyEnabled/,
      "AI consent must not become a durable preference");
    assert.deepEqual(errors, [], "Tutor interaction should complete without app errors");
  } finally {
    app.dom.window.close();
  }

  const restored = await openApp(true);
  try {
    assert.equal(restored.win.document.getElementById("ai-revision-enabled").checked, true,
      "The same tab's saved consent should restore after refresh");
    assert.equal(restored.win.document.querySelectorAll(".ai-tutor-chat").length, 2);
    assert.equal(restored.requests.length, 0, "Restoring consent must not make an AI request");
  } finally {
    restored.dom.window.close();
  }
  console.log("AI tutor chat UI passed: explicit sends, answer privacy, local playback, history, errors, mode gates and tab consent.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
