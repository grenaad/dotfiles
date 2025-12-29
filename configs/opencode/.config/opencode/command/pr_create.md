---
description: Create GitHub PR with intelligent diff analysis and gh CLI integration
agent: build
---

## Step 1: Repository Validation & Preprocessing

Check if we're in a git repository:
!`git rev-parse --is-inside-work-tree`

Get the remote URL to identify the repository:
!`git config --get remote.origin.url`

Get current branch name:
!`git branch --show-current`

Detect the default branch (main/master):
!`git symbolic-ref refs/remotes/origin/HEAD`

Check if FETCH_HEAD exists (confirms recent pull):
!`git rev-parse --verify FETCH_HEAD`

Get list of changed files:
!`git diff FETCH_HEAD...HEAD --name-only`

Check working directory status:
!`git status --porcelain`

Purpose: These commands validate the repository setup, ensure we're on a feature branch (not main/master), and confirm that a recent git pull was performed to enable accurate change comparison.

## Step 2: SSH Configuration Analysis

Check SSH configuration for custom Git hosts:
!`cat ~/.ssh/config | grep -A5 -B5 "work"`

Verify SSH host resolution:
!`ssh -G "work" | grep "^hostname "`

Purpose: Since repositories may use custom SSH aliases, these commands verify that aliases point to GitHub, enabling the script to work with custom Git configurations.

## Step 3: Basic Change Analysis

List files changed between base branch and current branch:
!`git diff FETCH_HEAD...HEAD --name-only`

Get change statistics (lines added/removed per file):
!`git diff FETCH_HEAD...HEAD --stat`

Get commit history for context:
!`git log FETCH_HEAD...HEAD --oneline`

Get complete diff for detailed analysis:
!`git diff FETCH_HEAD...HEAD`

Purpose: These commands analyze what changed, providing the raw content needed for intelligent PR title and description generation. The triple-dot notation (FETCH_HEAD...HEAD) shows changes from the merge base, which is crucial for accurate comparison.

## Step 4: Authentication & Environment Check

Verify GitHub CLI authentication:
!`gh auth status`

Check repository context:
!`gh repo view --json owner,name,defaultBranch`

Purpose: Ensure gh CLI is properly authenticated and can access the current repository before attempting PR operations.

## Step 5: Intelligent Diff Analysis & PR Content Generation

**Analyze the diff content** using the above context to understand:
1. What has changed functionally
2. File type distribution (from file type breakdown)
3. Scale of changes (from complexity indicators)  
4. Generate a high-level summary of the changes
5. Categorize changes by functionality, not by individual files

**PR Description Format:**

```
## Summary

[Overall high-level summary of what this PR accomplishes]

## Changes Made

### **[Category Name]**

- [High-level description of related functionality changes]
- [Specific implementation detail]
  - [Sub-configuration or related detail]
  - [Another sub-configuration]

### **[Another Category]**

- [Description of different functional area changes]
- [Specific implementation detail]
  - [Sub-configuration or related detail]

### **[Additional Category]**

- [Description of other grouped changes if applicable]
- [Specific implementation detail]

## Technical Details

**Architecture Flow:**

```
[Component A] → [Component B] → [Component C]
```

**Code Changes:**

- `file/path.ext:line_number` - [Description of what changed]
- `another/file.ext:line_number` - [Description of what changed]
```

**Analysis Guidelines:**

**Changes Made Section:**

- Create subsections using `### **[Category Name]**` format for each functional area
- Focus on functional changes, not just code syntax or individual files
- Dynamically determine appropriate categories based on the nature of changes (e.g., Authentication, Database, Configuration, UI/UX, Performance, Bug Fixes, etc.)
- Group related functionality changes together, even if they span multiple files
- Use main bullet points for high-level changes and indented sub-bullets for specific implementation details:
  - Main bullets: Primary functional changes or features
  - Sub-bullets (2 spaces): Configuration details, specific files affected, or related sub-components
- Keep explanations concise but informative about what functionality is being added, modified, or fixed

**Technical Details Section:**

- **Architecture Flow**: Create a visual flow showing how components interact (use arrows →)
- **Code Changes**: Include specific file paths with line numbers and brief descriptions using format: `file/path.ext:line_number - Description`

## Step 6: Smart Title Generation with Context

Generate the PR title using branch naming logic and preprocessed data:

Branch information (from preprocessing):
- Current branch: `{CURRENT_BRANCH}`
- Branch format: `{BRANCH_FORMAT}`

1. Generate a title from all the changes (using diff analysis above)
2. Use the preprocessed branch information
3. Apply title logic based on `{BRANCH_FORMAT}`:
   - If `{BRANCH_FORMAT}` equals "ticket-format" (e.g., CH-123, AB-456):
     **Title format:** `{CURRENT_BRANCH}: {title}`
   - If `{BRANCH_FORMAT}` equals "regular-branch":
     **Title format:** `{title}`

## Step 7: Push Branch with Status

Push the current branch to origin:

Pre-push status:
!`git status --porcelain`

- Run: `git push -u origin {CURRENT_BRANCH}`
- Handle any push errors appropriately

Post-push verification:
`git ls-remote origin $(git branch --show-current) && echo "Push successful" || echo "Push verification failed"`

## Step 8: GitHub CLI Integration - Check for Existing PR and Create/Update

First check if a pull request already exists for the current branch, then either update it or create a new one.

### 8.1: Search for Existing Pull Request

Use gh CLI to check for existing PRs:

```bash
EXISTING_PR=$(gh pr list --head {CURRENT_BRANCH} --json number --jq '.[0].number')
```

