import {course as demo,stories,references,gradeAnswer} from './content.mjs';
import {renderFrame,overviewView,tutorView,sourcesView} from './views.mjs';
import {isLearningFile,droppedFiles,signature,supportedExtensions} from './files.mjs';

const icons={book:'<path d="M4 4h5a4 4 0 0 1 3 1.4A4 4 0 0 1 15 4h5v15h-5a4 4 0 0 0-3 1.4A4 4 0 0 0 9 19H4z"/><path d="M12 6v14"/>',overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',spark:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7z"/>',story:'<path d="m4 20 3-8L18 2l4 4-11 11zM7 12l4 5M4 20l5-1"/>',formula:'<path d="M8 20 11 4h6M5 10h11M5 20h5"/>',quiz:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h4"/>',folder:'<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m9 5 7 7-7 7"/>',left:'<path d="m15 5-7 7 7 7"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>',send:'<path d="m12 19 0-14m-6 6 6-6 6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',leaf:'<path d="M20 3C9 2 2 9 6 16s14 4 14-13ZM5 21 16 9"/>',print:'<path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7z"/>',trash:'<path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'};
const svg=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const pages={overview:'概览',course:'课程',story:'故事',glossary:'名词与公式',quiz:'练习',sources:'材料'};
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('浏览器存储空间不足，本次内容仍可导出。');}}
let data=load('learnmore-course-v1',demo);
if(!Array.isArray(data?.chapters)||!data.chapters.length||!Array.isArray(data.questions)||!Array.isArray(data.glossary)||!Array.isArray(data.formulas))data=demo;
let materials=load('learnmore-materials-v1',[]);
if(!Array.isArray(materials))materials=[];
let learning=load(`learnmore-progress-${data.id}`,{read:[],correct:[]});
let page=pages[location.hash.slice(1)]?location.hash.slice(1):'overview';
let chapter=0,mode='slides',genre='wuxia',storyLength='auto',customStyle='',generatedStories={},glossaryTab='terms',level='easy',questionIndex=0,termQuery='',chat=[],busy=null,sourcePreview='',sessions=[],runtime={mode:'checking',available:false,loggedIn:false},projectRoot='',demoW=0,demoB=0;
if(page==='sources')page='overview';
let chatDraft='',materialDraft='',importBusy=false,importLabel='',materialNotice='',modalKind='';
chat=load(`learnmore-chat-${data.id}`,[]);if(!Array.isArray(chat))chat=[];
generatedStories=load(`learnmore-stories-${data.id}`,{});
const totalMinutes=()=>data.chapters.reduce((n,c)=>n+Number(c.minutes||0),0);
const persist=()=>save(`learnmore-progress-${data.id}`,learning);
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
const btn=(text,action,style='light',extra='')=>`<button class="btn btn-${style}" data-action="${action}" ${extra}>${text}</button>`;

function render(){
  const position=$('#main-content')?.scrollTop||0;const focused=document.activeElement?.id;const cursor=document.activeElement?.selectionStart;
  $('#app').innerHTML=renderFrame(snapshot(),renderPage(),renderTutor());
  $('#main-content').scrollTop=position;
  if($('#chat-history'))$('#chat-history').scrollTop=$('#chat-history').scrollHeight;
  if(modalKind==='materials'&&$('#modal').open)renderMaterialsDialog();
  if(focused&&document.getElementById(focused)){const field=document.getElementById(focused);field.focus({preventScroll:true});if(typeof cursor==='number'&&field.setSelectionRange)try{field.setSelectionRange(cursor,cursor);}catch{}}
}

function heading(eyebrow,title,description,right=''){
  return `<div class="page-heading"><div><h1>${esc(page==='course'?data.title:pages[page])}</h1>${page==='course'?`<p>${esc(data.subtitle)}</p>`:''}</div>${right}</div>`;
}

function referenceHtml(){return data.id==='machine-learning'?`<div class="references">延伸阅读 · ${references.map(r=>`<a href="${r.url}" target="_blank" rel="noreferrer">${esc(r.name)}</a>`).join('')}<br>课程与题目为原创讲解；参考上述公开教材的知识体系与计算题型。</div>`:'';}

function renderOverview(){
  return overviewView(snapshot());
}

