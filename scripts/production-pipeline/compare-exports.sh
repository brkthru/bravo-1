#!/bin/bash

# Compare Exports Script
# Compares data between different export versions

set -euo pipefail

# Configuration
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"
REPORTS_DIR="${EXPORT_BASE_DIR}/comparison-reports"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Helper functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

# Usage
usage() {
    cat << EOF
Usage: $0 --version1 TIMESTAMP1 --version2 TIMESTAMP2 [OPTIONS]

Compare two export versions and generate a detailed report.

Options:
    --version1 TIMESTAMP    First version to compare (required)
    --version2 TIMESTAMP    Second version to compare (required)
    --output FILE          Output report file (default: comparison-report.json)
    --format FORMAT        Output format: json, html, markdown (default: json)
    --verbose              Show detailed differences
    -h, --help             Show this help message

Examples:
    # Compare two versions
    $0 --version1 20250621-143000 --version2 20250622-080000

    # Generate HTML report
    $0 --version1 20250621-143000 --version2 20250622-080000 --format html

EOF
}

# Parse arguments
VERSION1=""
VERSION2=""
OUTPUT_FILE="comparison-report.json"
FORMAT="json"
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --version1)
            VERSION1="$2"
            shift 2
            ;;
        --version2)
            VERSION2="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate arguments
if [[ -z "$VERSION1" ]] || [[ -z "$VERSION2" ]]; then
    error "Both version1 and version2 are required"
fi

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Create comparison script
cat > "${EXPORT_BASE_DIR}/temp/compare-data.js" << 'EOF'
const fs = require('fs');
const path = require('path');

function compareExports(version1, version2, exportDir) {
    const report = {
        timestamp: new Date().toISOString(),
        version1: version1,
        version2: version2,
        summary: {},
        details: {}
    };

    // Define collections to compare
    const collections = [
        'campaigns', 'users', 'line_items', 'strategies', 
        'media_buys', 'accounts', 'teams'
    ];

    collections.forEach(collection => {
        const file1 = path.join(exportDir, 'raw', version1, `${collection}.json`);
        const file2 = path.join(exportDir, 'raw', version2, `${collection}.json`);

        if (!fs.existsSync(file1) || !fs.existsSync(file2)) {
            report.details[collection] = { error: 'File not found in one or both versions' };
            return;
        }

        const data1 = JSON.parse(fs.readFileSync(file1, 'utf8'));
        const data2 = JSON.parse(fs.readFileSync(file2, 'utf8'));

        const comparison = {
            count_v1: data1.length,
            count_v2: data2.length,
            count_diff: data2.length - data1.length,
            count_diff_percent: ((data2.length - data1.length) / data1.length * 100).toFixed(2) + '%'
        };

        // Find added/removed records
        if (data1[0] && data1[0].id) {
            const ids1 = new Set(data1.map(d => d.id));
            const ids2 = new Set(data2.map(d => d.id));
            
            comparison.added = [...ids2].filter(id => !ids1.has(id)).length;
            comparison.removed = [...ids1].filter(id => !ids2.has(id)).length;
        }

        // Sample data changes
        if (collection === 'campaigns' && data1.length > 0 && data2.length > 0) {
            // Compare field changes in first 10 records
            const sampleSize = Math.min(10, data1.length, data2.length);
            const fieldChanges = {};
            
            for (let i = 0; i < sampleSize; i++) {
                const record1 = data1[i];
                const record2 = data2.find(r => r.id === record1.id);
                
                if (record2) {
                    Object.keys(record1).forEach(key => {
                        if (JSON.stringify(record1[key]) !== JSON.stringify(record2[key])) {
                            fieldChanges[key] = (fieldChanges[key] || 0) + 1;
                        }
                    });
                }
            }
            
            comparison.field_changes = fieldChanges;
        }

        report.details[collection] = comparison;
    });

    // Generate summary
    report.summary = {
        total_collections: Object.keys(report.details).length,
        collections_with_changes: Object.keys(report.details).filter(
            c => report.details[c].count_diff !== 0
        ).length,
        total_records_v1: Object.values(report.details).reduce(
            (sum, d) => sum + (d.count_v1 || 0), 0
        ),
        total_records_v2: Object.values(report.details).reduce(
            (sum, d) => sum + (d.count_v2 || 0), 0
        )
    };

    return report;
}

// Run comparison
const args = process.argv.slice(2);
const version1 = args[0];
const version2 = args[1];
const exportDir = args[2];

const report = compareExports(version1, version2, exportDir);
console.log(JSON.stringify(report, null, 2));
EOF

