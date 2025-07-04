# AWS S3 Setup Guide

This guide helps you set up AWS S3 for storing Media Tool exports.

## Current Status

Your AWS user (`terraform-deployer`) currently lacks S3 permissions. You have two options:

### Option 1: Get S3 Permissions (Recommended)

Ask your AWS admin to add these permissions to your IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetBucketEncryption",
        "s3:PutBucketEncryption",
        "s3:GetLifecycleConfiguration",
        "s3:PutLifecycleConfiguration"
      ],
      "Resource": "arn:aws:s3:::media-tool-backups-*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:GetObjectVersion"],
      "Resource": "arn:aws:s3:::media-tool-backups-*/*"
    }
  ]
}
```

### Option 2: Use a Different AWS Profile

If you have another AWS profile with S3 permissions:

```bash
# List your AWS profiles
cat ~/.aws/config | grep profile

# Use a different profile
export AWS_PROFILE=your-profile-with-s3-access

# Verify the profile works
aws sts get-caller-identity
```

## Setting Up S3 (Once You Have Permissions)

### 1. Create the S3 Bucket

```bash
cd scripts/production-pipeline

# Run the setup script
./setup-s3-bucket.sh

# This will:
# - Create a uniquely named S3 bucket
# - Enable versioning and encryption
# - Set up lifecycle policies for cost optimization
# - Create the folder structure
```

### 2. Update Your Configuration

Edit `scripts/production-pipeline/config/pipeline.env`:

```bash
# Replace this line:
S3_BUCKET=media-tool-backups-NEEDS-CREATION

# With the bucket name from setup script:
S3_BUCKET=media-tool-backups-1234567890
```

### 3. Test S3 Upload

```bash
# List your existing exports
ls -la exports/raw/

# Test upload with dry-run
./upload-to-s3.sh --dry-run 20250622-072326

# Actually upload
./upload-to-s3.sh 20250622-072326
```

## Using the Pipeline Without S3

The local pipeline works fine without S3:

```bash
# Run local export (no S3 upload)
./production-export-pipeline-local.sh

# This creates timestamped exports in:
# - exports/raw/{timestamp}/
# - exports/transformed/{timestamp}/
```

## Manual S3 Operations

### Upload Existing Export

```bash
# After getting S3 permissions
cd scripts/production-pipeline
./upload-to-s3.sh 20250622-072326
```

### List Exports in S3

```bash
# List all exports
aws s3 ls s3://your-bucket-name/postgres-exports/metadata/ --recursive

# List exports from specific date
aws s3 ls s3://your-bucket-name/postgres-exports/metadata/2025-06-22/
```

### Download from S3

```bash
# Use the download script
./download-from-s3.sh

# Or manually
aws s3 cp s3://your-bucket-name/postgres-exports/transformed/2025-06-22/20250622-072326-transformed.tar.gz .
```

## Cost Optimization

The S3 lifecycle policy automatically:

- Moves files to Infrequent Access after 30 days (cheaper)
- Moves files to Glacier after 90 days (much cheaper)
- Deletes files after 365 days

To keep exports longer, modify the lifecycle policy in `setup-s3-bucket.sh`.

## Security Best Practices

1. **Use IAM Roles** instead of access keys when possible
2. **Enable MFA** for AWS account
3. **Restrict bucket access** to specific IAM users/roles
4. **Enable bucket logging** for audit trails
5. **Use bucket policies** to enforce encryption

## Troubleshooting

### "Access Denied" Errors

```bash
# Check your current permissions
aws iam get-user
aws iam list-attached-user-policies --user-name $(aws iam get-user --query 'User.UserName' --output text)
```

### "Bucket Already Exists" Error

S3 bucket names must be globally unique. The setup script adds a timestamp to avoid conflicts.

### "Invalid Credentials" Error

```bash
# Re-authenticate
aws configure

# Or with SSO
aws sso login --profile your-profile
```

## Next Steps

1. Get S3 permissions from your AWS admin
2. Run `setup-s3-bucket.sh` to create bucket
3. Update `pipeline.env` with bucket name
4. Test with `upload-to-s3.sh --dry-run`
5. Run full pipeline with S3 enabled
