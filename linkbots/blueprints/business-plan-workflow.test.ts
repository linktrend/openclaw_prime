import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createBusinessPlanDraft,
  evaluateBlueprintLaunch,
  prepareBrainIndex,
  prepareDrivePublication,
  recordBrainIndex,
  recordDrivePublication,
  recordPrincipalApproval,
  requestBusinessPlanReview,
} from "./business-plan-workflow.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowDigest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function workflowSource(): string {
  return readFileSync(path.join(here, "business-plan-workflow.ts"), "utf8");
}

describe("business-plan workflow shell", () => {
  it("carries no-content plan metadata through review, approval, Drive, and Brain receipts", () => {
    const draft = createBusinessPlanDraft({
      artifactId: "artifact:executive-plan",
      version: 1,
      blueprintProfileId: "eric",
      contentDigest: workflowDigest,
      contentLength: 0,
      sourceRefs: ["source:approved-brief"],
    });
    expect(draft.content).toBeNull();
    expect(draft.phase).toBe("draft");

    const review = requestBusinessPlanReview(draft, ["reviewer:principal-staff"]);
    const approval = recordPrincipalApproval(review, {
      receiptRef: "receipt:principal-approval-1",
      approverRef: "principal:founder",
      approvalDigest: workflowDigest,
      approved: true,
    });
    const driveIntent = prepareDrivePublication(approval, "drive-target:business-plan");
    expect(driveIntent.status).toBe("PENDING_EXTERNAL");
    const publication = recordDrivePublication(driveIntent, "drive-receipt:1");
    const brainIntent = prepareBrainIndex(publication, "brain-collection:executive-plans");
    expect(brainIntent.status).toBe("PENDING_EXTERNAL");
    const indexed = recordBrainIndex(brainIntent, "brain-receipt:1");

    expect(indexed).toMatchObject({
      status: "indexed",
      content: null,
      versionLink: "artifact:executive-plan@v1",
      contentDigest: workflowDigest,
      publicationReceiptRef: "drive-receipt:1",
      indexReceiptRef: "brain-receipt:1",
    });
  });

  it("rejects plan bodies and never creates a fake business plan file", () => {
    expect(() =>
      createBusinessPlanDraft({
        artifactId: "artifact:plan",
        version: 1,
        blueprintProfileId: "eric",
        contentDigest: workflowDigest,
        contentLength: 100,
        content: "a fake plan",
      }),
    ).toThrow(/does not accept content/);

    const filenames = readdirSync(here);
    expect(filenames.some((name) => /business-plan.*\.(md|txt|html)$/i.test(name))).toBe(false);
    expect(workflowSource()).not.toMatch(/createDriveFile|publishToDrive|indexBrainDocument/);
  });

  it("blocks activation without a separately approved Platform identity and grants", () => {
    expect(evaluateBlueprintLaunch({ profileId: "eric", activation: "inactive" })).toMatchObject({
      status: "blocked",
      actions: [],
      reasons: expect.arrayContaining(["separate launch record is required"]),
    });
    expect(
      evaluateBlueprintLaunch(
        { profileId: "eric", activation: "inactive" },
        {
          blueprintProfileId: "eric",
          platformIdentityRef: "platform-identity:eric",
          grantsDigest: workflowDigest,
          launchApprovalRef: "approval:launch-eric",
          approved: true,
        },
      ),
    ).toMatchObject({
      status: "launch-authority-verified",
      activation: "inactive",
      actions: [],
    });
    expect(
      evaluateBlueprintLaunch(
        { profileId: "eric", activation: "active" },
        {
          blueprintProfileId: "eric",
          platformIdentityRef: "platform-identity:eric",
          grantsDigest: workflowDigest,
          launchApprovalRef: "approval:launch-eric",
          approved: true,
        },
      ),
    ).toMatchObject({
      status: "blocked",
      actions: [],
    });
  });
});
