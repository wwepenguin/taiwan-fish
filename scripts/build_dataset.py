#!/usr/bin/env python3
"""Merge data/list.json with every cached detail page into the front-end dataset.

Inputs:  data/list.json, data/raw/species/<id>.html (any subset; missing ones are fine)
Outputs: public/data/fish.json  (array of Fish objects, see PLAN.md section 3)
         public/data/meta.json

Run:  python3 -I scripts/build_dataset.py
Standard library only. Safe to re-run at any time (e.g. while/after the detail crawl).
"""
from __future__ import annotations

import html
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parent.parent
LIST_JSON = ROOT / "data" / "list.json"
SPECIES_DIR = ROOT / "data" / "raw" / "species"
OUT_DIR = ROOT / "public" / "data"

CHI_BASE = "https://fishdb.sinica.edu.tw/chi/"
SITE = "https://fishdb.sinica.edu.tw"
SOURCE_URL = CHI_BASE + "species.php?id={id}"
NEW_SITE_URL = SITE + "/taxon/{id}-fishdb"
COMPLETE_MARKERS = ("漁業利用", "資料維護")

SEP = "\x1f"  # inserted at <img>/<br>/block boundaries inside a cell; used to split references

FISH_KEYS = [
    "id", "family_id", "family_zh", "family_latin", "scientific", "author", "name_zh", "name_cn",
    "common_names", "english_names", "synonyms", "season", "season_tags", "price",
    "photo_thumb", "photo_large", "depth_min", "depth_max", "depth_text",
    "max_length_cm", "max_length_text", "toxic", "edible", "ornamental", "economic",
    "distribution_world", "distribution_taiwan", "taiwan_regions", "habitat", "habitat_tags",
    "type_locality", "iucn_code", "iucn_text", "morphology", "ecology", "distribution_desc",
    "fishery_use", "references", "source_url", "new_site_url", "detail_fetched",
]


# --------------------------------------------------------------------------- detail parsing

class CellParser(HTMLParser):
    """Collects td.tdspt / td.tdspc cells in document order, handling nested tables.

    Each cell: {"cls": "tdspt"|"tdspc", "text": str, "imgs": [attrs dict, ...]}
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.cells: list[dict] = []
        self.td_depth = 0          # current <td> nesting depth
        self.cur: dict | None = None
        self.cur_depth = 0         # td depth at which the current capture started
        self.skip = 0              # inside <script>/<style>/<audio>/<object>

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag in ("script", "style", "audio", "object"):
            self.skip += 1
            return
        if tag == "td":
            self.td_depth += 1
            cls = a.get("class", "").split()
            hit = next((c for c in cls if c in ("tdspt", "tdspc")), None)
            if hit and self.cur is None:
                self.cur = {"cls": hit, "parts": [], "imgs": []}
                self.cur_depth = self.td_depth
                return
        if self.cur is not None:
            if tag == "img":
                self.cur["imgs"].append(a)
                self.cur["parts"].append(SEP)
            elif tag in ("br", "p", "div", "tr", "td", "li"):
                self.cur["parts"].append(SEP)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in ("script", "style", "audio", "object"):
            self.skip -= 1
        elif tag == "td":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "audio", "object"):
            self.skip = max(0, self.skip - 1)
            return
        if tag == "td":
            if self.cur is not None and self.td_depth == self.cur_depth:
                text = "".join(self.cur["parts"])
                self.cells.append({"cls": self.cur["cls"], "text": text, "imgs": self.cur["imgs"]})
                self.cur = None
            elif self.cur is not None:
                self.cur["parts"].append(SEP)
            self.td_depth = max(0, self.td_depth - 1)
        elif tag == "table" and self.cur is not None:
            self.cur["parts"].append(SEP)

    def handle_data(self, data):
        if self.cur is not None and not self.skip:
            self.cur["parts"].append(data)


def norm(text: str | None, keep_sep: bool = False) -> str:
    if text is None:
        return ""
    text = text.replace("\xa0", " ").replace("　", " ")
    if not keep_sep:
        text = text.replace(SEP, " ")
    text = re.sub(r"[ \t\r\n\f\v]+", " ", text)
    if keep_sep:
        text = re.sub(r" *\x1f[ \x1f]*", SEP, text).strip(" " + SEP)
    return text.strip()


def parse_detail(page: str) -> dict:
    """Return {label: {"text": str, "raw": str, "imgs": [...]}} plus "_photo_large"."""
    page = re.sub(r"<!--.*?-->", "", page, flags=re.S)
    p = CellParser()
    p.feed(page)
    p.close()

    fields: dict[str, dict] = {}
    label = None
    photo = None
    for cell in p.cells:
        for img in cell["imgs"]:
            src = img.get("src", "")
            if photo is None and "spe_picture/dpi300/" in src:
                photo = src
        if cell["cls"] == "tdspt":
            label = norm(cell["text"])
        elif label is not None:
            fields.setdefault(label, {"text": norm(cell["text"]), "raw": cell["text"], "imgs": cell["imgs"]})
            label = None
    if photo is None:  # fall back to anywhere on the page
        m = re.search(r"""src=["']([^"']*spe_picture/dpi300/[^"']+)["']""", page, re.I)
        photo = m.group(1) if m else None
    fields["_photo_large"] = {"text": photo or "", "raw": "", "imgs": []}
    return fields


