# 广告占比分析接口开发提示词（时间段版本）

## 需求概述

广告占比分析页面需要支持时间段查询功能：
1. 将单日查询改为时间段查询（支持选择开始日期和结束日期）
2. 时间段可以选择一天作为时间段（开始日期和结束日期相同）
3. 各阶段消耗、销售额、ROI等数据改为时间段内的累计统计
4. 保留原有的自定义分类筛选功能

---

## 接口1：获取时间段广告占比数据

### 接口信息

**接口路径**: `/api/ad-analysis/ad-ratio`  
**请求方式**: `GET`  
**接口用途**: 获取指定时间段、指定店铺、可选自定义分类的各阶段广告消耗、销售额、ROI累计数据

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| startDate | string | 是 | 开始日期，格式：`YYYY-MM-DD`，例如：`2024-01-15` |
| endDate | string | 是 | 结束日期，格式：`YYYY-MM-DD`，例如：`2024-01-20`。**注意**：结束日期必须大于等于开始日期，如果开始日期和结束日期相同，则统计单日数据 |
| shopID | string | 是 | 店铺ID，例如：`1489850435` |
| shopName | string | 是 | 店铺名称，例如：`Modern Nest|泰国`（用于日志记录） |
| customCategory | string | 否 | 自定义分类筛选值，例如：`电子产品`。如果提供，仅返回匹配该自定义分类的商品数据。匹配逻辑：商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中任意一个等于该值 |

### 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息（成功或错误信息）
  error?: string;              // 错误信息（当success为false时）
  data?: {
    stages: {
      product_stage?: {       // 成品阶段
        spend: number;        // 广告消耗（泰铢）- 时间段内累计
        sales: number;        // 广告销售额（泰铢）- 时间段内累计
        roi: number;          // ROI（投资回报率 = 销售额 / 消耗）
      };
      testing_stage?: {       // 测款阶段
        spend: number;
        sales: number;
        roi?: number;
      };
      potential_stage?: {     // 潜力阶段
        spend: number;
        sales: number;
        roi?: number;
      };
      abandoned_stage?: {     // 放弃阶段
        spend: number;
        sales: number;
        roi?: number;
      };
      no_stage?: {            // 其他阶段
        spend: number;
        sales: number;
        roi?: number;
      };
    };
  };
};
```

### 数据计算说明

#### 1. 筛选条件

- **时间段筛选**：统计从 `startDate` 到 `endDate`（包含两端）的所有日期数据
  - 例如：`startDate=2024-01-15`, `endDate=2024-01-20`，则统计 2024-01-15、2024-01-16、2024-01-17、2024-01-18、2024-01-19、2024-01-20 共6天的数据
  - 如果 `startDate` 和 `endDate` 相同，则只统计单日数据
- **店铺筛选**：仅统计指定店铺的数据
- **阶段筛选**：按商品阶段分组统计（成品阶段、测款阶段、潜力阶段、放弃阶段、其他阶段）
- **自定义分类筛选**（可选）：
  - 如果提供了 `customCategory` 参数，仅统计符合以下条件的商品：
    - 商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中任意一个等于 `customCategory` 值（精确匹配，区分大小写）
    - 如果所有自定义分类字段都为空，则不匹配

#### 2. 阶段字段映射

| 前端传入值 | 数据库字段值 | 说明 |
|-----------|-------------|------|
| `product_stage` | `product_stage` 或 `成品阶段` | 成品阶段 |
| `testing_stage` | `testing_stage` 或 `测款阶段` | 测款阶段 |
| `potential_stage` | `potential_stage` 或 `潜力阶段` | 潜力阶段 |
| `abandoned_stage` | `abandoned_stage` 或 `放弃阶段` | 放弃阶段 |
| `no_stage` | 空值或未分类 | 其他阶段 |

#### 3. 数据聚合逻辑

- **广告消耗（spend）**：按阶段分组，统计该时间段内该阶段所有商品的广告消耗**累计总和**
- **广告销售额（sales）**：按阶段分组，统计该时间段内该阶段所有商品的广告销售额**累计总和**
- **ROI 计算**：
  - **公式**：`ROI = 时间段内累计销售额 / 时间段内累计消耗`
  - **精度**：保留2位小数
  - **异常处理**：
    - 如果广告消耗为0，ROI 返回 `0`
    - 如果广告销售额为0，ROI 返回 `0`

#### 4. 数据精度

- 所有金额字段（`spend`, `sales`）保留2位小数
- ROI 保留2位小数

### 示例返回数据

#### 成功响应（时间段：2024-01-15 至 2024-01-20）

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "stages": {
      "product_stage": {
        "spend": 34073.40,
        "sales": 90000.00,
        "roi": 2.64
      },
      "testing_stage": {
        "spend": 14074.02,
        "sales": 36000.00,
        "roi": 2.56
      },
      "potential_stage": {
        "spend": 10803.00,
        "sales": 21000.00,
        "roi": 1.94
      },
      "abandoned_stage": {
        "spend": 2701.20,
        "sales": 4800.00,
        "roi": 1.78
      },
      "no_stage": {
        "spend": 721.80,
        "sales": 1200.00,
        "roi": 1.67
      }
    }
  }
}
```

