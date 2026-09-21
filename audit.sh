#!/bin/bash
echo "Starting KSS Roadways ERP audit..."
REPORT="audit-report.txt"
> "$REPORT"

section() {
  echo "" >> "$REPORT"
  echo "================================================================" >> "$REPORT"
  echo "  $1" >> "$REPORT"
  echo "================================================================" >> "$REPORT"
}

# ── 1. PROJECT INVENTORY ──────────────────────────────
section "1. PROJECT FILE INVENTORY"
echo "TSX/TS files:" >> "$REPORT"
find app components lib -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | sort >> "$REPORT"
echo "" >> "$REPORT"
echo "Total lines of code:" >> "$REPORT"
find app components lib -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null -exec cat {} + | wc -l >> "$REPORT"

# ── 2. SCHEMA USAGE — TABLES REFERENCED IN CODE ───────
section "2. TABLES REFERENCED IN CODE"
grep -rhoE "\.from\(['\"][a-zA-Z_]+['\"]\)" app components lib 2>/dev/null | grep -oE "['\"][a-zA-Z_]+['\"]" | tr -d "'\"" | sort -u >> "$REPORT"

# ── 3. TABLES DEFINED IN GENERATED SCHEMA TYPES ───────
section "3. TABLES IN lib/database.types.ts (actual DB schema)"
if [ -f lib/database.types.ts ]; then
  grep -oE "^\s{6}[a-z_]+: \{$" lib/database.types.ts | sed 's/[: {]//g' | awk '{$1=$1};1' | sort -u >> "$REPORT"
else
  echo "database.types.ts not found — run: npx supabase gen types typescript --project-id eobweyciqwoojwnsonor --schema public > lib/database.types.ts" >> "$REPORT"
fi

# ── 4. TABLES IN CODE BUT MISSING FROM SCHEMA ─────────
section "4. TABLES REFERENCED IN CODE BUT NOT IN lib/database.types.ts"
if [ -f lib/database.types.ts ]; then
  CODE_TABLES=$(grep -rhoE "\.from\(['\"][a-zA-Z_]+['\"]\)" app components lib 2>/dev/null | grep -oE "['\"][a-zA-Z_]+['\"]" | tr -d "'\"" | sort -u)
  SCHEMA_TABLES=$(grep -oE "^\s{6}[a-z_]+: \{$" lib/database.types.ts | sed 's/[: {]//g' | awk '{$1=$1};1' | sort -u)
  comm -23 <(echo "$CODE_TABLES") <(echo "$SCHEMA_TABLES") >> "$REPORT"
  echo "(empty above = no mismatches found)" >> "$REPORT"
fi

# ── 5. SUPABASE CLIENT / ENV CONFIG ───────────────────
section "5. HOW THE APP CONNECTS TO SUPABASE"
find lib -iname "*supabase*" 2>/dev/null >> "$REPORT"
echo "" >> "$REPORT"
echo "--- lib/supabase/client.ts (if exists) ---" >> "$REPORT"
[ -f lib/supabase/client.ts ] && cat lib/supabase/client.ts >> "$REPORT"
echo "" >> "$REPORT"
echo "--- .env.local keys (values hidden) ---" >> "$REPORT"
[ -f .env.local ] && grep -oE "^[A-Z_]+" .env.local >> "$REPORT"

# ── 6. TYPESCRIPT ERRORS ──────────────────────────────
section "6. TYPESCRIPT TYPE ERRORS (npx tsc --noEmit)"
npx tsc --noEmit >> "$REPORT" 2>&1
echo "(empty above = no type errors)" >> "$REPORT"

# ── 7. STYLING — CENTRALIZATION CHECK ─────────────────
section "7. HARDCODED HEX COLORS OUTSIDE globals.css (styling not centralized)"
grep -rnoE "#[0-9A-Fa-f]{6}\b" app components --include="*.tsx" 2>/dev/null | sort >> "$REPORT"

section "8. LEFTOVER LIGHT-THEME CLASSES (bg-white / bg-gray / text-black etc.)"
grep -rn "bg-white\|bg-gray-\|text-gray-\|text-black\|border-gray-" app components --include="*.tsx" 2>/dev/null >> "$REPORT"

section "9. INLINE style={{ }} USAGE (bypasses centralized CSS)"
grep -rn "style={{" app components --include="*.tsx" 2>/dev/null >> "$REPORT"

section "10. MULTIPLE CSS FILES (should be ONE centralized globals.css)"
find app -iname "*.css" 2>/dev/null >> "$REPORT"

# ── 11. LOGIC/HYGIENE CHECKS ──────────────────────────
section "11. LEFTOVER console.log / debugger STATEMENTS"
grep -rn "console\.log\|debugger" app components lib --include="*.tsx" --include="*.ts" 2>/dev/null >> "$REPORT"

section "12. TODO / FIXME MARKERS"
grep -rn "TODO\|FIXME\|XXX" app components lib --include="*.tsx" --include="*.ts" 2>/dev/null >> "$REPORT"

section "13. .order() / .eq() COLUMN NAMES USED (cross-check against schema manually)"
grep -rhoE "\.order\(['\"][a-zA-Z_]+['\"]" app components lib 2>/dev/null | grep -oE "['\"][a-zA-Z_]+['\"]" | tr -d "'\"" | sort -u >> "$REPORT"

echo "" >> "$REPORT"
echo "================================================================" >> "$REPORT"
echo "  AUDIT COMPLETE — report saved to $REPORT" >> "$REPORT"
echo "================================================================" >> "$REPORT"

echo "Done. Report saved to $REPORT ($(wc -l < $REPORT) lines)."
