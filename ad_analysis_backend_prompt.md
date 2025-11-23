# 广告占比分析接口开发提示词

## 需求概述

广告占比分析页面需要支持以下功能增强：
1. 增加【自定义分类】筛选功能，支持按自定义分类筛选数据
2. 增加各阶段销售额占比数据，逻辑等同于各阶段消耗占比
3. 增加所有阶段的ROI数据（成品阶段、测款阶段、潜力阶段、放弃阶段、其他阶段）

---

## 接口1：获取单日广告占比数据（增强版）

### 接口信息

**接口路径**: `/api/ad-analysis/ad-ratio`  
**请求方式**: `GET`  
**接口用途**: 获取指定日期、指定店铺、可选自定义分类的各阶段广告消耗、销售额、ROI数据

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：`YYYY-MM-DD`，例如：`2024-01-15` |
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
        spend: number;        // 广告消耗（泰铢）
        sales: number;        // 广告销售额（泰铢）
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

- **日期筛选**：仅统计指定日期的数据
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

- **广告消耗（spend）**：按阶段分组，统计该阶段所有商品的广告消耗总和
- **广告销售额（sales）**：按阶段分组，统计该阶段所有商品的广告销售额总和
- **ROI 计算**：
  - **公式**：`ROI = 广告销售额 / 广告消耗`
  - **精度**：保留2位小数
  - **异常处理**：
    - 如果广告消耗为0，ROI 返回 `0`
    - 如果广告销售额为0，ROI 返回 `0`

#### 4. 数据精度

- 所有金额字段（`spend`, `sales`）保留2位小数
- ROI 保留2位小数

### 示例返回数据

#### 成功响应

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

## 接口2：获取广告趋势数据（增强版）

### 接口信息

**接口路径**: `/api/ad-analysis/ad-trend`  
**请求方式**: `GET`  
**接口用途**: 获取指定店铺、可选自定义分类的最近30天各阶段广告消耗、销售额、ROI趋势数据

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| shopID | string | 是 | 店铺ID，例如：`1489850435` |
| shopName | string | 是 | 店铺名称，例如：`Modern Nest|泰国`（用于日志记录） |
| customCategory | string | 否 | 自定义分类筛选值，例如：`电子产品`。如果提供，仅返回匹配该自定义分类的商品数据。匹配逻辑：商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中任意一个等于该值 |

