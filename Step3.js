const stl = document.createElement('style');
stl.textContent = `select{width:100%;padding:12px;border:1px solid #c7d9f5;border-radius:12px;font-size:16px;margin:6px 0;background:#fff;color:#12263f}
.qa{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.qi{background:#fff;border:1px solid #dbe7fb;border-radius:16px;padding:14px;margin-bottom:10px}
.qi p{margin:6px 0;font-size:15px;line-height:1.4}
.chip{display:inline-block;background:#e8f1fd;color:#1e5bd8;border-radius:12px;padding:3px 10px;font-size:12px;margin:2px 4px 2px 0}
.opt{display:block;width:100%;text-align:left;background:#fff;border:1.5px solid #c7d9f5;border-radius:14px;padding:13px;font-size:15px;margin:8px 0;color:#12263f}
.opt.ok{background:#e6f6ec;border-color:#2e9e5b}.opt.bad{background:#fdeaea;border-color:#d64545}
.res{border-radius:14px;padding:12px;margin:12px 0;font-weight:700}.res.ok{background:#e6f6ec;color:#16653a}.res.bad{background:#fdeaea;color:#a12525}
.ex{background:#f4f8ff;border-radius:14px;padding:12px;margin:10px 0;font-size:14px;line-height:1.5}.ex b{color:#1e5bd8;display:block;margin-bottom:4px}
.wm{position:fixed;inset:-30%;pointer-events:none;z-index:5;display:flex;flex-wrap:wrap;align-content:space-around;justify-content:space-around;opacity:.06;font-weight:700;font-size:20px;transform:rotate(-25deg)}`;
document.head.appendChild(stl);

Object.assign(T.en, {search:'Search question or category', allcat:'All categories', alldiff:'All levels', easy:'Easy', medium:'Medium', hard:'Hard',
  loadmore:'Load more', noq:'No questions found.', loading:'Loading...', correct:'Correct', wrong:'Incorrect', correct_ans:'Correct Answer',
  expl_en:'English Explanation', expl_bn:'Bangla Explanation', next_q:'Next Question', bookmark:'Bookmark', bookmarked:'Bookmarked',
  backlist:'Back to list', gobm:'Bookmarks', gobank:'Question Bank', nobm:'No bookmarks yet.', qof:'Question'});
Object.assign(T.bn, {search:'প্রশ্ন বা ক্যাটাগরি খুঁজুন', allcat:'সব ক্যাটাগরি', alldiff:'সব স্তর', easy:'সহজ', medium:'মাঝারি', hard:'কঠিন',
  loadmore:'আরও দেখুন', noq:'কোনো প্রশ্ন পাওয়া যায়নি।', loading:'লোড হচ্ছে...', correct:'সঠিক', wrong:'ভুল', correct_ans:'সঠিক উত্তর',
  expl_en:'ইংরেজি ব্যাখ্যা', expl_bn:'বাংলা ব্যাখ্যা', next_q:'পরবর্তী প্রশ্ন', bookmark:'বুকমার্ক', bookmarked:'বুকমার্ক করা হয়েছে',
  backlist:'তালিকায় ফিরুন', gobm:'বুকমার্ক', gobank:'প্রশ্ন ব্যাংক', nobm:'এখনো কোনো বুকমার্ক নেই।', qof:'প্রশ্ন'});

const Q = {items:[], page:0, more:false, loading:false, tok:0, search:'', cat:'', diff:'', mode:'questions', cur:null, sel:null, res:null, busy:false, bm:new Set(), cats:[], init:false};

async function qInit() {
  if (Q.init) return; Q.init = true;
  const [c, b] = await Promise.all([
    sb.from('categories').select('id,name_en,name_bn').eq('is_active', true).order('sort_order'),
    sb.from('bookmarks').select('question_id')]);
  Q.cats = c.data || []; Q.bm = new Set((b.data || []).map(x => x.question_id));
}

