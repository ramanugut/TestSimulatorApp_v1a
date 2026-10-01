// script.js

document.addEventListener("DOMContentLoaded", function () {
  //************************ SECTION 1: INITIALIZATION ************************//

  // Small, durable preferences are kept separate from an active test attempt.
  // This means choosing a module/paper is remembered even when no timer is running.
  const APP_PREFERENCES_KEY = "testSimulatorPreferences";

  function readAppPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(APP_PREFERENCES_KEY) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      console.warn("Unable to read app preferences:", error);
      return {};
    }
  }

  let appPreferences = readAppPreferences();

  function saveAppPreferences(changes = {}) {
    appPreferences = {
      ...appPreferences,
      ...changes,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(appPreferences));
      window.dispatchEvent(new CustomEvent("test-simulator-preferences-changed", {
        detail: { ...appPreferences },
      }));
    } catch (error) {
      console.warn("Unable to save app preferences:", error);
    }
    return appPreferences;
  }

  // Global variables
  let questions = [];
  let originalQuestions = [];
  let currentPage = 1;
  const questionsPerPage = 10;
  let userAnswers = {};
  let timer;
  let remainingTime;
  let isStudyMode = false;
  let isTimerPaused = false;
  let timerStarted = false;
  let testInProgress = false;
  let testSubmitted = false;
  let currentTestFile = "";
  let currentTestPreserveOrder = false;
  let bookmarkedQuestions = new Set();
  let initialTimerSeconds = null;
  let bookmarkCycleIndex = 0;
  let lastMotivationIndex = null;
  const savedMode = typeof appPreferences.mode === "string" ? appPreferences.mode : "";
  let currentMode = ["test", "study", "flashcards", "book"].includes(savedMode)
    ? savedMode
    : "test";
  const studyVoiceAvailable = "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function";
  let activeStudyVoice = null;
  let activeStudyVoicePicker = null;
  let studyVoicePreference = "auto";
  try {
    studyVoicePreference = localStorage.getItem("studyVoicePreference") || "auto";
  } catch (error) { /* Browsers with blocked storage still have voice playback. */ }
  let questionResults = [];
  let aiGrades = {};
  let reviewFilter = "all";
  let showAllQuestions = false;
  let activeSourceFilter = "all";

  const CUSTOM_TEST_VALUE = "__custom_session__";
  let currentCustomSession = null;
  let lastRegularTestValue = null;
  let availableTestsMetadata = [];

  //************************ SECTION 1A: ELEMENT REFERENCES ************************//

  const questionsContainer = document.getElementById("questions-container");
  const timerInput = document.getElementById("timer-input");
  const passMarkInput = document.getElementById("pass-mark-input");
  const startTestButton = document.getElementById("start-test");
  const pauseTimerButton = document.getElementById("pause-timer");
  const floatingTimeDisplay = document.getElementById("floating-time");
  const mobileTimeDisplay = document.getElementById("mobile-time");
  const submitButton = document.getElementById("submit-test");
  const resetButton = document.getElementById("reset-test");
  const downloadButton = document.getElementById("download-results");
  const scoreContainer = document.getElementById("score-container");
  const scoreElement = document.getElementById("score");
  const resultMessageElement = document.getElementById("result-message");
  const testSelect = document.getElementById("test-select");
  const studyModeToggle = document.getElementById("study-mode-toggle");
  const themeButtons = document.querySelectorAll(".theme-choice");

  // Restore low-risk usability preferences. Paper-specific durations can still
  // replace the timer value when a paper explicitly defines one.
  if (timerInput && Number.isFinite(Number(appPreferences.timerMinutes))) {
    timerInput.value = String(Math.max(0, Number(appPreferences.timerMinutes)));
  }
  if (passMarkInput && Number.isFinite(Number(appPreferences.passMark))) {
    passMarkInput.value = String(Math.max(0, Math.min(100, Number(appPreferences.passMark))));
  }
  if (timerInput) {
    timerInput.addEventListener("change", () => {
      const value = Number(timerInput.value);
      if (Number.isFinite(value) && value >= 0) {
        saveAppPreferences({ timerMinutes: value });
      }
    });
  }
  if (passMarkInput) {
    passMarkInput.addEventListener("change", () => {
      const value = Number(passMarkInput.value);
      if (Number.isFinite(value)) {
        saveAppPreferences({ passMark: Math.max(0, Math.min(100, value)) });
      }
    });
  }
  const paginationControls = document.getElementById("pagination-controls");
  const prevPageButton = document.getElementById("prev-page");
  const nextPageButton = document.getElementById("next-page");
  const pageInfo = document.getElementById("page-info");
  const viewToggleButton = document.getElementById("view-toggle");
  const uploadTestInput = document.getElementById("upload-test-input");
  const motivationMessageElement = document.getElementById("motivation-message");
  const newMotivationButton = document.getElementById("new-motivation");
  const bookmarkListElement = document.getElementById("bookmark-list");
  const cycleBookmarksButton = document.getElementById("cycle-bookmarks");
  const achievementListElement = document.getElementById("achievement-list");
  const achievementToast = document.getElementById("achievement-toast");
  const flashcardsGrid = document.getElementById("flashcards-grid");
  const flashcardsEmptyState = document.getElementById("flashcards-empty");
  const flashcardStatus = document.getElementById("flashcard-status");
  const flashcardCount = document.getElementById("flashcard-count");
  const flashcardTally = document.getElementById("flashcard-tally");
  const flashcardProgressTrack = document.getElementById("flashcard-progress-track");
  const flashcardProgressFill = document.getElementById("flashcard-progress-fill");
  const flashcardControls = document.getElementById("flashcard-controls");
  const flashcardPrevButton = document.getElementById("flashcard-prev");
  const flashcardRevealButton = document.getElementById("flashcard-reveal");
  const flashcardAgainButton = document.getElementById("flashcard-again");
  const flashcardKnownButton = document.getElementById("flashcard-known");
  const flashcardNextButton = document.getElementById("flashcard-next");
  const flashcardRestartButton = document.getElementById("flashcard-restart");

  // A flashcard rating never changes a student's test answers or mark.
  let flashcardDeckSource = null;
  let flashcardOrder = [];
  let flashcardPosition = 0;
  let flashcardRevealed = false;
  let flashcardRatings = new Map();
  let flashcardResizeObserver = null;
  const reviewFilterSelect = document.getElementById("review-filter");
  const reviewSourceFilterContainer = document.getElementById(
    "review-source-filter-container"
  );
  const reviewSourceFilterSelect = document.getElementById(
    "review-source-filter"
  );
  const scoreFilterContainer = document.getElementById(
    "score-filter-container"
  );
  const filterEmptyStateElement = document.getElementById(
    "filter-empty-state"
  );
  const resultBanner = document.getElementById("result-banner");
  const resultEmojiElement = document.getElementById("result-emoji");
  const resultHeadlineElement = document.getElementById("result-headline");
  const resultSummaryElement = document.getElementById("result-summary");
  const resultRestartButton = document.getElementById("result-restart");
  const resultReviewFailedButton = document.getElementById(
    "result-review-failed"
  );
  const resultReviewAllButton = document.getElementById("result-review-all");
  const modeButtons = document.querySelectorAll(".mode-tab-button");
  const modePanelTest = document.getElementById("mode-panel-test");
  const modePanelFlashcards = document.getElementById("mode-panel-flashcards");
  const modePanelBook = document.getElementById("mode-panel-book");
  const modeTabBook = document.getElementById("mode-tab-book");
  const bookReaderFrame = document.getElementById("book-reader-frame");
  const bookReaderTitle = document.getElementById("book-reader-title");
  const bookReaderStatus = document.getElementById("book-reader-status");
  const bookOpenExternal = document.getElementById("book-open-external");
  const openOptionsButton = document.getElementById("open-options");
  const closeOptionsButton = document.getElementById("close-options");
  const optionsModal = document.getElementById("options-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const defineTestButton = document.getElementById("define-test");
  const defineTestModal = document.getElementById("define-test-modal");
  const closeDefineTestButton = document.getElementById("close-define-test");
  const cancelDefineTestButton = document.getElementById("cancel-define-test");
  const defineTestForm = document.getElementById("define-test-form");
  const defineTestList = document.getElementById("define-test-list");
  const defineTestQuestionInput = document.getElementById(
    "define-test-question-count"
  );
  const defineTestTimerInput = document.getElementById("define-test-timer");
  const defineTestSummary = document.getElementById("define-test-summary");
  const defineTestError = document.getElementById("define-test-error");
  const defineTestStartButton = document.getElementById("define-test-start");
  const customSessionChip = document.getElementById("custom-session-chip");
  const customSessionSummary = document.getElementById(
    "custom-session-summary"
  );
  const exitCustomSessionButton = document.getElementById(
    "exit-custom-session"
  );
  const streakValueElement = document.getElementById("streak-value");
  const xpValueElement = document.getElementById("xp-value");
  const badgeValueElement = document.getElementById("badge-value");
  const statsTestsTakenElement = document.getElementById("stats-tests-taken");
  const statsTestsPassedElement = document.getElementById("stats-tests-passed");
  const statsTestsFailedElement = document.getElementById("stats-tests-failed");
  const statsTestsAbandonedElement = document.getElementById("stats-tests-abandoned");
  const statsPassedList = document.getElementById("stats-passed-list");
  const statsFailedList = document.getElementById("stats-failed-list");
  const statsAbandonedList = document.getElementById("stats-abandoned-list");
  const statsResetButton = document.getElementById("stats-reset");
  const downloadReportButton = document.getElementById("download-report");
  const progressBarElement = document.getElementById("progress-bar");
  const progressTextElement = document.getElementById("progress-text");
  const headerElement = document.getElementById("floating-header");
  const headerToggleButton = document.getElementById("header-toggle");
  const testControlsModal = document.getElementById("test-controls-modal");
  const closeTestControlsButton = document.getElementById("close-test-controls");
  const aiStudyToolsSetting = document.getElementById("ai-revision-enabled");
  const revisionController = window.RevisionController
    ? window.RevisionController.create({
        setting: aiStudyToolsSetting,
        panel: document.getElementById("revision-insights"),
        endpoint: window.APP_CONFIG && window.APP_CONFIG.aiPracticeEndpoint,
        onStartPractice: startGeneratedPractice,
      })
    : null;

  // Question tutor is session-only and uses the same explicit Settings opt-in
  // as adaptive revision. It never receives the student's answer.
  const aiTutorCache = new Map();
  const aiTutorPending = new Map();

  function aiTutorEnabled() {
    return Boolean(aiStudyToolsSetting && aiStudyToolsSetting.checked);
  }

  function aiTutorKey(question, actualIndex) {
    return [
      currentTestFile || "paper",
      actualIndex,
      String(question && question.text || "").slice(0, 500),
    ].join("::");
  }

  function buildAiTutorRequest(question) {
    const study = question && question.study && typeof question.study === "object"
      ? question.study
      : {};
    const topic =
      study.title || question.topic || study.section || question.section ||
      study.chapter || question.chapter || "Topic from this question";
    const keyTerms = Array.isArray(study.keyTerms)
      ? study.keyTerms
          .filter(entry => entry && entry.term && entry.meaning)
          .slice(0, 8)
          .map(entry => ({ term: String(entry.term), meaning: String(entry.meaning) }))
      : [];
    return {
      module: getCurrentModuleCode() || "",
      topic: String(topic),
      question: String(question.text || ""),
      correctAnswer: formatAnswerForDisplay(question.correctAnswer),
      explanation: String(study.simple || question.explanation || ""),
      chapter: String(study.chapter || question.chapter || ""),
      section: String(study.section || question.section || ""),
      steps: Array.isArray(study.steps) ? study.steps.slice(0, 6).map(String) : [],
      example: String(study.example || ""),
      pitfall: String(study.pitfall || ""),
      remember: String(study.remember || ""),
      keyTerms,
    };
  }

  function validAiTutorLesson(value) {
    return Boolean(
      value && typeof value === "object" &&
      typeof value.topicTitle === "string" &&
      typeof value.simpleExplanation === "string" &&
      typeof value.deepDive === "string" &&
      Array.isArray(value.steps) && value.steps.length >= 2 &&
      value.steps.every(step => typeof step === "string") &&
      typeof value.example === "string" &&
      typeof value.commonMistake === "string" &&
      typeof value.memoryTip === "string" &&
      typeof value.studentNote === "string" &&
      typeof value.checkQuestion === "string" &&
      typeof value.checkAnswer === "string"
    );
  }

  async function requestAiTutorLesson(question, actualIndex) {
    const key = aiTutorKey(question, actualIndex);
    if (aiTutorCache.has(key)) return aiTutorCache.get(key);
    if (aiTutorPending.has(key)) return aiTutorPending.get(key);

    const endpoint = window.APP_CONFIG && window.APP_CONFIG.aiTutorEndpoint;
    if (typeof endpoint !== "string" || !endpoint.trim()) {
      throw new Error("The AI tutor is not connected yet.");
    }

    const pending = fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAiTutorRequest(question)),
    }).then(async response => {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }
      if (response.status === 404) {
        throw new Error(
          "The AI tutor backend is still being deployed. Your normal study notes still work."
        );
      }
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "The AI tutor is unavailable right now. Please try again."
        );
      }
      if (!validAiTutorLesson(payload?.lesson)) {
        throw new Error("The AI tutor returned an incomplete lesson. Please retry.");
      }
      aiTutorCache.set(key, payload.lesson);
      return payload.lesson;
    }).finally(() => {
      aiTutorPending.delete(key);
    });

    aiTutorPending.set(key, pending);
    return pending;
  }

  function appendAiTutorTextSection(card, headingText, value) {
    if (!value) return;
    const section = document.createElement("section");
    section.className = "ai-tutor-section";
    const heading = document.createElement("h4");
    heading.textContent = headingText;
    const body = document.createElement("div");
    body.className = "rich-content";
    body.innerHTML = formatRichText(String(value));
    section.append(heading, body);
    card.appendChild(section);
  }

  function renderAiTutorLesson(host, lesson) {
    host.replaceChildren();
    const card = document.createElement("article");
    card.className = "ai-tutor-lesson";

    const heading = document.createElement("div");
    heading.className = "ai-tutor-lesson-heading";
    const kicker = document.createElement("span");
    kicker.className = "ai-tutor-kicker";
    kicker.textContent = "AI tutor";
    const title = document.createElement("h3");
    title.textContent = lesson.topicTitle || "Learn this topic";
    const note = document.createElement("p");
    note.className = "ai-tutor-disclaimer";
    note.textContent =
      "Built from this question and its saved study material. AI can make mistakes, so use the reference answer and textbook as the final check.";
    heading.append(kicker, title, note);
    card.appendChild(heading);

    appendAiTutorTextSection(card, "Explain it simply", lesson.simpleExplanation);
    appendAiTutorTextSection(card, "Go deeper", lesson.deepDive);

    if (Array.isArray(lesson.steps) && lesson.steps.length) {
      const section = document.createElement("section");
      section.className = "ai-tutor-section";
      const headingSteps = document.createElement("h4");
      headingSteps.textContent = "How to handle questions like this";
      const list = document.createElement("ol");
      list.className = "ai-tutor-steps";
      lesson.steps.forEach(step => {
        const item = document.createElement("li");
        item.textContent = step;
        list.appendChild(item);
      });
      section.append(headingSteps, list);
      card.appendChild(section);
    }

    appendAiTutorTextSection(card, "Example", lesson.example);
    appendAiTutorTextSection(card, "Common mistake", lesson.commonMistake);
    appendAiTutorTextSection(card, "Memory tip", lesson.memoryTip);

    const studentNote = document.createElement("section");
    studentNote.className = "ai-tutor-student-note";
    const studentNoteTitle = document.createElement("strong");
    studentNoteTitle.textContent = "Student note: ";
    studentNote.append(
      studentNoteTitle,
      document.createTextNode(lesson.studentNote)
    );
    card.appendChild(studentNote);

    const check = document.createElement("section");
    check.className = "ai-tutor-check";
    const checkTitle = document.createElement("h4");
    checkTitle.textContent = "Check yourself";
    const checkQuestion = document.createElement("div");
    checkQuestion.className = "rich-content";
    checkQuestion.innerHTML = formatRichText(lesson.checkQuestion);
    const reveal = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Show answer";
    const answer = document.createElement("div");
    answer.className = "rich-content ai-tutor-check-answer";
    answer.innerHTML = formatRichText(lesson.checkAnswer);
    reveal.append(summary, answer);
    check.append(checkTitle, checkQuestion, reveal);
    card.appendChild(check);

    host.appendChild(card);
  }

  function createAiTutorBlock(question, actualIndex) {
    if (!aiTutorEnabled() || (!isStudyMode && !testSubmitted)) return null;

    const wrapper = document.createElement("section");
    wrapper.className = "ai-tutor-wrap";
    wrapper.setAttribute("aria-label", "Optional AI tutor");

    const lessonHost = document.createElement("div");
    lessonHost.className = "ai-tutor-output";
    const cached = aiTutorCache.get(aiTutorKey(question, actualIndex));
    if (cached) {
      renderAiTutorLesson(lessonHost, cached);
      wrapper.appendChild(lessonHost);
      return wrapper;
    }

    const actionRow = document.createElement("div");
    actionRow.className = "ai-tutor-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-tertiary ai-tutor-button";
    button.textContent = "✨ Teach me more";
    const status = document.createElement("p");
    status.className = "ai-tutor-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    button.addEventListener("click", async () => {
      if (!aiTutorEnabled()) return;
      button.disabled = true;
      button.textContent = "Teaching…";
      status.textContent =
        "Building a deeper lesson from this question and its study notes…";
      try {
        const lesson = await requestAiTutorLesson(question, actualIndex);
        if (!aiTutorEnabled() || !document.body.contains(wrapper)) return;
        renderAiTutorLesson(lessonHost, lesson);
        actionRow.remove();
        status.remove();
      } catch (error) {
        button.disabled = false;
        button.textContent = "✨ Teach me more";
        status.textContent =
          error?.message || "The AI tutor could not load. Please try again.";
      }
    });

    actionRow.appendChild(button);
    wrapper.append(actionRow, status, lessonHost);
    return wrapper;
  }
  const MOBILE_BREAKPOINT = 768;
  let lastViewportIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  let headerCollapsed = window.innerWidth <= MOBILE_BREAKPOINT;

  if (flashcardsGrid) {
    flashcardsGrid.classList.add("hidden");
  }

  function getTimerInputSeconds() {
    if (!timerInput) {
      return 0;
    }
    const minutes = parseInt(timerInput.value, 10);
    if (Number.isNaN(minutes)) {
      return 0;
    }
    return Math.max(minutes, 0) * 60;
  }

  remainingTime = getTimerInputSeconds();
  updateTimerDisplay(
    Math.floor(remainingTime / 60) || 0,
    Math.max(remainingTime % 60, 0)
  );

  const motivationMessages = [
    "You're turning knowledge into power!",
    "Every answer gets you closer to your goals.",
    "Stay curious and keep exploring!",
    "Brains love challenges—keep them coming!",
    "Small steps today lead to big wins tomorrow.",
    "You’ve got this—one question at a time!",
    "Learning is your superpower. Use it!",
  ];

  const achievementDefinitions = [
    {
      id: "first-test",
      title: "First Steps",
      description: "Complete your first test.",
    },
    {
      id: "perfect-score",
      title: "Perfectionist",
      description: "Score 100% on a test.",
    },
    {
      id: "speedster",
      title: "Speedster",
      description: "Finish a test with more than five minutes to spare.",
    },
    {
      id: "bookmark-hero",
      title: "Bookmark Hero",
      description: "Bookmark five questions in a single test.",
    },
  ];

  let unlockedAchievements = new Set();
  try {
    const storedAchievements = JSON.parse(
      localStorage.getItem("achievements") || "[]"
    );
    if (Array.isArray(storedAchievements)) {
      unlockedAchievements = new Set(storedAchievements);
    }
  } catch (error) {
    console.warn("Unable to load achievements:", error);
  }

  // Stats tracking
  let testStats = {
    testsTaken: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsAbandoned: 0,
    passedTests: [],
    failedTests: [],
    abandonedTests: [],
  };

  let streakData = {
    count: 0,
    lastDate: null,
  };

  function resetReviewState() {
    questionResults = [];
    reviewFilter = "all";
    if (reviewFilterSelect) {
      reviewFilterSelect.value = "all";
    }
    activeSourceFilter = "all";
    if (reviewSourceFilterSelect) {
      reviewSourceFilterSelect.value = "all";
    }
    if (scoreFilterContainer) {
      scoreFilterContainer.classList.add("hidden");
    }
    if (reviewSourceFilterContainer) {
      reviewSourceFilterContainer.classList.add("hidden");
    }
    if (filterEmptyStateElement) {
      filterEmptyStateElement.classList.add("hidden");
    }
  }

  function updateReviewFilterVisibility() {
    if (!scoreFilterContainer) {
      return;
    }
    const hasResults =
      testSubmitted && questions.length > 0 && questionResults.length > 0;

    if (hasResults) {
      scoreFilterContainer.classList.remove("hidden");
      if (reviewFilterSelect) {
        reviewFilterSelect.value = reviewFilter;
      }
    } else {
      scoreFilterContainer.classList.add("hidden");
    }

    updateReviewSourceFilter(hasResults);
  }

  function hideResultBanner() {
    if (!resultBanner) {
      return;
    }
    resultBanner.classList.add("hidden");
    resultBanner.classList.remove("result-banner--pass", "result-banner--fail");
    if (resultEmojiElement) {
      resultEmojiElement.classList.remove("party", "sad");
    }
  }

  function showResultBanner({ status, scorePercent, scoreBreakdown, missedCount }) {
    if (
      !resultBanner ||
      !resultEmojiElement ||
      !resultHeadlineElement ||
      !resultSummaryElement
    ) {
      return;
    }

    resultBanner.classList.remove(
      "hidden",
      "result-banner--pass",
      "result-banner--fail"
    );
    resultEmojiElement.classList.remove("party", "sad");

    const missedMessageTail =
      missedCount === 0
        ? ""
        : ` ${missedCount} question${missedCount === 1 ? "" : "s"} to review.`;

    if (status === "pass") {
      resultBanner.classList.add("result-banner--pass");
      resultEmojiElement.textContent = "🎉🥳🎊";
      resultEmojiElement.classList.add("party");
      resultHeadlineElement.textContent = "You Passed!";
      const celebrationMessage =
        missedCount === 0
          ? "You aced every question. Incredible work!"
          : `Amazing job—you were close!${missedMessageTail}`;
      resultSummaryElement.textContent = `You scored ${scorePercent}% (${scoreBreakdown}). ${celebrationMessage}`;
    } else {
      resultBanner.classList.add("result-banner--fail");
      resultEmojiElement.textContent = "😢";
      resultEmojiElement.classList.add("sad");
      resultHeadlineElement.textContent = "Keep Going!";
      const encouragementMessage =
        missedCount === 0
          ? "Give it another go—you have the knowledge to improve!"
          : `You've got this—review those tricky spots.${missedMessageTail}`;
      resultSummaryElement.textContent = `You scored ${scorePercent}% (${scoreBreakdown}). ${encouragementMessage}`;
    }

    if (resultReviewFailedButton) {
      resultReviewFailedButton.disabled = missedCount === 0;
    }

    if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (typeof resultBanner.scrollIntoView === "function") {
      resultBanner.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (typeof resultBanner.focus === "function") {
      requestAnimationFrame(() => {
        resultBanner.focus();
      });
    }
  }

  function isCustomSessionActive() {
    return currentTestFile === CUSTOM_TEST_VALUE && !!currentCustomSession;
  }

  function ensureCustomTestOption(label) {
    if (!testSelect) {
      return;
    }
    let customOption = testSelect.querySelector(
      `option[value="${CUSTOM_TEST_VALUE}"]`
    );
    if (!customOption) {
      customOption = document.createElement("option");
      customOption.value = CUSTOM_TEST_VALUE;
      customOption.dataset.customSession = "true";
      testSelect.appendChild(customOption);
    }
    customOption.textContent = label;
  }

  function clearCustomTestOption() {
    if (!testSelect) {
      return;
    }
    const customOption = testSelect.querySelector(
      `option[value="${CUSTOM_TEST_VALUE}"]`
    );
    if (customOption) {
      customOption.remove();
    }
  }

  function getCustomSessionSourceSummary(sources) {
    if (!Array.isArray(sources) || sources.length === 0) {
      return "Custom Mix";
    }

    const names = sources
      .map((source) => source?.name || source?.file)
      .filter(Boolean);

    if (names.length === 0) {
      return "Custom Mix";
    }

    if (names.length === 1) {
      return `Custom Mix: ${names[0]}`;
    }

    if (names.length === 2) {
      return `Custom Mix: ${names[0]} + ${names[1]}`;
    }

    return `Custom Mix (${names.length} tests)`;
  }

  function updateCustomSessionChip() {
    if (!customSessionChip) {
      return;
    }

    if (!isCustomSessionActive()) {
      customSessionChip.classList.add("hidden");
      if (customSessionSummary) {
        customSessionSummary.textContent = "";
      }
      return;
    }

    const sources = currentCustomSession?.sources || [];
    const summaryLabel =
      currentCustomSession?.displayName ||
      getCustomSessionSourceSummary(sources);
    const questionCount = Array.isArray(questions) ? questions.length : 0;
    const questionLabel = `${questionCount} question${
      questionCount === 1 ? "" : "s"
    }`;

    if (customSessionSummary) {
      customSessionSummary.textContent = `${summaryLabel} • ${questionLabel}`;
    }

    customSessionChip.classList.remove("hidden");
  }

  function getUniqueQuestionSources() {
    const sources = new Map();
    const baseQuestions = Array.isArray(originalQuestions)
      ? originalQuestions
      : [];
    baseQuestions.forEach((question) => {
      if (!question || !question.sourceTestId) {
        return;
      }
      if (!sources.has(question.sourceTestId)) {
        sources.set(
          question.sourceTestId,
          question.sourceTestName || question.sourceTestId
        );
      }
    });
    return sources;
  }

  function refreshSourceFilterOptions() {
    if (!reviewSourceFilterContainer || !reviewSourceFilterSelect) {
      return;
    }

    const sources = getUniqueQuestionSources();
    const entries = Array.from(sources.entries());

    reviewSourceFilterSelect.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All sources";
    reviewSourceFilterSelect.appendChild(allOption);

    entries.forEach(([id, name]) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      reviewSourceFilterSelect.appendChild(option);
    });

    if (!entries.some(([id]) => id === activeSourceFilter)) {
      activeSourceFilter = "all";
    }

    reviewSourceFilterSelect.value = activeSourceFilter;

    if (entries.length <= 1) {
      reviewSourceFilterSelect.value = "all";
      reviewSourceFilterContainer.classList.add("hidden");
      return;
    }

    reviewSourceFilterContainer.classList.remove("hidden");
  }

  function updateReviewSourceFilter(hasResults) {
    if (!reviewSourceFilterContainer || !reviewSourceFilterSelect) {
      return;
    }

    if (!hasResults || !isCustomSessionActive()) {
      activeSourceFilter = "all";
      reviewSourceFilterSelect.value = "all";
      reviewSourceFilterContainer.classList.add("hidden");
      return;
    }

    refreshSourceFilterOptions();
  }

  function getTestMetadataByFile(file) {
    if (!file) {
      return null;
    }
    return availableTestsMetadata.find((item) => item.file === file) || null;
  }

  function populateDefineTestModal() {
    if (!defineTestList) {
      return;
    }

    const previouslySelected = new Set(
      Array.from(
        defineTestList.querySelectorAll('input[type="checkbox"]:checked')
      ).map((input) => input.value)
    );

    defineTestList.innerHTML = "";

    if (!availableTestsMetadata.length) {
      const emptyState = document.createElement("p");
      emptyState.textContent = "No tests available to combine.";
      emptyState.classList.add("define-test-empty");
      defineTestList.appendChild(emptyState);
      updateDefineTestSummary();
      return;
    }

    availableTestsMetadata.forEach((test, index) => {
      const item = document.createElement("div");
      item.className = "define-test-item";

      const checkboxId = `define-test-${index}`;

      const label = document.createElement("label");
      label.setAttribute("for", checkboxId);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = checkboxId;
      checkbox.value = test.file;
      checkbox.dataset.questionCount = String(test.questionCount || 0);
      checkbox.dataset.name = test.name || test.file;
      if (previouslySelected.has(test.file)) {
        checkbox.checked = true;
      }

      const nameSpan = document.createElement("span");
      nameSpan.className = "define-test-name";
      nameSpan.textContent = test.name || test.file;

      label.appendChild(checkbox);
      label.appendChild(nameSpan);

      const meta = document.createElement("div");
      meta.className = "define-test-meta";
      meta.innerHTML = `<span>${test.questionCount} question${
        test.questionCount === 1 ? "" : "s"
      }</span>`;

      item.appendChild(label);
      item.appendChild(meta);
      defineTestList.appendChild(item);

      checkbox.addEventListener("change", () => {
        updateDefineTestSummary();
      });
    });

    updateDefineTestSummary();
  }

  function getSelectedDefineTests() {
    if (!defineTestList) {
      return [];
    }

    const selectedCheckboxes = Array.from(
      defineTestList.querySelectorAll('input[type="checkbox"]:checked')
    );

    return selectedCheckboxes.map((input) => {
      const file = input.value;
      const questionCount = parseInt(input.dataset.questionCount || "0", 10);
      const name = input.dataset.name || file;
      return { file, questionCount: Math.max(questionCount, 0), name };
    });
  }

  function updateDefineTestSummary() {
    if (!defineTestSummary || !defineTestQuestionInput) {
      return;
    }

    const selectedTests = getSelectedDefineTests();
    const totalAvailable = selectedTests.reduce(
      (sum, test) => sum + test.questionCount,
      0
    );

    let requestedCount = parseInt(defineTestQuestionInput.value, 10);
    const hasRequestedValue =
      Number.isInteger(requestedCount) && requestedCount > 0;

    if (!hasRequestedValue && totalAvailable > 0) {
      requestedCount = totalAvailable;
      defineTestQuestionInput.value = String(requestedCount);
    }

    const selectionLabel =
      selectedTests.length === 0
        ? "Select at least one test to begin."
        : `${selectedTests.length} test${
            selectedTests.length === 1 ? "" : "s"
          } selected • ${totalAvailable} question${
            totalAvailable === 1 ? "" : "s"
          } available`;

    defineTestSummary.textContent = selectionLabel;

    let errorMessage = "";
    let canStart = selectedTests.length > 0 && totalAvailable > 0;

    if (!selectedTests.length) {
      canStart = false;
    } else if (totalAvailable === 0) {
      errorMessage = "The selected tests have no questions.";
      canStart = false;
    } else if (!hasRequestedValue) {
      errorMessage = "Enter how many questions you'd like.";
      canStart = false;
    } else if (requestedCount > totalAvailable) {
      errorMessage = `Only ${totalAvailable} question${
        totalAvailable === 1 ? "" : "s"
      } available. We'll use them all.`;
    }

    if (defineTestError) {
      defineTestError.textContent = errorMessage;
    }

    if (defineTestStartButton) {
      defineTestStartButton.disabled = !canStart;
    }
  }

  async function handleDefineTestSubmit(event) {
    event.preventDefault();

    if (!defineTestStartButton) {
      return;
    }

    const selectedTests = getSelectedDefineTests();
    const requestedCount = parseInt(defineTestQuestionInput.value, 10);
    const timerValue = defineTestTimerInput
      ? parseInt(defineTestTimerInput.value, 10)
      : null;
    const timerMinutes =
      Number.isInteger(timerValue) && timerValue >= 0 ? timerValue : null;

    if (selectedTests.length === 0) {
      if (defineTestError) {
        defineTestError.textContent = "Select at least one test.";
      }
      updateDefineTestSummary();
      return;
    }

    if (!Number.isInteger(requestedCount) || requestedCount <= 0) {
      if (defineTestError) {
        defineTestError.textContent = "Enter how many questions you'd like.";
      }
      updateDefineTestSummary();
      return;
    }

    defineTestStartButton.disabled = true;
    const originalLabel = defineTestStartButton.textContent;
    defineTestStartButton.textContent = "Creating...";
    if (defineTestError) {
      defineTestError.textContent = "";
    }

    try {
      await createCustomSession({
        selectedTests,
        requestedCount,
        timerMinutes,
      });
      closeDefineTestModal();
    } catch (error) {
      console.error("Unable to create custom session:", error);
      if (defineTestError) {
        defineTestError.textContent =
          error?.message || "Unable to create the custom test. Please try again.";
      }
    } finally {
      defineTestStartButton.textContent = originalLabel;
      defineTestStartButton.disabled = false;
      updateDefineTestSummary();
    }
  }

  function isDefineTestModalOpen() {
    return defineTestModal && !defineTestModal.classList.contains("hidden");
  }

  function isTestControlsModalOpen() {
    return testControlsModal && !testControlsModal.classList.contains("hidden");
  }

  function syncModalViewport() {
    const viewport = window.visualViewport;
    const height = Math.max(240, Math.round(
      viewport ? viewport.height : window.innerHeight
    ));
    const top = Math.max(0, Math.round(viewport ? viewport.offsetTop : 0));
    document.documentElement.style.setProperty("--modal-visible-height", height + "px");
    document.documentElement.style.setProperty("--modal-visible-top", top + "px");
  }

  function openTestControlsModal() {
    if (!testControlsModal || isTestControlsModalOpen()) return;
    closeOptionsModal();
    closeDefineTestModal();
    syncModalViewport();
    testControlsModal.classList.remove("hidden");
    testControlsModal.setAttribute("aria-hidden", "false");
    showModalBackdrop();
    syncHeaderToggleState();
    if (closeTestControlsButton) closeTestControlsButton.focus({ preventScroll: true });
  }

  function closeTestControlsModal(restoreFocus = true) {
    if (!testControlsModal || !isTestControlsModalOpen()) return;
    testControlsModal.classList.add("hidden");
    testControlsModal.setAttribute("aria-hidden", "true");
    syncHeaderToggleState();
    if (restoreFocus && headerToggleButton && testControlsModal.contains(document.activeElement)) {
      headerToggleButton.focus({ preventScroll: true });
    }
    hideModalBackdropIfNoModal();
  }

  function showModalBackdrop() {
    if (!modalBackdrop) {
      return;
    }
    modalBackdrop.classList.remove("hidden");
    modalBackdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function hideModalBackdropIfNoModal() {
    if (!modalBackdrop) {
      return;
    }
    if (!isOptionsModalOpen() && !isDefineTestModalOpen() && !isTestControlsModalOpen()) {
      modalBackdrop.classList.add("hidden");
      modalBackdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }
  }

  function openDefineTestModal() {
    if (!defineTestModal) {
      return;
    }

    if (isDefineTestModalOpen()) {
      return;
    }

    closeOptionsModal();
    closeTestControlsModal(false);
    syncModalViewport();
    defineTestModal.classList.remove("hidden");
    defineTestModal.setAttribute("aria-hidden", "false");
    showModalBackdrop();

    if (defineTestButton) {
      defineTestButton.setAttribute("aria-expanded", "true");
    }

    if (defineTestError) {
      defineTestError.textContent = "";
    }

    if (defineTestTimerInput && timerInput) {
      defineTestTimerInput.value = timerInput.value || "";
    }

    populateDefineTestModal();
    updateDefineTestSummary();

    if (closeDefineTestButton) {
      closeDefineTestButton.focus();
    }
  }

  function closeDefineTestModal() {
    if (!defineTestModal || !isDefineTestModalOpen()) {
      return;
    }

    defineTestModal.classList.add("hidden");
    defineTestModal.setAttribute("aria-hidden", "true");

    if (defineTestButton) {
      defineTestButton.setAttribute("aria-expanded", "false");
      if (defineTestModal.contains(document.activeElement)) {
        defineTestButton.focus();
      }
    }

    hideModalBackdropIfNoModal();
  }

  function closeActiveModal() {
    if (isDefineTestModalOpen()) {
      closeDefineTestModal();
      return;
    }
    if (isOptionsModalOpen()) {
      closeOptionsModal();
      return;
    }
    if (isTestControlsModalOpen()) {
      closeTestControlsModal();
    }
  }

  function setReviewMode(newFilter) {
    reviewFilter = newFilter;
    if (reviewFilterSelect) {
      reviewFilterSelect.value = newFilter;
    }
    currentPage = 1;
    renderQuestions();
    updatePaginationControls();
    updateBookmarkPanel();
  }

  function getFilteredQuestionIndexes() {
    const totalQuestions = questions.length;
    const allIndexes = Array.from({ length: totalQuestions }, (_, index) => index);

    let filteredIndexes = allIndexes;

    if (isCustomSessionActive() && activeSourceFilter !== "all") {
      filteredIndexes = filteredIndexes.filter((index) => {
        const question = questions[index];
        return question && question.sourceTestId === activeSourceFilter;
      });
    }

    if (!testSubmitted || questionResults.length === 0) {
      return filteredIndexes;
    }

    if (reviewFilter === "correct") {
      return filteredIndexes.filter(
        (index) => questionResults[index] === "correct"
      );
    }

    if (reviewFilter === "incorrect") {
      return filteredIndexes.filter(
        (index) => questionResults[index] !== "correct"
      );
    }

    return filteredIndexes;
  }

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Load stats from localStorage
  function loadStats() {
    const storedDate = localStorage.getItem("statsDate");
    if (storedDate === today) {
      const storedStats = JSON.parse(localStorage.getItem("testStats"));
      if (storedStats) {
        testStats = storedStats;
      }
    } else {
      // New day, reset stats
      localStorage.setItem("statsDate", today);
      saveStats();
    }
    updateStatsDisplay();
  }

  // Save stats to localStorage
  function saveStats() {
    localStorage.setItem("testStats", JSON.stringify(testStats));
  }

  // Update stats display
  function updateStatsDisplay() {
    updateStatsPanel();
    updateGamification();
  }

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function syncHeaderToggleState() {
    if (!headerToggleButton) return;
    const open = isTestControlsModalOpen();
    headerToggleButton.setAttribute("aria-expanded", open ? "true" : "false");
    headerToggleButton.setAttribute("aria-label", open ? "Close test controls" : "Open test controls");
    headerToggleButton.setAttribute("title", "Test controls");
  }

  const BOOK_SOURCES = {
    INF3708: {
      title: "Information Technology Project Management",
      detail: "9th Edition · Kathy Schwalbe · Shared Google Drive copy",
      // Google Drive uses /preview for iframe embedding. Keep /view for the
      // full reader because it can use the user's normal signed-in Drive session.
      embedUrl: "https://drive.google.com/file/d/1wSsvyKvhPLXYA7AryPtDSc6NcKG8lzlX/preview",
      url: "https://drive.google.com/file/d/1wSsvyKvhPLXYA7AryPtDSc6NcKG8lzlX/view?usp=drivesdk"
    }
  };

  function getCurrentModuleCode() {
    const selectedLabel = testSelect?.selectedOptions?.[0]?.textContent || "";
    const labelMatch = selectedLabel.match(/\b[A-Z]{3}\d{4}\b/i);
    if (labelMatch) return labelMatch[0].toUpperCase();

    const fileMatch = String(currentTestFile || "").match(/([a-z]{3}\d{4})/i);
    if (fileMatch) return fileMatch[1].toUpperCase();

    // Legacy INF3708 Assessment 2 filename.
    if (currentTestFile === "test36.json") return "INF3708";
    return "";
  }

  function getCurrentBookSource() {
    return BOOK_SOURCES[getCurrentModuleCode()] || null;
  }

  function syncBookAvailability() {
    const source = getCurrentBookSource();
    if (modeTabBook) {
      modeTabBook.hidden = !source;
      modeTabBook.classList.toggle("hidden", !source);
    }

    if (bookReaderTitle) {
      bookReaderTitle.textContent = source ? source.title : "No book available";
    }
    if (bookReaderStatus) {
      bookReaderStatus.textContent = source
        ? source.detail
        : "A textbook has not been linked for this module yet.";
    }
    if (bookOpenExternal) {
      if (source) {
        bookOpenExternal.href = source.url;
        bookOpenExternal.removeAttribute("aria-disabled");
        bookOpenExternal.removeAttribute("tabindex");
      } else {
        bookOpenExternal.removeAttribute("href");
        bookOpenExternal.setAttribute("aria-disabled", "true");
        bookOpenExternal.setAttribute("tabindex", "-1");
      }
    }

    if (!source && currentMode === "book") {
      setMode("test");
    }
  }

  function loadCurrentBook() {
    const source = getCurrentBookSource();
    if (!source || !bookReaderFrame) return;
    const readerUrl = source.embedUrl || source.url;
    if (bookReaderFrame.dataset.source === readerUrl) return;
    bookReaderFrame.src = readerUrl;
    bookReaderFrame.dataset.source = readerUrl;
  }

  function updateModeButtons(activeMode) {
    if (!modeButtons.length) {
      return;
    }

    modeButtons.forEach((button) => {
      const isActive = button.dataset.mode === activeMode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive.toString());
      button.setAttribute("tabindex", isActive ? "0" : "-1");
    });
  }

  function updateModePanels(activeMode) {
    const showFlashcards = activeMode === "flashcards";
    const showBook = activeMode === "book";
    const showQuestions = !showFlashcards && !showBook;

    if (modePanelTest) {
      modePanelTest.classList.toggle("active", showQuestions);
      modePanelTest.setAttribute("aria-hidden", (!showQuestions).toString());
    }

    if (modePanelFlashcards) {
      modePanelFlashcards.classList.toggle("active", showFlashcards);
      modePanelFlashcards.setAttribute(
        "aria-hidden",
        (!showFlashcards).toString()
      );
    }

    if (modePanelBook) {
      modePanelBook.classList.toggle("active", showBook);
      modePanelBook.setAttribute("aria-hidden", (!showBook).toString());
      if (showBook) loadCurrentBook();
    }

    if (window.MasteryEngine) {
      window.MasteryEngine.setContext({ mode: activeMode, testFile: currentTestFile });
    }
  }

  function applyStudyModeState(checked) {
    if (isStudyMode === checked) {
      return;
    }

    stopStudyVoice();
    isStudyMode = checked;
    document.body.classList.toggle("study-mode-active", isStudyMode);
    renderQuestions();
  }

  function isOptionsModalOpen() {
    return optionsModal && !optionsModal.classList.contains("hidden");
  }

  function openOptionsModal() {
    if (!optionsModal) {
      return;
    }

    if (isOptionsModalOpen()) {
      return;
    }

    closeDefineTestModal();
    closeTestControlsModal(false);
    syncModalViewport();
    optionsModal.classList.remove("hidden");
    optionsModal.setAttribute("aria-hidden", "false");
    showModalBackdrop();
    if (openOptionsButton) {
      openOptionsButton.setAttribute("aria-expanded", "true");
    }

    if (closeOptionsButton) {
      closeOptionsButton.focus();
    }
  }

  function closeOptionsModal() {
    if (!optionsModal) {
      return;
    }

    if (!isOptionsModalOpen()) {
      return;
    }

    optionsModal.classList.add("hidden");
    optionsModal.setAttribute("aria-hidden", "true");
    if (openOptionsButton) {
      openOptionsButton.setAttribute("aria-expanded", "false");
    }

    if (openOptionsButton && optionsModal.contains(document.activeElement)) {
      openOptionsButton.focus();
    }

    hideModalBackdropIfNoModal();
  }

  function setMode(mode) {
    if (!mode) {
      return;
    }
    if (mode !== "study") stopStudyVoice();

    if (mode === currentMode) {
      updateModeButtons(currentMode);
      updateModePanels(currentMode);

      if (currentMode === "flashcards") {
        renderFlashcards();
      } else if (currentMode === "study") {
        if (studyModeToggle && !studyModeToggle.checked) {
          studyModeToggle.checked = true;
        }
        applyStudyModeState(true);
      } else if (currentMode === "test" || currentMode === "book") {
        if (studyModeToggle && studyModeToggle.checked) {
          studyModeToggle.checked = false;
        }
        applyStudyModeState(false);
        if (currentMode === "book") loadCurrentBook();
      }

      return;
    }

    currentMode = mode;
    saveAppPreferences({ mode });

    if (mode === "study") {
      if (studyModeToggle && !studyModeToggle.checked) {
        studyModeToggle.checked = true;
      }
      applyStudyModeState(true);
    } else if (mode === "test" || mode === "book") {
      if (studyModeToggle && studyModeToggle.checked) {
        studyModeToggle.checked = false;
      }
      applyStudyModeState(false);
      if (mode === "book") loadCurrentBook();
    }

    updateModeButtons(mode);
    updateModePanels(mode);

    if (mode === "flashcards") {
      renderFlashcards();
    }
  }


  function handleResponsiveState() {
    syncModalViewport();
    syncHeaderToggleState();
    lastViewportIsMobile = isMobileViewport();
  }

  function escapeHTML(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = typeof value === "string" ? value : String(value);
    return stringValue
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function canonicalizeAnswerValue(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = typeof value === "string" ? value : String(value);
    const normalizedLineEndings = stringValue.replace(/\r\n/g, "\n");
    const trimmedValue = normalizedLineEndings.trim();

    const legacyCodeMatch = /^<code[^>]*>([\s\S]*?)<\/code>$/i.exec(
      trimmedValue
    );
    if (legacyCodeMatch) {
      return legacyCodeMatch[1].replace(/\r\n/g, "\n").trim();
    }

    return trimmedValue;
  }

  function answerValuesEqual(a, b) {
    return canonicalizeAnswerValue(a) === canonicalizeAnswerValue(b);
  }

  function hasProvidedAnswer(answer) {
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      if (Array.isArray(answer.table)) return answer.table.some(row =>
        Object.values(row || {}).some(value => String(value == null ? "" : value).trim()));
      return Boolean(
        (typeof answer.text === "string" && answer.text.trim()) ||
        (typeof answer.image === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(answer.image))
      );
    }
    if (Array.isArray(answer)) {
      return answer.some((value) => canonicalizeAnswerValue(value) !== "");
    }
    return canonicalizeAnswerValue(answer) !== "";
  }

  // Always escape imported assessment text before creating learning markup.
  function formatInlineRichText(segment) {
    if (!segment) return "";
    const parts = String(segment).split(/\x60([^\x60]+)\x60/g);
    return parts.map((part, index) => index % 2 === 0
      ? escapeHTML(part).replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      : '<code class="inline-code">' + escapeHTML(part) + "</code>"
    ).join("");
  }

  // Older assessment answers sometimes contain "1. First ... 2. Second ..." in one line.
  // Only split an ordered sequence beginning 1, 2; leave decimals and question IDs intact.
  function expandCompactNumberedList(value) {
    const matches = [];
    const matcher = /(^|\s)([1-9]\d?)[.)]\s+(?=[A-Z])/g;
    let match;
    while ((match = matcher.exec(value)) !== null) {
      matches.push({ position: match.index + match[1].length, number: Number(match[2]) });
    }
    if (matches.length < 2 || matches[0].number !== 1 || matches[1].number !== 2) return value;
    const ordered = [];
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].number !== i + 1) break;
      ordered.push(matches[i]);
    }
    let result = value;
    ordered.reverse().forEach(item => {
      const prefix = result.slice(0, item.position);
      result = prefix.trimEnd() + (prefix.trim() ? "\n" : "") + result.slice(item.position);
    });
    return result;
  }

  function formatProseBlocks(value) {
    if (!value.trim()) return "";
    return value.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).map(paragraph => {
      const lines = expandCompactNumberedList(paragraph).split("\n");
      const output = [];
      let prose = [], listItems = [], listType = "", listStart = 1;
      const flushProse = () => {
        if (prose.length) output.push('<p class="rich-paragraph">' +
          prose.map(formatInlineRichText).join("<br>") + "</p>");
        prose = [];
      };
      const flushList = () => {
        if (listItems.length) {
          const tag = listType === "ol" ? "ol" : "ul";
          const start = tag === "ol" && listStart !== 1 ? ' start="' + listStart + '"' : "";
          output.push("<" + tag + ' class="rich-list"' + start + ">" +
            listItems.map(item => "<li>" + formatInlineRichText(item) + "</li>").join("") +
            "</" + tag + ">");
        }
        listItems = []; listType = "";
      };
      lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;
        const number = /^(\d{1,2})[.)]\s+(.+)$/.exec(line);
        const bullet = /^[-*•]\s+(.+)$/.exec(line);
        if (number || bullet) {
          const type = number ? "ol" : "ul";
          if (listType && listType !== type) flushList();
          if (!listType) { flushProse(); listType = type; listStart = number ? Number(number[1]) : 1; }
          listItems.push(number ? number[2] : bullet[1]);
        } else {
          flushList();
          prose.push(line);
        }
      });
      flushList(); flushProse();
      return output.join("");
    }).join("");
  }

  function formatRichText(text) {
    if (!text) {
      return "";
    }
    const safeText = typeof text === "string" ? text : String(text);

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    const segments = [];
    let match;

    while ((match = codeBlockRegex.exec(safeText)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          value: safeText.slice(lastIndex, match.index),
        });
      }
      segments.push({
        type: "code",
        language: match[1] ? match[1].trim() : "",
        value: match[2] || "",
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < safeText.length) {
      segments.push({
        type: "text",
        value: safeText.slice(lastIndex),
      });
    }

    return segments
      .map((segment) => {
        if (segment.type === "code") {
          const trimmedCode = segment.value.replace(/^\n+|\n+$/g, "");
          const languageClass = segment.language
            ? ` language-${segment.language.toLowerCase()}`
            : "";
          return `<pre class="code-block"><code class="${languageClass}">${escapeHTML(
            trimmedCode
          )}</code></pre>`;
        }
        return formatProseBlocks(segment.value);
      })
      .join("")
      .trim();
  }

  function createReadablePanel(label, value, className) {
    const panel = document.createElement("section");
    panel.className = className + " readable-panel";
    const title = document.createElement("h3");
    title.className = "readable-panel-heading";
    title.textContent = label;
    const content = document.createElement("div");
    content.className = "rich-content";
    content.innerHTML = formatRichText(value) || '<p class="rich-paragraph">No answer supplied.</p>';
    panel.append(title, content);
    return panel;
  }

  function createOptionMarkup(optionValue) {
    const safeValue =
      optionValue === null || optionValue === undefined
        ? ""
        : typeof optionValue === "string"
          ? optionValue
          : String(optionValue);
    const normalizedValue = safeValue.replace(/\r\n/g, "\n");
    const trimmedValue = normalizedValue.trim();
    const canonicalValue = canonicalizeAnswerValue(optionValue);

    const optionData = {
      markup: "",
      canonicalValue,
      hasCodeBlock: false,
    };

    const fencedMatch = /^```(\w+)?\n([\s\S]*?)\n?```$/.exec(trimmedValue);
    if (fencedMatch) {
      const language = fencedMatch[1] ? fencedMatch[1].trim().toLowerCase() : "";
      const codeClasses = ["option-code"];
      if (language) {
        codeClasses.push(`language-${language}`);
      }
      const codeClass = codeClasses.join(" ");
      const codeContent = fencedMatch[2]
        ? fencedMatch[2].replace(/^\n+|\n+$/g, "")
        : "";
      optionData.markup = `<pre class="code-block option-code-block"><code class="${codeClass}">${escapeHTML(
        codeContent
      )}</code></pre>`;
      optionData.hasCodeBlock = true;
      return optionData;
    }

    const legacyCodeMatch = /^<code[^>]*>([\s\S]*?)<\/code>$/i.exec(trimmedValue);
    if (legacyCodeMatch) {
      const legacyContent = canonicalValue;
      optionData.markup = `<span class="option-text"><code class="inline-code option-inline-code">${escapeHTML(
        legacyContent
      )}</code></span>`;
      return optionData;
    }

    if (canonicalValue.includes("\n")) {
      const blockContent = canonicalValue.replace(/\n+$/, "");
      optionData.markup = `<pre class="code-block option-code-block"><code class="option-code">${escapeHTML(
        blockContent
      )}</code></pre>`;
      optionData.hasCodeBlock = true;
      return optionData;
    }

    optionData.markup = `<span class="option-text">${escapeHTML(
      canonicalValue
    )}</span>`;
    return optionData;
  }


  function normalizeTableCell(cell) {
    if (cell && typeof cell === "object" && !Array.isArray(cell)) {
      return {
        text: cell.text ?? "",
        colspan: Math.max(1, parseInt(cell.colspan || 1, 10)),
        rowspan: Math.max(1, parseInt(cell.rowspan || 1, 10)),
        align: cell.align || "",
      };
    }
    return { text: cell ?? "", colspan: 1, rowspan: 1, align: "" };
  }

  function createStructuredQuestionTable(tableData) {
    if (!tableData || typeof tableData !== "object") {
      return null;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "question-table-wrapper";

    const table = document.createElement("table");
    table.className = "question-data-table";

    if (tableData.caption) {
      const caption = document.createElement("caption");
      caption.textContent = tableData.caption;
      table.appendChild(caption);
    }

    const headerRows = Array.isArray(tableData.headerRows)
      ? tableData.headerRows
      : Array.isArray(tableData.headers)
        ? [tableData.headers]
        : [];

    if (headerRows.length) {
      const thead = document.createElement("thead");
      headerRows.forEach((row) => {
        const tr = document.createElement("tr");
        (row || []).forEach((rawCell) => {
          const cell = normalizeTableCell(rawCell);
          const th = document.createElement("th");
          th.textContent = cell.text;
          th.colSpan = cell.colspan;
          th.rowSpan = cell.rowspan;
          th.scope = "col";
          if (cell.align) th.style.textAlign = cell.align;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
      });
      table.appendChild(thead);
    }

    if (Array.isArray(tableData.rows)) {
      const tbody = document.createElement("tbody");
      tableData.rows.forEach((row) => {
        const tr = document.createElement("tr");
        (row || []).forEach((rawCell) => {
          const cell = normalizeTableCell(rawCell);
          const td = document.createElement("td");
          td.textContent = cell.text;
          td.colSpan = cell.colspan;
          td.rowSpan = cell.rowspan;
          if (cell.align) td.style.textAlign = cell.align;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }

    wrapper.appendChild(table);
    return wrapper;
  }

  function openQuestionImageViewer(src, altText) {
    const existing = document.querySelector(".question-image-lightbox");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "question-image-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", altText || "Question diagram");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "question-image-lightbox-close";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close enlarged diagram");

    const image = document.createElement("img");
    image.src = src;
    image.alt = altText || "Question diagram";

    const close = () => overlay.remove();
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape" && document.body.contains(overlay)) {
          close();
        }
      },
      { once: true }
    );

    overlay.appendChild(closeButton);
    overlay.appendChild(image);
    document.body.appendChild(overlay);
    closeButton.focus();
  }

  function createQuestionImage(imageData) {
    if (!imageData) return null;

    const data =
      typeof imageData === "string" ? { src: imageData } : imageData;
    if (!data.src) return null;

    const figure = document.createElement("figure");
    figure.className = "question-figure";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-image-button";
    button.setAttribute("aria-label", "Enlarge question diagram");

    const image = document.createElement("img");
    image.src = data.src;
    image.alt = data.alt || "Question diagram";
    image.loading = "lazy";
    image.className = "question-diagram";

    button.appendChild(image);
    button.addEventListener("click", () =>
      openQuestionImageViewer(data.src, image.alt)
    );
    figure.appendChild(button);

    if (data.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = data.caption;
      figure.appendChild(caption);
    }

    return figure;
  }

  function appendStructuredQuestionContent(questionElement, question) {
    if (!questionElement || !question) return;

    if (question.context) {
      const details = document.createElement("details");
      details.className = "question-case-study";
      const summary = document.createElement("summary");
      summary.textContent =
        typeof question.contextTitle === "string" && question.contextTitle.trim()
          ? question.contextTitle.trim()
          : "Read the Tomorrow's Future case study";
      details.appendChild(summary);
      const content = document.createElement("div");
      content.className = "rich-content";
      content.innerHTML = formatRichText(question.context);
      details.appendChild(content);
      questionElement.appendChild(details);
    }

    if (question.table) {
      const table = createStructuredQuestionTable(question.table);
      if (table) questionElement.appendChild(table);
    }

    if (Array.isArray(question.tables)) {
      question.tables.forEach((tableData) => {
        const table = createStructuredQuestionTable(tableData);
        if (table) questionElement.appendChild(table);
      });
    }

    if (question.image) {
      const figure = createQuestionImage(question.image);
      if (figure) questionElement.appendChild(figure);
    }
  }


  function createStudyGuideElement(study) {
    if (!study || typeof study !== "object") {
      return null;
    }

    const card = document.createElement("section");
    card.className = "study-guide-card";
    card.setAttribute("aria-label", "Study notes");

    const heading = document.createElement("h4");
    heading.className = "study-guide-title";
    heading.textContent = study.title || "Understand the concept";
    card.appendChild(heading);

    if (study.chapter) {
      const reference = document.createElement("div");
      reference.className = "study-book-reference";

      const chapter = document.createElement("strong");
      chapter.textContent = "Study in the book: ";
      reference.appendChild(chapter);
      reference.appendChild(document.createTextNode(study.chapter));

      if (study.section) {
        reference.appendChild(document.createTextNode(` • ${study.section}`));
      }
      if (study.pages) {
        reference.appendChild(document.createTextNode(` • ${study.pages}`));
      }

      card.appendChild(reference);
    }

    if (study.simple) {
      const simple = document.createElement("p");
      simple.className = "study-guide-simple";
      simple.textContent = study.simple;
      card.appendChild(simple);
    }

    // Explain abbreviations and specialist terms before asking students to follow a method.
    if (Array.isArray(study.keyTerms) && study.keyTerms.length) {
      const termsHeading = document.createElement("div");
      termsHeading.className = "study-guide-subtitle";
      termsHeading.textContent = "Key words explained";
      card.appendChild(termsHeading);

      const termsList = document.createElement("ul");
      termsList.className = "study-guide-steps";
      study.keyTerms.forEach((entry) => {
        if (!entry || !entry.term || !entry.meaning) return;
        const item = document.createElement("li");
        const term = document.createElement("strong");
        term.textContent = entry.term + ": ";
        item.appendChild(term);
        item.appendChild(document.createTextNode(entry.meaning));
        termsList.appendChild(item);
      });
      if (termsList.childElementCount) card.appendChild(termsList);
    }

    if (Array.isArray(study.steps) && study.steps.length) {
      const stepsHeading = document.createElement("div");
      stepsHeading.className = "study-guide-subtitle";
      stepsHeading.textContent = study.stepsTitle || "How to work it out";
      card.appendChild(stepsHeading);

      const list = document.createElement("ol");
      list.className = "study-guide-steps";
      study.steps.forEach((step) => {
        const item = document.createElement("li");
        item.textContent = step;
        list.appendChild(item);
      });
      card.appendChild(list);
    }

    if (study.example) {
      const example = document.createElement("p");
      example.className = "study-guide-simple";
      const label = document.createElement("strong");
      label.textContent = "Example: ";
      example.appendChild(label);
      example.appendChild(document.createTextNode(study.example));
      card.appendChild(example);
    }

    if (study.pitfall) {
      const pitfall = document.createElement("div");
      pitfall.className = "study-guide-remember";
      const label = document.createElement("strong");
      label.textContent = "Student note: ";
      pitfall.appendChild(label);
      pitfall.appendChild(document.createTextNode(study.pitfall));
      card.appendChild(pitfall);
    }

    if (study.remember) {
      const remember = document.createElement("div");
      remember.className = "study-guide-remember";
      const strong = document.createElement("strong");
      strong.textContent = "Remember: ";
      remember.appendChild(strong);
      remember.appendChild(document.createTextNode(study.remember));
      card.appendChild(remember);
    }

    return card;
  }



  // Device speech only. Short sentence-sized parts make pause/resume predictable.
  function appendStudyVoiceText(parts, source, element) {
    const text = String(source || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [text];
    sentences.forEach(function (sentence) {
      let remaining = sentence.trim();
      while (remaining) {
        let cut = Math.min(190, remaining.length);
        if (remaining.length > 190) {
          const space = remaining.lastIndexOf(" ", 190);
          if (space > 60) cut = space;
        }
        const part = remaining.slice(0, cut).trim();
        if (part) parts.push({ text: part, element: element });
        remaining = remaining.slice(cut).trim();
      }
    });
  }

  function visibleStudyVoiceText(element) {
    return element ? (element.innerText || element.textContent || "") : "";
  }

  // Keep the written markup and formatting unchanged. Split rich answers into
  // paragraphs/list items so readers can choose a useful starting point.
  function appendRichStudyVoiceParts(parts, root) {
    if (!root) return;
    const candidates = Array.from(root.querySelectorAll(
      "p, li, pre, blockquote, h2, h3, h4, h5, h6"
    ));
    const blocks = candidates.filter(function (element) {
      // Read a whole list item, not both its wrapper and nested paragraph.
      return !candidates.some(function (other) {
        return other !== element && other.contains(element);
      });
    });
    (blocks.length ? blocks : [root]).forEach(function (element) {
      appendStudyVoiceText(parts, visibleStudyVoiceText(element), element);
    });
  }

  function buildStudyVoiceParts(questionElement) {
    const parts = [];
    const answer = questionElement.querySelector(
      ".study-correct-answer .rich-content, .correct-answer .rich-content"
    );
    const guide = questionElement.querySelector(".study-guide-card");
    const fallback = questionElement.querySelector(
      ".study-explanation .rich-content, .explanation .rich-content"
    );
    if (answer) {
      appendStudyVoiceText(parts, "Correct answer.", null);
      appendRichStudyVoiceParts(parts, answer);
    }
    if (guide) {
      const title = guide.querySelector(".study-guide-title");
      if (title) appendStudyVoiceText(parts, visibleStudyVoiceText(title), title);
      Array.from(guide.children).forEach(function (element) {
        // The toolbar and chapter reference are not study narration.
        if (element.classList.contains("study-guide-header") ||
            element.classList.contains("study-guide-title") ||
            element.classList.contains("study-book-reference")) return;
        if (element.tagName === "OL" || element.tagName === "UL") {
          Array.from(element.children).forEach(function (item, index) {
            if (element.tagName === "OL") {
              appendStudyVoiceText(parts, "Step " + (index + 1) + ".", null);
            }
            appendStudyVoiceText(parts, visibleStudyVoiceText(item), item);
          });
        } else {
          appendStudyVoiceText(parts, visibleStudyVoiceText(element), element);
        }
      });
    } else {
      appendRichStudyVoiceParts(parts, fallback);
    }
    return parts;
  }

  function clearStudyVoiceHighlight(session) {
    if (session.activeTarget) {
      session.activeTarget.classList.remove("study-voice-reading");
      session.activeTarget = null;
    }
  }

  function setStudyVoiceButtonState(session, state) {
    session.toggleButton.textContent =
      state === "playing" ? "Pause" : state === "paused" ? "Resume" : "▶ Listen";
    session.toggleButton.setAttribute("aria-label",
      (state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Listen to") +
      " study notes for question " + session.questionNumber);
    session.stopButton.disabled = state === "idle";
  }

  function studyVoiceStatus(session, message, isError) {
    session.status.textContent = message;
    session.status.classList.toggle("sr-only", !isError);
    session.status.classList.toggle("study-voice-error", Boolean(isError));
  }

  function closeStudyVoicePicker() {
    const picker = activeStudyVoicePicker;
    activeStudyVoicePicker = null;
    if (!picker) return;
    picker.targets.forEach(function (entry) {
      entry.element.classList.remove("study-voice-pickable");
      entry.element.removeEventListener("click", entry.select);
      entry.element.removeEventListener("keydown", entry.select);
      ["tabindex", "role", "aria-label"].forEach(function (attr) {
        if (entry.before[attr] === null) entry.element.removeAttribute(attr);
        else entry.element.setAttribute(attr, entry.before[attr]);
      });
    });
    picker.button.textContent = "Start at…";
    picker.button.setAttribute("aria-pressed", "false");
    picker.status.textContent = "";
    picker.status.classList.add("sr-only");
    picker.status.classList.remove("study-voice-error");
  }


  // Restore original text interaction as soon as this voice session ends.
  function clearLiveStudyVoiceTargets(session) {
    if (session.questionElement) session.questionElement.classList.remove("study-voice-active");
    (session.seekTargets || []).forEach(function (element) {
      element.classList.remove("study-voice-seekable");
    });
    session.seekTargets = [];
  }

  function markLiveStudyVoiceTargets(session) {
    const targets = Array.from(new Set(session.parts.map(function (part) {
      return part.element;
    }).filter(function (element) {
      return element && element.nodeType === 1 &&
        session.questionElement.contains(element);
    })));
    session.seekTargets = targets;
    session.questionElement.classList.add("study-voice-active");
    targets.forEach(function (element) {
      element.classList.add("study-voice-seekable");
    });
  }

  function stopStudyVoice() {
    closeStudyVoicePicker();
    const session = activeStudyVoice;
    if (!session) return; // Do not cancel an idle speech engine just before Play.
    activeStudyVoice = null;
    session.token += 1; // Ignore late end/error events caused by cancellation.
    clearStudyVoiceHighlight(session);
    clearLiveStudyVoiceTargets(session);
    setStudyVoiceButtonState(session, "idle");
    studyVoiceStatus(session, "Stopped.", false);
    if (studyVoiceAvailable) window.speechSynthesis.cancel();
  }

  function finishStudyVoice(session, message, isError) {
    if (activeStudyVoice !== session) return;
    activeStudyVoice = null;
    clearStudyVoiceHighlight(session);
    clearLiveStudyVoiceTargets(session);
    setStudyVoiceButtonState(session, "idle");
    studyVoiceStatus(session, message, isError);
  }

  function availableStudyVoices() {
    return window.speechSynthesis.getVoices().filter(function (voice) {
      return /^en(?:[-_]|$)/i.test(voice.lang);
    });
  }

  function studyVoiceId(voice) {
    return JSON.stringify([voice.voiceURI || "", voice.lang, voice.name]);
  }

  // Prefer enhanced/natural voices over a basic voice just because it has en-ZA.
  // The browser supplies the voices: there is no app-owned TTS API or API key.
  function studyVoiceQuality(voice) {
    const name = String(voice.name || "") + " " + String(voice.voiceURI || "");
    const quality = /natural|neural/i.test(name) ? 1000
      : /enhanced|premium/i.test(name) ? 700 : 0;
    const online = /online/i.test(name) ? 50 : 0;
    const locale = /^en-ZA$/i.test(voice.lang) ? 30
      : /^en-GB$/i.test(voice.lang) ? 20
      : /^en-US$/i.test(voice.lang) ? 10 : 0;
    return quality + online + locale + (voice.default ? 1 : 0);
  }

  function preferredStudyVoice() {
    const voices = availableStudyVoices();
    if (!voices.length) return null;
    const chosen = studyVoicePreference !== "auto"
      ? voices.find(function (voice) { return studyVoiceId(voice) === studyVoicePreference; })
      : null;
    return chosen || voices.reduce(function (best, voice) {
      return studyVoiceQuality(voice) > studyVoiceQuality(best) ? voice : best;
    }, voices[0]);
  }

  function populateStudyVoiceSelect(select) {
    if (!select) return;
    const voices = availableStudyVoices();
    select.replaceChildren();
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "Voice: Auto";
    select.appendChild(auto);
    voices.forEach(function (voice) {
      const option = document.createElement("option");
      option.value = studyVoiceId(voice);
      option.textContent = voice.name + " (" + voice.lang + ")";
      select.appendChild(option);
    });
    const availableChoice = voices.some(function (voice) {
      return studyVoiceId(voice) === studyVoicePreference;
    });
    select.value = availableChoice ? studyVoicePreference : "auto";
    const preferred = preferredStudyVoice();
    select.title = select.value === "auto"
      ? "Auto voice" + (preferred ? ": " + preferred.name : "")
      : (preferred ? preferred.name + " (" + preferred.lang + ")" : "Choose voice");
  }

  function refreshStudyVoiceSelectors() {
    document.querySelectorAll(".study-voice-voice").forEach(populateStudyVoiceSelect);
    if (activeStudyVoice) activeStudyVoice.voice = preferredStudyVoice();
  }

  if (studyVoiceAvailable) {
    window.speechSynthesis.addEventListener("voiceschanged", refreshStudyVoiceSelectors);
  }

  function speakNextStudyVoicePart(session) {
    if (activeStudyVoice !== session || session.paused) return;
    clearStudyVoiceHighlight(session);
    if (session.nextIndex >= session.parts.length) {
      finishStudyVoice(session, "Finished reading.", false);
      return;
    }
    const partIndex = session.nextIndex++;
    const part = session.parts[partIndex];
    const utterance = new window.SpeechSynthesisUtterance(part.text);
    utterance.rate = session.rate;
    utterance.lang = session.voice ? session.voice.lang : "en";
    if (session.voice) utterance.voice = session.voice;
    session.currentIndex = partIndex;
    const token = ++session.token;
    utterance.onstart = function () {
      if (activeStudyVoice !== session || session.token !== token || session.paused) return;
      session.activeTarget = part.element;
      if (part.element) part.element.classList.add("study-voice-reading");
    };
    utterance.onend = function () {
      if (activeStudyVoice !== session || session.token !== token) return;
      clearStudyVoiceHighlight(session);
      session.currentIndex = null;
      speakNextStudyVoicePart(session);
    };
    utterance.onerror = function (event) {
      if (activeStudyVoice !== session || session.token !== token) return;
      finishStudyVoice(session, event.error === "not-allowed"
        ? "Your browser blocked voice playback. Tap Listen again."
        : "Voice is unavailable. Please try another browser or device.", true);
    };
    try {
      // Recover from a browser speech engine left in its paused state.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      finishStudyVoice(session, "Voice could not start on this device.", true);
    }
  }

  // Native speechSynthesis.pause()/resume() is unreliable on some mobile browsers.
  // Cancel at a short sentence boundary and replay that sentence on Resume.
  function pauseStudyVoice(session) {
    if (activeStudyVoice !== session || session.paused) return;
    session.paused = true;
    if (session.currentIndex !== null) {
      session.nextIndex = session.currentIndex;
      session.currentIndex = null;
      session.token += 1;
      clearStudyVoiceHighlight(session);
      window.speechSynthesis.cancel();
    }
    setStudyVoiceButtonState(session, "paused");
    studyVoiceStatus(session, "Paused.", false);
  }

  function resumeStudyVoice(session) {
    if (activeStudyVoice !== session || !session.paused) return;
    session.paused = false;
    setStudyVoiceButtonState(session, "playing");
    studyVoiceStatus(session, "Reading.", false);
    speakNextStudyVoicePart(session);
  }

  function startStudyVoice(questionElement, toolbar, questionNumber, parts, startIndex) {
    stopStudyVoice();
    if (!parts.length) {
      const message = toolbar.querySelector(".study-voice-status");
      message.textContent = "No text available to read.";
      message.classList.remove("sr-only");
      message.classList.add("study-voice-error");
      return;
    }
    const session = {
      root: toolbar, questionElement: questionElement, questionNumber: questionNumber,
      seekTargets: [],
      rate: Number(toolbar.querySelector(".study-voice-speed").value),
      voice: preferredStudyVoice(), parts: parts,
      nextIndex: Math.max(0, Math.min(startIndex, parts.length - 1)),
      currentIndex: null, activeTarget: null, paused: false, token: 0,
      toggleButton: toolbar.querySelector('[data-voice-action="toggle"]'),
      stopButton: toolbar.querySelector('[data-voice-action="stop"]'),
      status: toolbar.querySelector(".study-voice-status")
    };
    activeStudyVoice = session;
    markLiveStudyVoiceTargets(session);
    setStudyVoiceButtonState(session, "playing");
    studyVoiceStatus(session, "Reading.", false);
    speakNextStudyVoicePart(session);
  }

  // A tap starts at the sentence nearest the tapped word where the browser
  // exposes caret coordinates. Keyboard use (and older browsers) starts at
  // the selected paragraph. Original note markup is never rewritten.
  function pickedStudyVoicePart(parts, element, event) {
    const indexes = [];
    parts.forEach(function (part, index) {
      if (part.element === element) indexes.push(index);
    });
    if (!indexes.length || event.type !== "click" ||
        !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) ||
        typeof document.createRange !== "function") return indexes[0] || 0;

    let node = null;
    let offset = 0;
    if (typeof document.caretPositionFromPoint === "function") {
      const caret = document.caretPositionFromPoint(event.clientX, event.clientY);
      if (caret) { node = caret.offsetNode; offset = caret.offset; }
    } else if (typeof document.caretRangeFromPoint === "function") {
      const caret = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (caret) { node = caret.startContainer; offset = caret.startOffset; }
    }
    if (!node || !element.contains(node)) return indexes[0];

    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.setEnd(node, offset);
      const chars = range.toString().replace(/\s+/g, " ").length;
      let position = 0;
      for (const index of indexes) {
        const length = parts[index].text.length;
        if (chars <= position + length) return index;
        position += length + 1; // The space between spoken sentences.
      }
      return indexes[indexes.length - 1];
    } catch (error) {
      return indexes[0];
    }
  }

  function beginStudyVoicePicker(questionElement, toolbar, questionNumber) {
    stopStudyVoice();
    const parts = buildStudyVoiceParts(questionElement);
    const starts = new Map();
    parts.forEach(function (part, index) {
      if (part.element && !starts.has(part.element)) starts.set(part.element, index);
    });
    const button = toolbar.querySelector('[data-voice-action="pick"]');
    const status = toolbar.querySelector(".study-voice-status");
    if (!starts.size) {
      status.textContent = "No section available to select.";
      status.classList.remove("sr-only");
      status.classList.add("study-voice-error");
      return;
    }
    const picker = { root: toolbar, button: button, status: status, targets: [] };
    activeStudyVoicePicker = picker;
    button.textContent = "Cancel";
    button.setAttribute("aria-pressed", "true");
    status.textContent = "Tap where you want reading to start.";
    status.classList.remove("sr-only", "study-voice-error");
    starts.forEach(function (index, element) {
      const before = {};
      ["tabindex", "role", "aria-label"].forEach(function (attr) {
        before[attr] = element.getAttribute(attr);
      });
      const select = function (event) {
        if (activeStudyVoicePicker !== picker) return;
        if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        closeStudyVoicePicker();
        startStudyVoice(questionElement, toolbar, questionNumber, parts,
          pickedStudyVoicePart(parts, element, event));
        if (event.type === "keydown") {
          toolbar.querySelector('[data-voice-action="toggle"]').focus();
        }
      };
      element.classList.add("study-voice-pickable");
      element.setAttribute("tabindex", "0");
      element.setAttribute("role", "button");
      element.setAttribute("aria-label",
        "Start listening from: " + visibleStudyVoiceText(element).slice(0, 110));
      element.addEventListener("click", select);
      element.addEventListener("keydown", select);
      picker.targets.push({ element: element, select: select, before: before });
    });
  }

  function createStudyVoiceControls(questionElement, questionNumber) {
    const toolbar = document.createElement("div");
    toolbar.className = "study-voice-toolbar";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "Voice reader for question " + questionNumber);
    toolbar.innerHTML = [
      '<button type="button" class="btn btn-secondary" data-voice-action="toggle">▶ Listen</button>',
      '<button type="button" class="btn btn-tertiary" data-voice-action="pick" ',
      '  aria-pressed="false" aria-label="Choose where to start reading">Start at…</button>',
      '<button type="button" class="btn btn-tertiary" data-voice-action="stop" disabled ',
      '  aria-label="Stop reading">Stop</button>',
      '<select class="study-voice-speed" aria-label="Reading speed">',
      '  <option value="0.75">0.75×</option>',
      '  <option value="1" selected>1×</option>',
      '  <option value="1.25">1.25×</option>',
      '  <option value="1.5">1.5×</option>',
      '</select>',
      '<select class="study-voice-voice" aria-label="Choose narrator voice" title="Choose voice">',
      '  <option value="auto">Voice: Auto</option>',
      '</select>',
      '<span class="study-voice-status sr-only" role="status" aria-live="polite"></span>'
    ].join("");

    const speedSelect = toolbar.querySelector(".study-voice-speed");
    const voiceSelect = toolbar.querySelector(".study-voice-voice");
    if (studyVoiceAvailable) populateStudyVoiceSelect(voiceSelect);
    const toggleButton = toolbar.querySelector('[data-voice-action="toggle"]');
    const pickButton = toolbar.querySelector('[data-voice-action="pick"]');
    const stopButton = toolbar.querySelector('[data-voice-action="stop"]');
    const status = toolbar.querySelector(".study-voice-status");
    toggleButton.setAttribute("aria-label", "Listen to study notes for question " + questionNumber);

    if (!studyVoiceAvailable) {
      toolbar.querySelectorAll("button, select").forEach(function (control) {
        control.disabled = true;
      });
      status.classList.remove("sr-only");
      status.classList.add("study-voice-error");
      status.textContent = "Voice reader unavailable in this browser.";
      return toolbar;
    }

    toggleButton.addEventListener("click", function () {
      const session = activeStudyVoice;
      if (session && session.root === toolbar) {
        if (session.paused) resumeStudyVoice(session);
        else pauseStudyVoice(session);
        return;
      }
      startStudyVoice(questionElement, toolbar, questionNumber, buildStudyVoiceParts(questionElement), 0);
    });
    pickButton.addEventListener("click", function () {
      if (activeStudyVoicePicker && activeStudyVoicePicker.root === toolbar) {
        closeStudyVoicePicker();
      } else {
        beginStudyVoicePicker(questionElement, toolbar, questionNumber);
      }
    });
    stopButton.addEventListener("click", function () {
      if ((activeStudyVoice && activeStudyVoice.root === toolbar) ||
          (activeStudyVoicePicker && activeStudyVoicePicker.root === toolbar)) stopStudyVoice();
    });
    speedSelect.addEventListener("change", function () {
      // New speed applies on the next short sentence. Never stop playback unexpectedly.
      if (activeStudyVoice && activeStudyVoice.root === toolbar) {
        activeStudyVoice.rate = Number(speedSelect.value);
      }
    });
    voiceSelect.addEventListener("change", function () {
      studyVoicePreference = voiceSelect.value;
      try {
        localStorage.setItem("studyVoicePreference", studyVoicePreference);
      } catch (error) { /* The choice works for this session without storage. */ }
      // Voice changes take effect on the next sentence; playback stays uninterrupted.
      refreshStudyVoiceSelectors();
    });
    return toolbar;
  }


  // The narration text itself acts as the seek surface while audio is playing.
  // This is delegated per question: it never changes or wraps the note markup.
  function attachLiveStudyVoiceSeeking(questionElement, toolbar, questionNumber) {
    let touchPress = null;
    let suppressClickUntil = 0;

    function currentSession() {
      const session = activeStudyVoice;
      return session && session.root === toolbar && !activeStudyVoicePicker
        ? session : null;
    }

    function tappedPartElement(session, origin) {
      const target = origin && origin.nodeType === 3 ? origin.parentElement : origin;
      if (!target || typeof target.closest !== "function") return null;
      // Preserve real controls, links, inputs, case-study disclosure and diagram actions.
      if (target.closest(
        "a, button, input, textarea, select, summary, label, [contenteditable], " +
        "[role='button'], .study-voice-toolbar, .question-case-study, .question-image-button"
      )) return null;
      let current = target;
      while (current && current !== questionElement) {
        if (session.seekTargets.includes(current)) return current;
        current = current.parentElement;
      }
      return null;
    }

    function seekToTouchOrTap(session, element, event) {
      if (currentSession() !== session || !element) return;
      const index = pickedStudyVoicePart(session.parts, element, {
        type: "click", clientX: event.clientX, clientY: event.clientY
      });
      startStudyVoice(questionElement, toolbar, questionNumber, session.parts, index);
    }

    questionElement.addEventListener("click", function (event) {
      if (Date.now() < suppressClickUntil || event.defaultPrevented) return;
      const session = currentSession();
      if (!session) return;
      const element = tappedPartElement(session, event.target);
      if (element) seekToTouchOrTap(session, element, event);
    });

    // A short finger tap uses click above. A deliberate hold seeks on pointerup,
    // which remains a direct user interaction for mobile browser audio policies.
    // Cancel on movement so normal vertical scrolling is never interpreted as seek.
    questionElement.addEventListener("pointerdown", function (event) {
      touchPress = null;
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      const session = currentSession();
      if (!session) return;
      const element = tappedPartElement(session, event.target);
      if (!element) return;
      touchPress = {
        pointerId: event.pointerId, session: session, element: element,
        x: event.clientX, y: event.clientY, since: Date.now()
      };
    });
    questionElement.addEventListener("pointermove", function (event) {
      if (!touchPress || event.pointerId !== touchPress.pointerId) return;
      if (Math.hypot(event.clientX - touchPress.x,
        event.clientY - touchPress.y) > 12) touchPress = null;
    });
    questionElement.addEventListener("pointercancel", function () {
      touchPress = null;
    });
    questionElement.addEventListener("pointerup", function (event) {
      if (!touchPress || event.pointerId !== touchPress.pointerId) return;
      const press = touchPress;
      touchPress = null;
      if (Date.now() - press.since < 450 ||
          Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) return;
      if (currentSession() !== press.session) return;
      suppressClickUntil = Date.now() + 400; // Prevent the follow-up synthetic click.
      if (event.cancelable) event.preventDefault();
      seekToTouchOrTap(press.session, press.element, event);
    });
    questionElement.addEventListener("contextmenu", function (event) {
      // On some phones the text-selection menu opens before pointerup.
      if (!touchPress || Date.now() - touchPress.since < 450) return;
      const press = touchPress;
      touchPress = null;
      if (currentSession() !== press.session) return;
      event.preventDefault();
      suppressClickUntil = Date.now() + 400;
      seekToTouchOrTap(press.session, press.element, {
        clientX: press.x, clientY: press.y
      });
    });
  }

  function addStudyVoiceToHeading(questionElement, panel, questionNumber) {
    const heading = panel.querySelector(".study-guide-title, .readable-panel-heading");
    const header = document.createElement("div");
    header.className = "study-guide-header";
    if (heading) {
      heading.parentNode.insertBefore(header, heading);
      header.appendChild(heading);
    } else {
      panel.insertBefore(header, panel.firstChild);
    }
    const toolbar = createStudyVoiceControls(questionElement, questionNumber);
    header.appendChild(toolbar);
    attachLiveStudyVoiceSeeking(questionElement, toolbar, questionNumber);
  }

  window.addEventListener("pagehide", function () { stopStudyVoice(); });

  function isAiGradedQuestion(question) {
    return Boolean(
      question &&
        (question.grading === "ai" ||
          question.answerType === "ai-text" ||
          question.aiGrading === true)
    );
  }

  function getAiGraderEndpoint() {
    const configured =
      window.APP_CONFIG &&
      typeof window.APP_CONFIG.aiGraderEndpoint === "string"
        ? window.APP_CONFIG.aiGraderEndpoint.trim()
        : "";

    if (configured) {
      return configured;
    }

    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      return "http://localhost:8888/api/grade-answer";
    }

    return "";
  }

  function normalizeAiGrade(rawGrade, question) {
    if (!rawGrade || typeof rawGrade !== "object") {
      throw new Error("The AI marking service returned an invalid response.");
    }

    const score = Math.max(
      0,
      Math.min(100, Number.isFinite(Number(rawGrade.score)) ? Number(rawGrade.score) : 0)
    );
    const passScore = Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(Number(question.aiPassScore))
          ? Number(question.aiPassScore)
          : 70
      )
    );

    return {
      score,
      accepted:
        typeof rawGrade.accepted === "boolean"
          ? rawGrade.accepted
          : score >= passScore,
      verdict:
        typeof rawGrade.verdict === "string"
          ? rawGrade.verdict
          : score >= 85
            ? "correct"
            : score >= passScore
              ? "mostly_correct"
              : score >= 40
                ? "partially_correct"
                : "incorrect",
      feedback:
        typeof rawGrade.feedback === "string" ? rawGrade.feedback : "",
      strengths: Array.isArray(rawGrade.strengths)
        ? rawGrade.strengths.filter((item) => typeof item === "string").slice(0, 5)
        : [],
      missingPoints: Array.isArray(rawGrade.missingPoints)
        ? rawGrade.missingPoints
            .filter((item) => typeof item === "string")
            .slice(0, 5)
        : [],
      bookAlignment:
        typeof rawGrade.bookAlignment === "string"
          ? rawGrade.bookAlignment
          : "",
      passScore,
    };
  }

  async function requestAiGrade(question, studentAnswer) {
    const endpoint = getAiGraderEndpoint();
    if (!endpoint) {
      throw new Error(
        "AI marking is not connected yet. A secure server endpoint is required before this question can be marked."
      );
    }

    const diagramImage =
      studentAnswer && typeof studentAnswer === "object" &&
      typeof studentAnswer.image === "string" &&
      (question.answerType === "diagram" || question.answerType === "uml-diagram")
        ? studentAnswer.image
        : "";
    const answerText =
      studentAnswer && typeof studentAnswer === "object"
        ? (typeof studentAnswer.text === "string" ? studentAnswer.text.trim() : "")
        : typeof studentAnswer === "string"
          ? studentAnswer.trim()
          : String(studentAnswer || "").trim();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question.text || "",
        studentAnswer: answerText || (diagramImage ? "Answer supplied as a drawn diagram." : ""),
        diagramImage,
        diagramRequired: question.diagramRequired === true,
        // A paper may prescribe its own rule for a missing diagram. Older
        // questions retain the existing default when no override is set.
        diagramNoDrawingCapPercent:
          Number.isFinite(question.diagramNoDrawingCapPercent)
            ? Math.max(0, Math.min(100, question.diagramNoDrawingCapPercent))
            : null,
        diagramNoDrawingNote:
          typeof question.diagramNoDrawingNote === "string"
            ? question.diagramNoDrawingNote
            : "",
        modelAnswer: formatAnswerForDisplay(question.correctAnswer),
        rubric: question.aiRubric || [],
        referenceNotes:
          question.aiReferenceNotes ||
          (question.study && question.study.simple) ||
          question.explanation ||
          "",
        chapter:
          question.study && question.study.chapter
            ? question.study.chapter
            : question.chapter || "",
        section:
          question.study && question.study.section
            ? question.study.section
            : question.section || "",
        minimumScore: Number.isFinite(Number(question.aiPassScore))
          ? Number(question.aiPassScore)
          : 70,
      }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : `AI marking failed (HTTP ${response.status}).`;
      throw new Error(message);
    }

    return normalizeAiGrade(payload, question);
  }

  async function gradeAiQuestions() {
    const pending = [];

    questions.forEach((question, index) => {
      if (!isAiGradedQuestion(question)) {
        return;
      }

      const answer = userAnswers[index];
      if (!hasProvidedAnswer(answer)) {
        return;
      }

      pending.push({ question, index, answer });
    });

    if (!pending.length) {
      return;
    }

    const originalText = submitButton ? submitButton.textContent : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent =
        pending.length === 1
          ? "AI is marking your answer..."
          : `AI is marking ${pending.length} answers...`;
    }

    try {
      for (const item of pending) {
        aiGrades[item.index] = await requestAiGrade(
          item.question,
          item.answer
        );
      }
    } finally {
      if (submitButton) {
        submitButton.textContent = originalText || "Submit Test";
      }
    }
  }

  function getQuestionMarks(question) {
    const marks = Number(question && question.marks);
    return Number.isFinite(marks) && marks > 0 ? marks : 1;
  }

  function getQuestionGrade(question, index, userAnswer) {
    const hasAnswer = hasProvidedAnswer(userAnswer);

    if (!hasAnswer) {
      return {
        hasAnswer: false,
        isCorrect: false,
        scoreValue: 0,
      };
    }

    if (isAiGradedQuestion(question)) {
      const aiGrade = aiGrades[index];
      if (!aiGrade) {
        return {
          hasAnswer: true,
          isCorrect: false,
          scoreValue: 0,
        };
      }

      return {
        hasAnswer: true,
        isCorrect: Boolean(aiGrade.accepted),
        scoreValue: getQuestionMarks(question) * Math.max(0, Math.min(1, aiGrade.score / 100)),
        aiGrade,
      };
    }

    if (question.grading === "table" && window.AnswerWorkspace) {
      const result = window.AnswerWorkspace.gradeTable(question, userAnswer);
      return {
        hasAnswer: true,
        isCorrect: result.score === 1,
        scoreValue: getQuestionMarks(question) * result.score,
        tableGrade: result,
      };
    }
    if (question.grading === "command") {
      // Compare shell commands without executing or lowercasing them.
      const tidy = value => String(value || "").replace(/\r\n/g, "\n").trim().replace(/[ \t]+/g, " ");
      const candidates = [question.correctAnswer].concat(question.acceptedAnswers || []);
      const isCorrect = candidates.some(value => tidy(value) === tidy(userAnswer));
      return {hasAnswer: true,isCorrect,scoreValue:isCorrect ? getQuestionMarks(question):0};
    }
    const isCorrect = answersMatch(userAnswer, question.correctAnswer);
    return {
      hasAnswer: true,
      isCorrect,
      scoreValue: isCorrect ? getQuestionMarks(question) : 0,
    };
  }

  function formatAiVerdict(verdict) {
    const labels = {
      correct: "Correct",
      mostly_correct: "Mostly correct",
      partially_correct: "Partly correct",
      incorrect: "Incorrect",
    };
    return labels[verdict] || "AI marked";
  }

  function createAiFeedbackElement(aiGrade) {
    if (!aiGrade) {
      return null;
    }

    const card = document.createElement("div");
    card.className = "ai-grade-feedback";

    const heading = document.createElement("div");
    heading.className = "ai-grade-heading";

    const score = document.createElement("strong");
    score.textContent = `AI mark: ${Math.round(aiGrade.score)}%`;
    heading.appendChild(score);

    const verdict = document.createElement("span");
    verdict.className = `ai-grade-verdict ai-grade-verdict--${aiGrade.verdict}`;
    verdict.textContent = formatAiVerdict(aiGrade.verdict);
    heading.appendChild(verdict);
    card.appendChild(heading);

    if (aiGrade.feedback) {
      const feedback = document.createElement("p");
      feedback.className = "ai-grade-summary";
      feedback.textContent = aiGrade.feedback;
      card.appendChild(feedback);
    }

    if (aiGrade.strengths && aiGrade.strengths.length) {
      const title = document.createElement("div");
      title.className = "ai-grade-list-title";
      title.textContent = "What you understood correctly";
      card.appendChild(title);

      const list = document.createElement("ul");
      list.className = "ai-grade-list";
      aiGrade.strengths.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      card.appendChild(list);
    }

    if (aiGrade.missingPoints && aiGrade.missingPoints.length) {
      const title = document.createElement("div");
      title.className = "ai-grade-list-title";
      title.textContent = "What to improve";
      card.appendChild(title);

      const list = document.createElement("ul");
      list.className = "ai-grade-list";
      aiGrade.missingPoints.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      card.appendChild(list);
    }

    if (aiGrade.bookAlignment) {
      const alignment = document.createElement("p");
      alignment.className = "ai-grade-book-alignment";
      alignment.textContent = aiGrade.bookAlignment;
      card.appendChild(alignment);
    }

    return card;
  }


  function resetStats() {
    // Reset the stats object
    testStats = {
      testsTaken: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsAbandoned: 0,
      passedTests: [],
      failedTests: [],
      abandonedTests: [],
    };
    resetStreak();
    // Save to localStorage
    saveStats();
    // Update the stats display
    updateStatsDisplay();
  }

  function updateHistoryList(listElement, items) {
    if (!listElement) return;
    listElement.innerHTML = "";
    if (!items || items.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No records yet.";
      listElement.appendChild(emptyItem);
      return;
    }

    items
      .slice(-5)
      .reverse()
      .forEach((item) => {
        const entry = document.createElement("li");
        entry.textContent = item;
        listElement.appendChild(entry);
      });
  }

  function updateStatsPanel() {
    if (statsTestsTakenElement) {
      statsTestsTakenElement.textContent = testStats.testsTaken;
    }
    if (statsTestsPassedElement) {
      statsTestsPassedElement.textContent = testStats.testsPassed;
    }
    if (statsTestsFailedElement) {
      statsTestsFailedElement.textContent = testStats.testsFailed;
    }
    if (statsTestsAbandonedElement) {
      statsTestsAbandonedElement.textContent = testStats.testsAbandoned;
    }
    updateHistoryList(statsPassedList, testStats.passedTests);
    updateHistoryList(statsFailedList, testStats.failedTests);
    updateHistoryList(statsAbandonedList, testStats.abandonedTests);
  }

  function calculateXp() {
    const activityPoints = testStats.testsTaken * 120;
    const successBonus = testStats.testsPassed * 80;
    const achievementBonus = unlockedAchievements.size * 150;
    return activityPoints + successBonus + achievementBonus;
  }

  function updateGamification() {
    if (streakValueElement) {
      const label = streakData.count === 1 ? "day" : "days";
      streakValueElement.textContent = `${streakData.count} ${label}`;
    }
    if (xpValueElement) {
      xpValueElement.textContent = calculateXp().toLocaleString();
    }
    if (badgeValueElement) {
      const badgeCount = unlockedAchievements.size;
      badgeValueElement.textContent = `${badgeCount} ${
        badgeCount === 1 ? "badge" : "badges"
      } earned`;
    }
  }

  function saveStreak() {
    localStorage.setItem("studyStreak", JSON.stringify(streakData));
  }

  function resetStreak() {
    streakData = { count: 0, lastDate: null };
    saveStreak();
    updateGamification();
  }

  function isConsecutiveDay(previousDate, currentDate) {
    if (!previousDate) return false;
    const previous = new Date(previousDate);
    const current = new Date(currentDate);
    if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) {
      return false;
    }
    const diff = current.setHours(0, 0, 0, 0) - previous.setHours(0, 0, 0, 0);
    return Math.round(diff / (1000 * 60 * 60 * 24)) === 1;
  }

  function incrementStreakIfNeeded() {
    if (streakData.lastDate === today) {
      return;
    }
    if (streakData.lastDate && isConsecutiveDay(streakData.lastDate, today)) {
      streakData.count += 1;
    } else {
      streakData.count = 1;
    }
    streakData.lastDate = today;
    saveStreak();
    updateGamification();
  }

  function loadStreak() {
    try {
      const stored = JSON.parse(localStorage.getItem("studyStreak"));
      if (stored && typeof stored.count === "number") {
        streakData = stored;
      }
    } catch (error) {
      console.warn("Unable to load streak data:", error);
    }

    if (
      streakData.lastDate &&
      streakData.lastDate !== today &&
      !isConsecutiveDay(streakData.lastDate, today)
    ) {
      streakData.count = 0;
    }

    updateGamification();
  }

  if (statsResetButton) {
    statsResetButton.addEventListener("click", resetStats);
  }

  if (optionsModal) {
    optionsModal.setAttribute(
      "aria-hidden",
      optionsModal.classList.contains("hidden") ? "true" : "false"
    );
  }

  if (modalBackdrop) {
    modalBackdrop.setAttribute(
      "aria-hidden",
      modalBackdrop.classList.contains("hidden") ? "true" : "false"
    );
    modalBackdrop.addEventListener("click", closeActiveModal);
  }

  if (modeButtons.length) {
    modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetMode = button.dataset.mode;
        if (targetMode) {
          setMode(targetMode);
        }
      });
    });
  }

  if (openOptionsButton) {
    openOptionsButton.addEventListener("click", openOptionsModal);
  }

  if (closeOptionsButton) {
    closeOptionsButton.addEventListener("click", closeOptionsModal);
  }

  if (defineTestButton) {
    defineTestButton.addEventListener("click", openDefineTestModal);
  }

  if (closeDefineTestButton) {
    closeDefineTestButton.addEventListener("click", closeDefineTestModal);
  }

  if (cancelDefineTestButton) {
    cancelDefineTestButton.addEventListener("click", closeDefineTestModal);
  }

  if (defineTestForm) {
    defineTestForm.addEventListener("submit", handleDefineTestSubmit);
  }

  if (defineTestQuestionInput) {
    defineTestQuestionInput.addEventListener("input", () => {
      updateDefineTestSummary();
    });
  }

  if (defineTestTimerInput) {
    defineTestTimerInput.addEventListener("input", () => {
      if (defineTestError && defineTestError.textContent) {
        defineTestError.textContent = "";
      }
    });
  }

  if (exitCustomSessionButton) {
    exitCustomSessionButton.addEventListener("click", handleExitCustomSession);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (isDefineTestModalOpen()) {
      event.preventDefault();
      closeDefineTestModal();
      return;
    }

    if (isOptionsModalOpen()) {
      event.preventDefault();
      closeOptionsModal();
      return;
    }

    if (isTestControlsModalOpen()) {
      event.preventDefault();
      closeTestControlsModal();
    }
  });

  if (studyModeToggle && studyModeToggle.checked) {
    currentMode = "study";
  }

  setMode(currentMode);

  if (aiStudyToolsSetting) {
    aiStudyToolsSetting.addEventListener("change", () => {
      // The AI buttons must disappear immediately when the session opt-in is off.
      renderQuestions();
    });
  }

  handleResponsiveState();

  if (headerToggleButton) {
    headerToggleButton.addEventListener("click", () => {
      if (isTestControlsModalOpen()) {
        closeTestControlsModal();
      } else {
        openTestControlsModal();
      }
    });
  }

  if (closeTestControlsButton) {
    closeTestControlsButton.addEventListener("click", () => closeTestControlsModal());
  }

  window.addEventListener("resize", handleResponsiveState);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncModalViewport);
    window.visualViewport.addEventListener("scroll", syncModalViewport);
  }

  loadStreak();
  loadStats();

  //************************ SECTION 1B: MOTIVATION & ACHIEVEMENTS ************************//


  function updateMotivationMessage() {
    if (!motivationMessageElement) return;
    let randomIndex = Math.floor(Math.random() * motivationMessages.length);
    if (motivationMessages.length > 1 && randomIndex === lastMotivationIndex) {
      randomIndex = (randomIndex + 1) % motivationMessages.length;
    }
    lastMotivationIndex = randomIndex;
    motivationMessageElement.textContent = motivationMessages[randomIndex];
  }

  if (newMotivationButton) {
    newMotivationButton.addEventListener("click", updateMotivationMessage);
  }

  updateMotivationMessage();

  let toastTimeoutId;


  function saveAchievements() {
    localStorage.setItem(
      "achievements",
      JSON.stringify(Array.from(unlockedAchievements))
    );
  }

  function showAchievementToast(message) {
    if (!achievementToast) return;
    achievementToast.textContent = message;
    achievementToast.classList.remove("hidden");
    achievementToast.classList.add("visible");
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      achievementToast.classList.remove("visible");
      toastTimeoutId = setTimeout(() => {
        achievementToast.classList.add("hidden");
      }, 400);
    }, 2500);
  }

  function updateAchievementDisplay() {
    if (!achievementListElement) return;
    achievementListElement.innerHTML = "";
    if (unlockedAchievements.size === 0) {
      const emptyState = document.createElement("li");
      emptyState.classList.add("empty");
      emptyState.textContent = "Complete a test to start earning badges!";
      achievementListElement.appendChild(emptyState);
      return;
    }

    achievementDefinitions.forEach((achievement) => {
      if (unlockedAchievements.has(achievement.id)) {
        const item = document.createElement("li");
        item.innerHTML = `<strong>${achievement.title}:</strong> ${achievement.description}`;
        achievementListElement.appendChild(item);
      }
    });

    updateGamification();
  }

  function unlockAchievement(achievementId) {
    if (unlockedAchievements.has(achievementId)) {
      return;
    }
    unlockedAchievements.add(achievementId);
    saveAchievements();
    updateAchievementDisplay();
    const achievement = achievementDefinitions.find(
      (item) => item.id === achievementId
    );
    if (achievement) {
      showAchievementToast(`Achievement unlocked: ${achievement.title}!`);
    }
  }

  function evaluateAchievements(score, timeLeftAtSubmission) {
    if (questions.length === 0) return;

    unlockAchievement("first-test");

    const availableMarks = questions.reduce(
      (total, question) => total + getQuestionMarks(question), 0
    );
    if (availableMarks > 0 && score >= availableMarks - 0.0001) {
      unlockAchievement("perfect-score");
    }

    if (
      typeof timeLeftAtSubmission === "number" &&
      timeLeftAtSubmission >= 300
    ) {
      unlockAchievement("speedster");
    }

    checkBookmarkAchievements();
  }

  updateAchievementDisplay();


  //************************ SECTION 3: THEME HANDLING ************************//

  // Three dark intensities plus Light. Preserve existing settings and migrate
  // the old single "dark" value to Deep so returning users get less glare.
  const appearanceModes = ["light", "slate", "deep", "black"];

  function applyAppearanceMode(value) {
    const chosen = appearanceModes.includes(value) ? value : "light";
    document.body.classList.remove(
      "light-mode", "dark-mode", "theme-slate", "theme-deep", "theme-black"
    );
    document.body.classList.add(chosen === "light" ? "light-mode" : "dark-mode");
    if (chosen !== "light") document.body.classList.add("theme-" + chosen);
    document.documentElement.style.colorScheme = chosen === "light" ? "light" : "dark";
    themeButtons.forEach(function (button) {
      const active = button.dataset.theme === chosen;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("active", active);
    });
    try {
      localStorage.setItem("theme", chosen);
    } catch (error) {
      // Theme switching still works when a private browser blocks storage.
    }
    return chosen;
  }

  let savedAppearance = "light";
  try {
    savedAppearance = localStorage.getItem("theme") || "light";
  } catch (error) { /* Storage is optional. */ }
  applyAppearanceMode(savedAppearance === "dark" ? "deep" : savedAppearance);
  themeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      applyAppearanceMode(button.dataset.theme);
    });
  });

  //************************ SECTION 4: TEST FILE LOADING ************************//

  // Test file references
