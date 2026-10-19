# Data scripts

Python 3.12, standard library only. Run from the project root, in this order:

```sh
python3 -I scripts/scrape_list.py      # listing (499 rows) -> data/list.json
python3 -I scripts/scrape_details.py   # detail pages -> data/raw/species/<id>.html
python3 -I scripts/build_dataset.py    # -> public/data/fish.json + public/data/meta.json
```

- `scrape_list.py` reuses `data/raw/list.html` if it exists (`--refresh` to re-fetch).
- `scrape_details.py` makes one request at a time with a **3-second pause** between
  requests (robots.txt asks for 10 s; 3 s was chosen in PLAN.md), so the full
  crawl of 499 pages takes about 25-30 minutes. Each request has a 30 s timeout and up
  to 3 attempts with backoff.
- **Resume:** just run `scrape_details.py` again. Cached pages that look complete
  (contain 「漁業利用」 or 「資料維護」) are skipped; failed ids are listed at the end and
  retried on the next run. Ctrl-C is safe (pages are written atomically).
- Testing flags: `--limit N` (stop after N network fetches), `--ids 382143,383226`,
  `--force` (re-download even if cached).
- `build_dataset.py` can be re-run at any time; species without a cached detail page
  get `detail_fetched: false` and `null` / `[]` for the detail fields.
- TLS: if this Python has no CA bundle (python.org macOS builds before running
  "Install Certificates.command"), the scripts fall back to `/etc/ssl/cert.pem`.
