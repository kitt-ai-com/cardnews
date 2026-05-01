import { z } from "zod";

export const CardStatusSchema = z.enum([
  // 진행 중 (자동, 사용자 개입 X)
  "draft.analyzing",
  "draft.writing",
  "draft.imaging",
  "draft.rendering",
  // 승인 대기 (사용자 액션 필요)
  "draft.outline-ready",
  "draft.copy-ready",
  "draft.images-ready",
  // 종료
  "draft.failed",
  "exported",
  "synced-to-figma",
]);
export type CardStatus = z.infer<typeof CardStatusSchema>;

export function isAwaitingApproval(s: CardStatus): boolean {
  return (
    s === "draft.outline-ready" ||
    s === "draft.copy-ready" ||
    s === "draft.images-ready"
  );
}

export function isInProgress(s: CardStatus): boolean {
  return (
    s === "draft.analyzing" ||
    s === "draft.writing" ||
    s === "draft.imaging" ||
    s === "draft.rendering"
  );
}

export function isTerminal(s: CardStatus): boolean {
  return s === "draft.failed" || s === "exported" || s === "synced-to-figma";
}
