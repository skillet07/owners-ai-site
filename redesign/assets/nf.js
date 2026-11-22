/* Сначала цифра – табло. Без зависимостей. */
(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var light = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || window.innerWidth < 700;
  var TICK = light ? 90 : 60;
  var listeners = [];

  /* ---------- язык ---------- */
  function setLang(lang, save) {
    if (lang !== "ru" && lang !== "en") lang = "ru";
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    var t = root.getAttribute("data-title-" + lang);
    if (t) document.title = t;
    document.querySelectorAll(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.set === lang)); });
    if (save) { try { localStorage.setItem("nb-lang", lang); } catch (e) {} }
    listeners.forEach(function (fn) { fn(lang); });
  }
  var q = new URLSearchParams(location.search).get("lang"), stored = null;
  try { stored = localStorage.getItem("nb-lang"); } catch (e) {}
  var initial = q || stored || ((navigator.language || "ru").slice(0, 2) === "ru" ? "ru" : "en");
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.set, true); });
  });
  // ссылки между страницами несут язык
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href$='.html'],a[href*='.html#']");
    if (!a || a.target) return;
    var u = new URL(a.getAttribute("href"), location.href);
    if (u.origin !== location.origin) return;
    u.searchParams.set("lang", NB.lang());
    a.setAttribute("href", u.pathname.split("/").pop() + u.search + u.hash);
  }, true);

  var NB = window.NB = {
    lang: function () { return root.getAttribute("data-lang") || "ru"; },
    onLang: function (fn) { listeners.push(fn); },
    reduce: reduce,
    money: function (n, lang) {
      var v = Math.round(n);
      if (lang === "en") return "$" + v.toLocaleString("en-US");
      return v.toLocaleString("ru-RU").replace(/ | /g, " ") + " ₽";
    },
    flapTo: flapTo, flapSet: flapSet, flapSpin: flapSpin
  };
  setLang(initial, false);

  /* ---------- флапы ---------- */
  var DIG = "0123456789", LET = "АБВГДЕЖЗИКЛМНОПРСТУХЦЧЭЯ";
  function rnd(target) {
    var s = /\d/.test(target) ? DIG : /[A-Za-z]/.test(target) ? "ABCDEFGHKLMNPRSTUVWX" : LET;
    return s.charAt((Math.random() * s.length) | 0);
  }
  function build(el, text) {
    el.innerHTML = "";
    el._c = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), s = document.createElement("span");
      s.className = ch === " " ? "c sp" : "c";
      s.textContent = ch === " " || ch === "\u00a0" ? "" : ch;
      s.setAttribute("aria-hidden", "true");
      el.appendChild(s); el._c.push(s);
    }
    el._text = text;
  }
  function label(el, text) {
    var l = el.querySelector(".sr") || document.createElement("span");
    l.className = "sr"; l.textContent = text.trim();
    el.appendChild(l);
  }
  function flick(c) {
    if (light) return;
    c.classList.remove("fa", "fb");
    c.classList.add(c._f ? "fb" : "fa"); c._f = !c._f;
  }
  function stop(el) { if (el._iv) { clearInterval(el._iv); el._iv = null; } }
  // мгновенно или с перещёлкиванием только изменённых ячеек
  function flapSet(el, text) {
    stop(el);
    if (!el._c || el._c.length !== text.length) build(el, text);
    else el._c.forEach(function (c, i) {
      var ch = text.charAt(i), d = ch === "\u00a0" ? "" : ch;
      if (c.textContent !== d && ch !== " ") { c.textContent = d; if (!reduce) flick(c); }
    });
    el._text = text;
    label(el, text);
  }
  // крутится, пока не замерили
  function flapSpin(el, len) {
    stop(el);
    var shape = el._text || "";
    if (!el._c || (len && el._c.length !== len)) build(el, shape || new Array(len + 1).join("0"));
    if (reduce) return;
    el.classList.add("spin"); el.classList.remove("lock");
    el._iv = setInterval(function () {
      el._c.forEach(function (c, i) {
        if (c.classList.contains("sp")) return;
        c.textContent = rnd(shape.charAt(i) || "0"); flick(c);
      });
    }, TICK);
  }
  // крутится spin мс, потом застывает слева направо
  function flapTo(el, text, opt) {
    opt = opt || {};
    stop(el);
    if (reduce || opt.instant) {
      build(el, text); label(el, text);
      el.classList.remove("spin"); el.classList.add("lock");
      if (opt.done) opt.done();
      return;
    }
    if (!el._c || el._c.length !== text.length) build(el, text);
    label(el, text);
    el._text = text;
    el.classList.add("spin"); el.classList.remove("lock");
    var spin = opt.spin == null ? 600 : opt.spin, stag = opt.stagger == null ? 90 : opt.stagger, t0 = performance.now();
    var locked = el._c.map(function () { return false; });
    el._iv = setInterval(function () {
      var dt = performance.now() - t0, all = true;
      el._c.forEach(function (c, i) {
        if (locked[i]) return;
        var ch = text.charAt(i);
        if (ch === " ") { locked[i] = true; return; }
        if (ch === "\u00a0") { c.textContent = ""; locked[i] = true; return; }
        if (dt >= spin + i * stag) { c.textContent = ch; locked[i] = true; flick(c); }
        else { all = false; c.textContent = rnd(ch); flick(c); }
      });
      if (all) { stop(el); el.classList.remove("spin"); el.classList.add("lock"); if (opt.done) opt.done(); }
    }, TICK);
  }
  function val(el) { return el.getAttribute("data-v-" + NB.lang()) || el.getAttribute("data-v") || ""; }

  /* ---------- слова заголовка ---------- */
  function splitWords() {
    document.querySelectorAll("[data-words]").forEach(function (h) {
      var i = 0;
      h.querySelectorAll("[lang]").forEach(function (part) {
        var html = part.innerHTML.trim().split(/\s+/);
        part.innerHTML = html.map(function (w) {
          return '<span class="w" style="--i:' + (i++) + '"><span class="tile">' + w + "</span></span>";
        }).join(" ");
      });
    });
  }

  /* ---------- табло первого экрана ---------- */
  function initBoard() {
    var board = document.querySelector("[data-board]");
    if (!board) return;
    var rows = Array.prototype.slice.call(board.querySelectorAll(".brow"));
    var meas = board.querySelector(".meas");
    var started = false;
    function finish() {
      rows.forEach(function (r) { r.classList.remove("on"); r.querySelector(".cap").classList.remove("wait"); });
      if (meas) meas.classList.add("done");
    }
    function run() {
      started = true;
      if (meas) meas.classList.remove("done");
      rows.forEach(function (r, i) {
        var fl = r.querySelector(".fl"), cap = r.querySelector(".cap");
        cap.classList.add("wait");
        flapSpin(fl, val(fl).length);
        setTimeout(function () {
          rows.forEach(function (x) { x.classList.remove("on"); });
          r.classList.add("on");
          flapTo(fl, val(fl), { spin: 0, stagger: 110, done: function () {
            cap.classList.remove("wait");
            if (i === rows.length - 1) setTimeout(finish, 500);
          } });
        }, 700 + i * 650);
      });
    }
    rows.forEach(function (r) { var fl = r.querySelector(".fl"); build(fl, val(fl)); label(fl, val(fl)); });
    if (reduce) { rows.forEach(function (r) { var fl = r.querySelector(".fl"); flapTo(fl, val(fl), { instant: true }); }); finish(); }
    else run();
    NB.onLang(function () {
      if (!started) return;
      rows.forEach(function (r) { var fl = r.querySelector(".fl"); flapTo(fl, val(fl), { spin: 200, stagger: 50 }); });
    });
  }

  /* ---------- счётчик порога ---------- */
  function initMeters() {
    document.querySelectorAll("[data-meter]").forEach(function (box) {
      var m = box.querySelector(".meter"), fl = m.querySelector(".fl"), bar = m.querySelector(".bar");
      var goal = +box.getAttribute("data-goal") || 80;
      var ends = { hit: +box.getAttribute("data-hit") || 86, miss: +box.getAttribute("data-miss") || 64 };
      var raf = 0;
      function show(mode, v) {
        fl.parentNode && flapSet(fl, (v < 10 ? "\u00a0" : "") + v + "%");
        bar.style.setProperty("--v", v);
        m.classList.toggle("hit", v >= goal);
        box.querySelectorAll("[data-for]").forEach(function (p) { p.hidden = true; });
      }
      function end(mode) {
        box.querySelectorAll("[data-for]").forEach(function (p) { p.hidden = p.getAttribute("data-for") !== mode; });
        fl.classList.toggle("hot", mode === "hit");
      }
      function play(mode) {
        cancelAnimationFrame(raf);
        box.querySelectorAll(".seg button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });
        fl.classList.remove("hot");
        var to = ends[mode];
        if (reduce) { show(mode, to); end(mode); return; }
        var t0 = performance.now(), dur = 2400, last = -1;
        (function step(now) {
          var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = Math.round(to * e);
          if (v !== last) { show(mode, v); last = v; }
          if (p < 1) raf = requestAnimationFrame(step); else end(mode);
        })(t0);
      }
      box.querySelectorAll(".seg button").forEach(function (b) { b.addEventListener("click", function () { play(b.dataset.mode); }); });
      show("hit", 0);
      if (reduce || !("IntersectionObserver" in window)) { play("hit"); return; }
      var io = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { io.disconnect(); play("hit"); }
      }, { threshold: .45 });
      io.observe(m);
    });
  }

  /* ---------- маршрут: линия растёт с прокруткой ---------- */
  function initRoute() {
    var stops = Array.prototype.slice.call(document.querySelectorAll(".stop"));
    if (!stops.length) return;
    if (reduce) { stops.forEach(function (s) { s.classList.add("lit"); s.style.setProperty("--p", 1); }); return; }
    var q2 = false;
    function upd() {
      q2 = false;
      var line = window.innerHeight * .62;
      stops.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var p = Math.max(0, Math.min(1, (line - r.top - 15) / Math.max(1, r.height)));
        s.style.setProperty("--p", p.toFixed(3));
        s.classList.toggle("lit", r.top + 15 < line);
      });
    }
    function qu() { if (!q2) { q2 = true; requestAnimationFrame(upd); } }
    window.addEventListener("scroll", qu, { passive: true });
    window.addEventListener("resize", qu);
    upd();
  }

  /* ---------- сцены переписки ---------- */
  function fmtClock(v, mode, to) {
    if (mode === "count") { var w = String(Math.max(to, +v)).length; var s = String(Math.round(v)); while (s.length < w) s = "\u00a0" + s; return s; }
    var m = Math.floor(v / 60), s2 = Math.floor(v % 60);
    return (m < 10 ? "0" : "") + m + ":" + (s2 < 10 ? "0" : "") + s2;
  }
  function initScenes() {
    document.querySelectorAll("[data-scene]").forEach(function (sc) {
      var chat = sc.querySelector(".chat"), msgs = sc.querySelectorAll(".msg"), clk = sc.querySelector("[data-clock]");
      var mode = clk ? clk.getAttribute("data-clock") : "", from = clk ? +clk.dataset.from : 0, to = clk ? +clk.dataset.to : 0;
      var cs = clk ? +clk.dataset.start : 0, cd = clk ? +clk.dataset.dur : 0;
      var timers = [], raf = 0;
      function clear() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
      function done() {
        chat.classList.add("done");
        msgs.forEach(function (m) { m.classList.add("on"); });
        if (clk) { flapSet(clk, fmtClock(to, mode, Math.max(from, to))); clk.classList.add("hot"); }
      }
      function play() {
        clear(); chat.classList.remove("done");
        msgs.forEach(function (m) { m.classList.remove("on"); });
        if (clk) { clk.classList.remove("hot"); flapSet(clk, fmtClock(from, mode, Math.max(from, to))); }
        msgs.forEach(function (m) { timers.push(setTimeout(function () { m.classList.add("on"); }, +m.dataset.beat || 0)); });
        if (clk) timers.push(setTimeout(function () {
          var t0 = performance.now(), last = "";
          (function step(now) {
            var p = Math.min(1, (now - t0) / cd), v = from + (to - from) * p;
            var s = fmtClock(v, mode, Math.max(from, to));
            if (s !== last && (now - (step.t || 0) > TICK || p === 1)) { flapSet(clk, s); last = s; step.t = now; }
            if (p < 1) raf = requestAnimationFrame(step); else clk.classList.add("hot");
          })(t0);
        }, cs));
        var lastBeat = 0; msgs.forEach(function (m) { lastBeat = Math.max(lastBeat, +m.dataset.beat || 0); });
        timers.push(setTimeout(done, Math.max(lastBeat, cs + cd) + 300));
      }
      if (clk) flapSet(clk, fmtClock(from, mode, Math.max(from, to)));
      var rp = sc.querySelector(".replay");
      if (rp) rp.addEventListener("click", function () { if (reduce) done(); else play(); });
      if (reduce || !("IntersectionObserver" in window)) { done(); return; }
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); play(); } }, { threshold: .35 });
      io.observe(sc);
    });
  }

  /* ---------- калькулятор: цифра крутится, пока двигают ползунок ---------- */
  NB.liveNumber = function (el, getText) {
    var t = 0, first = true;
    return function (fromUser) {
      var text = getText();
      if (first || reduce || !fromUser) { flapSet(el, text); first = false; return; }
      if (!el._iv) flapSpin(el, text.length);
      el._text = text;
      clearTimeout(t);
      t = setTimeout(function () { flapTo(el, text, { spin: 0, stagger: 45 }); }, 380);
    };
  };
  NB.fill = function (input) {
    var p = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty("--f", p + "%");
  };

  /* ---------- плавающая кнопка на телефоне ---------- */
  function initDock() {
    var dock = document.querySelector(".dock"), hero = document.querySelector(".hero"), fin = document.querySelector("#contact");
    if (!dock || !hero || !("IntersectionObserver" in window)) return;
    var heroOut = false, finIn = false;
    function upd() { dock.classList.toggle("show", heroOut && !finIn); }
    new IntersectionObserver(function (e) { heroOut = !e[0].isIntersecting; upd(); }, { rootMargin: "-40% 0px 0px 0px" }).observe(hero);
    if (fin) new IntersectionObserver(function (e) { finIn = e[0].isIntersecting; upd(); }).observe(fin);
  }

  /* ---------- квиз «примеры с рынка» ---------- */
  function initQuiz() {
    var qz = document.querySelector(".quiz"), data = window.NB_CASES;
    if (!qz || !data) return;
    var PAGE = 3, st = { ind: null, pain: null, shown: 0 };
    var ARROW = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var T = {
      ru: { best: "Лучшие кейсы отрасли", casesOf: function (n) { return n + " " + plural(n, ["кейс", "кейса", "кейсов"]); },
            title: function (i, p) { return i + " · " + (p || "лучшие кейсы"); },
            filled: function (n) { return "Под эту задачу в отрасли " + (n === 1 ? "один кейс" : n + " кейса") + ". Ниже добавили самые сильные кейсы отрасли."; },
            res: "Результат", route: "как мы это решаем" },
      en: { best: "Best cases in this industry", casesOf: function (n) { return n + (n === 1 ? " case" : " cases"); },
            title: function (i, p) { return i + " · " + (p || "best cases"); },
            filled: function (n) { return "This industry has " + (n === 1 ? "one case" : n + " cases") + " for this task. We’ve added the strongest cases from the industry below."; },
            res: "Result", route: "how we handle it" }
    };
    var ROUTES = [
      { href: "vtoroy-mozg.html", ru: "Ушёл человек, на котором всё держалось", en: "The person everything relied on has left" },
      { href: "obuchenie.html", ru: "Уже внедряли – не прижилось", en: "We already tried AI – it didn’t stick" }
    ];
    function plural(n, f) { var a = n % 10, b = n % 100; return a === 1 && b !== 11 ? f[0] : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? f[1] : f[2]; }
    function L() { return NB.lang() === "en" ? "en" : "ru"; }
    function nums(h) { return h.replace(/([+−-]?\d[\d  ]*(?:[.,]\d+)?\s?(?:%|×|раза?|times)?)/g, '<span class="n">$1</span>'); }
    function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
    function ind() { return data.industries.filter(function (i) { return i.id === st.ind; })[0]; }
    function painById(id) { return data.pains.filter(function (p) { return p.id === id; })[0]; }
    function selection() {
      var I = ind(); if (!I) return null;
      if (st.pain === "all") return { cases: I.cases, painCount: I.cases.length, filled: false };
      var m = I.cases.filter(function (c) { return c.pains.indexOf(st.pain) > -1; });
      if (m.length >= PAGE) return { cases: m, painCount: m.length, filled: false };
      var rest = I.cases.filter(function (c) { return m.indexOf(c) === -1; });
      return { cases: m.concat(rest), painCount: m.length, filled: true };
    }
    var panels = qz.querySelectorAll(".qpanel");
    function show(step, focus) {
      qz.setAttribute("data-step", String(step));
      panels.forEach(function (p) {
        var on = +p.dataset.panel === step;
        p.hidden = !on;
        if (on && !reduce) { p.classList.remove("enter"); void p.offsetWidth; p.classList.add("enter"); }
      });
      qz.querySelector('[data-go="2"]').disabled = !st.ind;
      qz.querySelector('[data-go="3"]').disabled = !st.pain;
      var r = qz.getBoundingClientRect();
      if (focus && (r.top < 60 || r.top > innerHeight * .6)) window.scrollTo({ top: scrollY + r.top - 80, behavior: reduce ? "auto" : "smooth" });
      if (focus) { var h = qz.querySelector('.qpanel[data-panel="' + step + '"] .qq'); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); } }
    }
    function renderInd() {
      var l = L();
      qz.querySelector('[data-list="ind"]').innerHTML = data.industries.map(function (i) {
        return '<button type="button" data-ind="' + i.id + '" aria-pressed="' + (i.id === st.ind) + '"><span>' + esc(i[l]) + "</span><small>" + T[l].casesOf(i.cases.length) + "</small></button>";
      }).join("");
    }
    function renderPains() {
      var I = ind(); if (!I) return;
      var l = L();
      var html = '<button type="button" class="best" data-pain="all"><span>' + T[l].best + "</span>" + ARROW + "</button>";
      data.pains.forEach(function (p) {
        var n = I.cases.filter(function (c) { return c.pains.indexOf(p.id) > -1; }).length;
        if (!n) return;
        html += '<button type="button" data-pain="' + p.id + '" aria-pressed="' + (p.id === st.pain) + '"><span>' + esc(p[l]) + "</span><small>" + T[l].casesOf(n) + "</small></button>";
      });
      ROUTES.forEach(function (r) {
        html += '<a class="route" href="' + r.href + '"><span>' + r[l] + "<small>" + T[l].route + "</small></span>" + ARROW + "</a>";
      });
      qz.querySelector('[data-list="pain"]').innerHTML = html;
    }
    function caseHTML(c, i) {
      var l = L();
      return '<article class="qcase" style="--i:' + i + '"><span class="who">' + esc(c.who[l]) + '</span><p class="what">' + esc(c.what[l]) +
        '</p><p class="res"><b>' + T[l].res + "</b>" + nums(esc(c.result[l])) + "</p></article>";
    }
    function renderCases(append) {
      var sel = selection(); if (!sel) return;
      var l = L(), I = ind(), P = st.pain === "all" ? null : painById(st.pain);
      qz.querySelector("[data-title]").textContent = T[l].title(I[l], P ? P[l] : null);
      var box = qz.querySelector('[data-list="cases"]');
      var from = append ? box.querySelectorAll(".qcase").length : 0;
      var html = sel.cases.slice(from, st.shown).map(caseHTML).join("");
      if (append) box.insertAdjacentHTML("beforeend", html);
      else box.innerHTML = (sel.filled ? '<p class="qnote">' + T[l].filled(sel.painCount) + "</p>" : "") + html;
      qz.querySelector("[data-more]").hidden = st.shown >= sel.cases.length;
    }
    function rerender() {
      renderInd(); renderPains();
      var l = L(), pi = qz.querySelector('[data-pick="ind"]'), pp = qz.querySelector('[data-pick="pain"]');
      pi.textContent = ind() ? ind()[l] : "";
      pp.textContent = st.pain === "all" ? T[l].best : st.pain ? painById(st.pain)[l] : "";
      if (st.pain) renderCases(false);
    }
    qz.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !qz.contains(b)) return;
      if (b.dataset.ind) { st.ind = b.dataset.ind; st.pain = null; st.shown = 0; rerender(); show(2, true); }
      else if (b.dataset.pain) { st.pain = b.dataset.pain; st.shown = PAGE; rerender(); show(3, true); }
      else if (b.hasAttribute("data-more")) { st.shown += PAGE; renderCases(true); }
      else if (b.dataset.go) { show(+b.dataset.go, true); }
    });
    NB.onLang(rerender);
    rerender(); show(1, false);
  }

  function boot() {
    splitWords(); initBoard(); initMeters(); initRoute(); initScenes(); initDock(); initQuiz();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
