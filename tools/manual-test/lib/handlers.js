const { fs, path, sleep } = require("./common");

// ---- page-side helpers (serialised into the page / frame, no closures) ----

/** Compact state of the VS Code workbench chrome. */
function pageSnapshot() {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const t = (e) => (e ? e.innerText.replace(/Â /g, " ").replace(/\s+/g, " ").trim() : "");
  const out = {};
  out.tabs = [...document.querySelectorAll(".tabs-container .tab")].map((e) => ({
    label: (e.getAttribute("aria-label") || t(e)).slice(0, 80),
    active: e.classList.contains("active"),
  }));
  const qi = document.querySelector(".quick-input-widget");
  if (qi && vis(qi))
    out.quickInput = {
      title: t(qi.querySelector(".quick-input-title")),
      input: qi.querySelector(".quick-input-box input")?.value ?? "",
      message: t(qi.querySelector(".quick-input-message")),
      rows: [...qi.querySelectorAll(".quick-input-list .monaco-list-row")]
        .slice(0, 15)
        .map((r) => ({ text: t(r).slice(0, 100), focused: r.classList.contains("focused") })),
    };
  const dlg = document.querySelector(".monaco-dialog-box");
  if (dlg && vis(dlg))
    out.dialog = {
      message: t(dlg.querySelector(".dialog-message-text")),
      detail: t(dlg.querySelector(".dialog-message-detail")),
      buttons: [...dlg.querySelectorAll(".dialog-buttons .monaco-button")].map(t),
    };
  out.notifications = [...document.querySelectorAll(".notification-list-item")]
    .filter(vis)
    .slice(0, 6)
    .map((n) => ({
      message: t(n.querySelector(".notification-list-item-message")).slice(0, 200),
      severity: (n.querySelector(".notification-list-item-icon")?.className.match(/codicon-(\w+)/) || [])[1],
      buttons: [...n.querySelectorAll(".notification-list-item-buttons-container .monaco-button")].map(t),
    }));
  out.sidebar = [...document.querySelectorAll(".part.sidebar .monaco-list-row")].filter(vis).slice(0, 30).map((r) => (r.getAttribute("aria-label") || t(r)).slice(0, 70));
  out.menu = [...document.querySelectorAll(".monaco-menu .action-item:not(.disabled) .action-label")].filter(vis).map(t);
  out.terminals = [...document.querySelectorAll(".terminal-tabs-entry")].map((e) => t(e).slice(0, 40));
  out.status = [...document.querySelectorAll(".statusbar-item")]
    .map((e) => t(e))
    .filter((s) => s && s.length < 60)
    .slice(0, 14);
  return out;
}

/** Text of a document including shadow roots. */
function deepText() {
  const parts = [];
  const walk = (n) => {
    if (n.nodeType === 3) {
      const s = n.textContent.replace(/\s+/g, " ").trim();
      if (s) parts.push(s);
    } else if (n.nodeType === 1) {
      if (/^(SCRIPT|STYLE)$/.test(n.tagName)) return;
      if (n.shadowRoot) n.shadowRoot.childNodes.forEach(walk);
      n.childNodes.forEach(walk);
    } else if (n.nodeType === 11) n.childNodes.forEach(walk);
  };
  walk(document.body);
  return parts.join(" | ");
}

/** Interactive controls of a document including shadow roots. */
function deepControls() {
  const out = [];
  const label = (e) => {
    const root = e.getRootNode();
    const byFor = e.id && root.querySelector && root.querySelector(`label[for="${e.id}"]`);
    const wrap = e.closest && e.closest("label");
    return (e.getAttribute("aria-label") || (byFor && byFor.textContent) || (wrap && wrap.textContent) || e.placeholder || "")
      .replace(/\s+/g, " ").trim().slice(0, 50);
  };
  const walk = (r) =>
    r.querySelectorAll("*").forEach((e) => {
      if (e.shadowRoot) walk(e.shadowRoot);
      if (!/^(INPUT|SELECT|BUTTON|TEXTAREA|A)$/.test(e.tagName) && e.getAttribute("role") !== "button") return;
      const o = { tag: e.tagName.toLowerCase() };
      if (e.type && e.tagName === "INPUT") o.type = e.type;
      if (e.id) o.id = e.id;
      if (e.name) o.name = e.name;
      const l = label(e);
      if (l) o.label = l;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) {
        o.value = e.type === "password" ? (e.value ? "***" : "") : e.value;
        if (e.type === "checkbox" || e.type === "radio") o.checked = e.checked;
        if (e.tagName === "SELECT") o.options = [...e.options].map((x) => x.text);
      } else o.text = (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50);
      if (e.disabled) o.disabled = true;
      if (!e.getClientRects().length || !e.offsetWidth) o.hidden = true; // collapsed or off-screen: expand its section first
      out.push(o);
    });
  walk(document);
  return out;
}

