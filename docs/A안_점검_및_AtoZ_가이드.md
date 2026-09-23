# A안 점검 결과와 SQL 프로젝트 A to Z 가이드

> 대상: 쿠팡이츠 Junior Data PM (Catalog Quality Insights) 지원용 SQL 프로젝트, A안
> 점검일: 2026-09-23
> 바로 실행할 수 있는 파일 묶음: [`catalog-quality-monitor/`](../catalog-quality-monitor/) (SQL 9개, `run_monitor.py`)
> 점검 방법: 공공데이터포털 데이터셋 페이지를 직접 확인했고, 설계안 SQL은 DuckDB 1.5.5에서 실제 스키마를 흉내 낸 가짜 데이터로 실행해 봤습니다.
> ⚠️ 이 점검 환경에서는 공공데이터포털 파일을 내려받을 수 없었습니다. 컬럼과 건수는 데이터셋 페이지 기준입니다. **파일을 받은 첫날 한 번 더 확인하세요.**

---

## 0. 결론 먼저

| 항목 | 판정 | 한 줄 요약 |
|---|---|---|
| 주제 | ✅ 적합 | JD 업무 8개 중 6개와 직접 맞닿습니다. 그대로 진행하세요 |
| 데이터 | ⚠️ 수정 필요 | 설계안의 컬럼, 건수, 과거 시점이 실제 전국판 데이터와 다릅니다. 착한가격업소는 유지하고 보조 데이터를 바꿉니다 |
| 설계안 SQL | ⚠️ 수정 필요 | ① 가격 쿼리는 실행하면 오류가 납니다. z-score 기준은 표본이 5개일 때 이상치를 하나도 잡지 못합니다 |
| 일정 | ⚠️ 5~7일 → 약 2주 | SQL이 처음이면 3일 정도 기초 학습이 먼저 필요합니다. 지원은 8일차 MVP 시점에 먼저 하세요 |

---

## 1. 주제 점검: 적합

### 1-1. JD와의 연결

| JD 업무 | A안에서 해당하는 부분 |
|---|---|
| 1. SQL 추출·분석·인사이트 | 프로젝트 전체 |
| 2. 운영 KPI 모니터링·이상 징후 탐지 | 가격 이상 탐지, 월별 폐업 급증 탐지 |
| 3. 원인 분석·개선안 | 이상 건을 원인 유형별로 묶고 조치 목록으로 정리 |
| 4·7. 반복 업무 자동화·AI Tool | `run_monitor.py`와 Claude API 요약 리포트 |
| 6. 카탈로그 품질 (가격 경쟁력 등) | 품질 축 3개 |
| 8. 데이터 기반 운영 개선 프로젝트 | 프로젝트 자체 |

### 1-2. 주제를 더 강하게 만드는 보완 3가지

