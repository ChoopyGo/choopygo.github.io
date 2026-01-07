// --- Terminal Engine with streaming output (ChatGPT-like) ---
const screen = document.getElementById('screen');
const cli = document.getElementById('cli');

const state = {
  history: JSON.parse(localStorage.getItem('cg_history') || '[]'),
  hIndex: null,
  game: null,
};

function appendLine(className = 'line') {
  const d = document.createElement('div');
  d.className = className;
  screen.appendChild(d);
  screen.scrollTop = screen.scrollHeight;
  return d;
}
function println(html) {
  const d = appendLine('line');
  d.innerHTML = html;
  screen.scrollTop = screen.scrollHeight;
}
function prompt(cmd) {
  println(
    `<span class="prompt">choopygo$</span> <span class="cmd">${escapeHtml(
      cmd
    )}</span>`
  );
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] || ch));
}

// STREAM text like ChatGPT typing
async function stream(text, { delay = 8, preserveHtml = false, className = 'line' } = {}) {
  const d = appendLine(className);
  const s = (preserveHtml ? text : escapeHtml(text)).replace(/\n/g, '<br>');
  for (let i = 1; i <= s.length; i++) {
    d.innerHTML = s.slice(0, i);
    if (i % 3 === 0) screen.scrollTop = screen.scrollHeight;
    // micro-yield per chunk
    await sleep(delay);
  }
  screen.scrollTop = screen.scrollHeight;
}

const miniGames = {
  pearl: {
    key: 'pearl',
    title: 'Find your pearl of the sea',
    shells: 5,
    maxAttempts: 3,
    description:
      'เดาว่ามุกอยู่ในหอยหมายเลขใด (1-5) ภายใน 3 ครั้ง — พิมพ์ตัวเลขหรือ "quit" เพื่อยุติเกม',
  },
};

const commands = {
  help() {
    return stream(
      'คำสั่งที่มีให้:\n' +
        [
          'help  — แสดงรายการคำสั่ง',
          'about — เกี่ยวกับ ChoopyGO และสถานะโปรเจกต์',
          'game  — รายชื่อมินิเกม',
          'contact — ช่องทางติดต่อทีมงาน',
          'clear — ล้างหน้าจอ',
        ].join('\n')
    );
  },
  about() {
    return stream(
      '<span class="ok">🌊 เกี่ยวกับ ChoopyGO</span>\n\n' +
      'แพลตฟอร์มจองเรือที่โปร่งใส เชื่อถือได้ สำหรับเกาะภูเก็ต\n\n' +
      '📅 Timeline การพัฒนา:\n' +
      '   Q4 2025 — Concept & Design (แนวคิดและการออกแบบ)\n' +
      '   Q1 2026 — Core Development (พัฒนาระบบหลัก)\n' +
      '   Q2 2026 — Beta Testing (ทดสอบระบบเบต้า)\n' +
      '   Q3 2026 — Public Launch (เปิดตัวสู่สาธารณะ)\n\n' +
      'เลื่อนลงด้านล่างเพื่อดู Timeline แบบ interactive ↓',
      { preserveHtml: true }
    );
  },
  async game(args) {
    const pick = (args[0] || '').toLowerCase();
    if (!pick || pick === 'list') {
      const items = Object.values(miniGames).map((g) =>
        `• <strong>${escapeHtml(g.title)}</strong> — พิมพ์ <code>game ${g.key}</code> เพื่อเริ่มเล่น`
      );
      const active = state.game
        ? `<br><br>ขณะนี้คุณกำลังเล่น <strong>${escapeHtml(
            miniGames[state.game.name]?.title || state.game.name
          )}</strong> — พิมพ์ <code>quit</code> เพื่อออกจากเกม`
        : '';
      const body = items.length
        ? `มินิเกมที่มีตอนนี้:<br>${items.join('<br>')}${active}`
        : 'ยังไม่มีมินิเกมให้เล่นในตอนนี้';
      return stream(body, { preserveHtml: true });
    }

    const game = miniGames[pick];
    if (!game) {
      return stream(
        `ยังไม่มีเกมชื่อ "${escapeHtml(pick)}" — พิมพ์ <code>game</code> เพื่อดูรายการ`,
        { preserveHtml: true }
      );
    }

    state.game = {
      name: pick,
      target: Math.floor(Math.random() * game.shells) + 1,
      attempts: 0,
      maxAttempts: game.maxAttempts,
      shells: game.shells,
    };

    return stream(
      `🐚 <strong>${escapeHtml(game.title)}</strong><br>` +
        `มุกถูกซ่อนไว้ในหอยหมายเลข 1-${game.shells}.<br>` +
        `คุณมี ${game.maxAttempts} ครั้งในการเดา — พิมพ์ตัวเลขหรือ <code>quit</code> เพื่อยุติเกม`,
      { preserveHtml: true }
    );
  },
  contact() {
    return stream(
      `ทีมงาน ChoopyGO:\n • อีเมล: <a href="mailto:info@choopygo.com">info@choopygo.com</a>`,
      { preserveHtml: true }
    );
  },
  clear() {
    screen.innerHTML = '';
  },
};

