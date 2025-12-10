---
description: Efficient Pull Request Comment Analysis  
agent: plan
---

# Efficient GitHub PR Comment Analysis Using MCP Tools

## Quick Start (Target: 30-60 seconds total)

Extract and analyze all PR comments using parallel GitHub MCP tool calls for maximum efficiency.

````
You are a technical analyst tasked with efficiently extracting and evaluating pull request comments using GitHub MCP server tools. 

**PERFORMANCE TARGET**: Complete analysis in 30-60 seconds (vs 5-10 minutes manual)

### Step 1: Auto-Detection (10 seconds)

Use git commands to detect repository and current context:

```bash
# Get owner/repo from git remote
REPO_URL=$(git config --get remote.origin.url)
OWNER=$(echo $REPO_URL | sed -E 's/.*[:/]([^/]+)\/([^.]+)(\.git)?$/\1/')  
REPO=$(echo $REPO_URL | sed -E 's/.*[:/]([^/]+)\/([^.]+)(\.git)?$/\2/')

# Get current branch for PR detection
BRANCH=$(git branch --show-current)
```

### Step 2: Find PR Number (Single API call)

Use MCP tool to find PR for current branch or accept user-provided number:

**Tool**: `github_list_pull_requests`
**Parameters**:
- `owner`: Repository owner (from detection)
- `repo`: Repository name (from detection)  
- `head`: "{OWNER}:{BRANCH}" format for current branch
- `state`: "open"

### Step 3: Parallel Comment Extraction (Single operation, ~20 seconds)

**🚀 CRITICAL EFFICIENCY GAIN**: Execute ALL 5 MCP calls simultaneously in parallel within a single message:

**Tools to execute in parallel:**

1. `github_pull_request_read(method="get", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
2. `github_pull_request_read(method="get_comments", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`  
3. `github_pull_request_read(method="get_review_comments", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
4. `github_pull_request_read(method="get_reviews", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
5. `github_pull_request_read(method="get_files", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`

**Key**: Make these calls simultaneously, not sequentially. This is the primary performance optimization.

### Step 4: Structured Analysis (10-30 seconds)

Process the structured JSON responses from parallel MCP calls to categorize:

**MCP Tool Advantages Over Manual Methods:**
- **Structured Data**: Direct JSON access eliminates parsing overhead
- **Rich Context**: File associations, line numbers, review states included automatically  
- **Parallel Execution**: All comment types extracted simultaneously
- **Standardized Errors**: Consistent error handling across all calls
- **Authentication**: Centralized token management through OpenCode

**Analysis Categories:**
- **🚫 Blocking issues**: Reviews requesting changes with specific action items
- **❓ Questions**: Comments requiring author response (look for "?" patterns)
- **✅ Approval status**: Current merge readiness based on review states  
- **📍 Code context**: Map review comments to files/lines for precise feedback

### Step 5: Generate Actionable Output

Create structured analysis in the following format:

#### Executive Summary
- **Engagement metrics**: Comment counts by type, reviewer participation
- **Review status**: Approval state and blocking issues (from review JSON state field)
- **Timeline**: Comment activity patterns and response times
- **Merge readiness**: Based on approval states and outstanding blocking items

#### Actionable Items (Prioritized)
- **🚫 BLOCKING**: Must resolve before merge (with file:line references from review comments)
- **💡 RECOMMENDED**: Should address for code quality  
- **❓ QUESTIONS**: Require author responses (comments ending with "?")
- **🔄 FOLLOW-UP**: Testing, docs, future work mentioned in comments

#### Next Steps
- **Specific code changes** needed with precise file:line locations
- **Timeline estimate** for addressing feedback
- **Re-review request strategy** based on reviewer engagement patterns

### Performance Benchmarks & Comparison

**Expected Performance:**
- **Total time**: 30-60 seconds (vs 5-10 minutes manual GitHub UI)
- **API calls**: 6 total (1 for PR detection + 5 parallel for comments)  
- **Data quality**: Rich metadata with file paths, line numbers, timestamps
- **Error handling**: Built-in MCP retry logic and structured responses

**Efficiency Comparison:**
- **Manual GitHub UI**: 5-10 minutes clicking through tabs
- **GitHub CLI sequential**: 3-5 minutes with multiple commands  
- **MCP parallel approach**: 30-60 seconds total

### Complete Efficient Workflow

```bash
# 1. Auto-detection (10 seconds)
REPO_URL=$(git config --get remote.origin.url)
OWNER=$(echo $REPO_URL | sed -E 's/.*[:/]([^/]+)\/([^.]+)(\.git)?$/\1/')
REPO=$(echo $REPO_URL | sed -E 's/.*[:/]([^/]+)\/([^.]+)(\.git)?$/\2/')
BRANCH=$(git branch --show-current)

# 2. Find PR (single call)
github_list_pull_requests(owner=OWNER, repo=REPO, head="OWNER:BRANCH", state="open")

# 3. Extract everything (PARALLEL - single message with 5 calls)
# Execute all 5 github_pull_request_read calls simultaneously:
# - method="get" for PR details
# - method="get_comments" for issue comments  
# - method="get_review_comments" for review comments
# - method="get_reviews" for review summaries
# - method="get_files" for changed files

# 4. Structured analysis happens automatically from JSON responses
```

### Error Handling

- **MCP Tool Failures**: Check GitHub MCP server configuration in OpenCode
- **Authentication Issues**: Verify GITHUB_TOKEN environment variable
- **Repository Detection**: Ensure Git remote origin is properly configured
- **No Comments**: Provide analysis based on PR description and status only
- **Permission Issues**: Clear error messages about insufficient GitHub API access

### Key Success Factors

**What makes this approach efficient:**
1. **Parallel API calls**: All comment types extracted simultaneously in one message
2. **Structured JSON data**: No manual parsing of HTML/markdown needed
3. **Rich metadata**: File paths, line numbers, timestamps included automatically
4. **Single workflow**: One script handles detection → extraction → analysis
5. **Built-in error handling**: Standardized error responses and retry logic

### Example Output Structure

```
## PR Comment Analysis: [Title]

### Executive Summary
- **Comments**: 12 total (3 issue, 7 review, 2 reviews)
- **Reviewers**: 3 active participants  
- **Status**: 1 approval, 1 requesting changes, 1 commented
- **Merge Ready**: ❌ Blocking issues present

### Action Items (Prioritized)
- **🚫 BLOCKING**: Variable naming clarity (src/db.py:45)
- **💡 RECOMMENDED**: Add error handling (src/api.py:120)  
- **❓ QUESTIONS**: "Should we add integration tests?" (@reviewer)

### Next Steps
1. Rename variables in src/db.py:45-60
2. Respond to testing question
3. Re-request review from andreiprodaniuc
```

````
