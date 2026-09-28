const $ = id => document.getElementById(id);
const STORAGE_KEY = 'gas-study-v3';
let bank, state, ids = [], cursor = 0, selected = null, revealed = false, explanationOpen = false;
const qById = id => bank.questions[id - 1];
const isMock = () => state.mode === 'mock';
const currentMock = () => state.mockSets[state.currentSet];
function makeSet() {
  const counts = [[2, 5], [1, 5], [4, 3], [3, 7]];
  const ids = counts.flatMap(([chapter, count]) => shuffle(bank.questions.filter(q => q.chapterId === chapter).map(q => q.id)).slice(0, count));
  state.mockSets.push({ ids, answers: {}, submitted: false });
  state.currentSet = state.mockSets.length - 1;
  saveState();
}
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('gas-study-v2') || localStorage.getItem('gas-study-v1') || '{}');
    return { mode: 'ordered', scope: 'all', seen: {}, wrong: {}, mockSets: [], currentSet: 0, ...saved };
  } catch { return { mode: 'ordered', scope: 'all', seen: {}, wrong: {}, mockSets: [], currentSet: 0 }; }
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function question() { return qById(ids[cursor]); }
function scopeTitle() {
  if (isMock()) return '모의고사';
  if (state.scope === 'all') return '전체 문제';
  const chapter = bank.chapters.find(c => String(c.id) === state.scope);
  if (chapter) return chapter.title;
  for (const c of bank.chapters) { const s = c.sections.find(x => x.id === state.scope); if (s) return s.title; }
  return '전체 문제';
}
function inScope(q) { return state.scope === 'all' || String(q.chapterId) === state.scope || q.sectionId === state.scope; }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function buildIds(keepId) {
  if (isMock()) {
    if (!currentMock()) makeSet();
    ids = currentMock().ids;
  } else {
    ids = bank.questions.filter(q => inScope(q) && (state.mode !== 'wrong' || state.wrong[q.id])).map(q => q.id);
    if (['chapterRandom', 'allRandom'].includes(state.mode)) shuffle(ids);
  }
  cursor = Math.max(0, ids.indexOf(keepId));
  saveState(); render();
}
function changeScope(scope) {
  state.scope = scope;
  if (['allRandom', 'mock'].includes(state.mode)) state.mode = 'ordered';
  buildIds();
}
function changeMode(mode) {
  if (mode === 'allRandom' || mode === 'mock') state.scope = 'all';
  if (mode === 'mock' && !currentMock()) makeSet();
  state.mode = mode; buildIds();
}
function renderSetSelect() {
  const select = $('set-select'); select.replaceChildren();
  state.mockSets.forEach((set, i) => {
    const option = document.createElement('option'); option.value = String(i);
    option.textContent = `세트 ${i + 1}${set.submitted ? ' · 채점 완료' : ' · 진행 중'}`;
    select.append(option);
  });
  select.value = String(state.currentSet);
}
function renderSidebar() {
  const total = Object.keys(state.seen).length;
  $('progress-total').textContent = `${total} / ${bank.questions.length} 완료`;
  $('progress-bar').style.width = `${total / bank.questions.length * 100}%`;
  $('wrong-count').textContent = Object.keys(state.wrong).length;
  document.querySelectorAll('.mode-btn').forEach(b => { b.classList.toggle('active', b.dataset.mode === state.mode); b.setAttribute('aria-pressed', b.dataset.mode === state.mode); });
  const root = $('chapter-list'); root.replaceChildren();
  bank.chapters.forEach(c => {
    const group = document.createElement('div'); group.className = 'chapter-group' + (state.scope === String(c.id) || state.scope.startsWith(c.id + '-') ? ' expanded' : '');
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'chapter-btn' + (state.scope === String(c.id) && !isMock() ? ' active' : '');
    const count = bank.questions.filter(q => q.chapterId === c.id && state.seen[q.id]).length;
    btn.innerHTML = `<span class="chapter-index">${String(c.id).padStart(2, '0')}</span><span></span><span class="chapter-progress">${count}/50</span>`;
    btn.children[1].textContent = c.title; btn.onclick = () => changeScope(String(c.id)); group.append(btn);
    const list = document.createElement('div'); list.className = 'section-list';
    c.sections.forEach(s => { const b = document.createElement('button'); b.type = 'button'; b.className = 'section-btn' + (state.scope === s.id && !isMock() ? ' active' : ''); b.textContent = `${s.id}  ${s.title}`; b.onclick = () => changeScope(s.id); list.append(b); });
    group.append(list); root.append(group);
  });
}
function render() {
  renderSidebar();
  $('study').hidden = !ids.length; $('empty').hidden = ids.length !== 0 || state.mode !== 'wrong';
  if (!ids.length) return;
  const q = question(), mock = isMock(), submitted = mock && currentMock().submitted;
  selected = mock ? (currentMock().answers[q.id] || null) : null; revealed = !!submitted; explanationOpen = false;
  $('scope-label').textContent = mock ? '20문제 · 60점 만점' : state.mode === 'wrong' ? '오답 복습' : state.mode === 'allRandom' ? '전체 랜덤' : state.mode === 'chapterRandom' ? '선택 범위 랜덤' : '순서대로 학습';
  $('scope-title').textContent = scopeTitle(); $('study-counter').textContent = `${cursor + 1} / ${ids.length}`;
  $('mock-intro').hidden = !mock || submitted;
  $('mock-controls').hidden = !mock;
  if (mock) renderSetSelect();
  $('question-number').textContent = mock ? `모의고사 ${cursor + 1}번 · Q${q.id}` : `Q${q.id}`;
  $('question-section').textContent = bank.chapters.flatMap(c => c.sections).find(s => s.id === q.sectionId)?.title || '';
  $('question-text').textContent = q.question;
  const list = $('choices'); list.replaceChildren();
  q.choices.forEach(o => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.setAttribute('aria-pressed', String(o.label === selected));
    const l = document.createElement('span'); l.className = 'choice-label'; l.textContent = o.label;
    const t = document.createElement('span'); t.textContent = o.text; b.append(l, t);
    if (o.label === selected && !submitted) b.classList.add('selected');
    if (submitted) { b.disabled = true; if (o.label === q.answer) b.classList.add('correct'); else if (o.label === selected) b.classList.add('incorrect'); }
    b.onclick = () => { if (revealed) return; selected = o.label; list.querySelectorAll('.choice').forEach(x => { x.classList.toggle('selected', x === b); x.setAttribute('aria-pressed', String(x === b)); }); $('check-btn').disabled = false; $('save-btn').disabled = false; };
    list.append(b);
  });
  const jump = $('question-select'); jump.replaceChildren(); ids.forEach((id, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = mock ? `${i + 1}번 · Q${id}${currentMock().answers[id] ? ' · 저장' : ''}` : `Q${id}${state.seen[id] ? ' · 완료' : ''}`; jump.append(o); }); jump.value = String(cursor);
  $('answer-panel').hidden = !submitted; $('explanation').hidden = true; $('explain-btn').hidden = !submitted; $('explain-btn').textContent = '해설 보기';
  $('next-btn').hidden = !submitted;
  $('check-btn').hidden = mock; $('check-btn').disabled = !selected;
  $('save-btn').hidden = !mock || submitted; $('save-btn').disabled = !selected;
  $('submit-btn').hidden = !mock || submitted;
  $('prev-btn').disabled = cursor === 0;
  $('mock-result').hidden = !submitted;
  if (submitted) {
    const correct = selected === q.answer, panel = $('answer-panel');
    panel.className = 'answer-panel ' + (correct ? 'good' : 'bad');
    panel.textContent = `${correct ? '정답입니다' : selected ? '오답입니다' : '미응답'} · 정답 ${q.answer}`;
    renderMockResult();
  }
}
function checkAnswer() {
  if (!selected || revealed || isMock()) return;
  const q = question(), correct = selected === q.answer; revealed = true; state.seen[q.id] = true;
  if (correct) delete state.wrong[q.id]; else state.wrong[q.id] = true;
  saveState();
  $('choices').querySelectorAll('.choice').forEach((b, i) => { const label = q.choices[i].label; b.disabled = true; b.classList.remove('selected'); if (label === q.answer) b.classList.add('correct'); else if (label === selected) b.classList.add('incorrect'); });
  const panel = $('answer-panel'); panel.hidden = false; panel.className = 'answer-panel ' + (correct ? 'good' : 'bad'); panel.textContent = `${correct ? '정답입니다' : '오답입니다'} · 정답 ${q.answer}`;
  $('check-btn').hidden = true; $('explain-btn').hidden = false; $('next-btn').hidden = cursor === ids.length - 1;
  renderSidebar(); $('question-select').options[cursor].textContent = `Q${q.id} · 완료`;
}
function saveMockAnswer() {
  if (!isMock() || currentMock().submitted || !selected) return;
  currentMock().answers[question().id] = selected; saveState();
  if (cursor < ids.length - 1) { cursor++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else { render(); $('submit-btn').focus(); }
}
function submitMock() {
  if (!isMock() || currentMock().submitted) return;
  // Preserve the current selection if the user has not pressed "답안 저장" yet.
  if (selected) currentMock().answers[question().id] = selected;
  const unanswered = ids.filter(id => !currentMock().answers[id]).length;
  if (unanswered && !confirm(`미응답 ${unanswered}문제가 있습니다. 제출할까요?`)) { saveState(); render(); return; }
  currentMock().submitted = true;
  ids.forEach(id => { state.seen[id] = true; if (currentMock().answers[id] === qById(id).answer) delete state.wrong[id]; else state.wrong[id] = true; });
  saveState(); render(); $('mock-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderMockResult() {
  const box = $('mock-result'); box.replaceChildren();
  const score = ids.filter(id => currentMock().answers[id] === qById(id).answer).length;
  const title = document.createElement('h2'); title.textContent = `모의고사 결과 · ${score} / 20문제 정답`;
  const detail = document.createElement('p'); detail.textContent = `점수 ${score * 3} / 60점 · 틀리거나 건너뛴 문제를 선택해 정답과 해설을 확인하세요.`;
  const list = document.createElement('div'); list.className = 'result-grid';
  ids.forEach((id, i) => { const b = document.createElement('button'); b.type = 'button'; const ok = currentMock().answers[id] === qById(id).answer; b.className = 'result-item ' + (ok ? 'pass' : 'fail'); b.textContent = `${i + 1}번 ${ok ? '✓' : '×'}`; b.setAttribute('aria-label', `${i + 1}번 ${ok ? '정답' : '오답 또는 미응답'}`); b.onclick = () => { cursor = i; render(); $('question-text').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; list.append(b); });
  box.append(title, detail, list);
}
function next() { if (cursor < ids.length - 1) { cursor++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => { if (b.dataset.mode === 'mock' && isMock() && currentMock() && !currentMock().submitted) { cursor = 0; render(); return; } changeMode(b.dataset.mode); });
$('check-btn').onclick = checkAnswer;
$('save-btn').onclick = saveMockAnswer;
$('submit-btn').onclick = submitMock;
$('set-select').onchange = e => { state.currentSet = Number(e.target.value); cursor = 0; buildIds(); };
$('new-set-btn').onclick = () => { makeSet(); cursor = 0; buildIds(); };
$('explain-btn').onclick = () => { if (!revealed) return; explanationOpen = !explanationOpen; $('explanation').hidden = !explanationOpen; $('explanation').textContent = question().explanation; $('explain-btn').textContent = explanationOpen ? '해설 닫기' : '해설 보기'; };
$('next-btn').onclick = next;
$('prev-btn').onclick = () => { if (cursor > 0) { cursor--; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
$('question-select').onchange = e => { cursor = Number(e.target.value); render(); };
$('empty-back').onclick = () => { state.scope = 'all'; changeMode('ordered'); };
fetch('./가스사용시설안전관리자_문제은행.json').then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).then(data => {
  bank = data; state = readState();
  if (!Array.isArray(state.mockSets)) state.mockSets = [];
  state.mockSets = state.mockSets.filter(set => Array.isArray(set.ids) && set.ids.length === 20 && set.answers && typeof set.answers === 'object');
  if (!Number.isInteger(state.currentSet) || state.currentSet < 0 || state.currentSet >= state.mockSets.length) state.currentSet = Math.max(0, state.mockSets.length - 1);
  if (state.mode === 'random') state.mode = 'chapterRandom';
  if (!['ordered', 'chapterRandom', 'allRandom', 'wrong', 'mock'].includes(state.mode)) state.mode = 'ordered';
  if (state.scope !== 'all' && !bank.chapters.some(c => String(c.id) === state.scope || c.sections.some(s => s.id === state.scope))) state.scope = 'all';
  if (['allRandom', 'mock'].includes(state.mode)) state.scope = 'all';
  $('loading').hidden = true; $('top-count').textContent = `${bank.questions.length}문제`; buildIds();
}).catch(() => { $('loading').hidden = true; $('error').hidden = false; });