async function exec(raw) {
  const input = raw.trim();
  if (!input) return;
  prompt(input);
  const [name, ...rest] = input.split(/\s+/);
  const fn = commands[name];
  if (fn) {
    try {
      await fn(rest);
    } catch (e) {
      println(`<span class='err'>error:</span> ${escapeHtml(e.message)}`);
    }
  } else if (state.game) {
    await handleGameInput(raw);
  } else {
    println(`<span class='err'>ไม่รู้จักคำสั่ง:</span> ${escapeHtml(name)} — พิมพ์ <code>help</code>`);
  }
}

async function handleGameInput(raw) {
  if (!state.game) return;
  if (state.game.name === 'pearl') {
    await handlePearlGuess(raw);
    return;
  }

  println(`<span class='err'>ระบบยังไม่รองรับเกมนี้</span>`);
  state.game = null;
}

async function handlePearlGuess(raw) {
  const config = miniGames.pearl;
  if (!config) return;

  const input = raw.trim().toLowerCase();
  if (!input) {
    await stream(`พิมพ์ตัวเลขระหว่าง 1-${config.shells} หรือ <code>quit</code> เพื่อออกจากเกม`, {
      preserveHtml: true,
    });
    return;
  }

  if (['quit', 'exit', 'q'].includes(input)) {
    state.game = null;
    await stream('ยุติเกมแล้ว — พิมพ์ <code>game</code> เพื่อเลือกเล่นใหม่', { preserveHtml: true });
    return;
  }

  const guess = Number(input);
  if (!Number.isInteger(guess) || guess < 1 || guess > config.shells) {
    await stream(`เลือกเลขระหว่าง 1-${config.shells} หรือพิมพ์ <code>quit</code> เพื่อออก`, {
      preserveHtml: true,
    });
    return;
  }

  state.game.attempts += 1;

  if (guess === state.game.target) {
    await stream(
      `<span class="ok">เยี่ยม!</span> คุณพบมุกในหอยหมายเลข ${guess} 🌊`,
      { preserveHtml: true }
    );
    await stream('<span class="fireworks">🎆 ✨ 🎇 ✨ 🎆</span>', {
      preserveHtml: true,
      delay: 6,
    });
    await stream('คลื่นกำลังเฉลิมฉลอง! พิมพ์ <code>game pearl</code> เพื่อเล่นอีกครั้ง', {
      preserveHtml: true,
    });
    state.game = null;
    return;
  }

  const remaining = state.game.maxAttempts - state.game.attempts;
  if (remaining <= 0) {
    const answer = state.game.target;
    state.game = null;
    await stream(
      `คลื่นสงบลง... มุกอยู่ในหอยหมายเลข ${answer}. ลองใหม่อีกครั้งด้วย <code>game pearl</code>`,
      { preserveHtml: true }
    );
    return;
  }

  const hint = guess < state.game.target ? 'ดูเหมือนมุกจะอยู่เลขที่สูงกว่านี้' : 'คลื่นกระซิบว่าเลขที่ต่ำกว่านี้';
  await stream(`ยังไม่พบมุก... ${hint} (เหลืออีก ${remaining} ครั้ง)`, { preserveHtml: true });
}

// History + keyboard handlers + autocomplete
cli.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    state.history.push(cli.value);
    localStorage.setItem('cg_history', JSON.stringify(state.history.slice(-100)));
    state.hIndex = null;
    const val = cli.value;
    cli.value = '';
    await exec(val);
  } else if (e.key === 'ArrowUp') {
    if (state.hIndex === null) state.hIndex = state.history.length - 1;
    else state.hIndex = Math.max(0, state.hIndex - 1);
    cli.value = state.history[state.hIndex] || '';
    setTimeout(() => cli.setSelectionRange(cli.value.length, cli.value.length));
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (state.hIndex === null) return;
    state.hIndex = Math.min(state.history.length, state.hIndex + 1);
    cli.value = state.history[state.hIndex] || '';
    e.preventDefault();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const names = Object.keys(commands);
    const match = names.filter((n) => n.startsWith(cli.value));
    if (match.length === 1) cli.value = match[0] + ' ';
    else if (match.length > 1) println(match.join('  '));
  }
});

screen.addEventListener('click', () => cli.focus());

const yearLabel = document.getElementById('copyright-year');
if (yearLabel) yearLabel.textContent = new Date().getFullYear();

const header = document.querySelector('header');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.timeline-item').forEach(item => {
  observer.observe(item);
});

// Greeting (streamed)
(async () => {
  await stream('<span class="ok">ยินดีต้อนรับสู่ ChoopyGO (Coming Soon)</span>', {
    preserveHtml: true,
    delay: 10,
  });
  await stream('เริ่มจากพิมพ์ <code>help</code> หรือทดลอง <code>game</code>, <code>contact</code>', {
    preserveHtml: true,
    delay: 10,
  });
})();
