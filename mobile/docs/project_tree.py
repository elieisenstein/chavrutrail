import csv
from pathlib import Path


EXCLUDE_DIRS = {
    ".expo",
    "android",
    "node_modules",
    ".git"
}

def export_file_list(root_folder: str, output_csv: str):
    root = Path(root_folder)

    if not root.exists():
        raise FileNotFoundError(f"Folder does not exist: {root}")

    with open(output_csv, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["full_path", "file_size_bytes"])  # header

        count = 0
        for p in root.rglob("*"):
            if not p.is_file():
                continue

            rel = p.relative_to(root)

            # skip excluded directories anywhere in the path
            if any(part in EXCLUDE_DIRS for part in rel.parts):
                continue

            writer.writerow([
                str(rel),
                p.stat().st_size
            ])
            count += 1
    print(f"Saved {count} files to {output_csv}")


if __name__ == "__main__":
    ROOT_FOLDER = r"C:/Users/eliei/Documents/bishvil"    
    OUTPUT_CSV  = r"C:/Users/eliei/Documents/bishvil/mobile/docs/files_list.csv"  

    export_file_list(ROOT_FOLDER, OUTPUT_CSV)