function gradientLab(){const loss=(([1,2].reduce((n,x)=>n+(demoW*x+demoB-2*x)**2,0))/4);return `<div class="section-spacing"><h3>自己走一步 · 互动实验</h3><p>两条训练数据 (1, 2)、(2, 4)，学习率 α = 0.1。点击后同时更新 w、b。</p><div class="formula" id="gradient-values">w = ${demoW.toFixed(4)}，b = ${demoB.toFixed(4)}，J = ${loss.toFixed(4)}</div><div class="toolbar" style="margin-top:12px">${btn('沿梯度走一步','gradient-step','soft')}${btn('回到起点','gradient-reset','light')}</div></div>`;}
function chapterBody(c,i,book=false){return `<section class="${book?'book-chapter':''}"><div class="eyebrow">CHAPTER ${String(i+1).padStart(2,'0')} <span>·</span> ${esc(c.kicker)} <span>· ${c.minutes} MIN</span></div><h2>${esc(c.title)}</h2><div class="body-text">${esc(c.explanation)}</div><h3>用一个具体例子，算明白</h3><div class="example">${esc(c.example)}</div><h3>把它写成公式</h3><div class="formula">${esc(c.formula)}</div><p class="formula-note">${esc(c.formulaExplanation)}</p><div class="callout">这一章，记住一句话：${esc(c.takeaway)}</div>${c.id==='gradient'&&data.id==='machine-learning'?gradientLab():''}${book?btn(learning.read.includes(c.id)?'✓ 已读完本章':'标记已读','mark-read','soft',`data-index="${i}"`):''}</section>`;}
function renderCourse(){const c=data.chapters[chapter]||data.chapters[0];return heading('Read, connect, understand','好知识，值得慢慢读。',data.title,`<div class="segmented"><button data-mode="slides" class="${mode==='slides'?'active':''}">课件模式</button><button data-mode="book" class="${mode==='book'?'active':''}">书本模式</button></div>`)+`<div class="toolbar"><span class="badge">${svg('clock')} ${totalMinutes()} 分钟 · ${data.chapters.length} 章</span><span class="badge">先备知识：${esc(data.prerequisites.join(' / '))}</span><div class="export-menu"><select id="export-select" aria-label="导出课程"><option value="">导出学习内容</option value="print">PDF / 打印</option><option value="book">完整阅读版 HTML</option><option value="markdown">课程 Markdown</option><option value="glossary">名词与公式 Markdown</option></select></div></div><div class="course-layout"><nav class="chapter-list" aria-label="章节目录"><p>课程目录 · ${data.chapters.length} CHAPTERS</p>${data.chapters.map((c,i)=>`<button class="${chapter===i?'active':''}" data-chapter="${i}"><small>${learning.read.includes(c.id)?'✓':String(i+1).padStart(2,'0')}</small>${esc(c.title)}</button>`).join('')}</nav><article class="reading">${mode==='book'?data.chapters.map((c,i)=>chapterBody(c,i,true)).join(''):chapterBody(c,chapter)}${mode==='slides'?`<div class="reading-footer">${btn(svg('left')+'上一章','prev-chapter','light',chapter===0?'disabled':'')}<span class="muted" style="font-size:10px">${chapter+1} / ${data.chapters.length}</span>${btn(chapter===data.chapters.length-1?'完成本章，去练习 '+svg('check'):'读完，下一章 '+svg('arrow'),'next-chapter','primary')}</div>`:''}${referenceHtml()}</article></div>`;}
function renderStory(){
  const selected=generatedStories[genre];const story=selected||(data.id==='machine-learning'?stories[genre]:null);
  const custom=genre==='custom';
  return heading('Knowledge, with a plot','换个世界，遇见同一个知识点。','让原理成为情节的一部分，在故事里走完从不懂到懂的旅程。')+`<div class="story-header"><div><div class="story-options">${[['wuxia','武侠江湖'],['scifi','星际科幻'],['romance','温柔言情'],['custom','自定义风格']].map(([id,t])=>`<button class="genre ${genre===id?'active':''}" data-genre="${id}">${t}</button>`).join('')}</div>${custom?`<input class="custom-style" id="custom-style" placeholder="例如：民国侦探、赛博朋克、轻松校园……" value="${esc(customStyle)}" aria-label="故事风格">`:''}<p class="muted" style="font-size:10px;margin:15px 0 0">当前知识来源：${esc(data.title)}</p></div><div class="story-settings"><label for="story-length">故事长度</label><select id="story-length">${[['auto','随材料知识量自动调整'],['short','短篇 · 约 600–900 字'],['medium','中篇 · 约 1200–1800 字'],['long','长篇 · 约 2200–3000 字']].map(([v,t])=>`<option value="${v}" ${v===storyLength?'selected':''}>${t}</option>`).join('')}</select></div></div><div class="toolbar">${btn(svg('spark')+(selected?'重新生成故事':'按所选风格与长度生成'),'generate-story','primary',busy?'disabled':'')}${btn(svg('download')+'导出故事','export-story','light',!story?'disabled':'')}<span class="muted" style="font-size:10px">${selected?'由本机 Codex 按当前课程生成':story?'当前为内置短篇；自选长度将在生成时生效':'从当前课程生成，长度随知识量调整'}</span></div>${story?`<article class="reading story-reading"><div class="eyebrow" style="justify-content:center">${esc(story.label)} · ${selected?'课程衍生故事':'原创教学短篇'}</div><h2>${esc(story.title)}</h2><p class="story-subtitle">${esc(story.subtitle)}</p>${story.sections.map(s=>`<section><h3>${esc(s.title)}</h3><div class="body-text">${esc(s.text)}</div><div class="concept-tag">${svg('spark')}故事里的知识 · ${esc(s.concept)}</div></section>`).join('')}<p class="story-footer">故事帮助建立直觉。人物与情节为虚构，具体定义、公式与适用条件请结合“课程阅读”和“名词与公式”查看。</p></article>`:`<div class="reading empty">${custom?'写下你喜欢的世界，再点击“按所选风格与长度生成”。':'点击生成，让本课程的知识走进新的故事。'}<br>${runtime.loggedIn?'本机 Codex 已就绪。':'生成新故事需要在本地版连接 Codex。'}</div>`}`;
}
function renderGlossary(){const q=termQuery.toLowerCase();const terms=data.glossary.filter(t=>(t.term+t.english+t.definition).toLowerCase().includes(q));const formulas=data.formulas.filter(t=>(t.name+t.expression+t.variables).toLowerCase().includes(q));return heading('A small dictionary, a solid foundation','每个名词，都有来处。','从一句人话到一条公式，把基础放在随手能找到的地方。')+`<div class="toolbar"><input id="term-search" type="search" placeholder="搜索名词、英文名称或公式……" value="${esc(termQuery)}" aria-label="搜索名词与公式">${btn(svg('download')+'导出速查表','export-glossary','light')}</div><div class="tabs"><button data-glossary="terms" class="${glossaryTab==='terms'?'active':''}">名词表 <span class="muted">${data.glossary.length}</span></button><button data-glossary="formulas" class="${glossaryTab==='formulas'?'active':''}">底层公式 <span class="muted">${data.formulas.length}</span></button></div><div class="glossary-grid">${glossaryTab==='terms'?terms.map((t,i)=>`<article class="term-card"><div class="eyebrow" style="margin-bottom:13px">TERM ${String(i+1).padStart(2,'0')}</div><h3>${esc(t.term)}</h3><small>${esc(t.english)}</small><p>${esc(t.definition)}</p><div class="term-example">比如 · ${esc(t.example)}</div></article>`).join(''):formulas.map(t=>`<article class="term-card formula-card"><h3>${esc(t.name)}</h3><div class="formula">${esc(t.expression)}</div><p>${esc(t.variables)}</p><p><strong>适用条件</strong><br>${esc(t.assumptions)}</p><div class="term-example">带入看看 · ${esc(t.example)}</div></article>`).join('')}</div>${!(glossaryTab==='terms'?terms:formulas).length?'<div class="empty">没有找到匹配项，试试另一个词。</div>':''}${referenceHtml()}`;}
function currentQuestions(){return data.questions.filter(q=>q.difficulty===level);}
let answerFeedback=null,showHint=false,showSolution=false;
function renderQuiz(){const qs=currentQuestions();questionIndex=Math.min(questionIndex,Math.max(0,qs.length-1));const q=qs[questionIndex];return heading('Make understanding measurable','学会了，就亲手算一次。','给自己一点挑战。先独立尝试，再看提示与逐步解析。',`<span class="badge">已掌握 ${learning.correct.length} / ${data.questions.length} 题</span>`)+`<div class="tabs">${[['easy','简易 · 代入与直觉'],['medium','适中 · 计算与连接'],['hard','困难 · 综合与推导']].map(([id,t])=>`<button data-level="${id}" class="${id===level?'active':''}">${t}</button>`).join('')}</div>${q?`<div class="quiz-layout"><article class="question-card"><div class="question-meta"><span class="level-badge ${level}">${{easy:'简易',medium:'适中',hard:'困难'}[level]}</span><span>第 ${questionIndex+1} / ${qs.length} 题</span><span style="margin-left:auto">计算题 · 独立作答</span></div><h2>${esc(q.title)}</h2><div class="question-prompt">${esc(q.prompt)}</div><form id="answer-form" class="answer-area"><label><span class="hidden">你的答案</span><input id="quiz-answer" autocomplete="off" inputmode="decimal" placeholder="输入你的计算结果" value="${esc(answerFeedback?.input||'')}"><span class="answer-unit">${esc(q.unit)}</span></label><button class="btn btn-primary" type="submit">检查答案 ${svg('arrow')}</button></form><div class="row"><button class="text-button" data-action="hint">${svg('spark')}${showHint?'收起提示':'需要一点提示？'}</button><button class="text-button" data-action="solution">${showSolution?'收起解析':'查看逐步解析'}</button></div>${showHint?`<div class="callout">${esc(q.hint)}</div>`:''}${answerFeedback?`<div class="answer-result ${answerFeedback.correct?'':'wrong'}">${answerFeedback.valid?(answerFeedback.correct?'✓ 算对了！再看看推导，确认每一步都理解。':'还差一点。检查损失系数、正负号和代入过程，再试一次。'):'请输入一个数值，例如 0.5 或 -2；无需填写单位。'}${answerFeedback.valid&&!answerFeedback.correct?'<br>你也可以展开提示，或在下方请老师检查思路。':''}</div>`:''}${showSolution?`<div class="solution"><strong>一步一步来</strong><ol>${q.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>参考结果：${q.answer} ${esc(q.unit)}${q.tolerance>0?` · 允许绝对误差 ${q.tolerance}`:''}</p><button class="text-button" data-ask="请讲解这道题，重点解释为什么这么计算：${esc(q.prompt)}">让老师再讲一次 ${svg('arrow')}</button></div>`:''}<div class="reading-footer">${btn(svg('left')+'上一题','prev-question','light',questionIndex===0?'disabled':'')}${btn(questionIndex===qs.length-1?'换个难度挑战 '+svg('arrow'):'下一题 '+svg('arrow'),'next-question','soft')}</div></article><aside class="quiz-sidebar"><h3>这组练习</h3><div class="question-grid">${qs.map((q,i)=>`<button data-question="${i}" class="${questionIndex===i?'active':''} ${learning.correct.includes(q.id)?'done':''}" aria-label="第${i+1}题">${String(i+1).padStart(2,'0')}</button>`).join('')}</div><p>绿色表示你已独立答对。<br>看过解析也没关系，理解以后可以再做一次。</p><div class="thin-line"></div><h3>本课计算约定</h3>${data.id==='machine-learning'?'<p>优化目标：J = MSE / 2<br>梯度用旧参数同时计算。<br>L2 项：λ‖w‖² / 2，不惩罚 b。</p>':'<p>按题干给出的定义、单位与假设计算。遇到公式约定差异，以题目条件为准。</p>'}</aside></div>`:'<div class="empty">当前课程还没有这一难度的练习。</div>'}${referenceHtml()}`;}
function renderSources(){
  return sourcesView(snapshot());
}

