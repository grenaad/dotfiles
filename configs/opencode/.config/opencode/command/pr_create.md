---
description: Create a pull request with smart title detection
agent: build
---

# Smart Pull Request Creation

This command automatically creates pull requests with intelligent title formatting based on your branch naming conventions. It analyzes your branch name and recent commits to generate appropriate PR titles.

## What This Command Does

1. **Analyzes your current branch name** to determine the appropriate title format
2. **Checks recent commit messages** to generate meaningful titles
3. **Pushes your branch** to the remote repository if needed
4. **Creates the pull request** using GitHub CLI with the smart title

## Branch Name Logic

### Ticket-Based Branches
If your branch name follows the pattern: `XX-###` (2 letters, dash, numbers)

**Examples:** `CH-123`, `AB-456`, `BG-789`

**PR Title Format:** `BRANCH-NAME: Commit Message`

### Descriptive Branches  
For all other branch naming patterns

**Examples:** `feature/auth`, `fix/database`, `update/config`

**PR Title Format:** `Commit Message`

## Step-by-Step Process

1. **Check current branch and commit message**
   ```bash
   git branch --show-current
   git log -1 --pretty=format:'%s'
   ```

2. **Push branch to origin** (if not already pushed)
   ```bash
   git push -u origin $(git branch --show-current)
   ```

3. **Determine title format** based on branch pattern
   - Ticket pattern: Use `BRANCH: COMMIT_MESSAGE`
   - Other patterns: Use `COMMIT_MESSAGE`

4. **Create pull request** with generated title
   ```bash
   gh pr create --title "<generated_title>"
   ```

## Implementation

### Smart PR Creation Function

```bash
create_smart_pr() {
    local branch=$(git branch --show-current)
    local commit_msg=$(git log -1 --pretty=format:'%s')
    
    # Push the branch first
    git push -u origin $branch
    
    if [[ $branch =~ ^[A-Za-z]{2}-[0-9]+ ]]; then
        # Ticket-based branch: use "TICKET: description" format
        gh pr create --title "$branch: $commit_msg"
    else
        # Regular branch: use commit message as title
        gh pr create --title "$commit_msg"
    fi
}
```

### Shell Alias Setup

Add to your `.bashrc` or `.zshrc`:

```bash
# Smart PR creation alias
alias gpr-smart='create_smart_pr'
```

### One-Liner Command

For immediate use without creating a function:

```bash
BRANCH=$(git branch --show-current); COMMIT=$(git log -1 --pretty=format:'%s'); git push -u origin $BRANCH && if [[ $BRANCH =~ ^[A-Za-z]{2}-[0-9]+ ]]; then gh pr create --title "$BRANCH: $COMMIT"; else gh pr create --title "$COMMIT"; fi
```

## Usage Examples

### Ticket-Based Branches

| Branch Name | Commit Message | Generated PR Title |
|-------------|----------------|-------------------|
| `CH-1396` | "Add user authentication system" | `CH-1396: Add user authentication system` |
| `AB-123` | "Fix database connection pooling" | `AB-123: Fix database connection pooling` |
| `BG-456` | "Update deployment configuration" | `BG-456: Update deployment configuration` |

### Descriptive Branches

| Branch Name | Commit Message | Generated PR Title |
|-------------|----------------|-------------------|
| `feature/user-auth` | "Add user authentication system" | `Add user authentication system` |
| `fix/db-connection` | "Fix database connection pooling" | `Fix database connection pooling` |
| `update/deployment` | "Update deployment configuration" | `Update deployment configuration` |

## Quick Reference

```bash
# Create smart PR
create_smart_pr

# Or use the alias (after setup)
gpr-smart

# Manual title override
gh pr create --title "Custom title here"
```

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- Current branch has at least one commit
- Working in a Git repository with GitHub remote
