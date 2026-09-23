# data/ — 원본 CSV를 여기에 둡니다 (git에는 올라가지 않음)

| 파일명 | 출처 | 비고 |
|---|---|---|
| `good_price_20260630.csv` | [행정안전부_착한가격업소 현황](https://www.data.go.kr/data/3045247/fileData.do) | 한글이 깨지면 `00_load.sql`의 `encoding` 옵션 조정 |
| `eatout_price.csv` | [참가격 외식비](https://www.price.go.kr/tprice/portal/servicepriceinfo/dineoutprice/dineOutPriceList.do) 또는 [행안부 지방물가정보](https://www.mois.go.kr/frt/sub/a02/eatOutPriceList/screen.do) | 아래 형식으로 저장 |
| `restaurant_license.csv` | [행정안전부_일반음식점](https://www.data.go.kr/data/15045016/fileData.do) | 확장용. 컬럼명 확인 후 `07_restaurant.sql` 수정 |

`eatout_price.csv` 형식 (숫자는 예시):

```
기준월,시도,품목,평균가격
2026-06,서울,김치찌개백반,9000
2026-06,서울,자장면,7500
```
