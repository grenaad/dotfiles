---
description: Create GitHub PR with smart title and intelligent diff analysis
agent: build
---

You are an AI assistant helping to create a GitHub Pull Request with smart title detection and intelligent change analysis. Follow these steps precisely:

## Current Repository Context

Repository information:
!`git config --get remote.origin.url`

Current working state:
!`git branch --show-current`
!`git status --porcelain`

Git repository validation:
!`git rev-parse --is-inside-work-tree 2>/dev/null || echo "false"`

## Step 1: Repository Validation

Validate the repository setup using the context above:

1. Check if we're in a Git repository (already gathered above)
2. Verify GitHub remote exists (already gathered above)  
3. Ensure we're not on the main/master branch (check current branch above)
4. Current branch name (already gathered above)

Use the injected command results to perform validation. If any validation fails, provide a clear error message and exit.

## Step 2: Enhanced Repository Information Detection

Extract GitHub repository information from the Git remote URL using the context already gathered:

SSH configuration context:
!`cat ~/.ssh/config 2>/dev/null | grep -A 5 -B 5 "github.com" || echo "No GitHub SSH config found"`

Parse owner and repository name from the remote URL format:
- SSH: `git@github.com:owner/repo.git`
- HTTPS: `https://github.com/owner/repo.git`
- HTTPS without .git: `https://github.com/owner/repo`

If the URL doesn't match a GitHub repository format, exit with an error.

## Step 3: Base Branch Detection and Fetch

Detect the default branch and fetch the latest state:

Default branch detection:
!`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "not-found"`

Branch verification:
!`git show-ref --verify --quiet refs/remotes/origin/main && echo "main-exists" || echo "main-missing"`
!`git show-ref --verify --quiet refs/remotes/origin/master && echo "master-exists" || echo "master-missing"`

Based on the results:
1. Use the symbolic-ref result if available
2. Otherwise check main/master existence results
3. Default to "main" if neither exists

## Step 4: Enhanced Change Detection

Use improved git diff workflow to analyze changes with immediate context:

Verify FETCH_HEAD exists (user must have run git pull):
!`git rev-parse --verify FETCH_HEAD >/dev/null 2>&1 && echo "FETCH_HEAD-exists" || echo "FETCH_HEAD-missing"`

**Error Handling**: If FETCH_HEAD is missing, exit with error:
```
❌ FETCH_HEAD not found

Please run the following command before creating a PR:
git pull origin {base_branch}

This ensures we can compare your changes against the latest base branch.
Aborting PR creation.
```

Files changed:
!`git diff FETCH_HEAD...HEAD --name-only`

Change summary:
!`git diff --stat FETCH_HEAD...HEAD`

Commits being included:
!`git log --oneline FETCH_HEAD..HEAD`

Recent commit details:
!`git log --oneline -3 --stat`

Analysis:
1. **Check if any changes exist** from the files changed output above
2. If no files are returned, exit gracefully with message "No changes detected between current branch and {base_branch}"
3. Use the change summary for PR description context
4. Use commit context for understanding change history

## Step 5: Comprehensive Diff Analysis and PR Description Generation

Get the full diff and analyze the changes using the enhanced workflow:

Complete diff for analysis:
!`git diff FETCH_HEAD...HEAD`

File type breakdown:
!`git diff FETCH_HEAD...HEAD --name-only | sed 's/.*\.//' | sort | uniq -c | sort -nr`

Code complexity indicators:
!`git diff FETCH_HEAD...HEAD --stat | tail -1`

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

Generate the PR title using branch naming logic:

Branch analysis:
!`echo "Current branch: $(git branch --show-current)"`
!`git branch --show-current | grep -E '^[A-Za-z]{2}-[0-9]+$' && echo "ticket-format" || echo "regular-branch"`

1. Generate a title from all the changes (using diff analysis above)
2. Get the current branch name (from branch analysis)
3. Apply title logic:
   - If branch matches pattern `^[A-Za-z]{2}-[0-9]+$` (e.g., CH-123, AB-456):
     **Title format:** `{BRANCH_NAME}: {title}`
   - Otherwise: **Title format:** `{title}`

## Step 7: Push Branch with Status

Push the current branch to origin:

Pre-push status:
!`git status --porcelain`

- Run: `git push -u origin {current_branch}`
- Handle any push errors appropriately

Post-push verification:
`git ls-remote origin $(git branch --show-current) && echo "Push successful" || echo "Push verification failed"`

## Step 8: Check for Existing Pull Request and Create/Update

First check if a pull request already exists for the current branch, then either update it or create a new one.

### 9.1: Search for Existing Pull Request

Use the GitHub MCP tool `github_search_pull_requests` to check for existing PRs:

- `query`: `head:{current_branch} repo:{owner}/{repo}`
  - `head:{current_branch}` - searches for PRs where the source branch matches current branch
  - `repo:{owner}/{repo}` - limits search to the current repository

### 9.2: Analyze Search Results

Check the search results to determine next action:

1. **If no PRs found** (empty results or no matching PRs):
   - Proceed to create new PR (Step 9.3)

2. **If PR found** (one or more results):
   - Extract the PR number from the first result
   - Proceed to update existing PR (Step 9.4)

### 9.3: Create New Pull Request

If no existing PR found, use the GitHub MCP tool `github_create_pull_request`:

- `owner`: Repository owner (from step 2)
- `repo`: Repository name (from step 2)
- `title`: Generated title (from step 7)
- `head`: Current branch name
- `base`: Base branch (from step 3)
- `body`: Generated PR description (from step 6)

### 9.4: Update Existing Pull Request

If existing PR found, use the GitHub MCP tool `github_update_pull_request`:

- `owner`: Repository owner (from step 2)
- `repo`: Repository name (from step 2)
- `pullNumber`: PR number from search results (Step 9.2)
- `title`: Generated title (from step 7)
- `body`: Generated PR description (from step 6)

Note: The `head` and `base` branches don't need to be updated as they remain the same.

## Step 9: Success Response

After successful PR creation, display:

Final repository state:
!`git branch -vv | grep "$(git branch --show-current)"`
!`git log --oneline -1`

- PR title
- PR URL
- Branch information (current -> base)
- Brief summary of changes included

## Error Handling

Provide clear, actionable error messages for:

- Not in a Git repository (check repository context section)
- No GitHub remote configured (check repository context section)
- Invalid GitHub remote URL
- Already on main/master branch (check current branch in context)
- **FETCH_HEAD not found** (user must run git pull first)
- No changes detected (check files changed section)
- Git push failures
- GitHub API/MCP tool failures

## Execution Notes

- **User must manually pull before execution**: `git pull origin {base_branch}` 
- **Use FETCH_HEAD for precise comparisons** - refers to what was pulled
- **Triple-dot notation**: `FETCH_HEAD...HEAD` shows diff from merge base
- **Parallel execution**: All commands use `!` prefix for maximum performance
- **Real-time context**: Use bash injection results for immediate validation and analysis
- Use bash tools for all Git operations
- Use GitHub MCP tools only for PR creation
- Provide informative progress updates during execution
- **Stop execution if FETCH_HEAD missing** - require manual pull first
- Exit gracefully if no changes are detected
- Handle both SSH and HTTPS GitHub remote formats
- Support repositories with either "main" or "master" as default branch
- Analyze the actual code changes in the diff to provide meaningful descriptions
- Focus on high-level functional changes rather than line-by-line details