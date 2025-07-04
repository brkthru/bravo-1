# Phase 1: Initial Branch Protection (Start Here)

Since your CI has some failing tests, start with these protections:

```bash
# Basic protection without strict CI requirements
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":false,"contexts":[]}' \
  --field enforce_admins=false \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true

# Enable auto-delete branches
gh api repos/brkthru/bravo-1 \
  --method PATCH \
  --field delete_branch_on_merge=true
```

## What This Gives You:

- ✅ Requires 1 PR approval
- ✅ Prevents accidental force pushes/deletions
- ✅ Requires resolving PR comments
- ✅ Auto-cleans merged branches
- ⚠️ Allows merging even if CI fails (temporary)

## Phase 2: Add CI Checks (After Stabilizing Tests)

Once your tests are passing consistently:

```bash
# Add required status checks
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PATCH \
  --field required_status_checks='{"strict":true,"contexts":["Lint and Format Check","Backend Tests","Frontend Tests","Build"]}'
```

## Phase 3: Enforce Linear History

After team is comfortable:

```bash
# Require linear history
gh api repos/brkthru/bravo-1 \
  --method PATCH \
  --field allow_merge_commit=false \
  --field allow_squash_merge=true \
  --field allow_rebase_merge=true
```