# Run comparison
log "Comparing version ${VERSION1} with ${VERSION2}..."

node "${EXPORT_BASE_DIR}/temp/compare-data.js" \
    "$VERSION1" \
    "$VERSION2" \
    "$EXPORT_BASE_DIR" \
    > "${EXPORT_BASE_DIR}/temp/raw-comparison.json"

# Process based on format
case "$FORMAT" in
    json)
        cp "${EXPORT_BASE_DIR}/temp/raw-comparison.json" "$OUTPUT_FILE"
        ;;
    
    html)
        log "Generating HTML report..."
        cat > "$OUTPUT_FILE" << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>Export Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .increase { color: green; }
        .decrease { color: red; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Export Comparison Report</h1>
    <div id="content"></div>
    <script>
        const data = 
HTML
        cat "${EXPORT_BASE_DIR}/temp/raw-comparison.json" >> "$OUTPUT_FILE"
        cat >> "$OUTPUT_FILE" << 'HTML'
        ;
        
        const content = document.getElementById('content');
        
        // Summary
        const summary = document.createElement('div');
        summary.className = 'summary';
        summary.innerHTML = `
            <h2>Summary</h2>
            <p>Version 1: ${data.version1}</p>
            <p>Version 2: ${data.version2}</p>
            <p>Total Collections: ${data.summary.total_collections}</p>
            <p>Collections with Changes: ${data.summary.collections_with_changes}</p>
            <p>Total Records (v1): ${data.summary.total_records_v1.toLocaleString()}</p>
            <p>Total Records (v2): ${data.summary.total_records_v2.toLocaleString()}</p>
        `;
        content.appendChild(summary);
        
        // Details table
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Collection</th>
                    <th>Count (v1)</th>
                    <th>Count (v2)</th>
                    <th>Difference</th>
                    <th>Added</th>
                    <th>Removed</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(data.details).map(([collection, details]) => `
                    <tr>
                        <td>${collection}</td>
                        <td>${details.count_v1 || 'N/A'}</td>
                        <td>${details.count_v2 || 'N/A'}</td>
                        <td class="${details.count_diff > 0 ? 'increase' : details.count_diff < 0 ? 'decrease' : ''}">
                            ${details.count_diff || 0} (${details.count_diff_percent || '0%'})
                        </td>
                        <td>${details.added || 0}</td>
                        <td>${details.removed || 0}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        content.appendChild(table);
    </script>
</body>
</html>
HTML
        ;;
    
    markdown)
        log "Generating Markdown report..."
        node -e "
        const data = require('${EXPORT_BASE_DIR}/temp/raw-comparison.json');
        
        console.log('# Export Comparison Report');
        console.log();
        console.log('## Summary');
        console.log('- **Version 1:** ' + data.version1);
        console.log('- **Version 2:** ' + data.version2);
        console.log('- **Generated:** ' + data.timestamp);
        console.log('- **Total Collections:** ' + data.summary.total_collections);
        console.log('- **Collections with Changes:** ' + data.summary.collections_with_changes);
        console.log();
        console.log('## Collection Details');
        console.log();
        console.log('| Collection | Count (v1) | Count (v2) | Difference | Added | Removed |');
        console.log('|------------|------------|------------|------------|-------|---------|');
        
        Object.entries(data.details).forEach(([collection, details]) => {
            console.log('| ' + [
                collection,
                details.count_v1 || 'N/A',
                details.count_v2 || 'N/A',
                (details.count_diff || 0) + ' (' + (details.count_diff_percent || '0%') + ')',
                details.added || 0,
                details.removed || 0
            ].join(' | ') + ' |');
        });
        " > "$OUTPUT_FILE"
        ;;
esac

# Save to reports directory
REPORT_DATE=$(date +%Y-%m-%d)
mkdir -p "${REPORTS_DIR}/${REPORT_DATE}"
cp "$OUTPUT_FILE" "${REPORTS_DIR}/${REPORT_DATE}/compare-${VERSION1}-vs-${VERSION2}.${FORMAT}"

# Display summary
log "Comparison complete!"
log "Report saved to: $OUTPUT_FILE"

if [[ "$VERBOSE" == "true" ]]; then
    log "Detailed comparison:"
    jq '.' "${EXPORT_BASE_DIR}/temp/raw-comparison.json"
fi

# Cleanup
rm -f "${EXPORT_BASE_DIR}/temp/compare-data.js"
rm -f "${EXPORT_BASE_DIR}/temp/raw-comparison.json"