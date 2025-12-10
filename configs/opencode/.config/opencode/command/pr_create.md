---
description: Create a pull request with smart title detection
agent: plan
---

# Smart Pull Request Creation

This command automatically creates pull requests with intelligent title formatting based on your branch naming conventions. It analyzes your branch name and recent commits to generate appropriate PR titles using the GitHub MCP server.

## What This Command Does

1. **Detects repository information** from Git remotes automatically
2. **Analyzes your current branch name** to determine the appropriate title format
3. **Checks recent commit messages** to generate meaningful titles
4. **Pushes your branch** to the remote repository if needed
5. **Creates the pull request** using GitHub MCP tools with the smart title

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

### 1. Repository Detection and Validation

First, detect the GitHub repository information from Git remotes:

```bash
# Get the remote URL
REMOTE_URL=$(git config --get remote.origin.url)

# Extract owner and repo from different URL formats
if [[ $REMOTE_URL =~ git@github\.com:([^/]+)/([^.]+)\.git ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
elif [[ $REMOTE_URL =~ https://github\.com/([^/]+)/([^/]+)\.git ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
elif [[ $REMOTE_URL =~ https://github\.com/([^/]+)/([^/]+) ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]}"
else
    echo "Error: Unable to detect GitHub repository from remote URL: $REMOTE_URL"
    exit 1
fi
```

### 2. Branch and Commit Analysis

```bash
# Get current branch name
BRANCH=$(git branch --show-current)

# Get the latest commit message
COMMIT_MSG=$(git log -1 --pretty=format:'%s')

# Determine base branch with improved detection
get_base_branch() {
    # Try to get default branch from symbolic ref
    local base=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
    
    # If that fails, try common defaults
    if [[ -z "$base" ]]; then
        # Check if main exists
        if git show-ref --verify --quiet refs/remotes/origin/main; then
            base="main"
        # Check if master exists
        elif git show-ref --verify --quiet refs/remotes/origin/master; then
            base="master"
        # Default to main
        else
            base="main"
        fi
    fi
    
    echo "$base"
}

BASE_BRANCH=$(get_base_branch)
```

### 3. Push Branch to Remote

```bash
# Push the current branch to origin if not already pushed
git push -u origin $BRANCH
```

### 4. Generate Smart PR Title

```bash
# Apply smart title logic based on branch naming pattern
if [[ $BRANCH =~ ^[A-Za-z]{2}-[0-9]+ ]]; then
    # Ticket-based branch: use "TICKET: description" format
    PR_TITLE="$BRANCH: $COMMIT_MSG"
else
    # Regular branch: use commit message as title
    PR_TITLE="$COMMIT_MSG"
fi
```

### 5. Create Pull Request Using GitHub MCP Tools

Use the `github_create_pull_request` tool with the detected repository information and generated title:

**Parameters for MCP Tool:**
- `owner`: Repository owner (detected from Git remote)
- `repo`: Repository name (detected from Git remote)  
- `title`: Generated smart title
- `head`: Current branch name
- `base`: Base branch (usually "main" or "master")

The tool will create the pull request and return the PR details including URL and number.

## Complete Implementation

### Repository Detection Function

```bash
detect_github_repo() {
    local remote_url=$(git config --get remote.origin.url 2>/dev/null)
    
    if [[ -z "$remote_url" ]]; then
        echo "Error: No Git remote 'origin' found" >&2
        return 1
    fi
    
    local owner repo
    
    # Handle SSH format: git@github.com:owner/repo.git
    if [[ $remote_url == git@github.com:*/*.git ]]; then
        local temp=${remote_url#git@github.com:}  # Remove git@github.com: prefix
        temp=${temp%.git}                         # Remove .git suffix  
        owner=${temp%/*}                          # Everything before last /
        repo=${temp#*/}                           # Everything after first /
    # Handle HTTPS format: https://github.com/owner/repo.git
    elif [[ $remote_url == https://github.com/*/*.git ]]; then
        local temp=${remote_url#https://github.com/}  # Remove https://github.com/ prefix
        temp=${temp%.git}                             # Remove .git suffix
        owner=${temp%/*}                              # Everything before last /
        repo=${temp#*/}                               # Everything after first /
    # Handle HTTPS without .git: https://github.com/owner/repo  
    elif [[ $remote_url == https://github.com/*/* ]]; then
        local temp=${remote_url#https://github.com/}  # Remove https://github.com/ prefix
        owner=${temp%/*}                              # Everything before last /
        repo=${temp#*/}                               # Everything after first /
    else
        echo "Error: Unable to parse GitHub repository from remote URL: $remote_url" >&2
        return 1
    fi
    
    printf "%s %s" "$owner" "$repo"
}
```

### Smart PR Creation Workflow

```bash
# Step 1: Detect repository information
REPO_INFO=$(detect_github_repo)
if [[ $? -ne 0 ]]; then
    echo "$REPO_INFO"
    exit 1
fi

read OWNER REPO <<< "$REPO_INFO"

# Step 2: Get branch and commit information
BRANCH=$(git branch --show-current)
COMMIT_MSG=$(git log -1 --pretty=format:'%s')

# Step 3: Determine base branch
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Step 4: Push branch to remote
echo "Pushing branch '$BRANCH' to origin..."
git push -u origin "$BRANCH"

# Step 5: Generate smart title
if [[ $BRANCH =~ ^[A-Za-z]{2}-[0-9]+ ]]; then
    PR_TITLE="$BRANCH: $COMMIT_MSG"
else
    PR_TITLE="$COMMIT_MSG"
fi

# Step 6: Create PR using GitHub MCP tool
echo "Creating pull request with title: '$PR_TITLE'"
echo "Repository: $OWNER/$REPO"
echo "Branch: $BRANCH -> $BASE_BRANCH"
```

**Note:** The final step uses the GitHub MCP `github_create_pull_request` tool instead of GitHub CLI.

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

## Error Handling

The command includes comprehensive error handling for:

- **Missing Git remote**: Clear error message when no origin remote is configured
- **Invalid remote URL**: Error when remote URL is not a GitHub repository
- **Branch push failures**: Git push errors are displayed to user
- **MCP tool failures**: GitHub MCP tool errors are handled gracefully

## Advanced Features

### Custom Base Branch
You can specify a different base branch by setting the `BASE_BRANCH` variable before running the command.

### Draft PR Creation
The implementation can be extended to support draft PRs by adding a `draft: true` parameter to the MCP tool call.

### PR Description
Future enhancements can include automatic PR description generation based on commit history.

## Prerequisites

- Git repository with GitHub remote configured
- GitHub MCP server enabled in OpenCode configuration
- Current branch has at least one commit
- Valid GitHub authentication token in environment