#### 成功响应（单日：2024-01-15 至 2024-01-15）

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "stages": {
      "product_stage": {
        "spend": 5678.90,
        "sales": 15000.00,
        "roi": 2.64
      },
      "testing_stage": {
        "spend": 2345.67,
        "sales": 6000.00,
        "roi": 2.56
      },
      "potential_stage": {
        "spend": 1800.50,
        "sales": 3500.00,
        "roi": 1.94
      },
      "abandoned_stage": {
        "spend": 450.20,
        "sales": 800.00,
        "roi": 1.78
      },
      "no_stage": {
        "spend": 120.30,
        "sales": 200.00,
        "roi": 1.67
      }
    }
  }
}
```

#### 无数据响应

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "stages": {
      "product_stage": {
        "spend": 0,
        "sales": 0,
        "roi": 0
      },
      "testing_stage": {
        "spend": 0,
        "sales": 0,
        "roi": 0
      },
      "potential_stage": {
        "spend": 0,
        "sales": 0,
        "roi": 0
      },
      "abandoned_stage": {
        "spend": 0,
        "sales": 0,
        "roi": 0
      },
      "no_stage": {
        "spend": 0,
        "sales": 0,
        "roi": 0
      }
    }
  }
}
```

---

## 接口2：获取阶段商品列表（时间段版本）

### 接口信息

**接口路径**: `/api/ad-analysis/stage-products`  
**请求方式**: `GET`  
**接口用途**: 获取指定时间段、指定店铺、指定阶段、可选自定义分类的商品列表（分页）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| startDate | string | 是 | 开始日期，格式：`YYYY-MM-DD` |
| endDate | string | 是 | 结束日期，格式：`YYYY-MM-DD`。必须大于等于开始日期 |
| shopID | string | 是 | 店铺ID |
| shopName | string | 是 | 店铺名称（用于日志记录） |
| stage | string | 是 | 阶段字段值，例如：`product_stage`、`testing_stage`、`potential_stage`、`abandoned_stage`、`no_stage` |
| customCategory | string | 否 | 自定义分类筛选值 |
| page | number | 否 | 页码，从1开始，默认：`1` |
| pageSize | number | 否 | 每页数量，默认：`20` |
| sortBy | string | 否 | 排序字段，可选值：`ad_spend`、`ad_sales`、`roi`，默认：`ad_spend` |
| sortOrder | string | 否 | 排序顺序，可选值：`asc`、`desc`，默认：`desc` |

