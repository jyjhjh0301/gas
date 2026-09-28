const $ = id => document.getElementById(id);
const STORAGE_KEY = 'gas-study-v5';
let bank, state, ids = [], cursor = 0, selected = null, revealed = false, explanationOpen = false;
const CIRCLED = ['①', '②', '③', '④'];
const qById = id => bank.questions[id - 1];
const isMock = () => state.mode === 'mock';
const isReview = () => state.mode === 'review';
const currentMock = () => state.mockSets[state.currentSet];
function choiceOrder(q) {
  const orders = isMock() || isReview() ? (currentMock().choiceOrders ||= {}) : state.practiceOrders;
  const shouldShuffle = isMock() || isReview() ? currentMock().shuffleChoices : state.shuffleChoices;
  if (!orders[q.id]) orders[q.id] = shouldShuffle ? shuffle([...CIRCLED]) : [...CIRCLED];
  return orders[q.id];
}
function shownLabel(q, original) { return CIRCLED[choiceOrder(q).indexOf(original)]; }
function shownExplanation(q) {
  const order = choiceOrder(q);
  return q.explanation.replace(/[①②③④]/g, label => CIRCLED[order.indexOf(label)] || label);
}
function makeSet() {
  const counts = [[2, 5], [1, 5], [4, 3], [3, 7]];
  const pools = Object.fromEntries(counts.map(([chapter]) => [chapter, shuffle(bank.questions.filter(q => q.chapterId === chapter).map(q => q.id))]));
  state.mockSets = Array.from({ length: 7 }, (_, round) => ({
    ids: counts.flatMap(([chapter, count]) => pools[chapter].slice(round * count, (round + 1) * count)),
    answers: {}, submitted: false, shuffleChoices: state.shuffleChoices, choiceOrders: {}
  }));
  state.currentSet = 0;
  saveState();
}
function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('gas-study-v4') || localStorage.getItem('gas-study-v3') || localStorage.getItem('gas-study-v2') || localStorage.getItem('gas-study-v1') || '{}');
    return { mode: 'ordered', scope: 'all', subjects: [1, 2, 3, 4], shuffleChoices: false, practiceOrders: {}, seen: {}, wrong: {}, mockSets: [], currentSet: 0, ...saved };
  } catch { return { mode: 'ordered', scope: 'all', subjects: [1, 2, 3, 4], shuffleChoices: false, practiceOrders: {}, seen: {}, wrong: {}, mockSets: [], currentSet: 0 }; }
}
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }
function question() { return qById(ids[cursor]); }
function scopeTitle() {
  if (isMock()) return '모의고사';
  if (isReview()) return `제${state.currentSet + 1}회 오답 다시 풀기`;
  if (state.scope === 'all') return state.mode === 'allRandom' || state.subjects.length === 4 ? '전체 문제' : state.subjects.map(id => bank.chapters.find(c => c.id === id)?.title).filter(Boolean).join(' · ');
  const chapter = bank.chapters.find(c => String(c.id) === state.scope);
  if (chapter) return chapter.title;
  for (const c of bank.chapters) { const s = c.sections.find(x => x.id === state.scope); if (s) return s.title; }
  return '전체 문제';
}
function inScope(q) { return state.scope === 'all' ? (state.mode === 'allRandom' || state.subjects.includes(q.chapterId)) : String(q.chapterId) === state.scope || q.sectionId === state.scope; }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function buildIds(keepId) {
  if (isMock()) {
    if (!currentMock()) makeSet();
    ids = currentMock().ids;
  } else if (isReview()) {
    ids = currentMock().ids.filter(id => currentMock().answers[id] !== qById(id).answer);
  } else {
    ids = bank.questions.filter(q => inScope(q) && (state.mode !== 'wrong' || state.wrong[q.id])).map(q => q.id);
    if (['chapterRandom', 'allRandom'].includes(state.mode)) shuffle(ids);
  }
  cursor = Math.max(0, ids.indexOf(keepId));
  saveState(); render();
}
function changeScope(scope) {
  state.scope = scope;
  if (['allRandom', 'mock', 'review'].includes(state.mode)) state.mode = 'ordered';
  buildIds();
}
function changeMode(mode) {
  if (mode === 'allRandom' || mode === 'mock') state.scope = 'all';
  if (mode === 'allRandom') state.subjects = [1, 2, 3, 4];
  if (mode === 'mock' && !currentMock()) makeSet();
  state.mode = mode; buildIds();
}
function renderSetSelect() {
  const select = $('set-select'); select.replaceChildren();
  const completed = state.mockSets.filter(set => set.submitted);
  const average = completed.length ? Math.round(completed.reduce((sum, set) => sum + set.ids.filter(id => set.answers[id] === qById(id).answer).length * 3, 0) / completed.length) : null;
  const averageRate = completed.length ? Math.round(completed.reduce((sum, set) => sum + set.ids.filter(id => set.answers[id] === qById(id).answer).length / 20 * 100, 0) / completed.length) : null;
  $('mock-controls').querySelector('.exam-pack-heading span').textContent = `${completed.length}/7회 응시${average === null ? '' : ` · 평균 ${average}/60점 · 정답률 ${averageRate}%`}`;
  state.mockSets.forEach((set, i) => {
    const option = document.createElement('option'); option.value = String(i);
    option.textContent = `세트 ${i + 1}${set.submitted ? ' · 채점 완료' : ' · 진행 중'}`;
    select.append(option);
  });
  select.value = String(state.currentSet);
  const cards = $('round-cards'); cards.replaceChildren();
  state.mockSets.forEach((set, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'round-card' + (i === state.currentSet ? ' current' : '') + (set.submitted ? ' done' : '');
    const score = set.submitted ? set.ids.filter(id => set.answers[id] === qById(id).answer).length * 3 : null;
    b.innerHTML = `<strong>제${i + 1}회</strong><span>${set.submitted ? `${score} / 60점 · 정답률 ${Math.round(score / 60 * 100)}%` : `${Object.keys(set.answers).length} / 20 답변`}</span>`;
    b.onclick = () => { state.currentSet = i; buildIds(); };
    cards.append(b);
  });
}
function renderSubjects() {
  const root = $('subject-chips'); root.replaceChildren();
  bank.chapters.forEach(c => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'subject-chip' + (state.subjects.includes(c.id) ? ' active' : '');
    b.textContent = c.title; b.setAttribute('aria-pressed', String(state.subjects.includes(c.id)));
    b.onclick = () => {
      const next = state.subjects.includes(c.id) ? state.subjects.filter(x => x !== c.id) : [...state.subjects, c.id];
      if (!next.length) return;
      state.subjects = next; state.scope = 'all';
      if (['mock', 'allRandom'].includes(state.mode)) state.mode = 'chapterRandom';
      buildIds();
    }; root.append(b);
  });
}
function renderSidebar() {
  document.body.classList.toggle('exam-active', isMock() || isReview());
  $('mock-mode-btn').classList.toggle('active', isMock() || isReview());
  $('mix-mode-btn').classList.toggle('active', !isMock() && !isReview() && state.mode === 'chapterRandom');
  renderSubjects();
  const total = Object.keys(state.seen).length;
  $('progress-total').textContent = `${total} / ${bank.questions.length} 완료`;
  $('progress-bar').style.width = `${total / bank.questions.length * 100}%`;
  $('wrong-count').textContent = Object.keys(state.wrong).length;
  $('reset-wrong-btn').hidden = Object.keys(state.wrong).length === 0;
  $('shuffle-choices').checked = !!state.shuffleChoices;
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
  const q = question(), mock = isMock(), review = isReview(), submitted = mock && currentMock().submitted;
  selected = mock ? (currentMock().answers[q.id] || null) : null; revealed = !!submitted; explanationOpen = false;
  $('scope-label').textContent = mock ? `제${state.currentSet + 1}회 · 시험 모드` : review ? `제${state.currentSet + 1}회 · 오답 재풀이` : state.mode === 'wrong' ? '오답 복습' : state.mode === 'allRandom' ? '전체 랜덤' : state.mode === 'chapterRandom' ? '혼합 연습' : '순서대로 학습';
  $('scope-title').textContent = scopeTitle(); $('study-counter').textContent = `${cursor + 1} / ${ids.length}`;
  $('mock-intro').hidden = !mock;
  $('mock-controls').hidden = !mock;
  $('review-back-btn').hidden = !review;
  if (mock) renderSetSelect();
  $('question-number').textContent = mock ? `제${state.currentSet + 1}회 · ${cursor + 1}번 · 3점` : review ? `오답 ${cursor + 1}번 · Q${q.id}` : `Q${q.id}`;
  $('question-section').textContent = bank.chapters.flatMap(c => c.sections).find(s => s.id === q.sectionId)?.title || '';
  $('question-text').textContent = q.question;
  const list = $('choices'); list.replaceChildren();
  choiceOrder(q).map(label => q.choices.find(o => o.label === label)).forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.setAttribute('aria-pressed', String(o.label === selected));
    const l = document.createElement('span'); l.className = 'choice-label'; l.textContent = CIRCLED[i];
    const t = document.createElement('span'); t.textContent = o.text; b.append(l, t);
    if (o.label === selected && !submitted) b.classList.add('selected');
    if (submitted) { b.disabled = true; if (o.label === q.answer) b.classList.add('correct'); else if (o.label === selected) b.classList.add('incorrect'); }
    b.onclick = () => { if (revealed) return; selected = o.label; if (mock) { currentMock().answers[q.id] = selected; saveState(); renderSetSelect(); $('question-select').options[cursor].textContent = `${cursor + 1}번 · Q${q.id} · 저장`; } list.querySelectorAll('.choice').forEach(x => { x.classList.toggle('selected', x === b); x.setAttribute('aria-pressed', String(x === b)); }); $('check-btn').disabled = false; if (!mock) checkAnswer(); };
    list.append(b);
  });
  const jump = $('question-select'); jump.replaceChildren(); ids.forEach((id, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = mock ? `${i + 1}번 · Q${id}${currentMock().answers[id] ? ' · 저장' : ''}` : `Q${id}${state.seen[id] ? ' · 완료' : ''}`; jump.append(o); }); jump.value = String(cursor);
  $('answer-panel').hidden = !submitted; $('explanation').hidden = true; $('explain-btn').hidden = !submitted; $('explain-btn').textContent = '해설 보기';
  $('remove-wrong-btn').hidden = mock || review || !state.wrong[q.id];
  $('next-btn').hidden = cursor === ids.length - 1 || (!mock && !submitted);
  $('check-btn').hidden = true; $('check-btn').disabled = !selected;
  $('save-btn').hidden = true; $('save-btn').disabled = !selected;
  $('submit-btn').hidden = !mock || submitted;
  $('prev-btn').disabled = cursor === 0;
  $('mock-result').hidden = !submitted;
  if (submitted) {
    const correct = selected === q.answer, panel = $('answer-panel');
    panel.className = 'answer-panel ' + (correct ? 'good' : 'bad');
    panel.textContent = `${correct ? '정답입니다' : selected ? '오답입니다' : '미응답'} · 정답 ${shownLabel(q, q.answer)}`;
    renderMockResult();
  }
}
function checkAnswer() {
  if (!selected || revealed || isMock()) return;
  const q = question(), correct = selected === q.answer; revealed = true; state.seen[q.id] = true;
  if (correct) delete state.wrong[q.id]; else state.wrong[q.id] = true;
  saveState();
  $('choices').querySelectorAll('.choice').forEach((b, i) => { const label = choiceOrder(q)[i]; b.disabled = true; b.classList.remove('selected'); if (label === q.answer) b.classList.add('correct'); else if (label === selected) b.classList.add('incorrect'); });
  const panel = $('answer-panel'); panel.hidden = false; panel.className = 'answer-panel ' + (correct ? 'good' : 'bad'); panel.textContent = `${correct ? '정답입니다' : '오답입니다'} · 정답 ${shownLabel(q, q.answer)}`;
  $('check-btn').hidden = true; $('explain-btn').hidden = false; $('next-btn').hidden = cursor === ids.length - 1;
  $('remove-wrong-btn').hidden = isReview() || !state.wrong[q.id];
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
  const title = document.createElement('h2'); title.textContent = `제${state.currentSet + 1}회 결과 · ${score * 3} / 60점`;
  const detail = document.createElement('p'); detail.textContent = `정답 ${score}/20 · 정답률 ${Math.round(score / 20 * 100)}% · 틀리거나 건너뛴 문제를 선택해 정답과 해설을 확인하세요.`;
  const breakdown = document.createElement('div'); breakdown.className = 'subject-results';
  [[2, '법규'], [1, '가스개론'], [4, '사고분석'], [3, '가스설비']].forEach(([chapter, name]) => {
    const subjectIds = ids.filter(id => qById(id).chapterId === chapter);
    const correct = subjectIds.filter(id => currentMock().answers[id] === qById(id).answer).length;
    const card = document.createElement('div'); card.className = 'subject-result';
    card.innerHTML = `<strong>${correct}/${subjectIds.length}</strong><span>${name} · ${correct * 3}/${subjectIds.length * 3}점</span>`;
    breakdown.append(card);
  });
  const list = document.createElement('div'); list.className = 'result-grid';
  ids.forEach((id, i) => { const b = document.createElement('button'); b.type = 'button'; const ok = currentMock().answers[id] === qById(id).answer; b.className = 'result-item ' + (ok ? 'pass' : 'fail'); b.textContent = `${i + 1}번 ${ok ? '✓' : '×'}`; b.setAttribute('aria-label', `${i + 1}번 ${ok ? '정답' : '오답 또는 미응답'}`); b.onclick = () => { cursor = i; render(); $('question-text').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; list.append(b); });
  box.append(title, detail, breakdown, list);
  if (score < 20) {
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'primary-btn retry-round';
    retry.textContent = `이 회차 오답 ${20 - score}문제 다시 풀기`;
    retry.onclick = () => { state.mode = 'review'; buildIds(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    box.append(retry);
  }
}
function next() { if (cursor < ids.length - 1) { cursor++; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => { if (b.dataset.mode === 'mock' && isMock() && currentMock() && !currentMock().submitted) { cursor = 0; render(); return; } changeMode(b.dataset.mode); });
$('mock-mode-btn').onclick = () => changeMode('mock');
$('mix-mode-btn').onclick = () => { state.scope = 'all'; changeMode('chapterRandom'); };
$('filter-toggle').onclick = () => { const open = $('sidebar').classList.toggle('open'); $('filter-toggle').textContent = open ? '필터 닫기' : '필터 열기'; $('filter-toggle').setAttribute('aria-expanded', String(open)); };
$('theme-btn').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : ''; try { localStorage.setItem('gas-theme', dark ? 'dark' : 'light'); } catch {} };
$('info-btn').onclick = () => $('info-dialog').showModal();
$('info-close').onclick = () => $('info-dialog').close();
$('version-btn').onclick = () => $('version-dialog').showModal();
$('version-close').onclick = () => $('version-dialog').close();
$('check-btn').onclick = checkAnswer;
$('save-btn').onclick = saveMockAnswer;
$('submit-btn').onclick = submitMock;
$('set-select').onchange = e => { state.currentSet = Number(e.target.value); cursor = 0; buildIds(); };
$('new-set-btn').onclick = () => { if (confirm('7회 모의고사 문제 배치와 답안·성적을 모두 지우고 다시 섞을까요?')) { makeSet(); cursor = 0; buildIds(); } };
$('review-back-btn').onclick = () => { state.mode = 'mock'; buildIds(); };
$('shuffle-choices').onchange = e => { state.shuffleChoices = e.target.checked; state.practiceOrders = {}; saveState(); if (!isMock() && !isReview()) render(); };
$('remove-wrong-btn').onclick = () => {
  const id = question().id; delete state.wrong[id]; saveState();
  if (state.mode === 'wrong') buildIds(ids[cursor + 1] || ids[cursor - 1]);
  else { $('remove-wrong-btn').hidden = true; renderSidebar(); }
};
$('reset-wrong-btn').onclick = () => {
  if (!confirm(`오답노트 ${Object.keys(state.wrong).length}문제를 모두 지울까요?`)) return;
  state.wrong = {}; saveState();
  if (state.mode === 'wrong') buildIds(); else { $('remove-wrong-btn').hidden = true; renderSidebar(); }
};
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || !bank || !ids.length) return;
  if (/^[1-4]$/.test(e.key)) { e.preventDefault(); $('choices').querySelectorAll('.choice')[Number(e.key) - 1]?.click(); }
  else if (e.key.toLowerCase() === 'n') { e.preventDefault(); if (!$('next-btn').hidden) next(); }
  else if (e.key.toLowerCase() === 'a' && !$('explain-btn').hidden) { e.preventDefault(); $('explain-btn').click(); }
});
$('explain-btn').onclick = () => { if (!revealed) return; explanationOpen = !explanationOpen; $('explanation').hidden = !explanationOpen; $('explanation').textContent = shownExplanation(question()); $('explain-btn').textContent = explanationOpen ? '해설 닫기' : '해설 보기'; };
$('next-btn').onclick = next;
$('prev-btn').onclick = () => { if (cursor > 0) { cursor--; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
$('question-select').onchange = e => { cursor = Number(e.target.value); render(); };
$('empty-back').onclick = () => { state.scope = 'all'; changeMode('ordered'); };
fetch('./가스사용시설안전관리자_문제은행.json').then(r => { if (!r.ok) throw Error(r.status); return r.json(); }).then(data => {
  bank = data; state = readState();
  state.shuffleChoices = !!state.shuffleChoices;
  if (!state.practiceOrders || typeof state.practiceOrders !== 'object') state.practiceOrders = {};
  try { document.documentElement.dataset.theme = localStorage.getItem('gas-theme') === 'dark' ? 'dark' : ''; } catch {}
  if (!Array.isArray(state.subjects) || !state.subjects.length) state.subjects = [1, 2, 3, 4];
  if (!Array.isArray(state.mockSets)) state.mockSets = [];
  if (state.mockSets.length !== 7) state.mockSets = [];
  else {
    state.mockSets = state.mockSets.filter(set => Array.isArray(set.ids) && set.ids.length === 20 && set.answers && typeof set.answers === 'object');
    state.mockSets.forEach(set => { set.shuffleChoices = !!set.shuffleChoices; set.choiceOrders ||= {}; });
    const allIds = state.mockSets.flatMap(set => set.ids);
    if (allIds.length !== 140 || new Set(allIds).size !== 140) state.mockSets = [];
  }
  if (!Number.isInteger(state.currentSet) || state.currentSet < 0 || state.currentSet >= state.mockSets.length) state.currentSet = Math.max(0, state.mockSets.length - 1);
  if (state.mode === 'random') state.mode = 'chapterRandom';
  if (!['ordered', 'chapterRandom', 'allRandom', 'wrong', 'mock', 'review'].includes(state.mode)) state.mode = 'ordered';
  if (state.mode === 'review' && (!currentMock() || !currentMock().submitted)) state.mode = 'ordered';
  if (state.scope !== 'all' && !bank.chapters.some(c => String(c.id) === state.scope || c.sections.some(s => s.id === state.scope))) state.scope = 'all';
  if (['allRandom', 'mock', 'review'].includes(state.mode)) state.scope = 'all';
  $('loading').hidden = true; buildIds();
}).catch(() => { $('loading').hidden = true; $('error').hidden = false; });
