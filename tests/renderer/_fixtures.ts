import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PresetSchema, type Preset } from "@core/schemas/preset";
import { SeriesSchema, type Series } from "@core/schemas/series";
import type { Page } from "@core/schemas/page";

export function makePreset(): Preset {
  const json = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../data/presets/variants/c1-dark-lime.json"),
      "utf8"
    )
  );
  return PresetSchema.parse(json);
}

export function makeSeries(): Series {
  return SeriesSchema.parse({
    id: "claude",
    name: "Claude 카드뉴스",
    theme: "ai",
    defaultPreset: "c1-dark-lime",
    audience: "developers",
    tone: "informative-friendly",
    branding: { seriesTag: "CLAUDE CODE" },
    footerHandle: "@uhuru_nomadlife",
  });
}

interface BasePageOpts {
  index?: number;
  layout: Page["layout"];
  role: Page["role"];
  copy: Page["copy"];
}

function basePage(opts: BasePageOpts): Page {
  return {
    index: opts.index ?? 1,
    role: opts.role,
    layout: opts.layout,
    message: "test message",
    mappingNote: "test mapping",
    copy: opts.copy,
    manualEdit: false,
  };
}

export function makeCoverPage(): Page {
  return basePage({
    index: 1,
    layout: "cover",
    role: "cover",
    copy: {
      label: "CLAUDE CODE",
      title: "스킬·훅·루프 모르면<br><accent>Claude Code 손해</accent>",
      subtitle: "자주 쓰는 일은 명령으로,<br>반복은 자동으로.",
    },
  });
}

export function makeCtaPage(): Page {
  return basePage({
    index: 8,
    layout: "cta",
    role: "cta",
    copy: {
      label: "지금 시작",
      title: "오늘은<br><accent>하나만</accent> 적용",
      body: "스킬 하나 만들거나 훅 한 줄만 걸어도 매일 반복하는 일이 줄어든다.",
    },
  });
}

export function makeP1Page(): Page {
  return basePage({
    index: 3,
    layout: "P1",
    role: "body",
    copy: {
      label: "01 SKILLS",
      title: "<accent>스킬</accent>은<br>SKILL.md 한 장이면 끝",
      body: "프로젝트 또는 사용자 디렉터리에 <code>SKILL.md</code> 한 장만 두면 끝.",
    },
  });
}

export function makeP1PageWithList(): Page {
  return basePage({
    index: 3,
    layout: "P1",
    role: "body",
    copy: {
      label: "01 SKILLS",
      title: "<accent>스킬</accent> 사용처",
      list: ["~/.claude/skills/", ".claude/skills/", "frontmatter description"],
    },
  });
}

export function makeP2Page(): Page {
  return basePage({
    index: 2,
    layout: "P2",
    role: "body",
    copy: {
      label: "한 컷 비교",
      title: "셋의 역할은<br>다 다르다",
      list: [
        "/|스킬|반복 작업을 슬래시 명령으로 묶어둔 것.|SKILL.md 한 장이면 끝",
        "⚡|훅|특정 이벤트가 일어나면 자동으로 끼어드는 스크립트.|settings.json에 등록",
        "↻|루프|한 프롬프트를 결과 나올 때까지 반복.|/loop 명령",
      ],
    },
  });
}

export function makeP3Page(): Page {
  return basePage({
    index: 4,
    layout: "P3",
    role: "body",
    copy: {
      label: "이렇게 쓴다",
      title: "자주 쓰는<br>명령·스킬 5가지",
      list: [
        "<code>/simplify</code> — 변경 코드 단순화 리뷰",
        "<code>/loop</code> — 반복 작업 자동 진행",
        "<code>/init</code> — 프로젝트 CLAUDE.md 자동 생성",
        "<b>/review</b> — Pull Request 리뷰",
      ],
    },
  });
}

export function makeP4Page(): Page {
  return basePage({
    index: 5,
    layout: "P4",
    role: "body",
    copy: {
      label: "보관용",
      title: "이건 나중에<br>다시 보자",
      subtitle: "스킬 정리 가이드의 핵심 포인트",
    },
  });
}

export function makeP5Page(): Page {
  return basePage({
    index: 6,
    layout: "P5",
    role: "body",
    copy: {
      label: "공식",
      title: "프롬프트 한 줄 공식",
      highlight: "역할 + 맥락 + 작업 + 제약",
      list: [
        "✏︎|기본형|역할을 정한 뒤 맥락을 한 문장으로|짧을수록 좋음",
        "⌘|확장형|제약을 1~2개 더 붙여 정밀도 향상|버전·도구 명시",
      ],
    },
  });
}

export function makeP6Page(): Page {
  return basePage({
    index: 8,
    layout: "P6",
    role: "cta",
    copy: {
      label: "지금 시작",
      title: "오늘은<br><accent>하나만</accent> 적용",
      body: "스킬 하나 만들거나 훅 한 줄만 걸어도 매일 반복하는 일이 줄어든다.",
      highlight: "저장하고 따라하기 →",
    },
  });
}

export function makeP7Page(): Page {
  return basePage({
    index: 7,
    layout: "P7",
    role: "body",
    copy: {
      label: "한 줄 요약",
      title: "결국, 한 줄이면 충분하다",
    },
  });
}
