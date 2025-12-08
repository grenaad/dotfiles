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

Analyze comments for:

**Technical Aspects:**

- Code quality concerns
- Security issues
- Performance considerations
- Architecture feedback
- Bug reports or fixes

**Process Aspects:**

- Approval status
- Request for changes
- Testing requirements
- Documentation needs

**Communication Aspects:**

- Tone and professionalism
- Clarity of feedback
- Constructiveness of criticism
- Collaboration quality

### Step 6: Synthesize Analysis

Provide:

1. **Summary**: Overall comment themes and sentiment
2. **Key Issues**: Critical points raised by reviewers
3. **Action Items**: What the author needs to address
4. **Recommendations**: Suggestions for moving forward

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

- **Comment Overview**: Number and types of comments
- **Key Themes**: Main discussion points
- **Critical Issues**: Problems that need resolution
- **Sentiment Analysis**: Overall tone and collaboration quality
- **Next Steps**: Recommended actions for PR author

```

```
