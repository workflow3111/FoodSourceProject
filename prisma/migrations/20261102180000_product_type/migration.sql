-- Classify every existing product. Categories are unchanged.

CREATE TYPE "ProductType" AS ENUM ('INGREDIENTS', 'FINISHED_PRODUCTS', 'PACKAGING', 'OTHER_FOOD_RELATED_GOODS');

ALTER TABLE "SupplierProduct" ADD COLUMN "productType" "ProductType";

UPDATE "SupplierProduct" SET "productType" = CASE "name"
  WHEN 'Тушка цыплёнка-бройлера' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Филе грудки' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Говядина лопатка' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Свинина окорок' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Говядина охлаждённая' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Фарш говяжий замороженный' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Креветка 16/20' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Форель потрошёная' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Минтай филе' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Минтай тушка' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Томаты розовые' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Огурцы гладкие' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Салат айсберг' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Зелень ассорти' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Яблоки сезонные' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Картофель мытый' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Клубника' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Клубника замороженная' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Молоко 3,2%' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Сметана 20%' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Творог 5%' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Масло сливочное 82,5%' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Рис круглозёрный' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Мука пшеничная высший сорт' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Масло подсолнечное' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Овощная смесь' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Говядина' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Свинина' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Птица' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Замороженные овощи' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Курица' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Индейка' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Мытые салаты' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Морковь' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Капуста' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Свёкла' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Овощи для HoReCa' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Подсолнечное масло' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Молоко' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Минтай' THEN 'INGREDIENTS'::"ProductType"
  WHEN 'Колбаса варёная' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Сосиски молочные' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Лосось слабосолёный' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Рыбные котлеты' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Сыр полутвёрдый' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Кефир 1%' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Картофель фри' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Вода негазированная 19 л' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Сок яблочный 1 л' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Полуфабрикаты' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Майонез' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Кетчуп' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Маргарины' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Квас' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Пиво' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Соки' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Лимонад' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Вода' THEN 'FINISHED_PRODUCTS'::"ProductType"
  WHEN 'Контейнер ПЭТ 500 мл' THEN 'PACKAGING'::"ProductType"
  WHEN 'Пакет бумажный' THEN 'PACKAGING'::"ProductType"
  WHEN 'Гофрокартон' THEN 'PACKAGING'::"ProductType"
  WHEN 'Гибкая упаковка' THEN 'PACKAGING'::"ProductType"
  WHEN 'Корма' THEN 'OTHER_FOOD_RELATED_GOODS'::"ProductType"
  ELSE NULL
END;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "SupplierProduct" WHERE "productType" IS NULL) THEN
    RAISE EXCEPTION 'Unclassified supplier products remain';
  END IF;
END $$;

ALTER TABLE "SupplierProduct" ALTER COLUMN "productType" SET NOT NULL;
CREATE INDEX "SupplierProduct_productType_idx" ON "SupplierProduct"("productType");
CREATE INDEX "SupplierProduct_supplierId_productType_idx" ON "SupplierProduct"("supplierId", "productType");
