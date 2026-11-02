export const productTypes = [
  "INGREDIENTS",
  "FINISHED_PRODUCTS",
  "PACKAGING",
  "OTHER_FOOD_RELATED_GOODS",
] as const;

export type ProductType = (typeof productTypes)[number];

export function isProductType(value: string): value is ProductType {
  return productTypes.some((type) => type === value);
}

/**
 * One primary type for each recorded product name.
 * Categories stay separate: flour and cheese can share a grocery or dairy category
 * while belonging to different product types.
 */
export const classifiedProducts = {
  "Тушка цыплёнка-бройлера": "INGREDIENTS",
  "Филе грудки": "INGREDIENTS",
  "Говядина лопатка": "INGREDIENTS",
  "Свинина окорок": "INGREDIENTS",
  "Говядина охлаждённая": "INGREDIENTS",
  "Фарш говяжий замороженный": "INGREDIENTS",
  "Креветка 16/20": "INGREDIENTS",
  "Форель потрошёная": "INGREDIENTS",
  "Минтай филе": "INGREDIENTS",
  "Минтай тушка": "INGREDIENTS",
  "Томаты розовые": "INGREDIENTS",
  "Огурцы гладкие": "INGREDIENTS",
  "Салат айсберг": "INGREDIENTS",
  "Зелень ассорти": "INGREDIENTS",
  "Яблоки сезонные": "INGREDIENTS",
  "Картофель мытый": "INGREDIENTS",
  "Клубника": "INGREDIENTS",
  "Клубника замороженная": "INGREDIENTS",
  "Молоко 3,2%": "INGREDIENTS",
  "Сметана 20%": "INGREDIENTS",
  "Творог 5%": "INGREDIENTS",
  "Масло сливочное 82,5%": "INGREDIENTS",
  "Рис круглозёрный": "INGREDIENTS",
  "Мука пшеничная высший сорт": "INGREDIENTS",
  "Масло подсолнечное": "INGREDIENTS",
  "Овощная смесь": "INGREDIENTS",
  "Говядина": "INGREDIENTS",
  "Свинина": "INGREDIENTS",
  "Птица": "INGREDIENTS",
  "Замороженные овощи": "INGREDIENTS",
  "Курица": "INGREDIENTS",
  "Индейка": "INGREDIENTS",
  "Мытые салаты": "INGREDIENTS",
  "Морковь": "INGREDIENTS",
  "Капуста": "INGREDIENTS",
  "Свёкла": "INGREDIENTS",
  "Овощи для HoReCa": "INGREDIENTS",
  "Подсолнечное масло": "INGREDIENTS",
  "Молоко": "INGREDIENTS",
  "Минтай": "INGREDIENTS",
  "Колбаса варёная": "FINISHED_PRODUCTS",
  "Сосиски молочные": "FINISHED_PRODUCTS",
  "Лосось слабосолёный": "FINISHED_PRODUCTS",
  "Рыбные котлеты": "FINISHED_PRODUCTS",
  "Сыр полутвёрдый": "FINISHED_PRODUCTS",
  "Кефир 1%": "FINISHED_PRODUCTS",
  "Картофель фри": "FINISHED_PRODUCTS",
  "Вода негазированная 19 л": "FINISHED_PRODUCTS",
  "Сок яблочный 1 л": "FINISHED_PRODUCTS",
  "Полуфабрикаты": "FINISHED_PRODUCTS",
  "Майонез": "FINISHED_PRODUCTS",
  "Кетчуп": "FINISHED_PRODUCTS",
  "Маргарины": "FINISHED_PRODUCTS",
  "Квас": "FINISHED_PRODUCTS",
  "Пиво": "FINISHED_PRODUCTS",
  "Соки": "FINISHED_PRODUCTS",
  "Лимонад": "FINISHED_PRODUCTS",
  "Вода": "FINISHED_PRODUCTS",
  "Контейнер ПЭТ 500 мл": "PACKAGING",
  "Пакет бумажный": "PACKAGING",
  "Гофрокартон": "PACKAGING",
  "Гибкая упаковка": "PACKAGING",
  "Корма": "OTHER_FOOD_RELATED_GOODS",
} as const satisfies Record<string, ProductType>;

export function productTypeForName(name: string): ProductType {
  const type = classifiedProducts[name as keyof typeof classifiedProducts];
  if (!type) {
    throw new Error(`Unclassified product: ${name}`);
  }
  return type;
}
