# Lisa operations templates

This directory is reserved for deployment-facing, source-controlled template
metadata. A Markdown template is executable only when referenced by a typed
declaration in `../jobs/lisa-job-desired-state.ts`; prose in a workspace or
profile file never creates a cron item. The family catalogue remains inventory
only and must not invent extra OpenClaw cron jobs for Librarian, backup, or
Memory Dreaming.

The canonical message bodies remain next to their owning job family under
`../jobs/**/templates/`. This boundary keeps template discovery deterministic
while allowing the desired-state declarations to carry the exact template
reference, delivery contract, and receipt requirements.
