# Recommended Branch Protection Rules

This document outlines recommended GitHub branch protection rules for the Bravo-1 repository, designed to support both human and AI agent workflows.

## Main Branch Protection

### Basic Settings

- **Require a pull request before merging**: ✅
  - **Require approvals**: 1
  - **Dismiss stale pull request approvals**: ✅
  - **Require review from CODEOWNERS**: ❌ (optional)

### Status Checks

- **Require status checks to pass before merging**: ✅
  - Required checks:
    - `lint-and-format`
    - `test-backend`
    - `test-frontend`
    - `e2e-tests`
    - `trunk`
- **Require branches to be up to date**: ✅

### Conversation Resolution

- **Require conversation resolution before merging**: ✅

### Additional Settings

- **Require signed commits**: ❌ (optional, may complicate AI workflows)
- **Require linear history**: ❌ (squash merging preferred)
- **Include administrators**: ❌ (admins can bypass in emergencies)
- **Allow force pushes**: ❌
- **Allow deletions**: ❌

## Develop Branch Protection

Similar to main, but with relaxed settings:

- **Require approvals**: 1 (can be self-approved for AI agents)
- **Require status checks**: Same as main
- **Allow force pushes**: ❌
- **Allow deletions**: ❌

## AI Agent Considerations

### Workflow Support

1. **Labels**: Automatically add `ai-generated` label to PRs from known AI accounts
2. **Review Requirements**: Human review required for all AI-generated PRs to main
3. **Auto-merge**: Can be enabled for develop branch with passing tests

### Recommended Bot Permissions

- **Read**: Contents, Issues, Pull requests
- **Write**: Issues, Pull requests
- **No direct push**: All changes via PR

### Special Rules for AI PRs

1. **Title Format**: Must include `[AI]` prefix
2. **Description**: Must use AI PR template
3. **Size Limits**: Recommend max 200 lines changed
4. **Test Coverage**: Must maintain or improve coverage

## Implementation Steps

1. **Navigate to Settings > Branches**
2. **Add rule for `main`**
3. **Configure protection rules as above**
4. **Add rule for `develop`** (if using git-flow)
5. **Save changes**

## Merge Strategies

### Recommended: Squash and Merge

- Keeps history clean
- All commits in PR become one
- Good for AI-generated commits

### Alternative: Rebase and Merge

- Preserves individual commits
- Requires clean commit history
- Better for carefully crafted commits

## Emergency Procedures

### Bypassing Protection

Only repository admins can:

1. Temporarily disable protection
2. Push directly (emergency hotfixes)
3. Must document reason in commit message

### Rollback Process

1. Create revert PR
2. Fast-track review
3. Deploy immediately after merge

## Monitoring

### Weekly Review

- Check for stale PRs
- Review AI agent activity
- Audit direct pushes (if any)
- Update rules as needed

### Metrics to Track

- Average PR review time
- AI vs human contribution ratio
- Test failure rates
- Protection rule violations

## Future Enhancements

### Phase 2 (After stabilization)

- Require 2 reviewers for main
- Add security scanning
- Implement PR size limits
- Add commit message linting

### AI-Specific Features

- Auto-assign human reviewers for AI PRs
- Implement complexity scoring
- Add semantic diff analysis
- Create AI review guidelines

## Questions?

Contact the repository maintainers or create an issue with the `branch-protection` label.
