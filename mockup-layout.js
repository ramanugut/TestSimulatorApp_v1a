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
    const settingRows = document.createElement('div');
    settingRows.id = 'mockup-settings-rows';
    settingRows.className = 'new-look-only';
    settings.querySelector('.modal-header').after(settingRows);
    function row(label, control, id) {
      const node = document.createElement('div'); node.className = 'mockup-setting';
      node.dataset.setting = label;
      const text = document.createElement(id ? 'label' : 'span'); text.textContent = label;
      if (id) text.htmlFor = id;
      node.append(text, control); settingRows.append(node); return node;
    }
    function button(label, callback, className = '') {
      const node = document.createElement('button'); node.type = 'button'; node.textContent = label;
      node.className = className; node.addEventListener('click', callback); return node;
    }
    const pageChoices = document.createElement('div'); pageChoices.className = 'look-choices';
    ['1','5','10','all'].forEach(value => {
      const choice = button(value === 'all' ? 'All' : value, () => { ui.setPageSize(value); syncControls(); });
      choice.dataset.pageSize = value; pageChoices.append(choice);
    });
    row('Questions per page', pageChoices);
    const timerSlot = document.createElement('div');
    row('Timer (min)', timerSlot, 'timer-input'); relocate(get('timer-input'), timerSlot);
    const passSlot = document.createElement('div');
    row('Pass mark (%)', passSlot, 'pass-mark-input'); relocate(get('pass-mark-input'), passSlot);
    const orderSlot = document.createElement('div');
    row('Order', orderSlot, 'question-order-select'); relocate(get('question-order-select'), orderSlot);
    const theme = document.querySelector('.mockup-theme-setting');
    settingRows.append(theme);
    theme.dataset.setting = 'Theme';
    const swatches = {auto:'linear-gradient(90deg,#4f4bd8,#14162b)',light:'#4f4bd8','mockup-dark':'#8e8cff',sunrise:'#0f6f73',focus:'#ffd23f'};
    theme.querySelectorAll('button').forEach(choice => {
      const dot = document.createElement('i'); dot.className = 'mockup-swatch'; dot.style.background = swatches[choice.dataset.theme]; choice.prepend(dot);
    });
    const guess = document.createElement('input'); guess.id = 'mockup-guess-first'; guess.type = 'checkbox';
    guess.addEventListener('change', () => { if (guess.checked !== ui.snapshot().guessFirst) get('study-guess-first-toggle').click(); });
    row('Guess first in Study', guess, guess.id);
    const bookmarks = document.createElement('div'); bookmarks.id = 'mockup-bookmarks'; bookmarks.className = 'mockup-chips';
    const bookmarksRow = row('Bookmarks', bookmarks); bookmarksRow.classList.add('mockup-setting-stack');
    const aiSlot = document.createElement('div');
    row('AI tutor', aiSlot, 'ai-revision-enabled'); relocate(get('ai-revision-enabled'), aiSlot);
    const uploadLabel = document.createElement('label'); uploadLabel.className = 'mockup-upload'; uploadLabel.textContent = 'Upload'; uploadLabel.htmlFor = 'upload-test-input';
    relocate(get('upload-test-input'), uploadLabel); row('Import JSON test', uploadLabel);
    row('Custom test', button('Define', () => { ui.closeOptions(); get('define-test').click(); }));
    const actions = get('mockup-settings-actions');
    const exportButton = button('Download results (PDF)', () => get('download-results').click(), 'mockup-export');
    actions.prepend(exportButton);
    const resultView = document.createElement('section'); resultView.id = 'mockup-results'; resultView.className = 'new-look-only'; resultView.hidden = true;
    content.append(resultView);
    const bookEmpty=document.createElement('div');bookEmpty.className='new-look-only mockup-book-empty';bookEmpty.textContent='Textbook reader';get('mode-panel-book').append(bookEmpty);
    const cardFilters = document.createElement('div'); cardFilters.id = 'mockup-card-filters'; cardFilters.className = 'new-look-only look-choices';
    get('flashcard-status').prepend(cardFilters);
    const cardHint = document.createElement('p'); cardHint.className = 'new-look-only mockup-card-hint'; cardHint.textContent = '← again · space flip · → known';
    get('flashcard-controls').after(cardHint);
    const customCopy=document.createElement('p'); customCopy.className='new-look-only mockup-mute';customCopy.textContent='Mix questions from several papers. Each question keeps its source.';
    document.querySelector('#define-test-modal .modal-header').after(customCopy);
    const customExit=button('Exit custom',()=>{get('close-define-test').click();get('exit-custom-session').click();},'new-look-only');
    get('define-test-start').after(customExit);
    get('define-test').addEventListener('click',()=>{customExit.disabled=!ui.snapshot().paper.includes('__custom_session__');});
    let pendingResults = false, lastMode = null, uiFrame = null;
    let oldAiConsent = get('ai-revision-enabled').checked;
    let newAiConsent = true;
    try { const value = sessionStorage.getItem('testSimulatorNewAiTutor'); if (value !== null) newAiConsent = value === 'true'; } catch (_) {}
    get('ai-revision-enabled').addEventListener('change', () => {
      if (body.classList.contains('new-look')) {
        newAiConsent = get('ai-revision-enabled').checked;
        try { sessionStorage.setItem('testSimulatorNewAiTutor', String(newAiConsent)); } catch (_) {}
      } else oldAiConsent = get('ai-revision-enabled').checked;
    });
    function hideResults() { resultView.hidden = true; body.classList.remove('mockup-results-open'); }
    function showResults(state) {
      resultView.replaceChildren();
      const total = state.graded.reduce((n,q)=>n+q.marks,0), earned = state.graded.reduce((n,q)=>n+q.scoreValue,0);
      const pct = total ? Math.round(earned/total*100) : 0, pass = Number(get('pass-mark-input').value);
      const summary = document.createElement('div'); summary.className = 'mockup-result-summary';
      const score = document.createElement('b'); score.className = 'mockup-result-score'; score.textContent = pct+'%'; score.style.color = pct>=pass ? 'var(--ok-color)' : 'var(--danger-color)';
      const copy = document.createElement('div'); const verdict = document.createElement('b'); verdict.textContent = pct>=pass ? 'Passed' : 'Not passed yet';
      const marks = document.createElement('div'); marks.className = 'mockup-mute'; marks.textContent = Number(earned.toFixed(1))+' of '+total+' marks. Pass mark '+pass+'%.';
      copy.append(verdict,marks); summary.append(score,copy); resultView.append(summary);
      const heading = text => { const h = document.createElement('h3'); h.textContent=text; resultView.append(h); };
      heading('Where you lost marks');
      const topics = new Map(); state.graded.forEach(q=>{ const item = topics.get(q.topic)||{earned:0,total:0}; item.earned+=q.scoreValue; item.total+=q.marks; topics.set(q.topic,item); });
      Array.from(topics.entries()).sort((a,b)=>a[1].earned/a[1].total-b[1].earned/b[1].total).forEach(([name,item])=>{
        const percent = Math.round(item.earned/item.total*100);
        const line = document.createElement('div'); line.className='mockup-topic-mark';
        const label=document.createElement('span'); label.textContent=name;
        const track=document.createElement('span'); track.className='mockup-mark-track'; const fill=document.createElement('i'); fill.style.width=percent+'%'; fill.style.background=percent<50?'var(--danger-color)':percent<70?'var(--warning-color)':'var(--ok-color)'; track.append(fill);
        const value=document.createElement('span'); value.textContent=percent+'%'; line.append(label,track,value); resultView.append(line);
      });
      const missed=state.graded.filter(q=>q.scoreValue<q.marks);
      heading('Missed questions ('+missed.length+')');
      const chips=document.createElement('div'); chips.className='mockup-chips mockup-missed';
      missed.forEach(q=>chips.append(button(String(q.number),()=>{hideResults();ui.reviewQuestion(q.index);scroll.scrollTop=0;})));
      if(!missed.length) chips.textContent='Nothing missed.';
      resultView.append(chips);
      const controls=document.createElement('div'); controls.className='mockup-result-actions';
      if(missed.length) {
        controls.append(button('Review missed',()=>{hideResults();ui.reviewQuestion(missed[0].index);scroll.scrollTop=0;}));
        controls.append(button('Retry missed as mini-test',()=>{hideResults();ui.retryMissed();}));
      }
      if(state.aiEnabled && missed.length) controls.append(button('Generate 5 practice questions',()=>ui.generatePractice()));
      controls.append(button('Download PDF',()=>get('download-results').click()));
      resultView.append(controls);
      relocateRevisionStatus();
      resultView.hidden=false;body.classList.add('mockup-results-open');closeMap();scroll.scrollTop=0;
    }
    function relocateRevisionStatus() {
      const source=get('revision-insights');
      if(!source) return;
      const proxy=document.createElement('p'); proxy.className='mockup-generation-status mockup-mute'; proxy.setAttribute('role','status');
      const sync=()=>{proxy.textContent=source.querySelector('.revision-feedback')?.textContent||'';};
      if(relocateRevisionStatus.observer) relocateRevisionStatus.observer.disconnect();
      relocateRevisionStatus.observer=new MutationObserver(sync);
      relocateRevisionStatus.observer.observe(source,{childList:true,subtree:true,characterData:true});
      sync();resultView.append(proxy);
    }
    function syncControls() {
      if (!body.classList.contains('new-look')) return;
      const state = ui.snapshot(); guess.checked = state.guessFirst;
      body.classList.toggle('mockup-no-book', !state.bookAvailable);
      pageChoices.querySelectorAll('button').forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.pageSize===ui.pageSize())));
      const flagStamp = JSON.stringify(state.flags);
      if(bookmarks.dataset.stamp!==flagStamp) {
        bookmarks.dataset.stamp=flagStamp;bookmarks.replaceChildren();
        state.flags.forEach(q=>bookmarks.append(button('Q'+q.number,()=>{ui.closeOptions();hideResults();ui.reviewQuestion(q.index);})));
        if(!state.flags.length) bookmarks.textContent='No bookmarks yet.';
      }
      if(lastMode!==state.mode) {hideResults();lastMode=state.mode;}
      if(!state.submitted) hideResults();
      else if(pendingResults) {pendingResults=false;showResults(state);}
    }
    document.addEventListener('simulator-ui-update',()=>{
      if(uiFrame!==null) return;
      uiFrame=requestAnimationFrame(()=>{uiFrame=null;syncControls();});
    });
    document.addEventListener('simulator-results-ready',()=>{pendingResults=true;requestAnimationFrame(syncControls);});
    tabs.addEventListener('click',()=>{pendingResults=false;hideResults();});
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
    let touchStart=null;
    get('questions-container').addEventListener('touchstart',event=>{touchStart=event.touches[0];},{passive:true});
    get('questions-container').addEventListener('touchend',event=>{
      if(!touchStart || !body.classList.contains('new-look') || window.innerWidth>760 || event.target.closest('canvas,input,textarea,table,.option-item,button,.answer-workspace'))return;
      const last=event.changedTouches[0],dx=last.clientX-touchStart.clientX,dy=last.clientY-touchStart.clientY;
      touchStart=null;if(Math.abs(dx)>80 && Math.abs(dy)<45)get(dx<0?'next-page':'prev-page').click();
    },{passive:true});
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
      const ai = get('ai-revision-enabled');
      ai.checked = fresh ? newAiConsent : oldAiConsent;
      ai.dispatchEvent(new Event('change'));
      previousLook = fresh;
      get('question-order-select').querySelectorAll('option').forEach(option => {
        const labels={paper:'Paper',random:'Shuffled',type:'By type',chapter:'By topic'};
        if(!option.dataset.oldLabel) option.dataset.oldLabel=option.textContent;
        option.hidden=fresh && option.value==='auto';
        option.textContent=fresh ? labels[option.value]||'Paper' : option.dataset.oldLabel;
      });
      if(fresh && get('question-order-select').value==='auto') {
        get('question-order-select').value='paper';
        get('question-order-select').dispatchEvent(new Event('change'));
      }
      hideResults();
      [['#define-test-title','Custom test'],['label[for="define-test-question-count"]','Questions'],['label[for="define-test-timer"]','Minutes'],['#define-test-start','Start test']].forEach(([selector,label])=>{
        const node=document.querySelector(selector);if(!node.dataset.originalLabel)node.dataset.originalLabel=node.textContent;node.textContent=fresh?label:node.dataset.originalLabel;
      });
      if(!fresh){get('define-test-question-count').min='1';get('define-test-question-count').removeAttribute('max');}
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
      get('flashcard-restart').textContent = fresh ? 'Restart' : 'Start over';
      get('prev-page').textContent = fresh ? '←' : 'Previous';
      get('prev-page').setAttribute('aria-label', 'Previous page');
      try { localStorage.setItem(key, fresh ? 'new' : 'old'); } catch (_) {}
      decorateQuestions();
      if (fresh && ui.snapshot().submitted) pendingResults=true;
      syncControls();
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
        const diagrams=question.querySelectorAll('.editable-uml-workspace');
        diagrams.forEach(diagram=>{
          const strip=diagram.querySelector('.uml-tool-strip'), controls=diagram.querySelector('.answer-workspace-actions');
          if(strip && controls && !strip.dataset.compact) {
            strip.dataset.compact='true';
            strip.querySelectorAll('[data-tool]').forEach(b=>{const names={move:'Move',class:'Box',usecase:'Oval',arrow:'Arrow',pen:'Draw'};if(names[b.dataset.tool]) b.textContent=names[b.dataset.tool];});
            Array.from(controls.children).forEach(b=>{if(b.textContent==='Clear') b.classList.add('mockup-extra-tool');else {if(b.textContent==='Delete selected') b.textContent='Delete';strip.append(b);}});
            const upload=strip.querySelector('.uml-upload');if(upload)upload.firstChild.textContent='Upload image';
          }
        });
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
    let look = 'old';
    try { look = localStorage.getItem(key) || 'old'; } catch (_) {}
    applyLook(look, true);
  });
}());
