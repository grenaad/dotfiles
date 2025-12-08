---
description: Create a pull request with smart title detection
agent: build
---

Create a pull request for this work. Follow these steps:

1. Check git status and show what has changed since main/master
2. Create a PR title and description based on the actual changes
   - If branch name starts with "2 letters-numbers" (e.g., CH-123, AB-456), use format: <branch name>: <title>
   - Otherwise, use a descriptive title based on the changes
3. Push the branch if needed and create the PR
   Updated Step-by-Step Process
   Step 4: Create Pull Request (Enhanced)

# Check if branch follows ticket pattern (2 letters-numbers)

BRANCH=$(git branch --show-current)
if [[ $BRANCH =~ ^[A-Za-z]{2}-[0-9]+ ]]; then
    # Use ticket format: BRANCH-NAME: Description
    gh pr create --title "$BRANCH: Your description here"
else # Use regular descriptive format
gh pr create --title "Your descriptive title"
fi
Enhanced Shortcuts
Smart Auto-title Based on Branch Pattern

# Auto-detect branch pattern and format title accordingly

create_smart_pr() {
local branch=$(git branch --show-current)
    local commit_msg=$(git log -1 --pretty=format:'%s')

    if [[ $branch =~ ^[A-Za-z]{2}-[0-9]+ ]]; then
        # Ticket-based branch: use "TICKET: description" format
        gh pr create --title "$branch: $commit_msg"
    else
        # Regular branch: use commit message as title
        gh pr create --title "$commit_msg"
    fi

}
Shell Alias for Smart PR Creation

# Add to your .bashrc or .zshrc

alias gpr-smart='git push -u origin $(git branch --show-current) && create_smart_pr'
Examples
Ticket-based Branch Examples

- Branch: CH-1396 → PR Title: CH-1396: Add user authentication system
- Branch: AB-123 → PR Title: AB-123: Fix database connection pooling
- Branch: BG-456 → PR Title: BG-456: Update deployment configuration
  Regular Branch Examples
- Branch: feature/user-auth → PR Title: Add user authentication system
- Branch: fix/db-connection → PR Title: Fix database connection pooling
- Branch: update/deployment → PR Title: Update deployment configuration
  Complete One-liner with Pattern Detection

# Ultimate one-liner that handles both patterns

BRANCH=$(git branch --show-current); COMMIT=$(git log -1 --pretty=format:'%s'); git push -u origin $BRANCH && if [[ $BRANCH =~ ^[A-Za-z]{2}-[0-9]+ ]]; then gh pr create --title "$BRANCH: $COMMIT"; else gh pr create --title "$COMMIT"; fi
