#!/usr/bin/env python3
"""Compare les sources à la passation sans écrire ni appeler le réseau."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Chemin du dépôt actif s’il a été déplacé")
    args = parser.parse_args()
    manifest_path = Path(__file__).resolve().parent / "preuves" / "empreintes-source-2026-09-26.json"
    manifest = json.loads(manifest_path.read_text())
    root = args.source or Path(manifest["sourcePath"])
    if not root.is_dir():
        print(f"Dépôt introuvable : {root}")
        print("Utiliser --source pour désigner le dépôt déplacé ; ne pas restaurer automatiquement une ancienne copie.")
        return 2
    changed, missing = [], []
    for entry in manifest["files"]:
        path = root / entry["path"]
        if not path.is_file():
            missing.append(entry["path"])
        elif hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            changed.append(entry["path"])
    print(f"Dépôt contrôlé : {root}")
    print(f"{len(manifest['files'])} fichiers de référence ; {len(changed)} modifiés ; {len(missing)} absents.")
    for label, values in [("MODIFIÉ", changed), ("ABSENT", missing)]:
        for value in values:
            print(f"{label} : {value}")
    print("Contrôle en lecture seule. Les nouveaux fichiers, l’environnement, la base et la production ne sont pas vérifiés.")
    if changed or missing:
        print("Examiner ces différences avant de reprendre ; ce résultat ne demande aucune restauration automatique.")
    return 1 if changed or missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
