/* Optional appearance only. All paper, answer and grading state stays in script.js. */
(function () {
  'use strict';
  const key = 'testSimulatorLook';
  document.addEventListener('DOMContentLoaded', function () {
    const ui = window.TestSimulatorUi;
    if (!ui) return;
    const get = id => document.getElementById(id);
    const placements = [];
    const body = document.body;
    const map = get('question-map');
    const mapToggle = get('question-map-toggle');
    const scrim = get('question-map-scrim');
    const tabs = document.querySelector('.mode-tabs');
    const pager = get('pagination-controls');
    const mastery = get('mastery-panel');
    const page = document.querySelector('.page-container');
    const scroll = document.createElement('div');
    scroll.id = 'study-scroll';
    const content = document.createElement('div');
    content.className = 'study-scroll-content';
    scroll.appendChild(content);
    page.insertBefore(scroll, page.firstChild);
    const progress = document.querySelector('.progress-bar-container');
    const progressSlot = document.createElement('div');
    progressSlot.className = 'mockup-progress new-look-only';
    get('floating-header').after(progressSlot);
    const heading = document.querySelector('.header-top');
    const settings = document.querySelector('#options-modal .tools-modal-content');
    function relocate(node, destination, before) {
      if (!node || !destination) return;
      const anchor = document.createComment('original layout position');
      node.before(anchor);
      placements.push({ node, anchor, destination, before });
    }
    relocate(tabs, heading, document.querySelector('.header-timer'));
    Array.from(page.querySelectorAll(':scope > .mode-panel')).forEach(panel => relocate(panel, content));
    relocate(pager, page);
    relocate(mastery, get('mode-panel-mastery'));
    relocate(progress, progressSlot);
    ['start-test', 'submit-test'].forEach(id => relocate(get(id), get('map-actions')));
    relocate(document.querySelector('.timer-settings'), get('mockup-timer-setting'));
    relocate(get('study-guess-first-bar'), get('mockup-guess-setting'));
    ['pause-timer', 'define-test', 'download-results', 'reset-test'].forEach(id => relocate(get(id), get('mockup-settings-actions')));
    // Keep the real custom-test action reachable from the paper library too.
    const pickerFooter = document.createElement('div');
    pickerFooter.className = 'mockup-picker-footer new-look-only';
    const custom = document.createElement('button');
    custom.type = 'button';
    custom.textContent = '+ Build custom test';
    custom.addEventListener('click', () => {
      get('close-paper-picker').click();
      get('define-test').click();
    });
    pickerFooter.append(custom);
    document.querySelector('.paper-picker-shell').append(pickerFooter);
    settings.append(get('mockup-settings-actions'));
    const cardsLabel = document.querySelector('.cards-tab-label');
    const size = get('questions-per-page');
    let previousLook = null;
    let initialTheme = body.dataset.appearance || 'light';
    try { initialTheme = localStorage.getItem('testSimulatorOldTheme') || initialTheme; } catch (_) {}
    let pref = {};
    try { pref = JSON.parse(localStorage.getItem('testSimulatorPreferences') || '{}'); } catch (_) {}
    function closeMap(restoreFocus = false) {
      map.classList.remove('open');
      mapToggle.setAttribute('aria-expanded', 'false');
      scrim.hidden = true;
      if (restoreFocus) mapToggle.focus();
    }
    mapToggle.addEventListener('click', () => {
      const open = !map.classList.contains('open');
      map.classList.toggle('open', open);
      scrim.hidden = !open;
      mapToggle.setAttribute('aria-expanded', String(open));
      if (open) (map.querySelector('[aria-current]') || get('close-question-map')).focus();
    });
    get('close-question-map').addEventListener('click', () => closeMap(true));
    scrim.addEventListener('click', () => closeMap(true));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && map.classList.contains('open')) closeMap(true);
    });
    tabs.addEventListener('click', event => {
      closeMap();
      if (body.classList.contains('new-look') && event.target.closest('[data-mode]')) scroll.scrollTop = 0;
    });
    get('open-options').addEventListener('click', () => closeMap());
    get('open-paper-picker').addEventListener('click', () => closeMap());
    get('submit-test').addEventListener('click', () => closeMap());
    size.addEventListener('change', () => ui.setPageSize(size.value));
    const headerTimer = document.querySelector('.header-timer');
    function timerAction() {
      if (!body.classList.contains('new-look') || body.dataset.activeMode !== 'test') return;
      if (!get('start-test').disabled) get('start-test').click();
      else get('pause-timer').click();
    }
    headerTimer.addEventListener('click', timerAction);
    headerTimer.addEventListener('keydown', event => {
      if (body.classList.contains('new-look') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault(); timerAction();
      }
    });
    function applyLook(look, initial = false) {
      const fresh = look !== 'old';
      let appearance = fresh ? 'auto' : initialTheme;
      try {
        if (previousLook !== null) localStorage.setItem(previousLook ? 'testSimulatorNewTheme' : 'testSimulatorOldTheme', body.dataset.appearance || 'light');
        else if (!localStorage.getItem('testSimulatorOldTheme')) localStorage.setItem('testSimulatorOldTheme', initialTheme);
        appearance = localStorage.getItem(fresh ? 'testSimulatorNewTheme' : 'testSimulatorOldTheme') || appearance;
      } catch (_) {}
      ui.closeOptions();
      ui.closeControls();
      closeMap();
      body.classList.toggle('new-look', fresh);
      const quickLook = get('toggle-app-look');
      quickLook.textContent = fresh ? 'Old look' : 'New look';
      quickLook.setAttribute('aria-label', fresh ? 'Switch to old look' : 'Switch to new look');
      document.querySelector(`.theme-choice[data-theme="${appearance}"]`)?.click();
      previousLook = fresh;
      placements.forEach(({ node, anchor, destination, before }) => {
        if (fresh) destination.insertBefore(node, before || null);
        else anchor.after(node);
      });
      scroll.hidden = !fresh;
      cardsLabel.textContent = fresh ? 'Cards' : 'Flashcards';
      headerTimer.setAttribute('role', fresh ? 'button' : 'timer');
      headerTimer.tabIndex = fresh ? 0 : -1;
      headerTimer.title = fresh ? 'Start or pause timer' : 'Time remaining';
      document.querySelectorAll('[data-look]').forEach(button => {
        const selected = button.dataset.look === (fresh ? 'new' : 'old');
        button.setAttribute('aria-pressed', String(selected));
      });
      // No look change resets the test or remaps its answers.
      if (initial && fresh) ui.setPageSize(pref.questionsPerPage || 1, false);
      else if (initial && pref.questionsPerPage === 'all') ui.setPageSize('all', false);
      ui.refreshLayout();
      window.PaperPicker?.refresh();
      size.value = ui.pageSize();
      if (fresh) {
        get('mastery-empty').after(mastery);
        mastery.open = body.dataset.activeMode === 'mastery';
      }
      get('prev-page').textContent = fresh ? '←' : 'Previous';
      get('prev-page').setAttribute('aria-label', 'Previous page');
      try { localStorage.setItem(key, fresh ? 'new' : 'old'); } catch (_) {}
      decorateQuestions();
    }
    document.querySelectorAll('[data-look]').forEach(button => {
      button.addEventListener('click', () => applyLook(button.dataset.look));
    });
    get('toggle-app-look').addEventListener('click', () => applyLook(body.classList.contains('new-look') ? 'old' : 'new'));
    document.querySelectorAll('.theme-choice').forEach(button => {
      button.addEventListener('click', () => {
        try { localStorage.setItem(body.classList.contains('new-look') ? 'testSimulatorNewTheme' : 'testSimulatorOldTheme', body.dataset.appearance); } catch (_) {}
      });
    });
    function decorateQuestions() {
      if (!body.classList.contains('new-look')) return;
      get('questions-container').querySelectorAll('.question').forEach(question => {
        const flag = question.querySelector('.bookmark-button');
        if (flag) flag.setAttribute('aria-label', flag.classList.contains('active') ? 'Unflag question' : 'Flag question');
        const chat = question.querySelector('.ai-tutor-wrap');
        if (!chat || question.querySelector('.mockup-ask')) return;
        const ask = document.createElement('button');
        ask.type = 'button';
        ask.className = 'mockup-ask';
        ask.textContent = 'Ask';
        ask.setAttribute('aria-expanded', 'false');
        ask.addEventListener('click', () => {
          const opened = question.classList.toggle('tutor-open');
          ask.setAttribute('aria-expanded', String(opened));
          if (opened) chat.querySelector('textarea, input')?.focus({ preventScroll: true });
        });
        question.appendChild(ask);
      });
    }
    new MutationObserver(decorateQuestions).observe(get('questions-container'), { childList: true });
    window.MockupLayout = { closeMap };
    let look = 'new';
    try { look = localStorage.getItem(key) || 'new'; } catch (_) {}
    applyLook(look, true);
  });
}());