### 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    items: Array<{
      product_id: string;        // 商品ID
      title: string;             // 商品标题
      main_image?: string;        // 主图URL
      ad_spend: number;          // 时间段内累计广告消耗
      ad_sales: number;          // 时间段内累计广告销售额
      roi: number;               // ROI（时间段内累计销售额 / 时间段内累计消耗）
    }>;
    total: number;               // 总记录数
    page: number;                // 当前页码
    pageSize: number;            // 每页数量
  };
};
```

### 数据计算说明

#### 1. 筛选条件

- **时间段筛选**：统计从 `startDate` 到 `endDate`（包含两端）的所有日期数据
- **店铺筛选**：仅统计指定店铺的数据
- **阶段筛选**：仅统计指定阶段的商品
- **自定义分类筛选**（可选）：同接口1

#### 2. 数据聚合逻辑

- **广告消耗（ad_spend）**：该商品在时间段内所有日期的广告消耗**累计总和**
- **广告销售额（ad_sales）**：该商品在时间段内所有日期的广告销售额**累计总和**
- **ROI 计算**：
  - **公式**：`ROI = 时间段内累计销售额 / 时间段内累计消耗`
  - **精度**：保留2位小数
  - **异常处理**：如果广告消耗为0，ROI 返回 `0`

#### 3. 排序逻辑

- 按 `sortBy` 字段排序
- 排序顺序由 `sortOrder` 决定（`asc` 升序，`desc` 降序）

### 示例返回数据

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "items": [
      {
        "product_id": "123456789",
        "title": "示例商品标题",
        "main_image": "https://example.com/image.jpg",
        "ad_spend": 1234.56,
        "ad_sales": 4567.89,
        "roi": 3.70
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 数据来源说明

### 1. 商品基本信息

- **数据表**：商品表 / 产品表
- **字段**：
  - `product_id`：商品ID
  - `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4`：自定义分类字段
  - `stage`：商品阶段字段（成品阶段、测款阶段、潜力阶段、放弃阶段、其他阶段）

### 2. 广告花费数据

- **数据表**：广告投放记录表 / 广告花费统计表
- **字段**：
  - `date`：日期
  - `shop_id`：店铺ID
  - `product_id`：商品ID
  - `spend`：广告花费（泰铢）

### 3. 广告销售额数据

- **数据表**：订单表 / 销售统计表
- **字段**：
  - `date`：日期
  - `shop_id`：店铺ID
  - `product_id`：商品ID
  - `sales_amount`：销售额（泰铢）

---

## 数据查询逻辑（伪代码）

### 接口1：获取时间段广告占比数据

```sql
-- 查询指定时间段、指定店铺、可选自定义分类的各阶段累计数据
SELECT 
  CASE 
    WHEN p.stage = 'product_stage' OR p.stage = '成品阶段' THEN 'product_stage'
    WHEN p.stage = 'testing_stage' OR p.stage = '测款阶段' THEN 'testing_stage'
    WHEN p.stage = 'potential_stage' OR p.stage = '潜力阶段' THEN 'potential_stage'
    WHEN p.stage = 'abandoned_stage' OR p.stage = '放弃阶段' THEN 'abandoned_stage'
    ELSE 'no_stage'
  END as stage,
  COALESCE(SUM(ad.spend), 0) as spend,
  COALESCE(SUM(s.sales_amount), 0) as sales,
  CASE 
    WHEN COALESCE(SUM(ad.spend), 0) > 0 
    THEN ROUND(COALESCE(SUM(s.sales_amount), 0) / COALESCE(SUM(ad.spend), 0), 2)
    ELSE 0 
  END as roi
FROM products p
LEFT JOIN ad_spend_table ad ON p.product_id = ad.product_id
  AND ad.date >= :startDate
  AND ad.date <= :endDate
  AND ad.shop_id = :shopID
LEFT JOIN sales_table s ON p.product_id = s.product_id
  AND s.date >= :startDate
  AND s.date <= :endDate
  AND s.shop_id = :shopID
WHERE 
  (p.shop_id = :shopID OR ad.shop_id = :shopID OR s.shop_id = :shopID)
  AND (
    -- 自定义分类筛选（如果提供了customCategory参数）
    :customCategory IS NULL
    OR p.custom_category_1 = :customCategory
    OR p.custom_category_2 = :customCategory
    OR p.custom_category_3 = :customCategory
    OR p.custom_category_4 = :customCategory
  )
GROUP BY stage;
```

### 接口2：获取阶段商品列表

```sql
-- 查询指定时间段、指定店铺、指定阶段的商品列表（分页）
SELECT 
  p.product_id,
  p.title,
  p.main_image,
  COALESCE(SUM(ad.spend), 0) as ad_spend,
  COALESCE(SUM(s.sales_amount), 0) as ad_sales,
  CASE 
    WHEN COALESCE(SUM(ad.spend), 0) > 0 
    THEN ROUND(COALESCE(SUM(s.sales_amount), 0) / COALESCE(SUM(ad.spend), 0), 2)
    ELSE 0 
  END as roi
