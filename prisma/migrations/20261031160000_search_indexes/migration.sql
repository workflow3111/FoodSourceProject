-- Btree indexes for the filters used by supplier search.
CREATE INDEX "Supplier_isActive_city_idx" ON "Supplier"("isActive", "city");
CREATE INDEX "Supplier_isActive_region_idx" ON "Supplier"("isActive", "region");
CREATE INDEX "SupplierProduct_minimumOrderQuantity_idx" ON "SupplierProduct"("minimumOrderQuantity");

-- Trigram indexes for Cyrillic contains-search. ё is folded to е in the same expression the query uses.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Supplier_name_search_trgm_idx"
  ON "Supplier" USING gin ((translate(lower("name"), 'ё', 'е')) gin_trgm_ops);

CREATE INDEX "Supplier_city_search_trgm_idx"
  ON "Supplier" USING gin ((translate(lower("city"), 'ё', 'е')) gin_trgm_ops);

CREATE INDEX "Supplier_region_search_trgm_idx"
  ON "Supplier" USING gin ((translate(lower("region"), 'ё', 'е')) gin_trgm_ops);

CREATE INDEX "SupplierProduct_name_search_trgm_idx"
  ON "SupplierProduct" USING gin ((translate(lower("name"), 'ё', 'е')) gin_trgm_ops);

CREATE INDEX "Category_nameRu_search_trgm_idx"
  ON "Category" USING gin ((translate(lower("nameRu"), 'ё', 'е')) gin_trgm_ops);

CREATE INDEX "Category_nameEn_search_trgm_idx"
  ON "Category" USING gin ((translate(lower("nameEn"), 'ё', 'е')) gin_trgm_ops);
