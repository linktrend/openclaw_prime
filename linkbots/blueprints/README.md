# Inactive executive blueprints

The four JSON files in this directory are schema-valid, inactive profile
manifests for Eric, David, Sara, and Jane. They are reviewable role/capability
references only. They create no Platform actor, credential, grant, account,
Workspace binding, session, recipient, schedule, job, or private state.

The role summaries are projections, never authority. Profile provisioning must
remain blocked until a separately approved launch record binds an exact
Platform identity and grants. The business-plan workflow is a no-content shell:
it carries artifact/version/digest and approval/publication/index receipts, but
never creates, stores, publishes, or indexes a business plan.

Focused proof: `node scripts/run-vitest.mjs src/agents/profile-manifest.test.ts`
and `node scripts/run-vitest.mjs --config linkbots/blueprints/vitest.config.ts`.
The root Vitest matrix does not include `linkbots/**`, so the directory filter
alone finds no files.
