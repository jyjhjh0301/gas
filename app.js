const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'gas-study-v1';
let bank, state, ids = [], cursor = 0, selected = null, revealed = false, explanationOpen = false;

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {mode:'ordered', scope:'all', seen:{}, wrong:{}, ...saved};
  } catch { return {mode:'ordered', scope:'all', seen:{}, wrong:{}}; }
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function question() { return bank.questions.find(q => q.id === ids[cursor]); }
function scopeTitle() {
  if (state.scope === 'all') return '전체 문제';
  const chapter = bank.chapters.find(c => String(c.id) === state.scope);
  if (chapter) return chapter.title;
  for (const c of bank.chapters) { const s=c.sections.find(x=>x.id===state.scope); if(s) return s.title; }
  return '전체 문제';
}
function inScope(q) { return state.scope === 'all' || String(q.chapterId) === state.scope || q.sectionId === state.scope; }
function shuffle(arr) { for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function buildIds(keepId) {
  ids=bank.questions.filter(q=>inScope(q) && (state.mode!=='wrong'||state.wrong[q.id])).map(q=>q.id);
  if(state.mode==='random') shuffle(ids);
  cursor=Math.max(0,ids.indexOf(keepId));
  render();
}
function changeScope(scope) { state.scope=scope;saveState();buildIds(); }
function changeMode(mode) { state.mode=mode;saveState();buildIds(); }
function renderSidebar() {
  const total=Object.keys(state.seen).length;
  $('progress-total').textContent=`${total} / ${bank.questions.length} 완료`;
  $('progress-bar').style.width=`${total/bank.questions.length*100}%`;
  $('wrong-count').textContent=Object.keys(state.wrong).length;
  document.querySelectorAll('.mode-btn').forEach(b=>{b.classList.toggle('active',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',b.dataset.mode===state.mode)});
  const root=$('chapter-list');root.replaceChildren();
  bank.chapters.forEach(c=>{
    const group=document.createElement('div');group.className='chapter-group'+(state.scope===String(c.id)||state.scope.startsWith(c.id+'-')?' expanded':'');
    const btn=document.createElement('button');btn.type='button';btn.className='chapter-btn'+(state.scope===String(c.id)?' active':'');
    const count=bank.questions.filter(q=>q.chapterId===c.id&&state.seen[q.id]).length;
    btn.innerHTML=`<span class="chapter-index">${String(c.id).padStart(2,'0')}</span><span></span><span class="chapter-progress">${count}/50</span>`;
    btn.children[1].textContent=c.title;btn.onclick=()=>changeScope(String(c.id));group.append(btn);
    const list=document.createElement('div');list.className='section-list';
    c.sections.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='section-btn'+(state.scope===s.id?' active':'');b.textContent=`${s.id}  ${s.title}`;b.onclick=()=>changeScope(s.id);list.append(b)});
    group.append(list);root.append(group);
  });
}
function render() {
  renderSidebar();
  $('study').hidden=!ids.length;$('empty').hidden=ids.length!==0||state.mode!=='wrong';
  if(!ids.length) return;
  const q=question(); selected=null;revealed=false;explanationOpen=false;
  $('scope-label').textContent=state.mode==='wrong'?'오답 복습':state.mode==='random'?'랜덤 학습':'순서대로 학습';
  $('scope-title').textContent=scopeTitle();$('study-counter').textContent=`${cursor+1} / ${ids.length}`;
  $('question-number').textContent=`Q${q.id}`;
  $('question-section').textContent=bank.chapters.flatMap(c=>c.sections).find(s=>s.id===q.sectionId)?.title||'';
  $('question-text').textContent=q.question;
  const list=$('choices');list.replaceChildren();
  q.choices.forEach(o=>{const b=document.createElement('button');b.type='button';b.className='choice';b.setAttribute('aria-pressed','false');
    const l=document.createElement('span');l.className='choice-label';l.textContent=o.label;
    const t=document.createElement('span');t.textContent=o.text;b.append(l,t);
    b.onclick=()=>{if(revealed)return;selected=o.label;list.querySelectorAll('.choice').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b))});$('check-btn').disabled=false};list.append(b)});
  const jump=$('question-select');jump.replaceChildren();ids.forEach((id,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`Q${id}${state.seen[id]?' · 완료':''}`;jump.append(o)});jump.value=String(cursor);
  $('answer-panel').hidden=true;$('explanation').hidden=true;$('explain-btn').hidden=true;$('explain-btn').textContent='해설 보기';$('next-btn').hidden=true;$('check-btn').hidden=false;$('check-btn').disabled=true;$('prev-btn').disabled=cursor===0;
}
function checkAnswer() {
  if(!selected||revealed)return;
  const q=question(),correct=selected===q.answer;revealed=true;state.seen[q.id]=true;
  if(correct) delete state.wrong[q.id]; else state.wrong[q.id]=true;
  saveState();
  $('choices').querySelectorAll('.choice').forEach((b,i)=>{const label=q.choices[i].label;b.disabled=true;b.classList.remove('selected');if(label===q.answer)b.classList.add('correct');else if(label===selected)b.classList.add('incorrect')});
  const panel=$('answer-panel');panel.hidden=false;panel.className='answer-panel '+(correct?'good':'bad');panel.textContent=`${correct?'정답입니다':'오답입니다'} · 정답 ${q.answer}`;
  $('check-btn').hidden=true;$('explain-btn').hidden=false;$('next-btn').hidden=cursor===ids.length-1;
  renderSidebar();$('question-select').options[cursor].textContent=`Q${q.id} · 완료`;
}
function next() { if(cursor<ids.length-1){cursor++;render();window.scrollTo({top:0,behavior:'smooth'})} }
document.querySelectorAll('.mode-btn').forEach(b=>b.onclick=()=>changeMode(b.dataset.mode));
$('check-btn').onclick=checkAnswer;
$('explain-btn').onclick=()=>{if(!revealed)return;explanationOpen=!explanationOpen;$('explanation').hidden=!explanationOpen;$('explanation').textContent=question().explanation;$('explain-btn').textContent=explanationOpen?'해설 닫기':'해설 보기'};
$('next-btn').onclick=next;
$('prev-btn').onclick=()=>{if(cursor>0){cursor--;render();window.scrollTo({top:0,behavior:'smooth'})}};
$('question-select').onchange=e=>{cursor=Number(e.target.value);render()};
$('empty-back').onclick=()=>{state.scope='all';changeMode('ordered')};
fetch('./가스사용시설안전관리자_문제은행.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(data=>{
  bank=data;state=readState();if(!['ordered','random','wrong'].includes(state.mode))state.mode='ordered';
  if(!bank.chapters.some(c=>String(c.id)===state.scope||c.sections.some(s=>s.id===state.scope)))state.scope='all';
  $('loading').hidden=true;$('top-count').textContent=`${bank.questions.length}문제`;buildIds();
}).catch(()=>{$('loading').hidden=true;$('error').hidden=false});
