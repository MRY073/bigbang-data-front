# 广告分析接口开发提示词

## 接口概述

广告分析模块需要两个接口，用于展示不同阶段广告消耗占比与成品阶段 ROI 的时间变化趋势。

---

## 接口一：单日广告占比数据

### 接口信息

**接口路径**: `/api/products/ad-ratio`  
**请求方式**: `GET`  
**接口用途**: 获取指定日期的各阶段广告消耗分布和成品阶段 ROI 数据

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：`YYYY-MM-DD`，例如：`2024-01-15` |

### 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息（成功或错误信息）
  error?: string;             // 错误信息（当success为false时）
  data?: {
    date: string;             // 日期，格式：YYYY-MM-DD
    stages: {
      product_stage: {        // 成品阶段
        spend: number;        // 广告消耗（元）
        sales_amount: number; // 销售额（元）
        roi: number;          // 投资回报率（ROI = 销售额 / 广告消耗）
      };
      testing_stage: {        // 测款阶段
        spend: number;        // 广告消耗（元）
      };
      potential_stage: {      // 潜力阶段
        spend: number;        // 广告消耗（元）
      };
      abandoned_stage: {      // 放弃阶段
        spend: number;        // 广告消耗（元）
      };
      no_stage: {             // 其他阶段（无阶段）
        spend: number;        // 广告消耗（元）
      };
    };
  };
};
```

### 数据计算说明

1. **各阶段消耗（spend）**：
   - 从广告投放数据表中，按日期和阶段筛选数据
   - 对指定日期的所有广告投放记录，按阶段分组汇总消耗金额
   - 阶段为空或未分类的，归类为 `no_stage`（其他阶段）

2. **成品阶段 ROI**：
   - ROI = 销售额 / 广告消耗
   - 销售额从订单数据或销售统计表中获取
   - 如果广告消耗为0，ROI 返回 0 或 null
   - ROI 保留2位小数

3. **数据缺失处理**：
   - 如果某个阶段当天没有数据，`spend` 返回 `0`
   - 如果成品阶段没有销售额数据，`sales_amount` 返回 `0`，`roi` 返回 `0`

### 示例返回数据

**成功响应**：
```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "date": "2024-01-15",
    "stages": {
      "product_stage": {
        "spend": 5678.90,
        "sales_amount": 15000.00,
        "roi": 2.64
      },
      "testing_stage": {
        "spend": 2345.67
      },
      "potential_stage": {
        "spend": 1800.50
      },
      "abandoned_stage": {
        "spend": 450.20
      },
      "no_stage": {
        "spend": 120.30
      }
    }
  }
}
```

**失败响应**：
```json
{
  "success": false,
  "error": "日期格式错误",
  "message": "日期格式应为 YYYY-MM-DD"
}
```

---

## 接口二：广告消耗趋势数据

### 接口信息

**接口路径**: `/api/products/ad-trend`  
**请求方式**: `GET`  
**接口用途**: 获取近30天的广告消耗结构趋势和成品阶段 ROI 趋势数据

### 请求参数

无（默认返回近30天的数据）

**可选扩展**（如需要）：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| days | number | 否 | 返回天数，默认30天，最大不超过90天 |

### 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息
  error?: string;             // 错误信息
  data?: Array<{
    date: string;             // 日期，格式：YYYY-MM-DD
    product_stage_spend: number;    // 成品阶段消耗（元）
    testing_stage_spend: number;    // 测款阶段消耗（元）
    potential_stage_spend: number; // 潜力阶段消耗（元）
    abandoned_stage_spend: number; // 放弃阶段消耗（元）
    no_stage_spend: number;        // 其他阶段消耗（元）
    product_stage_roi: number;     // 成品阶段 ROI
  }>;
};
```

### 数据计算说明

1. **时间范围**：
   - 默认返回最近30天的数据（包含今天）
   - 数据按日期升序排列（从最早到最新）
   - 日期格式：`YYYY-MM-DD`

2. **各阶段消耗**：
   - 对每一天的数据，按阶段分组汇总广告消耗
   - 阶段为空或未分类的，归类为 `no_stage`
   - 如果某天某个阶段没有数据，返回 `0`

3. **成品阶段 ROI**：
   - 每天计算：ROI = 当日销售额 / 当日广告消耗
   - 如果广告消耗为0，ROI 返回 `0`
   - ROI 保留2位小数

4. **数据完整性**：
   - 即使某天没有任何数据，也要返回该日期，所有字段为 `0`
   - 确保返回的数组包含连续的30天数据，便于前端绘制连续的趋势图

### 示例返回数据

**成功响应**：
```json
{
  "success": true,
  "message": "查询成功",
  "data": [
    {
      "date": "2023-12-17",
      "product_stage_spend": 3200.50,
      "testing_stage_spend": 1500.20,
      "potential_stage_spend": 1200.80,
      "abandoned_stage_spend": 300.40,
      "no_stage_spend": 100.10,
      "product_stage_roi": 2.35
    },
    {
      "date": "2023-12-18",
      "product_stage_spend": 3500.60,
      "testing_stage_spend": 1600.30,
      "potential_stage_spend": 1300.90,
      "abandoned_stage_spend": 320.50,
      "no_stage_spend": 110.20,
      "product_stage_roi": 2.48
    }
    // ... 共30条数据
  ]
}
```