Purpose: Check if a PR already exists for this branch. The command:
- `--head {CURRENT_BRANCH}` - finds PRs where the source branch matches current branch
- `--json number --jq '.[0].number'` - extracts just the PR number from the first result

### 8.2: Analyze Search Results

Check the search results to determine next action:

```bash
if [ "$EXISTING_PR" != "null" ] && [ -n "$EXISTING_PR" ]; then
    echo "Found existing PR #$EXISTING_PR - will update"
    # Proceed to update existing PR (Step 8.4)
else
    echo "No existing PR found - will create new one"  
    # Proceed to create new PR (Step 8.3)
fi
```

### 8.3: Create New Pull Request

If no existing PR found, use gh CLI to create new PR:

```bash
gh pr create \
  --title "{GENERATED_TITLE}" \
  --head {CURRENT_BRANCH} \
  --base {DEFAULT_BRANCH} \
  --body "{GENERATED_DESCRIPTION}"
```

Purpose: Create new PR with:
- `--title` - Generated title from Step 6
- `--head` - Current branch from preprocessing
- `--base` - Default branch from preprocessing  
- `--body` - Generated PR description from Step 5

### 8.4: Update Existing Pull Request

If existing PR found, use gh CLI to update it:

```bash
gh pr edit {EXISTING_PR} \
  --title "{GENERATED_TITLE}" \
  --body "{GENERATED_DESCRIPTION}"
```

Purpose: Update existing PR with:
- `{EXISTING_PR}` - PR number from search results (Step 8.2)
- `--title` - Generated title from Step 6
- `--body` - Generated PR description from Step 5

Note: The head and base branches don't need to be updated as they remain the same.

### 8.5: Complete GitHub CLI Workflow Script

```bash
#!/bin/bash

# Variables from preprocessing
CURRENT_BRANCH="{CURRENT_BRANCH}"
DEFAULT_BRANCH="{DEFAULT_BRANCH}"
GENERATED_TITLE="{GENERATED_TITLE}"
GENERATED_DESCRIPTION="{GENERATED_DESCRIPTION}"

# Search for existing PR
echo "Searching for existing PR for branch: $CURRENT_BRANCH"
EXISTING_PR=$(gh pr list --head "$CURRENT_BRANCH" --json number --jq '.[0].number')

# Determine action and execute
if [ "$EXISTING_PR" != "null" ] && [ -n "$EXISTING_PR" ]; then
    echo "Updating existing PR #$EXISTING_PR"
    gh pr edit "$EXISTING_PR" \
      --title "$GENERATED_TITLE" \
      --body "$GENERATED_DESCRIPTION"
    echo "PR #$EXISTING_PR updated successfully"
    gh pr view "$EXISTING_PR" --web
else
    echo "Creating new PR"
    gh pr create \
      --title "$GENERATED_TITLE" \
      --head "$CURRENT_BRANCH" \
      --base "$DEFAULT_BRANCH" \
      --body "$GENERATED_DESCRIPTION"
    echo "New PR created successfully"
    gh pr view --web
fi
```

## Step 9: Success Response

After successful PR creation/update, display:

Final repository state:
!`git branch -vv | grep "$(git branch --show-current)"`
!`git log --oneline -1`

Display results:
- PR title: `{GENERATED_TITLE}`
- PR URL: `{PR_URL}`
- Branch information: `{CURRENT_BRANCH}` → `{DEFAULT_BRANCH}`
- Brief summary of changes included
- Action taken: "Created new PR" or "Updated existing PR #{PR_NUMBER}"

## Error Handling

Basic error handling for common issues:

**Git Repository Issues:**
- Not in a git repository
- No remote origin configured
- Working directory has uncommitted changes
- No changes detected between branches

**GitHub CLI Issues:**
- Authentication failure (`gh auth login` required)
- Network connectivity problems
- Repository access permissions
- Invalid branch names or missing remote branches

**Branch Validation:**
- Attempting to create PR from main/master branch
- Branch not pushed to remote
- FETCH_HEAD not available (need to run `git pull` first)

## Complete Workflow Summary

Here's the complete order of operations:

1. **Repository Validation** - Validate git repository and branch status
2. **SSH Configuration** - Handle custom SSH aliases for Git remotes  
3. **Basic Change Analysis** - Get git diff data and commit history
4. **Authentication Check** - Verify gh CLI authentication and repo access
5. **Intelligent Diff Analysis** - Comprehensive analysis with categorization
6. **Smart Title Generation** - Branch-aware title creation with format detection
7. **Branch Push** - Ensure branch is available on GitHub with status checks
8. **GitHub CLI Integration** - Search for existing PR and create/update accordingly
9. **Success Response** - Display final status and PR information

## Key Technical Details

**Branch Format Detection:**
The script automatically detects branch naming patterns:
- `ticket-format`: Matches pattern like XX-123 → Title format: `{BRANCH}: {description}`
- `regular-branch`: Other patterns → Title format: `{description}`

**Change Analysis Strategy:**
- Uses `FETCH_HEAD...HEAD` for accurate comparison against last pulled state
- Analyzes file changes, statistics, and commit history for context
- Generates categorized descriptions based on functional changes, not just files modified
- Creates architecture flows and technical details sections

**GitHub CLI Advantages:**
- Simpler syntax compared to API calls
- Direct terminal integration and scriptability
- Built-in authentication handling
- Automatic repository context detection
- Interactive prompts for missing information

This approach ensures the PR creation process is robust, intelligent, and handles various Git configurations automatically while providing comprehensive content analysis and generation.