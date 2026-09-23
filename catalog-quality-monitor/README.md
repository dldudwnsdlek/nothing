# 착한가격업소 카탈로그 품질 모니터링

> 스타터 킷입니다. 전체 설명은 [`docs/A안_점검_및_AtoZ_가이드.md`](../docs/A안_점검_및_AtoZ_가이드.md)를 보세요.
> 쿼리는 실제 스키마를 흉내 낸 가짜 데이터로만 실행을 확인했습니다. 실제 파일을 받은 뒤 컬럼명을 맞춰 고치세요.

## 실행 순서

```bash
pip install duckdb pandas jupyter tabulate anthropic
# data/ 에 CSV 3개를 넣은 뒤
python run_monitor.py --no-llm     # SQL만 실행해 reports/ 에 리포트 생성
export ANTHROPIC_API_KEY=...       # (Windows: set ANTHROPIC_API_KEY=...)
python run_monitor.py              # Claude 요약까지 포함
```

## 파일 구성

| 파일 | 내용 |
|---|---|
| `sql/00_load.sql` | 원본 CSV 적재 (raw) |
| `sql/01_staging.sql` | 시도명 통일, 상점 대리키, 메뉴 세로 펼치기, 가격 정제 (stg) |
| `sql/02_eda.sql` | 첫 탐색 쿼리 5개 |
| `sql/03_price.sql` | 축1 가격 경쟁력: 지역 평균 대비 기준초과·입력오류 탐지 |
| `sql/04_completeness.sql` | 축2 정보 완결성 점수, 지역별 개선 우선순위 |
| `sql/05_category.sql` | 축3 분류 정합성: 등록 업종 vs 메뉴 추정 업종 |
| `sql/06_timeseries.sql` | 외식비 LAG (전월·전년 동월 대비) |
| `sql/07_restaurant.sql` | 일반음식점 월별 개업·폐업 KPI, 대용량 품질 검사 (확장) |
| `sql/08_snapshot_diff.sql` | 두 분기 스냅샷 비교 (10/30 이후) |
| `run_monitor.py` | 적재 → 지표 → 이상 목록 → Claude 요약 리포트 자동화 |

## README에 채울 목차 (완성 후)

1. 문제 정의
2. 데이터 (규모, 기준일, 한계)
3. 지표 정의서
4. 파이프라인 구조 (raw → stg → fct → report)
5. 발견 사항과 조치 제안
6. 검증 (정밀도, 임계값 민감도)
7. 자동화 (실행 시간, 리포트 예시)
8. 한계와 다음 단계
