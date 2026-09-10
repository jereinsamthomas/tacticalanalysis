"""
export_to_csv.py
-----------------
Converts every generated JSON rule/scenario/chain family in rules/ into flat CSV
files -- satisfying the original spec's "CSV datasets" deliverable (Part CH),
which the package had so far only produced as JSON.

Usage:
    python export_to_csv.py --rules-dir ../rules --out-dir ../rules/csv
"""

import argparse
import csv
import json
import os


def flatten_row(row: dict) -> dict:
    """Flattens any nested list/dict values to a CSV-safe string representation."""
    flat = {}
    for k, v in row.items():
        if isinstance(v, (list, dict)):
            flat[k] = json.dumps(v)
        else:
            flat[k] = v
    return flat


def write_csv(rows, out_path):
    if not rows:
        return
    flat_rows = [flatten_row(r) for r in rows]
    fieldnames = sorted({k for r in flat_rows for k in r.keys()})
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(flat_rows)
    print(f"Wrote {len(flat_rows)} rows -> {out_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rules-dir", default=".")
    parser.add_argument("--out-dir", default="csv")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    master_path = os.path.join(args.rules_dir, "MASTER_RULES_AND_SCENARIOS.json")
    if os.path.exists(master_path):
        with open(master_path) as f:
            master = json.load(f)
        write_csv(master.get("rules", []), os.path.join(args.out_dir, "tactical_rules.csv"))
        write_csv(master.get("battle_scenarios", []), os.path.join(args.out_dir, "battle_scenarios.csv"))
        write_csv(master.get("tactical_causality_chains", []), os.path.join(args.out_dir, "tactical_causality_chains.csv"))
    else:
        print(f"WARNING: {master_path} not found; run rule_generator.py and rebuild "
              f"MASTER_RULES_AND_SCENARIOS.json first.")


if __name__ == "__main__":
    main()
