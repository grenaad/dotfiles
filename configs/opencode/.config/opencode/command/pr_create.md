---
description: Create GitHub PR with smart title and intelligent diff analysis
agent: build
---

You are an AI assistant helping to create a GitHub Pull Request with smart title detection and intelligent change analysis. Follow these steps precisely:

## Step 1: Repository Validation

Validate the repository setup, do this in parrallel:

1. Check if we're in a Git repository by looking for `.git` directory
2. Verify GitHub remote exists: `git config --get remote.origin.url`
3. Ensure we're not on the main/master branch
4. Get current branch name: `git branch --show-current`

Use bash commands to perform these checks. If any validation fails, provide a clear error message and exit.

## Step 2: Repository Information Detection

Extract GitHub repository information from the Git remote URL, do this in parrallel:

1. Get the remote URL: `git config --get remote.origin.url`
2. Get ssh alias with `cat ~/.ssh/config`
3. Parse owner and repository name from these URL formats:
   - SSH: `git@github.com:owner/repo.git`
   - HTTPS: `https://github.com/owner/repo.git`
   - HTTPS without .git: `https://github.com/owner/repo`

If the URL doesn't match a GitHub repository format, exit with an error.

## Step 3: Base Branch Detection and Fetch

Detect the default branch and fetch the latest state, do this in parrallel:

1. Try: `git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'`
2. If that fails, check if `origin/main` exists: `git show-ref --verify --quiet refs/remotes/origin/main`
3. If that fails, check if `origin/master` exists: `git show-ref --verify --quiet refs/remotes/origin/master`
4. Default to "main" if neither exists
5. **Fetch the specific base branch**: `git fetch origin {base_branch}`

## Step 4: Sync with Base Branch

Ensure the current branch is up-to-date with the fetched base branch:

1. **Check recent commits context**:
   - `git log --oneline -5` (See your recent commits)
   - `git log --oneline FETCH_HEAD -5` (See recent commits on fetched base)

2. **Attempt to merge latest base branch**:
   - Run: `git merge FETCH_HEAD`

3. **Handle merge conflicts**:
   - If merge conflicts occur, **STOP EXECUTION** immediately
   - Display the conflicted files: `git status --porcelain | grep "^UU\|^AA\|^DD"`
   - Provide clear error message:

     ```
     ❌ Merge conflicts detected with {base_branch}

     Conflicted files:
     [list of conflicted files]

     Please resolve these conflicts manually:
     1. Edit the conflicted files to resolve conflicts
     2. Run: git add <resolved-files>
     3. Run: git commit
     4. Then re-run this PR creation command

     Aborting PR creation.
     ```

   - Exit with error code

4. **If merge succeeds**, continue to next step

## Step 5: Enhanced Change Detection

Use improved git diff workflow to analyze changes:

1. **Check if any changes exist**: `git diff FETCH_HEAD...HEAD --name-only`
2. If no files are returned, exit gracefully with message "No changes detected between current branch and {base_branch}"
3. **Get change summary**: `git diff --stat FETCH_HEAD...HEAD`
4. **Get commit context**: `git log --oneline FETCH_HEAD..HEAD` (What commits are being included)

## Step 6: Diff Analysis and PR Description Generation

Get the full diff and analyze the changes using the enhanced workflow:

1. **Get complete diff**: `git diff FETCH_HEAD...HEAD` (Full diff for analysis)
2. **Analyze the diff content** to understand what has changed functionally
3. **Generate a high-level summary** of the changes
4. **Categorize changes by functionality**, not by individual files

**PR Description Format:**

```
## Summary
[Overall high-level summary of what this PR accomplishes]

## Changes
- **[Category Name]**: [High-level description of related functionality changes]
- **[Another Category]**: [Description of different functional area changes]
- **[Additional Category]**: [Description of other grouped changes if applicable]

## Impact
[Brief note on what areas of the codebase are affected]
```

**Analysis Guidelines:**

- Focus on functional changes, not just code syntax or individual files
- Dynamically determine appropriate categories based on the nature of changes (e.g., Authentication, Database, Configuration, UI/UX, Performance, Bug Fixes, etc.)
- Group related functionality changes together, even if they span multiple files
- Explain the high-level purpose and business impact of changes
- Keep explanations concise but informative about what functionality is being added, modified, or fixed
- Examples of good categorized descriptions:
  - **Authentication Enhancement**: "Implemented OAuth2 support replacing basic authentication system"
  - **Database Reliability**: "Added connection retry logic and improved error handling for database operations"
  - **Performance Optimization**: "Increased timeout values and implemented caching to improve response times"
  - **Configuration Management**: "Updated deployment settings and environment variable handling"
  - **Bug Fixes**: "Resolved user session timeout issues and fixed validation edge cases"

## Step 7: Smart Title Generation

Generate the PR title using branch naming logic:

1. Generate a title from all the changes
2. Get the current branch name
3. Apply title logic:
   - If branch matches pattern `^[A-Za-z]{2}-[0-9]+$` (e.g., CH-123, AB-456):
     **Title format:** `{BRANCH_NAME}: {title}`
   - Otherwise: **Title format:** `{title}`

## Step 8: Push Branch

Push the current branch to origin:

- Run: `git push -u origin {current_branch}`
- Handle any push errors appropriately

## Step 9: Create Pull Request

Use the GitHub MCP tool `github_create_pull_request` with these parameters:

- `owner`: Repository owner (from step 2)
- `repo`: Repository name (from step 2)
- `title`: Generated title (from step 7)
- `head`: Current branch name
- `base`: Base branch (from step 3)
- `body`: Generated PR description (from step 6)

## Step 10: Success Response

After successful PR creation, display:

- PR title
- PR URL
- Branch information (current -> base)
- Brief summary of changes included

## Error Handling

Provide clear, actionable error messages for:

- Not in a Git repository
- No GitHub remote configured
- Invalid GitHub remote URL
- Already on main/master branch
- **Merge conflicts with base branch** (stop execution, require manual resolution)
- No changes detected after merge
- Git push failures
- GitHub API/MCP tool failures

## Execution Notes

- **Always fetch specific base branch** to ensure latest remote state: `git fetch origin {base_branch}`
- **Use FETCH_HEAD for precise comparisons** - refers to exactly what was just fetched
- **Triple-dot notation**: `FETCH_HEAD...HEAD` shows diff from merge base
- **Merge FETCH_HEAD** and handle conflicts properly (git worktree compatible)
- Use bash tools for all Git operations
- Use GitHub MCP tools only for PR creation
- Provide informative progress updates during execution
- **Stop execution if merge conflicts occur** - require manual resolution
- Exit gracefully if no changes are detected after merge
- Handle both SSH and HTTPS GitHub remote formats
- Support repositories with either "main" or "master" as default branch
- Analyze the actual code changes in the diff to provide meaningful descriptions
- Focus on high-level functional changes rather than line-by-line details
- **Enhanced diff workflow**:
  - File names only: `git diff FETCH_HEAD...HEAD --name-only`
  - Full diff: `git diff FETCH_HEAD...HEAD`
