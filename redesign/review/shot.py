"""Проверка редизайна: снимки, ошибки JS, горизонтальная прокрутка, reduced-motion.
Запуск: python3 review/shot.py [страницы через запятую] [--full]  (сервер: python3 -m http.server 8765 из prototypes/)"""
import sys, json
from pathlib import Path
from playwright.sync_api import sync_playwright
EXE = "/Users/lennox/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
BASE = "http://localhost:8765/redesign/"
OUT = Path(__file__).parent / "shots"; OUT.mkdir(exist_ok=True)
pages = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "index,vnedrenie,obuchenie,vtoroy-mozg").split(",")
full = "--full" in sys.argv
sizes = [(360, 740), (390, 844), (1024, 768), (1440, 900)]
report = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    for pg in pages:
        for w, h in sizes:
            for lang in ("ru", "en"):
                for rm in ("no-preference", "reduce"):
                    if rm == "reduce" and (lang == "en" or w not in (390, 1440)): continue
                    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 500 else 1,
                                        reduced_motion=rm, is_mobile=w < 500, has_touch=w < 500)
                    page = ctx.new_page(); errs = []
                    page.on("pageerror", lambda e: errs.append(str(e)))
                    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                    page.goto(f"{BASE}{pg}.html?lang={lang}", wait_until="networkidle")
                    page.wait_for_timeout(3600 if rm != "reduce" else 400)
                    tag = f"{pg}-{w}-{lang}" + ("-rm" if rm == "reduce" else "")
                    page.screenshot(path=str(OUT / f"{tag}-fold.png"))
                    if full and w in (390, 1440) and rm != "reduce":
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); page.wait_for_timeout(2500)
                        page.evaluate("window.scrollTo(0, 0)"); page.wait_for_timeout(300)
                        page.screenshot(path=str(OUT / f"{tag}-full.png"), full_page=True)
                    ov = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                    wide = page.evaluate("""() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(e => e.tagName + '.' + e.className)""")
                    report.append({"tag": tag, "overflow": ov, "errors": errs, "wide": wide})
                    ctx.close()
    b.close()
bad = [r for r in report if r["overflow"] > 0 or r["errors"]]
print(json.dumps(bad or "ALL OK", ensure_ascii=False, indent=1)[:4000])
print(len(report), "runs")
