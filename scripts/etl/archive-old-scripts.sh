#!/bin/bash
# Archive old ETL scripts that are replaced by the unified pipeline

set -e

echo "📦 Archiving old ETL scripts..."
echo ""

# Create archive directory
ARCHIVE_DIR="./archive/$(date +%Y%m%d)"
mkdir -p "${ARCHIVE_DIR}"

# Scripts to keep (essential utilities and the new pipeline)
KEEP_SCRIPTS=(
	"etl-pipeline.ts"
	"quick-start-etl.sh"
	"install-dependencies.sh"
	"ETL-SUMMARY.md"
	"README.md"
	"archive-old-scripts.sh"
)

# Create a function to check if script should be kept
should_keep() {
	local file=$1
	for keep in "${KEEP_SCRIPTS[@]}"; do
		if [[ ${file} == "${keep}" ]]; then
			return 0
		fi
	done
	return 1
}

# Archive old scripts
archived_count=0
for file in *.ts *.sh *.js; do
	if [[ -f ${file} ]] && ! should_keep "${file}"; then
		echo "  Archiving: $file"
		mv "$file" "$ARCHIVE_DIR/"
		((archived_count++))
	fi
done

echo ""
echo "✅ Archived $archived_count scripts to $ARCHIVE_DIR"
echo ""

# Create a manifest of what was archived
cat >"$ARCHIVE_DIR/ARCHIVE_MANIFEST.md" <<EOF
# Archived ETL Scripts
Date: $(date)

These scripts were archived because they are replaced by the unified ETL pipeline (etl-pipeline.ts).

## Archived Scripts:
$(ls -1 "$ARCHIVE_DIR" | grep -v ARCHIVE_MANIFEST.md | sort)

## Active Scripts:
- etl-pipeline.ts - Unified ETL pipeline (MAIN SCRIPT)
- quick-start-etl.sh - Interactive ETL runner
- install-dependencies.sh - Dependency installer

## Migration Guide:
Instead of using the old scripts, use the unified pipeline:

\`\`\`bash
# Full ETL with clean start
bun etl-pipeline.ts --clean --verify

# ETL without cleaning
bun etl-pipeline.ts --verify

# Use specific export
bun etl-pipeline.ts --export=20250628 --verify

# Interactive mode
./quick-start-etl.sh
\`\`\`
EOF

echo "📝 Created archive manifest at $ARCHIVE_DIR/ARCHIVE_MANIFEST.md"
echo ""
echo "🎯 The unified ETL pipeline is now at: etl-pipeline.ts"
echo "   Run it with: bun etl-pipeline.ts --help"
