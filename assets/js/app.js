// --- Terminal Engine with streaming output (ChatGPT-like) ---
const screen = document.getElementById('screen');
const cli = document.getElementById('cli');

const state = {
  history: JSON.parse(localStorage.getItem('cg_history') || '[]'),
  hIndex: null,
  vars: { from: 'Phuket', to: 'PhiPhi', pax: 2 },
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

const commands = {
  help() {
    return stream(
      'คำสั่งที่มีให้:\n' +
        [
          'help  — แสดงรายการคำสั่ง',
          'about — เกี่ยวกับ ChoopyGO และสถานะโปรเจกต์',
          'routes — เส้นทางตัวอย่าง',
          'set FROM TO [--pax N] [--date YYYY-MM-DD]',
          'quote — ประเมินราคาคร่าว ๆ (เดโม)',
          'notify EMAIL — ลงทะเบียนแจ้งเตือนเปิดตัว',
          'contact — ช่องทางติดต่อทีมงาน',
          'clear — ล้างหน้าจอ',
        ].join('\n')
    );
  },
  about() {
    return stream(
      'ChoopyGO กำลังพัฒนาเพื่อเป็นแพลตฟอร์มจองเรือในภูเก็ต\nช่วงนี้เป็นเดโมแบบไม่เชื่อมแบ็กเอนด์ — คุณสามารถใช้ notify เพื่อฝากอีเมลได้'
    );
  },
  routes() {
    return stream(
      'เส้นทางตัวอย่าง (MVP):\n - Phuket(Rassada) → Phi Phi (09:00, 13:30)\n - Phi Phi → Phuket (11:00, 16:00)'
    );
  },
  set(args) {
    if (!args.length) {
      return stream('<span class="warn">usage:</span> set FROM TO [--pax N] [--date YYYY-MM-DD]', { preserveHtml: true });
    }
    state.vars.from = args[0];
    state.vars.to = args[1] || state.vars.to;
    const flags = parseFlags(args.slice(2));
    if (flags.pax) state.vars.pax = Number(flags.pax);
    if (flags.date) state.vars.date = flags.date;
    return stream(
      `ตั้งค่าเส้นทางแล้ว: <span class="ok">${state.vars.from} → ${state.vars.to}</span> pax=${state.vars.pax}${
        state.vars.date ? ` date=${state.vars.date}` : ''
      }`,
      { preserveHtml: true }
    );
  },
  quote() {
    const base = 550; // THB, demo only
    const distFactor =
      state.vars.from.toLowerCase().includes('phuket') && state.vars.to.toLowerCase().includes('phi') ? 1.0 : 1.2;
    const pax = Math.max(1, Number(state.vars.pax) || 1);
    const price = Math.round(base * distFactor * pax);
    return stream(
      `ราคาประเมินคร่าว ๆ สำหรับ <span class="ok">${escapeHtml(state.vars.from)} → ${escapeHtml(
        state.vars.to
      )}</span> ผู้โดยสาร ${pax} คน ≈ <strong>${price} THB</strong> (เดโม)`,
      { preserveHtml: true }
    );
  },
  notify(args) {
    const email = (args[0] || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return stream('<span class="err">โปรดระบุอีเมลที่ถูกต้อง เช่น</span> notify you@example.com', { preserveHtml: true });
    }
    return stream(`ขอบคุณ! เราจะส่งอีเมลแจ้งเมื่อเปิดตัวอย่างเป็นทางการไปที่ <strong>${escapeHtml(email)}</strong>`, {
      preserveHtml: true,
    });
  },
  contact() {
    return stream(
      `ทีมงาน ChoopyGO:\n • อีเมล: <a href="mailto:hello@choopygo.example">hello@choopygo.example</a>\n • LINE: <a href="https://line.me/" target="_blank" rel="noopener">@choopygo</a>`,
      { preserveHtml: true }
    );
  },
  clear() {
    screen.innerHTML = '';
  },
};

function parseFlags(arr) {
  const out = {};
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].startsWith('--')) {
      const key = arr[i].slice(2);
      const val = i + 1 < arr.length && !arr[i + 1].startsWith('--') ? arr[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

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
  } else {
    println(`<span class='err'>ไม่รู้จักคำสั่ง:</span> ${escapeHtml(name)} — พิมพ์ <code>help</code>`);
  }
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

// Greeting (streamed)
(async () => {
  await stream('<span class="ok">ยินดีต้อนรับสู่ ChoopyGO (Coming Soon)</span> — เทอร์มินัลเดโมเพื่อสาธิตการใช้งาน', {
    preserveHtml: true,
    delay: 10,
  });
  await stream('เริ่มจากพิมพ์ <code>help</code> หรือทดลอง <code>routes</code>, <code>quote</code>, <code>notify you@example.com</code>', {
    preserveHtml: true,
    delay: 10,
  });
})();
