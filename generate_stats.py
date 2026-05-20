from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DEFAULT_DOWNLOADS_DIR = ROOT / "data" / "downloads"
DEFAULT_SUMMARY_PATH = DEFAULT_DOWNLOADS_DIR / "summary_stats.json"

GROUP_ORDER = ["haEWAS-specific", "Common", "EWAS-specific"]
DRIVER_ORDER = ["CHALM", "CAMDA", "Both"]
REGION_ORDER = ["Body", "TSS1500", "5'UTR", "TSS200", "1stExon", "3'UTR", "ExonBnd"]
SPLIT_RE = re.compile(r"\s*;\s*")


def normalize_group(value: str) -> str | None:
    clean = (value or "").strip()
    if not clean:
        return None

    clean = clean.replace("Beta-specific", "EWAS-specific")
    clean = re.sub(r"-only$", "-specific", clean, flags=re.IGNORECASE)

    normalized = clean.lower()
    if normalized == "common":
        return "Common"
    if normalized == "haewas-specific":
        return "haEWAS-specific"
    if normalized == "ewas-specific":
        return "EWAS-specific"
    return clean


def normalize_driver(value: str) -> str | None:
    clean = (value or "").strip()
    if not clean:
        return None

    normalized = clean.upper()
    if "CHALM" in normalized and "CAMDA" in normalized:
        return "Both"
    if normalized == "BOTH":
        return "Both"
    if "CHALM" in normalized:
        return "CHALM"
    if "CAMDA" in normalized:
        return "CAMDA"
    return clean


def parse_regions(value: str) -> list[str]:
    tokens = []
    seen = set()
    for raw in SPLIT_RE.split((value or "").strip()):
        token = raw.strip()
        if not token or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return tokens


def ordered_counter(counter: Counter[str], preferred_order: list[str]) -> dict[str, int]:
    ordered: dict[str, int] = {}
    for key in preferred_order:
        if counter.get(key):
            ordered[key] = counter[key]

    for key in sorted(counter):
        if key not in ordered and counter[key]:
            ordered[key] = counter[key]
    return ordered


def csv_files(downloads_dir: Path) -> list[Path]:
    return sorted(downloads_dir.glob("*.csv"), key=lambda path: path.name.lower())


def build_summary(downloads_dir: Path) -> dict:
    phenotypes_raw: dict[str, dict] = {}
    groups = Counter()
    drivers_by_group: dict[str, Counter[str]] = defaultdict(Counter)
    regions_by_group: dict[str, Counter[str]] = defaultdict(Counter)

    for csv_path in csv_files(downloads_dir):
        phenotype_name = csv_path.stem
        pheno_groups = Counter()
        pheno_drivers = Counter()
        total = 0

        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if not row or not any((value or "").strip() for value in row.values()):
                    continue

                total += 1

                group = normalize_group(row.get("Group") or row.get("group") or "")
                if group:
                    groups[group] += 1
                    pheno_groups[group] += 1

                driver = normalize_driver(
                    row.get("haEWAS_Driver")
                    or row.get("haewas_driver")
                    or row.get("Driver")
                    or row.get("driver")
                    or ""
                )
                if driver:
                    pheno_drivers[driver] += 1
                    if group:
                        drivers_by_group[group][driver] += 1

                regions = parse_regions(row.get("gene_region") or row.get("Gene_region") or "")
                if group and regions:
                    for region in regions:
                        regions_by_group[group][region] += 1

        phenotype_drivers = ordered_counter(pheno_drivers, DRIVER_ORDER)
        phenotypes_raw[phenotype_name] = {
            "total": total,
            "groups": ordered_counter(pheno_groups, GROUP_ORDER),
            "drivers": phenotype_drivers,
            "haewas_drivers": phenotype_drivers,
        }

    ordered_phenotypes = sorted(
        phenotypes_raw.items(),
        key=lambda item: (-item[1]["total"], item[0].lower()),
    )

    top_level_drivers = {
        group: ordered_counter(counter, DRIVER_ORDER)
        for group, counter in ((group, drivers_by_group[group]) for group in GROUP_ORDER + sorted(set(drivers_by_group) - set(GROUP_ORDER)))
        if counter
    }

    top_level_regions = {
        group: ordered_counter(counter, REGION_ORDER)
        for group, counter in ((group, regions_by_group[group]) for group in GROUP_ORDER + sorted(set(regions_by_group) - set(GROUP_ORDER)))
        if counter
    }

    return {
        "phenotypes": {name: payload for name, payload in ordered_phenotypes},
        "groups": ordered_counter(groups, GROUP_ORDER),
        "drivers": top_level_drivers,
        "haewas_drivers": top_level_drivers,
        "regions": top_level_regions,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate summary_stats.json from haEWAS CSV files.")
    parser.add_argument("--input", default=str(DEFAULT_DOWNLOADS_DIR), help="Directory containing phenotype CSV files.")
    parser.add_argument("--output", default=str(DEFAULT_SUMMARY_PATH), help="Path to write summary_stats.json.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    downloads_dir = Path(args.input).expanduser().resolve()
    summary_path = Path(args.output).expanduser().resolve()

    if not downloads_dir.exists():
        raise SystemExit(f"Downloads directory not found: {downloads_dir}")

    summary = build_summary(downloads_dir)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {summary_path}")
    print(f"Processed {len(summary['phenotypes'])} phenotype files")


if __name__ == "__main__":
    main()
