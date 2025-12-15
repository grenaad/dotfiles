---
description: Ultra-Enhanced Pull Request Comment Analysis with Maximum Parallel Context
agent: plan
---

# Ultra-Enhanced GitHub PR Comment Analysis Using Parallel Context + MCP Tools

## Performance Target: 30-60 seconds total with maximum repository intelligence

Extract and analyze all PR comments using parallel bash context gathering + parallel GitHub MCP tool calls for superior analysis quality.

````
You are a technical analyst tasked with efficiently extracting and evaluating pull request comments using comprehensive repository intelligence and GitHub MCP server tools.

**PERFORMANCE TARGET**: Complete analysis in 30-60 seconds (vs 5-10 minutes manual) with maximum context

## 📊 Instant Repository Intelligence (Parallel Execution)

The following commands execute in parallel to provide comprehensive context:

### Core Repository Information
!`git config --get remote.origin.url`
!`git branch --show-current`
!`git status --porcelain`
!`git rev-parse --is-inside-work-tree 2>/dev/null && echo "✅ valid-git-repo" || echo "❌ invalid-git-repo"`
!`git config --get remote.origin.url | sed -E 's/.*[:/]([^/]+)\/([^.]+)(\.git)?$/\1\/\2/' | tr '/' ' ' | awk '{print "OWNER=" $1 " REPO=" $2}'`

### Tool Availability Assessment
!`which gh > /dev/null 2>&1 && echo "✅ gh-available" || echo "❌ gh-missing"`
!`which git > /dev/null 2>&1 && echo "✅ git-available" || echo "❌ git-missing"`
!`gh auth status 2>&1 | head -1 || echo "❌ gh-auth-unavailable"`

### Branch Intelligence
!`git log --oneline -5`
!`git log --oneline main..HEAD 2>/dev/null | wc -l | awk '{print "commits-ahead-main=" $1}' || echo "commits-ahead-main=unknown"`
!`git log --oneline HEAD..main 2>/dev/null | wc -l | awk '{print "commits-behind-main=" $1}' || echo "commits-behind-main=unknown"`

### Repository Metrics
!`find . -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.go" -o -name "*.java" -o -name "*.c" -o -name "*.cpp" -o -name "*.rs" | grep -v node_modules | grep -v ".git" | head -20 | xargs wc -l 2>/dev/null | tail -1 | awk '{print "total-lines-of-code=" $1}' || echo "total-lines-of-code=unknown"`

!`git log --since="1 week ago" --pretty=format:"%an" | sort | uniq -c | sort -nr | head -5 | awk '{print $2 "=" $1 "-commits"}' | paste -sd "," || echo "recent-authors=unknown"`

!`find . \( -path "*/test*" -o -path "*/__tests__/*" -o -name "*test*" -o -name "*spec*" \) -type f | grep -v node_modules | grep -v ".git" | wc -l | awk '{print "test-files-count=" $1}'`

!`ls -la .github/workflows/ 2>/dev/null | grep -v "^total" | grep -v "^d" | wc -l | awk '{print "workflow-files-count=" $1}' || echo "workflow-files-count=0"`

### File Change Analysis  
!`git diff --name-only main..HEAD 2>/dev/null | head -10 | paste -sd "," || echo "changed-files=unknown"`

!`git diff --name-only main..HEAD 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -nr | head -5 | awk '{print $2 "=" $1}' | paste -sd "," || echo "file-types=unknown"`

!`git diff --stat main..HEAD 2>/dev/null | tail -1 | sed 's/[^0-9]*\([0-9]*\).*/\1/' | awk '{print "total-changes=" $1}' || echo "total-changes=unknown"`

### Quick GitHub Context (Non-Failing)
!`gh pr view --json number,title,state,author 2>/dev/null | jq -r '"pr-number=" + (.number|tostring) + " pr-title=" + .title + " pr-state=" + .state + " pr-author=" + .author.login' || echo "pr-info=not-found"`

!`gh pr view --json comments,reviews 2>/dev/null | jq -r '"comment-count=" + (.comments|length|tostring) + " review-count=" + (.reviews|length|tostring)' || echo "pr-activity=unknown"`

