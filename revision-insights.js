/* Optional, session-only revision insights. No API calls or persistent opt-in here.
   Insights are computed locally from existing answer marks. */
(function () {
  "use strict";
  function limited(value, length) {
    return typeof value === "string" ? value.trim().slice(0, length) : "";
  }
  function analyse(questions, getGrade) {
    const groups = new Map();
    const misses = [];
    (Array.isArray(questions) ? questions : []).forEach((question, index) => {
      const max = Number(question && question.marks) > 0 ? Number(question.marks) : 1;
      const grade = getGrade(question, index) || {};
      const earned = Math.max(0, Math.min(max, Number(grade.scoreValue) || 0));
      const title = limited(question?.study?.title || question?.topic || question?.chapter ||
        question?.section || "General revision", 90) || "General revision";
      const key = title.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, {
        title, earned:0, max:0, count:0, missed:0, examples:[]
      });
      const group = groups.get(key);
      group.earned += earned;group.max += max;group.count++;
      if (earned < max - .001) {
        group.missed++;
        const detail = {
          title,
          module: limited(question?.sourceTestName?.match(/\b(?:ICT|INF)\d{4}\b/i)?.[0] || "",12),
          concept:limited(question?.study?.simple || question?.explanation || "",340),
          mistake:limited(question?.study?.pitfall || "",250),
          steps:Array.isArray(question?.study?.steps)
            ? question.study.steps.map(s=>limited(s,180)).filter(Boolean).slice(0,2) : [],
          fraction:max ? earned / max : 0
        };
        misses.push(detail);
        if (group.examples.length<2)group.examples.push(detail);
      }
    });
    const topics=[...groups.values()].map(group=>({
      ...group, percent: group.max ? Math.round(group.earned/group.max*100) : 0
    })).sort((a,b)=>a.percent-b.percent || b.missed-a.missed || a.title.localeCompare(b.title));
    return {topics, misses, questionCount:(questions||[]).length,
      weakCount:misses.length, totalEarned:topics.reduce((sum,t)=>sum+t.earned,0),
      totalMarks:topics.reduce((sum,t)=>sum+t.max,0)};
  }
  function buildRequest(report, moduleName) {
    if (!report || !report.weakCount) return null;
    const topics=report.topics.filter(item=>item.missed>0).slice(0,4).map(item=>({
      title:limited(item.title,90),
      module:limited(item.examples[0]?.module||moduleName,40),
      concept:limited(item.examples[0]?.concept,340),
      commonMistake:limited(item.examples[0]?.mistake,250),
      steps:(item.examples[0]?.steps||[]).slice(0,2)
    }));
    if(!topics.length)return null;
    return {module:limited(moduleName,70),topics,questionCount:5};
  }
  function generatedQuestions(payload, request) {
    if(!payload||!Array.isArray(payload.questions)||payload.questions.length!==5){
      throw new Error("The AI service did not return five valid questions. Please retry.");
    }
    const allowed=new Set((request?.topics||[]).map(topic=>topic.title.toLowerCase()));
    const output=payload.questions.map((item,index)=>{
      if(!item || typeof item!=="object")throw new Error("Invalid generated question.");
      const text=limited(item.text,450),options=item.options;
      const answerIndex=item.correctIndex;
      const topic=limited(item.topic,90);
      const explanation=limited(item.explanation,650);
      const example=limited(item.example,300);
      const note=limited(item.studentNote,350);
      if(!text||!topic||!allowed.has(topic.toLowerCase())||
         !Array.isArray(options)||options.length!==4||
         !options.every(o=>typeof o==="string"&&o.trim().length>0&&o.length<=220)||
         new Set(options.map(o=>o.trim())).size!==4||
         !Number.isInteger(answerIndex)||answerIndex<0||answerIndex>3||
         !explanation||!example||!note)throw new Error("Generated practice had an invalid answer key.");
      return {
        number:String(index+1),
        text,
        options:options.map(v=>v.trim()),
        correctAnswer:options[answerIndex].trim(),
        marks:1,
        topic,
        sourceType:"AI-generated practice · not an official university paper",
        sourceTestName:"AI-generated practice (not official)",
        explanation:explanation+"\n\nExample: "+example+"\n\nStudent note: "+note,
        study:{title:topic,simple:explanation,stepsTitle:"Why this works",
          steps:[explanation],example,pitfall:note,remember:explanation,
          keyTerms:[{term:topic,meaning:explanation}]}
      };
    });
    if(new Set(output.map(q=>q.text.toLowerCase())).size!==output.length){
      throw new Error("Generated questions were repeated. Please retry.");
    }
    return output;
  }
  window.RevisionInsights={analyse,buildRequest,generatedQuestions};
}());
