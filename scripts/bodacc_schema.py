#!/usr/bin/env python3
"""Inspecte l'API BODACC (dataset annonces-commerciales).

Affiche :
  1. La liste réelle des champs du dataset (schéma).
  2. Un échantillon d'annonces de MODIFICATION en Isère (département 38),
     en mettant en avant les changements de capital / d'associés.

Aucune dépendance externe : utilise seulement la bibliothèque standard.

Usage :
    python3 scripts/bodacc_schema.py            # schéma + 5 exemples
    python3 scripts/bodacc_schema.py --limit 10 # 10 exemples
    python3 scripts/bodacc_schema.py --dept 69  # autre département
"""

import argparse
import json
import sys
import urllib.parse
import urllib.request

BASE = "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1"
DATASET = "annonces-commerciales"


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "bodacc-inspect/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def print_schema() -> None:
    """Récupère et affiche la liste des champs du dataset."""
    url = f"{BASE}/catalog/datasets/{DATASET}"
    data = http_get_json(url)
    fields = data.get("fields", [])
    print(f"=== SCHÉMA : {len(fields)} champs ===\n")
    for f in fields:
        name = f.get("name", "?")
        ftype = f.get("type", "?")
        label = f.get("label", "")
        print(f"  {name:<28} {ftype:<10} {label}")
    print()


def print_samples(dept: str, limit: int) -> None:
    """Affiche des annonces de modification pour un département."""
    where = f'numerodepartement="{dept}" AND familleavis="modification"'
    params = {
        "where": where,
        "order_by": "dateparution DESC",
        "limit": str(limit),
    }
    url = f"{BASE}/catalog/datasets/{DATASET}/records?" + urllib.parse.urlencode(params)
    data = http_get_json(url)
    results = data.get("results", [])
    total = data.get("total_count", "?")
    print(f"=== {len(results)} exemples (sur {total} modifications, dept {dept}) ===\n")
    for r in results:
        print(f"- {r.get('dateparution', '?')} | {r.get('commercant', '?')} "
              f"({r.get('ville', '?')})")
        modif = r.get("modificationsgenerales")
        if modif:
            txt = modif if isinstance(modif, str) else json.dumps(modif, ensure_ascii=False)
            print(f"    modif: {txt[:300]}")
        print()


def main() -> int:
    ap = argparse.ArgumentParser(description="Inspecte l'API BODACC.")
    ap.add_argument("--dept", default="38", help="Code département (défaut: 38 / Isère)")
    ap.add_argument("--limit", type=int, default=5, help="Nb d'exemples (défaut: 5)")
    ap.add_argument("--schema-only", action="store_true", help="Schéma uniquement")
    args = ap.parse_args()

    try:
        print_schema()
        if not args.schema_only:
            print_samples(args.dept, args.limit)
    except urllib.error.URLError as e:
        print(f"Erreur réseau : {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
