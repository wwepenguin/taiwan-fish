#!/usr/bin/env python3
"""Download every species detail page listed in data/list.json into the raw cache.

    python3 -I scripts/scrape_details.py               # everything not yet cached
    python3 -I scripts/scrape_details.py --limit 5     # at most 5 network fetches (testing)
    python3 -I scripts/scrape_details.py --ids 382143,383226
    python3 -I scripts/scrape_details.py --force --ids 382143   # re-download even if cached

Pages go to data/raw/species/<id>.html. A cached file that looks complete (contains
"漁業利用" or "資料維護") is skipped, so the script is resumable: interrupt it at any
time (Ctrl-C) and run it again. Requests are strictly sequential with a 3-second pause
between network requests. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST_JSON = ROOT / "data" / "list.json"
SPECIES_DIR = ROOT / "data" / "raw" / "species"

DETAIL_URL = "https://fishdb.sinica.edu.tw/chi/species.php?id={id}"
USER_AGENT = "taiwan-fish-explorer/1.0 (personal research; contact via github)"
DELAY_S = 3.0
TIMEOUT_S = 30
MAX_ATTEMPTS = 3
BACKOFF_S = (5, 15, 45)  # wait after attempt 1, 2 (and 3, unused)
COMPLETE_MARKERS = ("漁業利用", "資料維護")


def make_ssl_context() -> ssl.SSLContext:
    """Verified TLS context. python.org builds of Python on macOS ship without a CA
    bundle unless "Install Certificates.command" was run; fall back to the system
    bundle (/etc/ssl/cert.pem) so verification still works without third-party packages."""
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats().get("x509_ca", 0) == 0:
        for bundle in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt"):
            if Path(bundle).is_file():
                ctx.load_verify_locations(bundle)
                break
    return ctx


SSL_CONTEXT = make_ssl_context()


def looks_complete(data: bytes) -> bool:
    text = data.decode("utf-8", errors="replace")
    return any(m in text for m in COMPLETE_MARKERS)


def cached_ok(path: Path) -> bool:
    try:
        return path.is_file() and looks_complete(path.read_bytes())
    except OSError:
        return False


def fetch_once(sid: str) -> bytes:
    req = urllib.request.Request(
        DETAIL_URL.format(id=sid),
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8", "Accept-Language": "zh-TW,zh;q=0.9"},
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT_S, context=SSL_CONTEXT) as resp:
        return resp.read()


def fetch_with_retry(sid: str) -> tuple[bytes | None, str]:
    """Return (data, status). data is None on final failure."""
    last = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            data = fetch_once(sid)
            if looks_complete(data):
                return data, f"ok {len(data)}B" + (f" (attempt {attempt})" if attempt > 1 else "")
            last = f"incomplete page ({len(data)}B)"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code == 404:
                return None, last
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
            if isinstance(getattr(e, "reason", e), ssl.SSLCertVerificationError):
                return None, last + " (not retrying; set SSL_CERT_FILE to a CA bundle)"
        if attempt < MAX_ATTEMPTS:
            wait = BACKOFF_S[attempt - 1]
            print(f"      {sid}: attempt {attempt} failed ({last}); retrying in {wait}s", flush=True)
            time.sleep(wait)
    return None, f"FAILED after {MAX_ATTEMPTS} attempts: {last}"


def atomic_write(path: Path, data: bytes) -> None:
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=None, help="stop after N network fetches")
    ap.add_argument("--ids", type=str, default=None, help="comma-separated species ids to process")
    ap.add_argument("--force", action="store_true", help="re-download even if a complete cache file exists")
    ap.add_argument("--delay", type=float, default=DELAY_S, help=argparse.SUPPRESS)
    args = ap.parse_args()
    delay = max(args.delay, DELAY_S)  # never go below 3 s

    rows = json.loads(LIST_JSON.read_text(encoding="utf-8"))
    ids = [r["id"] for r in rows]
    if args.ids:
        wanted = [s.strip() for s in args.ids.split(",") if s.strip()]
        unknown = [s for s in wanted if s not in set(ids)]
        if unknown:
            print(f"warning: ids not in list.json (fetching anyway): {','.join(unknown)}")
        ids = wanted

    SPECIES_DIR.mkdir(parents=True, exist_ok=True)
    total = len(ids)
    fetched = skipped = failed = 0
    failures: list[str] = []
    last_request = 0.0

    try:
        for n, sid in enumerate(ids, 1):
            path = SPECIES_DIR / f"{sid}.html"
            if not args.force and cached_ok(path):
                skipped += 1
                print(f"{n}/{total} {sid} cached", flush=True)
                continue
            if args.limit is not None and fetched + failed >= args.limit:
                print(f"--limit {args.limit} reached; stopping")
                break

            wait = delay - (time.monotonic() - last_request)
            if last_request and wait > 0:
                time.sleep(wait)
            data, status = fetch_with_retry(sid)
            last_request = time.monotonic()

            if data is not None:
                atomic_write(path, data)
                fetched += 1
            else:
                failed += 1
                failures.append(sid)
            print(f"{n}/{total} {sid} {status}", flush=True)
    except KeyboardInterrupt:
        print("\ninterrupted; re-run the same command to resume")

    print(f"done: fetched={fetched} cached={skipped} failed={failed}")
    if failures:
        print("failed ids (re-run to retry): " + ",".join(failures))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