function renderPage(){return ({overview:renderOverview,course:renderCourse,story:renderStory,glossary:renderGlossary,quiz:renderQuiz,sources:renderSources}[page])();}

function renderTutor(){
  return tutorView({...snapshot(),chat,draft:chatDraft});
}

function nav(target){
  if(target==='sources'){openSources();return;}page=target;history.replaceState(null,'',`#${target}`);render();$('#main-content').scrollTop=0;
}

function resetAnswer(){answerFeedback=null;showHint=false;showSolution=false;}
async function api(route,body){const res=await fetch(route,{method:body===undefined?'GET':'POST',headers:{'X-Learnmore-Client':'1',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});let v;try{v=await res.json();}catch{throw new Error('此页面没有连接本机服务，请打开本地版后重试。');}if(!res.ok)throw new Error(v.error||'请求未完成。');return v;}
async function refreshRuntime(){try{runtime=await api('/api/status');projectRoot=runtime.projectRoot||projectRoot;}catch{runtime={mode:'static',available:false,loggedIn:false};}render();}
function needRuntime(){
  if(runtime.loggedIn)return true;
  chat.push({role:'error',text:runtime.available?'本机 Codex 尚未登录，请运行 codex login，完成后点击右上角重新连接。':'本机服务尚未就绪，请运行项目中的 start.ps1，再打开 http://127.0.0.1:4317。'});persistChat();render();return false;
}

async function runJob(type,endpoint,body){
  if(busy||importBusy){toast('请先等待当前任务完成。');return null;}if(!needRuntime())return null;
  busy={type,id:null,elapsed:0};render();
  try{const job=await api(endpoint,body);busy.id=job.id;render();
    for(let attempt=0;attempt<190;attempt++){await new Promise(r=>setTimeout(r,1500));const result=await api(`/api/jobs/${job.id}`);if(result.status==='cancelled'){toast('已停止。');return null;}if(result.status==='error')throw new Error(result.error);if(result.status==='done')return result;busy.elapsed=result.elapsed;const status=$('#job-status');if(status)status.textContent=`${{chat:'正在思考',course:'正在整理课程',story:'正在生成故事'}[type]} · ${result.elapsed} 秒`;}
    throw new Error('等待超时，请检查本机服务。');
  }catch(error){chat.push({role:'error',text:error.message});persistChat();return null;}finally{busy=null;render();}
}

function materialsText(){return materials.map(m=>`【${m.name}】\n${m.text}`).join('\n\n').slice(0,110000);}
async function ask(message){
  if(!message.trim())return;if(busy||importBusy){toast('请先等待当前任务完成。');return;}if(!needRuntime())return;
  const context={title:data.title,summary:data.summary,location:pages[page],materialPriority:materials.length?'优先依据已选材料，若与当前示例课程不同，不要混淆主题。':undefined,chapter:page==='course'?data.chapters[chapter]:undefined,question:page==='quiz'?currentQuestions()[questionIndex]:undefined,formulas:data.formulas,glossary:data.glossary};
  const history=chat.filter(m=>m.role!=='error').slice(-10);chat.push({role:'user',text:message});chatDraft='';persistChat();
  const result=await runJob('chat','/api/chat',{message,context,materials:materialsText(),history});
  if(result){chat.push({role:'assistant',text:result.text});persistChat();render();}
  $('#conversation')?.scrollIntoView({behavior:'smooth',block:'end'});
}

function setCourse(next){
  if(!next||!Array.isArray(next.prerequisites)||typeof next.title!=='string'||typeof next.summary!=='string'||!Array.isArray(next.chapters)||!next.chapters.length||!Array.isArray(next.questions)||!next.questions.every(q=>typeof q.answer==='number'&&Array.isArray(q.steps))||!Array.isArray(next.formulas)||!Array.isArray(next.glossary))throw new Error('课程结构不完整，原课程已保留。');
  data=next;chapter=0;learning=load(`learnmore-progress-${data.id}`,{read:[],correct:[]});generatedStories=load(`learnmore-stories-${data.id}`,{});chat=load(`learnmore-chat-${data.id}`,[]);chatDraft='';resetAnswer();save('learnmore-course-v1',data);persist();nav('overview');
}

function addMaterial(name,text,kind='导入文本',quiet=false){
  if(busy){if(!quiet)toast('当前任务结束后再调整材料。');return false;}
  if(!text.trim()){if(!quiet)toast('没有找到可加入的正文。');return false;}
  if(materials.some(m=>m.name===name&&m.text===text)){if(!quiet)toast('这份材料已经加入。');return false;}
  if(materials.reduce((n,m)=>n+m.text.length,0)+text.length>110000){if(!quiet)toast('材料总量超过约 110,000 字符，请先移除部分材料。');return false;}
  materials.push({name:name.slice(0,250),text,kind});sourcePreview=text;materialDraft='';save('learnmore-materials-v1',materials);if(!quiet){render();toast(`已加入：${name}`);}return true;
}

function glossaryMd(){return `# ${data.title} · 名词与公式\n\n## 名词表\n\n${data.glossary.map(t=>`### ${t.term} / ${t.english}\n\n${t.definition}\n\n例：${t.example}`).join('\n\n')}\n\n## 底层公式\n\n${data.formulas.map(f=>`### ${f.name}\n\n${f.expression}\n\n符号：${f.variables}\n\n条件：${f.assumptions}\n\n例：${f.example}`).join('\n\n')}`;}
function courseMd(){return `# ${data.title}\n\n${data.summary}\n\n${data.chapters.map((c,i)=>`## ${i+1}. ${c.title}\n\n${c.explanation}\n\n例：${c.example}\n\n公式：${c.formula}\n\n${c.formulaExplanation}\n\n记住：${c.takeaway}`).join('\n\n')}\n\n${glossaryMd()}\n\n## 练习\n\n${data.questions.map(q=>`### ${q.title} (${q.difficulty})\n\n${q.prompt}\n\n提示：${q.hint}\n\n解析：\n${q.steps.map(s=>'- '+s).join('\n')}\n\n结果：${q.answer}`).join('\n\n')}\n\n${data.id==='machine-learning'?'参考：\n'+references.map(r=>`- [${r.name}](${r.url})`).join('\n'):''}`;}
function download(filename,text,type='text/markdown;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportBook(){download('知序-完整阅读版.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title)}</title><style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;max-width:850px;margin:60px auto;padding:0 25px;color:#30412d;line-height:2}h1{font-size:32px}h2{margin-top:50px}p{white-space:pre-wrap}aside{background:#f1f5e9;padding:20px;border-radius:10px}small{color:#89947a}article{break-inside:avoid}a{color:inherit}@media print{body{margin:0}}</style><h1>${esc(data.title)}</h1><p>${esc(data.summary)}</p>${data.chapters.map((c,i)=>`<article><small>CHAPTER ${i+1}</small><h2>${esc(c.title)}</h2><p>${esc(c.explanation)}</p><aside>具体例子：${esc(c.example)}</aside><h3>公式</h3><aside>${esc(c.formula)}</aside><p>${esc(c.formulaExplanation)}</p><p>记住：${esc(c.takeaway)}</p></article>`).join('')}<h2>名词表</h2>${data.glossary.map(t=>`<h3>${esc(t.term)} · ${esc(t.english)}</h3><p>${esc(t.definition)}<br>例：${esc(t.example)}</p>`).join('')}<h2>底层公式</h2>${data.formulas.map(f=>`<h3>${esc(f.name)}</h3><aside>${esc(f.expression)}</aside><p>${esc(f.variables)}<br>条件：${esc(f.assumptions)}<br>例：${esc(f.example)}</p>`).join('')}<h2>练习与解析</h2>${data.questions.map(q=>`<h3>${esc(q.title)} (${q.difficulty})</h3><p>${esc(q.prompt)}</p><details><summary>提示与解析</summary><p>${esc(q.hint)}</p><ol>${q.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p>答案：${q.answer}</p></details>`).join('')}${referenceHtml()}</html>`,'text/html;charset=utf-8');}
function showSearch(){modalKind='search';const modal=$('#modal');modal.innerHTML=`<button class="btn-icon modal-close" data-action="close-modal" aria-label="关闭">${svg('close')}</button><h2>找一找，想理解的知识</h2><input id="global-search" placeholder="输入“梯度”“参数”“过拟合”……" aria-label="搜索知识点"><div id="search-results"></div>`;modal.showModal();$('#global-search').focus();updateSearch('');}
function updateSearch(query){const q=query.trim().toLowerCase();const chapters=data.chapters.map((c,i)=>({type:'章节',name:c.title,text:c.explanation,chapter:i}));const terms=data.glossary.map(t=>({type:'名词',name:t.term,text:t.english+' '+t.definition}));const all=[...chapters,...terms].filter(r=>!q||(r.name+r.text).toLowerCase().includes(q)).slice(0,9);$('#search-results').innerHTML=all.length?all.map(r=>`<button class="search-result" ${r.type==='章节'?`data-search-chapter="${r.chapter}"`:`data-search-term="${esc(r.name)}"`}>${esc(r.name)}<small>${r.type}</small></button>`).join(''):'<div class="empty">还没有找到，试试更短的关键词。</div>';}

function snapshot(){return {pages,page,data,materials,learning,runtime,busy,importBusy,importLabel,materialNotice,materialDraft,projectRoot,sessions,sourcePreview,hasNewMaterials:materials.length>0&&data.sourceKey!==signature(materials)};}
function persistChat(){save(`learnmore-chat-${data.id}`,chat.slice(-40));}
function renderMaterialsDialog(){const opened=Array.from($('#modal').querySelectorAll('details')).map(d=>d.open);$('#modal').innerHTML=renderSources();Array.from($('#modal').querySelectorAll('details')).forEach((d,i)=>{if(opened[i])d.open=true;});}
function openSources(){modalKind='materials';renderMaterialsDialog();if(!$('#modal').open)$('#modal').showModal();if(!materials.length){const paste=$('#modal').querySelector('.source-option');if(paste)paste.open=true;}}
async function importFiles(entries){
  if(busy||importBusy){toast('当前任务结束后再加入文件。');return;}if(!entries.length){toast('没有找到支持的文件，请选择 PDF、DOCX、PPTX 或文本。');return;}
  const eligible=entries.filter(item=>isLearningFile(item.name));const limited=eligible.slice(0,80);const warnings=[];let added=0;if(entries.truncated)warnings.push('文件夹较大，本批最多读取 80 个文件');
  if(eligible.length>80)warnings.push('每批最多读取 80 个文件');if(entries.length>eligible.length)warnings.push(`已略过 ${entries.length-eligible.length} 个不支持的文件`);
  importBusy=true;render();
  try{for(let i=0;i<limited.length;i++){
    const {file,name}=limited[i];importLabel=`读取 ${i+1}/${limited.length} · ${file.name}`;render();
    if(file.size>20*1024*1024){warnings.push(`${file.name} 超过 20 MB`);continue;}
    try{const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let p=0;p<bytes.length;p+=32768)binary+=String.fromCharCode(...bytes.subarray(p,p+32768));
      const result=await api('/api/import',{name:file.name,base64:btoa(binary)});
      if(addMaterial(name,result.text,result.kind,true))added++;else if(!materials.some(m=>m.name===name&&m.text===result.text))warnings.push(`${file.name} 未加入：材料总量已满`);
      if(result.truncated)warnings.push(`${file.name} 较长，已读取前部文字`);
    }catch(error){warnings.push(`${file.name}：${error.message}`);}
  }}finally{importBusy=false;importLabel='';materialNotice=warnings.slice(0,4).join('；');if(added){page='overview';history.replaceState(null,'','#overview');if($('#modal').open)$('#modal').close();}render();toast(added?`已加入 ${added} 份材料，可以开始提问。`:warnings[0]||'文件已经加入，无需重复添加。');}
}
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();dragDepth++;$('#drag-overlay').hidden=false;}});
document.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragleave',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drag-overlay').hidden=true;}});
document.addEventListener('drop',e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();dragDepth=0;$('#drag-overlay').hidden=true;void droppedFiles(e.dataTransfer).then(importFiles).catch(error=>toast(error.message));});
window.addEventListener('blur',()=>{dragDepth=0;$('#drag-overlay').hidden=true;});
$('#modal').addEventListener('close',()=>{modalKind='';});

