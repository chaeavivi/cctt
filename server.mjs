// 센티넬·가이드 통합관리국 — 로컬 서버 (개인용)
// index.html 을 띄우고, /judge 요청이 오면 Claude Code CLI(`claude -p`)를
// child_process 로 실행해 캐해 소견을 생성한다. 구독 인증 사용 → API 키 불필요.
//
// 실행:  claude 로그인 상태에서  ->  node server.mjs
// 접속:  http://localhost:5173
//
// 의존성 0 (Node 내장 모듈만 사용).

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const MAX_PROFILE = 2000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---- 프롬프트 구성 ----
function clip(s) {
  return typeof s === "string" ? s.slice(0, MAX_PROFILE) : "";
}
function buildPrompt(d) {
  return [
    "당신은 '센티넬·가이드 통합관리국'의 매칭 심사관입니다. 센티넬/가이드 AU(초감각 센티넬과 그를 안정시키는 가이드) 세계관에서, 두 자캐(오리지널 캐릭터) 페어에 대한 '캐해 소견'을 작성합니다.",
    "차분하고 격식 있는 공문/판정서 문체(~하다체)로, 인물의 감정과 관계 역학을 구체적으로 짚어 주세요. 이미 산출된 적합률·역할·등급과 모순되지 않게 서술하고, 한국어 3~5문장(200~400자)으로, 서두 인사나 메타설명 없이 소견 본문만 출력하세요. 창작(자캐) 놀이용이며 실존 인물과 무관합니다.",
    "",
    `[대상 A] ${d.nameA} / 역할 ${d.roleA} / 능력등급 ${d.gradeA} / 상대를 향한 마음: ${d.feelA} / 위기 반응: ${d.crisisA}`,
    `[대상 B] ${d.nameB} / 역할 ${d.roleB} / 능력등급 ${d.gradeB} / 상대를 향한 마음: ${d.feelB} / 위기 반응: ${d.crisisB}`,
    `[관계 서사] 처음 마주친 상황: ${d.meet} / 둘 사이를 막는 것: ${d.obstacle} / 서사가 향하는 곳: ${d.ending} / 접촉과 거리감: ${d.touch || "미지정"} / 결합에 대한 태도: ${d.bond || "미지정"}`,
    d.keyword ? `[강조 키워드] ${d.keyword}` : "",
    `[산출 결과] 종합 매칭 적합률: ${d.compat}% (${d.tag}) / 권장 보직: ${d.post}`,
    clip(d.profA) ? `\n[대상 A 제출 설정]\n${clip(d.profA)}` : "",
    clip(d.profB) ? `\n[대상 B 제출 설정]\n${clip(d.profB)}` : "",
    "",
    "위 정보를 바탕으로 '캐해 소견'을 작성하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---- claude CLI 실행 (execFile: 셸을 거치지 않아 인젝션 안전) ----
function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    execFile(
      CLAUDE_BIN,
      ["-p", prompt],
      { maxBuffer: 4 * 1024 * 1024, timeout: 120000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message || "claude 실행 실패").toString().slice(0, 400)));
        resolve((stdout || "").trim());
      }
    );
  });
}

// ---- 서버 ----
createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/judge") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 300000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const d = JSON.parse(body || "{}");
        const text = await runClaude(buildPrompt(d));
        sendJson(res, 200, { ok: !!text, commentary: text });
      } catch (e) {
        sendJson(res, 200, { ok: false, error: String(e.message || e).slice(0, 400) });
      }
    });
    return;
  }

  // 정적 파일 서빙
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const safe = rel.replace(/\.\.(\/|\\|$)/g, ""); // 경로 탈출 차단
  try {
    const data = await readFile(join(__dirname, safe));
    res.writeHead(200, { "content-type": TYPES[extname(safe)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(PORT, () => {
  console.log(`\n  센티넬·가이드 통합관리국`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  (AI 판정은 'claude' CLI 로그인 상태에서 동작합니다)\n`);
});

function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
