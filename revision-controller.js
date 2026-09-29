/* Session-only opt-in controller for adaptive revision. This feature never
   auto-generates, does not use localStorage, and sends no student answers. */
(function () {
  "use strict";
  function element(tag,cls,text){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function create({setting,panel,endpoint,onStartPractice}) {
    if(!setting||!panel||!window.RevisionInsights) return {
      reset(){},showResults(){},isEnabled(){return false;}
    };
    let enabled=false,current=null,busy=false,used=false,version=0;
    setting.checked=false; // Always require explicit consent on each page load.
    function reset(){
      version++;
      current=null;busy=false;used=false;
      panel.replaceChildren();
      panel.classList.add("hidden");
      // Do not change enabled: a tab session lasts until refresh or closing.
    }
    function render(){
      panel.replaceChildren();
      if(!current){panel.classList.add("hidden");return;}
      panel.classList.remove("hidden");
      panel.appendChild(element("h3","","Your revision map"));
      panel.appendChild(element("p","revision-subtitle",
        "Calculated locally from your marks. Focus on the topics with the most room to improve."));
      const topics=current.report.topics.slice(0,5);
      const list=element("ul","revision-topic-list");
      topics.forEach(topic=>{
        const item=element("li","revision-topic");
        const line=element("div","revision-topic-head");
        line.appendChild(element("strong","",topic.title));
        line.appendChild(element("span","",topic.percent+"% · "+topic.count+
          (topic.count===1?" question":" questions")));
        const meter=element("div","revision-meter");
        meter.setAttribute("role","progressbar");
        meter.setAttribute("aria-label",topic.title+" performance");
        meter.setAttribute("aria-valuemin","0");meter.setAttribute("aria-valuemax","100");
        meter.setAttribute("aria-valuenow",String(topic.percent));
        const fill=element("span","revision-meter-fill");
        fill.style.width=topic.percent+"%";meter.appendChild(fill);
        item.append(line,meter);list.appendChild(item);
      });
      panel.appendChild(list);
      if(current.report.topics.length>topics.length)
        panel.appendChild(element("p","revision-subtitle",
          "Showing five focus areas from "+current.report.topics.length+" topics."));
      const note=element("p","revision-consent-note");
      const actions=element("div","revision-actions");
      if(current.report.weakCount===0){
        note.textContent="All answers earned full marks. No missed topics to generate practice from.";
      }else if(!enabled){
        note.textContent="Optional AI practice is off. Enable AI-generated revision in Settings for this tab, if you want five new questions on the topics you missed.";
      }else if(used){
        note.textContent="Your new practice set has already been created for this attempt.";
      }else{
        note.textContent="AI is enabled for this tab. Only missed-topic names and short learning notes are sent when you press Generate; your answers and identity are not sent.";
        const btn=element("button","btn btn-primary",busy?"Creating practice…":"Generate 5 new questions");
        btn.type="button";btn.disabled=busy;
        btn.addEventListener("click",generate);
        actions.appendChild(btn);
      }
      panel.appendChild(note);
      panel.appendChild(actions);
      const status=element("p","revision-feedback");
      status.setAttribute("role","status");
      status.setAttribute("aria-live","polite");
      if(busy)status.textContent="Generating original practice questions from missed topics…";
      panel.appendChild(status);
      panel._revisionStatus=status;
    }
    function showResults({questions,getGrade,moduleName}){
      version++;busy=false;used=false;
      current={report:window.RevisionInsights.analyse(questions,getGrade),
        moduleName:moduleName||"University revision"};
      render();
    }
    async function generate(){
      if(!enabled||busy||used||!current||!current.report.weakCount)return;
      const request=window.RevisionInsights.buildRequest(current.report,current.moduleName);
      if(!request)return;
      if(typeof endpoint!=="string"||!endpoint.trim()){
        const status=panel._revisionStatus;
        if(status)status.textContent="The optional AI generator is not connected. You can still review the missed questions.";
        return;
      }
      busy=true;
      const run=version;render();
      try{
        const response=await fetch(endpoint,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(request)
        });
        let payload=null;
        try{payload=await response.json();}catch(_){}
        if(run!==version||!enabled||!current)return;
        if(!response.ok)throw new Error(
          typeof payload?.error==="string"?payload.error:"Optional AI practice is unavailable."
        );
        const items=window.RevisionInsights.generatedQuestions(payload,request);
        if(run!==version||!enabled||!current)return;
        onStartPractice(items,{module:request.module,sourceType:"AI-generated practice (not official)"});
        used=true;busy=false;
        render();
      }catch(error){
        if(run!==version||!current)return;
        busy=false;render();
        if(panel._revisionStatus)panel._revisionStatus.textContent=
          error?.message||"Could not generate practice. Review the missed answers instead.";
      }
    }
    setting.addEventListener("change",()=>{
      version++;
      enabled=setting.checked===true;
      busy=false;
      render();
    });
    reset();
    return {reset,showResults,isEnabled(){return enabled;},getReport(){return current?.report||null;}};
  }
  window.RevisionController={create};
}());
