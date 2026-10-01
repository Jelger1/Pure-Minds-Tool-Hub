# render.mjs — headless-Chrome harness for the Presentation Maker

Run from this folder with Node 24 (no deps):

    node render.mjs --root C:/Users/Jelge/Documents/Pure-Minds-Tool-Hub --out <dir> [options]

Options:
- `--slides`        click every slide in the strip and save `#slideCanvas` as `<out>/slide-NN.png` (1920x1080)
- `--shot app.png`  window screenshot (1600x1000) after load (and after `--eval`)
- `--query "type=positionering"`  query string for the page (start params)
- `--state file.json`  JSON put in localStorage `pm-presentation-v1` before load
- `--eval "js"`     expression evaluated (awaited) in the page after load; result printed as `EVAL: ...`
- `--page index.html`  other page (default `tools/presentation.html`)
- `--wait 1500`     ms to wait after fonts are ready

Tours are pre-set to 'skipped'. Page console errors/exceptions are printed at the end (`ERRORS: none` when clean).
Each run uses a fresh Chrome profile (clean localStorage/IndexedDB).

Baseline (git HEAD, before the positioning work): copy in `../baseline`, renders in `../baseline-out/slide-01..07.png` (regular example deck) and `app.png`.