# --------------------------------------------------------------------------- field helpers

def absolutize(src: str | None) -> str | None:
    if not src:
        return None
    src = html.unescape(src.strip())
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("http://"):
        return "https://" + src[len("http://"):]
    if src.startswith("https://"):
        return src
    if src.startswith("/"):
        return SITE + src
    return urljoin(CHI_BASE, src)


def text_or_none(s: str | None) -> str | None:
    s = norm(s)
    return s or None


def split_list(s: str | None, seps: str) -> list[str]:
    if not s:
        return []
    parts = re.split("[" + re.escape(seps) + "]", s)
    out = []
    for part in parts:
        part = norm(part).strip(" .;,，、")
        if part and part not in out:
            out.append(part)
    return out


def yes_no(s: str | None) -> bool | None:
    s = norm(s)
    if s.startswith("是"):
        return True
    if s.startswith("否"):
        return False
    return None


NUM = r"(\d+(?:\.\d+)?)"


def to_num(x: str) -> int | float:
    f = float(x)
    return int(f) if f.is_integer() else f


def parse_depth(s: str | None) -> tuple[int | float | None, int | float | None]:
    s = norm(s)
    m = re.search(NUM + r"\s*[-–~～至]\s*" + NUM, s)
    if m:
        return to_num(m.group(1)), to_num(m.group(2))
    m = re.search(NUM, s)
    if m:
        v = to_num(m.group(1))
        return v, v
    return None, None


def parse_length(s: str | None) -> int | float | None:
    s = norm(s)
    m = re.search(NUM + r"\s*(mm|cm|m)?\b", s, re.I)
    if not m:
        return None
    v = float(m.group(1))
    unit = (m.group(2) or "cm").lower()
    if unit == "mm":
        v /= 10
    elif unit == "m":
        v *= 100
    return to_num(f"{v:g}")


SEASONS = "春夏秋冬"


def season_tags(season: str) -> list[str]:
    if not season:
        return []
    if "全年" in season:
        return ["全年"]
    return [c for c in SEASONS if c in season]  # 初春/春末 etc. contain the season char


def region_list(s: str | None) -> list[str]:
    return split_list(s, "、，,;；/")


# 原站少數紀錄把兩個離島合寫成一個標籤（例如「蘭嶼綠島」），拆成獨立分區
COMBINED_REGIONS = {
    "蘭嶼綠島": ["蘭嶼", "綠島"],
    "綠島蘭嶼": ["綠島", "蘭嶼"],
}


def taiwan_region_tags(s: str | None) -> list[str]:
    out: list[str] = []
    for tag in region_list(s):
        for part in COMBINED_REGIONS.get(tag, [tag]):
            if part not in out:
                out.append(part)
    return out


# --------------------------------------------------------------------------- build

def empty_detail() -> dict:
    return {
        "family_latin": None, "author": None, "name_cn": None,
        "english_names": [], "synonyms": [], "photo_large": None,
        "depth_min": None, "depth_max": None, "depth_text": None,
        "max_length_cm": None, "max_length_text": None,
        "toxic": None, "edible": None, "ornamental": None, "economic": None,
        "distribution_world": None, "distribution_taiwan": None, "taiwan_regions": [],
        "habitat": None, "habitat_tags": [], "type_locality": None,
        "iucn_code": None, "iucn_text": None, "morphology": None, "ecology": None,
        "distribution_desc": None, "fishery_use": None, "references": None,
    }