---

## 数据来源说明

### 1. 广告消耗数据
- **数据表**：广告投放记录表 / 广告花费统计表
- **字段**：日期、阶段、消耗金额
- **阶段字段值**：
  - `product_stage` 或 `成品阶段` → 成品阶段
  - `testing_stage` 或 `测款阶段` → 测款阶段
  - `potential_stage` 或 `潜力阶段` → 潜力阶段
  - `abandoned_stage` 或 `放弃阶段` → 放弃阶段
  - 其他或空值 → 其他阶段（no_stage）

### 2. 销售额数据
- **数据表**：订单表 / 销售统计表
- **字段**：日期、销售额
- **筛选条件**：仅统计成品阶段的销售额

### 3. ROI 计算
- **公式**：ROI = 销售额 / 广告消耗
- **精度**：保留2位小数
- **异常处理**：当广告消耗为0时，ROI 返回 0

---

## 特殊要求

### 1. 数据精度
- 所有金额字段（spend, sales_amount）保留2位小数
- ROI 保留2位小数

### 2. 性能优化
- 使用数据库聚合函数（如 `SUM`, `GROUP BY`）进行数据汇总
- 对于趋势数据，考虑使用缓存机制（如 Redis），缓存时间可设置为1小时
- 如果数据量较大，考虑添加数据库索引（日期、阶段字段）

### 3. 异常处理
- 日期格式验证：确保日期格式为 `YYYY-MM-DD`
- 日期范围验证：确保日期在合理范围内（如不早于系统最早数据日期，不晚于今天）
- 数据缺失处理：某天或某阶段没有数据时，返回 `0` 而非 `null`
- 除零错误：计算 ROI 时，确保分母不为0

### 4. 错误响应格式
```json
{
  "success": false,
  "error": "错误描述",
  "message": "用户友好的错误提示"
}
```

常见错误场景：
- 日期格式错误
- 日期超出范围
- 数据库查询失败
- 数据计算异常

---

## 开发建议

1. **代码结构**：
   - 将数据查询逻辑封装成独立函数
   - 将 ROI 计算逻辑封装成独立函数，便于测试和维护
   - 将阶段名称映射逻辑统一管理（如使用配置或枚举）

2. **数据库查询优化**：
   - 使用索引优化日期和阶段字段的查询
   - 对于趋势数据，使用一次查询获取所有数据，避免循环查询
   - 考虑使用数据库视图或物化视图预计算汇总数据

3. **测试建议**：
   - 测试边界情况：日期为今天、昨天、30天前
   - 测试数据缺失情况：某天没有数据、某阶段没有数据
   - 测试异常情况：日期格式错误、日期超出范围
   - 测试 ROI 计算：广告消耗为0、销售额为0的情况

4. **日志记录**：
   - 记录查询耗时，便于性能优化
   - 记录异常情况，便于排查问题
   - 记录数据统计信息（如返回了多少条数据）

---

## 前端对接说明

前端代码位于：`src/views/adAnalysis/index.vue`

### 接口调用方式

1. **单日数据接口**：
   ```javascript
   const url = new URL('/api/products/ad-ratio', window.location.origin);
   url.searchParams.append('date', '2024-01-15');
   const res = await fetch(url.toString());
   ```

2. **趋势数据接口**：
   ```javascript
   const url = new URL('/api/products/ad-trend', window.location.origin);
   const res = await fetch(url.toString());
   ```

### 前端数据转换

前端会将后端返回的数据转换为内部使用的格式，但后端应严格按照上述数据结构返回，确保字段名称和类型一致。

---

## 示例 SQL 查询（参考）

### 单日数据查询示例（伪代码）

```sql
-- 查询指定日期各阶段消耗
SELECT 
  stage,
  SUM(spend) as total_spend
FROM ad_spend_table
WHERE date = '2024-01-15'
GROUP BY stage;

-- 查询指定日期成品阶段销售额
SELECT 
  SUM(sales_amount) as total_sales
FROM sales_table
WHERE date = '2024-01-15'
  AND stage = 'product_stage';
```

### 趋势数据查询示例（伪代码）

```sql
-- 查询近30天各阶段消耗
SELECT 
  date,
  stage,
  SUM(spend) as total_spend
FROM ad_spend_table
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
  AND date <= CURDATE()
GROUP BY date, stage
ORDER BY date ASC;

-- 查询近30天成品阶段销售额
SELECT 
  date,
  SUM(sales_amount) as total_sales
FROM sales_table
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
  AND date <= CURDATE()
  AND stage = 'product_stage'
GROUP BY date
ORDER BY date ASC;
```

---

## 注意事项

1. **阶段名称映射**：确保数据库中的阶段字段值与接口返回的字段名一致，如不一致需要做映射转换
2. **时区处理**：确保日期计算使用正确的时区
3. **数据一致性**：确保广告消耗数据和销售额数据的时间维度一致（都按天统计）
4. **空值处理**：所有数值字段不应返回 `null`，应返回 `0`

