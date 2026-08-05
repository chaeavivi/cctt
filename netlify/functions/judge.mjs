// 센티넬·가이드 통합관리국 — AI 판정 생성 (서버리스 함수)
// Claude API 키는 Netlify 환경변수 ANTHROPIC_API_KEY 에만 저장됩니다.
// 코드/저장소에는 절대 키를 넣지 않습니다.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const MAX_PROFILE = 2000; // 프로필 붙여넣기 길이 제한(비용/남용 방지)

export default async (req) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "method" }, 405);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 키 미설정 → 프론트는 결정론 판정으로 자동 폴백
    return json({ ok: false, error: "no_key" }, 200);
  }

  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }

  const clip = (s) => (typeof s === "string" ? s.slice(0, MAX_PROFILE) : "");
  const p = {
    nameA: (d.nameA || "A").slice(0, 24), nameB: (d.nameB || "B").slice(0, 24),
    roleA: d.roleA, roleB: d.roleB, gradeA: d.gradeA, gradeB: d.gradeB,
    compat: d.compat, tag: d.tag, post: d.post,
    meet: d.meet, obstacle: d.obstacle, ending: d.ending,
    feelA: d.feelA, crisisA: d.crisisA, feelB: d.feelB, crisisB: d.crisisB,
    touch: d.touch || "미지정", bond: d.bond || "미지정",
    keyword: (d.keyword || "").slice(0, 60),
    profA: clip(d.profA), profB: clip(d.profB),
  };

  const system =
    "당신은 '센티넬·가이드 통합관리국'의 매칭 심사관입니다. 센티넬/가이드 AU 세계관 " +
    "설정에서, 두 자캐(오리지널 캐릭터) 페어에 대한 '캐해 소견'을 작성합니다. " +
    "차분하고 격식 있는 공문/판정서 문체(~하다체)로 쓰되, 인물의 감정과 관계 역학을 " +
    "구체적으로 짚어 주세요. 이미 산출된 적합률·역할·등급과 모순되지 않게 서술합니다. " +
    "한국어로 3~5문장, 200자~400자. 서두 인사나 메타설명 없이 소견 본문만 출력하세요. " +
    "이것은 창작 놀이용이며 실존 인물과 무관합니다.";

  const prompt =
    `[판정 대상]\n` +
    `- 대상 A: ${p.nameA} / 역할 ${p.roleA} / 능력등급 ${p.gradeA} / 상대를 향한 마음: ${p.feelA} / 위기 반응: ${p.crisisA}\n` +
    `- 대상 B: ${p.nameB} / 역할 ${p.roleB} / 능력등급 ${p.gradeB} / 상대를 향한 마음: ${p.feelB} / 위기 반응: ${p.crisisB}\n` +
    `[관계 서사]\n- 처음 마주친 상황: ${p.meet}\n- 둘 사이를 막는 것: ${p.obstacle}\n- 서사가 향하는 곳: ${p.ending}\n` +
    `- 접촉과 거리감: ${p.touch}\n- 결합에 대한 태도: ${p.bond}\n` +
    (p.keyword ? `- 강조 키워드: ${p.keyword}\n` : "") +
    `[산출 결과]\n- 종합 매칭 적합률: ${p.compat}% (${p.tag})\n- 권장 보직: ${p.post}\n` +
    (p.profA ? `\n[대상 A 제출 설정]\n${p.profA}\n` : "") +
    (p.profB ? `\n[대상 B 제출 설정]\n${p.profB}\n` : "") +
    `\n위 정보를 바탕으로 '캐해 소견'을 작성하세요.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return json({ ok: false, error: "api", status: res.status, detail: detail.slice(0, 300) }, 200);
    }
    const data = await res.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    if (!text) return json({ ok: false, error: "empty" }, 200);
    return json({ ok: true, commentary: text, model: MODEL }, 200);
  } catch (e) {
    return json({ ok: false, error: "fetch", detail: String(e).slice(0, 200) }, 200);
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