const testFiles = [
  // Curated INF3708 originals and separately labelled ICT2631 original revision
  // packs. Legacy test*.json files stay hidden from the picker and custom builder.
  "inf3708-oct-nov-2021.json",
  "inf3708-jan-feb-2025-supplementary.json",
  "inf3708-assessment-1-2026.json",
  "test36.json", // INF3708 Assessment 2 (14 June 2026)
  "ict2631-oct-nov-2025-inspired.json",
  "ict2631-jan-feb-2025-inspired.json",
  "ict2631-assessment-1-2026-practice.json",
  "ict2631-assessment-2-2026-practice.json",
  // ICT2622 original, clearly-labelled revision packs and mixed-format lab.
  "ict2622-jan-feb-2025-practice.json",
  "ict2622-oct-nov-2025-practice.json",
  "ict2622-jan-feb-2026-practice.json",
  "ict2622-assessment-1-2026-practice.json",
  "ict2622-assessment-2-2026-practice.json",
  "ict2622-practical-skills-lab.json",
  // Verified 2026 additions. ICT2613 is intentionally partial: missing/truncated
  // tutorial-letter questions are withheld instead of reconstructed by guesswork.
  "ict2613-assessment-1-2026-partial.json",
  "ict2642-assessment-2-2026.json",
];


  // Load test files into the select element
  function loadTestFiles() {
    testSelect.innerHTML = "";
    availableTestsMetadata = [];
    let firstTestLoaded = false;
    let savedProgressFile = null;
    let savedProgressData = null;
    let savedPreferenceFile =
      typeof appPreferences.lastSelectedPaper === "string"
        ? appPreferences.lastSelectedPaper
        : null;

    try {
      savedProgressData = JSON.parse(localStorage.getItem("testProgress"));
      if (savedProgressData && savedProgressData.currentTestFile) {
        savedProgressFile = savedProgressData.currentTestFile;
      }
      if (
        savedProgressData &&
        typeof savedProgressData.lastRegularTestValue === "string"
      ) {
        lastRegularTestValue = savedProgressData.lastRegularTestValue;
      }
    } catch (error) {
      console.warn("Unable to read saved progress metadata:", error);
    }

    // An older saved exam must not reopen a module that is currently hidden.
    if (savedProgressFile !== CUSTOM_TEST_VALUE && !testFiles.includes(savedProgressFile)) {
      savedProgressFile = null;
    }
    if (!testFiles.includes(lastRegularTestValue)) {
      lastRegularTestValue = null;
    }
    if (!testFiles.includes(savedPreferenceFile)) {
      savedPreferenceFile = null;
    }

    // Active progress wins. Otherwise reopen the paper the student last chose.
    const preferredFile = savedProgressFile || savedPreferenceFile;

    const fetchPromises = testFiles.map((filename) =>
      fetch(filename)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Error loading file: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          const option = document.createElement("option");
          option.value = filename;
          option.textContent = data.testName
            ? data.testName
            : filename.replace(".json", "").replace(/_/g, " ");
          testSelect.appendChild(option);

          const questionCount = Array.isArray(data.questions)
            ? data.questions.length
            : 0;
          option.dataset.questionCount = String(questionCount);
          availableTestsMetadata.push({
            file: filename,
            name: option.textContent,
            questionCount,
          });

          const shouldLoadThisFile = preferredFile
            ? preferredFile !== CUSTOM_TEST_VALUE &&
              filename === preferredFile
            : !firstTestLoaded;

          if (!firstTestLoaded && shouldLoadThisFile) {
            firstTestLoaded = true;
            testSelect.value = filename;
            loadQuestions(filename);
          }
        })
        .catch((error) => {
          console.error("Error loading test name:", error);
          const errorOption = document.createElement("option");
          errorOption.textContent = `Error loading ${filename}`;
          errorOption.disabled = true;
          testSelect.appendChild(errorOption);
        })
    );

    Promise.all(fetchPromises)
      .then(() => {
        console.log("All test files loaded");
        populateDefineTestModal();

        if (
          savedProgressFile === CUSTOM_TEST_VALUE &&
          savedProgressData &&
          savedProgressData.customSession
        ) {
          const restored = restoreCustomSessionFromProgress(savedProgressData);
          if (restored) {
            testSelect.dataset.previousValue = testSelect.value;
            return;
          }
        }

        if (!firstTestLoaded && testFiles.length > 0) {
          testSelect.value = testFiles[0];
          loadQuestions(testFiles[0]);
        }
        testSelect.dataset.previousValue = testSelect.value;
      })
      .catch((error) => {
        console.error("Error loading test files:", error);
      });
  }

  // Load the test files into the dropdown on page load
  loadTestFiles();

  //************************ SECTION 5: QUESTION LOADING ************************//

  // Load questions from selected file
  function cloneQuestionData(question) {
    if (!question || typeof question !== "object") {
      return question;
    }

    const clonedQuestion = { ...question };

    if (Array.isArray(question.options)) {
      clonedQuestion.options = [...question.options];
    }

    if (Array.isArray(question.correctAnswer)) {
      clonedQuestion.correctAnswer = [...question.correctAnswer];
    }

    return clonedQuestion;
  }

  function cloneQuestionsData(rawQuestions) {
    if (!Array.isArray(rawQuestions)) {
      return [];
    }
    return rawQuestions.map((question) => cloneQuestionData(question));
  }

  function prepareQuestionsForSession(baseQuestions, preserveOrder = false) {
    if (!Array.isArray(baseQuestions)) {
      return [];
    }

    const questionsWithShuffledOptions = baseQuestions.map((question) => {
      const clonedQuestion = cloneQuestionData(question);
      if (!preserveOrder && Array.isArray(clonedQuestion.options)) {
        clonedQuestion.options = shuffleArray([...clonedQuestion.options]);
      }
      return clonedQuestion;
    });

    return preserveOrder
      ? questionsWithShuffledOptions
      : shuffleArray(questionsWithShuffledOptions);
  }

  function loadQuestions(filename, customData = null) {
    stopStudyVoice();
    currentTestFile = filename;
    syncBookAvailability();
    if (window.MasteryEngine) {
      window.MasteryEngine.setContext({ mode: currentMode, testFile: filename });
    }
    if (filename !== CUSTOM_TEST_VALUE) {
      lastRegularTestValue = filename;
      saveAppPreferences({ lastSelectedPaper: filename });
    }

    const initializeFromQuestions = (rawQuestions, preserveOrder = false) => {
      originalQuestions = cloneQuestionsData(rawQuestions || []);
      currentTestPreserveOrder = preserveOrder;
      questions = prepareQuestionsForSession(originalQuestions, preserveOrder);
      initializeTest();
    };

    if (customData) {
      initializeFromQuestions(customData.questions);
    } else {
      fetch(filename)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Error loading file: ${response.statusText}`);
          }
          return response.json();
        })
        .then((data) => {
          if (Number.isFinite(Number(data.durationMinutes)) &&
              Number(data.durationMinutes) > 0 && timerInput) {
            timerInput.value = String(data.durationMinutes);
          }
          initializeFromQuestions(data.questions, data.preserveOrder === true);
        })
        .catch((error) => {
          console.error("Error loading questions:", error);
          originalQuestions = [];
          questions = [];
          questionsContainer.innerHTML = `<p>Unable to load questions. Please try again or select another test.</p>`;
          renderFlashcards();
        });
    }
  }

  // These five original AI-generated MCQs are a new practice SESSION, never
  // added to the official-paper list. They use the existing local MCQ grader.
  function startGeneratedPractice(generated, info = {}) {
    if (!Array.isArray(generated) || generated.length !== 5 ||
        generated.some(q => !q.options || !q.options.includes(q.correctAnswer))) {
      throw new Error("The generated practice set is incomplete.");
    }
    const firstSource = testFiles.includes(currentTestFile)
      ? currentTestFile
      : currentCustomSession?.sources?.find(source => testFiles.includes(source.file))?.file;
    if (!firstSource) {
      throw new Error("Select a saved paper before opening AI-generated practice.");
    }
    const selectedLabel = testSelect?.selectedOptions?.[0]?.textContent || firstSource;
    const sources = isCustomSessionActive() && Array.isArray(currentCustomSession.sources)
      ? currentCustomSession.sources.filter(source => testFiles.includes(source.file))
      : [{ file: firstSource, name: selectedLabel, questionCount: questions.length }];
    const practice = cloneQuestionsData(generated).map(question => ({
      ...question,
      sourceTestId: firstSource,
      sourceTestName: "AI-generated practice · not an official paper",
      sourceType: "AI-generated revision; not an actual UNISA exam or assessment"
    }));
    const matchedCode = String(info.module || selectedLabel).match(/\b(?:ICT|INF)\d{4}\b/i);
    const label = "AI practice · " + (matchedCode ? matchedCode[0].toUpperCase() : "Mixed topics") +
      " · not official";
    currentCustomSession = {
      id: "ai-practice-" + Date.now(),
      sources,
      requestedCount: practice.length,
      questionCount: practice.length,
      totalAvailableQuestions: practice.length,
      timerMinutes: 10,
      sourceQuestions: cloneQuestionsData(practice),
      activeQuestions: cloneQuestionsData(practice),
      displayName: label,
    };
    ensureCustomTestOption(label);
    testSelect.value = CUSTOM_TEST_VALUE;
    testSelect.dataset.previousValue = CUSTOM_TEST_VALUE;
    if (timerInput) timerInput.value = "10";
    clearSavedProgress();
    loadQuestions(CUSTOM_TEST_VALUE, { questions: practice });
    setMode("test");
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function createCustomSession({
    selectedTests,
    requestedCount,
    timerMinutes = null,
  }) {
    if (!Array.isArray(selectedTests) || selectedTests.length === 0) {
      throw new Error("Select at least one test.");
    }

    const fetchPromises = selectedTests.map((test) =>
      fetch(test.file)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Error loading ${test.name || test.file}`);
          }
          return response.json();
        })
        .then((data) => ({ file: test.file, data }))
    );

    const results = await Promise.allSettled(fetchPromises);
    const successful = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (!successful.length) {
      throw new Error("Unable to load the selected tests.");
    }

    const aggregatedQuestions = [];
    const countsByFile = new Map();

    successful.forEach(({ file, data }) => {
      const meta = getTestMetadataByFile(file);
      const testName =
        meta?.name ||
        (data && typeof data.testName === "string" && data.testName.trim()
          ? data.testName.trim()
          : file);

      const sourceQuestions = Array.isArray(data.questions)
        ? data.questions
        : [];

      countsByFile.set(file, sourceQuestions.length);

      sourceQuestions.forEach((question, index) => {
        const questionCopy = cloneQuestionData(question);
        questionCopy.sourceTestId = file;
        questionCopy.sourceTestName = testName;
        questionCopy.sourceQuestionIndex = index;
        aggregatedQuestions.push(questionCopy);
      });
    });

    if (!aggregatedQuestions.length) {
      throw new Error("The selected tests have no questions.");
    }

    const totalAvailable = aggregatedQuestions.length;
    const effectiveRequested = Math.max(1, requestedCount);
    const limit = Math.min(effectiveRequested, totalAvailable);
    const sampled = shuffleArray([...aggregatedQuestions]).slice(0, limit);
    const activeQuestions = cloneQuestionsData(sampled);

    const sources = successful.map(({ file, data }) => {
      const meta = getTestMetadataByFile(file);
      const derivedName =
        meta?.name ||
        (data && typeof data.testName === "string" && data.testName.trim()
          ? data.testName.trim()
          : file);
      const questionCount = countsByFile.get(file) || 0;
      return { file, name: derivedName, questionCount };
    });

    if (typeof timerMinutes === "number" && timerInput) {
      timerInput.value = String(timerMinutes);
    }

    currentCustomSession = {
      id: `custom-${Date.now()}`,
      sources,
      requestedCount: effectiveRequested,
      questionCount: activeQuestions.length,
      totalAvailableQuestions: totalAvailable,
      timerMinutes: typeof timerMinutes === "number" ? timerMinutes : null,
      sourceQuestions: cloneQuestionsData(aggregatedQuestions),
      activeQuestions,
      displayName: getCustomSessionSourceSummary(sources),
    };

    ensureCustomTestOption(currentCustomSession.displayName);

    if (testSelect) {
      if (!isCustomSessionActive() && testSelect.value !== CUSTOM_TEST_VALUE) {
        lastRegularTestValue = testSelect.value;
      }
      testSelect.value = CUSTOM_TEST_VALUE;
      testSelect.dataset.previousValue = CUSTOM_TEST_VALUE;
    }

    clearSavedProgress();
    loadQuestions(CUSTOM_TEST_VALUE, { questions: activeQuestions });

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) {
      console.warn(
        `Some selected tests could not be loaded: ${failed
          .map((item) => item.reason?.message || "Unknown error")
          .join(", ")}`
      );
    }
  }

  function sampleQuestionsFromCustomSession() {
    if (
      !currentCustomSession ||
      !Array.isArray(currentCustomSession.sourceQuestions)
    ) {
      return [];
    }

    const pool = cloneQuestionsData(currentCustomSession.sourceQuestions);
    if (!pool.length) {
      return [];
    }

    const effectiveRequested = Math.max(
      1,
      currentCustomSession.requestedCount || pool.length
    );
    const limit = Math.min(effectiveRequested, pool.length);
    return shuffleArray(pool).slice(0, limit);
  }

  function regenerateCustomSessionQuestions() {
    if (!isCustomSessionActive()) {
      return;
    }

    const nextQuestions = sampleQuestionsFromCustomSession();
    if (!nextQuestions.length) {
      console.warn("No questions available to regenerate the custom session.");
      return;
    }

    currentCustomSession.activeQuestions = cloneQuestionsData(nextQuestions);
    currentCustomSession.questionCount = nextQuestions.length;
    clearSavedProgress();
    if (testSelect) {
      testSelect.value = CUSTOM_TEST_VALUE;
      testSelect.dataset.previousValue = CUSTOM_TEST_VALUE;
    }
    loadQuestions(CUSTOM_TEST_VALUE, {
      questions: currentCustomSession.activeQuestions,
    });
  }

  function restoreCustomSessionFromProgress(progressData) {
    if (!progressData || !progressData.customSession) {
      return false;
    }

    const session = progressData.customSession;
    const activeQuestions = Array.isArray(session.activeQuestions)
      ? session.activeQuestions
      : [];

    if (!activeQuestions.length) {
      return false;
    }

    const sources = Array.isArray(session.sources) ? session.sources : [];

    // Do not restore a previously saved custom mix containing hidden modules.
    if (!sources.length || sources.some((source) => !source || !testFiles.includes(source.file))) {
      return false;
    }

    currentCustomSession = {
      id: session.id || `custom-${Date.now()}`,
      sources,
      requestedCount:
        typeof session.requestedCount === "number"
          ? session.requestedCount
          : activeQuestions.length,
      questionCount:
        typeof session.questionCount === "number"
          ? session.questionCount
          : activeQuestions.length,
      totalAvailableQuestions:
        typeof session.totalAvailableQuestions === "number"
          ? session.totalAvailableQuestions
          : Array.isArray(session.sourceQuestions)
          ? session.sourceQuestions.length
          : activeQuestions.length,
      timerMinutes:
        typeof session.timerMinutes === "number" ? session.timerMinutes : null,
      sourceQuestions: cloneQuestionsData(
        session.sourceQuestions || activeQuestions
      ),
      activeQuestions: cloneQuestionsData(activeQuestions),
      displayName:
        session.displayName || getCustomSessionSourceSummary(sources),
    };

    ensureCustomTestOption(currentCustomSession.displayName);
    if (testSelect) {
      testSelect.value = CUSTOM_TEST_VALUE;
      testSelect.dataset.previousValue = CUSTOM_TEST_VALUE;
    }

    if (
      typeof currentCustomSession.timerMinutes === "number" &&
      timerInput
    ) {
      timerInput.value = String(currentCustomSession.timerMinutes);
    }

    loadQuestions(CUSTOM_TEST_VALUE, {
      questions: currentCustomSession.activeQuestions,
    });
    return true;
  }

  function exitCustomSession({ loadFallback = true } = {}) {
    if (!currentCustomSession) {
      return;
    }

    currentCustomSession = null;
    activeSourceFilter = "all";
    if (reviewSourceFilterSelect) {
      reviewSourceFilterSelect.value = "all";
    }
    clearCustomTestOption();
    updateCustomSessionChip();
    clearSavedProgress();

    if (!loadFallback) {
      return;
    }

    let fallbackValue =
      testFiles.includes(lastRegularTestValue)
        ? lastRegularTestValue
        : null;

    if (testSelect && (!fallbackValue || !testSelect.value)) {
      const firstOption = testSelect.querySelector("option");
      fallbackValue = firstOption ? firstOption.value : null;
    }

    if (testSelect && fallbackValue) {
      testSelect.value = fallbackValue;
      testSelect.dataset.previousValue = fallbackValue;
      lastRegularTestValue = fallbackValue;
      loadQuestions(fallbackValue);
    }
  }

  function handleExitCustomSession() {
    if (!isCustomSessionActive()) {
      return;
    }

    if (testInProgress || timerStarted) {
      const confirmExit = confirm(
        "Are you sure you want to exit this custom test?"
      );
      if (!confirmExit) {
        return;
      }

      testStats.testsAbandoned++;
      const testName = testSelect
        ? testSelect.options[testSelect.selectedIndex]?.textContent || "Custom Mix"
        : "Custom Mix";
      testStats.abandonedTests.push(testName);
      saveStats();
      updateStatsDisplay();
    }

    clearInterval(timer);
    timer = null;
    exitCustomSession({ loadFallback: true });
  }

  // Initialize test variables and UI
  function initializeTest() {
    resetReviewState();
    if (revisionController) revisionController.reset();
    aiGrades = {};
    if (questions.length === 0) {
      questionsContainer.innerHTML = `<p>No questions available in the selected file.</p>`;
      paginationControls.classList.add("hidden");
      bookmarkedQuestions = new Set();
      updateBookmarkPanel();
      return;
    }

    clearInterval(timer);
    timer = null;
    timerStarted = false;
    initialTimerSeconds = null;

    const savedProgress = getSavedProgress();
    const hasSavedProgress = Boolean(savedProgress);

    if (hasSavedProgress) {
      userAnswers = savedProgress.userAnswers || {};
      remainingTime =
        typeof savedProgress.remainingTime === "number"
          ? savedProgress.remainingTime
          : getTimerInputSeconds();
      currentPage = savedProgress.currentPage || 1;
      testInProgress = !!savedProgress.testInProgress && remainingTime > 0;
      testSubmitted = !!savedProgress.testSubmitted;
      bookmarkedQuestions = new Set(savedProgress.bookmarkedQuestions || []);
      isTimerPaused = !!savedProgress.isTimerPaused;
      showAllQuestions = !!savedProgress.showAllQuestions;
    } else {
      currentPage = 1;
      userAnswers = {};
      testInProgress = false;
      testSubmitted = false;
      bookmarkedQuestions = new Set();
      isTimerPaused = false;
      remainingTime = getTimerInputSeconds();
      showAllQuestions = false;
    }

    bookmarkCycleIndex = 0;
    startTestButton.disabled = testInProgress;
    submitButton.disabled = !testInProgress;
    submitButton.style.display = testSubmitted ? "none" : "inline-block";
    pauseTimerButton.textContent = isTimerPaused
      ? "Continue Timer"
      : "Pause Timer";

    updateTimerDisplay(
      Math.floor(Math.max(remainingTime, 0) / 60),
      Math.max(remainingTime, 0) % 60
    );

    scoreContainer.classList.add("hidden");
    scoreContainer.style.display = "none";
    resultMessageElement.textContent = "";
    resultMessageElement.classList.remove("pass-message", "fail-message");
    hideResultBanner();

    renderQuestions();
    updatePaginationControls();
    updateProgress();
    updateBookmarkPanel();
    renderFlashcards();
    updateCustomSessionChip();
    updateReviewFilterVisibility();

    if (hasSavedProgress && testInProgress && remainingTime > 0) {
      startTimer(true);
      if (isTimerPaused) {
        isTimerPaused = true;
        pauseTimerButton.textContent = "Continue Timer";
      }
    } else {
      testInProgress = false;
    }
  }

  //************************ SECTION 6: RENDERING QUESTIONS ************************//

  function createDiagramAnswerInput(actualIndex) {
    const previous = userAnswers[actualIndex];
    const answer = previous && typeof previous === "object" && !Array.isArray(previous)
      ? previous
      : { text: "", image: "" };
    userAnswers[actualIndex] = answer;

    const wrapper = document.createElement("div");
    wrapper.className = "diagram-answer";
    const instructions = document.createElement("p");
    instructions.textContent =
      questions[actualIndex].diagramInstructions ||
      "Draw the required diagram using a mouse, touch or pen, or upload a clear image. " +
      "Include important labels, connections and any requested calculations. " +
      "The question's own grading rubric controls missing-diagram marks.";
    wrapper.appendChild(instructions);

    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 480;
    canvas.className = "diagram-canvas";
    canvas.setAttribute("aria-label", "Draw the Activity-on-Arrow network diagram");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#172b4d";
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    wrapper.appendChild(canvas);

    let drawing = false;
    let edited = false;
    const positions = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height,
      };
    };
    const saveChange = () => {
      updateProgress();
      if (!isStudyMode && !timerStarted && !testSubmitted) {
        startTimer();
        if (startTestButton) startTestButton.disabled = true;
        if (submitButton) submitButton.disabled = false;
        testInProgress = true;
      }
      saveProgress();
    };
    const commitDrawing = () => {
      if (!edited) return;
      answer.image = canvas.toDataURL("image/jpeg", 0.84);
      edited = false;
      saveChange();
    };
    if (answer.image && /^data:image\//.test(answer.image)) {
      const existing = new Image();
      existing.onload = () => {
        if (!edited && answer.image === existing.src) {
          ctx.drawImage(existing, 0, 0, canvas.width, canvas.height);
        }
      };
      existing.src = answer.image;
    }
    canvas.addEventListener("pointerdown", (event) => {
      if (testSubmitted) return;
      event.preventDefault();
      const point = positions(event);
      drawing = true;
      edited = true;
      canvas.setPointerCapture(event.pointerId);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drawing || testSubmitted) return;
      event.preventDefault();
      const point = positions(event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    });
    const finishStroke = () => {
      if (!drawing) return;
      drawing = false;
      commitDrawing();
    };
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", finishStroke);
    if (testSubmitted) canvas.style.pointerEvents = "none";

    const controls = document.createElement("div");
    controls.className = "diagram-controls";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn btn-secondary";
    clear.textContent = "Clear drawing";
    clear.disabled = testSubmitted;
    clear.addEventListener("click", () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#172b4d";
      answer.image = "";
      edited = false;
      saveChange();
    });
    controls.appendChild(clear);

    const uploadLabel = document.createElement("label");
    uploadLabel.className = "diagram-upload-label";
    uploadLabel.textContent = "Or upload your drawing: ";
    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/png,image/jpeg,image/webp";
    upload.disabled = testSubmitted;
    upload.setAttribute("aria-label", "Upload a network diagram image");
    upload.addEventListener("change", () => {
      const file = upload.files && upload.files[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
        alert("Choose a PNG, JPEG or WebP image no larger than 8 MB.");
        upload.value = "";
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
        const width = img.width * ratio;
        const height = img.height * ratio;
        ctx.drawImage(img, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        URL.revokeObjectURL(url);
        edited = true;
        commitDrawing();
        upload.value = "";
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Could not read that picture. Try another image.");
        upload.value = "";
      };
      img.src = url;
    });
    uploadLabel.appendChild(upload);
    controls.appendChild(uploadLabel);
    wrapper.appendChild(controls);

    const textLabel = document.createElement("label");
    textLabel.textContent = "Optional explanation / calculations";
    const textarea = document.createElement("textarea");
    textarea.name = "question-" + actualIndex;
    textarea.className = "text-area-input";
    textarea.placeholder = "For example: node 1 to node 2 = A(7); earliest/latest times ...";
    textarea.rows = 5;
    textarea.value = answer.text || "";
    textarea.disabled = testSubmitted;
    textarea.addEventListener("input", () => {
      answer.text = textarea.value;
      saveChange();
    });
    textLabel.appendChild(textarea);
    wrapper.appendChild(textLabel);
    return wrapper;
  }

  function renderQuestions() {
    stopStudyVoice();
    if (!questionsContainer) {
      return;
    }

    questionsContainer.innerHTML = "";
    if (filterEmptyStateElement) {
      filterEmptyStateElement.classList.add("hidden");
    }
    updateReviewFilterVisibility();

    const filteredIndexes = getFilteredQuestionIndexes();
    const totalFiltered = filteredIndexes.length;

    if (totalFiltered === 0) {
      if (filterEmptyStateElement) {
        filterEmptyStateElement.classList.remove("hidden");
      } else {
        questionsContainer.innerHTML =
          '<p class="empty-state">No questions match your current filter.</p>';
      }
      return;
    }

    const totalPages = Math.max(
      1,
      Math.ceil(totalFiltered / questionsPerPage)
    );
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    const startIndex = (currentPage - 1) * questionsPerPage;
    const indexesToDisplay = showAllQuestions
      ? filteredIndexes
      : filteredIndexes.slice(startIndex, startIndex + questionsPerPage);

    indexesToDisplay.forEach((actualIndex) => {
      const question = questions[actualIndex];
      const questionElement = document.createElement("div");
      questionElement.classList.add("question");
      questionElement.setAttribute("data-question-index", actualIndex);

      // Bookmark Button
      const bookmarkButton = document.createElement("button");
      bookmarkButton.classList.add("bookmark-button");
      bookmarkButton.textContent = bookmarkedQuestions.has(actualIndex)
        ? "Bookmarked"
        : "Bookmark";
      if (bookmarkedQuestions.has(actualIndex)) {
        bookmarkButton.classList.add("active");
      }
      bookmarkButton.addEventListener("click", () => {
        if (bookmarkedQuestions.has(actualIndex)) {
          bookmarkedQuestions.delete(actualIndex);
          bookmarkButton.classList.remove("active");
          bookmarkButton.textContent = "Bookmark";
        } else {
          bookmarkedQuestions.add(actualIndex);
          bookmarkButton.classList.add("active");
          bookmarkButton.textContent = "Bookmarked";
        }
        updateBookmarkPanel();
        checkBookmarkAchievements();
        saveProgress();
      });
      questionElement.appendChild(bookmarkButton);

      // Question Text
      const questionTextElement = document.createElement("div");
      questionTextElement.classList.add("question-text");

      const questionNumberElement = document.createElement("span");
      questionNumberElement.classList.add("question-number");
      const displayMarks = getQuestionMarks(question);
      questionNumberElement.textContent = question.number
        ? question.number + ". (" + displayMarks + (displayMarks === 1 ? " mark) " : " marks) ")
        : (actualIndex + 1) + ".";
      questionTextElement.appendChild(questionNumberElement);

      const questionBodyElement = document.createElement("div");
      questionBodyElement.classList.add("question-body", "rich-content");
      const questionBodyMarkup =
        formatRichText(question.text) || escapeHTML(question.text);
      questionBodyElement.innerHTML = questionBodyMarkup;
      questionTextElement.appendChild(questionBodyElement);

      questionElement.appendChild(questionTextElement);

      if (question.sourceTestName) {
        const questionMetaElement = document.createElement("div");
        questionMetaElement.classList.add("question-meta");
        const sourceBadge = document.createElement("span");
        sourceBadge.classList.add("question-source-badge");
        sourceBadge.textContent = question.sourceTestName;
        questionMetaElement.appendChild(sourceBadge);
        questionElement.appendChild(questionMetaElement);
      }

      appendStructuredQuestionContent(questionElement, question);

      // Determine if the question has multiple correct answers
      const isMultipleCorrect = Array.isArray(question.correctAnswer);

      if (question.options && question.options.length > 0) {
        const optionsList = document.createElement("ul");
        optionsList.classList.add("options");

        const canonicalCorrectAnswers = Array.isArray(question.correctAnswer)
          ? question.correctAnswer
              .map((value) => canonicalizeAnswerValue(value))
              .filter((value) => value !== "")
          : [
              canonicalizeAnswerValue(question.correctAnswer),
            ].filter((value) => value !== "");

        question.options.forEach((option, optionIndex) => {
          const optionElement = document.createElement("li");
          optionElement.classList.add("option-item");

          const optionValue =
            option === null || option === undefined
              ? ""
              : typeof option === "string"
                ? option
                : String(option);
          const optionId = `question-${actualIndex}-option-${optionIndex}`;

          // Use checkbox for multiple correct answers, radio button otherwise
          const inputType = isMultipleCorrect ? "checkbox" : "radio";

          const labelElement = document.createElement("label");
          labelElement.setAttribute("for", optionId);

          const input = document.createElement("input");
          input.type = inputType;
          input.id = optionId;
          input.name = isMultipleCorrect
            ? `question-${actualIndex}-option-${optionIndex}`
            : `question-${actualIndex}`;

          const optionContent = document.createElement("div");
          optionContent.classList.add("option-content");
          const optionMarkupData = createOptionMarkup(optionValue);
          optionContent.innerHTML = optionMarkupData.markup;
          input.value = optionMarkupData.canonicalValue;
          if (optionMarkupData.hasCodeBlock) {
            optionElement.classList.add("option-has-code");
          }

          labelElement.appendChild(input);
          labelElement.appendChild(optionContent);
          optionElement.appendChild(labelElement);

          if (
            isStudyMode &&
            canonicalCorrectAnswers.length > 0 &&
            canonicalCorrectAnswers.some((correctValue) =>
              answerValuesEqual(correctValue, input.value)
            )
          ) {
            optionElement.classList.add("option-correct");
          }

          input.addEventListener("change", (event) => {
            if (isMultipleCorrect) {
              // Handle multiple selections
              if (!Array.isArray(userAnswers[actualIndex])) {
                userAnswers[actualIndex] = [];
              }
              if (event.target.checked) {
                userAnswers[actualIndex].push(event.target.value);
                optionElement.classList.add("selected");
              } else {
                userAnswers[actualIndex] = userAnswers[actualIndex].filter(
                  (value) => value !== event.target.value
                );
                optionElement.classList.remove("selected");
              }
            } else {
              // Handle single selection
              userAnswers[actualIndex] = event.target.value;
              const optionItems = optionsList.querySelectorAll("li");
              optionItems.forEach((item) => item.classList.remove("selected"));
              optionElement.classList.add("selected");
            }

            updateProgress();
            if (!isStudyMode && !timerStarted) {
              startTimer();
              if (startTestButton) {
                startTestButton.disabled = true;
              }
              if (submitButton) {
                submitButton.disabled = false;
              }
              testInProgress = true;
            }
            saveProgress();
          });

          // Restore user selections
          const storedAnswer = userAnswers[actualIndex];
          if (Array.isArray(storedAnswer)) {
            if (
              storedAnswer.some((value) =>
                answerValuesEqual(value, input.value)
              )
            ) {
              input.checked = true;
              optionElement.classList.add("selected");
            }
          } else if (typeof storedAnswer === "string") {
            if (answerValuesEqual(storedAnswer, input.value)) {
              input.checked = true;
              optionElement.classList.add("selected");
            }
          }

          if (testSubmitted) {
            input.disabled = true;
          }

          optionsList.appendChild(optionElement);
        });
        questionElement.appendChild(optionsList);
      } else if (question.answerType === "diagram") {
        questionElement.appendChild(createDiagramAnswerInput(actualIndex));
        const note = document.createElement("div");
        note.className = "ai-answer-note";
        note.textContent = "AI will inspect the submitted drawing and your optional calculations.";
        questionElement.appendChild(note);
      } else if (window.AnswerWorkspace &&
          ["uml-diagram", "table", "command", "code"].includes(question.answerType)) {
        const onChange = value => {
          userAnswers[actualIndex] = value;
          updateProgress();
          if (!isStudyMode && !timerStarted && !testSubmitted) {
            startTimer();
            if (startTestButton) startTestButton.disabled = true;
            if (submitButton) submitButton.disabled = false;
            testInProgress = true;
          }
          saveProgress();
        };
        const method = question.answerType === "uml-diagram"
          ? "createDiagram" : question.answerType === "table"
            ? "createTable" : "createEditor";
        questionElement.appendChild(window.AnswerWorkspace[method](
          question, userAnswers[actualIndex], onChange, testSubmitted
        ));
      } else {
        // Handle questions without options (e.g., short answer questions)
        const textareaElement = document.createElement("textarea");
        textareaElement.name = `question-${actualIndex}`;
        textareaElement.classList.add("text-area-input");
        textareaElement.placeholder = "Enter your answer here...";
        textareaElement.rows = 5; // Adjust the number of rows as needed

        textareaElement.addEventListener("input", (event) => {
          userAnswers[actualIndex] = event.target.value;
          updateProgress();
          if (!isStudyMode && !timerStarted) {
            startTimer();
            if (startTestButton) {
              startTestButton.disabled = true;
            }
            if (submitButton) {
              submitButton.disabled = false;
            }
            testInProgress = true;
          }
          saveProgress();
        });

        if (userAnswers[actualIndex]) {
          textareaElement.value = userAnswers[actualIndex];
        }

        if (testSubmitted) {
          textareaElement.disabled = true;
        }

        questionElement.appendChild(textareaElement);

        if (isAiGradedQuestion(question)) {
          const aiNote = document.createElement("div");
          aiNote.classList.add("ai-answer-note");
          aiNote.textContent =
            "AI-marked written answer: explain it in your own words. Meaning and accuracy matter more than matching the reference wording.";
          questionElement.appendChild(aiNote);
        }
      }

      // Apply feedback if submitted. Study Mode also exposes the saved learning guide.
      if (testSubmitted) {
        applyFeedback(questionElement, question, actualIndex);
      } else if (isStudyMode) {
        questionElement.appendChild(createReadablePanel(
          isAiGradedQuestion(question) ? "Reference answer" : "Correct answer",
          formatAnswerForDisplay(question.correctAnswer), "study-correct-answer"
        ));
      }

      if (isStudyMode) {
        let voiceHost = null;
        // Keep the reader in the existing heading instead of adding another card.
        if (question.study) {
          const guide = createStudyGuideElement(question.study);
          if (guide) {
            questionElement.appendChild(guide);
            voiceHost = guide;
          }
        } else if (!testSubmitted && question.explanation) {
          const explanation = createReadablePanel(
            "Why this answer?", question.explanation, "study-explanation"
          );
          questionElement.appendChild(explanation);
          voiceHost = explanation;
        } else if (testSubmitted && question.explanation) {
          voiceHost = questionElement.querySelector(".explanation");
        }
        if (!voiceHost) {
          voiceHost = questionElement.querySelector(
            ".study-correct-answer, .correct-answer"
          );
        }
        if (voiceHost) {
          addStudyVoiceToHeading(questionElement, voiceHost,
            question.number || actualIndex + 1);
        }
      }

      const aiTutorBlock = createAiTutorBlock(question, actualIndex);
      if (aiTutorBlock) {
        questionElement.appendChild(aiTutorBlock);
      }

      questionsContainer.appendChild(questionElement);
    });
    updateProgress();
    updateBookmarkPanel();
  }

  // Flashcards show one question at a time. Switching tabs preserves the revision position.
  function resetFlashcardDeck() {
    flashcardDeckSource = questions;
    flashcardOrder = questions.map((_, index) => index);
    flashcardPosition = 0;
    flashcardRevealed = false;
    flashcardRatings = new Map();
  }

  function nextFlashcard() {
    if (flashcardPosition >= flashcardOrder.length) return;
    flashcardPosition += 1;
    flashcardRevealed = false;
    renderFlashcards();
  }

  function previousFlashcard() {
    if (flashcardPosition <= 0) return;
    flashcardPosition -= 1;
    flashcardRevealed = false;
    renderFlashcards();
  }

  function rateFlashcard(rating) {
    if (!flashcardRevealed || flashcardPosition >= flashcardOrder.length) return;
    if (rating !== "known" && rating !== "again") return;
    flashcardRatings.set(flashcardOrder[flashcardPosition], rating);
    nextFlashcard();
  }

  function updateFlashcardControls() {
    if (flashcardRevealButton) {
      flashcardRevealButton.textContent = flashcardRevealed ? "Flip to question ↻" : "Flip to answer ↻";
      flashcardRevealButton.setAttribute("aria-pressed", String(flashcardRevealed));
      flashcardRevealButton.setAttribute("aria-controls", "flashcards-grid");
    }
    if (flashcardAgainButton) flashcardAgainButton.classList.toggle("hidden", !flashcardRevealed);
    if (flashcardKnownButton) flashcardKnownButton.classList.toggle("hidden", !flashcardRevealed);
  }

  function sizeFlashcard(card) {
    if (!card || !card.isConnected) return;
    const visibleFace = card.querySelector(flashcardRevealed ? ".flashcard-back" : ".flashcard-front");
    if (visibleFace) card.style.height = Math.max(250, Math.ceil(visibleFace.scrollHeight) + 2) + "px";
  }

  function syncFlashcardFace(card) {
    if (!card) return;
    const front = card.querySelector(".flashcard-front");
    const back = card.querySelector(".flashcard-back");
    if (!front || !back) return;
    front.inert = flashcardRevealed;
    back.inert = !flashcardRevealed;
    front.setAttribute("aria-hidden", String(flashcardRevealed));
    back.setAttribute("aria-hidden", String(!flashcardRevealed));
    card.classList.toggle("is-flipped", flashcardRevealed);
    card.setAttribute("aria-label", "Flashcard " + (flashcardPosition + 1) +
      (flashcardRevealed ? ". Answer side. Tap or press Enter to show question." :
                           ". Question side. Tap or press Enter to show answer."));
    sizeFlashcard(card);
    updateFlashcardControls();
  }

  function flipCurrentFlashcard() {
    if (flashcardPosition >= flashcardOrder.length || currentMode !== "flashcards") return;
    const card = flashcardsGrid && flashcardsGrid.querySelector(".flashcard-surface");
    if (!card) return;
    flashcardRevealed = !flashcardRevealed;
    syncFlashcardFace(card); // Change the same card: do not re-render or expand it.
  }

  function renderFlashcards() {
    if (!flashcardsGrid || !flashcardsEmptyState) return;
    if (flashcardDeckSource !== questions ||
        (questions.length && flashcardOrder.length === 0)) {
      resetFlashcardDeck();
    }
    if (flashcardResizeObserver) {
      flashcardResizeObserver.disconnect();
      flashcardResizeObserver = null;
    }
    flashcardsGrid.replaceChildren();
    const total = flashcardOrder.length;
    const hasCards = total > 0;
    flashcardsGrid.classList.toggle("hidden", !hasCards);
    flashcardsEmptyState.classList.toggle("hidden", hasCards);
    if (flashcardStatus) flashcardStatus.classList.toggle("hidden", !hasCards);
    if (flashcardRestartButton) flashcardRestartButton.classList.toggle("hidden", !hasCards);
    const complete = flashcardPosition >= total;
    if (flashcardControls) flashcardControls.classList.toggle("hidden", !hasCards || complete);
    if (!hasCards) return;

    const known = flashcardOrder.filter(index => flashcardRatings.get(index) === "known").length;
    const again = flashcardOrder.filter(index => flashcardRatings.get(index) === "again").length;
    if (flashcardCount) flashcardCount.textContent =
      complete ? "Round complete" : "Card " + (flashcardPosition + 1) + " of " + total;
    if (flashcardTally) flashcardTally.textContent =
      "Known " + known + " · Study again " + again;
    const progress = complete ? total : flashcardPosition + 1;
    if (flashcardProgressFill) flashcardProgressFill.style.width =
      (progress / total * 100) + "%";
    if (flashcardProgressTrack) {
      flashcardProgressTrack.setAttribute("aria-valuenow", String(progress));
      flashcardProgressTrack.setAttribute("aria-valuemax", String(total));
    }

    if (complete) {
      // Skipped cards are included in the next round; none are silently lost.
      const repeatIndexes = flashcardOrder.filter(index => flashcardRatings.get(index) !== "known");
      const summary = document.createElement("section");
      summary.className = "flashcard-complete";
      const heading = document.createElement("h3");
      heading.textContent = "Revision round complete";
      const message = document.createElement("p");
      message.textContent = "Known: " + known + " of " + total + ". " +
        (repeatIndexes.length
          ? repeatIndexes.length + " card(s) can use another look."
          : "You marked every card as known.");
      summary.append(heading, message);
      if (repeatIndexes.length) {
        const repeat = document.createElement("button");
        repeat.type = "button";
        repeat.className = "btn btn-primary";
        repeat.textContent = "Review " + repeatIndexes.length +
          (repeatIndexes.length === 1 ? " card" : " cards");
        repeat.addEventListener("click", () => {
          flashcardOrder = repeatIndexes;
          repeatIndexes.forEach(index => flashcardRatings.delete(index));
          flashcardPosition = 0;
          flashcardRevealed = false;
          renderFlashcards();
        });
        summary.appendChild(repeat);
      }
      flashcardsGrid.appendChild(summary);
      return;
    }

    const questionIndex = flashcardOrder[flashcardPosition];
    const question = questions[questionIndex];
    const card = document.createElement("article");
    card.className = "flashcard-surface";
    card.tabIndex = 0;

    const inner = document.createElement("div");
    inner.className = "flashcard-inner";
    const front = document.createElement("section");
    front.className = "flashcard-face flashcard-front";
    const eyebrow = document.createElement("div");
    eyebrow.className = "flashcard-eyebrow";
    const number = document.createElement("span");
    number.textContent = "QUESTION " + (question.number || (questionIndex + 1));
    eyebrow.appendChild(number);
    if (question.sourceTestName) {
      const source = document.createElement("span");
      source.className = "flashcard-source";
      source.textContent = question.sourceTestName;
      eyebrow.appendChild(source);
    }
    front.appendChild(eyebrow);
    const prompt = document.createElement("div");
    prompt.className = "flashcard-prompt rich-content";
    prompt.innerHTML = formatRichText(question.text || "") || escapeHTML(question.text || "");
    front.appendChild(prompt);
    // Required case study, table and diagram stay on the question side.
    appendStructuredQuestionContent(front, question);
    if (Array.isArray(question.options) && question.options.length) {
      const choices = document.createElement("ol");
      choices.className = "flashcard-choices";
      choices.type = "A";
      question.options.forEach(option => {
        const item = document.createElement("li");
        item.innerHTML = createOptionMarkup(option).markup;
        choices.appendChild(item);
      });
      front.appendChild(choices);
    }
    const cue = document.createElement("p");
    cue.className = "flashcard-reveal-hint";
    cue.textContent = "Think of your answer, then tap this card to flip it.";
    front.appendChild(cue);

    const back = document.createElement("section");
    back.className = "flashcard-face flashcard-back";
    const backEyebrow = document.createElement("div");
    backEyebrow.className = "flashcard-eyebrow";
    backEyebrow.textContent = "ANSWER · QUESTION " + (question.number || (questionIndex + 1));
    back.appendChild(backEyebrow);

    const answerPanel = createReadablePanel(
      isAiGradedQuestion(question) ? "Reference answer" : "Correct answer",
      formatAnswerForDisplay(question.correctAnswer), "flashcard-answer-panel"
    );
    answerPanel.id = "flashcard-answer-panel";
    if (question.correctAnswer && typeof question.correctAnswer === "object" &&
        question.correctAnswer.image) {
      const image = createQuestionImage(question.correctAnswer.image);
      if (image) answerPanel.appendChild(image);
    }
    if (question.explanation && !question.study) {
      const explanation = createReadablePanel("Why this answer?", question.explanation,
        "flashcard-explanation");
      answerPanel.appendChild(explanation);
    }
    // A flashcard's back is its study side. Notes are immediately visible, not an accordion.
    const guide = createStudyGuideElement(question.study);
    if (guide) answerPanel.appendChild(guide);
    if (isAiGradedQuestion(question)) {
      const reminder = document.createElement("p");
      reminder.className = "flashcard-study-tip";
      reminder.textContent = "This is a guide answer. Different correct wording may also earn marks.";
      answerPanel.appendChild(reminder);
    }
    back.appendChild(answerPanel);
    const backHint = document.createElement("p");
    backHint.className = "flashcard-reveal-hint";
    backHint.textContent = "Tap the card to return to the question.";
    back.appendChild(backHint);

    inner.append(front, back);
    card.appendChild(inner);
    card.addEventListener("click", event => {
      // Do not steal taps from diagrams, case-study details or other controls.
      if (event.target.closest("button, a, input, textarea, select, summary, details")) return;
      flipCurrentFlashcard();
    });
    card.addEventListener("keydown", event => {
      if (event.target !== card || (event.code !== "Space" && event.key !== "Enter")) return;
      event.preventDefault();
      event.stopPropagation();
      flipCurrentFlashcard();
    });
    flashcardsGrid.appendChild(card);
    syncFlashcardFace(card);
    if (typeof ResizeObserver !== "undefined") {
      flashcardResizeObserver = new ResizeObserver(() => {
        if (flashcardsGrid.contains(card)) sizeFlashcard(card);
      });
      flashcardResizeObserver.observe(front);
      flashcardResizeObserver.observe(back);
    }

    if (flashcardPrevButton) flashcardPrevButton.disabled = flashcardPosition === 0;
    if (flashcardNextButton) flashcardNextButton.textContent =
      flashcardPosition === total - 1 ? "Finish →" : "Next →";
    updateFlashcardControls();
  }

  if (flashcardPrevButton) flashcardPrevButton.addEventListener("click", previousFlashcard);
  if (flashcardNextButton) flashcardNextButton.addEventListener("click", nextFlashcard);
  if (flashcardRevealButton) flashcardRevealButton.addEventListener("click", flipCurrentFlashcard);
  if (flashcardAgainButton) flashcardAgainButton.addEventListener("click", () => rateFlashcard("again"));
  if (flashcardKnownButton) flashcardKnownButton.addEventListener("click", () => rateFlashcard("known"));
  if (flashcardRestartButton) flashcardRestartButton.addEventListener("click", () => {
    if (!questions.length) return;
    resetFlashcardDeck();
    renderFlashcards();
  });

  document.addEventListener("keydown", event => {
    if (currentMode !== "flashcards" || isOptionsModalOpen() ||
        isDefineTestModalOpen() || event.altKey || event.ctrlKey || event.metaKey) return;
    const focused = document.activeElement;
    if (focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A)$/.test(focused.tagName))) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextFlashcard();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previousFlashcard();
    } else if (event.code === "Space" && flashcardPosition < flashcardOrder.length) {
      event.preventDefault();
      flipCurrentFlashcard();
    }
  });

  //************************ SECTION 7: PAGINATION CONTROLS ************************//

  function highlightQuestion(questionIndex) {
    const questionElement = document.querySelector(
      `[data-question-index="${questionIndex}"]`
    );
    if (!questionElement) return;
    questionElement.classList.add("highlighted");
    questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      questionElement.classList.remove("highlighted");
    }, 1500);
  }

  function jumpToQuestion(questionIndex) {
    let targetIndexes = getFilteredQuestionIndexes();
    let position = targetIndexes.indexOf(questionIndex);

    if (position === -1) {
      reviewFilter = "all";
      if (reviewFilterSelect) {
        reviewFilterSelect.value = "all";
      }
      updateReviewFilterVisibility();
      targetIndexes = getFilteredQuestionIndexes();
      position = targetIndexes.indexOf(questionIndex);
    }

    if (position === -1) {
      return;
    }

    currentPage = Math.floor(position / questionsPerPage) + 1;
    renderQuestions();
    updatePaginationControls();
    requestAnimationFrame(() => highlightQuestion(questionIndex));
  }

  function updateBookmarkPanel() {
    if (!bookmarkListElement) return;

    bookmarkListElement.innerHTML = "";
    const bookmarks = Array.from(bookmarkedQuestions).sort((a, b) => a - b);
    if (bookmarkCycleIndex >= bookmarks.length) {
      bookmarkCycleIndex = 0;
    }

    if (bookmarks.length === 0) {
      bookmarkListElement.classList.add("empty");
      bookmarkListElement.textContent = "No bookmarked questions yet.";
      bookmarkCycleIndex = 0;
      return;
    }

    bookmarkListElement.classList.remove("empty");
    bookmarks.forEach((bookmark) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bookmark-pill";
      button.textContent = `Q${bookmark + 1}`;
      button.addEventListener("click", () => {
        closeOptionsModal();
        // Bookmarks always open the question view, even when called from Flashcards.
        if (currentMode === "flashcards") {
          setMode(isStudyMode ? "study" : "test");
        }
        jumpToQuestion(bookmark);
      });
      bookmarkListElement.appendChild(button);
    });

    checkBookmarkAchievements();
  }

  function scrollToQuestionsTop() {
    if (!questionsContainer) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const headerHeight = headerElement ? headerElement.offsetHeight : 0;
    const containerTop =
      questionsContainer.getBoundingClientRect().top + window.scrollY;
    const targetTop = Math.max(containerTop - headerHeight - 16, 0);

    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }

  function checkBookmarkAchievements() {
    if (bookmarkedQuestions.size >= 5) {
      unlockAchievement("bookmark-hero");
    }
  }

  if (cycleBookmarksButton) {
    cycleBookmarksButton.addEventListener("click", () => {
      const bookmarks = Array.from(bookmarkedQuestions).sort((a, b) => a - b);
      if (bookmarks.length === 0) {
        alert("No bookmarked questions yet! Bookmark a question to start a review loop.");
        return;
      }
      const target = bookmarks[bookmarkCycleIndex % bookmarks.length];
      bookmarkCycleIndex = (bookmarkCycleIndex + 1) % bookmarks.length;
      jumpToQuestion(target);
    });
  }

  function updatePaginationControls() {
    if (
      !paginationControls ||
      !pageInfo ||
      !prevPageButton ||
      !nextPageButton
    ) {
      return;
    }
    const filteredIndexes = getFilteredQuestionIndexes();
    const totalFiltered = filteredIndexes.length;
    if (totalFiltered === 0) {
      paginationControls.classList.add("hidden");
      pageInfo.textContent = "";
      if (viewToggleButton) {
        viewToggleButton.classList.add("hidden");
        viewToggleButton.setAttribute("aria-pressed", "false");
      }
      return;
    }

    paginationControls.classList.remove("hidden");
    if (viewToggleButton) {
      viewToggleButton.classList.remove("hidden");
      const viewAllLabel =
        totalFiltered === 1
          ? "View All (1)"
          : `View All (${totalFiltered})`;
      viewToggleButton.textContent = showAllQuestions
        ? "Show Pages"
        : viewAllLabel;
      viewToggleButton.setAttribute(
        "aria-pressed",
        showAllQuestions.toString()
      );
    }
    const totalPages = Math.max(
      1,
      Math.ceil(totalFiltered / questionsPerPage)
    );
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (showAllQuestions) {
      pageInfo.textContent =
        totalFiltered === 1
          ? "Showing all 1 question"
          : `Showing all ${totalFiltered} questions`;
      prevPageButton.disabled = true;
      nextPageButton.disabled = true;
      prevPageButton.classList.add("hidden");
      nextPageButton.classList.add("hidden");
    } else {
      prevPageButton.classList.remove("hidden");
      nextPageButton.classList.remove("hidden");
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      prevPageButton.disabled = currentPage === 1;
      nextPageButton.disabled = currentPage === totalPages;
    }
  }

  if (prevPageButton) {
    prevPageButton.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderQuestions();
        updatePaginationControls();
        scrollToQuestionsTop();
      }
    });
  }

  if (nextPageButton) {
    nextPageButton.addEventListener("click", () => {
      const totalFiltered = getFilteredQuestionIndexes().length;
      const totalPages = Math.max(
        1,
        Math.ceil(totalFiltered / questionsPerPage)
      );
      if (currentPage < totalPages) {
        currentPage++;
        renderQuestions();
        updatePaginationControls();
        scrollToQuestionsTop();
      }
    });
  }

  if (viewToggleButton) {
    viewToggleButton.addEventListener("click", () => {
      const totalFiltered = getFilteredQuestionIndexes().length;
      if (totalFiltered === 0) {
        return;
      }

      showAllQuestions = !showAllQuestions;

      if (!showAllQuestions) {
        const totalPages = Math.max(
          1,
          Math.ceil(totalFiltered / questionsPerPage)
        );
        if (currentPage > totalPages) {
          currentPage = totalPages;
        }
      }

      renderQuestions();
      updatePaginationControls();
      scrollToQuestionsTop();
      saveProgress();
    });
  }

  if (reviewFilterSelect) {
    reviewFilterSelect.addEventListener("change", (event) => {
      reviewFilter = event.target.value;
      currentPage = 1;
      renderQuestions();
      updatePaginationControls();
    });
  }

  if (reviewSourceFilterSelect) {
    reviewSourceFilterSelect.addEventListener("change", (event) => {
      activeSourceFilter = event.target.value;
      currentPage = 1;
      renderQuestions();
      updatePaginationControls();
      updateBookmarkPanel();
    });
  }

  if (resultReviewFailedButton) {
    resultReviewFailedButton.addEventListener("click", () => {
      if (!testSubmitted) {
        return;
      }
      setReviewMode("incorrect");
    });
  }

  if (resultReviewAllButton) {
    resultReviewAllButton.addEventListener("click", () => {
      if (!testSubmitted) {
        return;
      }
      setReviewMode("all");
    });
  }

  if (resultRestartButton) {
    resultRestartButton.addEventListener("click", () => {
      resetTest();
    });
  }

  //************************ SECTION 8: TIMER FUNCTIONALITY ************************//

  function startTimer(resume = false) {
    if (timerStarted) return;
    timerStarted = true;
    isTimerPaused = false;

    if (!resume || typeof remainingTime !== "number" || Number.isNaN(remainingTime)) {
      remainingTime = getTimerInputSeconds();
    }

    if (!resume || initialTimerSeconds === null) {
      initialTimerSeconds = getTimerInputSeconds();
    }

    updateTimerDisplay(
      Math.floor(Math.max(remainingTime, 0) / 60),
      Math.max(remainingTime, 0) % 60
    );

    timer = setInterval(() => {
      if (isTimerPaused) {
        return;
      }
      remainingTime = Math.max(0, remainingTime - 1);
      const minutes = Math.floor(remainingTime / 60);
      const seconds = remainingTime % 60;
      updateTimerDisplay(minutes, seconds);
      if (remainingTime <= 0) {
        clearInterval(timer);
        timerStarted = false;
        submitTest();
        return;
      }
      saveProgress();
    }, 1000);
  }

  function updateTimerDisplay(minutes, seconds) {
    const timeString = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    if (floatingTimeDisplay) {
      floatingTimeDisplay.textContent = timeString;
    }
    if (mobileTimeDisplay) {
      mobileTimeDisplay.textContent = timeString;
    }
  }

  function pauseOrContinueTimer() {
    if (!timerStarted) return;
    if (isTimerPaused) {
      isTimerPaused = false;
      pauseTimerButton.textContent = "Pause Timer";
    } else {
      isTimerPaused = true;
      pauseTimerButton.textContent = "Continue Timer";
    }
    saveProgress();
  }

  if (pauseTimerButton) {
    pauseTimerButton.addEventListener("click", pauseOrContinueTimer);
  }

  if (startTestButton) {
    startTestButton.addEventListener("click", () => {
      startTimer();
      startTestButton.disabled = true;
      if (submitButton) {
        submitButton.disabled = false;
      }
      testInProgress = true;
      saveProgress();
      closeTestControlsModal();
    });
  }

  //************************ SECTION 9: TEST SUBMISSION ************************//

  async function submitTest() {
    console.log("submitTest function called");
    try {
      let unansweredQuestions = [];
      const timeLeftAtSubmission =
        typeof remainingTime === "number" ? Math.max(remainingTime, 0) : 0;

      questions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        console.log(`Question ${index + 1}, User Answer:`, userAnswer);

        if (
          !hasProvidedAnswer(userAnswer)
        ) {
          unansweredQuestions.push(index + 1);
        }
      });

      if (unansweredQuestions.length > 0) {
        const proceed = confirm(
          `You have unanswered questions: ${unansweredQuestions.join(
            ", "
          )}.\nDo you want to proceed with submission?`
        );
        if (!proceed) {
          console.log("User chose to cancel submission.");
          return;
        }
      }

      console.log("Proceeding with test grading...");

      try {
        await gradeAiQuestions();
      } catch (aiError) {
        console.error("AI marking failed:", aiError);
        if (submitButton) {
          submitButton.disabled = false;
        }
        alert(
          aiError && aiError.message
            ? aiError.message
            : "AI marking could not be completed. Please try again."
        );
        return;
      }

      clearInterval(timer);
      isTimerPaused = false;
      timerStarted = false;
      testInProgress = false;
      testSubmitted = true;
      submitButton.disabled = true;
      startTestButton.disabled = false;
      pauseTimerButton.textContent = "Pause Timer";
      let score = 0;
      reviewFilter = "all";
      if (reviewFilterSelect) {
        reviewFilterSelect.value = "all";
      }
      questionResults = Array.from(
        { length: questions.length },
        () => "unanswered"
      );

      submitButton.style.display = "none";

      const passMark = parseInt(passMarkInput.value);

      // Calculate the score without relying on DOM elements
      questions.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const grade = getQuestionGrade(question, index, userAnswer);

        score += grade.scoreValue;
        questionResults[index] = grade.isCorrect
          ? "correct"
          : grade.hasAnswer
            ? "incorrect"
            : "unanswered";
      });

      // Update the score display
      const totalMarks = questions.reduce(
        (total, question) => total + getQuestionMarks(question), 0
      );
      const scorePercent =
        totalMarks === 0 ? 0 : Math.round((score / totalMarks) * 100);
      scoreElement.textContent = `${scorePercent}%`;
      scoreContainer.style.display = "block";
      scoreContainer.classList.remove("hidden");

      // Display pass or fail message
      resultMessageElement.textContent = "";
      resultMessageElement.classList.remove("pass-message", "fail-message");

      const testName = testSelect.options[testSelect.selectedIndex].textContent;

      testStats.testsTaken++;

      const scoreForDisplay = Number.isInteger(score)
        ? score
        : Number(score.toFixed(1));
      const scoreBreakdown = `${scoreForDisplay}/${totalMarks} marks`;
      const didPass = scorePercent >= passMark;

      if (didPass) {
        resultMessageElement.textContent = `You Passed! (${scoreBreakdown})`;
        resultMessageElement.classList.add("pass-message");
        testStats.testsPassed++;
        testStats.passedTests.push(testName);
      } else {
        resultMessageElement.textContent = `You Failed. (${scoreBreakdown})`;
        resultMessageElement.classList.add("fail-message");
        testStats.testsFailed++;
        testStats.failedTests.push(testName);
      }

      const missedCount = questionResults.filter(
        (status) => status !== "correct"
      ).length;

      showResultBanner({
        status: didPass ? "pass" : "fail",
        scorePercent,
        scoreBreakdown,
        missedCount,
      });

      // Private, offline topic analysis runs for everyone. Only an explicit
      // Settings opt-in AND a later button click may invoke the AI generator.
      if (revisionController) {
        const code = testName.match(/\b(?:ICT|INF)\d{4}\b/i);
        revisionController.showResults({
          questions,
          getGrade: (question, index) =>
            getQuestionGrade(question, index, userAnswers[index]),
          moduleName: code ? code[0].toUpperCase() : "Mixed modules",
        });
      }

      incrementStreakIfNeeded();

      // Save stats and update display
      saveStats();
      updateStatsDisplay();

      evaluateAchievements(score, timeLeftAtSubmission);

      console.log("Test grading completed. Score:", score);

      // Clear saved progress
      clearSavedProgress();

      // Re-render current page to show feedback
      renderQuestions();
      updatePaginationControls();
      updateBookmarkPanel();
    } catch (error) {
      console.error("Error in submitTest:", error);
      alert(
        "An error occurred during submission. Please check the console for details."
      );
    }
  }

  if (submitButton) {
    submitButton.addEventListener("click", submitTest);
  }

  //************************ SECTION 10: APPLY FEEDBACK ************************//

  function applyFeedback(questionElement, question, index) {
    const userAnswer = userAnswers[index];
    const grade = getQuestionGrade(question, index, userAnswer);
    const hasAnswer = grade.hasAnswer;
    const isCorrect = grade.isCorrect;

    // Apply feedback to the question element
    let feedbackElement = document.createElement("p");
    feedbackElement.classList.add("feedback");

    if (grade.aiGrade) {
      const earned = Number(grade.scoreValue.toFixed(2));
      feedbackElement.textContent = "AI mark: " + earned + "/" +
        getQuestionMarks(question) + " marks (" +
        Math.round(grade.aiGrade.score) + "%).";
      feedbackElement.classList.add(isCorrect ? "correct" : "ai-partial-feedback");
      questionElement.classList.add(isCorrect ? "correct" : "incorrect");
    } else if (grade.tableGrade) {
      const earned = Number(grade.scoreValue.toFixed(2));
      feedbackElement.textContent = "Table: " + earned + "/" + getQuestionMarks(question) +
        " marks (" + grade.tableGrade.details + ").";
      feedbackElement.classList.add(isCorrect ? "correct" : "ai-partial-feedback");
      questionElement.classList.add(isCorrect ? "correct" : "incorrect");
    } else if (isCorrect) {
      questionElement.classList.add("correct");
      feedbackElement.textContent = "Correct!";
      feedbackElement.classList.add("correct");
    } else {
      questionElement.classList.add("incorrect");
      feedbackElement.textContent = "Incorrect.";
      feedbackElement.classList.add("incorrect");
    }

    questionElement.appendChild(feedbackElement);

    // Display correct answer and explanation for all questions
    questionElement.appendChild(createReadablePanel(
      isAiGradedQuestion(question) ? "Reference answer" : "Correct answer",
      formatAnswerForDisplay(question.correctAnswer), "correct-answer"
    ));

    if (grade.aiGrade) {
      const aiFeedbackElement = createAiFeedbackElement(grade.aiGrade);
      if (aiFeedbackElement) {
        questionElement.appendChild(aiFeedbackElement);
      }
    }

    // Study Mode already displays the fuller guide; do not repeat the same explanation.
    if (question.explanation && !(isStudyMode && question.study)) {
      questionElement.appendChild(createReadablePanel(
        "Why this answer?", question.explanation, "explanation"
      ));
    }

    // Ensure user selections are preserved and highlighted correctly
    if (question.options && question.options.length > 0) {
      const inputs = questionElement.querySelectorAll("input");
      inputs.forEach((input) => {
        if (Array.isArray(userAnswer)) {
          // Handle multiple answers (checkbox)
          input.checked = userAnswer.some((answer) =>
            answerValuesEqual(answer, input.value)
          );
        } else if (typeof userAnswer === "string") {
          // Handle single answer (radio)
          input.checked = answerValuesEqual(userAnswer, input.value);
        }
        input.disabled = true; // Disable input to prevent changes after submission
        const optionItem = input.closest("li");
        if (optionItem) {
          optionItem.classList.toggle("selected", input.checked);
        }
      });
    } else {
      // Handle text-based answers
      const textInput = questionElement.querySelector(".text-area-input");
      if (textInput) {
        if (typeof userAnswer === "string") {
          textInput.value = userAnswer;
        }
        textInput.disabled = true; // Disable text input after submission
      }
    }

    // Disable bookmark button after submission
    const bookmarkButton = questionElement.querySelector(".bookmark-button");
    if (bookmarkButton) {
      bookmarkButton.disabled = true;
    }

    return isCorrect;
  }

  //************************ SECTION 11: TEST RESET ************************//

  function resetTest() {
    if (revisionController) revisionController.reset();
    const wasCustomSession = isCustomSessionActive();
    if (testInProgress || timerStarted) {
      const confirmReset = confirm(
        "Are you sure you want to reset the current test?"
      );
      if (!confirmReset) {
        return;
      } else {
        // Update stats for abandoned test
        testStats.testsAbandoned++;
        const testName =
          testSelect.options[testSelect.selectedIndex].textContent;
        testStats.abandonedTests.push(testName);
        saveStats();
        updateStatsDisplay();
      }
    }
    clearInterval(timer);
    timer = null;
    aiGrades = {};

    if (wasCustomSession) {
      regenerateCustomSessionQuestions();
      return;
    }

    remainingTime = getTimerInputSeconds();
    initialTimerSeconds = null;
    updateTimerDisplay(
      Math.floor(remainingTime / 60),
      remainingTime % 60
    );
    questionsContainer.innerHTML = "";
    hideResultBanner();
    scoreContainer.classList.add("hidden");
    scoreContainer.style.display = "none";
    submitButton.style.display = "inline-block";
    submitButton.disabled = true;
    startTestButton.disabled = false;
    timerStarted = false;
    isTimerPaused = false;
    testInProgress = false;
    testSubmitted = false;
    resetReviewState();
    pauseTimerButton.textContent = "Pause Timer";
    if (progressTextElement) {
      progressTextElement.textContent = `0%`;
    }
    if (progressBarElement) {
      progressBarElement.style.width = `0%`;
    }
    userAnswers = {};
    bookmarkedQuestions = new Set();
    bookmarkCycleIndex = 0;
    if (originalQuestions.length > 0) {
      questions = prepareQuestionsForSession(originalQuestions, currentTestPreserveOrder);
    }
    currentPage = 1;
    renderQuestions();
    updatePaginationControls();
    updateProgress();
    updateBookmarkPanel();
    renderFlashcards();
    clearSavedProgress();
  }

  if (resetButton) {
    resetButton.addEventListener("click", resetTest);
  }


  //************************ SECTION 12: PROGRESS TRACKING ************************//

  function updateProgress() {
    const totalQuestions = questions.length;
    const answeredQuestions = Object.keys(userAnswers).filter((index) => {
      const answer = userAnswers[index];
      return hasProvidedAnswer(answer);
    }).length;
    const progressPercent =
      totalQuestions === 0
        ? 0
        : Math.round((answeredQuestions / totalQuestions) * 100);
    if (progressTextElement) {
      progressTextElement.textContent = `${progressPercent}%`;
    }
    if (progressBarElement) {
      progressBarElement.style.width = `${progressPercent}%`;
    }
  }

  //************************ SECTION 13: DOWNLOAD RESULTS ************************//

  function formatAnswerForDisplay(answer) {
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      return (answer.image ? "[Diagram image attached] " : "") +
        (typeof answer.text === "string" ? answer.text : "");
    }
    if (Array.isArray(answer)) {
      return answer
        .map((value) => canonicalizeAnswerValue(value))
        .join(", ");
    }
    if (answer === null || answer === undefined) {
      return "";
    }
    return canonicalizeAnswerValue(answer);
  }

  function normalizeAnswerForComparison(answer) {
    if (Array.isArray(answer)) {
      return answer
        .map((value) => canonicalizeAnswerValue(value).toLowerCase())
        .filter((value) => value !== "")
        .sort();
    }
    if (answer === null || answer === undefined) {
      return "";
    }
    return canonicalizeAnswerValue(answer).toLowerCase();
  }

  function answersMatch(userAnswer, correctAnswer) {
    const normalizedUser = normalizeAnswerForComparison(userAnswer);
    const normalizedCorrect = normalizeAnswerForComparison(correctAnswer);

    if (Array.isArray(normalizedUser) || Array.isArray(normalizedCorrect)) {
      if (!Array.isArray(normalizedUser) || !Array.isArray(normalizedCorrect)) {
        return false;
      }
      return JSON.stringify(normalizedUser) === JSON.stringify(normalizedCorrect);
    }

    return normalizedUser === normalizedCorrect;
  }

  function downloadResultsAsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const bottomMargin = 20;
    const blockPadding = 4;
    const blockSpacing = 6;
    const blockX = margin - 2;
    const blockWidth = pageWidth - margin * 2 + 4;
    const maxLineWidth = blockWidth - blockPadding * 2;
    const bodyFontSize = 11;

    const defaultTextColor = { r: 33, g: 37, b: 41 };
    const neutralFill = { r: 244, g: 247, b: 252 };
    const correctFill = { r: 209, g: 250, b: 229 };
    const incorrectFill = { r: 255, g: 228, b: 225 };
    const explanationFill = { r: 255, g: 249, b: 196 };
    const correctTextColor = { r: 21, g: 87, b: 36 };
    const incorrectTextColor = { r: 155, g: 28, b: 28 };
    const explanationTextColor = { r: 102, g: 60, b: 0 };

    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(defaultTextColor.r, defaultTextColor.g, defaultTextColor.b);

    let earnedMarks = 0;
    const totalMarks = questions.reduce(
      (total, question) => total + getQuestionMarks(question), 0
    );

    const resultsData = questions.map((question, index) => {
      const questionText = `Question ${index + 1}: ${question.text}`;
      const rawUserAnswer = userAnswers[index];
      const hasUserAnswer = hasProvidedAnswer(rawUserAnswer);
      const userAnswer = hasUserAnswer
        ? formatAnswerForDisplay(rawUserAnswer)
        : "No Answer Provided";
      const correctAnswer = formatAnswerForDisplay(question.correctAnswer);
      const grade = getQuestionGrade(question, index, rawUserAnswer);
      const isCorrect = grade.isCorrect;
      earnedMarks += grade.scoreValue;

      doc.setFont("helvetica", "bold");
      const questionLines = doc.splitTextToSize(questionText, maxLineWidth);
      const questionDimensions = doc.getTextDimensions(questionLines, {
        maxWidth: maxLineWidth,
      });
      doc.setFont("helvetica", "normal");

      const userAnswerText = "Your Answer: " + userAnswer +
        (grade.aiGrade ? " | AI mark: " +
          Number(grade.scoreValue.toFixed(2)) + "/" +
          getQuestionMarks(question) + " marks (" +
          Math.round(grade.aiGrade.score) + "%)" : "");
      const userAnswerLines = doc.splitTextToSize(userAnswerText, maxLineWidth);
      const userAnswerDimensions = doc.getTextDimensions(userAnswerLines, {
        maxWidth: maxLineWidth,
      });

      const correctAnswerText = (isAiGradedQuestion(question) ? "Reference Answer: " : "Correct Answer: ") +
        correctAnswer;
      const correctAnswerLines = doc.splitTextToSize(
        correctAnswerText,
        maxLineWidth
      );
      const correctAnswerDimensions = doc.getTextDimensions(
        correctAnswerLines,
        {
          maxWidth: maxLineWidth,
        }
      );

      let explanationLines = [];
      let explanationDimensions = { h: 0 };
      const feedbackText = grade.aiGrade && grade.aiGrade.feedback
        ? "AI feedback: " + grade.aiGrade.feedback +
          (grade.aiGrade.missingPoints && grade.aiGrade.missingPoints.length
            ? " Improve: " + grade.aiGrade.missingPoints.join("; ") : "")
        : !isCorrect && question.explanation
          ? "Explanation: " + question.explanation : "";
      if (feedbackText) {
        explanationLines = doc.splitTextToSize(feedbackText, maxLineWidth);
        explanationDimensions = doc.getTextDimensions(explanationLines, {
          maxWidth: maxLineWidth,
        });
      }

      return {
        questionLines,
        questionHeight: questionDimensions.h,
        userAnswerLines,
        userAnswerHeight: userAnswerDimensions.h,
        correctAnswerLines,
        correctAnswerHeight: correctAnswerDimensions.h,
        explanationLines,
        explanationHeight: explanationDimensions.h,
        isCorrect,
        hasUserAnswer,
        aiGrade: grade.aiGrade || null,
        diagramImage: rawUserAnswer && typeof rawUserAnswer === "object" &&
          typeof rawUserAnswer.image === "string" &&
          /^data:image\/jpeg;base64,/.test(rawUserAnswer.image)
            ? rawUserAnswer.image : "",
      };
    });

    const percentageScore = totalMarks
      ? Math.round((earnedMarks / totalMarks) * 100)
      : 0;
    const displayEarnedMarks = Number(earnedMarks.toFixed(2));
    const scoreBadgeText = totalMarks
      ? displayEarnedMarks + "/" + totalMarks + " marks (" + percentageScore + "%)"
      : "No questions answered";

    const headerHeight = 34;

    const renderHeader = (includeLegend = false) => {
      doc.setFillColor(35, 48, 68);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Test Simulator Results", margin, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("Learning Progress Snapshot", margin, 26);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const badgeWidth = doc.getTextWidth(scoreBadgeText) + 14;
      const badgeHeight = 14;
      const badgeX = pageWidth - margin - badgeWidth;
      const badgeY = headerHeight / 2 - badgeHeight / 2;

      doc.setFillColor(57, 181, 74);
      doc.rect(badgeX, badgeY, badgeWidth, badgeHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.text(scoreBadgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 3, {
        align: "center",
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(
        defaultTextColor.r,
        defaultTextColor.g,
        defaultTextColor.b
      );

      let yOffset = headerHeight + 12;

      if (includeLegend) {
        const legendTop = headerHeight + 5;
        const legendHeight = 24;
        doc.setFillColor(248, 250, 255);
        doc.rect(margin - 4, legendTop, pageWidth - (margin - 4) * 2, legendHeight, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(
          defaultTextColor.r,
          defaultTextColor.g,
          defaultTextColor.b
        );
        doc.text("Legend", margin, legendTop + 11);

        const legendItems = [
          { label: "Correct response", color: correctFill },
          { label: "Incorrect response", color: incorrectFill },
          { label: "Explanation", color: explanationFill },
        ];

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        let legendX = margin + 35;
        const legendBaseline = legendTop + 11;

        legendItems.forEach((item) => {
          doc.setFillColor(item.color.r, item.color.g, item.color.b);
          doc.rect(legendX, legendBaseline - 5, 8, 8, "F");
          doc.setTextColor(
            defaultTextColor.r,
            defaultTextColor.g,
            defaultTextColor.b
          );
          doc.text(item.label, legendX + 12, legendBaseline + 1);
          legendX += doc.getTextWidth(item.label) + 32;
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(bodyFontSize);
        doc.setTextColor(
          defaultTextColor.r,
          defaultTextColor.g,
          defaultTextColor.b
        );

        yOffset = legendTop + legendHeight + 10;
      }

      return yOffset;
    };

    const ensureSpace = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - bottomMargin) {
        doc.addPage();
        yPosition = renderHeader(false);
      }
    };

    const drawBlock = (lines, textHeight, options = {}) => {
      if (!lines || !lines.length) {
        return;
      }

      const {
        fillColor = neutralFill,
        textColor = defaultTextColor,
        fontStyle = "normal",
        fontSize = bodyFontSize,
        spacingAfter = blockSpacing,
        badge,
      } = options;

      const blockHeight = textHeight + blockPadding * 2;
      ensureSpace(blockHeight + spacingAfter);

      doc.setFillColor(fillColor.r, fillColor.g, fillColor.b);
      doc.rect(blockX, yPosition, blockWidth, blockHeight, "F");

      if (badge) {
        const previousFont = doc.getFont();
        const previousFontSize = doc.getFontSize();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const badgeTextWidth = doc.getTextWidth(badge.label) + 8;
        const badgeHeight = 8;
        const badgeX = blockX + blockWidth - badgeTextWidth - 6;
        const badgeY = yPosition + 4;
        doc.setFillColor(
          badge.fillColor.r,
          badge.fillColor.g,
          badge.fillColor.b
        );
        doc.rect(badgeX, badgeY, badgeTextWidth, badgeHeight, "F");
        doc.setTextColor(
          badge.textColor.r,
          badge.textColor.g,
          badge.textColor.b
        );
        doc.text(
          badge.label,
          badgeX + badgeTextWidth / 2,
          badgeY + badgeHeight / 2 + 2,
          { align: "center" }
        );
        const previousFontName =
          (previousFont && (previousFont.fontName || previousFont.FontName)) ||
          "helvetica";
        const previousFontStyle =
          (previousFont && previousFont.fontStyle) || "normal";
        doc.setFont(previousFontName, previousFontStyle);
        doc.setFontSize(previousFontSize);
      }

      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      doc.setTextColor(textColor.r, textColor.g, textColor.b);
      doc.text(lines, blockX + blockPadding, yPosition + blockPadding, {
        baseline: "top",
      });

      yPosition += blockHeight + spacingAfter;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyFontSize);
      doc.setTextColor(
        defaultTextColor.r,
        defaultTextColor.g,
        defaultTextColor.b
      );
    };

    let yPosition = renderHeader(true);

    resultsData.forEach((entry) => {
      drawBlock(entry.questionLines, entry.questionHeight, {
        fillColor: neutralFill,
        textColor: defaultTextColor,
        fontStyle: "bold",
        spacingAfter: 4,
      });

      if (entry.hasUserAnswer) {
        drawBlock(entry.userAnswerLines, entry.userAnswerHeight, {
          fillColor: entry.isCorrect ? correctFill : incorrectFill,
          textColor: entry.isCorrect ? correctTextColor : incorrectTextColor,
          spacingAfter: 4,
          badge: {
            label: entry.aiGrade
              ? "AI " + Math.round(entry.aiGrade.score) + "%"
              : entry.isCorrect ? "Correct" : "Incorrect",
            fillColor: entry.isCorrect ? correctTextColor : incorrectTextColor,
            textColor: { r: 255, g: 255, b: 255 },
          },
        });
      } else {
        drawBlock(entry.userAnswerLines, entry.userAnswerHeight, {
          fillColor: incorrectFill,
          textColor: incorrectTextColor,
          spacingAfter: 4,
          badge: {
            label: "No Answer",
            fillColor: incorrectTextColor,
            textColor: { r: 255, g: 255, b: 255 },
          },
        });
      }

      if (entry.diagramImage) {
        const imageHeight = 84;
        ensureSpace(imageHeight + 8);
        doc.addImage(entry.diagramImage, "JPEG", blockX, yPosition, blockWidth, imageHeight);
        yPosition += imageHeight + 8;
      }

      drawBlock(entry.correctAnswerLines, entry.correctAnswerHeight, {
        fillColor: { r: 224, g: 242, b: 254 },
        textColor: { r: 13, g: 60, b: 97 },
        spacingAfter: entry.explanationLines.length ? 4 : 8,
      });

      if (entry.explanationLines.length) {
        drawBlock(entry.explanationLines, entry.explanationHeight, {
          fillColor: explanationFill,
          textColor: explanationTextColor,
          spacingAfter: 10,
        });
      }
    });

    const summaryText = "Summary: You earned " + displayEarnedMarks +
      " of " + totalMarks + " marks (" + percentageScore + "%).";
    doc.setFont("helvetica", "bold");
    const summaryLines = doc.splitTextToSize(summaryText, maxLineWidth);
    const summaryDimensions = doc.getTextDimensions(summaryLines, {
      maxWidth: maxLineWidth,
    });
    doc.setFont("helvetica", "normal");

    drawBlock(summaryLines, summaryDimensions.h, {
      fillColor: { r: 227, g: 242, b: 253 },
      textColor: { r: 25, g: 74, b: 129 },
      fontStyle: "bold",
      spacingAfter: 0,
    });

    doc.save("test_results.pdf");
  }


  if (downloadButton) {
    downloadButton.addEventListener("click", downloadResultsAsPDF);
  }


  if (downloadReportButton) {
    downloadReportButton.addEventListener("click", downloadResultsAsPDF);
  }

  //************************ SECTION 14: STUDY MODE ************************//

  if (studyModeToggle) {
    studyModeToggle.addEventListener("change", () => {
      const desiredMode = studyModeToggle.checked ? "study" : "test";
      setMode(desiredMode);
    });
  }

  //************************ SECTION 15: TEST SELECTION ************************//

  if (testSelect) {
    testSelect.addEventListener("change", () => {
      const selectedValue = testSelect.value;
      const leavingCustomSession =
        selectedValue !== CUSTOM_TEST_VALUE && isCustomSessionActive();

      if (testInProgress || timerStarted) {
        const confirmSwitch = confirm(
          "Are you sure you want to stop the current test?"
        );
        if (!confirmSwitch) {
          testSelect.value = testSelect.dataset.previousValue;
          return;
        } else {
          // Update stats for abandoned test
          testStats.testsAbandoned++;
          const testName =
            testSelect.options[testSelect.selectedIndex].textContent;
          testStats.abandonedTests.push(testName);
          saveStats();
          updateStatsDisplay();

          resetTest();
          if (leavingCustomSession) {
            exitCustomSession({ loadFallback: false });
          }
          loadQuestions(selectedValue);
        }
      } else {
        if (leavingCustomSession) {
          exitCustomSession({ loadFallback: false });
        }
        loadQuestions(selectedValue);
      }
      testSelect.dataset.previousValue = testSelect.value;
    });

    testSelect.dataset.previousValue = testSelect.value;
  }

  //************************ SECTION 16: BACK TO TOP BUTTON ************************//

  const backToTopButton = document.getElementById("back-to-top");

  if (backToTopButton) {
    window.addEventListener("scroll", () => {
      if (
        document.body.scrollTop > 200 ||
        document.documentElement.scrollTop > 200
      ) {
        backToTopButton.style.display = "block";
      } else {
        backToTopButton.style.display = "none";
      }
    });

    backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  //************************ SECTION 17: SHUFFLE QUESTIONS ************************//

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Initially disable submit button
  if (submitButton) {
    submitButton.disabled = true;
  }

  //************************ SECTION 18: UPLOAD CUSTOM TEST FILE ************************//

  if (uploadTestInput) {
    uploadTestInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file && file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const data = JSON.parse(e.target.result);
            const testName = data.testName || "Custom Test";
            const option = document.createElement("option");
            option.value = file.name;
            option.textContent = testName;
            option.dataset.questionCount = String(
              Array.isArray(data.questions) ? data.questions.length : 0
            );
            if (testSelect) {
              testSelect.appendChild(option);
              testSelect.value = file.name;
              loadQuestions(file.name, data);
              testSelect.dataset.previousValue = file.name;
            }
            availableTestsMetadata = availableTestsMetadata.filter(
              (item) => item.file !== file.name
            );
            availableTestsMetadata.push({
              file: file.name,
              name: testName,
              questionCount: Array.isArray(data.questions)
                ? data.questions.length
                : 0,
            });
            populateDefineTestModal();
            alert("Custom test loaded successfully!");
          } catch (error) {
            console.error("Error parsing JSON file:", error);
            alert("Invalid JSON file. Please select a valid test file.");
          }
        };
        reader.readAsText(file);
      } else {
        alert("Please select a valid JSON file.");
      }
    });
  }

  //************************ SECTION 19: SAVE AND RESUME PROGRESS ************************//

  function saveProgress() {
    const progressData = {
      userAnswers,
      remainingTime,
      currentPage,
      testInProgress,
      testSubmitted,
      currentTestFile,
      isTimerPaused,
      showAllQuestions,
      bookmarkedQuestions: Array.from(bookmarkedQuestions),
    };
    progressData.lastRegularTestValue = lastRegularTestValue;

    if (isCustomSessionActive()) {
      progressData.customSession = {
        id: currentCustomSession?.id,
        sources: currentCustomSession?.sources || [],
        requestedCount: currentCustomSession?.requestedCount || 0,
        questionCount: currentCustomSession?.questionCount || 0,
        totalAvailableQuestions:
          currentCustomSession?.totalAvailableQuestions || 0,
        timerMinutes:
          typeof currentCustomSession?.timerMinutes === "number"
            ? currentCustomSession.timerMinutes
            : null,
        displayName: currentCustomSession?.displayName || null,
        activeQuestions: cloneQuestionsData(originalQuestions),
        sourceQuestions: currentCustomSession?.sourceQuestions
          ? cloneQuestionsData(currentCustomSession.sourceQuestions)
          : cloneQuestionsData(originalQuestions),
      };
    } else {
      progressData.customSession = null;
    }

    localStorage.setItem("testProgress", JSON.stringify(progressData));
  }

  function getSavedProgress() {
    try {
      const savedProgress = JSON.parse(localStorage.getItem("testProgress"));
      if (
        savedProgress &&
        savedProgress.currentTestFile &&
        savedProgress.currentTestFile === currentTestFile
      ) {
        return savedProgress;
      }
    } catch (error) {
      console.warn("Unable to load saved progress:", error);
    }
    return null;
  }

  function clearSavedProgress() {
    localStorage.removeItem("testProgress");
  }

  window.addEventListener("beforeunload", () => {
    if (testInProgress || timerStarted) {
      saveProgress();
    }
  });

  // Load progress on page load will be handled when questions are initialized
});

