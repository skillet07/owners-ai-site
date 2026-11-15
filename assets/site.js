(function () {
  var root = document.documentElement;
  root.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- язык ---------- */
  var listeners = [];
  function setLang(lang, save) {
    if (lang !== "ru" && lang !== "en") lang = "ru";
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    var t = root.getAttribute("data-title-" + lang);
    if (t) document.title = t;
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.set === lang));
    });
    document.querySelectorAll("[data-ph-ru]").forEach(function (el) {
      el.setAttribute("placeholder", el.getAttribute("data-ph-" + lang));
    });
    if (save) { try { localStorage.setItem("nb-lang", lang); } catch (e) {} }
    listeners.forEach(function (fn) { fn(lang); });
  }
  var q = new URLSearchParams(location.search).get("lang");
  var stored = null;
  try { stored = localStorage.getItem("nb-lang"); } catch (e) {}
  var initial = q || stored || ((navigator.language || "ru").slice(0, 2) === "ru" ? "ru" : "en");
  document.querySelectorAll(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.dataset.set, true); });
  });

  window.NB = {
    lang: function () { return root.getAttribute("data-lang"); },
    onLang: function (fn) { listeners.push(fn); },
    money: function (n, lang) {
      var v = Math.round(n);
      if (lang === "en") return "$" + v.toLocaleString("en-US");
      return v.toLocaleString("ru-RU").replace(/ /g, " ") + " ₽";
    }
  };

  /* ---------- сцена в кадре ---------- */
  function fmt(sec, clock) {
    if (clock && clock.dataset.mode === "count") return String(Math.round(sec));
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function runScene(scene) {
    var beats = Array.prototype.slice.call(scene.querySelectorAll("[data-beat]"));
    var clock = scene.querySelector(".clock");
    var timers = [];
    function clear() { timers.forEach(clearTimeout); timers = []; if (scene._raf) cancelAnimationFrame(scene._raf); }
    function play() {
      clear();
      scene.classList.add("armed");
      beats.forEach(function (b) { b.classList.remove("on"); });
      if (clock) {
        clock.classList.remove("alarm");
        var from = +clock.dataset.from || 0, to = +clock.dataset.to || 0;
        var start = +clock.dataset.start || 0, dur = +clock.dataset.dur || 3000;
        var face = clock.querySelector(".face");
        face.textContent = fmt(from, clock);
        timers.push(setTimeout(function () {
          var t0 = performance.now();
          function step(now) {
            var k = Math.min(1, (now - t0) / dur);
            var e = 1 - Math.pow(1 - k, 3);
            face.textContent = fmt(from + (to - from) * e, clock);
            if (k < 1) scene._raf = requestAnimationFrame(step);
            else clock.classList.add("alarm");
          }
          scene._raf = requestAnimationFrame(step);
        }, start));
      }
      var sign = scene.querySelector(".row.sign");
      if (sign) { sign.classList.remove("signed"); resetPad(sign); }
      beats.forEach(function (b) {
        timers.push(setTimeout(function () {
          b.classList.add("on");
          if (b === sign) timers.push(setTimeout(function () { markSigned(sign); }, 1700));
        }, +b.dataset.beat));
      });
    }
    var btn = scene.querySelector(".replay");
    if (btn) btn.addEventListener("click", play);
    return play;
  }
  function markSigned(row) {
    row.classList.add("signed");
    var ok = row.querySelector(".ok");
    if (ok) { ok.classList.remove("pop"); void ok.offsetWidth; ok.classList.add("pop"); }
  }
  function resetPad(row) {
    var pad = row.querySelector(".sigpad");
    if (!pad) return;
    pad.classList.remove("user");
    var g = pad.querySelector(".mine");
    if (g) g.innerHTML = "";
  }
  /* посетитель расписывается сам */
  function initPads() {
    document.querySelectorAll(".sigpad").forEach(function (pad) {
      var row = pad.closest(".row.sign");
      var g = pad.querySelector(".mine");
      var path = null, d = "", drawing = false;
      function pt(e) {
        var r = pad.getBoundingClientRect();
        return ((e.clientX - r.left) / r.width * 160).toFixed(1) + " " + ((e.clientY - r.top) / r.height * 48).toFixed(1);
      }
      pad.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        if (!pad.classList.contains("user")) { pad.classList.add("user"); g.innerHTML = ""; row.classList.remove("signed"); }
        drawing = true;
        try { pad.setPointerCapture(e.pointerId); } catch (x) {}
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        d = "M" + pt(e); path.setAttribute("d", d + "l.1 .1");
        g.appendChild(path);
      });
      pad.addEventListener("pointermove", function (e) {
        if (!drawing) return;
        d += "L" + pt(e); path.setAttribute("d", d);
      });
      function end() {
        if (!drawing) return;
        drawing = false;
        if (row) markSigned(row);
      }
      pad.addEventListener("pointerup", end);
      pad.addEventListener("pointercancel", end);
    });
  }

  function finalState(scene) {
    var sign = scene.querySelector(".row.sign");
    if (sign) sign.classList.add("signed");
    var clock = scene.querySelector(".clock");
    if (clock) { clock.querySelector(".face").textContent = fmt(+clock.dataset.to || 0, clock); clock.classList.add("alarm"); }
  }

  /* ---------- запуск ---------- */
  function boot() {
    setLang(initial, false);
    var scenes = document.querySelectorAll(".scene");
    if (reduce || !("IntersectionObserver" in window)) {
      scenes.forEach(finalState);
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !en.target._played) {
            en.target._played = true;
            runScene(en.target)();
          }
        });
      }, { threshold: 0.45 });
      scenes.forEach(function (s) { io.observe(s); });
    }
    var reveals = document.querySelectorAll(".reveal");
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach(function (r) { r.classList.add("in"); });
    } else {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var d = +(en.target.dataset.delay || 0);
            setTimeout(function () { en.target.classList.add("in"); }, d);
            ro.unobserve(en.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
      reveals.forEach(function (r) { ro.observe(r); });
    }
  }
  /* ---------- маркер в заголовках ---------- */
  function initMarkers() {
    var hls = document.querySelectorAll(".hl");
    if (reduce || !("IntersectionObserver" in window)) { hls.forEach(function (h) { h.classList.add("in"); }); return; }
    var mo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target;
          setTimeout(function () { el.classList.add("in"); }, el.closest(".hero") ? 450 : 150);
          mo.unobserve(el);
        }
      });
    }, { threshold: 0.6 });
    hls.forEach(function (h) { mo.observe(h); });
  }

  /* ---------- линия шагов ---------- */
  function initSteps() {
    var sheets = Array.prototype.slice.call(document.querySelectorAll(".sheet-steps"));
    if (!sheets.length) return;
    if (reduce) { sheets.forEach(function (s) { Array.prototype.forEach.call(s.children, function (c) { c.classList.add("lit"); }); }); return; }
    var queued = false;
    function update() {
      queued = false;
      var vh = window.innerHeight;
      sheets.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var p = (vh * 0.82 - r.top) / (r.height + vh * 0.25);
        p = Math.max(0, Math.min(1, p));
        s.style.setProperty("--p", p.toFixed(3));
        var kids = s.children, n = kids.length;
        for (var i = 0; i < n; i++) kids[i].classList.toggle("lit", p >= (i + 0.4) / n);
      });
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  }

  /* ---------- фон: сетка меток приводки ---------- */
  function initGrid() {
    var c = document.createElement("canvas");
    c.className = "grid-bg"; c.setAttribute("aria-hidden", "true");
    document.body.insertBefore(c, document.body.firstChild);
    var ctx = c.getContext("2d");
    if (!ctx) return;
    var S = 46, R = 180, ARM = 3.5;
    var fine = window.matchMedia("(pointer: fine)").matches;
    var W = 0, H = 0, dpr = 1, raf = 0;
    var mx = -1e4, my = -1e4;
    var waves = [];
    var vals = {};
    var base = "rgba(26,26,26,0.085)";
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var sy = window.scrollY || 0;
      var off = sy % S;
      var row0 = Math.floor(sy / S);
      var ox = (W % S) / 2;
      var busy = false;
      waves = waves.filter(function (w) { return (now - w.t0) * 1.15 < Math.hypot(W, H) + 120; });
      if (waves.length) busy = true;
      ctx.beginPath();
      var actives = [];
      for (var j = -1; j * S - off < H + S; j++) {
        var y = j * S - off + S / 2;
        for (var i = 0; ox + i * S < W + S; i++) {
          var x = ox + i * S;
          var key = (row0 + j) * 1000 + i;
          var t = 0;
          if (fine) {
            var d = Math.hypot(x - mx, y - my);
            if (d < R) { t = 1 - d / R; t *= t; }
          }
          for (var k = 0; k < waves.length; k++) {
            var w = waves[k];
            var r = (now - w.t0) * 1.15;
            var dw = Math.hypot(x - w.x, y - (w.y - sy)) - r;
            var life = Math.max(0, 1 - r / (Math.hypot(W, H) + 120));
            var tw = Math.exp(-(dw * dw) / 1800) * 0.85 * life;
            if (tw > t) t = tw;
          }
          var v = vals[key] || 0;
          v += (t - v) * (t > v ? 0.32 : 0.09);
          if (Math.abs(t - v) > 0.003) busy = true;
          if (v < 0.004) { delete vals[key]; v = 0; } else vals[key] = v;
          if (v === 0) {
            ctx.moveTo(x - ARM, y); ctx.lineTo(x + ARM, y);
            ctx.moveTo(x, y - ARM); ctx.lineTo(x, y + ARM);
          } else actives.push([x, y, v]);
        }
      }
      ctx.strokeStyle = base; ctx.lineWidth = 1.4; ctx.lineCap = "round";
      ctx.stroke();
      for (var a = 0; a < actives.length; a++) {
        var m = actives[a], v2 = m[2];
        var px = m[0], py = m[1];
        if (fine && mx > -1e3) { px += (mx - px) * 0.14 * v2; py += (my - py) * 0.14 * v2; }
        var len = ARM + 3.5 * v2, ang = v2 * Math.PI / 4;
        var cs = Math.cos(ang) * len, sn = Math.sin(ang) * len;
        ctx.beginPath();
        ctx.moveTo(px - cs, py - sn); ctx.lineTo(px + cs, py + sn);
        ctx.moveTo(px + sn, py - cs); ctx.lineTo(px - sn, py + cs);
        ctx.strokeStyle = "rgba(" + Math.round(26 + 229 * v2) + "," + Math.round(26 + 81 * v2) + "," + Math.round(26 + 18 * v2) + "," + (0.085 + 0.5 * v2).toFixed(3) + ")";
        ctx.lineWidth = 1.4 + 0.8 * v2;
        ctx.stroke();
      }
      if (busy) kick();
    }
    function waveAt(x, docY) { if (!reduce) { waves.push({ x: x, y: docY, t0: performance.now() }); kick(); } }
    if (fine && !reduce) {
      window.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse" || e.pointerType === "pen") { mx = e.clientX; my = e.clientY; kick(); } }, { passive: true });
      document.addEventListener("pointerleave", function () { mx = my = -1e4; kick(); });
      window.addEventListener("blur", function () { mx = my = -1e4; kick(); });
    }
    document.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button, input, label, select, textarea, summary, .sigpad, .screen")) return;
      waveAt(e.clientX, e.clientY + (window.scrollY || 0));
    });
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", size);
    size();
    var origin = document.querySelector(".hero .screen");
    setTimeout(function () {
      if (!origin) return;
      var r = origin.getBoundingClientRect();
      waveAt(r.left + r.width / 2, r.top + r.height / 2 + (window.scrollY || 0));
    }, 350);
  }

  var _boot = boot;
  boot = function () { _boot(); initGrid(); initMarkers(); initSteps(); initPads(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
