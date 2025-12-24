/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // purchase — это одна из записей в поле items из чека в data.purchase_records
   // _product — это продукт из коллекции data.products
   const { discount, sale_price, quantity } = purchase;
   
   // Записываем в константу discount коэффициент для расчета суммы без скидки в десятичном формате
   const discountCoefficient = 1 - (discount / 100);
   
   // Возвращаем выручку: sale_price × quantity × discountCoefficient
   return sale_price * quantity * discountCoefficient;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // 15% — для продавца, который принёс наибольшую прибыль (первое место, index === 0)
    if (index === 0) {
        return 0.15;
    } 
    // 10% — для продавцов, которые оказались на втором и третьем месте по прибыли
    else if (index === 1 || index === 2) {
        return 0.10;
    } 
    // 0% — для продавца, который оказался на последнем месте
    else if (index === total - 1) {
        return 0;
    } 
    // 5% — для всех остальных продавцов
    else {
        return 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    if (!data
        || !data.purchase_records
        || !Array.isArray(data.purchase_records)
        || data.purchase_records.length === 0) {
        throw new Error('Некорректные входные данные: отсутствуют записи о покупках');
    }
    
    if (!data.products
        || !Array.isArray(data.products)
        || data.products.length === 0) {
        throw new Error('Некорректные входные данные: отсутствуют данные о товарах');
    }
    
    if (!data.sellers
        || !Array.isArray(data.sellers)
        || data.sellers.length === 0) {
        throw new Error('Некорректные входные данные: отсутствуют данные о продавцах');
    }

    // @TODO: Проверка наличия опций
    // Проверяем, что опции - это объект, или сразу деструктурируем (что вызовет ошибку, если что-то не так)
    if (!options || typeof options !== 'object') {
        throw new Error('Некорректные опции: опции не предоставлены или имеют неверный формат');
    }
    
    const { calculateRevenue, calculateBonus } = options; // Сюда передадим функции для расчётов
    
    // Проверяем, что требуемые функции определены
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Некорректные опции: функции расчета не предоставлены');
    }
    
    // Опционально: проверяем, что переменные - это функции
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Некорректные опции: функции расчета должны быть функциями');
    }

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {} // ключ - артикул товара, значение - количество
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    // Индекс для быстрого доступа к статистике продавцов по id
    const sellerIndex = Object.fromEntries(sellerStats.map(stat => [stat.id, stat]));
    
    // Индекс для быстрого доступа к данным продавцов по id
    const sellersIndex = Object.fromEntries(data.sellers.map(seller => [seller.id, seller]));
    
    // Индекс для быстрого доступа к товарам по sku
    const productIndex = Object.fromEntries(data.products.map(product => [product.sku, product]));

    // @TODO: Расчёт выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => { // Чек
        const seller = sellerIndex[record.seller_id]; // Продавец
        
        if (!seller) {
            return; // Пропускаем продавцов, которых нет в списке
        }
        
        // Увеличить количество продаж
        seller.sales_count += 1;
        
        // Исправленный расчет выручки (учитываем скидку)
        seller.revenue += (record.total_amount - record.total_discount);
        
        // Расчёт прибыли для каждого товара
        record.items.forEach(item => {
            const product = productIndex[item.sku]; // Товар
            
            if (!product) {
                return; // Пропускаем товары, которых нет в каталоге
            }
            
            // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
            const cost = product.purchase_price * item.quantity;
            
            // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
            const itemRevenue = calculateRevenue(item, product);
            
            // Посчитать прибыль: выручка минус себестоимость
            const itemProfit = itemRevenue - cost;
            
            // Увеличить общую накопленную прибыль (profit) у продавца
            seller.profit += itemProfit;
            
            // Учёт количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            // По артикулу товара увеличить его проданное количество у продавца
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортируем продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    const total = sellerStats.length;
    sellerStats.forEach((seller, index) => {
        const sellerData = sellersIndex[seller.id];
        // Передаем объект продавца с данными о прибыли для расчета бонуса
        const sellerWithProfit = { ...sellerData, profit: seller.profit };
        // Посчитайте бонус, используя функцию calculateBonus
        const bonusPercent = calculateBonus(index, total, sellerWithProfit);
        // Запишите в поле bonus полученное значение (в рублях)
        seller.bonus = seller.profit * bonusPercent;
        
        // Сформируйте топ-10 проданных продуктов
        // Преобразуем seller.products_sold из объекта вида {[sku]: quantity} в массив вида [[sku, quantity], …] с помощью Object.entries()
        // Трансформируем массив вида [[key, value]] в [{sku, quantity}], используя .map()
        // Отсортируем массив по убыванию количества товаров quantity
        // Отделим от массива первые 10 элементов, используя .slice()
        seller.top_products = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
    });

    // @TODO: Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id, // Строка, идентификатор продавца
        name: seller.name, // Строка, имя продавца
        revenue: +seller.revenue.toFixed(2), // Число с двумя знаками после точки, выручка продавца
        profit: +seller.profit.toFixed(2), // Число с двумя знаками после точки, прибыль продавца
        sales_count: seller.sales_count, // Целое число, количество продаж продавца
        top_products: seller.top_products, // Массив объектов вида: { "sku": "SKU_008","quantity": 10}, топ-10 товаров продавца
        bonus: +seller.bonus.toFixed(2) // Число с двумя знаками после точки, бонус продавца
    }));
}
