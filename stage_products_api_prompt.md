# 阶段商品列表接口开发提示词

## 接口概述

广告分析模块需要新增一个接口，用于获取指定日期、指定阶段、指定店铺的商品列表，展示该阶段有广告花费的商品详情。

---

## 接口信息

**接口路径**: `/api/ad-analysis/stage-products`  
**请求方式**: `GET`  
**接口用途**: 获取指定日期、指定阶段、指定店铺的商品列表，包含商品ID、标题、主图、广告花费、广告销售额、ROI等信息

---

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：`YYYY-MM-DD`，例如：`2024-01-15` |
| shopID | string | 是 | 店铺ID，例如：`1489850435` |
| stage | string | 是 | 阶段标识，可选值：`product_stage`（成品阶段）、`testing_stage`（测款阶段）、`potential_stage`（潜力阶段）、`abandoned_stage`（放弃阶段）、`no_stage`（其他阶段） |
| shopName | string | 否 | 店铺名称，例如：`Modern Nest|泰国`（用于日志记录） |

---

## 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息（成功或错误信息）
  error?: string;             // 错误信息（当success为false时）
  data?: Array<{
    product_id: string;       // 商品ID
    title: string;            // 商品标题
    main_image: string;       // 主图URL
    ad_spend: number;         // 广告花费（泰铢）
    ad_sales: number;         // 广告销售额（泰铢）
    roi: number;             // ROI（投资回报率 = 广告销售额 / 广告花费）
  }>;
};
```

---

## 数据计算说明

### 1. 筛选条件

- **日期筛选**：仅统计指定日期的数据
- **店铺筛选**：仅统计指定店铺的数据
- **阶段筛选**：仅统计指定阶段的商品
- **广告花费筛选**：仅返回有广告花费的商品（`ad_spend > 0`）

### 2. 阶段字段映射

| 前端传入值 | 数据库字段值 | 说明 |
|-----------|-------------|------|
| `product_stage` | `product_stage` 或 `成品阶段` | 成品阶段 |
| `testing_stage` | `testing_stage` 或 `测款阶段` | 测款阶段 |
| `potential_stage` | `potential_stage` 或 `潜力阶段` | 潜力阶段 |
| `abandoned_stage` | `abandoned_stage` 或 `放弃阶段` | 放弃阶段 |
| `no_stage` | 空值或未分类 | 其他阶段 |

### 3. ROI 计算

- **公式**：`ROI = 广告销售额 / 广告花费`
- **精度**：保留2位小数
- **异常处理**：
  - 如果广告花费为0，ROI 返回 `0`
  - 如果广告销售额为0，ROI 返回 `0`
  - 如果广告花费和广告销售额都为0，ROI 返回 `0`（但该商品不应出现在结果中，因为要求 `ad_spend > 0`）

### 4. 数据排序

- 建议按广告花费降序排列（花费最多的商品排在前面）
- 或者按 ROI 降序排列（ROI 最高的商品排在前面）

---

## 示例返回数据

### 成功响应

```json
{
  "success": true,
  "message": "查询成功",
  "data": [
    {
      "product_id": "123456789",
      "title": "示例商品标题 - 这是一个测试商品",
      "main_image": "https://example.com/images/product1.jpg",
      "ad_spend": 123.45,
      "ad_sales": 456.78,
      "roi": 3.70
    },
    {
      "product_id": "987654321",
      "title": "另一个示例商品",
      "main_image": "https://example.com/images/product2.jpg",
      "ad_spend": 234.56,
      "ad_sales": 567.89,
      "roi": 2.42
    }
  ]
}
```

### 无数据响应

```json
{
  "success": true,
  "message": "查询成功",
  "data": []
}
```

### 失败响应

```json
{
  "success": false,
  "error": "日期格式错误",
  "message": "日期格式应为 YYYY-MM-DD"
}
```

---

## 数据来源说明

### 1. 商品基本信息

- **数据表**：商品表 / 产品表
- **字段**：
  - `product_id`：商品ID
  - `title`：商品标题
  - `main_image`：主图URL

### 2. 广告花费数据

- **数据表**：广告投放记录表 / 广告花费统计表
- **字段**：
  - `date`：日期
  - `shop_id`：店铺ID
  - `product_id`：商品ID
  - `stage`：阶段
  - `spend`：广告花费（泰铢）

### 3. 广告销售额数据

- **数据表**：订单表 / 销售统计表
- **字段**：
  - `date`：日期
  - `shop_id`：店铺ID
  - `product_id`：商品ID
  - `stage`：阶段
  - `sales_amount`：销售额（泰铢）

---

## 数据查询逻辑（伪代码）

```sql
-- 查询指定日期、指定阶段、指定店铺的商品列表
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
  AND ad.date = '2024-01-15'
  AND ad.shop_id = '1489850435'
  AND ad.stage = 'product_stage'
