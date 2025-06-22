#!/bin/bash

# Manual S3 Upload Script
# Use this to upload exports to S3 after getting proper permissions

set -euo pipefail

# Configuration
BASE_DIR="/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1"
EXPORT_BASE_DIR="${BASE_DIR}/exports"

# Source configuration
if [[ -f "config/pipeline.env" ]]; then
    source config/pipeline.env
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Show help
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] TIMESTAMP

Upload a specific export to S3.

Arguments:
    TIMESTAMP    The export timestamp to upload (e.g., 20250622-072326)

Options:
    -h, --help      Show this help message
    --bucket NAME   S3 bucket name (overrides config)
    --dry-run       Show what would be uploaded without doing it

Example:
    $0 20250622-072326
    $0 --bucket my-backup-bucket 20250622-072326
    $0 --dry-run 20250622-072326

Prerequisites:
    - AWS CLI configured with S3 write permissions
    - Export files exist in exports/raw/ and exports/transformed/
EOF
}

# Parse arguments
DRY_RUN=false
TIMESTAMP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            TIMESTAMP="$1"
            shift
            ;;
    esac
done

if [[ -z "$TIMESTAMP" ]]; then
    error "Timestamp required. Use -h for help."
fi

# Validate timestamp format
if ! [[ "$TIMESTAMP" =~ ^[0-9]{8}-[0-9]{6}$ ]]; then
    error "Invalid timestamp format. Expected: YYYYMMDD-HHMMSS"
fi

# Check if exports exist
if [[ ! -d "${EXPORT_BASE_DIR}/raw/${TIMESTAMP}" ]]; then
    error "Raw export not found: ${EXPORT_BASE_DIR}/raw/${TIMESTAMP}"
fi

if [[ ! -d "${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}" ]]; then
    warning "Transformed export not found: ${EXPORT_BASE_DIR}/transformed/${TIMESTAMP}"
fi

# Source configuration to get AWS_PROFILE
if [[ -f "config/pipeline.env" ]]; then
    source config/pipeline.env
fi

# Set default AWS_PROFILE if not set
AWS_PROFILE="${AWS_PROFILE:-default}"

# Check AWS credentials
if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" &> /dev/null; then
    error "AWS authentication failed. Please configure AWS CLI for profile: ${AWS_PROFILE}"
fi

# Get date part for S3 organization
DATE_PART=$(echo "$TIMESTAMP" | cut -c1-8)
S3_DATE="${DATE_PART:0:4}-${DATE_PART:4:2}-${DATE_PART:6:2}"

info "Export to upload: ${TIMESTAMP}"
info "S3 bucket: ${S3_BUCKET}"
info "S3 date folder: ${S3_DATE}"

if [[ "$DRY_RUN" == "true" ]]; then
    info "DRY RUN MODE - No files will be uploaded"
fi

# Compress exports
log "Compressing exports..."
cd "${EXPORT_BASE_DIR}"

if [[ ! -f "temp/${TIMESTAMP}-raw.tar.gz" ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
        cd raw
        tar -czf "../temp/${TIMESTAMP}-raw.tar.gz" "${TIMESTAMP}/"
        cd ..
    else
        info "Would compress: raw/${TIMESTAMP}/ -> temp/${TIMESTAMP}-raw.tar.gz"
    fi
fi

if [[ -d "transformed/${TIMESTAMP}" ]] && [[ ! -f "temp/${TIMESTAMP}-transformed.tar.gz" ]]; then
    if [[ "$DRY_RUN" == "false" ]]; then
        cd transformed
        tar -czf "../temp/${TIMESTAMP}-transformed.tar.gz" "${TIMESTAMP}/"
        cd ..
    else
        info "Would compress: transformed/${TIMESTAMP}/ -> temp/${TIMESTAMP}-transformed.tar.gz"
    fi
fi

# Check bucket exists
log "Checking S3 bucket..."
if ! aws s3 ls "s3://${S3_BUCKET}" --profile "${AWS_PROFILE}" &> /dev/null; then
    error "S3 bucket '${S3_BUCKET}' not accessible. Create it first with setup-s3-bucket.sh"
fi

# Upload files
log "Uploading to S3..."

# Upload raw export
RAW_SIZE=$(du -h "temp/${TIMESTAMP}-raw.tar.gz" 2>/dev/null | cut -f1)
info "Uploading raw export (${RAW_SIZE})..."

if [[ "$DRY_RUN" == "false" ]]; then
    aws s3 cp \
        "temp/${TIMESTAMP}-raw.tar.gz" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${S3_DATE}/" \
        --storage-class STANDARD_IA \
        --profile "${AWS_PROFILE}"
else
    info "Would upload: temp/${TIMESTAMP}-raw.tar.gz -> s3://${S3_BUCKET}/${S3_PREFIX}/raw/${S3_DATE}/"
fi

# Upload transformed export if exists
if [[ -f "temp/${TIMESTAMP}-transformed.tar.gz" ]]; then
    TRANS_SIZE=$(du -h "temp/${TIMESTAMP}-transformed.tar.gz" | cut -f1)
    info "Uploading transformed export (${TRANS_SIZE})..."
    
    if [[ "$DRY_RUN" == "false" ]]; then
        aws s3 cp \
            "temp/${TIMESTAMP}-transformed.tar.gz" \
            "s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${S3_DATE}/" \
            --storage-class STANDARD_IA \
            --profile "${AWS_PROFILE}"
    else
        info "Would upload: temp/${TIMESTAMP}-transformed.tar.gz -> s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${S3_DATE}/"
    fi
fi

# Create and upload metadata
log "Creating metadata..."
if [[ "$DRY_RUN" == "false" ]]; then
    cat > "temp/${TIMESTAMP}-metadata.json" <<EOF
{
    "timestamp": "${TIMESTAMP}",
    "uploaded_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "export_date": "${S3_DATE}",
    "raw_export": "s3://${S3_BUCKET}/${S3_PREFIX}/raw/${S3_DATE}/${TIMESTAMP}-raw.tar.gz",
    "transformed_export": "s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${S3_DATE}/${TIMESTAMP}-transformed.tar.gz",
    "uploaded_by": "$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --query Arn --output text)"
}
EOF

    aws s3 cp \
        "temp/${TIMESTAMP}-metadata.json" \
        "s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${S3_DATE}/${TIMESTAMP}.json" \
        --profile "${AWS_PROFILE}"
else
    info "Would create and upload metadata to: s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${S3_DATE}/${TIMESTAMP}.json"
fi

# Cleanup
if [[ "$DRY_RUN" == "false" ]]; then
    log "Cleaning up temporary files..."
    rm -f "temp/${TIMESTAMP}-raw.tar.gz"
    rm -f "temp/${TIMESTAMP}-transformed.tar.gz"
    rm -f "temp/${TIMESTAMP}-metadata.json"
fi

log "Upload complete!"
echo
info "Files uploaded to:"
info "  Raw: s3://${S3_BUCKET}/${S3_PREFIX}/raw/${S3_DATE}/${TIMESTAMP}-raw.tar.gz"
if [[ -d "transformed/${TIMESTAMP}" ]]; then
    info "  Transformed: s3://${S3_BUCKET}/${S3_PREFIX}/transformed/${S3_DATE}/${TIMESTAMP}-transformed.tar.gz"
fi
info "  Metadata: s3://${S3_BUCKET}/${S3_PREFIX}/metadata/${S3_DATE}/${TIMESTAMP}.json"