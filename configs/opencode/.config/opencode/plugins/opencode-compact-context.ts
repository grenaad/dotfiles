// import type { Plugin } from "@opencode-ai/plugin";
// import { tool } from "@opencode-ai/plugin";
//
// const compactNotes = new Map<string, string[]>();
//
// export const CompactContextPlugin: Plugin = async (ctx) => {
//   return {
//     tool: {
//       remember_for_compact: tool({
//         description:
//           "Save a note that will be preserved during the next compaction",
//         args: { note: tool.schema.string() },
//         async execute(args, ctx) {
//           const notes = compactNotes.get(ctx.sessionID) ?? [];
//           notes.push(args.note);
//           compactNotes.set(ctx.sessionID, notes);
//           return `Noted: "${args.note}" will be preserved on next compaction.`;
//         },
//       }),
//     },
//     "experimental.session.compacting": async (input, output) => {
//       const notes = compactNotes.get(input.sessionID);
//       if (notes?.length) {
//         output.context.push(
//           `## Must preserve\n${notes.map((n) => `- ${n}`).join("\n")}`,
//         );
//       }
//     },
//   };
// };
