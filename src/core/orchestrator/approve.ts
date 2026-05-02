import type { CardStatus } from "../schemas/card-status";

export type ApproveDecision =
  | { action: "advance"; next: CardStatus }
  | { action: "recover" }
  | { action: "notice"; message: string };

const COMPLETED_NOTICE =
  "이미 완료된 카드뉴스입니다. 미세 수정은 /tweak, Figma 전송은 /sync-figma 사용.";

export function describeApprove(status: CardStatus): ApproveDecision {
  switch (status) {
    case "draft.outline-ready":
      return { action: "advance", next: "draft.writing" };
    case "draft.copy-ready":
      return { action: "advance", next: "draft.imaging" };
    case "draft.images-ready":
      return { action: "advance", next: "draft.rendering" };
    case "draft.failed":
      return { action: "recover" };
    case "exported":
    case "synced-to-figma":
      return { action: "notice", message: COMPLETED_NOTICE };
    default:
      return {
        action: "notice",
        message: `현재 단계: ${status} — 자동 진행 중. 잠시만 기다려주세요.`,
      };
  }
}