document.addEventListener('click',async e=>{
  const el=e.target.closest('button,[data-nav]');if(!el)return;
  if(el.dataset.nav){nav(el.dataset.nav);return;}
  if(el.dataset.chapter!==undefined){chapter=Number(el.dataset.chapter);nav('course');return;}
  if(el.dataset.story){genre=el.dataset.story;nav('story');return;}
  if(el.dataset.genre){genre=el.dataset.genre;render();return;}
  if(el.dataset.mode){mode=el.dataset.mode;render();$('#main-content').scrollTop=0;return;}
  if(el.dataset.glossary){glossaryTab=el.dataset.glossary;render();return;}
  if(el.dataset.level){level=el.dataset.level;questionIndex=0;resetAnswer();render();return;}
  if(el.dataset.question!==undefined){questionIndex=Number(el.dataset.question);resetAnswer();render();return;}
  if(el.dataset.ask){await ask(el.dataset.ask);return;}
  if(el.dataset.previewMaterial!==undefined){sourcePreview=materials[Number(el.dataset.previewMaterial)]?.text||'';openSources();return;}
  if(el.dataset.removeMaterial!==undefined){if(busy||importBusy){toast('当前任务结束后再调整材料。');return;}materials.splice(Number(el.dataset.removeMaterial),1);sourcePreview='';materialNotice='';save('learnmore-materials-v1',materials);render();return;}
  if(el.dataset.searchChapter!==undefined){$('#modal').close();chapter=Number(el.dataset.searchChapter);nav('course');return;}
  if(el.dataset.searchTerm){$('#modal').close();termQuery=el.dataset.searchTerm;glossaryTab='terms';nav('glossary');return;}
  if(el.dataset.session){try{el.disabled=true;const result=await api('/api/sources/session?id='+encodeURIComponent(el.dataset.session));addMaterial(sessions.find(s=>s.id===el.dataset.session)?.name||'近期项目对话',result.text,'Codex 项目对话');}catch(e){toast(e.message);}finally{el.disabled=false;}return;}
  const action=el.dataset.action;
  try{switch(action){
    case 'pick-files':if(!busy&&!importBusy)$('#material-file').click();break;
    case 'pick-folder':if(!busy&&!importBusy)$('#material-folder').click();break;
    case 'focus-chat':$('#conversation').scrollIntoView({behavior:'smooth',block:'end'});$('#chat-input').focus({preventScroll:true});break;
    case 'download-course':exportBook();break;
    case 'import':openSources();break;
    case 'start':{const i=data.chapters.findIndex(c=>!learning.read.includes(c.id));chapter=Math.max(0,i);nav('course');break;}
    case 'prev-chapter':chapter=Math.max(0,chapter-1);render();$('#main-content').scrollTop=0;break;
    case 'next-chapter':if(!learning.read.includes(data.chapters[chapter].id))learning.read.push(data.chapters[chapter].id);persist();if(chapter<data.chapters.length-1){chapter++;render();$('#main-content').scrollTop=0;}else{nav('quiz');toast('课程读完了，来亲手算一次。');}break;
    case 'mark-read':{const c=data.chapters[Number(el.dataset.index)];if(!learning.read.includes(c.id))learning.read.push(c.id);persist();render();break;}
    case 'gradient-step':{const gw=([1,2].reduce((n,x)=>n+(demoW*x+demoB-2*x)*x,0))/2;const gb=([1,2].reduce((n,x)=>n+(demoW*x+demoB-2*x),0))/2;demoW-=0.1*gw;demoB-=0.1*gb;render();break;}
    case 'gradient-reset':demoW=0;demoB=0;render();break;
    case 'hint':showHint=!showHint;render();break;
    case 'solution':showSolution=!showSolution;render();break;
    case 'prev-question':questionIndex=Math.max(0,questionIndex-1);resetAnswer();render();break;
    case 'next-question':if(questionIndex<currentQuestions().length-1)questionIndex++;else{level={easy:'medium',medium:'hard',hard:'easy'}[level];questionIndex=0;}resetAnswer();render();break;

    case 'clear-chat':chat=[];persistChat();render();break;
    case 'cancel-job':if(busy?.id)await api(`/api/jobs/${busy.id}/cancel`,{});break;
    case 'search':showSearch();break;
    case 'close-modal':$('#modal').close();break;

    case 'add-text':{const text=$('#material-text').value;addMaterial(`学习笔记 ${materials.filter(m=>m.kind==='导入文本').length+1}`,text);break;}
    case 'find-sessions':if(runtime.mode!=='local'){toast('请先启动本机服务。');break;}projectRoot=$('#project-root').value;el.disabled=true;try{const r=await api('/api/sources/sessions?project='+encodeURIComponent(projectRoot));sessions=r.sessions;render();if(!sessions.length)toast('最近 21 天未找到此目录的对话，可以粘贴或导入文本。');}finally{el.disabled=false;}break;
    case 'read-project':if(runtime.mode!=='local'){toast('请先启动本机服务。');break;}projectRoot=$('#project-root').value;el.disabled=true;try{const r=await api('/api/sources/project?project='+encodeURIComponent(projectRoot));if(!r.items.length)toast('项目中没有可读取的文本，请先添加材料。');else{addMaterial(`项目：${r.root}`,r.items.map(f=>`文件：${f.name}\n${f.text}`).join('\n\n'),'项目文本');if(r.truncated)toast('已导入项目文本，内容因长度限制有所截断，请核对预览。');}}finally{el.disabled=false;}break;
    case 'generate-course':{const r=await runJob('course','/api/generate',{materials:materialsText()});if(r){setCourse({...r.result,id:'course-'+Date.now(),sourceKey:signature(materials)});toast('你的专属课程已经准备好。');}break;}
    case 'generate-story':{customStyle=$('#custom-style')?.value||customStyle;if(genre==='custom'&&!customStyle.trim()){toast('先填写你喜欢的故事风格。');break;}const r=await runJob('story','/api/story',{course:data,materials:materialsText(),style:genre==='custom'?customStyle:stories[genre].label,length:storyLength});if(r){generatedStories[genre]=r.result;save(`learnmore-stories-${data.id}`,generatedStories);render();toast('新的故事已写好。');}break;}
    case 'reset-progress':learning={read:[],correct:[]};persist();resetAnswer();render();toast('本课阅读与练习进度已重置。');break;
    case 'restore-demo':setCourse(demo);toast('已恢复机器学习课程，你的导入材料仍保留。');break;
    case 'refresh-runtime':await refreshRuntime();toast(runtime.loggedIn?'本机 Codex 已连接。':'本机连接尚未就绪。');break;
    case 'export-glossary':download('知序-名词与公式.md',glossaryMd());break;
    case 'export-story':{const s=generatedStories[genre]||stories[genre];if(s)download(`知序-${s.title}.md`,`# ${s.title}\n\n${s.subtitle}\n\n${s.sections.map(p=>`## ${p.title}\n\n${p.text}\n\n知识点：${p.concept}`).join('\n\n')}`);break;}
  }}catch(e){toast(e.message);}
});
document.addEventListener('submit',e=>{if(e.target.id==='chat-form'){e.preventDefault();const message=$('#chat-input').value;void ask(message);}if(e.target.id==='answer-form'){e.preventDefault();const q=currentQuestions()[questionIndex];const input=$('#quiz-answer').value;answerFeedback={...gradeAnswer(q,input),input};if(answerFeedback.correct&&!learning.correct.includes(q.id)){learning.correct.push(q.id);persist();}render();}});
document.addEventListener('input',e=>{
  if(e.target.id==='chat-input')chatDraft=e.target.value;if(e.target.id==='material-text')materialDraft=e.target.value;if(e.target.id==='project-root')projectRoot=e.target.value;
  if(e.target.id==='global-search')updateSearch(e.target.value);
  if(e.target.id==='term-search'){const pos=e.target.selectionStart;termQuery=e.target.value;render();$('#term-search').focus();$('#term-search').setSelectionRange?.(pos,pos);}
  if(e.target.id==='custom-style')customStyle=e.target.value;
});
document.addEventListener('change',async e=>{
  if(e.target.id==='story-length')storyLength=e.target.value;
  if(e.target.id==='export-select'){const value=e.target.value;e.target.value='';if(value==='print'){mode='book';render();window.print();}if(value==='book')exportBook();if(value==='markdown')download('知序-课程与练习.md',courseMd());if(value==='glossary')download('知序-名词与公式.md',glossaryMd());}
  if(['material-file','material-folder'].includes(e.target.id)){const entries=Array.from(e.target.files).map(file=>({file,name:file.webkitRelativePath||file.name}));e.target.value='';await importFiles(entries);}
});
document.addEventListener('keydown',e=>{if(e.target.id==='chat-input'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!busy&&!importBusy)$('#chat-form').requestSubmit();}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showSearch();}if(page==='course'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!$('#modal').open){if(e.key==='ArrowRight'&&chapter<data.chapters.length-1){chapter++;render();$('#main-content').scrollTop=0;}if(e.key==='ArrowLeft'&&chapter>0){chapter--;render();$('#main-content').scrollTop=0;}}});
window.addEventListener('hashchange',()=>{if(pages[location.hash.slice(1)]){page=location.hash.slice(1);render();}});
$('#material-file').accept=Array.from(supportedExtensions,e=>'.'+e).join(',');
render();void refreshRuntime();
