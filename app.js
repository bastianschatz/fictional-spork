/* ===== Lernteufel — App-Logik ===== */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = document.documentElement;

  // ---------- Theme ----------
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    $('theme-toggle').textContent = t === 'dark' ? '🌙' : '☀️';
    try { localStorage.setItem('lernteufel:theme', t); } catch (e) {}
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = t === 'dark' ? '#16181F' : '#F4F5F8';
  }
  (function initTheme() {
    let t;
    try { t = localStorage.getItem('lernteufel:theme'); } catch (e) {}
    if (!t) t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(t);
  })();
  $('theme-toggle').addEventListener('click', () =>
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));

  // ---------- Data ----------
  const uid = () => 'x' + Math.random().toString(36).slice(2, 9);
  let decks = load();
  let current = null;          // current deck id (edit/study)
  let prevView = 'home';       // where to return from the game

  function load() {
    try { const d = JSON.parse(localStorage.getItem('lernteufel:decks')); if (Array.isArray(d) && d.length) return d; } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem('lernteufel:decks', JSON.stringify(decks)); } catch (e) {} }
  function seed() {
    return [{
      id: uid(), name: 'Beispiel: Hauptstädte',
      cards: [
        { id: uid(), front: 'Hauptstadt von Frankreich?', back: 'Paris' },
        { id: uid(), front: 'Hauptstadt von Japan?', back: 'Tokio' },
        { id: uid(), front: 'Hauptstadt von Australien?', back: 'Canberra' },
        { id: uid(), front: 'Hauptstadt von Kanada?', back: 'Ottawa' },
        { id: uid(), front: 'Hauptstadt von Brasilien?', back: 'Brasília' },
      ],
    }];
  }
  const getDeck = id => decks.find(d => d.id === id);

  // ---------- Navigation ----------
  const views = ['home', 'study', 'edit', 'game'];
  function show(v) {
    views.forEach(name => $('view-' + name).classList.toggle('hidden', name !== v));
  }

  // ---------- Home ----------
  function renderHome() {
    const list = $('deck-list'); list.innerHTML = '';
    decks.forEach(d => {
      const el = document.createElement('div'); el.className = 'deck';
      el.innerHTML =
        `<div class="deck-top"><span class="deck-name"></span><span class="deck-count">${d.cards.length} Karten</span></div>`;
      el.querySelector('.deck-name').textContent = d.name || 'Unbenannt';
      el.addEventListener('click', () => openEdit(d.id));
      list.appendChild(el);
    });
    show('home');
  }
  $('new-deck').addEventListener('click', () => {
    const d = { id: uid(), name: 'Neues Deck', cards: [] };
    decks.push(d); save(); openEdit(d.id);
  });

  // ---------- Editor ----------
  function openEdit(id) {
    current = id; const d = getDeck(id);
    $('deck-name').value = d.name;
    renderCardEdits(); show('edit');
  }
  function renderCardEdits() {
    const d = getDeck(current); const wrap = $('card-edit-list'); wrap.innerHTML = '';
    if (!d.cards.length) { wrap.innerHTML = '<div class="empty">Noch keine Karten. Füg deine erste hinzu.</div>'; }
    d.cards.forEach(c => {
      const el = document.createElement('div'); el.className = 'card-edit';
      el.innerHTML =
        `<div class="row">
           <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
             <textarea class="field" style="margin:0;" placeholder="Vorderseite (Frage)"></textarea>
             <textarea class="field" style="margin:0;" placeholder="Rückseite (Antwort)"></textarea>
           </div>
           <button class="del" aria-label="Karte löschen">🗑</button>
         </div>`;
      const [f, b] = el.querySelectorAll('textarea');
      f.value = c.front; b.value = c.back;
      f.addEventListener('input', () => { c.front = f.value; save(); });
      b.addEventListener('input', () => { c.back = b.value; save(); });
      el.querySelector('.del').addEventListener('click', () => {
        d.cards = d.cards.filter(x => x.id !== c.id); save(); renderCardEdits();
      });
      wrap.appendChild(el);
    });
  }
  $('deck-name').addEventListener('input', e => { getDeck(current).name = e.target.value; save(); });
  $('add-card').addEventListener('click', () => {
    getDeck(current).cards.push({ id: uid(), front: '', back: '' }); save(); renderCardEdits();
    const ta = $('card-edit-list').querySelector('.card-edit:last-child textarea'); if (ta) ta.focus();
  });
  $('delete-deck').addEventListener('click', () => {
    if (!confirm('Dieses Deck wirklich löschen?')) return;
    decks = decks.filter(d => d.id !== current); if (!decks.length) decks = seed();
    save(); renderHome();
  });
  $('edit-back').addEventListener('click', renderHome);
  $('edit-study').addEventListener('click', () => startSession(current));

  // ---------- Study session ----------
  let queue = [], cur = null, total = 0, knownCount = 0, flipped = false;
  function startSession(id) {
    current = id; const d = getDeck(id);
    const cards = d.cards.filter(c => (c.front || '').trim() || (c.back || '').trim());
    if (!cards.length) { alert('Dieses Deck hat noch keine Karten.'); return openEdit(id); }
    queue = shuffle(cards.slice()); total = queue.length; knownCount = 0;
    $('study-end').classList.add('hidden'); $('study-body').classList.remove('hidden');
    show('study'); nextCard();
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; }
  function nextCard() {
    flipped = false; $('flip').classList.remove('flipped');
    $('answer-row').style.visibility = 'hidden';
    if (!queue.length) return endSession();
    cur = queue[0];
    $('card-front').textContent = cur.front || '—';
    $('card-back').textContent = cur.back || '—';
    const done = total - queue.length;
    $('study-counter').textContent = (done + 1) + ' / ' + total;
    $('study-progress').style.width = (done / total * 100) + '%';
  }
  $('flip').addEventListener('click', () => {
    flipped = !flipped; $('flip').classList.toggle('flipped', flipped);
    if (flipped) $('answer-row').style.visibility = 'visible';
  });
  $('known').addEventListener('click', () => { knownCount++; queue.shift(); nextCard(); });
  $('again').addEventListener('click', () => { const c = queue.shift(); queue.push(c); nextCard(); });
  function endSession() {
    $('study-body').classList.add('hidden');
    $('study-progress').style.width = '100%';
    $('end-stats').textContent = `${knownCount} von ${total} auf Anhieb gewusst.`;
    $('study-end').classList.remove('hidden');
  }
  $('study-back').addEventListener('click', () => openEdit(current));
  $('restart-session').addEventListener('click', () => startSession(current));
  $('end-home').addEventListener('click', renderHome);

  // ---------- Game wiring ----------
  LevelDevil.setup({
    canvas: $('game-canvas'),
    levelEl: $('g-level'), deathsEl: $('g-deaths'),
    overlay: $('game-overlay'), ovTitle: $('ov-title'), ovText: $('ov-text'), ovBtn: $('ov-btn'),
    touchWrap: $('touch-controls'),
    tcLeft: $('tc-left'), tcRight: $('tc-right'), tcJump: $('tc-jump'),
    onExit: () => { show(prevView); },
  });
  function openGame(from) {
    prevView = from; show('game'); LevelDevil.start();
  }
  $('home-devil').addEventListener('click', () => openGame('home'));
  $('study-devil').addEventListener('click', () => openGame('study'));
  $('game-back').addEventListener('click', () => { LevelDevil.stop(); show(prevView); });

  // ---------- boot ----------
  save(); renderHome();

  // ---------- service worker ----------
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
