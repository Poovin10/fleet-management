#!/usr/bin/env bash
set -u
OUT="project-analysis.txt"

echo "KSS ERP PROJECT ANALYSIS" > "$OUT"
echo "Generated: $(date)" >> "$OUT"
echo "Root: $(pwd)" >> "$OUT"
echo "============================================================" >> "$OUT"

echo >> "$OUT"
echo "================ PROJECT FILE TREE ================" >> "$OUT"
find . -type f \
  ! -path "./.git/*" \
  ! -path "./node_modules/*" \
  ! -path "./.next/*" \
  ! -path "./out/*" \
  ! -path "./dist/*" \
  ! -path "./build/*" \
  ! -path "./coverage/*" \
  ! -name ".env*" \
  ! -name "*.lock" \
  ! -name "*.log" \
  ! -name "*.map" \
  | sort >> "$OUT"

echo >> "$OUT"
echo "================ FILE CONTENTS ================" >> "$OUT"

while IFS= read -r file; do
  echo >> "$OUT"
  echo "============================================================" >> "$OUT"
  echo "FILE: $file" >> "$OUT"
  echo "============================================================" >> "$OUT"
  cat "$file" >> "$OUT"
  echo >> "$OUT"
done < <(find . -type f \
  ! -path "./.git/*" \
  ! -path "./node_modules/*" \
  ! -path "./.next/*" \
  ! -path "./out/*" \
  ! -path "./dist/*" \
  ! -path "./build/*" \
  ! -path "./coverage/*" \
  ! -name ".env*" \
  ! -name "*.lock" \
  ! -name "*.log" \
  ! -name "*.map" \
  | sort)

echo >> "$OUT"
echo "================ END ================" >> "$OUT"

echo "Analysis created: $OUT"
echo "Size:"
wc -c "$OUT"
echo "Lines:"
wc -l "$OUT"
