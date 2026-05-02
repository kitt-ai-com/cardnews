import { describe, expect, it } from "vitest";
import {
  CardStatusSchema,
  isAwaitingApproval,
  isInProgress,
  isTerminal,
} from "@core/schemas/card-status";

describe("CardStatus", () => {
  it("accepts all 10 known statuses", () => {
    for (const s of [
      "draft.analyzing",
      "draft.outline-ready",
      "draft.writing",
      "draft.copy-ready",
      "draft.imaging",
      "draft.images-ready",
      "draft.rendering",
      "draft.failed",
      "exported",
      "synced-to-figma",
    ]) {
      expect(() => CardStatusSchema.parse(s)).not.toThrow();
    }
  });

  it("rejects unknown status", () => {
    expect(() => CardStatusSchema.parse("paused-for-approval")).toThrow();
    expect(() => CardStatusSchema.parse("draft.unknown")).toThrow();
  });

  it("classifies isAwaitingApproval correctly", () => {
    expect(isAwaitingApproval("draft.outline-ready")).toBe(true);
    expect(isAwaitingApproval("draft.copy-ready")).toBe(true);
    expect(isAwaitingApproval("draft.images-ready")).toBe(true);
    expect(isAwaitingApproval("draft.analyzing")).toBe(false);
    expect(isAwaitingApproval("draft.writing")).toBe(false);
    expect(isAwaitingApproval("exported")).toBe(false);
    expect(isAwaitingApproval("draft.failed")).toBe(false);
  });

  it("classifies isInProgress correctly", () => {
    expect(isInProgress("draft.analyzing")).toBe(true);
    expect(isInProgress("draft.writing")).toBe(true);
    expect(isInProgress("draft.imaging")).toBe(true);
    expect(isInProgress("draft.rendering")).toBe(true);
    expect(isInProgress("draft.outline-ready")).toBe(false);
    expect(isInProgress("draft.failed")).toBe(false);
    expect(isInProgress("exported")).toBe(false);
  });

  it("classifies isTerminal correctly", () => {
    expect(isTerminal("draft.failed")).toBe(true);
    expect(isTerminal("exported")).toBe(true);
    expect(isTerminal("synced-to-figma")).toBe(true);
    expect(isTerminal("draft.copy-ready")).toBe(false);
    expect(isTerminal("draft.analyzing")).toBe(false);
  });

  it("accepts the 4 new v2 statuses", () => {
    for (const s of [
      "draft.claim-extracting",
      "draft.claims-ready",
      "draft.review-pending",
      "draft.review-blocked",
    ]) {
      expect(() => CardStatusSchema.parse(s)).not.toThrow();
    }
  });

  it("isInProgress includes claim-extracting", () => {
    expect(isInProgress("draft.claim-extracting")).toBe(true);
  });

  it("isAwaitingApproval covers claims-ready, review-pending, review-blocked", () => {
    expect(isAwaitingApproval("draft.claims-ready")).toBe(true);
    expect(isAwaitingApproval("draft.review-pending")).toBe(true);
    expect(isAwaitingApproval("draft.review-blocked")).toBe(true);
    // Sanity: claim-extracting is in-progress, NOT awaiting
    expect(isAwaitingApproval("draft.claim-extracting")).toBe(false);
  });

  it("isTerminal stays false for all 4 new v2 statuses", () => {
    expect(isTerminal("draft.claim-extracting")).toBe(false);
    expect(isTerminal("draft.claims-ready")).toBe(false);
    expect(isTerminal("draft.review-pending")).toBe(false);
    expect(isTerminal("draft.review-blocked")).toBe(false);
  });
});
