#!/usr/bin/env python3
"""Fetch the fishdb economic-species listing (all rows on one page) and parse it.

Output: data/list.json  (array of listing rows)
Cache:  data/raw/list.html (reused if present; delete it to force a re-fetch)

Run:  python3 -I scripts/scrape_list.py [--refresh]
Standard library only.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_LIST = ROOT / "data" / "raw" / "list.html"
OUT = ROOT / "data" / "list.json"

LIST_URL = "https://fishdb.sinica.edu.tw/chi/fisheconomic.php?page=1&R1=&pz=500&dere=&key="
BASE = "https://fishdb.sinica.edu.tw/chi/"
USER_AGENT = "taiwan-fish-explorer/1.0 (personal research; contact via github)"
EXPECTED_ROWS = 499


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

ROW_RE = re.compile(r"<tr>\s*<td[^>]*class=['\"]?tdN['\"]?[^>]*>.*?</tr>", re.S | re.I)
TD_RE = re.compile(r"<td\b[^>]*>(.*?)</td>", re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)


def clean_text(fragment: str) -> str:
    text = TAG_RE.sub(" ", fragment)
    text = html.unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def absolutize(src: str) -> str:
    src = html.unescape(src.strip())
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("http://"):
        src = "https://" + src[len("http://"):]
    elif not src.startswith("https://"):
        # relative to /chi/ (or root-relative)
        if src.startswith("/"):
            src = "https://fishdb.sinica.edu.tw" + src
        else:
            src = BASE + src.lstrip("./")
    return src


def fetch_list() -> str:
    req = urllib.request.Request(LIST_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60, context=SSL_CONTEXT) as resp:
        data = resp.read()
    RAW_LIST.parent.mkdir(parents=True, exist_ok=True)
    RAW_LIST.write_bytes(data)
    return data.decode("utf-8", errors="replace")


def parse_rows(page: str) -> list[dict]:
    page = COMMENT_RE.sub("", page)
    out = []
    for row in ROW_RE.findall(page):
        tds = TD_RE.findall(row)
        if len(tds) < 8:
            continue
        # tds[0] is a decorative bullet image; real columns start at tds[1]
        fam_td, sci_td, zh_td, common_td, season_td, price_td, photo_td = tds[1:8]

        fam = re.search(r"family\.php\?id=([A-Za-z0-9]+)", fam_td)
        sp = re.search(r"species\.php\?id=(\d+)", sci_td) or re.search(r"species\.php\?id=(\d+)", row)
        if not sp:
            raise ValueError(f"row without species id: {row[:200]}")
        price = re.search(r"price(\d)\.gif", price_td)
        photo = re.search(r"<img\b[^>]*\bsrc=['\"]([^'\"]+)['\"]", photo_td, re.I)

        price_val = int(price.group(1)) if price else None
        if price_val is not None and not 1 <= price_val <= 5:
            price_val = None

        out.append({
            "id": sp.group(1),
            "family_id": fam.group(1) if fam else "",
            "family_zh": clean_text(fam_td),
            "scientific": clean_text(sci_td),
            "name_zh": clean_text(zh_td),
            "common_names_raw": clean_text(common_td),
            "season": clean_text(season_td),
            "price": price_val,
            "photo_thumb": absolutize(photo.group(1)) if photo else None,
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="ignore the cached list.html and re-fetch")
    args = ap.parse_args()

    if RAW_LIST.exists() and not args.refresh:
        print(f"using cache {RAW_LIST.relative_to(ROOT)}")
        page = RAW_LIST.read_bytes().decode("utf-8", errors="replace")
    else:
        print(f"fetching {LIST_URL}")
        page = fetch_list()

    rows = parse_rows(page)
    ids = [r["id"] for r in rows]
    assert len(rows) == EXPECTED_ROWS, f"expected {EXPECTED_ROWS} rows, got {len(rows)}"
    assert len(set(ids)) == len(ids), "duplicate species ids in listing"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    priced = sum(1 for r in rows if r["price"] is not None)
    print(f"wrote {len(rows)} rows to {OUT.relative_to(ROOT)} ({priced} with price, "
          f"{sum(1 for r in rows if r['season'])} with season)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
