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
      beats.forEach(function (b) {
        timers.push(setTimeout(function () { b.classList.add("on"); }, +b.dataset.beat));
      });
    }
    var btn = scene.querySelector(".replay");
    if (btn) btn.addEventListener("click", play);
    return play;
  }
  function finalState(scene) {
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