FROM products p
LEFT JOIN ad_spend_table ad ON p.product_id = ad.product_id
  AND ad.date >= :startDate
  AND ad.date <= :endDate
  AND ad.shop_id = :shopID
LEFT JOIN sales_table s ON p.product_id = s.product_id
  AND s.date >= :startDate
  AND s.date <= :endDate
  AND s.shop_id = :shopID
WHERE 
  (p.shop_id = :shopID OR ad.shop_id = :shopID OR s.shop_id = :shopID)
  AND (
    CASE 
      WHEN p.stage = 'product_stage' OR p.stage = '成品阶段' THEN 'product_stage'
      WHEN p.stage = 'testing_stage' OR p.stage = '测款阶段' THEN 'testing_stage'
      WHEN p.stage = 'potential_stage' OR p.stage = '潜力阶段' THEN 'potential_stage'
      WHEN p.stage = 'abandoned_stage' OR p.stage = '放弃阶段' THEN 'abandoned_stage'
      ELSE 'no_stage'
    END = :stage
  )
  AND (
    -- 自定义分类筛选（如果提供了customCategory参数）
    :customCategory IS NULL
    OR p.custom_category_1 = :customCategory
    OR p.custom_category_2 = :customCategory
    OR p.custom_category_3 = :customCategory
    OR p.custom_category_4 = :customCategory
  )
GROUP BY p.product_id, p.title, p.main_image
ORDER BY 
  CASE WHEN :sortBy = 'ad_spend' AND :sortOrder = 'desc' THEN COALESCE(SUM(ad.spend), 0) END DESC,
  CASE WHEN :sortBy = 'ad_spend' AND :sortOrder = 'asc' THEN COALESCE(SUM(ad.spend), 0) END ASC,
  CASE WHEN :sortBy = 'ad_sales' AND :sortOrder = 'desc' THEN COALESCE(SUM(s.sales_amount), 0) END DESC,
  CASE WHEN :sortBy = 'ad_sales' AND :sortOrder = 'asc' THEN COALESCE(SUM(s.sales_amount), 0) END ASC,
  CASE WHEN :sortBy = 'roi' AND :sortOrder = 'desc' THEN 
    CASE 
      WHEN COALESCE(SUM(ad.spend), 0) > 0 
      THEN COALESCE(SUM(s.sales_amount), 0) / COALESCE(SUM(ad.spend), 0)
      ELSE 0 
    END
  END DESC,
  CASE WHEN :sortBy = 'roi' AND :sortOrder = 'asc' THEN 
    CASE 
      WHEN COALESCE(SUM(ad.spend), 0) > 0 
      THEN COALESCE(SUM(s.sales_amount), 0) / COALESCE(SUM(ad.spend), 0)
      ELSE 0 
    END
  END ASC
LIMIT :pageSize OFFSET (:page - 1) * :pageSize;

-- 获取总数
SELECT COUNT(DISTINCT p.product_id) as total
FROM products p
LEFT JOIN ad_spend_table ad ON p.product_id = ad.product_id
  AND ad.date >= :startDate
  AND ad.date <= :endDate
  AND ad.shop_id = :shopID
LEFT JOIN sales_table s ON p.product_id = s.product_id
  AND s.date >= :startDate
  AND s.date <= :endDate
  AND s.shop_id = :shopID
WHERE 
  (p.shop_id = :shopID OR ad.shop_id = :shopID OR s.shop_id = :shopID)
  AND (
    CASE 
      WHEN p.stage = 'product_stage' OR p.stage = '成品阶段' THEN 'product_stage'
      WHEN p.stage = 'testing_stage' OR p.stage = '测款阶段' THEN 'testing_stage'
      WHEN p.stage = 'potential_stage' OR p.stage = '潜力阶段' THEN 'potential_stage'
      WHEN p.stage = 'abandoned_stage' OR p.stage = '放弃阶段' THEN 'abandoned_stage'
      ELSE 'no_stage'
    END = :stage
  )
  AND (
    :customCategory IS NULL
    OR p.custom_category_1 = :customCategory
    OR p.custom_category_2 = :customCategory
    OR p.custom_category_3 = :customCategory
    OR p.custom_category_4 = :customCategory
  );
