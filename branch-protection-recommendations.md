# Recommended Branch Protection Rules for Main Branch

## Essential Protections

### 1. **Require Pull Request Reviews**

- ✅ Require at least 1 approval before merging
- ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ Require review from CODEOWNERS (if you have a CODEOWNERS file)
- ⚠️ Optional: Require approval from someone other than the PR author

### 2. **Require Status Checks**

- ✅ Require branches to be up to date before merging
- ✅ Required status checks:
  - `Lint and Format Check` (Trunk check)
  - `Backend Tests`
  - `Frontend Tests`
  - `Build`
  - ⚠️ Consider making `E2E Tests` required after stabilizing them

### 3. **Enforce Linear History**

- ✅ Require linear history (no merge commits)
- This ensures a clean git history with rebased commits

### 4. **Restrict Push Access**

- ✅ Restrict who can push to main branch
- ✅ Include administrators in restrictions
- ❌ Do NOT allow force pushes (even from admins)
- ❌ Do NOT allow deletions

### 5. **Require Conversation Resolution**

- ✅ Require all PR comments to be resolved before merging
- Ensures all feedback is addressed

## Additional Recommended Protections

### 6. **Require Signed Commits** (Optional but recommended)

- ✅ Require all commits to be signed with GPG keys
- Adds authenticity verification

### 7. **Restrict PR Merge Types**

- Allow only:
  - ✅ Squash merging (recommended for feature branches)
  - ✅ Rebase merging (for clean history)
  - ❌ Regular merge commits (creates messy history)

### 8. **Auto-delete Head Branches**

- ✅ Automatically delete feature branches after merge
- Keeps repository clean

## GitHub CLI Commands to Set Up

```bash
# Set up branch protection for main branch
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Lint and Format Check","Backend Tests","Frontend Tests","Build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true \
  --field lock_branch=false \
  --field allow_fork_syncing=true

# Enable auto-delete head branches
gh api repos/brkthru/bravo-1 \
  --method PATCH \
  --field delete_branch_on_merge=true

# Disable merge commits (only allow squash and rebase)
gh api repos/brkthru/bravo-1 \
  --method PATCH \
  --field allow_merge_commit=false \
  --field allow_squash_merge=true \
  --field allow_rebase_merge=true
```

## For Development/Feature Branches

Consider lighter protections for `develop` or feature branches:

- Require only status checks (no PR reviews)
- Allow administrators to bypass
- Still prevent force pushes and deletions

## Implementation Priority

1. **Start with**: Status checks + PR reviews
2. **Then add**: Linear history + conversation resolution
3. **Finally consider**: Signed commits + CODEOWNERS

## Notes

- These protections won't apply to existing PRs, only new ones
- Administrators can still merge PRs that don't meet requirements in emergencies (unless "Include administrators" is checked)
- Start with fewer restrictions and gradually add more as the team adapts
