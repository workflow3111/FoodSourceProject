import assert from "node:assert/strict";
import { suppliers } from "../../prisma/seed";
import { parseDiscoveryQuery, toSearchParams } from "./discovery-query";
import { classifiedProducts, isProductType, productTypeForName, productTypes } from "./product-type";

const counts = Object.fromEntries(productTypes.map((type) => [type, 0])) as Record<(typeof productTypes)[number], number>;
for (const type of Object.values(classifiedProducts)) counts[type] += 1;
for (const type of productTypes) assert.ok(counts[type] > 0, type);

for (const supplier of suppliers) {
  for (const product of supplier.products) {
    assert.equal(isProductType(productTypeForName(product.name)), true);
  }
}

assert.equal(productTypeForName("Мука пшеничная высший сорт"), "INGREDIENTS");
assert.equal(productTypeForName("Сыр полутвёрдый"), "FINISHED_PRODUCTS");
assert.equal(productTypeForName("Контейнер ПЭТ 500 мл"), "PACKAGING");
assert.equal(productTypeForName("Корма"), "OTHER_FOOD_RELATED_GOODS");
assert.throws(() => productTypeForName("Неизвестный продукт"));

const query = parseDiscoveryQuery({ productType: "PACKAGING", category: "packaging" });
assert.equal(query.productType, "PACKAGING");
assert.equal(query.category, "packaging");
assert.equal(parseDiscoveryQuery({ productType: "BANANA" }).productType, "");
assert.equal(toSearchParams(query).get("productType"), "PACKAGING");

const demoCounts = Object.fromEntries(productTypes.map((type) => [type, 0])) as Record<(typeof productTypes)[number], number>;
for (const supplier of suppliers) {
  for (const product of supplier.products) demoCounts[productTypeForName(product.name)] += 1;
}
assert.equal(demoCounts.INGREDIENTS, 26);
assert.equal(demoCounts.FINISHED_PRODUCTS, 9);
assert.equal(demoCounts.PACKAGING, 2);
assert.equal(demoCounts.OTHER_FOOD_RELATED_GOODS, 0);

console.log("product type checks passed");