1. **"가정"이 아니라 "같은 구조"라고 설명하세요.**
   - 기존 설명은 "공개 데이터를 플랫폼 입점 카탈로그로 *본다*"입니다. 면접관이 "그건 가정 아닌가요?"라고 물으면 답하기 어렵습니다.
   - 이렇게 바꾸세요: "착한가격업소는 정부가 **가격 기준으로 인증해 노출하는 상점 목록**이다. 지정 기준에 '지역 평균가격을 넘으면 지정 제외'가 있다. 그래서 **등록된 가격이 기준을 계속 지키는지 감시하는 일**은 쿠팡이츠의 가격 경쟁력 관리와 구조가 같다."
   - 근거 예시: [대전 서구청 착한가격업소 선정기준](https://www.seogu.go.kr/kor/sub06_09_01_02.do). 가격 45점, 위생·청결 30점, 품질·서비스 20점, 공공성 5점이고, 지역 평균가격을 넘는 업소는 지정 제외 대상입니다. 지자체마다 세부 기준이 조금씩 다릅니다.
2. **탐지에서 멈추지 말고 조치 목록까지 만드세요.** JD의 "단순 리포팅이 아닌"에 대한 답입니다. 이상 건마다 `이상 유형 → 추정 원인 → 조치 → 담당 → 우선순위`를 붙인 표를 최종 산출물로 두세요.
3. **지표 정의서를 산출물로 만드세요.** PM 면접에서는 쿼리 자체보다 "왜 이 지표이고 왜 이 임계값인가"를 더 많이 묻습니다. 템플릿은 [Step 6](#step-6-지표-정의서-5일차-오후)에 있습니다.

---

## 2. 데이터 점검: 발견한 문제

### 2-1. 착한가격업소 (메인 데이터): 유지하되 설계 수정

[행정안전부_착한가격업소 현황](https://www.data.go.kr/data/3045247/fileData.do) 페이지 확인 결과:

| 항목 | 설계안 가정 | 실제 (2026-09-23 확인) |
|---|---|---|
| 파일 | (명시 없음) | 행정안전부_착한가격업소 현황_20260630 (CSV, 분기 갱신, 최종 수정 2026-07-27) |
| 규모 | 전국 수만 건 | **12,645건**. 미용·세탁·숙박 같은 비요식업이 포함된 숫자라 외식업만 남기면 더 줄어듭니다 |
| 컬럼 | 업종, 업소명, 도로명주소, 전화번호, 품목1·가격1, 품목2·가격2, **위도, 경도, 관리기관, 기준일자** | **시도, 시군, 업종, 업소명, 연락처, 주소, 메뉴1~4, 가격1~4** |
| 과거 시점 | 20250331과 20260331 두 개를 받는다 | 페이지에 과거 파일 이력이 없습니다. 분기마다 파일이 교체됩니다(직전 분기에는 _20260331이었음). **다음 등록 예정일은 2026-10-30**입니다 |
| 연락처 공란 | 품질 불량으로 집계 | 원본 비고에 "휴대전화번호 등 개인정보로 제외함"이라고 적혀 있습니다 |

설계안의 컬럼 목록은 전국판이 아니라 **지자체별 공개본(의정부시 등)** 형식입니다. 전국판에는 위도, 경도, 기준일자가 없습니다.

영향과 조치:

| # | 문제 | 영향받는 설계안 쿼리 | 조치 |
|---|---|---|---|
| D1 | 위도·경도 없음 | ② 좌표결측율·좌표이상율, 지도 시각화 | 좌표 검사는 일반음식점 데이터(2-3)로 옮깁니다 |
| D2 | 기준일자 없음 | ④ `ORDER BY 기준일자` | 적재할 때 파일명에서 `snapshot_date` 컬럼을 직접 붙입니다 |
| D3 | 과거 시점 파일 없음 | ④ LAG, ⑤ 신규/이탈 | 지금은 할 수 없습니다. 10/30 이후 20260930 파일로 비교하고 면접 전 업데이트 소재로 씁니다. LAG는 월별 시계열 데이터로 옮깁니다 |
| D4 | 연락처 공란은 정책상 제외 | ② 전화형식오류율 | 품질 점수에서 빼고 README에 이유를 적습니다. 면접에서 Dive Deep 질문이 나오는 지점입니다 |
| D5 | 메뉴가 4개 | ① UNION ALL 2개 | 4개로 늘립니다. 분석할 가격 데이터가 설계안의 2배입니다 |
| D6 | 규모 약 1.2만 건 | 이력서 "N만 건", "대용량" 표현 | 실제 숫자를 씁니다. 대용량 처리는 일반음식점 데이터(약 213만 건)로 보여줍니다 |

### 2-2. 개념상 가장 큰 문제: 선택 편향

착한가격업소는 **지역 평균보다 싼 가게만 골라 지정한 목록**입니다. 이 안에서 z-score로 "비싼 가게"를 찾으면 "싼 가게들 중 덜 싼 가게"가 나올 뿐입니다. 가격 경쟁력이 없다는 뜻이 아닙니다. 면접에서 "이 데이터로 가격 경쟁력을 평가해도 되나요?"라고 물으면 설계안으로는 답할 수 없습니다.

해결책은 **외부 벤치마크**입니다. 행정안전부 지방물가정보나 한국소비자원 참가격이 공개하는 **시도별 외식비 월별 평균가격**을 쓰세요. 품목은 냉면, 비빔밥, 김치찌개백반, 삼겹살, 자장면, 삼계탕, 칼국수, 김밥입니다. 착한가격업소 메뉴를 이 품목에 연결하면 다음을 계산할 수 있습니다.

- `지역 평균 대비 할인율`: 실제 가격 경쟁력 지표
- `가격 > 지역 평균`: **지정 기준 위반 의심 → 재심사 대상**. 정책 규칙에 근거한 이상 탐지입니다
- 월별 데이터라서 LAG로 전월 대비·전년 동월 대비를 자연스럽게 계산할 수 있습니다

### 2-3. 상가(상권)정보 (store_universe): 교체 권장

- 설계안 쿼리 ①~⑥ 어디에서도 **한 번도 쓰이지 않습니다.**
- 쓰려면 착한가격업소와 조인해야 하는데 공통 키(ID, 좌표)가 없습니다. 주소 문자열을 맞춰야 해서 SQL 초심자에게는 어렵고, 매칭률도 낮습니다.
- 이 데이터셋도 분기마다 파일이 교체되는 방식(현재 _20260630)이라 과거 시점을 받기 어렵습니다.

**행정안전부 일반음식점 인허가 데이터로 바꾸는 것을 권장합니다.**

- 전국 약 213만 건입니다(데이터셋 페이지 표기 기준). **폐업 업소도 포함**하며, 인허가일자와 영업상태가 있습니다.
- 2026-04-16에 LOCALDATA(지방행정 인허가데이터 개방)가 종료되면서 공공데이터포털로 이관됐고, 인허가 정보 195종의 **과거 이력 데이터가 새로 공개**됐습니다 ([ZDNet 2026-01-25](https://zdnet.co.kr/view/?no=20260125144854)).
- 쓰임새:
  1. 월별 개업·폐업 수는 쿠팡이츠의 "입점/이탈" KPI와 같은 구조입니다. LAG, 이동평균, 이상 월 탐지에 씁니다.
  2. 200만 행 규모에서 결측과 논리 오류를 검사합니다. 좌표·전화·주소 결측, "폐업 상태인데 폐업일자가 없음" 같은 경우입니다.
  3. 업태구분명과 사업장명을 비교해 분류 정합성을 봅니다.
- 링크: [행정안전부_일반음식점](https://www.data.go.kr/data/15045016/fileData.do), [전국일반음식점표준데이터](https://www.data.go.kr/data/15096283/standard.do). 둘 중 폐업 업소와 폐업일자가 들어 있는 쪽을 쓰세요.
- ⚠️ 쿼리는 기존 LOCALDATA 컬럼명(인허가일자, 영업상태명, 폐업일자, 사업장명, 업태구분명, 좌표정보x(epsg5174) 등) 기준으로 작성했습니다. 이관 후 이름이 바뀌었을 수 있으니 받은 날 확인하세요. 좌표는 위경도가 아니라 TM 좌표(EPSG:5174)라서 지도에 바로 찍을 수 없습니다. 결측 검사에는 문제없습니다.

### 2-4. 설계안 SQL 자체의 문제 (DuckDB 1.5.5에서 실행해 확인)

| # | 위치 | 문제 | 확인 결과 | 수정 |
|---|---|---|---|---|
| S1 | ① | `PERCENTILE_CONT(0.5) WITHIN GROUP (...) OVER (...)` | DuckDB에서 **실행 오류**가 납니다. PostgreSQL도 이 형태(순서집합 집계를 윈도우 함수로 쓰기)는 지원하지 않습니다 | `MEDIAN(price) OVER (...)` |
| S2 | ① | `bm_n >= 5`와 `ABS(z) > 2` 조합 | 표본이 n개면 z 절댓값의 최대치는 (n−1)/√n입니다. **n=5면 1.79**라서 1, 2, 3, 4, 100을 넣어도 z=1.79로 잡히지 않습니다 | z-score 대신 외부 벤치마크 대비와 백분위 순위를 씁니다 |
| S3 | ① | 시군구×업종×**메뉴명 정확 일치**로 그룹 | 메뉴명이 자유 텍스트('김치찌개', '김치찌게', '김치찌개(1인)')라서 대부분 그룹의 표본이 5개 미만입니다 | 메뉴 표준화 규칙 테이블을 만들고 시도 단위로 비교합니다 |
| S4 | ④ | `PARTITION BY 업소명` | 이름이 같은 다른 지역 상점이 한 그룹으로 섞입니다 | 업소명+주소로 대리키를 만듭니다 |
| S5 | ④ | 시점 2개에 LAG 사용 | 동작은 하지만 시점 2개 비교에는 JOIN이 더 자연스럽습니다. "왜 LAG를 썼나요?"에 답하기 어렵습니다 | 시점 2개는 FULL OUTER JOIN, LAG는 월별 시계열에 씁니다 |
| S6 | ⑤ | 업소명+도로명주소 문자열로 조인 | 분기 사이에 주소 띄어쓰기만 바뀌어도 '이탈'과 '신규'로 잡힙니다 | 공백을 제거한 뒤 키를 만듭니다 |
| S7 | 전체 | 가격이 숫자라고 가정 | '8,000원', '7,000~8,000' 같은 문자열이 섞여 있을 수 있습니다(첫날 확인) | 문자열로 읽고 형식을 검사한 뒤 변환합니다. 형식오류율 자체를 품질 지표로 씁니다 |
| S8 | 전체 | UTF-8로 가정 | 공공데이터포털 CSV는 CP949(EUC-KR)인 경우가 많습니다 | 한글이 깨지면 `encoding = 'cp949'`로 읽습니다 |
| S9 | README | "PostgreSQL 호환 표준 SQL로 작성" | QUALIFY, MEDIAN 같은 DuckDB 전용 문법을 쓰면 사실이 아닙니다 | "DuckDB SQL로 작성"이라고 쓰고, 면접용 변환표([7-7](#7-7-면접용-duckdb-문법--다른-db-변환표))를 따로 익힙니다 |
| S10 | 자동화 | `run_daily.py` | 데이터가 분기마다 갱신되는데 매일 돌리는 구조입니다 | `run_monitor.py`로 이름을 바꾸고 새 파일이 들어오면 실행합니다 |

---

## 3. 수정안: 데이터 구성 v2

| 테이블 | 데이터 | 규모 | 역할 | 우선순위 |
|---|---|---|---|---|
| `raw_good_price` | [착한가격업소 현황 20260630](https://www.data.go.kr/data/3045247/fileData.do) | 12,645건 | 메인 카탈로그, 품질 축 3개 | 필수 (MVP) |
| `raw_eatout_price` | 시도별 외식비 월별 평균가: [참가격 외식비](https://www.price.go.kr/tprice/portal/servicepriceinfo/dineoutprice/dineOutPriceList.do) 또는 [행안부 지방물가정보 외식비](https://www.mois.go.kr/frt/sub/a02/eatOutPriceList/screen.do) | 8품목 × 17시도 × 월 | 가격 벤치마크, LAG 시계열 | 필수 (MVP) |
| `raw_restaurant` | [일반음식점 인허가](https://www.data.go.kr/data/15045016/fileData.do) | 약 213만 건 | 입점/이탈 KPI, 대용량 품질 검사 | 확장 |
| 다음 분기 스냅샷 | 착한가격업소 20260930 | 10/30 공개 예정 | 스냅샷 비교(신규·해제·가격변경) | 면접 전 업데이트 |

**외식비 데이터 받는 법.** 두 사이트 모두 이 점검 환경에서는 접속이 되지 않아 다운로드 형식을 확인하지 못했습니다. 엑셀로 내려받을 수 있으면 그대로 쓰세요. 안 되면 필요한 달만 직접 입력합니다(한 달 = 8품목 × 17시도 = 136행).

- 최소 구성: `2026-06` 한 달(가격 경쟁력 비교용)과, 전년 동월 비교를 위한 최근 25개월치입니다.
- 25개월 × 136행 = 3,400행은 손으로 입력하기에 너무 많습니다. 다운로드가 안 되면 시계열은 일부 시도(예: 서울, 경기, 부산)만 입력하는 식으로 줄이세요.
- 삼겹살은 조사 단위가 달라(g 환산) 1인분 메뉴와 직접 비교하기 어렵습니다. 조사 기준을 확인한 뒤 뺄지 정하세요. 아래 쿼리에서는 뺐습니다.

CSV 형식(숫자는 형식 예시):

```
기준월,시도,품목,평균가격
2026-06,서울,김치찌개백반,9000
2026-06,서울,자장면,7500
```

---

## 4. A to Z 실행 가이드

### Step 0. 순서 전략: MVP 시점에 먼저 지원

공고는 조기 마감될 수 있습니다. SQL이 처음이면 전체를 완성하는 데 2주 정도 걸립니다.

**8일차(품질 축 3개와 지표 정의서 완성)에 이력서에 반영해 지원하세요.** 나머지(시계열, 자동화, 대시보드)는 서류 결과를 기다리는 동안 완성해 면접에서 보여주면 됩니다.

### Step 1. SQL 기초 (1~3일차)

SQL은 "표에게 질문하는 문장"입니다. 쓰는 순서와 **실행되는 순서가 다릅니다.** 이걸 먼저 이해하면 WHERE와 HAVING의 차이 같은 면접 질문이 저절로 풀립니다.

```
쓰는 순서:    SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
실행 순서:    FROM → WHERE → GROUP BY → HAVING → SELECT(윈도우 함수 포함) → ORDER BY → LIMIT
```

- WHERE는 묶기 **전** 행을 거르고, HAVING은 묶은 **뒤** 그룹을 거릅니다.
- SELECT에서 붙인 별칭을 WHERE에서 쓸 수 없는 이유는 SELECT가 WHERE보다 나중에 실행되기 때문입니다.
- 윈도우 함수 결과로 거르려면 쿼리를 한 번 감싸야 합니다(서브쿼리나 CTE). DuckDB는 `QUALIFY`로 바로 거를 수 있습니다.

학습 순서:

| 일차 | 개념 | 연습 | 이 프로젝트에서 쓰는 곳 |
|---|---|---|---|
| 1 | SELECT, WHERE, ORDER BY, LIMIT, NULL 처리(IS NULL, COALESCE) | 프로그래머스 SQL 고득점 Kit: SELECT, IS NULL | 데이터 훑어보기, 결측 확인 |
| 1 | 집계(COUNT, SUM, AVG), GROUP BY, HAVING | 고득점 Kit: SUM·MAX·MIN, GROUP BY | 지역별·업종별 요약 |
| 2 | CASE WHEN, 조건부 집계 `SUM(CASE WHEN … THEN 1 ELSE 0 END)` | 고득점 Kit: String·Date | 품질 플래그, 결측률 |
| 2 | JOIN 4종(INNER, LEFT, LEFT+IS NULL 차집합, FULL OUTER), UNION ALL | 고득점 Kit: JOIN | 벤치마크 붙이기, 스냅샷 비교 |
| 3 | 서브쿼리, CTE(`WITH`) | LeetCode Database Easy | 긴 쿼리를 단계별로 나누기 |
| 3 | 윈도우 함수: ROW_NUMBER, RANK, LAG, AVG() OVER, ROWS BETWEEN | LeetCode Database Medium 중 윈도우 문제 | Top-N, 전월 대비, 이동평균 |

팁:
- 프로그래머스는 MySQL 기준이고 이 프로젝트는 DuckDB입니다. 기본 문법(SELECT부터 윈도우 함수까지)은 같고 일부 함수 이름만 다릅니다([7-7 변환표](#7-7-면접용-duckdb-문법--다른-db-변환표)).
- 하루 공부가 끝나면 그날 배운 문법으로 **내 데이터에 쿼리 3개**를 써 보세요. 4일차부터는 프로젝트 자체가 연습장입니다.

### Step 2. 환경 세팅 (4일차 오전, 30분)

pandas를 써 봤으니 **Jupyter와 DuckDB** 조합이 가장 익숙할 겁니다.

```bash
pip install duckdb pandas jupyter tabulate anthropic
```

폴더 구조:

```
catalog-quality-monitor/
├── data/               # 원본 CSV. git에 올리지 않습니다 (.gitignore에 data/ 추가)
├── sql/                # 00_load.sql ~ 08_snapshot_diff.sql
├── notebooks/explore.ipynb
├── reports/            # 자동 생성 리포트
├── run_monitor.py
└── README.md
```

Jupyter 첫 셀:

```python
import duckdb
con = duckdb.connect("catalog.duckdb")      # 파일로 저장되는 DB. 껐다 켜도 테이블이 남습니다
con.sql("SELECT 1 + 1 AS test").df()        # 결과를 pandas DataFrame으로 받기
```

쿼리가 길어지면 `.sql` 파일로 옮기고 `con.execute(open("sql/00_load.sql", encoding="utf-8").read())`로 실행합니다.

### Step 3. 데이터 받기와 적재 (4일차)

1. 착한가격업소 CSV → `data/good_price_20260630.csv`
2. 외식비 → `data/eatout_price.csv` (형식은 [3장](#3-수정안-데이터-구성-v2) 참고)
3. (확장) 일반음식점 → `data/restaurant_license.csv`

`sql/00_load.sql`:

```sql
-- 00_load.sql : 원본 CSV를 "있는 그대로" 적재 (raw 레이어)
-- 모든 컬럼을 문자열(VARCHAR)로 읽는다 → 타입 추론 실패로 행이 깨지는 것을 막고, 정제는 SQL로 직접 한다
CREATE OR REPLACE TABLE raw_good_price AS
SELECT *, DATE '2026-06-30' AS snapshot_date          -- 원본에 기준일자 컬럼이 없으므로 파일명에서 직접 부여
FROM read_csv('data/good_price_20260630.csv', encoding = 'cp949', all_varchar = true);

CREATE OR REPLACE TABLE raw_eatout_price AS
SELECT * FROM read_csv('data/eatout_price.csv', all_varchar = true);

-- 일반음식점(확장용) 적재는 07_restaurant.sql 맨 위에 있음 → 파일이 없어도 MVP가 돌아가도록 분리
```

원칙은 **원본(raw)에 손대지 않는 것**입니다. 모든 컬럼을 문자열로 읽는 이유는 가격 칸에 '8,000원'이 섞여 있으면 숫자 타입 추론이 실패하거나 값이 NULL로 바뀌기 때문입니다. 정제는 다음 단계에서 SQL로 직접 합니다.

적재 직후 확인:

```sql
DESCRIBE raw_good_price;                 -- 컬럼명과 타입. 실제 컬럼명이 다르면 이후 쿼리를 여기에 맞춰 고칩니다
SELECT * FROM raw_good_price LIMIT 5;    -- 한글이 깨지면 인코딩 문제
SELECT COUNT(*) FROM raw_good_price;     -- 12,645 근처인지
```

한글이 깨지면 `encoding = 'cp949'`를 넣거나 빼 보세요(빼면 UTF-8). DuckDB가 cp949를 읽지 못하는 환경이면 pandas로 우회합니다.

```python
import pandas as pd
df = pd.read_csv("data/good_price_20260630.csv", encoding="cp949", dtype=str)
con.sql("CREATE OR REPLACE TABLE raw_good_price AS SELECT *, DATE '2026-06-30' AS snapshot_date FROM df")
```

### Step 4. 정제 (4일차 오후)

테이블을 층으로 나눕니다.

```
raw_* (원본 그대로) → stg_* (정제: 이름 통일, 타입 변환, 세로 펼치기) → fct_* (지표 계산 결과) → 리포트
```

면접에서 "왜 이렇게 나눴나요?"라고 물으면: "원본을 보존해야 정제 규칙을 바꿨을 때 다시 돌릴 수 있고, 어느 단계에서 값이 바뀌었는지 추적할 수 있어서"라고 답하면 됩니다.

`sql/01_staging.sql`의 핵심 4가지:

1. **시도명 통일(`dim_sido`)**: '강원도'와 '강원특별자치도'(2023년 변경), '전라북도'와 '전북특별자치도'(2024년 변경)가 섞여 있을 수 있습니다. 외식비 데이터의 시도 표기와 맞춰야 조인됩니다.
2. **대리키 `store_key`**: 원본에 상점 ID가 없어서 업소명+주소(공백 제거)로 만듭니다.
3. **메뉴 세로 펼치기**: 메뉴1~4 가로 컬럼을 UNION ALL로 세로로 바꿉니다. 이후 모든 가격 분석은 "한 행 = 한 메뉴" 테이블에서 시작합니다.
4. **가격 형식 검사 후 숫자 변환**

```sql
-- 01_staging.sql : 정제 레이어 (stg_)
-- (1) 시도명 표준화: '서울특별시'·'서울' / '강원도'·'강원특별자치도' 등 표기 차이를 2글자 약칭으로 통일
CREATE OR REPLACE TABLE dim_sido AS
SELECT * FROM (VALUES
  ('서울특별시','서울'),('부산광역시','부산'),('대구광역시','대구'),('인천광역시','인천'),
  ('광주광역시','광주'),('대전광역시','대전'),('울산광역시','울산'),('세종특별자치시','세종'),
  ('경기도','경기'),('강원도','강원'),('강원특별자치도','강원'),('충청북도','충북'),('충청남도','충남'),
  ('전라북도','전북'),('전북특별자치도','전북'),('전라남도','전남'),('경상북도','경북'),('경상남도','경남'),
  ('제주특별자치도','제주')
) AS t(sido_full, sido);

-- (2) 상점 마스터: 한 상점 = 한 행. 원본에 ID가 없으므로 업소명+주소로 대리키(store_key)를 만든다
CREATE OR REPLACE TABLE stg_store AS
SELECT
    md5(regexp_replace(g.업소명, '\s', '', 'g') || '|' || regexp_replace(coalesce(g.주소, ''), '\s', '', 'g')) AS store_key,
    g.snapshot_date,
    coalesce(d.sido, g.시도)  AS sido,
    g.시군                    AS sigungu,
    g.업종                    AS category,
    g.업소명                  AS store_name,
    nullif(trim(g.주소), '')  AS address,
    nullif(trim(g.연락처), '') AS phone,
    g.* EXCLUDE (시도, 시군, 업종, 업소명, 주소, 연락처, snapshot_date)   -- 메뉴1~4, 가격1~4는 그대로 들고 간다
FROM raw_good_price g
LEFT JOIN dim_sido d ON g.시도 = d.sido_full;

-- (3) 메뉴 롱포맷: 메뉴1~4 / 가격1~4 가로 컬럼을 세로로 펼친다 (한 행 = 한 메뉴)
CREATE OR REPLACE TABLE stg_menu AS
WITH s AS (   -- 같은 상점이 두 번 등록된 경우 1건만 사용 (중복 자체는 완결성 지표에서 따로 센다)
    SELECT * FROM stg_store
    QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key ORDER BY store_name) = 1
),
long AS (
    SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 1 AS menu_no, 메뉴1 AS menu_raw, 가격1 AS price_raw FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 2, 메뉴2, 가격2 FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 3, 메뉴3, 가격3 FROM s
    UNION ALL SELECT store_key, snapshot_date, sido, sigungu, category, store_name, 4, 메뉴4, 가격4 FROM s
)
SELECT *,
    trim(menu_raw) AS menu_name,
    -- 가격 형식 검사: '8000', '8,000', '8,000원'만 정상으로 인정. '7,000~8,000' 같은 범위값은 형식오류로 분리
    regexp_matches(coalesce(price_raw, ''), '^\s*[0-9][0-9,]*\s*원?\s*$') AS price_format_ok,
    CASE WHEN regexp_matches(coalesce(price_raw, ''), '^\s*[0-9][0-9,]*\s*원?\s*$')
         THEN TRY_CAST(regexp_replace(price_raw, '[^0-9]', '', 'g') AS INTEGER) END AS price
FROM long
WHERE nullif(trim(menu_raw), '') IS NOT NULL OR nullif(trim(price_raw), '') IS NOT NULL;   -- 둘 다 빈 칸인 슬롯은 버림

-- (4) 외식비 벤치마크 (시도 x 품목 x 월)
CREATE OR REPLACE TABLE stg_eatout AS
SELECT CAST(기준월 || '-01' AS DATE) AS month, 시도 AS sido, 품목 AS item, CAST(평균가격 AS INTEGER) AS avg_price
FROM raw_eatout_price;
```

검증 습관: `stg_menu`의 행 수는 원본에서 메뉴나 가격 칸이 채워진 칸의 수와 같아야 합니다. UNION ALL은 행을 잃거나 늘리지 않기 때문입니다. 단계마다 이런 "행 수 확인"을 README에 한 줄씩 남기면 Dive Deep 질문에 좋은 답이 됩니다.

### Step 5. 탐색 (5일차 오전)

```sql
-- 02_eda.sql : 첫 탐색 쿼리 (결과를 README '데이터 이해' 섹션에 기록)
-- Q1. 전체 행 수 / 상점 수 / 중복 등록 의심
SELECT COUNT(*) AS rows, COUNT(DISTINCT store_key) AS stores, COUNT(*) - COUNT(DISTINCT store_key) AS dup_rows FROM stg_store;
-- Q2. 업종 분포 → 외식업만 남길 업종 목록을 여기서 결정
SELECT category, COUNT(*) AS n, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct FROM stg_store GROUP BY category ORDER BY n DESC;
-- Q3. 시도명 매핑 누락 확인 (dim_sido에 없는 표기가 있으면 여기 나온다)
SELECT sido, COUNT(*) FROM stg_store WHERE length(sido) > 2 GROUP BY sido;
-- Q4. 가격 형식오류 샘플
SELECT price_raw, COUNT(*) FROM stg_menu WHERE NOT price_format_ok GROUP BY price_raw ORDER BY 2 DESC LIMIT 20;
-- Q5. 가장 많이 등장하는 메뉴명 Top 30 → 메뉴 표준화 사전(dim_menu_rule)의 재료
SELECT menu_name, COUNT(*) FROM stg_menu GROUP BY menu_name ORDER BY 2 DESC LIMIT 30;
```

기록할 것:
- 업종 목록: 어디까지를 외식업으로 볼지 정합니다.
- 시도 표기 누락: `dim_sido`에 추가합니다.
- 가격 형식오류 유형
- 메뉴명 Top 30: [7-1](#7-1-축1-가격-경쟁력-03_pricesql)의 표준화 규칙 재료입니다. '세트', '곱빼기', '특' 같은 변형이 많으면 규칙에서 빼는 조건을 추가하세요.

이 결과가 그대로 README의 "데이터 이해" 섹션이 됩니다.

### Step 6. 지표 정의서 (5일차 오후)

PM 산출물의 핵심입니다. 이 표를 README에 그대로 넣으세요.

| 지표 | 정의 | 산식 | 임계값 | 근거 | 한계 |
|---|---|---|---|---|---|
| 지역 평균 대비 할인율 | 착한가격 메뉴가 시도 평균 외식비보다 얼마나 싼가 | (지역평균 − 가격) / 지역평균 | 없음(분포로 봄) | 지정 기준이 '지역 평균 이하' | 시도 단위 평균입니다(지정은 시군구 기준일 수 있음). 비교 가능한 품목은 7~8개뿐 |
| 기준초과율 | 지역 평균보다 비싼 메뉴의 비율 | 가격 > 지역평균인 메뉴 수 / 비교 가능한 메뉴 수 | 1건이라도 있으면 재심사 대상 | 지정 제외 기준 | 조사 시점 차이(외식비는 월평균, 착한가격은 분기 스냅샷) |
| 입력오류 의심 | 비정상적으로 싼 가격 | 가격 < 지역평균 × 0.4 | 0.4 (EDA 후 조정) | '8000을 800으로' 같은 입력 실수 | 진짜 초저가 가게와 구분할 수 없어 사람이 확인해야 합니다 |
| 정보 완결성 점수 | 체크 5개 통과 비율 | 통과 개수 × 20 | 80점 미만 = 저품질 | 주소·메뉴·가격이 있어야 고객이 판단할 수 있음 | 연락처는 개인정보 제외 정책이라 뺐습니다 |
| 분류 불일치 | 등록 업종과 메뉴로 추정한 업종이 명백히 모순 | 키워드 규칙 | 없음 | 잘못된 업종이면 검색·필터에서 노출이 틀어짐 | 키워드 규칙이라 오탐이 있습니다 → 정밀도를 직접 측정합니다(Step 8) |
| 월 폐업 급증 | 직전 12개월 대비 이번 달 폐업 수 | (이번 달 − 12개월 평균) / 12개월 표준편차 | 3 이상 | 운영 KPI 이상 징후 | 지자체의 일괄 직권폐업 처리처럼 실제 폐업이 아닌 이벤트가 섞일 수 있습니다 |

### Step 7. 분석 쿼리 (6~9일차)

⚠️ 아래 쿼리는 실제 스키마를 흉내 낸 가짜 데이터로 실행을 확인했습니다. 실제 파일의 컬럼명과 값에 맞춰 고쳐야 할 수 있습니다.

**복사해서 붙여넣지 말고 직접 타이핑하세요.** 한 줄씩 "이 줄은 왜 있나"를 말할 수 있어야 합니다. 면접에서는 이력서에 쓴 것을 전부 묻습니다.

#### 7-1. 축1 가격 경쟁력 (`03_price.sql`)

```sql
-- 03_price.sql : 축1 가격 경쟁력
-- 왜: 착한가격업소의 지정 기준은 '지역 평균 가격 이하'. 등록된 가격이 실제로 지역 평균보다 싼지 = 카탈로그의 가격 경쟁력 모니터링과 같은 구조

-- (1) 메뉴 표준화 규칙: 자유 텍스트 메뉴명 → 외식비 대표 품목 (삼겹살은 조사 단위가 달라 제외)
CREATE OR REPLACE TABLE dim_menu_rule AS
SELECT * FROM (VALUES
  ('%김치찌개%', '김치찌개백반', 1), ('%김치찌게%', '김치찌개백반', 1),   -- 오타도 규칙으로 흡수
  ('%냉면%',     '냉면',   2),
  ('%비빔밥%',   '비빔밥', 3),
  ('%짜장%',     '자장면', 4), ('%자장%', '자장면', 4),
  ('%삼계탕%',   '삼계탕', 5),
  ('%칼국수%',   '칼국수', 6),
  ('%김밥%',     '김밥',   7)                                         -- '냉면김밥세트'처럼 둘 다 걸리면 숫자가 작은 규칙 1개만
) AS t(pattern, std_item, priority);

-- (2) 비등가 조인(LIKE로 JOIN) + ROW_NUMBER로 메뉴당 규칙 1개만 선택
CREATE OR REPLACE TABLE fct_menu_price AS
WITH matched AS (
    SELECT m.*, r.std_item,
           ROW_NUMBER() OVER (PARTITION BY m.store_key, m.menu_no ORDER BY r.priority) AS rn
    FROM stg_menu m
    JOIN dim_menu_rule r ON m.menu_name LIKE r.pattern
    WHERE m.price IS NOT NULL
      AND NOT (r.std_item = '자장면' AND m.menu_name LIKE '%밥%')     -- '짜장밥'은 자장면이 아님
)
SELECT mt.store_key, mt.sido, mt.sigungu, mt.category, mt.store_name, mt.menu_name, mt.std_item, mt.price,
       e.avg_price AS region_avg,
       ROUND(100.0 * (e.avg_price - mt.price) / e.avg_price, 1) AS discount_pct          -- +면 지역 평균보다 쌈
FROM matched mt
LEFT JOIN stg_eatout e
       ON e.sido = mt.sido AND e.item = mt.std_item
      AND e.month = DATE_TRUNC('month', mt.snapshot_date)
WHERE mt.rn = 1;

-- (3) 이상 탐지: 외부 벤치마크 대비 + 내부 분포 대비를 함께 본다
SELECT *,
    CASE WHEN region_avg IS NULL           THEN '벤치마크없음'
         WHEN price > region_avg           THEN '기준초과_재심사'      -- 지역 평균보다 비싼 '착한가격' 업소
         WHEN price < region_avg * 0.4     THEN '비정상저가_입력오류의심'  -- 8000을 800으로 입력하는 유형
         ELSE '정상' END AS price_flag,
    MEDIAN(price)  OVER w AS peer_median,
    COUNT(*)       OVER w AS peer_n,
    ROUND(PERCENT_RANK() OVER (PARTITION BY sido, std_item ORDER BY price), 2) AS peer_pct_rank
FROM fct_menu_price
WINDOW w AS (PARTITION BY sido, std_item)
QUALIFY price_flag <> '정상'
ORDER BY price_flag, discount_pct;
```

짚어 둘 점:
- `JOIN ... ON m.menu_name LIKE r.pattern`는 등호가 아닌 조건으로 조인하는 **비등가 조인**입니다. 한 메뉴가 규칙 여러 개에 걸리면 행이 늘어나므로 ROW_NUMBER로 1개만 남깁니다.
- `LEFT JOIN stg_eatout`: 벤치마크가 없는 메뉴도 버리지 않고 '벤치마크없음'으로 남깁니다. INNER JOIN이면 조용히 사라집니다. 면접 단골 질문 "INNER와 LEFT를 언제 쓰나요"의 실제 사례입니다.
- `MEDIAN`, `PERCENT_RANK OVER`: 외부 기준과 별개로 "같은 시도, 같은 품목의 착한가격업소들 사이에서 몇 번째로 비싼가"를 봅니다.
- `QUALIFY`는 윈도우 함수를 다 계산한 **뒤에** 거릅니다. 그래서 `peer_median`은 걸러지기 전 전체를 기준으로 계산됩니다.

#### 7-2. 축2 정보 완결성 (`04_completeness.sql`)

```sql
-- 04_completeness.sql : 축2 정보 완결성 (쿠팡이츠의 '이미지 품질'처럼 "보여줄 정보가 충분한가"를 대신 재는 축)
-- 주의: 연락처 공란은 원본 비고에 '개인정보로 제외'라고 명시 → 상점 잘못이 아니므로 품질 점수에서 뺀다
CREATE OR REPLACE TABLE fct_store_quality AS
WITH menu_stat AS (
    SELECT store_key,
           COUNT(*)                                            AS menu_cnt,
           SUM(CASE WHEN menu_name IS NULL OR menu_name = '' THEN 1 ELSE 0 END) AS menu_name_missing,
           SUM(CASE WHEN price_raw IS NULL OR trim(price_raw) = '' THEN 1 ELSE 0 END) AS price_missing,
           SUM(CASE WHEN NOT price_format_ok AND trim(coalesce(price_raw,'')) <> '' THEN 1 ELSE 0 END) AS price_format_err
    FROM stg_menu
    GROUP BY store_key
)
SELECT s.store_key, s.sido, s.sigungu, s.category, s.store_name,
       COUNT(*) OVER (PARTITION BY s.store_key) - 1           AS dup_cnt,        -- 중복 등록 건수
       coalesce(m.menu_cnt, 0)                                 AS menu_cnt,
       -- 체크 5개를 각각 0/1로 → 합계 = 통과 개수
       (CASE WHEN s.address IS NOT NULL                   THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.menu_cnt, 0) >= 1            THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.menu_name_missing, 1) = 0    THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.price_missing, 1) = 0        THEN 1 ELSE 0 END
      + CASE WHEN coalesce(m.price_format_err, 0) = 0     THEN 1 ELSE 0 END) * 20 AS completeness_score
FROM stg_store s
LEFT JOIN menu_stat m USING (store_key);          -- LEFT: 메뉴가 하나도 없는 상점도 0점으로 남겨야 하므로

-- 시군 단위 요약 + 개선 우선순위 (시도별 하위 3개 시군)
WITH by_region AS (
    SELECT sido, sigungu,
           COUNT(*)                                                    AS stores,
           ROUND(AVG(completeness_score), 1)                            AS avg_score,
           ROUND(100.0 * SUM(CASE WHEN completeness_score < 80 THEN 1 ELSE 0 END) / COUNT(*), 1) AS low_quality_pct
    FROM fct_store_quality
    GROUP BY sido, sigungu
    HAVING COUNT(*) >= 10                                              -- 표본이 너무 작은 지역은 순위에서 제외
)
SELECT *, RANK() OVER (PARTITION BY sido ORDER BY avg_score ASC) AS fix_priority
FROM by_region
QUALIFY fix_priority <= 3
ORDER BY sido, fix_priority;
```

#### 7-3. 축3 분류 정합성 (`05_category.sql`)

```sql
-- 05_category.sql : 축3 분류 정합성 — 메뉴로 추정한 업종 vs 등록 업종
WITH inferred AS (
    SELECT store_key, store_name, category, menu_name,
        CASE
            WHEN regexp_matches(menu_name, '아메리카노|라떼|커피') THEN '카페'
            WHEN regexp_matches(menu_name, '짜장|자장|짬뽕|탕수육') THEN '중식'
            WHEN regexp_matches(menu_name, '초밥|우동|돈까스|돈가스') THEN '일식'
            WHEN regexp_matches(menu_name, '파스타|스테이크|피자') THEN '양식'
            WHEN regexp_matches(menu_name, '커트|컷트|펌|염색') THEN '이미용'
        END AS inferred_cat
    FROM stg_menu
),
store_level AS (       -- 상점 단위로 모아서 "메뉴 과반이 가리키는 업종"을 추정 업종으로
    SELECT store_key, store_name, category, inferred_cat, COUNT(*) AS hits,
           STRING_AGG(menu_name, ', ') AS evidence
    FROM inferred
    WHERE inferred_cat IS NOT NULL
    GROUP BY store_key, store_name, category, inferred_cat
    QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key ORDER BY hits DESC) = 1
)
SELECT category AS registered, inferred_cat AS inferred, COUNT(*) AS stores,
       STRING_AGG(store_name || '(' || evidence || ')', ' / ') AS examples
FROM store_level
-- 등록 업종 체계와 추정 체계가 다르므로 '명백히 모순'인 조합만 이상으로 본다 (예: 한식인데 커피만, 이미용인데 음식)
WHERE (category = '한식'     AND inferred_cat IN ('카페', '이미용'))
   OR (category = '중식'     AND inferred_cat IN ('카페', '일식', '이미용'))
   OR (category = '이미용업' AND inferred_cat <> '이미용')
GROUP BY 1, 2
ORDER BY stores DESC;
```

등록 업종 체계(한식, 중식, …, 기타 요식업)와 추정 체계가 다릅니다. 예를 들어 '기타 요식업'인데 커피를 파는 건 정상일 수 있습니다. 그래서 명백히 모순되는 조합만 이상으로 봅니다. 실제 업종 이름은 [Step 5](#step-5-탐색-5일차-오전)의 Q2 결과를 보고 WHERE 조건을 고치세요.

#### 7-4. ★ 시계열과 LAG (`06_timeseries.sql`)

```sql
-- 06_timeseries.sql : ★ LAG — 월별 시계열이 있는 곳에서 쓴다 (2개 시점 비교는 JOIN이 더 자연스럽다)

-- (A) 외식비: 시도 x 품목별 전월 대비(MoM) / 전년 동월 대비(YoY)
WITH t AS (
    SELECT sido, item, month, avg_price,
           LAG(avg_price, 1)  OVER (PARTITION BY sido, item ORDER BY month) AS prev_month,
           LAG(avg_price, 12) OVER (PARTITION BY sido, item ORDER BY month) AS prev_year
    FROM stg_eatout
)
SELECT sido, item, month, avg_price,
       ROUND(100.0 * (avg_price - prev_month) / prev_month, 1) AS mom_pct,
       ROUND(100.0 * (avg_price - prev_year)  / prev_year, 1)  AS yoy_pct,
       -- 같은 품목의 전국(=모든 시도) YoY 중앙값과의 차이. +5%p 이상이면 '급등 지역'으로 본다 (여기서는 정렬만)
       ROUND(100.0 * (avg_price - prev_year) / prev_year
             - MEDIAN(100.0 * (avg_price - prev_year) / prev_year) OVER (PARTITION BY item, month), 1) AS yoy_gap_vs_nation
FROM t
WHERE month = (SELECT MAX(month) FROM stg_eatout)
ORDER BY yoy_gap_vs_nation DESC
LIMIT 10;
```

`LAG(avg_price, 12)`는 12행 전 값입니다. 달마다 빠짐없이 행이 있어야 "12개월 전"과 같아집니다. 외식비 데이터에 빠진 달이 있으면 [7-5](#7-5-확장-일반음식점-월별-개업폐업-kpi-07_restaurantsql)의 날짜 뼈대 방식으로 채우세요.

#### 7-5. 확장: 일반음식점 월별 개업·폐업 KPI (`07_restaurant.sql`)

```sql
-- 07_restaurant.sql : 일반음식점 인허가 = '전체 공급(입점) 풀'. 월별 개업/폐업 KPI + 이상 징후 탐지
CREATE OR REPLACE TABLE raw_restaurant AS
SELECT * FROM read_csv('data/restaurant_license.csv', all_varchar = true);

CREATE OR REPLACE TABLE stg_restaurant AS
SELECT 관리번호 AS license_id,
       -- 날짜가 '20240131' 또는 '2024-01-31' 어느 쪽으로 와도 읽히게
       coalesce(TRY_CAST(인허가일자 AS DATE), CAST(TRY_STRPTIME(인허가일자, '%Y%m%d') AS DATE)) AS open_date,
       coalesce(TRY_CAST(폐업일자  AS DATE), CAST(TRY_STRPTIME(폐업일자,  '%Y%m%d') AS DATE)) AS close_date,
       영업상태명 AS status, 사업장명 AS name, 업태구분명 AS biz_type,
       nullif(trim(소재지전화), '')     AS phone,
       nullif(trim(도로명전체주소), '') AS road_addr,
       TRY_CAST("좌표정보x(epsg5174)" AS DOUBLE) AS x,
       TRY_CAST("좌표정보y(epsg5174)" AS DOUBLE) AS y
FROM raw_restaurant;

-- (A) 월별 개업·폐업 수 → LAG로 전월비, 이동평균·이동표준편차로 이상 월 탐지
WITH months AS (      -- 날짜 뼈대: 개업/폐업이 0건인 달도 행이 있어야 LAG가 '바로 전 달'을 가리킨다
    SELECT CAST(range AS DATE) AS month
    FROM range(DATE '2019-01-01', DATE '2026-09-01', INTERVAL 1 MONTH)
),
opens  AS (SELECT DATE_TRUNC('month', open_date)  AS month, COUNT(*) AS n FROM stg_restaurant GROUP BY 1),
closes AS (SELECT DATE_TRUNC('month', close_date) AS month, COUNT(*) AS n FROM stg_restaurant WHERE close_date IS NOT NULL GROUP BY 1),
kpi AS (
    SELECT m.month,
           coalesce(o.n, 0) AS opened,
           coalesce(c.n, 0) AS closed
    FROM months m
    LEFT JOIN opens  o ON o.month = m.month
    LEFT JOIN closes c ON c.month = m.month
),
scored AS (
    SELECT *,
        LAG(closed) OVER (ORDER BY month) AS closed_prev,
        AVG(closed)    OVER (ORDER BY month ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING) AS closed_ma12,   -- 직전 12개월(이번 달 제외)
        STDDEV(closed) OVER (ORDER BY month ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING) AS closed_sd12
    FROM kpi
)
SELECT month, opened, closed, closed_prev,
       ROUND(100.0 * (closed - closed_prev) / NULLIF(closed_prev, 0), 1) AS closed_mom_pct,
       ROUND((closed - closed_ma12) / NULLIF(closed_sd12, 0), 2)          AS closed_z,
       CASE WHEN (closed - closed_ma12) / NULLIF(closed_sd12, 0) >= 3 THEN '폐업급증_원인분석' END AS alert
FROM scored
WHERE month >= DATE '2020-01-01'
ORDER BY closed_z DESC NULLS LAST
LIMIT 5;

-- (B) 레코드 품질 검사 (대용량 완결성·논리 정합성)
SELECT COUNT(*) AS total,
    ROUND(100.0 * AVG(CASE WHEN phone IS NULL     THEN 1 ELSE 0 END), 1) AS phone_missing_pct,
    ROUND(100.0 * AVG(CASE WHEN road_addr IS NULL THEN 1 ELSE 0 END), 1) AS road_addr_missing_pct,
    ROUND(100.0 * AVG(CASE WHEN x IS NULL OR y IS NULL THEN 1 ELSE 0 END), 1) AS coord_missing_pct,
    SUM(CASE WHEN status LIKE '%폐업%' AND close_date IS NULL THEN 1 ELSE 0 END) AS closed_but_no_date,  -- 상태와 날짜가 모순
    SUM(CASE WHEN close_date < open_date                   THEN 1 ELSE 0 END) AS close_before_open,
    SUM(CASE WHEN biz_type = '한식' AND regexp_matches(name, '커피|카페') THEN 1 ELSE 0 END) AS type_name_conflict
FROM stg_restaurant;
```

짚어 둘 점:
- **날짜 뼈대(`months`)**: 폐업이 0건인 달이 행으로 없으면 LAG가 '바로 전 달'이 아니라 '데이터가 있는 직전 달'을 가리킵니다. 시계열 LAG에서 가장 흔한 실수입니다.
- **`ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING`**: 이번 달을 뺀 직전 12개월입니다. 이번 달을 포함하면 급증한 값이 평균과 표준편차를 끌어올려 스스로를 가립니다.
- 실제 데이터에서 급증한 달이 나오면 원인까지 파 보세요. 특정 시군구에 몰려 있는지, 지자체가 일괄로 직권폐업을 처리한 것인지 확인합니다. 이것이 JD 3번 "원인 분석" 사례가 됩니다.
- 200만 행이 넘으므로 처음에는 `WHERE` 조건으로 한 시도만 잘라서 실행해 보고, 쿼리가 맞으면 전체로 넓히세요.

#### 7-6. 10/30 이후: 스냅샷 비교 (`08_snapshot_diff.sql`)

```sql
-- 08_snapshot_diff.sql : 두 분기 스냅샷 비교 (신규 등록 / 해제 / 가격 변경)
-- 다음 분기 파일(20260930)이 공개되면 00_load와 01_staging을 한 번 더 돌려 stg_store_prev / stg_store로 만든 뒤 실행
WITH prev AS (SELECT * FROM stg_store_prev QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key) = 1),
     curr AS (SELECT * FROM stg_store      QUALIFY ROW_NUMBER() OVER (PARTITION BY store_key) = 1)
SELECT
    CASE WHEN p.store_key IS NULL THEN '신규등록'
         WHEN c.store_key IS NULL THEN '지정해제'
         WHEN p.가격1 IS DISTINCT FROM c.가격1 THEN '가격변경'
         ELSE '유지' END AS change_type,
    COUNT(*) AS stores
FROM prev p
FULL OUTER JOIN curr c ON p.store_key = c.store_key      -- 양쪽 어디에만 있는 상점도 모두 남긴다
GROUP BY 1
ORDER BY 2 DESC;
```

진행 순서: 첫 분기 정제가 끝나면 `CREATE TABLE stg_store_prev AS SELECT * FROM stg_store;`로 따로 보관합니다. 그다음 새 파일로 00, 01을 다시 실행합니다(파일명과 날짜 두 곳을 바꿈).

신규 목록만 뽑는 차집합 버전(LEFT JOIN + IS NULL)도 알아 두세요.

```sql
SELECT c.* FROM stg_store c
LEFT JOIN stg_store_prev p ON c.store_key = p.store_key
WHERE p.store_key IS NULL;
```

#### 7-7. 면접용: DuckDB 문법 → 다른 DB 변환표

쿠팡 SQL 평가는 HackerRank로 볼 가능성이 높고, HackerRank는 MySQL이나 Oracle 등을 씁니다. 프로젝트는 DuckDB로 편하게 쓰되 아래 차이는 알고 가세요.

| DuckDB (이 프로젝트) | MySQL 8 | PostgreSQL |
|---|---|---|
| `QUALIFY rn = 1` | 서브쿼리로 감싸고 `WHERE rn = 1` | 서브쿼리로 감싸고 `WHERE rn = 1` |
| `MEDIAN(x)` | 없음 (직접 계산) | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)` (집계로만 가능, 윈도우 불가) |
| `regexp_matches(s, '커피')` | `s REGEXP '커피'` | `s ~ '커피'` |
| `STRING_AGG(s, ', ')` | `GROUP_CONCAT(s SEPARATOR ', ')` | `STRING_AGG(s, ', ')` |
| `DATE_TRUNC('month', d)` | `DATE_FORMAT(d, '%Y-%m-01')` | `DATE_TRUNC('month', d)` |
| `TRY_CAST(x AS INTEGER)` | 없음 (CAST 실패 시 0과 경고) | 없음 (CAST 실패 시 오류) |
| LAG, LEAD, ROW_NUMBER, RANK, SUM() OVER | 동일 | 동일 |

### Step 8. 검증 (9일차): 숫자를 믿을 수 있게

1. **행 수 보존**: raw → stg → fct 단계마다 행 수를 기록합니다. 줄었다면 이유를 설명할 수 있어야 합니다.
2. **샘플을 직접 검수해 정밀도를 잽니다.** '기준초과', '입력오류 의심', '분류 불일치'에서 각각 무작위로 30~50건을 뽑아 직접 확인합니다(`SELECT * FROM fct_menu_price USING SAMPLE 50;`). 결과는 "탐지 N건 중 실제 문제 M건, 정밀도 X%"로 적습니다. 탐지 로직을 검증했다는 증거라서 이력서에서 가장 강한 한 줄이 됩니다.
3. **임계값 민감도**: 0.4를 0.3이나 0.5로 바꿨을 때 탐지 건수가 어떻게 변하는지 표로 남깁니다.
4. **수작업 시간 측정** (자동화 효과용): 엑셀로 100건을 직접 검수하는 데 걸린 시간을 재고 전체 건수로 환산합니다. README에 "추정"이라고 밝히고 계산식을 남기세요. 면접에서 "N시간은 어떻게 나온 숫자인가요?"라고 반드시 묻습니다.

### Step 9. 자동화와 Claude 리포트 (10일차)

`run_monitor.py` (가짜 데이터로 SQL 부분까지 실행 확인):

```python
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
```

- 먼저 `python run_monitor.py --no-llm`으로 SQL 부분만 돌려 확인하고, 그다음 API 키를 넣고 실행하세요.
- API 키는 console.anthropic.com에서 발급합니다. `export ANTHROPIC_API_KEY=...`(Windows는 `set ANTHROPIC_API_KEY=...`)로 설정하고, **코드나 git에는 절대 넣지 마세요.**
- `fallbacks="default"`는 요청이 안전 필터에 걸려 거절됐을 때 서버가 다른 모델로 자동 재시도하는 옵션입니다. 필요 없다고 판단되면 빼도 됩니다.
- 프롬프트의 "표에 없는 숫자는 만들지 마세요"는 LLM이 숫자를 지어내는 것을 막기 위한 문장입니다. 생성된 요약의 숫자를 원본 표와 대조해 확인한 과정을 README에 기록하세요. 면접 질문 "AI 도구의 한계를 느낀 적이 있나요?"의 답 소재가 됩니다.

### Step 10. 대시보드 1장 (11일차)

DuckDB에서 CSV로 내보내기:

```sql
COPY (SELECT * FROM fct_menu_price)    TO 'reports/fct_menu_price.csv'    (HEADER);
COPY (SELECT * FROM fct_store_quality) TO 'reports/fct_store_quality.csv' (HEADER);
```

Tableau Public(무료) 한 장 구성:
- 상단 KPI 타일 4개: 전체 상점 수, 기준초과율, 저품질(80점 미만) 비율, 분류 불일치 건수
- 시도별 기준초과율 막대그래프
- 품목별 지역 평균 대비 할인율 분포
- (확장) 월별 폐업 수 추이선과 급증 월 표시
- 이상 상점 목록 표 (필터: 시도, 이상 유형)

### Step 11. README, 이력서, 면접 준비 (12~14일차)

**README 목차**
1. 문제 정의: 착한가격업소는 가격 기준으로 인증된 상점 목록이고, 등록 조건을 계속 지키는지 감시한다
2. 데이터: 3종, 규모, 기준일, 한계(연락처 정책, 시도 단위 벤치마크, 좌표 없음)
3. 지표 정의서 ([Step 6](#step-6-지표-정의서-5일차-오후) 표)
4. 파이프라인 구조 (raw → stg → fct → report)
5. 발견 사항: 숫자 3~5개와 조치 제안
6. 검증: 정밀도, 임계값 민감도
7. 자동화: 실행 시간, 리포트 예시
8. 한계와 다음 단계

**이력서 문구 (수정본, 「」는 실제 결과로 채움)**

```
### 착한가격업소 카탈로그 품질 모니터링: 지표 설계·이상 탐지·리포트 자동화
`SQL` `이상 징후 탐지` `업무 자동화`
- 착한가격업소 12,645건과 시도별 외식비 벤치마크를 DuckDB에 적재하고, 가격 경쟁력·정보 완결성·
  분류 정합성 3개 축의 품질 지표를 SQL로 정의해 지표 정의서로 문서화
- 지정 기준(지역 평균가 이하)을 벤치마크와 대조해 기준 초과 의심 「N」건, 입력 오류 의심 「N」건 탐지,
  샘플 검수로 정밀도 「N」% 확인
- 일반음식점 인허가 「N」만 건으로 월별 개업·폐업 KPI를 구성하고, LAG와 이동 통계로 폐업 급증 월을
  탐지해 원인을 「…」로 특정
- SQL 실행 → 이상 목록 → Claude API 요약 리포트까지 자동화, 수작업 추정 「N」시간 → 「N」분
- Stack: DuckDB(SQL), Python, Claude API, Tableau Public
```

**예상 꼬리질문** (이번 점검에서 나온 쟁점들입니다. 답을 미리 준비하세요)

| 질문 | 답의 뼈대 |
|---|---|
| 착한가격업소는 원래 싼 가게만 모은 건데, 가격 경쟁력 분석이 의미가 있나요? | 그래서 내부끼리 비교하지 않고 외부 벤치마크(시도별 외식비)와 비교했다. 목적은 '지정 기준을 계속 지키는가' 모니터링이다 |
| 왜 z-score를 쓰지 않았나요? | 그룹 표본이 작다(대부분 5개 미만). n=5면 z 절댓값의 이론상 최대가 1.79라서 2 기준으로는 절대 잡히지 않는다. 가격 분포도 한쪽으로 치우쳐 있다 |
| 연락처 결측률은 왜 품질 지표에서 뺐나요? | 원본 비고에 개인정보 제외 정책이라고 명시돼 있다. 상점이 아니라 데이터 제공자의 정책이다. 지표에는 '상점이 고칠 수 있는 것'만 넣었다 |
| 두 시점 비교에 LAG 대신 JOIN을 쓴 이유는? | 시점이 2개면 JOIN이 의도를 더 잘 드러내고, FULL OUTER JOIN 한 번으로 신규·해제·변경을 동시에 나눌 수 있다. LAG는 월별 시계열에 썼다 |
| 날짜 뼈대 테이블은 왜 만들었나요? | 0건인 달이 행으로 없으면 LAG가 엉뚱한 달과 비교한다 |
| 분류 불일치 규칙이 틀릴 수도 있지 않나요? | 맞다. 그래서 샘플 N건을 직접 확인해 정밀도 X%를 측정했고, 오탐 유형은 ~였다 |
| AI 요약을 어떻게 믿나요? | 숫자는 SQL 결과만 쓰도록 지시했고, 요약에 나온 숫자를 원본 표와 대조해 검증했다 |
| 가격 비교 조인을 INNER JOIN으로 했다면 결과가 어떻게 달라지나요? | 벤치마크가 없는 메뉴가 조용히 사라져서 기준초과율의 분모가 바뀐다 |

**연습**: 작성한 쿼리를 전부 소리 내어 설명해 보세요. 1차 면접에서 라이브 SQL을 볼 때 말없이 치기만 하면 감점입니다. 휴대폰으로 녹화해서 확인하는 걸 권합니다.

---

## 5. 일정표 (약 2주)

| 일차 | 할 일 | 산출물 |
|---|---|---|
| 1~3 | SQL 기초 (Step 1) | 연습 문제 풀이 |
| 4 | 환경 세팅, 데이터 받기, 적재, 정제 | `00_load.sql`, `01_staging.sql` |
| 5 | 탐색, 지표 정의서 | `02_eda.sql`, 지표 정의서 |
| 6 | 축1 가격 경쟁력 | `03_price.sql` |
| 7 | 축2 정보 완결성, 축3 분류 정합성 | `04_completeness.sql`, `05_category.sql` |
| 8 | 발견 사항 정리 → **이력서 반영, 지원** | 이력서 |
| 9 | 시계열, 일반음식점, 검증 | `06_timeseries.sql`, `07_restaurant.sql`, 정밀도 |
| 10 | 자동화와 Claude 리포트 | `run_monitor.py`, 샘플 리포트 |
| 11 | 대시보드 | Tableau Public 링크 |
| 12~13 | README 작성, 쿼리 설명 연습, 변환표 연습 | README |
| 14 | 예비일 | |
| 10/30 이후 | 20260930 파일로 스냅샷 비교 추가 | `08_snapshot_diff.sql`, 면접 소재 "지원 후 업데이트" |

---

## 참고 링크

- [행정안전부_착한가격업소 현황 (공공데이터포털)](https://www.data.go.kr/data/3045247/fileData.do)
- [소상공인시장진흥공단_상가(상권)정보 (공공데이터포털)](https://www.data.go.kr/data/15083033/fileData.do)
- [행정안전부_일반음식점 (공공데이터포털)](https://www.data.go.kr/data/15045016/fileData.do)
- [전국일반음식점표준데이터 (공공데이터포털)](https://www.data.go.kr/data/15096283/standard.do)
- [한국소비자원 참가격 외식비](https://www.price.go.kr/tprice/portal/servicepriceinfo/dineoutprice/dineOutPriceList.do)
- [행정안전부 지방물가정보 외식비](https://www.mois.go.kr/frt/sub/a02/eatOutPriceList/screen.do)
- [착한가격업소 선정기준 예시 (대전 서구청)](https://www.seogu.go.kr/kor/sub06_09_01_02.do)
- [행안부, 지방행정 인허가 데이터 공공데이터포털로 통합 개방 (ZDNet)](https://zdnet.co.kr/view/?no=20260125144854)