const fmtSnap = (s, wvs) => {
  const L = [];
  L.push("TABS: " + (s.tabs.map((x) => (x.active ? "*" : "") + x.label).join(" | ") || "(none)"));
  if (s.quickInput) {
    const q = s.quickInput;
    L.push(`QUICKINPUT: title=${JSON.stringify(q.title)} input=${JSON.stringify(q.input)}${q.message ? " msg=" + JSON.stringify(q.message) : ""}`);
    q.rows.forEach((r, i) => L.push(`  ${r.focused ? ">" : " "}${i + 1}. ${r.text}`));
  }
  if (s.dialog) L.push(`DIALOG: ${s.dialog.message}${s.dialog.detail ? " -- " + s.dialog.detail : ""} [${s.dialog.buttons.join(" | ")}]`);
  if (s.notifications.length) {
    L.push("NOTIFICATIONS:");
    s.notifications.forEach((n) => L.push(`  - (${n.severity || "?"}) ${n.message}${n.buttons.length ? " [" + n.buttons.join(" | ") + "]" : ""}`));
  }
  if (s.menu.length) L.push("CONTEXT MENU: " + s.menu.join(" | "));
  if (s.sidebar.length) L.push("SIDEBAR: " + s.sidebar.join(" | "));
  if (s.terminals.length) L.push("TERMINALS: " + s.terminals.join(" | "));
  if (wvs.length) {
    L.push("WEBVIEWS:");
    wvs.forEach((w) => L.push(`  ${w.i}${w.visible ? "*" : " "} ${JSON.stringify(w.text)}`));
  }
  L.push("STATUS: " + s.status.join(" | "));
  return L.join("\n");
};

