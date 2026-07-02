#!/usr/bin/env python3

import argparse
import csv
import json
import os
from collections import Counter, defaultdict
from typing import Optional


def normalize_group(value):
    if not value:
        return "Unknown"
    group = value.strip().replace("-only", "-specific").replace("-ONLY", "-specific")
    if group == "Beta-specific":
        group = "EWAS-specific"
    return group or "Unknown"


def normalize_driver(value):
    if not value:
        return None
    driver = value.strip()
    if not driver or driver.lower() == "none":
        return None
    if driver.lower() == "both":
        return "Both"
    if driver.lower() == "chalm":
        return "CHALM"
    if driver.lower() == "camda":
        return "CAMDA"
    return driver


def sort_dict(data):
    return dict(sorted(data.items(), key=lambda item: item[1], reverse=True))


def allocate_by_proportion(total, counts_by_key):
    keys = list(counts_by_key.keys())
    total_base = sum(int(counts_by_key.get(key, 0) or 0) for key in keys)

    if total_base <= 0:
        allocations = {}
        remaining = total
        even_share = total // len(keys) if keys else 0
        for idx, key in enumerate(keys):
            share = remaining if idx == len(keys) - 1 else even_share
            allocations[key] = share
            remaining -= share
        return allocations

    allocations = {}
    assigned = 0
    for idx, key in enumerate(keys):
        if idx == len(keys) - 1:
            allocations[key] = total - assigned
        else:
            share = round(total * int(counts_by_key.get(key, 0) or 0) / total_base)
            allocations[key] = share
            assigned += share
    return allocations


def build_driver_overlap(drivers_by_group, groups_counter):
    common = drivers_by_group.get("Common", {})
    ha_specific = drivers_by_group.get("haEWAS-specific", {})
    ewas_specific = int(groups_counter.get("EWAS-specific", 0) or 0)
    common_total = int(groups_counter.get("Common", 0) or 0)
    ha_specific_total = int(groups_counter.get("haEWAS-specific", 0) or 0)

    common_parts = allocate_by_proportion(
        common_total,
        {
            "CHALM": common.get("CHALM", 0),
            "CAMDA": common.get("CAMDA", 0),
            "Both": common.get("Both", 0),
        },
    )

    ha_specific_parts = allocate_by_proportion(
        ha_specific_total,
        {
            "CHALM": ha_specific.get("CHALM", 0),
            "CAMDA": ha_specific.get("CAMDA", 0),
            "Both": ha_specific.get("Both", 0),
        },
    )

    ewas_parts = allocate_by_proportion(
        ewas_specific,
        {
            "CHALM": common_parts["CHALM"],
            "CAMDA": common_parts["CAMDA"],
            "Both": common_parts["Both"],
        },
    )

    return {
        "CHALM": {
            "haEWAS-specific": ha_specific_parts["CHALM"],
            "Common": common_parts["CHALM"],
            "EWAS-specific": ewas_parts["CHALM"],
        },
        "CAMDA": {
            "haEWAS-specific": ha_specific_parts["CAMDA"],
            "Common": common_parts["CAMDA"],
            "EWAS-specific": ewas_parts["CAMDA"],
        },
        "Both": {
            "haEWAS-specific": ha_specific_parts["Both"],
            "Common": common_parts["Both"],
            "EWAS-specific": ewas_parts["Both"],
        },
        "_totals": {
            "haEWAS-specific": ha_specific_total,
            "Common": common_total,
            "EWAS-specific": ewas_specific,
        },
        "_allocation_rule": "EWAS-specific and group-level Both counts are proportionally allocated to CHALM, CAMDA and Both panels to match the first chart totals.",
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Generate summary statistics JSON for haEWAS Explorer.")
    parser.add_argument(
        "--input",
        default=os.path.join("data", "downloads"),
        help="Directory containing phenotype CSV files.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path to write summary_stats.json. Defaults to <input>/summary_stats.json",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    data_dir = os.path.abspath(args.input)
    output_file = os.path.abspath(args.output) if args.output else os.path.join(data_dir, "summary_stats.json")

    stats = {
        "phenotypes": {},
        "groups": Counter(),
        "drivers": defaultdict(Counter),
        "regions": defaultdict(Counter),
    }

    print("Starting CSV scan and summary statistics generation...")

    for file_name in os.listdir(data_dir):
        if not file_name.endswith(".csv"):
            continue

        phenotype = file_name.replace(".csv", "")
        filepath = os.path.join(data_dir, file_name)

        row_count = 0
        pheno_groups = Counter()
        pheno_drivers = Counter()

        with open(filepath, "r", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames
            if not headers:
                continue

            col_group = next((header for header in headers if header.lower() == "group"), None)
            col_driver = next((header for header in headers if header.lower() == "haewas_driver"), None)
            col_region = next((header for header in headers if header.lower() == "gene_region"), None)

            for row in reader:
                row_count += 1

                group = normalize_group(row.get(col_group, "") if col_group else "")
                stats["groups"][group] += 1
                pheno_groups[group] += 1

                driver = normalize_driver(row.get(col_driver, "") if col_driver else "")
                if driver:
                    stats["drivers"][group][driver] += 1
                    pheno_drivers[driver] += 1

                if col_region and row.get(col_region):
                    for region in row[col_region].split(";"):
                        region = region.strip()
                        if region and region != "NA":
                            stats["regions"][group][region] += 1

        stats["phenotypes"][phenotype] = {
            "total": row_count,
            "groups": dict(pheno_groups),
            "drivers": dict(pheno_drivers),
        }
        print("Processed: {} -> {} loci".format(phenotype, row_count))

    driver_overlap = build_driver_overlap(stats["drivers"], stats["groups"])

    final_output = {
        "phenotypes": dict(sorted(stats["phenotypes"].items(), key=lambda item: item[1]["total"], reverse=True)),
        "groups": sort_dict(stats["groups"]),
        "drivers": {key: sort_dict(value) for key, value in stats["drivers"].items()},
        "driver_overlap": driver_overlap,
        "regions": {key: sort_dict(value) for key, value in stats["regions"].items()},
    }

    with open(output_file, "w", encoding="utf-8") as handle:
        json.dump(final_output, handle, indent=2, ensure_ascii=False)

    print("\nDone. Summary statistics written to: {}".format(output_file))


if __name__ == "__main__":
    main()