LEFT JOIN sales_table s ON p.product_id = s.product_id
  AND s.date = '2024-01-15'
  AND s.shop_id = '1489850435'
  AND s.stage = 'product_stage'
WHERE COALESCE(SUM(ad.spend), 0) > 0
GROUP BY p.product_id, p.title, p.main_image
ORDER BY ad_spend DESC;
```

---

## 特殊要求

### 1. 数据精度

- 所有金额字段（`ad_spend`, `ad_sales`）保留2位小数
- ROI 保留2位小数

### 2. 性能优化

- 使用数据库索引优化查询（日期、店铺ID、商品ID、阶段字段）
- 如果数据量较大，考虑添加缓存机制（如 Redis），缓存时间可设置为5分钟
- 使用数据库聚合函数（如 `SUM`, `GROUP BY`）进行数据汇总

### 3. 异常处理

- **日期格式验证**：确保日期格式为 `YYYY-MM-DD`
- **日期范围验证**：确保日期在合理范围内（如不早于系统最早数据日期，不晚于今天）
- **店铺ID验证**：确保店铺ID存在且有效
- **阶段验证**：确保阶段参数为有效值
- **数据缺失处理**：如果某个商品没有广告花费或销售额数据，返回 `0` 而非 `null`

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
- 店铺ID不存在
- 阶段参数无效
- 数据库查询失败
- 数据计算异常

---

## 开发建议

### 1. 代码结构

- 将数据查询逻辑封装成独立函数
- 将 ROI 计算逻辑封装成独立函数，便于测试和维护
- 将阶段名称映射逻辑统一管理（如使用配置或枚举）

### 2. 数据库查询优化

- 使用索引优化日期、店铺ID、商品ID、阶段字段的查询
- 对于商品列表查询，使用一次查询获取所有数据，避免循环查询
- 考虑使用数据库视图或物化视图预计算汇总数据

### 3. 测试建议

- 测试边界情况：日期为今天、昨天、30天前
- 测试数据缺失情况：某阶段没有商品、某商品没有广告花费
- 测试异常情况：日期格式错误、日期超出范围、店铺ID不存在、阶段参数无效
- 测试 ROI 计算：广告花费为0、销售额为0的情况

### 4. 日志记录

- 记录查询耗时，便于性能优化
- 记录异常情况，便于排查问题
- 记录数据统计信息（如返回了多少条数据）

---

## 前端对接说明

前端代码位于：`src/views/adAnalysis/index.vue`

### 接口调用方式

```javascript
const url = new URL('/api/ad-analysis/stage-products', window.location.origin);
url.searchParams.append('date', '2024-01-15');
url.searchParams.append('shopID', '1489850435');
url.searchParams.append('stage', 'product_stage');
url.searchParams.append('shopName', 'Modern Nest|泰国');
const res = await fetch(url.toString());
```

### 前端数据转换

前端会将后端返回的数据转换为内部使用的格式：

```typescript
{
  productId: item.product_id || item.productId || "",
  title: item.title || "",
  mainImage: item.main_image || item.mainImage || "",
  adSpend: item.ad_spend || item.adSpend || 0,
  adSales: item.ad_sales || item.adSales || 0,
  roi: item.roi || 0
}
```

后端应严格按照上述数据结构返回，确保字段名称和类型一致。

---

## 注意事项

1. **阶段名称映射**：确保数据库中的阶段字段值与接口参数值一致，如不一致需要做映射转换
2. **时区处理**：确保日期计算使用正确的时区
3. **数据一致性**：确保广告花费数据和销售额数据的时间维度一致（都按天统计）
4. **空值处理**：所有数值字段不应返回 `null`，应返回 `0`
5. **图片URL处理**：确保主图URL完整可用，如果图片不存在，返回占位图URL或空字符串
6. **数据过滤**：仅返回有广告花费的商品（`ad_spend > 0`），避免返回无意义的空数据

---

## 接口调用示例

### 请求示例

```
GET /api/ad-analysis/stage-products?date=2024-01-15&shopID=1489850435&stage=product_stage&shopName=Modern%20Nest%7C%E6%B3%B0%E5%9B%BD
```

### 响应示例

```json
{
  "success": true,
  "message": "查询成功",
  "data": [
    {
      "product_id": "123456789",
      "title": "示例商品标题",
      "main_image": "https://example.com/images/product1.jpg",
      "ad_spend": 123.45,
      "ad_sales": 456.78,
      "roi": 3.70
    }
  ]
}
```

---

## 与现有接口的关系

此接口与现有的两个接口配合使用：

1. **单日广告占比接口** (`/api/ad-analysis/ad-ratio`)：获取各阶段的总体消耗数据
2. **广告消耗趋势接口** (`/api/ad-analysis/ad-trend`)：获取各阶段的趋势数据
3. **阶段商品列表接口** (`/api/ad-analysis/stage-products`)：获取各阶段的详细商品列表（本接口）

用户可以在查看各阶段消耗占比后，点击"查看相应商品细则"按钮，查看该阶段的详细商品列表。