### 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息（成功或错误信息）
  error?: string;             // 错误信息（当success为false时）
  data?: Array<{
    date: string;             // 日期，格式：YYYY-MM-DD
    product_stage_spend?: number;      // 成品阶段广告消耗
    testing_stage_spend?: number;      // 测款阶段广告消耗
    potential_stage_spend?: number;    // 潜力阶段广告消耗
    abandoned_stage_spend?: number;    // 放弃阶段广告消耗
    no_stage_spend?: number;           // 其他阶段广告消耗
    product_stage_sales?: number;      // 成品阶段广告销售额
    testing_stage_sales?: number;      // 测款阶段广告销售额
    potential_stage_sales?: number;    // 潜力阶段广告销售额
    abandoned_stage_sales?: number;    // 放弃阶段广告销售额
    no_stage_sales?: number;           // 其他阶段广告销售额
    product_stage_roi?: number;        // 成品阶段 ROI
    testing_stage_roi?: number;        // 测款阶段 ROI
    potential_stage_roi?: number;      // 潜力阶段 ROI
    abandoned_stage_roi?: number;      // 放弃阶段 ROI
    no_stage_roi?: number;             // 其他阶段 ROI
  }>;
};
```

### 数据计算说明

#### 1. 时间范围

- 返回最近30天的数据（从今天往前推30天）
- 每天一条记录
- 按日期升序排列（最早日期在前，最新日期在后）

#### 2. 筛选条件

- **店铺筛选**：仅统计指定店铺的数据
- **自定义分类筛选**（可选）：
  - 如果提供了 `customCategory` 参数，仅统计符合以下条件的商品：
    - 商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中任意一个等于 `customCategory` 值（精确匹配，区分大小写）
    - 如果所有自定义分类字段都为空，则不匹配

#### 3. 阶段字段映射

同接口1的映射规则。

#### 4. 数据聚合逻辑

- **广告消耗（spend）**：按日期、阶段分组，统计该日期该阶段所有商品的广告消耗总和
- **广告销售额（sales）**：按日期、阶段分组，统计该日期该阶段所有商品的广告销售额总和
- **ROI 计算**：
  - **公式**：`ROI = 广告销售额 / 广告消耗`
  - **精度**：保留2位小数
  - **异常处理**：
    - 如果广告消耗为0，ROI 返回 `0`
    - 如果广告销售额为0，ROI 返回 `0`

#### 5. 数据完整性

- 即使某一天某阶段没有数据，也要返回该记录，对应字段值为 `0`
- 确保返回30条记录（每天一条）

### 示例返回数据

#### 成功响应

```json
{
  "success": true,
  "message": "查询成功",
  "data": [
    {
      "date": "2024-01-01",
      "product_stage_spend": 5200.00,
      "testing_stage_spend": 2100.00,
      "potential_stage_spend": 1650.00,
      "abandoned_stage_spend": 420.00,
      "no_stage_spend": 110.00,
      "product_stage_sales": 13728.00,
      "testing_stage_sales": 5376.00,
      "potential_stage_sales": 3201.00,
      "abandoned_stage_sales": 747.60,
      "no_stage_sales": 183.70,
      "product_stage_roi": 2.64,
      "testing_stage_roi": 2.56,
      "potential_stage_roi": 1.94,
      "abandoned_stage_roi": 1.78,
      "no_stage_roi": 1.67
    },
    {
      "date": "2024-01-02",
      "product_stage_spend": 5400.00,
      "testing_stage_spend": 2200.00,
      "potential_stage_spend": 1700.00,
      "abandoned_stage_spend": 430.00,
      "no_stage_spend": 115.00,
      "product_stage_sales": 14256.00,
      "testing_stage_sales": 5632.00,
      "potential_stage_sales": 3298.00,
      "abandoned_stage_sales": 765.40,
      "no_stage_sales": 192.05,
      "product_stage_roi": 2.64,
      "testing_stage_roi": 2.56,
      "potential_stage_roi": 1.94,
      "abandoned_stage_roi": 1.78,
      "no_stage_roi": 1.67
    }
    // ... 共30条记录
  ]
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

### 接口1：获取单日广告占比数据

```sql
-- 查询指定日期、指定店铺、可选自定义分类的各阶段数据
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
  AND ad.date = :date
  AND ad.shop_id = :shopID
LEFT JOIN sales_table s ON p.product_id = s.product_id
  AND s.date = :date
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

### 接口2：获取广告趋势数据

```sql
-- 查询最近30天的趋势数据
WITH date_range AS (
  SELECT date::date as date
  FROM generate_series(
    CURRENT_DATE - INTERVAL '29 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  ) as date
)
SELECT 
  dr.date::text as date,
  COALESCE(SUM(CASE WHEN stage_group = 'product_stage' THEN ad.spend END), 0) as product_stage_spend,
  COALESCE(SUM(CASE WHEN stage_group = 'testing_stage' THEN ad.spend END), 0) as testing_stage_spend,
  COALESCE(SUM(CASE WHEN stage_group = 'potential_stage' THEN ad.spend END), 0) as potential_stage_spend,
  COALESCE(SUM(CASE WHEN stage_group = 'abandoned_stage' THEN ad.spend END), 0) as abandoned_stage_spend,
  COALESCE(SUM(CASE WHEN stage_group = 'no_stage' THEN ad.spend END), 0) as no_stage_spend,
  COALESCE(SUM(CASE WHEN stage_group = 'product_stage' THEN s.sales_amount END), 0) as product_stage_sales,
  COALESCE(SUM(CASE WHEN stage_group = 'testing_stage' THEN s.sales_amount END), 0) as testing_stage_sales,
  COALESCE(SUM(CASE WHEN stage_group = 'potential_stage' THEN s.sales_amount END), 0) as potential_stage_sales,
  COALESCE(SUM(CASE WHEN stage_group = 'abandoned_stage' THEN s.sales_amount END), 0) as abandoned_stage_sales,
  COALESCE(SUM(CASE WHEN stage_group = 'no_stage' THEN s.sales_amount END), 0) as no_stage_sales
FROM date_range dr
LEFT JOIN (
  SELECT 
    p.product_id,
    ad.date,
    CASE 
      WHEN p.stage = 'product_stage' OR p.stage = '成品阶段' THEN 'product_stage'
      WHEN p.stage = 'testing_stage' OR p.stage = '测款阶段' THEN 'testing_stage'
      WHEN p.stage = 'potential_stage' OR p.stage = '潜力阶段' THEN 'potential_stage'
      WHEN p.stage = 'abandoned_stage' OR p.stage = '放弃阶段' THEN 'abandoned_stage'
      ELSE 'no_stage'
    END as stage_group,
    ad.spend
  FROM products p
  JOIN ad_spend_table ad ON p.product_id = ad.product_id
  WHERE 
    ad.shop_id = :shopID
    AND ad.date >= CURRENT_DATE - INTERVAL '29 days'
    AND ad.date <= CURRENT_DATE
    AND (
      :customCategory IS NULL
      OR p.custom_category_1 = :customCategory
      OR p.custom_category_2 = :customCategory
      OR p.custom_category_3 = :customCategory
      OR p.custom_category_4 = :customCategory
    )
) ad ON dr.date = ad.date
LEFT JOIN (
  SELECT 
    p.product_id,
    s.date,
    CASE 
      WHEN p.stage = 'product_stage' OR p.stage = '成品阶段' THEN 'product_stage'
      WHEN p.stage = 'testing_stage' OR p.stage = '测款阶段' THEN 'testing_stage'
      WHEN p.stage = 'potential_stage' OR p.stage = '潜力阶段' THEN 'potential_stage'
      WHEN p.stage = 'abandoned_stage' OR p.stage = '放弃阶段' THEN 'abandoned_stage'
      ELSE 'no_stage'
    END as stage_group,
    s.sales_amount
  FROM products p
  JOIN sales_table s ON p.product_id = s.product_id
  WHERE 
    s.shop_id = :shopID
    AND s.date >= CURRENT_DATE - INTERVAL '29 days'
    AND s.date <= CURRENT_DATE
    AND (
      :customCategory IS NULL
      OR p.custom_category_1 = :customCategory
      OR p.custom_category_2 = :customCategory
      OR p.custom_category_3 = :customCategory
      OR p.custom_category_4 = :customCategory
    )
) s ON dr.date = s.date AND ad.stage_group = s.stage_group
GROUP BY dr.date
ORDER BY dr.date ASC;
```

---

## 特殊要求

### 1. 数据精度

- 所有金额字段（`spend`, `sales`）保留2位小数
- ROI 保留2位小数

### 2. 性能优化

- 使用数据库索引优化查询（日期、店铺ID、商品ID、阶段字段、自定义分类字段）
- 如果数据量较大，考虑添加缓存机制（如 Redis），缓存时间可设置为5分钟
- 使用数据库聚合函数（如 `SUM`, `GROUP BY`）进行数据汇总
- 自定义分类筛选时，考虑使用 `IN` 查询或 `OR` 条件优化

### 3. 异常处理

- **日期格式验证**：确保日期格式为 `YYYY-MM-DD`
- **店铺ID验证**：验证店铺ID是否存在
- **自定义分类验证**：如果提供了自定义分类参数，验证是否为空字符串（空字符串视为无效）
- **数据为空处理**：如果某阶段没有数据，返回 `0` 而不是 `null`

### 4. 兼容性

- 如果数据库中没有销售额数据，`sales` 字段返回 `0`
- 如果数据库中没有ROI数据，使用销售额和消耗计算ROI
- 确保返回的数据结构完整，即使某阶段没有数据也要包含在返回结果中

---

## 注意事项

1. **自定义分类筛选**：
   - 匹配逻辑：商品的四个自定义分类字段中任意一个等于筛选值即可
   - 区分大小写（如果需要不区分大小写，请在文档中说明）
   - 空值处理：如果所有自定义分类字段都为空，则不匹配

2. **阶段映射**：
   - 需要同时支持中文字段值（成品阶段、测款阶段等）和英文字段值（product_stage、testing_stage等）
   - 如果阶段字段为空或null，归类为"其他阶段"（no_stage）

3. **日期范围**：
   - 趋势接口固定返回最近30天的数据
   - 单日接口只返回指定日期的数据

4. **数据一致性**：
   - 确保同一天、同一店铺、同一阶段的数据在单日接口和趋势接口中保持一致
   - 确保自定义分类筛选后，单日接口和趋势接口的数据源一致

