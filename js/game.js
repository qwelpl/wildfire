(() => {
  'use strict';

  const DATA = window.BURN_DATA;
  const DAY = 86400000;
  const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', '+ZXCVBNM-'];
  const MAX_LEN = 12;
  // While testing, start every puzzle fresh on each page load.
  const KEEP_PROGRESS = false;

  const $ = (id) => document.getElementById(id);
  const els = {
    clues: $('clues'), msg: $('msg'), keyboard: $('keyboard'), number: $('number'),
    date: $('date'), tally: $('tally'), prev: $('prev'), next: $('next'),
    reveal: $('reveal'), help: $('help'), done: $('done'),
  };

  // Storage can be unavailable (private mode, blocked site data).
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  const startUtc = Date.parse(DATA.start + 'T00:00:00Z');
  const localDayUtc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const todayIndex = Math.max(0, Math.floor((localDayUtc(new Date()) - startUtc) / DAY));

  let index = todayIndex;
  let puzzle;
  let state;
  let typing = '';
  let msgTimer;

  const keys = {};

  function load(i) {
    index = i;
    puzzle = DATA.puzzles[i % DATA.puzzles.length];
    const saved = KEEP_PROGRESS ? store.get(`burn:${i}`, null) : null;
    state = saved && Array.isArray(saved.locked) && saved.locked.length === puzzle.clues.length
      ? saved
      : { locked: puzzle.clues.map(() => null), undos: 0, solved: false, revealed: false };
    state.active = firstOpen() ?? 0;
    typing = '';
    say('');
    render();
    renderKeys();
    checkDeadEnd();
  }

  function save() {
    store.set(`burn:${index}`, {
      locked: state.locked, undos: state.undos, solved: state.solved, revealed: state.revealed,
    });
  }

  const finished = () => state.solved || state.revealed;

  function burnedLetters() {
    const set = new Set();
    state.locked.forEach((w) => w && [...w].forEach((c) => set.add(c)));
    return set;
  }

  function firstOpen(from = 0) {
    const n = puzzle.clues.length;
    for (let k = 0; k < n; k++) {
      const i = (from + k) % n;
      if (!state.locked[i]) return i;
    }
    return null;
  }

  // Rendering

  function render() {
    const date = new Date(startUtc + index * DAY);
    els.number.textContent = `No. ${index + 1}`;
    els.date.textContent = date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
    els.prev.disabled = index === 0;
    els.next.disabled = index >= todayIndex;

    const left = 26 - burnedLetters().size;
    const undos = state.undos === 1 ? '1 undo' : `${state.undos} undos`;
    els.tally.textContent = `${left} letters left · ${undos}`;
    els.reveal.hidden = finished();

    els.clues.replaceChildren(...puzzle.clues.map((c, i) => {
      const li = document.createElement('li');
      const word = state.locked[i];
      li.className = 'clue' + (word ? ' locked' : '') + (i === state.active && !word && !finished() ? ' active' : '');
      li.dataset.i = i;

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = c.clue;

      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      const shown = word ?? (i === state.active ? typing : '');
      for (const ch of shown) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = ch;
        wordEl.append(s);
      }
      if (!word && i === state.active && !finished()) {
        const caret = document.createElement('span');
        caret.className = 'caret';
        wordEl.append(caret);
      } else if (!word) {
        const dash = document.createElement('span');
        dash.className = 'dash';
        dash.textContent = '···';
        wordEl.append(dash);
      }

      let side;
      if (word && !finished()) {
        side = document.createElement('button');
        side.className = 'unburn';
        side.textContent = 'undo';
        side.setAttribute('aria-label', `Take back ${word}`);
      } else {
        side = document.createElement('span');
        side.className = 'side';
        side.textContent = word ? '' : `${c.answers.length} words`;
      }

      li.append(label, wordEl, side);
      return li;
    }));
  }

  function buildKeyboard() {
    for (const row of ROWS) {
      const r = document.createElement('div');
      r.className = 'row';
      for (const k of row) {
        const b = document.createElement('button');
        b.className = 'key';
        if (k === '+') {
          b.textContent = 'ENTER';
          b.classList.add('wide');
          b.dataset.key = 'Enter';
        } else if (k === '-') {
          b.innerHTML = '&#9003;';
          b.classList.add('wide');
          b.dataset.key = 'Backspace';
          b.setAttribute('aria-label', 'Delete');
        } else {
          b.textContent = k;
          b.dataset.key = k;
          b.addEventListener('animationend', () => b.classList.remove('burning', 'shake'));
          keys[k] = b;
        }
        r.append(b);
      }
      els.keyboard.append(r);
    }
  }

  function renderKeys(burningWord = '') {
    const burned = burnedLetters();
    const hot = new Set(typing);
    const fresh = [...new Set(burningWord)];
    for (const [k, b] of Object.entries(keys)) {
      b.classList.toggle('burned', burned.has(k));
      b.classList.toggle('hot', hot.has(k) && !burned.has(k));
      b.disabled = burned.has(k);
      if (!burned.has(k)) b.classList.remove('burning');
      const order = fresh.indexOf(k);
      if (order >= 0) {
        b.classList.remove('burning');
        void b.offsetWidth;
        b.style.animationDelay = `${order * 70}ms`;
        b.classList.add('burning');
      }
    }
  }

  function say(text, warn = false, sticky = false) {
    clearTimeout(msgTimer);
    els.msg.textContent = text;
    els.msg.className = warn ? 'warn' : '';
    if (text && !sticky) msgTimer = setTimeout(() => { els.msg.textContent = ''; checkDeadEnd(); }, 2600);
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  const activeRow = () => els.clues.children[state.active];

  // Actions

  function type(letter) {
    if (finished() || state.locked[state.active]) return;
    if (burnedLetters().has(letter)) {
      shake(keys[letter]);
      say(`${letter} is burned.`, true);
      return;
    }
    if (typing.length >= MAX_LEN) return;
    if (!els.msg.classList.contains('warn') || !els.msg.textContent.startsWith('Nothing')) say('');
    typing += letter;
    render();
    renderKeys();
  }

  function erase() {
    if (!typing) return;
    typing = typing.slice(0, -1);
    render();
    renderKeys();
  }

  function submit() {
    if (finished() || !typing) return;
    const clue = puzzle.clues[state.active];
    if (!clue.answers.includes(typing)) {
      shake(activeRow());
      say(typing.length < 3 ? 'Too short.' : `${typing} isn't on the list for “${clue.clue}”.`, true);
      return;
    }
    const word = typing;
    const at = state.active;
    state.locked[at] = word;
    typing = '';
    say('');

    if (state.locked.every(Boolean)) {
      state.solved = true;
      save();
      recordWin();
    } else {
      state.active = firstOpen(at + 1);
      save();
    }

    render();
    activeRowLit(at);
    renderKeys(word);
    if (finished()) setTimeout(showDone, 900);
    else checkDeadEnd();
  }

  function activeRowLit(i) {
    els.clues.children[i].querySelectorAll('.ch').forEach((s, k) => {
      s.style.animationDelay = `${k * 70}ms`;
      s.classList.add('lit');
    });
  }

  function unburn(i) {
    if (finished() || !state.locked[i]) return;
    state.locked[i] = null;
    state.undos++;
    state.active = i;
    typing = '';
    save();
    say('');
    render();
    renderKeys();
    checkDeadEnd();
  }

  function select(i) {
    if (finished() || state.locked[i] || i === state.active) return;
    state.active = i;
    typing = '';
    render();
    renderKeys();
  }

  function move(step) {
    const n = puzzle.clues.length;
    for (let k = 1; k <= n; k++) {
      const i = (state.active + step * k + n * k) % n;
      if (!state.locked[i]) return select(i);
    }
  }

  function checkDeadEnd() {
    if (finished()) return;
    const burned = burnedLetters();
    const stuck = puzzle.clues.find((c, i) =>
      !state.locked[i] && !c.answers.some((w) => ![...w].some((ch) => burned.has(ch))));
    if (stuck) say(`Nothing for “${stuck.clue}” survives. Undo a word.`, true, true);
    else if (els.msg.classList.contains('warn') && els.msg.textContent.startsWith('Nothing')) say('');
  }

  let armed = false;

  function reveal() {
    if (finished()) return;
    if (!armed) {
      armed = true;
      els.reveal.textContent = 'Tap again to give up';
      setTimeout(() => { armed = false; els.reveal.textContent = 'Give up'; }, 3000);
      return;
    }
    state.locked = [...puzzle.solution];
    state.revealed = true;
    typing = '';
    save();
    recordLoss();
    render();
    renderKeys();
    showDone();
  }

  // Stats and results

  function stats() {
    return store.get('burn:stats', { played: 0, solved: 0, streak: 0, best: 0, last: null });
  }

  function recordWin() {
    if (index !== todayIndex) return;
    const s = stats();
    s.played++;
    s.solved++;
    s.streak = s.last === index - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.last = index;
    store.set('burn:stats', s);
  }

  function recordLoss() {
    if (index !== todayIndex) return;
    const s = stats();
    s.played++;
    s.streak = 0;
    store.set('burn:stats', s);
  }

  function resultText() {
    const u = state.undos === 1 ? '1 undo' : `${state.undos} undos`;
    const line = state.revealed ? 'gave up' : `solved · ${u}`;
    const url = location.protocol.startsWith('http') ? `\n${location.origin}${location.pathname}` : '';
    return `Burn No. ${index + 1}\n${line}${url}`;
  }

  function showDone() {
    $('done-title').textContent = state.revealed ? 'The answer' : state.undos === 0 ? 'Burned clean' : 'Solved';
    $('done-line').textContent = state.revealed
      ? 'Only this set of words shares no letters.'
      : state.undos === 0 ? 'No undos. Nicely done.' : `Solved with ${state.undos === 1 ? '1 undo' : state.undos + ' undos'}.`;

    $('done-words').replaceChildren(...puzzle.clues.map((c, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="c"></span><span class="w"></span>';
      li.firstChild.textContent = c.clue;
      li.lastChild.textContent = state.locked[i];
      return li;
    }));

    const s = stats();
    const pct = s.played ? Math.round((s.solved / s.played) * 100) : 0;
    $('stats').innerHTML = [[s.played, 'played'], [pct, 'solved %'], [s.streak, 'streak'], [s.best, 'best']]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

    const now = new Date();
    const msLeft = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
    const h = Math.max(0, Math.floor(msLeft / 3600000));
    const m = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
    $('next-in').textContent = index === todayIndex ? `Next puzzle in ${h}h ${m}m.` : '';

    if (!els.done.open) els.done.showModal();
  }

  async function share() {
    const text = resultText();
    const btn = $('share');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy result'; }, 1600);
  }

  // Events

  els.keyboard.addEventListener('click', (e) => {
    const b = e.target.closest('.key');
    if (!b) return;
    const k = b.dataset.key;
    if (k === 'Enter') submit();
    else if (k === 'Backspace') erase();
    else type(k);
  });

  els.clues.addEventListener('click', (e) => {
    const li = e.target.closest('.clue');
    if (!li) return;
    const i = Number(li.dataset.i);
    if (e.target.closest('.unburn')) unburn(i);
    else if (finished()) showDone();
    else select(i);
  });

  document.addEventListener('keydown', (e) => {
    if (els.help.open || els.done.open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Backspace') erase();
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (/^[a-z]$/i.test(e.key)) type(e.key.toUpperCase());
  });

  els.prev.addEventListener('click', () => index > 0 && load(index - 1));
  els.next.addEventListener('click', () => index < todayIndex && load(index + 1));
  els.reveal.addEventListener('click', reveal);
  $('help-btn').addEventListener('click', () => els.help.showModal());
  $('share').addEventListener('click', share);

  buildKeyboard();
  load(todayIndex);
  if (!store.get('burn:seen-help', false)) {
    els.help.showModal();
    store.set('burn:seen-help', true);
  }
})();