```

---

## 特殊要求

### 1. 日期验证

- **日期格式验证**：确保日期格式为 `YYYY-MM-DD`
- **日期范围验证**：
  - `endDate` 必须大于等于 `startDate`
  - 如果 `endDate < startDate`，返回错误：`"结束日期不能早于开始日期"`
- **日期有效性验证**：确保日期是有效的日期值

### 2. 数据精度

- 所有金额字段（`spend`, `sales`, `ad_spend`, `ad_sales`）保留2位小数
- ROI 保留2位小数

### 3. 性能优化

- 使用数据库索引优化查询（日期、店铺ID、商品ID、阶段字段、自定义分类字段）
- 如果数据量较大，考虑添加缓存机制（如 Redis），缓存时间可设置为5分钟
- 使用数据库聚合函数（如 `SUM`, `GROUP BY`）进行数据汇总
- 自定义分类筛选时，考虑使用 `IN` 查询或 `OR` 条件优化
- **时间段查询优化**：对于长时间段查询，考虑使用日期范围索引

### 4. 异常处理

- **日期格式验证**：确保日期格式为 `YYYY-MM-DD`
- **日期范围验证**：`endDate` 必须大于等于 `startDate`
- **店铺ID验证**：验证店铺ID是否存在
- **自定义分类验证**：如果提供了自定义分类参数，验证是否为空字符串（空字符串视为无效）
- **数据为空处理**：如果某阶段没有数据，返回 `0` 而不是 `null`
- **时间段过长处理**：如果时间段超过90天，建议返回警告或限制查询范围

### 5. 兼容性

- 如果数据库中没有销售额数据，`sales` 字段返回 `0`
- 如果数据库中没有ROI数据，使用销售额和消耗计算ROI
- 确保返回的数据结构完整，即使某阶段没有数据也要包含在返回结果中
- **向后兼容**：如果前端仍传递 `date` 参数（单日查询），可以兼容处理：
  - 将 `date` 同时作为 `startDate` 和 `endDate`
  - 或者返回错误提示使用新的参数格式

---

## 注意事项

1. **时间段计算**：
   - 时间段包含开始日期和结束日期（闭区间）
   - 例如：`startDate=2024-01-15`, `endDate=2024-01-20`，包含 2024-01-15 和 2024-01-20 两天
   - 单日查询：`startDate=2024-01-15`, `endDate=2024-01-15`，只统计 2024-01-15 一天

2. **数据累计**：
   - 所有金额数据都是时间段内的**累计总和**
   - ROI 是时间段内累计销售额除以累计消耗，**不是**每日ROI的平均值

3. **自定义分类筛选**：
   - 匹配逻辑：商品的四个自定义分类字段中任意一个等于筛选值即可
   - 区分大小写（如果需要不区分大小写，请在文档中说明）
   - 空值处理：如果所有自定义分类字段都为空，则不匹配

4. **阶段映射**：
   - 需要同时支持中文字段值（成品阶段、测款阶段等）和英文字段值（product_stage、testing_stage等）
   - 如果阶段字段为空或null，归类为"其他阶段"（no_stage）

5. **数据一致性**：
   - 确保同一时间段、同一店铺、同一阶段的数据在不同接口中保持一致
   - 确保自定义分类筛选后，不同接口的数据源一致

6. **性能考虑**：
   - 长时间段查询（如超过30天）可能性能较慢，建议：
     - 添加查询时间限制（如最多查询90天）
     - 使用数据库分区表（按日期分区）
     - 添加查询结果缓存

---

## 接口变更说明

### 与原接口的差异

1. **参数变更**：
   - 原接口：`date: string`（单日）
   - 新接口：`startDate: string`, `endDate: string`（时间段）

2. **数据含义变更**：
   - 原接口：返回单日数据
   - 新接口：返回时间段内累计数据

3. **向后兼容**：
   - 建议保留对 `date` 参数的支持（向后兼容）
   - 如果收到 `date` 参数，将其同时作为 `startDate` 和 `endDate`
   - 或者返回明确的错误提示，要求使用新参数格式

