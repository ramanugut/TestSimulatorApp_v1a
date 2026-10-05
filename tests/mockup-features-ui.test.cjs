'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));await new Promise(r=>setTimeout(r,30));};
(async()=>{
 const errors=[],requests=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,d=w.document;
 try {
 w.localStorage.setItem('testSimulatorLook','new');w.localStorage.setItem('testSimulatorPreferences',JSON.stringify({lastSelectedPaper:'test36.json',questionOrder:'paper'}));
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.confirm=()=>true;w.alert=x=>errors.push(x);
 w.APP_CONFIG={aiTutorChatEndpoint:'/tutor',aiGraderEndpoint:'/grade',aiPracticeEndpoint:'/practice'};
 w.SpeechSynthesisUtterance=class{constructor(t){this.text=t;}};w.speechSynthesis={getVoices:()=>[],addEventListener(){},cancel(){},speak(){}};
 const paper={preserveOrder:true,questions:[{text:'Select the scope tool.',number:'1',options:['WBS','Gantt'],correctAnswer:'WBS',marks:2,explanation:'A WBS divides scope into work packages.',study:{title:'Scope',simple:'Break scope into smaller deliverables.'}},{text:'Explain the benefit of a WBS.',number:'2',correctAnswer:'Break scope into work packages.',marks:4,grading:'ai',study:{title:'Scope',simple:'Divide the scope.'},aiRubric:['Connect scope to work packages.']}]};
 w.fetch=async(url,options={})=>{
  if(options.method==='POST'){requests.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>url==='/tutor'?{feedback:'A WBS divides scope into work packages.',bookAlignment:'Group deliverables into smaller packages.'}:{score:75,accepted:true,feedback:'You connected scope to work packages.',verdict:'mostly_correct',strengths:[],missingPoints:[],bookAlignment:''}};}
  return{ok:true,json:async()=>paper};
 };
 for(const file of ['revision-insights.js','revision-controller.js','learning-modules.js','modules/inf3708-mastery.js','learning-engine.js','script.js','mockup-layout.js'])w.eval(fs.readFileSync(file,'utf8'));
 await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));await settle();
 assert.deepEqual([...d.querySelectorAll('#mockup-settings-rows > [data-setting]')].map(el=>el.dataset.setting),['Questions per page','Timer (min)','Pass mark (%)','Order','Theme','Guess first in Study','Bookmarks','AI tutor','Import JSON test','Custom test']);
 assert.equal(d.querySelector('#mockup-settings-rows #ai-revision-enabled').checked,true);
 assert.equal(requests.length,0,'No AI is called automatically');
 assert.ok(d.querySelector('.mockup-ask'),'Ask is available in Test');
 d.querySelector('.mockup-ask').click();
 const chat=d.querySelector('.ai-tutor-chat');assert.equal(chat.querySelector('button').textContent,'Send');
 chat.querySelector('textarea').value='Explain scope';chat.querySelector('button').click();await settle();
 assert.equal(requests.length,1);assert.ok(chat.textContent.includes('A WBS divides'));
 assert.ok(chat.querySelector('.ai-tutor-reply-play'),'AI replies retain their voice reader');
 d.getElementById('mode-tab-study').click();await settle();
 assert.equal(d.querySelector('.question .study-guide-card'),null,'Notes wait for a check when Guess First is on');
 assert.equal(d.querySelector('.mockup-check').disabled,true);
 const option=d.querySelector('.option-item input');option.checked=true;option.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(d.querySelector('.mockup-check').disabled,false);d.querySelector('.mockup-check').click();await settle();
 assert.ok(d.querySelector('.feedback').textContent.includes('Correct'));assert.ok(d.querySelector('.study-voice-toolbar'),'Study voice reader remains available');
 assert.equal(d.querySelector('.option-item input').disabled,false,'Checking a Study answer does not lock the paper');
 const other=d.querySelectorAll('.option-item input')[1];other.checked=true;other.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(d.querySelector('.feedback'),null,'Editing removes the old check');
 assert.ok(d.querySelector('.mockup-check'));
 const guess=d.getElementById('mockup-guess-first');guess.checked=false;guess.dispatchEvent(new w.Event('change'));await settle();
 assert.equal(d.querySelectorAll('.option-item input')[1].checked,true,'Guess First toggle preserves the selected Study answer');
 guess.checked=true;guess.dispatchEvent(new w.Event('change'));await settle();assert.equal(d.querySelectorAll('.option-item input')[1].checked,true);
 d.querySelector('.bookmark-button').click();await settle();assert.equal(d.querySelector('#mockup-bookmarks button').textContent,'Q1');
 d.getElementById('mode-tab-flashcards').click();await settle();
 assert.deepEqual([...d.querySelectorAll('#mockup-card-filters button')].map(el=>el.textContent),['All','Again 0','Flagged 1']);
 d.getElementById('flashcard-reveal').click();d.getElementById('flashcard-again').click();d.querySelectorAll('#mockup-card-filters button')[1].click();await settle();
 assert.equal(d.getElementById('flashcard-count').textContent,'1/1');
 d.getElementById('mode-tab-study').click();d.getElementById('submit-test').click();await settle();
 assert.equal(d.getElementById('mockup-results').hidden,false);assert.ok(d.getElementById('mockup-results').textContent.includes('Where you lost marks'));
 const review=[...d.querySelectorAll('#mockup-results button')].find(el=>el.textContent==='Review missed');review.click();await settle();
 assert.equal(d.getElementById('mockup-results').hidden,true);assert.ok(d.querySelector('.question'));
 d.getElementById('toggle-app-look').click();await settle();
 assert.equal(d.getElementById('ai-revision-enabled').checked,false,'The old look keeps its own AI consent');
 assert.ok(d.querySelector('#options-modal .ai-revision-session-setting #ai-revision-enabled'),'Old settings are restored');
 assert.deepEqual(errors,[]);
 console.log('Mockup features passed: settings, explicit Ask, Study checks, voice, filters, real results and Old look restoration.');
 } finally {dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
