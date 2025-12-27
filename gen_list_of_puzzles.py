from pathlib import Path
import json
import argparse
import sys

#!/usr/bin/env python3
"""
Generate a JSON file listing all .json filenames in Site/puzzles.
Saves output to Site/puzzles/puzzles_list.json by default.
"""

def list_json_or_txt_files(directory: Path):
    if not directory.exists() or not directory.is_dir():
        raise FileNotFoundError(f"Directory not found: {directory}")
    return sorted([p.name for p in directory.iterdir() if p.is_file() and (p.suffix.lower() == '.json' or p.suffix.lower() == '.txt')])

def make_lists_of_puzzles():
    p = argparse.ArgumentParser(description="Make a JSON of all .json filenames in Site/puzzles")
    p.add_argument("--dir", "-d", default=Path(__file__).parent / "Site" / "puzzles", help="Directory to scan")
    p.add_argument("--out", "-o", default=None, help="Output JSON file path")
    args = p.parse_args()

    directory = Path(args.dir)
    try:
        files = list_json_or_txt_files(directory)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        sys.exit(1)
        
    filters = [5, 10, 15]
    correct_files = {}
    jsonpath = "Site\\lists"
    
    for f in filters:
        correct_files[f] = []
        files_filter = [fn for fn in files if fn.startswith(f"p_{f}_")]
        for fn in files_filter:
            splits = fn.split("_")
            if int(splits[3]) > f:
                correct_files[f].append(fn)
            else:
                if fn.endswith(".json") or fn.endswith(".txt"):
                    (directory / fn).unlink()
                    (Path(*["spoilers" if part == "puzzles" else part for part in directory.parts]) / fn.replace(".json", ".txt")).unlink()
                    print(f"Deleted file {fn} for not meeting filter {f}")
        print(f"Found {len(correct_files)} puzzles for filter {f} (rejected: {len(files_filter) - len(correct_files)})")
    
    for f, file in correct_files.items():
        out_path = Path(f"{jsonpath}\\pl_{f}.json")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(file, indent=2, ensure_ascii=False), encoding="utf-8")
        print(str(out_path))
    
    with Path("ArchipelagoPicross\\ArchipelagoPicross\\worlds\\nonogram\\puzzles.py").open("w", encoding="utf-8") as f_py:
        f_py.write("L = {\n")
        for f, fn in correct_files.items():
            f_py.write(f'    {f}: {fn},\n')
        f_py.write("}\n")
        print("Updated puzzles.py")

if __name__ == "__main__":
    make_lists_of_puzzles()