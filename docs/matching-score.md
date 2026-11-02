# Supplier matching score

The score is calculated in `src/server/matching.ts`. Listing, supplier profiles, and comparison all call `matchSuppliers`. Weights live only in `defaultMatchWeights`.

## Weights

| Criterion | Default weight |
| --- | --- |
| Product or category | 0.35 |
| Geography | 0.25 |
| Price | 0.15 |
| Minimum order | 0.10 |
| Certifications | 0.10 |
| Delivery | 0.05 |

`resolveMatchWeights` rejects negative or non-finite weights, rejects an all-zero set, and divides the remaining weights so they sum to 1. Pass an override on `MatchContext.weights` to change a calculation without editing the defaults.

## Formula

A criterion is **applicable** when its weight is above zero and it was not left as “not requested”.

A criterion is **scored** when a ratio from 0 to 1 can be calculated. Exact is 1, partial is between 0 and 1, and a mismatch is 0.

Missing and non-comparable facts stay applicable. They add no points and are shown as unavailable. They are not mismatches. Because their weight stays in the denominator, a thin record cannot score 100.

```
earned   = Σ (ratio × weight) for scored criteria
possible = Σ weight for applicable criteria
score    = round(earned / possible × 100)
coverage = scored weight / possible
```

The score is null when nothing applicable can be scored. Integer points on each scored criterion sum to the score. Unscored criteria have no points.

Quality uses that result:

- strong: score at least 75 and coverage at least 0.60
- partial: score at least 45
- weak: any lower scored result
- unavailable: no score

The score is not a measure of supplier quality. `doesNotGuaranteeBestSupplier` is always true.

## How each criterion is judged

Product: the requested category is an exact match or a mismatch. With no category, search text in a product or category name is exact. A match only in the supplier name is partial (0.55). With neither a category nor text, suppliers who share a category with another supplier in the same set are exact.

Geography: the same requested city or region is exact. One of two requested places is partial (0.60). A different recorded place is a mismatch. A requested place with no recorded city or region is unavailable.

Price and MOQ: only finite amounts of zero or more are used. `кг` and `kg` are the same unit, as are the other aliases in `unitAliases`. Lower is better inside one currency and unit, scaled from the minimum to the maximum of that peer group. A different unit is not comparable. A negative, infinite, or missing amount is unavailable. When the search sets a maximum and there is no peer group, a value above the maximum is a mismatch. A value within the maximum scores 0.50 at the limit and 1 at zero.

Certifications: only a real supplier's certificate that is both verified and still current (valid or expiring soon) is exact. An expired, suspended, or revoked certificate, or evidence that was rejected, is a mismatch and scores zero. Unverified, pending, and unknown certificates stay unavailable: they are not confirmed and they are not treated as a failed check. Asking the search for certification records does not turn an unverified claim into a partial match. No records, and every demonstration certificate, are unavailable. A verified certificate that has since expired is not current.

Delivery: text that names the requested city or region scores as a statement, not as a verified promise. Text that does not name that place is a mismatch. No text is unavailable. Text with no requested place is not requested.

## Where it is recalculated

`searchSuppliers` scores the full filtered set, so price and category comparisons use the same peers as the filter. Sort `match` orders that set by score, then coverage, then name, and then paginates. Other sorts keep their existing order and still attach the breakdown when the search has a requirement.

A supplier profile uses the same filtered set as the catalog. Requirements in the profile URL select that set. With no search, price, minimum order, and category are compared with the active catalog, which is the same calculation as sorting the catalog by matching score. A profile does not reuse the comparison cookie, because that score is only among the selected suppliers. Changing the search or the stored supplier facts changes the next calculation. Nothing is cached as a saved score.