async function qLoad(reset) {
  if (!reset && Q.loading) return;
  if (reset) { Q.items = []; Q.page = 0; }
  const tok = ++Q.tok; Q.loading = true; render();
  const from = Q.page * 20;
  let qb = sb.from('questions').select('id,question_code,question_text,option_a,option_b,option_c,option_d,image_url,difficulty,category_id')
    .eq('is_active', true).order('question_code').range(from, from + 19);
  if (Q.mode === 'bookmarks') {
    const ids = [...Q.bm];
    if (!ids.length) { Q.loading = false; Q.more = false; render(); return; }
    qb = qb.in('id', ids);
  }
  if (Q.cat) qb = qb.eq('category_id', Q.cat);
  if (Q.diff) qb = qb.eq('difficulty', Q.diff);
  const s = Q.search.replace(/[,()%*\\]/g, ' ').trim();
  if (s) {
    const cids = Q.cats.filter(c => (c.name_en + ' ' + (c.name_bn || '')).toLowerCase().includes(s.toLowerCase())).map(c => c.id);
    qb = qb.or('question_text.ilike.%' + s + '%' + (cids.length ? ',category_id.in.(' + cids.join(',') + ')' : ''));
  }
  const r = await qb;
  if (tok !== Q.tok) return;
  Q.loading = false;
  const d = r.data || [];
  Q.items = Q.items.concat(d); Q.more = d.length === 20; Q.page++;
  render();
}

const catName = id => { const c = Q.cats.find(x => x.id === id); return c ? (lang === 'bn' && c.name_bn ? c.name_bn : c.name_en) : ''; };
const qSearch = v => { Q.search = v; qLoad(true); };
const qCat = v => { Q.cat = v; qLoad(true); };
const qDiff = v => { Q.diff = v; qLoad(true); };
const qMore = () => qLoad(false);
const qOpen = i => { Q.cur = i; Q.sel = null; Q.res = null; render(); window.scrollTo(0, 0); };
const qBack = () => { Q.cur = null; render(); };
const qSwitch = m => { Q.mode = m; S.tab = m; Q.cur = null; qLoad(true); };

function qList() {
  const bm = Q.mode === 'bookmarks';
  const cats = Q.cats.map(c => `<option value="${c.id}" ${Q.cat === c.id ? 'selected' : ''}>${esc(lang === 'bn' && c.name_bn ? c.name_bn : c.name_en)}</option>`).join('');
  const diffs = ['easy', 'medium', 'hard'].map(d => `<option value="${d}" ${Q.diff === d ? 'selected' : ''}>${t(d)}</option>`).join('');
  const items = Q.items.map((q, i) => `<div class="qi qa" onclick="qOpen(${i})"><span class="chip">${esc(q.question_code)}</span>${catName(q.category_id) ? `<span class="chip">${esc(catName(q.category_id))}</span>` : ''}<span class="chip">${t(q.difficulty)}</span>${Q.bm.has(q.id) ? ' 🔖' : ''}<p>${esc(q.question_text.length > 140 ? q.question_text.slice(0, 140) + '…' : q.question_text)}</p></div>`).join('');
  return `<h2 style="margin:4px 0 10px">${bm ? t('bm') : t('qb')}</h2>
  <button class="btn alt" style="margin:0 0 8px" onclick="qSwitch('${bm ? 'questions' : 'bookmarks'}')">${bm ? '📚 ' + t('gobank') : '🔖 ' + t('gobm')}</button>
  <input placeholder="${t('search')}" value="${esc(Q.search)}" onchange="qSearch(this.value)">
  <select onchange="qCat(this.value)"><option value="">${t('allcat')}</option>${cats}</select>
  <select onchange="qDiff(this.value)"><option value="">${t('alldiff')}</option>${diffs}</select>
  <div style="margin-top:10px">${items}
  ${Q.loading ? `<p style="text-align:center;color:#5b6b82">${t('loading')}</p>` : ''}
  ${!Q.loading && !Q.items.length ? `<p style="text-align:center;color:#5b6b82">${bm ? t('nobm') : t('noq')}</p>` : ''}
  ${Q.more && !Q.loading ? `<button class="btn alt" onclick="qMore()">${t('loadmore')}</button>` : ''}</div>`;
}