function makeHandlers(ctx) {
  const { win, app } = ctx;

  const contentFrames = () => win.frames().filter((f) => /fake\.html/.test(f.url()));

  async function frameInfo() {
    const out = [];
    const frames = contentFrames();
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      let visible = false;
      try {
        visible = await f.parentFrame().frameElement().then((h) => h.isVisible());
      } catch {}
      let text = "";
      try {
        text = (await f.evaluate(deepText)).slice(0, 160);
      } catch {}
      out.push({ i, visible, text, frame: f });
    }
    return out;
  }

  async function resolveFrame(sel, needVisible) {
    const infos = await frameInfo();
    if (!infos.length) throw new Error("no webviews are open");
    if (sel === undefined || sel === "visible") {
      const v = infos.find((x) => x.visible) || infos[infos.length - 1];
      return v.frame;
    }
    if (typeof sel === "number" || /^\d+$/.test(String(sel))) {
      const f = infos[Number(sel)];
      if (!f) throw new Error(`webview ${sel} not found (have ${infos.length})`);
      if (needVisible && !f.visible) throw new Error(`webview ${sel} is in a background tab; click its editor tab first (see TABS in snapshot)`);
      return f.frame;
    }
    const m = infos.find((x) => x.text.toLowerCase().includes(String(sel).toLowerCase()));
    if (!m) throw new Error(`no webview whose text contains ${JSON.stringify(sel)}`);
    return m.frame;
  }

  const snapshot = async () => {
    const s = await win.evaluate(pageSnapshot);
    const wvs = (await frameInfo()).filter((w) => w.visible).map(({ frame, ...r }) => r);
    return fmtSnap(s, wvs);
  };

  const settle = (ms) => sleep(ms ?? 700);
  /** Run an action, then return a compact snapshot unless snap:false. */
  const act = (fn) => async (args) => {
    const r = await fn(args);
    await settle(args.settle);
    const tail = args.snap === false ? "" : "\n" + (await snapshot());
    return (r === undefined ? "ok" : typeof r === "string" ? r : JSON.stringify(r)) + tail;
  };

  const toSelector = (s) => /^label:/.test(s) ? `internal:label="${s.slice(6)}"i` : (/^(\w+=|\/\/|\.|#|\[|:|>>)/.test(s) ? s : `text=${s}`);

  async function termText(lines) {
    const rows = win.locator(".xterm-rows");
    const n = await rows.count();
    for (let i = n - 1; i >= 0; i--) {
      if (await rows.nth(i).isVisible()) {
        const t = (await rows.nth(i).innerText()).replace(/Â /g, " ").replace(/\s+$/gm, "").trimEnd();
        return t.split("\n").slice(-(lines || 40)).join("\n");
      }
    }
    throw new Error("no visible terminal (is the Terminal panel open?)");
  }

  async function editorText() {
    const t = await win.evaluate(() => {
      const eds = [...document.querySelectorAll(".monaco-editor .view-lines")].filter((e) => e.getClientRects().length);
      const e = eds.find((x) => x.closest(".monaco-editor").classList.contains("focused")) || eds[0];
      return e ? e.innerText : null;
    });
    if (t === null) throw new Error("no visible text editor");
    return t.replace(/Â /g, " ");
  }

  async function pollFor(read, regex, timeout, what) {
    const re = new RegExp(regex, "m");
    const end = Date.now() + (timeout || 15000);
    let last = "";
    while (Date.now() < end) {
      try {
        last = await read();
        if (re.test(last)) return last;
      } catch (e) {
        last = "(read failed: " + e.message + ")";
      }
      await sleep(400);
    }
    throw new Error(`timed out waiting for ${re} in ${what}. Last content:\n${String(last).split("\n").slice(-15).join("\n")}`);
  }

  const H = {
    snapshot: async () => snapshot(),

    palette: act(async ({ text, pick }) => {
      await win.keyboard.press("F1");
      await sleep(250);
      await win.keyboard.press("Control+A");
      await win.keyboard.type(">" + text);
      await sleep(600);
      const rows = await win.locator(".quick-input-list .monaco-list-row").allInnerTexts();
      if (!rows.length) {
        await win.keyboard.press("Escape");
        throw new Error(`no palette command matches ${JSON.stringify(text)}`);
      }
      const labels = rows.map((r) => r.split("\n")[0].trim());
      let idx = pick !== undefined ? pick - 1 : labels.findIndex((l) => l.toLowerCase() === text.toLowerCase());
      if (idx < 0) idx = 0;
      for (let i = 0; i < idx; i++) await win.keyboard.press("ArrowDown");
      await win.keyboard.press("Enter");
      return `ran palette item ${idx + 1}: ${labels[idx]}` + (labels.length > 1 ? `  (other matches: ${labels.filter((_, i) => i !== idx).slice(0, 4).join("; ")})` : "");
    }),

    key: act(async ({ keys }) => {
      for (const k of [].concat(keys)) await win.keyboard.press(k);
    }),
    type: act(async ({ text }) => win.keyboard.type(text)),
    click: act(async ({ sel, button, dbl }) => {
      const l = win.locator(toSelector(sel)).first();
      await (dbl ? l.dblclick({ timeout: 8000 }) : l.click({ button: button || "left", timeout: 8000 }));
    }),

    // quick input (palette, pickers, input boxes)
    "qi.type": act(async ({ text }) => {
      await win.keyboard.press("Control+A");
      await win.keyboard.type(text);
    }),
    "qi.pick": act(async ({ text }) => {
      const row = win.locator(".quick-input-list .monaco-list-row").filter({ hasText: text }).first();
      await row.click({ timeout: 8000 });
    }),
    "qi.enter": act(async () => win.keyboard.press("Enter")),
    esc: act(async () => win.keyboard.press("Escape")),

    // notifications and dialogs
    "button": act(async ({ text }) => {
      const b = win
        .locator(".notification-list-item .monaco-button, .monaco-dialog-box .monaco-button")
        .filter({ hasText: text })
        .first();
      await b.click({ timeout: 8000 });
    }),

    // webviews
    "wv.list": async () => (await frameInfo()).map((w) => `${w.i}${w.visible ? "*" : " "} ${JSON.stringify(w.text)}`).join("\n") || "(no webviews)",
    "wv.text": async ({ wv, sel, max }) => {
      const f = await resolveFrame(wv);
      const t = sel
        ? await f.locator(sel).first().innerText({ timeout: 8000 })
        : await f.evaluate(deepText);
      return t.slice(0, max || 4000);
    },
    "wv.controls": async ({ wv }) => (await (await resolveFrame(wv)).evaluate(deepControls)).map((c) => JSON.stringify(c)).join("\n"),
    "wv.click": act(async ({ wv, sel }) => (await resolveFrame(wv, true)).locator(toSelector(sel)).first().click({ timeout: 8000 })),
    "wv.fill": act(async ({ wv, sel, value }) => (await resolveFrame(wv, true)).locator(toSelector(sel)).first().fill(String(value), { timeout: 8000 })),
    "wv.select": act(async ({ wv, sel, value }) => (await resolveFrame(wv, true)).locator(toSelector(sel)).first().selectOption(value, { timeout: 8000 })),
    "wv.check": act(async ({ wv, sel, checked }) => (await resolveFrame(wv, true)).locator(toSelector(sel)).first().setChecked(checked !== false, { timeout: 8000 })),
    "wv.eval": async ({ wv, js }) => JSON.stringify(await (await resolveFrame(wv)).evaluate(js)),

    // terminal
    "term.read": async ({ lines }) => termText(lines),
    "term.send": async ({ text, enter, lines }) => {
      await win.locator(".xterm-screen").last().click({ timeout: 8000 });
      await win.keyboard.type(text);
      if (enter !== false) await win.keyboard.press("Enter");
      await sleep(1200);
      return termText(lines);
    },

    // editor
    "editor.read": async () => editorText(),
    "editor.set": act(async ({ text }) => {
      await win.locator(".monaco-editor .view-lines").first().click({ timeout: 8000 });
      await win.keyboard.press("Control+A");
      await win.keyboard.insertText(text);
    }),
    "editor.type": act(async ({ text }) => {
      await win.locator(".monaco-editor .view-lines").first().click({ timeout: 8000 });
      await win.keyboard.type(text);
    }),
    "file.open": act(async ({ name }) => {
      await win.keyboard.press("Control+P");
      await sleep(300);
      await win.keyboard.type(name);
      await sleep(600);
      await win.keyboard.press("Enter");
    }),

    wait: async ({ kind, match, timeout, wv }) => {
      const read = { term: () => termText(80), snapshot: snapshot, editor: editorText, webview: async () => (await resolveFrame(wv)).evaluate(deepText) }[kind || "snapshot"];
      if (!read) throw new Error("kind must be term|snapshot|editor|webview");
      await pollFor(read, match, timeout, kind || "snapshot");
      return "matched " + match;
    },

    shot: async ({ name, sel }) => {
      const f = path.join(ctx.shotsDir, (name || "shot-" + Date.now()) + ".png");
      if (sel) await win.locator(toSelector(sel)).first().screenshot({ path: f });
      else await win.screenshot({ path: f });
      return f;
    },

    log: async ({ lines, file }) => {
      const logs = path.join(ctx.ud, "logs");
      const found = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const fp = path.join(d, e.name);
          if (e.isDirectory()) walk(fp);
          else if (e.name === (file || "kdb.log")) found.push(fp);
        }
      };
      if (fs.existsSync(logs)) walk(logs);
      if (!found.length) return `no ${file || "kdb.log"} found under ${logs}`;
      found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      return fs.readFileSync(found[0], "utf8").split("\n").slice(-(lines || 40)).join("\n");
    },

    eval: async ({ js }) => {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const r = await new AsyncFunction("ctx", "win", "app", "sleep", js)(ctx, win, app, sleep);
      return r === undefined ? "undefined" : typeof r === "string" ? r : JSON.stringify(r);
    },
  };
  return H;
}

module.exports = { makeHandlers };




