'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const oldPaper='test36.json',exam='ict2631-oct-nov-2025-exam.json',second='ict2622-oct-nov-2025-practice.json',custom='__custom_session__';
const preferenceKey='testSimulatorPreferences';
function paper(file){return {testName:file,preserveOrder:true,questions:Array.from({length:12},(_,i)=>({text:file+' question '+(i+1),options:['Yes','No'],correctAnswer:'Yes',marks:1}))};}
const settle=async()=>{for(let i=0;i<16;i++)await new Promise(r=>setImmediate(r));};
async function open({preferences={},progress,storage,reverse=false}={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://example.test/TestSimulatorApp_v1a/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.confirm=()=>true;w.alert=()=>{};
 if(storage)Object.entries(storage).forEach(([key,value])=>w.localStorage.setItem(key,value));
 else {w.localStorage.setItem(preferenceKey,JSON.stringify({questionOrder:'paper',...preferences}));if(progress)w.localStorage.setItem('testProgress',JSON.stringify(progress));}
 const requests=[],delayed=new Map(),metadata=[];let libraryLoading=true;
 w.fetch=file=>{requests.push(file);if(delayed.has(file))return new Promise(resolve=>delayed.get(file).push(resolve));if(reverse&&libraryLoading)return new Promise(resolve=>metadata.push([file,resolve]));return Promise.resolve({ok:true,json:async()=>paper(file)});};
 w.eval(fs.readFileSync('script.js','utf8'));
 await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
 if(reverse)metadata.reverse().forEach(([file,resolve])=>resolve({ok:true,json:async()=>paper(file)}));libraryLoading=false;
 await settle();assert.deepEqual(errors,[]);
 return {dom,w,requests,delayed,errors};
}
function dump(w){return Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const key=w.localStorage.key(i);return[key,w.localStorage.getItem(key)];}));}
function chosen(w){return w.document.getElementById('test-select').value;}
(async()=>{
 // Legacy progress for Assessment 2 must not displace a more recent module choice.
 let app=await open({preferences:{lastSelectedPaper:exam,mode:'study',paperPagePositions:{[exam]:2}},progress:{currentTestFile:oldPaper,userAnswers:{0:'Yes'},testInProgress:false},reverse:true});
 assert.equal(chosen(app.w),exam);assert.match(app.w.document.querySelector('.question-text').textContent,/ict2631/);
 assert.match(app.w.document.getElementById('page-info').textContent,/Page 2/);
 assert.equal(app.w.document.querySelector('.option-item input').checked,false,'Never copy Assessment 2 answers into a different module');
 app.w.dispatchEvent(new app.w.Event('beforeunload'));const storage=dump(app.w);app.dom.window.close();
 app=await open({storage,reverse:true});assert.equal(chosen(app.w),exam,'A cold reload stays on the chosen exam');app.dom.window.close();
 // Ordinary exam answers and question order still resume for the matching paper.
 app=await open({preferences:{lastSelectedPaper:exam},progress:{currentTestFile:exam,userAnswers:{0:'Yes'},testInProgress:false,activeQuestions:paper(exam).questions}});
 const resumedChoice=app.w.document.querySelector('.option-item input:checked');
 assert.ok(resumedChoice,'Matching paper answer should resume even when answer options are shuffled');
 assert.match(resumedChoice.closest('.option-item').textContent,/Yes/,'The saved answer value, not its old option position, must resume');
 // A refresh during a paper fetch must not store the previous paper under its new name.
 app.delayed.set(oldPaper,[]);app.delayed.set(second,[]);
 const select=app.w.document.getElementById('test-select');
 select.value=oldPaper;select.dispatchEvent(new app.w.Event('change'));select.value=second;select.dispatchEvent(new app.w.Event('change'));
 app.w.dispatchEvent(new app.w.Event('beforeunload'));
 assert.equal(JSON.parse(app.w.localStorage.getItem('testProgress')).currentTestFile,exam);
 assert.equal(JSON.parse(app.w.localStorage.getItem(preferenceKey)).lastSelectedSession,second);
 app.delayed.get(second)[0]({ok:true,json:async()=>paper(second)});await settle();
 app.delayed.get(oldPaper)[0]({ok:true,json:async()=>paper(oldPaper)});await settle();
 assert.equal(chosen(app.w),second);assert.match(app.w.document.querySelector('.question-text').textContent,/ict2622/,'Slow old response cannot replace the newly opened module');
 const changedStorage=dump(app.w);app.dom.window.close();
 app=await open({storage:changedStorage,reverse:true});assert.equal(chosen(app.w),second);app.dom.window.close();
 // Preserve custom-test resume and switching out of a custom mix.
 const customProgress={currentTestFile:custom,lastRegularTestValue:exam,userAnswers:{},customSession:{sources:[{file:exam,name:'Exam'}],activeQuestions:paper(exam).questions,sourceQuestions:paper(exam).questions}};
 app=await open({preferences:{lastSelectedPaper:exam,lastSelectedSession:custom},progress:customProgress});assert.equal(chosen(app.w),custom);app.dom.window.close();
 app=await open({preferences:{lastSelectedPaper:exam,lastSelectedSession:second},progress:customProgress});assert.equal(chosen(app.w),second);app.dom.window.close();
 app=await open({preferences:{lastSelectedPaper:exam},progress:customProgress});assert.equal(chosen(app.w),custom,'Legacy custom sessions still restore');app.dom.window.close();
 app=await open({reverse:true});assert.equal(chosen(app.w),'inf3708-oct-nov-2021.json','First visit does not select whichever network request finishes first');app.dom.window.close();
 console.log('Paper refresh checks passed: last choice beats stale progress, cold reload, matching answers, stable network order, custom resume, slow-response isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