def detail_record(f: dict) -> tuple[dict, list[str] | None]:
    def t(label: str) -> str | None:
        v = f.get(label)
        return text_or_none(v["text"]) if v else None

    d = empty_detail()

    fam = t("科號科名")
    if fam:
        m = re.match(r"^\s*[A-Za-z]?\d+\s+(.+)$", fam)
        d["family_latin"] = (m.group(1) if m else fam).strip() or None
    d["author"] = t("命名者")
    d["name_cn"] = t("中國大陸名")

    d["english_names"] = split_list(t("英文俗名"), ";；")
    d["synonyms"] = split_list(t("同種異名"), ",，")

    d["depth_text"] = t("棲息深度")
    d["depth_min"], d["depth_max"] = parse_depth(d["depth_text"])
    d["max_length_text"] = t("最大體長")
    d["max_length_cm"] = parse_length(d["max_length_text"])

    d["toxic"] = yes_no(t("有毒魚類"))
    d["edible"] = yes_no(t("食用魚類"))
    d["ornamental"] = yes_no(t("觀賞魚類"))
    d["economic"] = yes_no(t("經濟性"))

    d["distribution_world"] = t("世界分布")
    d["distribution_taiwan"] = t("台灣分布") or t("臺灣分布")
    d["taiwan_regions"] = taiwan_region_tags(d["distribution_taiwan"])
    d["habitat"] = t("棲息環境")
    d["habitat_tags"] = region_list(d["habitat"])

    tl = f.get("模式種產地")
    if tl:
        raw = re.sub(r"顯示原文|隱藏原文", SEP, tl["raw"])  # toggle labels of the original-text dropdown
        parts = [p.strip() for p in norm(raw, keep_sep=True).split(SEP) if p.strip()]
        if parts:
            zh, orig = parts[0], " ".join(parts[1:]).strip()
            d["type_locality"] = f"{zh}（{orig}）" if orig and orig != zh else zh

    iucn = f.get("瀕危狀態")
    if iucn:
        d["iucn_text"] = text_or_none(iucn["text"])
        for img in iucn["imgs"]:
            alt = (img.get("alt") or img.get("title") or "").strip()
            if alt:
                d["iucn_code"] = alt
                break

    d["morphology"] = t("形態特徵")
    d["ecology"] = t("棲所生態")
    d["distribution_desc"] = t("地理分布")
    d["fishery_use"] = t("漁業利用")

    refs = f.get("參考文獻")
    if refs:
        parts = [p.strip() for p in norm(refs["raw"], keep_sep=True).split(SEP) if p.strip()]
        d["references"] = "；".join(parts) or None

    d["photo_large"] = absolutize(f.get("_photo_large", {}).get("text") or None)

    common = f.get("其他中文名")
    common_names = split_list(common["text"], "、") if common else None
    return d, common_names


def load_detail(sid: str) -> dict | None:
    path = SPECIES_DIR / f"{sid}.html"
    if not path.is_file():
        return None
    page = path.read_bytes().decode("utf-8", errors="replace")
    if not any(m in page for m in COMPLETE_MARKERS):
        return None
    return parse_detail(page)


def build() -> list[dict]:
    rows = json.loads(LIST_JSON.read_text(encoding="utf-8"))
    out = []
    for r in rows:
        sid = r["id"]
        fields = load_detail(sid)
        detail, common = (detail_record(fields) if fields else (empty_detail(), None))
        if common is None:
            raw = re.sub(r"(\.\.\.|…)+\s*$", "", r.get("common_names_raw") or "")
            common = split_list(raw, "、")

        fish = {
            "id": sid,
            "family_id": r["family_id"],
            "family_zh": r["family_zh"],
            "scientific": r["scientific"],
            "name_zh": r["name_zh"],
            "common_names": common,
            "season": r.get("season") or "",
            "season_tags": season_tags(r.get("season") or ""),
            "price": r.get("price"),
            "photo_thumb": r.get("photo_thumb"),
            "source_url": SOURCE_URL.format(id=sid),
            "new_site_url": NEW_SITE_URL.format(id=sid),
            "detail_fetched": fields is not None,
            **detail,
        }
        missing = set(FISH_KEYS) ^ set(fish)
        assert not missing, f"key mismatch for {sid}: {missing}"
        out.append({k: fish[k] for k in FISH_KEYS})

    out.sort(key=lambda x: (x["scientific"].lower(), x["id"]))
    return out


def main() -> int:
    fish = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "fish.json").write_text(json.dumps(fish, ensure_ascii=False, separators=(",", ":")) + "\n",
                                       encoding="utf-8")
    meta = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "total": len(fish),
        "detail_fetched": sum(1 for f in fish if f["detail_fetched"]),
        "source": "臺灣魚類資料庫（中央研究院生物多樣性研究中心）經濟性魚種名錄",
        "source_url": "https://fishdb.sinica.edu.tw/chi/fisheconomic.php",
    }
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    prices = Counter(f["price"] for f in fish)
    print(f"wrote {len(fish)} records to {(OUT_DIR / 'fish.json').relative_to(ROOT)}")
    print("price levels: " + ", ".join(f"{k if k is not None else 'none'}={prices[k]}"
                                      for k in [1, 2, 3, 4, 5, None]))
    print(f"with season: {sum(1 for f in fish if f['season'])} "
          f"(season_tags non-empty: {sum(1 for f in fish if f['season_tags'])})")
    print(f"detail_fetched: {meta['detail_fetched']}/{meta['total']}")
    regions = Counter(r for f in fish for r in f["taiwan_regions"])
    print(f"taiwan_regions ({len(regions)} tags): "
          + ", ".join(f"{k}={v}" for k, v in regions.most_common()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
