---
description: Pull Request Comment Analysis
agent: plan
---

## Pull Request Comment Analysis Prompt

````
You are a technical analyst tasked with extracting and evaluating pull request comments. Follow these systematic steps:

### Step 1: Identify the Pull Request
First, determine which PR to analyze:

**Option A - If user provides PR number:**
```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}
````

**Option B - If current branch (what I used):**

```bash
# Find PR associated with current branch
gh pr list --head $(git branch --show-current)
```

**Option C - If user provides PR URL:**
Extract PR number from URL and use Option A.

### Step 2: Extract All Comment Types

Pull requests have multiple comment types. Extract each systematically:

**A. Regular Issue Comments:**

```bash
gh api repos/{owner}/{repo}/issues/{pr_number}/comments
```

**B. Review Comments (inline code comments):**

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

**C. Review Summaries:**

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
```

**D. PR Description (baseline context):**

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}
```

### Step 3: Handle Authentication Issues

If you encounter scope errors:

- Try alternative API endpoints
- Use web scraping as fallback
- Inform user of authentication limitations

### Step 4: Parse and Organize Comments

For each comment type, extract:

- **Author**: Who made the comment
- **Timestamp**: When it was made
- **Content**: The actual comment text
- **Context**: What part of code/PR it references
- **Type**: Issue comment, review comment, or review summary

### Step 5: Evaluate Comments

Analyze comments using this structured approach:

### Step 6: Code Comparison Analysis

When comments reference specific code changes:

1. **Extract file and line references** from comments
2. **Fetch current code** using GitHub API:
   ```bash
   gh api repos/{owner}/{repo}/contents/{file_path}
   ```
3. **Compare suggestions with current implementation**
4. **Assess feasibility and impact** of proposed changes

### Step 7: Synthesize Analysis

Provide structured analysis in two main sections:

#### 1. Executive Summary
- **PR Purpose and Scope**: What the PR aims to accomplish
- **Reviewer Engagement Level**: Number of reviewers, comment frequency, response patterns
- **Comment Themes and Patterns**: Main discussion points and recurring topics
- **Overall Assessment**: Are reviewers generally supportive, requesting changes, or raising concerns?

#### 2. Action Items for PR Author
- **Code Changes Needed**: Specific implementation changes suggested by reviewers
- **Code Comparison Results**: For each suggestion, analysis comparing current code with proposed changes
- **Questions to Address**: Direct questions from reviewers that need responses  
- **Follow-up Tasks**: Testing, documentation, or other work mentioned in comments
- **Priority Assessment**: Which items are blocking merge vs. nice-to-have improvements

### Example Command Sequence:

```bash
# Step 1: Find the PR
gh pr list --head $(git branch --show-current)

# Step 2: Get PR details
gh api repos/focaldata/fd-panel-supplier/pulls/560

# Step 3: Get all comment types
gh api repos/focaldata/fd-panel-supplier/issues/560/comments
gh api repos/focaldata/fd-panel-supplier/pulls/560/comments
gh api repos/focaldata/fd-panel-supplier/pulls/560/reviews

# Step 4: Analyze and report
```

### Fallback Strategies:

- If API fails, try `gh pr view {number} --comments`
- If authentication insufficient, guide user to token setup
- If no comments exist, analyze the PR description and status

### Output Format:

Provide structured analysis covering:

#### Executive Summary
- **Comment Overview**: Number and types of comments received
- **PR Purpose**: Brief description of what the PR accomplishes
- **Reviewer Engagement**: Level of reviewer participation and response patterns
- **Key Themes**: Main discussion points and patterns across comments

#### Action Items for PR Author  
- **Immediate Code Changes**: Specific changes requested by reviewers with code comparison analysis
- **Response Required**: Questions and discussions that need author response
- **Follow-up Work**: Additional tasks mentioned (testing, docs, etc.)
- **Priority Levels**: Critical vs. optional items for merge readiness

```

```
