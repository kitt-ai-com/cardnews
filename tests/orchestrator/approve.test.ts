import { describe, expect, it } from "vitest";
import { describeApprove } from "@core/orchestrator/approve";

describe("describeApprove", () => {
  it("outline-ready advances to writing", () => {
    expect(describeApprove("draft.outline-ready")).toEqual({
      action: "advance",
      next: "draft.writing",
    });
  });

  it("copy-ready advances to imaging", () => {
    expect(describeApprove("draft.copy-ready")).toEqual({
      action: "advance",
      next: "draft.imaging",
    });
  });

  it("images-ready advances to rendering", () => {
    expect(describeApprove("draft.images-ready")).toEqual({
      action: "advance",
      next: "draft.rendering",
    });
  });

  it("failed produces a recover action", () => {
    expect(describeApprove("draft.failed")).toEqual({ action: "recover" });
  });

  it("claims-ready advances to writing (v2-editorial)", () => {
    expect(describeApprove("draft.claims-ready")).toEqual({
      action: "advance",
      next: "draft.writing",
    });
  });

  it("review-pending advances to imaging (v2-editorial)", () => {
    expect(describeApprove("draft.review-pending")).toEqual({
      action: "advance",
      next: "draft.imaging",
    });
  });

  it("review-blocked produces a recover action (v2-editorial)", () => {
    expect(describeApprove("draft.review-blocked")).toEqual({
      action: "recover",
    });
  });

  it("exported produces the completion notice", () => {
    expect(describeApprove("exported")).toEqual({
      action: "notice",
      message:
        "이미 완료된 카드뉴스입니다. 미세 수정은 /tweak, Figma 전송은 /sync-figma 사용.",
    });
  });

  it("synced-to-figma produces the completion notice", () => {
    expect(describeApprove("synced-to-figma")).toEqual({
      action: "notice",
      message:
        "이미 완료된 카드뉴스입니다. 미세 수정은 /tweak, Figma 전송은 /sync-figma 사용.",
    });
  });

  it("in-progress states return a wait notice with status interpolated", () => {
    const inProgress = [
      "draft.analyzing",
      "draft.writing",
      "draft.imaging",
      "draft.rendering",
    ] as const;
    for (const status of inProgress) {
      expect(describeApprove(status)).toEqual({
        action: "notice",
        message: `현재 단계: ${status} — 자동 진행 중. 잠시만 기다려주세요.`,
      });
    }
  });
});
