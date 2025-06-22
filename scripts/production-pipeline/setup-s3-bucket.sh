#!/bin/zsh

# Setup S3 Bucket for Media Tool Backups
# Run this script with an AWS account that has S3 admin permissions

set -euo pipefail

# Configuration
BUCKET_NAME="${BUCKET_NAME:-media-tool-backups-$(date +%s)}"
REGION="${AWS_REGION:-us-east-1}"

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

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install: brew install awscli"
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS authentication failed. Please configure AWS CLI"
fi

# Get account info
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
USER_ARN=$(aws sts get-caller-identity --query Arn --output text)

info "Current AWS Identity:"
info "  Account: ${ACCOUNT_ID}"
info "  User: ${USER_ARN}"
echo

# Create bucket
log "Creating S3 bucket: ${BUCKET_NAME}"
if aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}" 2>/dev/null; then
    log "Bucket created successfully"
else
    error "Failed to create bucket. You may need S3 admin permissions."
fi

# Enable versioning
log "Enabling versioning on bucket"
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled

# Enable encryption
log "Enabling default encryption"
aws s3api put-bucket-encryption \
    --bucket "${BUCKET_NAME}" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }'

# Create lifecycle policy for cost optimization
log "Creating lifecycle policy"
cat > /tmp/lifecycle.json <<EOF
{
    "Rules": [
        {
            "ID": "TransitionOldExports",
            "Status": "Enabled",
            "Prefix": "postgres-exports/",
            "Transitions": [
                {
                    "Days": 30,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 90,
                    "StorageClass": "GLACIER"
                }
            ]
        },
        {
            "ID": "DeleteOldExports",
            "Status": "Enabled",
            "Prefix": "postgres-exports/",
            "Expiration": {
                "Days": 365
            }
        }
    ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BUCKET_NAME}" \
    --lifecycle-configuration file:///tmp/lifecycle.json

rm -f /tmp/lifecycle.json

# Create IAM policy for pipeline access
log "Creating IAM policy"
cat > /tmp/policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:GetBucketLocation"
            ],
            "Resource": [
                "arn:aws:s3:::${BUCKET_NAME}/*",
                "arn:aws:s3:::${BUCKET_NAME}"
            ]
        }
    ]
}
EOF

POLICY_NAME="MediaToolBackupPolicy-${BUCKET_NAME}"
if aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --policy-document file:///tmp/policy.json \
    --description "Policy for Media Tool backup pipeline" 2>/dev/null; then
    log "IAM policy created: ${POLICY_NAME}"
else
    log "Policy may already exist or you lack IAM permissions"
fi

rm -f /tmp/policy.json

# Create bucket structure
log "Creating bucket structure"
aws s3api put-object --bucket "${BUCKET_NAME}" --key "postgres-exports/raw/"
aws s3api put-object --bucket "${BUCKET_NAME}" --key "postgres-exports/transformed/"
aws s3api put-object --bucket "${BUCKET_NAME}" --key "postgres-exports/metadata/"

# Output configuration
echo
log "S3 bucket setup complete!"
echo
info "Add to your pipeline.env file:"
echo "S3_BUCKET=${BUCKET_NAME}"
echo "AWS_REGION=${REGION}"
echo
info "Bucket structure:"
echo "s3://${BUCKET_NAME}/"
echo "├── postgres-exports/"
echo "│   ├── raw/          # Raw PostgreSQL exports"
echo "│   ├── transformed/  # Transformed MongoDB data"
echo "│   └── metadata/     # Export metadata"
echo
info "Lifecycle policy:"
echo "- 0-30 days: Standard storage"
echo "- 30-90 days: Infrequent Access (cheaper)"
echo "- 90-365 days: Glacier (much cheaper)"
echo "- After 365 days: Deleted automatically"