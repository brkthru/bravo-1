# Protect Main Branch - Basic Setup

## Quick Setup (Recommended)

This will require ALL changes to go through pull requests:

```bash
# Set up main branch protection
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":false,"contexts":[]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field required_conversation_resolution=true \
  --field block_creations=true \
  --field required_linear_history=false
```

## What This Does

✅ **Requires Pull Requests** - No direct pushes to main
✅ **Requires 1 Approval** - Someone must review the code
✅ **Applies to Everyone** - Including admins (enforce_admins=true)
✅ **Prevents Force Pushes** - Protects history
✅ **Prevents Branch Deletion** - Can't accidentally delete main
✅ **Requires Resolving Comments** - All discussions must be resolved

## Why This Is Important

1. **Code Review** - Catches bugs, improves code quality
2. **Knowledge Sharing** - Team stays aware of changes
3. **Audit Trail** - PR history shows who approved what
4. **Testing Hook** - Even if CI isn't required, it still runs
5. **Rollback Safety** - Easy to revert PR vs individual commits

## Common Workflows After Protection

```bash
# Normal development flow
git checkout -b feature/my-feature
# ... make changes ...
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature
gh pr create --base main --head feature/my-feature

# Quick fixes still need PRs
git checkout -b fix/typo
# ... fix typo ...
git add .
git commit -m "fix: correct typo in README"
git push origin fix/typo
gh pr create --fill  # Auto-fills PR from commit message
```

## Emergency Override (Use Sparingly\!)

If you absolutely must bypass (NOT recommended):

```bash
# Temporarily disable admin enforcement
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PATCH \
  --field enforce_admins=false

# Make emergency fix
git push origin main

# RE-ENABLE immediately
gh api repos/brkthru/bravo-1/branches/main/protection \
  --method PATCH \
  --field enforce_admins=true
```

## Tips

1. Create PR templates in `.github/pull_request_template.md`
2. Use draft PRs for work-in-progress
3. Set up CODEOWNERS file for automatic reviewers
4. Consider semantic PR titles (feat:, fix:, docs:)