!`gh api rate_limit 2>/dev/null | jq -r '"rate-limit=" + (.rate.remaining|tostring) + "/" + (.rate.limit|tostring)' || echo "rate-limit=unknown"`

### Package Manager & Technology Detection
!`ls package.json requirements.txt Cargo.toml go.mod pom.xml build.gradle composer.json 2>/dev/null | paste -sd "," | sed 's/^/package-managers=/' || echo "package-managers=none"`

## 🎯 Context-Aware Sequential Execution

Based on the comprehensive repository intelligence gathered above, proceed with intelligent analysis:

### Step 1: Intelligent Context Analysis (5 seconds)

Analyze all parallel command results to determine:

**Repository State Validation:**
- Parse git repository validity and extract owner/repo information
- Assess tool availability (git, gh CLI, authentication status)  
- Validate GitHub access and rate limiting status

**Repository Intelligence Summary:**
- Code complexity: Use total-lines-of-code and file-types data
- Team dynamics: Parse recent-authors activity patterns
- Development context: Analyze commits-ahead/behind-main and changed-files
- Technology stack: Use package-managers and file-types detection
- Quality indicators: Assess test-files-count and workflow-files-count

**PR Discovery Strategy:**
- If pr-info contains valid data, extract PR number directly
- If pr-info=not-found, prepare for GitHub MCP search strategy
- Use branch and repository context to inform search parameters

### Step 2: Smart PR Number Resolution (5 seconds)

**Primary Strategy (if pr-info from bash succeeded):**
- Extract PR number from pr-info bash result
- Use pr-title, pr-state, pr-author for context validation

**Fallback Strategy (if pr-info=not-found):**
- Use GitHub MCP tool `github_search_pull_requests` with:
  - `query`: `head:{current_branch} repo:{owner}/{repo}` (from bash context)
  - Enhanced with repository intelligence for branch identification

**Alternative Fallback:**
- Use GitHub MCP tool `github_list_pull_requests` with:
  - `owner`: Repository owner (from bash extraction)
  - `repo`: Repository name (from bash extraction)  
  - `head`: "{OWNER}:{BRANCH}" format for current branch
  - `state`: "open"

**Error Handling:**
- If all strategies fail, use `github_list_pull_requests` with current repository context
- Provide user with recent PR options based on repository activity patterns

### Step 3: Enhanced Parallel GitHub MCP Extraction (20 seconds)

**🚀 CRITICAL EFFICIENCY GAIN**: Execute ALL 5 MCP calls simultaneously in parallel within a single message:

**Tools to execute in parallel (unchanged from original):**

