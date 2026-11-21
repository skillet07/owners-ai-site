/* Счётчики в карточках ситуаций: число растёт от 0 до data-to, когда карточку видно. */
(function () {
  var lives = document.querySelectorAll(".live[data-to]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function run(el) {
    var to = +el.getAttribute("data-to"), ns = el.querySelectorAll(".n");
    if (reduce) { ns.forEach(function (n) { n.textContent = to; }); return; }
    var t0 = performance.now(), dur = 2600 + to * 20;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 2)));
      ns.forEach(function (n) { n.textContent = v; });
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  if (!("IntersectionObserver" in window)) { lives.forEach(run); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); setTimeout(function () { run(e.target); }, 400); } });
  }, { threshold: .6 });
  lives.forEach(function (l) { io.observe(l); });
})();
