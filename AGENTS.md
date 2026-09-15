<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# System Architecture & Agent Memory Protocol

> **MANDATORY WORKFLOW FOR EVERY INTERACTION:**
> 1. **START**: **ALWAYS** read and analyze `SYSTEM_MEMORY.md` first to instantly grasp how everything is set up (tech stack, Firebase/Firestore integration, Gemini AI parsing, directory layout, UI state flows) and begin working immediately without redundant analysis.
> 2. **EXECUTE**: Implement code changes adhering strictly to the architecture and patterns documented in `SYSTEM_MEMORY.md`.
> 3. **FINISH**: **ALWAYS** update `SYSTEM_MEMORY.md` after completing any changes or new features to keep the documentation 100% current and authoritative.

