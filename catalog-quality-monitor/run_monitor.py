"""run_monitor.py — 새 분기 파일이 들어오면 한 번 실행: 적재 → 지표 → 이상 목록 → Claude 요약 리포트"""
import re, sys, time
from datetime import date
from pathlib import Path
import duckdb

SQL_DIR, OUT_DIR = Path("sql"), Path("reports")
OUT_DIR.mkdir(exist_ok=True)

def run_sql_file(con, path):
    """파일 안의 문장을 ;로 나눠 순서대로 실행한다. CREATE는 실행만, 조회(SELECT/WITH)는 결과를 DataFrame으로 돌려준다."""
    result = None
    for stmt in path.read_text(encoding="utf-8").split(";"):
        code = "\n".join(l for l in stmt.splitlines() if not l.strip().startswith("--")).strip()
        if not code:
            continue
        if code.upper().startswith("CREATE"):
            con.execute(stmt)
        else:
            result = con.sql(stmt).df()
    return result

start = time.perf_counter()
con = duckdb.connect("catalog.duckdb")
results = {}
for f in ["00_load.sql", "01_staging.sql", "03_price.sql", "04_completeness.sql", "05_category.sql"]:
    results[f] = run_sql_file(con, SQL_DIR / f)
elapsed = time.perf_counter() - start

price_alerts = results["03_price.sql"]
summary_md = (
    f"- 처리 상점 수: {con.sql('SELECT COUNT(*) FROM stg_store').fetchone()[0]:,}\n"
    f"- 가격 이상: {len(price_alerts):,}건 ({price_alerts['price_flag'].value_counts().to_dict()})\n"
    f"- 분류 불일치 조합: {len(results['05_category.sql'])}개\n"
    f"- 실행 시간: {elapsed:.1f}초\n"
)
table_md = price_alerts[["sido", "store_name", "menu_name", "price", "region_avg", "price_flag"]].head(50).to_markdown(index=False)

report = f"# 카탈로그 품질 리포트 ({date.today()})\n\n## 요약 지표\n{summary_md}\n## 가격 이상 상위 50건\n{table_md}\n"

if "--no-llm" not in sys.argv:
    import anthropic
    client = anthropic.Anthropic()          # ANTHROPIC_API_KEY 환경변수에서 키를 읽는다
    prompt = (
        "당신은 배달 플랫폼 카탈로그 품질 운영팀의 분석가입니다. 아래 지표와 이상 목록을 보고 "
        "(1) 원인 유형별 묶음 (2) 조치 우선순위와 근거 (3) 담당 부서에 보낼 요청 문장을 "
        "각각 한 문단으로 작성하세요. 표에 없는 숫자는 만들지 마세요.\n\n" + summary_md + "\n" + table_md
    )
    response = client.beta.messages.create(
        model="claude-opus-5",
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],   # 요청이 거절되면 서버가 대체 모델로 재시도
        fallbacks="default",
        messages=[{"role": "user", "content": prompt}],
    )
    if response.stop_reason == "refusal":
        sys.exit("모델이 요청을 거절했습니다")
    report += "\n## AI 요약\n" + "".join(b.text for b in response.content if b.type == "text")

out = OUT_DIR / f"report_{date.today()}.md"
out.write_text(report, encoding="utf-8")
print(f"saved {out} ({elapsed:.1f}s)")
