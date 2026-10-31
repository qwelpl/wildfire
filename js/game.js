(() => {
  const DATA = window.WILDFIRE_BOARDS;
  const WORDS = new Set(window.WILDFIRE_WORDS.split(' '));
  const SIZE = 5;
  const N = SIZE * SIZE;
  const FULL = 2 ** N - 1;
  const DAY = 86400000;
  // Progress is not kept between page loads for now.
  const KEEP_PROGRESS = false;

  const $ = (id) => document.getElementById(id);
  const els = {
    board: $('board'), word: $('word'), gain: $('gain'), msg: $('msg'),
    number: $('number'), date: $('date'), tally: $('tally'), prev: $('prev'), next: $('next'),
    hint: $('hint'), undo: $('undo'), played: $('played'), help: $('help'), done: $('done'),
  };

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const startUtc = Date.parse(`${DATA.start}T00:00:00Z`);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIndex = Math.max(0, Math.floor((todayUtc - startUtc) / DAY));

  const NEIGHBORS = Array.from({ length: N }, (_, i) => {
    const r = Math.floor(i / SIZE), c = i % SIZE, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
    return out;
  });
  const touching = (a, b) => NEIGHBORS[a].includes(b);
  const bit = (i) => 2 ** i;
  const has = (mask, i) => Math.floor(mask / bit(i)) % 2 === 1;
  const maskOf = (path) => path.reduce((m, i) => (has(m, i) ? m : m + bit(i)), 0);
  const count = (mask) => { let n = 0; for (let i = 0; i < N; i++) if (has(mask, i)) n++; return n; };
  const overlap = (a, b) => { for (let i = 0; i < N; i++) if (has(a, i) && has(b, i)) return true; return false; };
  const newTiles = (path, burned) => path.filter((i) => !has(burned, i));

  // Familiar words only, so hints point at words people know.
  const trie = {};
  for (const w of window.WILDFIRE_COMMON.split(' ')) {
    let node = trie;
    for (const ch of w) node = node[ch] ??= {};
    node.$ = w;
  }

  let index, board, state, moves;
  let path = [];
  let hintLevel = 0;
  let msgTimer;
  const tiles = [];

  function load(i) {
    index = i;
    const b = DATA.boards[i % DATA.boards.length];
    board = { letters: [...b.grid], fire: b.fire, par: b.par, line: b.line };
    const saved = KEEP_PROGRESS ? store.get(`wildfire:${i}`, null) : null;
    state = saved && Array.isArray(saved.played)
      ? saved
      : { played: [], hints: 0, done: false };
    moves = findMoves();
    path = [];
    hintLevel = 0;
    els.word.className = '';
    say('');
    tiles.forEach((t, k) => { t.textContent = board.letters[k]; t.className = 'tile'; });
    render();
  }

  function save() {
    store.set(`wildfire:${index}`, state);
  }

  const burned = () => state.played.reduce((m, p) => m | maskOf(p.path), bit(board.fire)) >>> 0;
  const finished = () => state.done;

  // Every familiar word on the board, with the tiles each spelling uses.
  function findMoves() {
    const found = [];
    const walk = (i, node, trail) => {
      const next = node[board.letters[i]];
      if (!next) return;
      trail.push(i);
      if (next.$) found.push({ word: next.$, path: [...trail] });
      for (const j of NEIGHBORS[i]) if (!trail.includes(j)) walk(j, next, trail);
      trail.pop();
    };
    for (let i = 0; i < N; i++) walk(i, trie, []);
    return found;
  }

  // Rendering

  function buildBoard() {
    for (let i = 0; i < N; i++) {
      const t = document.createElement('button');
      t.className = 'tile';
      t.dataset.i = i;
      t.tabIndex = -1;
      t.addEventListener('animationend', () => t.classList.remove('catching', 'cue'));
      tiles.push(t);
      els.board.append(t);
    }
  }

  function render() {
    const date = new Date(startUtc + index * DAY);
    els.number.textContent = `No. ${index + 1}`;
    els.date.textContent = date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    els.prev.disabled = index === 0;
    els.next.disabled = index >= todayIndex;

    const lit = burned();
    const hints = state.hints ? ` · ${state.hints === 1 ? '1 hint' : `${state.hints} hints`}` : '';
    els.tally.textContent = `${count(lit)}/${N} · par ${board.par}${hints}`;

    tiles.forEach((t, i) => {
      t.classList.toggle('burned', has(lit, i));
      t.classList.toggle('sel', path.includes(i));
      t.classList.toggle('end', path.length > 1 && i === path[path.length - 1]);
      t.setAttribute('aria-label', `${board.letters[i]}${has(lit, i) ? ', burning' : ''}`);
    });

    if (path.length) {
      els.word.className = '';
      els.word.textContent = path.map((i) => board.letters[i]).join('');
      const fresh = newTiles(path, lit).length;
      els.gain.textContent = path.some((i) => has(lit, i)) && fresh ? `+${fresh}` : '';
    } else if (!els.word.classList.contains('bad')) {
      els.word.textContent = '';
      els.gain.textContent = '';
    }

    els.played.replaceChildren(...state.played.map((p) => {
      const li = document.createElement('li');
      li.textContent = p.word;
      const s = document.createElement('span');
      s.textContent = `+${p.gained}`;
      li.append(s);
      return li;
    }));

    els.undo.disabled = finished() || !state.played.length;
    els.hint.disabled = finished();
  }

  function say(text, warn = false, sticky = false) {
    clearTimeout(msgTimer);
    els.msg.textContent = text;
    els.msg.className = warn ? 'warn' : '';
    if (text && !sticky) msgTimer = setTimeout(() => { els.msg.textContent = ''; }, 2600);
  }

  function shake() {
    els.board.classList.remove('shake');
    void els.board.offsetWidth;
    els.board.classList.add('shake');
  }
  els.board.addEventListener('animationend', (e) => {
    if (e.target === els.board) els.board.classList.remove('shake');
  });

  // Spelling

  function tap(i) {
    if (finished()) return;
    const last = path[path.length - 1];
    if (i === last) return submit();
    const at = path.indexOf(i);
    if (at >= 0) path = path.slice(0, at + 1);
    else if (path.length && touching(last, i)) path.push(i);
    else path = [i];
    els.word.classList.remove('bad');
    render();
  }

  function extend(i) {
    const last = path[path.length - 1];
    if (i === last) return;
    if (i === path[path.length - 2]) path.pop();
    else if (!path.includes(i) && touching(last, i)) path.push(i);
    else return;
    render();
  }

  function clear() {
    path = [];
    render();
  }

  function reject(text) {
    els.word.textContent = path.map((i) => board.letters[i]).join('');
    els.word.className = 'bad';
    els.gain.textContent = '';
    path = [];
    shake();
    say(text, true);
    render();
  }

  function submit() {
    if (finished() || !path.length) return;
    tiles.forEach((t) => t.classList.remove('cue'));
    const word = path.map((i) => board.letters[i]).join('');
    const lit = burned();
    if (word.length < 3) return reject('Three letters or more.');
    if (!WORDS.has(word)) return reject(`${word} isn't in the word list.`);
    if (!path.some((i) => has(lit, i))) return reject('Use at least one tile that’s on fire.');
    const fresh = newTiles(path, lit);
    if (!fresh.length) return reject('Nothing new would catch.');
    if (state.played.some((p) => p.word === word)) return reject(`Already played ${word}.`);

    state.played.push({ word, path: [...path], gained: fresh.length });
    path = [];
    hintLevel = 0;
    els.word.className = '';
    say('');
    if (burned() === FULL) {
      state.done = true;
      recordWin();
    }
    save();
    render();
    fresh.forEach((i, k) => {
      tiles[i].style.animationDelay = `${k * 60}ms`;
      tiles[i].classList.add('catching');
    });
    if (finished()) setTimeout(showDone, 1100);
  }

  function undo() {
    if (finished() || !state.played.length) return;
    state.played.pop();
    path = [];
    hintLevel = 0;
    save();
    say('');
    render();
  }

  // The move that burns the most new tiles, preferring shorter words.
  function bestMove() {
    const lit = burned();
    let best = null;
    for (const m of moves) {
      if (state.played.some((p) => p.word === m.word)) continue;
      if (!m.path.some((i) => has(lit, i))) continue;
      const gain = newTiles(m.path, lit).length;
      if (!gain) continue;
      if (!best || gain > best.gain || (gain === best.gain && m.word.length < best.word.length)) {
        best = { ...m, gain };
      }
    }
    return best;
  }

  function hint() {
    if (finished()) return;
    const m = bestMove();
    if (!m) {
      say('No familiar word fits from here. Try undo.', true);
      return;
    }
    state.hints++;
    hintLevel++;
    if (hintLevel === 1) {
      path = [];
      render();
      const t = tiles[m.path[0]];
      t.classList.remove('cue');
      void t.offsetWidth;
      t.classList.add('cue');
      say(`Try a ${m.word.length}-letter word starting at the marked tile.`, false, true);
    } else {
      tiles.forEach((t) => t.classList.remove('cue'));
      path = [...m.path];
      render();
      say(`${m.word} burns ${m.gain} new. Tap the word to play it.`, false, true);
    }
    save();
  }

  // Pointer input: drag to spell and release to play, or tap tile by tile.

  let drag = null;

  function tileAt(x, y) {
    const el = document.elementFromPoint(x, y)?.closest('.tile');
    if (!el) return null;
    // Only count the middle of a tile so diagonals are easy to hit.
    const r = el.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    return Math.hypot(dx, dy) < r.width * 0.42 ? Number(el.dataset.i) : null;
  }

  els.board.addEventListener('pointerdown', (e) => {
    if (finished() || e.button > 0) return;
    const i = tileAt(e.clientX, e.clientY);
    if (i === null) return;
    e.preventDefault();
    els.board.setPointerCapture(e.pointerId);
    drag = { start: i, moved: false };
  });

  els.board.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const i = tileAt(e.clientX, e.clientY);
    if (i === null) return;
    if (!drag.moved) {
      if (i === drag.start) return;
      drag.moved = true;
      if (path[path.length - 1] !== drag.start) path = [drag.start];
      els.word.classList.remove('bad');
    }
    extend(i);
  });

  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (e.type === 'pointercancel') return;
    if (d.moved) submit();
    else tap(d.start);
  };
  els.board.addEventListener('pointerup', endDrag);
  els.board.addEventListener('pointercancel', endDrag);

  // Results

  function stats() {
    return store.get('wildfire:stats', { played: 0, par: 0, streak: 0, best: 0, last: null });
  }

  function recordWin() {
    if (index !== todayIndex) return;
    const s = stats();
    if (s.last === index) return;
    s.played++;
    if (state.played.length <= board.par) s.par++;
    s.streak = s.last === index - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.last = index;
    store.set('wildfire:stats', s);
  }

  function resultText() {
    const n = state.played.length;
    const h = state.hints ? ` · ${state.hints === 1 ? '1 hint' : `${state.hints} hints`}` : '';
    const url = location.protocol.startsWith('http') ? `\n${location.origin}${location.pathname}` : '';
    return `Wildfire No. ${index + 1}\n${n} words · par ${board.par}${h}${url}`;
  }

  function showDone() {
    const n = state.played.length;
    const diff = n - board.par;
    $('done-title').textContent = diff < 0 ? 'Under par' : diff === 0 ? 'On par' : 'Burned down';
    $('done-line').textContent = diff < 0
      ? `${n} words. That beats our best of ${board.par}.`
      : diff === 0 ? `${n} words, same as our best.` : `${n} words. Par was ${board.par}.`;

    const list = (el, words) => el.replaceChildren(...words.map((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      return li;
    }));
    list($('done-yours'), state.played.map((p) => p.word));
    list($('done-par'), board.line);

    const s = stats();
    $('stats').replaceChildren(...[
      [s.played, 'Played'], [s.par, 'Par or better'], [s.streak, 'Streak'], [s.best, 'Best'],
    ].map(([v, label]) => {
      const d = document.createElement('div');
      d.className = 'stat';
      d.innerHTML = '<b></b><span></span>';
      d.firstChild.textContent = v;
      d.lastChild.textContent = label;
      return d;
    }));

    const t = new Date();
    const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const mins = Math.max(1, Math.round((midnight - t) / 60000));
    $('next-in').textContent = index === todayIndex
      ? `Next board in ${Math.floor(mins / 60)}h ${mins % 60}m.`
      : '';
    $('share').textContent = 'Copy result';
    els.done.showModal();
  }

  async function share() {
    const text = resultText();
    try {
      await navigator.clipboard.writeText(text);
      $('share').textContent = 'Copied';
    } catch {
      $('share').textContent = 'Copy failed';
    }
  }

  // Wiring

  document.addEventListener('keydown', (e) => {
    if (els.help.open || els.done.open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') clear();
    else if (e.key === 'Backspace') { path.pop(); render(); }
  });

  els.prev.addEventListener('click', () => index > 0 && load(index - 1));
  els.next.addEventListener('click', () => index < todayIndex && load(index + 1));
  els.hint.addEventListener('click', hint);
  els.undo.addEventListener('click', undo);
  els.word.addEventListener('click', submit);
  $('help-btn').addEventListener('click', () => els.help.showModal());
  $('share').addEventListener('click', share);

  buildBoard();
  load(todayIndex);
  if (!store.get('wildfire:seen-help', false)) {
    els.help.showModal();
    store.set('wildfire:seen-help', true);
  }
})();