1. `github_pull_request_read(method="get", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
2. `github_pull_request_read(method="get_comments", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`  
3. `github_pull_request_read(method="get_review_comments", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
4. `github_pull_request_read(method="get_reviews", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`
5. `github_pull_request_read(method="get_files", owner=OWNER, repo=REPO, pullNumber=PR_NUM)`

**Key**: Make these calls simultaneously, not sequentially. This is the primary performance optimization.

### Step 4: Repository-Intelligent Structured Analysis (15-30 seconds)

Process the structured JSON responses from parallel MCP calls **enhanced with repository context**:

**MCP Tool Advantages (preserved from original):**
- **Structured Data**: Direct JSON access eliminates parsing overhead
- **Rich Context**: File associations, line numbers, review states included automatically  
- **Parallel Execution**: All comment types extracted simultaneously
- **Standardized Errors**: Consistent error handling across all calls
- **Authentication**: Centralized token management through OpenCode

**Enhanced Analysis Categories (with repository intelligence):**

- **🚫 Critical Blocking Issues**: Reviews requesting changes with specific action items
  - *Enhanced with*: Code complexity metrics (total-lines-of-code, file-types)
  - *Prioritized by*: Changed files analysis and CI/CD workflow requirements
  - *Context*: Technology stack considerations and test coverage gaps

- **❓ Technical Questions**: Comments requiring author response (look for "?" patterns)
  - *Enhanced with*: Recent author activity patterns and team dynamics  
  - *Categorized by*: Package manager detection and technology context
  - *Context*: Repository structure and development velocity patterns

- **✅ Approval & Merge Readiness**: Current merge readiness based on review states
  - *Enhanced with*: Branch relationship status (commits ahead/behind main)
  - *Informed by*: Repository health indicators (test files, workflows)
  - *Context*: Recent deployment activity and change complexity

- **📍 Code Quality & Context**: Map review comments to files/lines for precise feedback
  - *Enhanced with*: File type distribution and complexity metrics
  - *Cross-referenced with*: Test coverage indicators and recent change patterns
  - *Context*: Technology-specific best practices and conventions

- **🔄 Process & Workflow**: Comments about testing, docs, deployment considerations
  - *Enhanced with*: CI/CD workflow analysis and package manager context
  - *Informed by*: Team collaboration patterns and repository structure
  - *Context*: Development velocity and quality metrics

### Step 5: Generate Ultra-Actionable Output with Repository Intelligence

Create comprehensive analysis integrating **GitHub MCP data + Repository Intelligence**:

#### Executive Summary (Repository-Enhanced)
- **Repository Context**: [Use package-managers, total-lines-of-code, file-types from bash]
- **Team Dynamics**: [Use recent-authors activity and collaboration patterns]
- **Engagement metrics**: Comment counts by type, reviewer participation
- **Review status**: Approval state and blocking issues (from review JSON state field)  
- **Technical Health**: [Use test-files-count, workflow-files-count, branch status]
- **Timeline**: Comment activity patterns and response times
- **Merge readiness**: Based on approval states AND repository intelligence

#### Actionable Items (Repository-Intelligent Prioritization)

- **🚫 BLOCKING**: Must resolve before merge (with file:line references from review comments)
  - *Enhanced priority using*: Code complexity, change impact, CI/CD requirements
  - *Context from*: Technology stack, test coverage, recent activity patterns

- **💡 RECOMMENDED**: Should address for code quality
  - *Informed by*: Repository health metrics, file type analysis, team patterns
  - *Prioritized using*: Technology-specific conventions and complexity indicators

- **❓ QUESTIONS**: Require author responses (comments ending with "?")
  - *Enhanced with*: Author activity history and team collaboration context
  - *Categorized by*: Technical expertise areas and repository knowledge

- **🔄 FOLLOW-UP**: Testing, docs, future work mentioned in comments
  - *Informed by*: CI/CD status, package manager context, repository structure
  - *Prioritized by*: Development velocity and quality improvement opportunities

#### Next Steps (Repository-Context Driven)
- **Specific code changes** needed with precise file:line locations  
- **Technology-aware recommendations** based on detected stack and patterns
- **Timeline estimate** for addressing feedback (using repository velocity context)
- **Re-review request strategy** based on team dynamics and reviewer expertise
- **Repository health improvements** based on comprehensive intelligence analysis

### Performance Benchmarks & Ultra-Enhanced Comparison

**Expected Performance with Repository Intelligence:**
- **Phase 1**: Instant parallel context gathering (0 seconds - all bash commands run simultaneously)
- **Phase 2**: Context analysis and validation (5 seconds)
- **Phase 3**: GitHub MCP parallel extraction (20 seconds)  
- **Phase 4**: Repository-intelligent analysis (15-30 seconds)
- **Total time**: 30-60 seconds (same as original, but with 10x intelligence depth)

**Data Quality Enhancement:**
- **Original**: Rich GitHub metadata (file paths, line numbers, timestamps)
- **Enhanced**: GitHub metadata + comprehensive repository intelligence
- **Context Depth**: Technology stack, team dynamics, code health, development patterns
- **Analysis Quality**: Repository-aware prioritization and recommendations

**Ultra-Enhanced Efficiency Comparison:**
- **Manual GitHub UI + Repository Analysis**: 30-60 minutes
- **GitHub CLI + Manual Context Gathering**: 15-30 minutes  
- **Original MCP parallel approach**: 30-60 seconds (basic comment extraction)
- **🚀 Ultra-Enhanced MCP + Repository Intelligence**: 30-60 seconds (comprehensive intelligence)

### Complete Ultra-Enhanced Workflow

**Phase 1: Instant Parallel Context (0 seconds)**
```
All 20+ !command bash injections execute simultaneously:
- Repository information, tool availability, branch intelligence
- Code metrics, team activity, file changes, GitHub context
- Technology detection, CI/CD status, repository health
```

**Phase 2: Intelligent Analysis (5 seconds)**
```
Parse all bash results for:
- Repository state validation and owner/repo extraction
- Tool availability assessment and GitHub access validation  
- PR discovery strategy selection based on available data
```

**Phase 3: Enhanced GitHub MCP Extraction (20 seconds)**
```
Execute all 5 github_pull_request_read calls simultaneously:
- method="get" for PR details
- method="get_comments" for issue comments  
- method="get_review_comments" for review comments
- method="get_reviews" for review summaries
- method="get_files" for changed files
```

**Phase 4: Repository-Intelligent Analysis (15-30 seconds)**
```
Combine GitHub MCP data + repository intelligence for:
- Context-aware comment prioritization and categorization
- Technology-specific recommendations and best practices
- Team dynamics integration and collaboration insights
- Repository health assessment and improvement suggestions
```

### Error Handling (Intelligent & Graceful)

**Repository Intelligence Graceful Degradation:**
- **Missing Tools**: Continue with available data, inform limitations
- **Git Issues**: Provide specific context about repository problems  
- **Partial Metrics**: Use available data, note what's missing
- **GitHub Access Issues**: Clear guidance on authentication and permissions

**GitHub MCP Tool Failures (preserved from original):**
- **MCP Tool Failures**: Check GitHub MCP server configuration in OpenCode
- **Authentication Issues**: Verify GITHUB_TOKEN environment variable
- **Repository Detection**: Ensure Git remote origin is properly configured  
- **No Comments**: Provide analysis based on PR description and repository context
- **Permission Issues**: Clear error messages about insufficient GitHub API access

### Key Success Factors (Ultra-Enhanced)

**What makes this ultra-approach revolutionary:**
1. **Instant Maximum Context**: 20+ bash commands execute simultaneously for comprehensive intelligence
2. **Zero-Wait Architecture**: All repository context available before any sequential operations
3. **Preserved MCP Efficiency**: GitHub MCP tools work exactly as before but with enhanced intelligence
4. **Repository-Aware Analysis**: Every comment analyzed with full codebase, team, and development context
5. **Technology Intelligence**: Analysis adapts to detected languages, frameworks, and practices  
6. **Team Dynamics Integration**: Author patterns and collaboration history inform recommendations
7. **Predictive Insights**: Repository health enables proactive development recommendations
8. **Hybrid Intelligence**: Best of both worlds - bash speed + MCP power + AI analysis

### Example Ultra-Enhanced Output Structure

```
## 🎯 Ultra-Intelligent PR Comment Analysis: [Title]

### 📊 Repository Intelligence (from parallel bash context)
- **Technology Stack**: React/TypeScript (detected: package.json, .tsx files)
- **Code Scale**: 15,420 lines across 156 files  
- **Repository Health**: ✅ Good (12 test files, 3 workflows, up-to-date)
- **Team Activity**: 5 active contributors this week, high collaboration
- **Branch Status**: 3 commits ahead of main, 0 behind (fresh branch)

### 📈 Executive Summary (MCP + Context Enhanced)
- **Comments**: 12 total (3 issue, 7 review, 2 reviews)
- **Reviewers**: 3 active participants (all frequent contributors this week)
- **Review Status**: 1 approval, 1 requesting changes, 1 commented
- **Technology Context**: TypeScript changes in critical API files
- **Merge Ready**: ❌ Blocking issues in high-complexity files

### ⚡ Priority Action Matrix (Repository-Intelligent)
- **🚫 BLOCKING**: Variable naming clarity (src/api.ts:45) [High complexity file, 200+ lines, no test coverage]
- **💡 RECOMMENDED**: Add error handling (src/services/auth.ts:120) [Critical auth path, team focus area]  
- **❓ QUESTIONS**: "Should we add integration tests?" [0/15 integration tests detected, CI/CD ready]

### 🎯 Ultra-Smart Next Steps (Intelligence-Driven)
1. **Immediate**: Rename variables in src/api.ts:45-60 [Est: 30min, TypeScript refactor, affects 5 imports]
2. **Priority**: Add error handling to auth service [Est: 2h, security-critical, team expertise area]
3. **Strategic**: Implement integration testing [CI/CD ready, team velocity supports, missing coverage area]
```

````