function qPractice() {
  const q = Q.items[Q.cur], r = Q.res, L = ['A', 'B', 'C', 'D'];
  const txt = {A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d};
  const opts = L.map(l => {
    let cls = 'opt';
    if (r) cls += l === r.correct_option ? ' ok' : (l === Q.sel ? ' bad' : '');
    return `<button class="${cls}" ${r || Q.busy ? 'disabled' : ''} onclick="qPick('${l}')"><b>${l}.</b> ${esc(txt[l])}</button>`;
  }).join('');
  const wm = Array(10).fill(`<span>${esc(S.profile.user_code)}</span>`).join('');
  const result = r ? `<div class="res ${r.is_correct ? 'ok' : 'bad'}">${r.is_correct ? '✓ Correct / সঠিক' : '✗ Incorrect / ভুল'}</div>
    <p><b>${t('correct_ans')}:</b> ${r.correct_option}. ${esc(txt[r.correct_option])}</p>
    <div class="ex"><b>${t('expl_en')}</b>${esc(r.explanation_en || '-')}</div>
    <div class="ex"><b>${t('expl_bn')}</b>${esc(r.explanation_bn || '-')}</div>
    <button class="btn" onclick="qNext()">${t('next_q')} →</button>` : '';
  return `<div class="wm">${wm}</div><div class="qa">
  <button class="link" style="margin:0" onclick="qBack()">← ${t('backlist')}</button>
  <p style="color:#5b6b82;font-size:13px">${t('qof')} ${Q.cur + 1}/${Q.items.length} · ${esc(q.question_code)}</p>
  <h3 style="line-height:1.4">${esc(q.question_text)}</h3>
  ${q.image_url ? `<img src="${esc(q.image_url)}" style="max-width:100%;border-radius:12px">` : ''}
  ${opts}${result}
  <button class="btn alt" onclick="qBm('${q.id}')">🔖 ${Q.bm.has(q.id) ? t('bookmarked') : t('bookmark')}</button></div>`;
}

async function qPick(l) {
  if (Q.res || Q.busy) return;
  const q = Q.items[Q.cur]; Q.sel = l; Q.busy = true; render();
  const { data, error } = await sb.rpc('submit_practice_answer', { p_question_id: q.id, p_selected: l });
  Q.busy = false;
  if (error) { Q.sel = null; alert(error.message); render(); return; }
  Q.res = data; render();
  sb.rpc('my_stats').then(x => { if (x.data) S.stats = x.data; });
}

async function qNext() {
  if (Q.cur + 1 < Q.items.length) return qOpen(Q.cur + 1);
  if (Q.more) { await qLoad(false); if (Q.cur + 1 < Q.items.length) return qOpen(Q.cur + 1); }
  Q.cur = null; render();
}

async function qBm(id) {
  const uid = S.profile.id;
  if (Q.bm.has(id)) { await sb.from('bookmarks').delete().eq('user_id', uid).eq('question_id', id); Q.bm.delete(id); }
  else { const { error } = await sb.from('bookmarks').insert({ user_id: uid, question_id: id }); if (!error) Q.bm.add(id); }
  render();
}

const _shell = shell;
shell = function () {
  const h = _shell();
  if (S.tab !== 'questions' && S.tab !== 'bookmarks') return h;
  const i = h.indexOf('<nav>');
  return `<div class="page">${Q.cur !== null ? qPractice() : qList()}</div>` + h.slice(i);
};
const _go = go;
go = function (tab) {
  Q.cur = null;
  _go(tab);
  if (tab === 'questions' || tab === 'bookmarks') { Q.mode = tab; qInit().then(() => qLoad(true)); }
};
const _logout = doLogout;
doLogout = async function () { Q.init = false; Q.items = []; Q.bm = new Set(); Q.cur = null; await _logout(); };
