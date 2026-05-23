/**
 * Run v0.26 violation-detector against saved validation chains.
 * Lives inside arc-agent/src/__smoke__/ so the import resolves cleanly.
 *
 * Reports which plans trigger which detectors. False positives (the
 * detector firing on a plan that already has the corresponding section)
 * are the ship-blocker for v0.26.
 *
 * Run:
 *   cd configs/opencode/.config/opencode/plugins/arc-agent
 *   bunx tsx src/__smoke__/v0.26-detector-on-chains.ts
 */
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { detectViolations } from "../violation-detector"
import type { TaskType } from "../types"

const CHAIN_SETS = [
  { dir: "/tmp/v0.25-validation/chains-v0.25.7", label: "v0.25.7 matrix chains" },
  { dir: "/tmp/v0.25-validation/chains-v0.25.8", label: "v0.25.8 matrix chains" },
  { dir: "/tmp/v0.25-validation/chains-v0.25.9", label: "v0.25.9 matrix chains" },
  { dir: "/tmp/v0.25.9-smoke/chains", label: "v0.25.9 smoke chains" },
] as const

function scanDir(dir: string, label: string): void {
  if (!existsSync(dir)) {
    console.log(`${label}: directory missing (${dir})`)
    return
  }
  console.log(`\n========= ${label} (${dir}) =========`)
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()

  let totalPlans = 0
  let plansWithViolations = 0
  const byKind: Record<string, number> = {}
  const byPlan: Array<{ stem: string; cell: string; kinds: string[] }> = []

  for (const f of files) {
    const stem = f.replace(/\.txt$/, "")
    // Matrix shape: R1-flash-T1 ; smoke shape: hermes-signal-flash
    let cell: string
    const matrixMatch = /^(R\d|S\d)-(flash|opus)-T(\d)$/.exec(stem)
    if (matrixMatch) {
      cell = matrixMatch[2]!
    } else {
      const smokeMatch = /-(flash|opus)$/.exec(stem)
      cell = smokeMatch?.[1] ?? "unknown"
    }
    const text = readFileSync(join(dir, f), "utf-8")
    totalPlans++

    // Heuristic: investigate fixtures get investigate task type; others = fix.
    const taskType: TaskType =
      stem.includes("R4") || stem.includes("S2") || stem.includes("openwick") || stem.includes("tradingview")
        ? "investigate"
        : "fix"
    const v = detectViolations(text, taskType)
    if (v.length > 0) {
      plansWithViolations++
      for (const violation of v) {
        byKind[violation.kind] = (byKind[violation.kind] ?? 0) + 1
      }
      byPlan.push({ stem, cell, kinds: v.map((x) => x.kind) })
    }
  }

  console.log(`Total plans scanned: ${totalPlans}`)
  console.log(
    `Plans with violations: ${plansWithViolations}/${totalPlans} (${Math.round(
      (100 * plansWithViolations) / Math.max(totalPlans, 1),
    )}%)`,
  )
  console.log("\nViolations by kind:")
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`)
  }
  console.log("\nPer-plan detail:")
  for (const p of byPlan) {
    console.log(`  ${p.stem} (${p.cell}): ${p.kinds.join(", ")}`)
  }
}

for (const set of CHAIN_SETS) scanDir(set.dir, set.label)
