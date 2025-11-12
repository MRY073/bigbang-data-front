# 成品链接监控接口开发提示词

## 接口信息

**接口路径**: `/api/finished/link/monitor/list`  
**请求方式**: `GET`  
**接口用途**: 获取成品链接监控数据列表，用于展示产品的访客、广告花费、销售额等指标的变化趋势和预警信息

## 请求参数

**Query Parameters:**
- `shopID` (string, 必填): 店铺ID，例如 "1489850435"
- `shopName` (string, 必填): 店铺名称，例如 "Modern Nest|泰国"
- `date` (string, 必填): 查询日期，格式为 "YYYY-MM-DD"，例如 "2024-01-15"
- `customCategory` (string, 可选): 自定义分类筛选条件，如果提供此参数，则只返回匹配该分类的商品
  - 筛选逻辑：商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 中任意一个字段包含该分类值（不区分大小写）

## 返回数据结构

接口返回一个产品列表，每个产品对象包含以下字段：

```typescript
type ProductCard = {
  id: string;                    // 产品ID（SKU编号）
  name: string;                  // 产品名称
  image?: string | null;         // 产品图片URL（可选，可为null）
  visitorsAvg: number[];         // 日均访客数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  visitorsStd: number[];         // 访客数标准差数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  adCostAvg: number[];           // 日均广告花费数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  adCostStd: number[];           // 广告花费标准差数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  salesAvg: number[];            // 日均销售额数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  salesStd: number[];            // 销售额标准差数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  warningLevel: "严重" | "一般" | "轻微" | "正常";  // 预警等级
  // warningMsg 字段不需要返回，该字段预留用于未来接入AI能力生成预警消息
  // 自定义分类字段（必填，从 product_items 表关联获取）
  custom_category_1?: string | null;  // 自定义分类1（可选，可为null）
  custom_category_2?: string | null;  // 自定义分类2（可选，可为null）
  custom_category_3?: string | null;  // 自定义分类3（可选，可为null）
  custom_category_4?: string | null;  // 自定义分类4（可选，可为null）
};
```

## 数据计算说明

### 时间维度说明
- 需要计算5个时间维度的数据：30天、15天、7天、3天、1天
- 每个维度都需要计算：
  - 平均值（Avg）：该时间范围内的日均值
  - 标准差（Std）：该时间范围内数据的标准差

### 预警等级（warningLevel）计算规则

**重要：以下阈值配置必须写在代码文件最顶部，方便后续调整修改**

```python
# ==================== 预警等级阈值配置 ====================
# 标准差系数阈值（标准差相对于平均值的比例）
WARNING_LEVEL_THRESHOLDS = {
    "严重": 0.5,    # 标准差/平均值 >= 0.5 时，判定为"严重"
    "一般": 0.3,    # 标准差/平均值 >= 0.3 且 < 0.5 时，判定为"一般"
    "轻微": 0.15,   # 标准差/平均值 >= 0.15 且 < 0.3 时，判定为"轻微"
    "正常": 0.0     # 标准差/平均值 < 0.15 时，判定为"正常"
}

# 需要评估的指标权重（可根据业务需求调整）
METRIC_WEIGHTS = {
    "visitors": 0.4,   # 访客指标权重
    "adCost": 0.3,     # 广告花费指标权重
    "sales": 0.3       # 销售额指标权重
}
# =========================================================
```

**计算逻辑：**

1. 对于每个时间维度（30/15/7/3/1日），分别计算三个指标的变异系数（CV = 标准差/平均值）：
   - 访客变异系数 = visitorsStd[i] / visitorsAvg[i]（如果visitorsAvg[i]为0，则使用一个很小的数如0.001）
   - 广告花费变异系数 = adCostStd[i] / adCostAvg[i]（如果adCostAvg[i]为0，则使用0.001）
   - 销售额变异系数 = salesStd[i] / salesAvg[i]（如果salesAvg[i]为0，则使用0.001）

2. 对每个指标，根据其变异系数和权重计算加权分数：
   - 访客分数 = 访客变异系数 × METRIC_WEIGHTS["visitors"]
   - 广告花费分数 = 广告花费变异系数 × METRIC_WEIGHTS["adCost"]
   - 销售额分数 = 销售额变异系数 × METRIC_WEIGHTS["sales"]

3. 取最近的时间维度（1日、3日）的加权分数，计算综合预警分数：
   - 综合分数 = (1日访客分数 + 1日广告花费分数 + 1日销售额分数) × 0.6 + 
                (3日访客分数 + 3日广告花费分数 + 3日销售额分数) × 0.4

4. 根据综合分数判断预警等级：
   - 如果综合分数 >= 0.5，返回 "严重"
   - 如果综合分数 >= 0.3 且 < 0.5，返回 "一般"
   - 如果综合分数 >= 0.15 且 < 0.3，返回 "轻微"
   - 如果综合分数 < 0.15，返回 "正常"

**注意**：
- 预警等级计算主要关注最近1日和3日的数据趋势
- 如果某个指标的平均值为0或接近0，需要特殊处理，避免除零错误
- 预警等级阈值配置必须放在代码文件最顶部，使用常量定义，方便后续调整

## 数据来源说明

1. **产品基本信息**（id, name, image）：
   - 从产品表/商品表获取

2. **自定义分类字段**（custom_category_1, custom_category_2, custom_category_3, custom_category_4）：
   - **重要**：必须从 `product_items` 表中关联获取
   - 通过产品的 `id` 或 `product_id` 关联 `product_items` 表
   - 如果某个分类字段为 NULL，返回 `null`
   - 这些字段用于前端筛选功能，**必须返回**，不能省略

3. **访客数据**（visitorsAvg, visitorsStd）：
   - 从访问日志或统计数据中获取
   - 计算指定时间范围内的日均访客数和标准差

4. **广告花费数据**（adCostAvg, adCostStd）：
   - 从广告投放数据表中获取
   - 计算指定时间范围内的日均广告花费和标准差

5. **销售额数据**（salesAvg, salesStd）：
   - 从订单数据或销售统计表中获取
   - 计算指定时间范围内的日均销售额和标准差

## 特殊要求

1. **自定义分类字段（重要）**：
   - **必须从 `product_items` 表中关联获取** `custom_category_1` 到 `custom_category_4` 字段
   - 关联方式：通过产品的 `id` 或 `product_id` 字段关联 `product_items` 表的 `product_id` 字段
   - 如果 `product_items` 表中没有对应的记录，或者字段为 NULL，返回 `null`
   - 这些字段**必须返回**，不能省略，前端依赖这些字段进行筛选
   - 如果提供了 `customCategory` 查询参数，需要在 SQL 查询中添加筛选条件：
     ```sql
     WHERE (custom_category_1 LIKE '%customCategory%' 
         OR custom_category_2 LIKE '%customCategory%' 
         OR custom_category_3 LIKE '%customCategory%' 
         OR custom_category_4 LIKE '%customCategory%')
     ```
     注意：筛选时应该使用不区分大小写的匹配（使用 LOWER() 或 ILIKE）

2. **warningMsg 字段**：
   - **不需要实现**，该字段预留用于未来接入AI能力接口生成预警消息
   - 接口返回的数据中可以不包含此字段，或者返回 null/空字符串

3. **阈值配置位置**：
   - 预警等级的标准差阈值配置必须写在代码文件的最顶部
   - 使用常量或配置文件的方式，方便后续修改调整

4. **性能优化**：
   - 如果数据量较大，考虑使用缓存机制
   - 标准差计算可以使用数据库的聚合函数（如MySQL的STDDEV）或者在后端计算
   - 自定义分类字段的关联查询建议使用 LEFT JOIN，避免丢失数据

5. **异常处理**：
   - 处理除零错误（平均值为0的情况）
   - 处理数据缺失的情况（某个时间维度没有数据）
   - 返回空数组而非null，避免前端处理异常
   - 处理 `product_items` 表中没有对应记录的情况（返回 null）

## 示例返回数据

```json
[
  {
    "id": "SKU-1001",
    "name": "成品 — 舒适运动鞋",
    "image": "https://example.com/image1.jpg",
    "visitorsAvg": [4200, 4500, 4700, 4900, 5100],
    "visitorsStd": [200, 210, 180, 150, 120],
    "adCostAvg": [1200.5, 1400.2, 1500.3, 1600.0, 1700.9],
    "adCostStd": [150.3, 120.5, 110.2, 90.1, 80.0],
    "salesAvg": [32000, 33000, 34000, 35000, 36000],
    "salesStd": [1200, 1100, 900, 800, 700],
    "warningLevel": "正常",
    "custom_category_1": "运动鞋类",
    "custom_category_2": "男鞋",
    "custom_category_3": null,
    "custom_category_4": null
  },
  {
    "id": "SKU-2002",
    "name": "成品 — 高端皮带",
    "image": null,
    "visitorsAvg": [800, 760, 700, 650, 620],
    "visitorsStd": [90, 85, 80, 70, 60],
    "adCostAvg": [900, 880, 860, 840, 820],
    "adCostStd": [200, 220, 240, 260, 280],
    "salesAvg": [5000, 4800, 4500, 4200, 4000],
    "salesStd": [400, 420, 450, 480, 500],
    "warningLevel": "轻微",
    "custom_category_1": "配饰",
    "custom_category_2": "皮带",
    "custom_category_3": "男士",
    "custom_category_4": null
  }
]
```

## SQL 查询示例

### 基础查询（包含自定义分类字段）

```sql
SELECT 
  p.id,
  p.name,
  p.image,
  -- 访客数据、广告花费、销售额等字段...
  pi.custom_category_1,
  pi.custom_category_2,
  pi.custom_category_3,
  pi.custom_category_4
FROM products p
LEFT JOIN product_items pi ON p.id = pi.product_id AND pi.shop_id = ?
WHERE p.shop_id = ?
  AND p.date = ?
  -- 如果提供了 customCategory 参数，添加以下筛选条件
  -- AND (
  --   LOWER(pi.custom_category_1) LIKE LOWER(?) OR
  --   LOWER(pi.custom_category_2) LIKE LOWER(?) OR
  --   LOWER(pi.custom_category_3) LIKE LOWER(?) OR
  --   LOWER(pi.custom_category_4) LIKE LOWER(?)
  -- )
ORDER BY p.id;
```

**注意：**
- 使用 `LEFT JOIN` 确保即使 `product_items` 表中没有对应记录，也能返回产品数据
- 如果 `product_items` 表中没有记录，自定义分类字段将返回 `NULL`
- 筛选时使用 `LOWER()` 函数实现不区分大小写的匹配
- 使用 `LIKE` 操作符支持部分匹配（前端会进行包含匹配）

## 开发建议

1. **数据库关联查询**：
   - 使用 `LEFT JOIN` 关联 `product_items` 表获取自定义分类字段
   - 确保关联条件正确：`products.id = product_items.product_id` 且 `product_items.shop_id = shopID`
   - 考虑为 `product_items.product_id` 和 `product_items.shop_id` 添加索引，提高查询性能

2. **自定义分类筛选**：
   - 当 `customCategory` 参数存在时，在 WHERE 子句中添加筛选条件
   - 使用不区分大小写的匹配（LOWER() 或数据库特定的函数）
   - 支持部分匹配（LIKE '%value%'）

3. **数据处理**：
   - 使用数据库聚合函数计算平均值和标准差，提高性能
   - 将预警等级计算逻辑封装成独立函数，便于测试和维护
   - 处理 NULL 值：如果自定义分类字段为 NULL，返回 `null`（JSON 中）

4. **其他建议**：
   - 添加日志记录，方便排查问题和优化算法
   - 考虑添加分页功能（如果需要）
   - 考虑添加筛选功能（如按预警等级筛选）
   - 测试关联查询的性能，如果数据量大，考虑优化查询语句

---

## 相关接口说明

### 获取自定义分类选项列表接口（可选）

前端还会调用 `/api/product-items/custom-categories` 接口来获取自定义分类选项列表，用于填充下拉选择框。

**接口路径**: `GET /api/product-items/custom-categories`

**请求参数**:
- `shopID` (string, 必填): 店铺ID

**响应格式**:
```json
{
  "success": true,
  "data": ["分类1", "分类2", "分类3", ...]
}
```

**说明**:
- 此接口用于获取指定店铺下所有商品的唯一自定义分类值列表
- 返回一个字符串数组，包含 `custom_category_1` 到 `custom_category_4` 中所有非空的唯一值
- 如果此接口未实现，前端会从产品列表接口的返回数据中自动提取分类选项（前端已有此逻辑）
- 详细的接口规范请参考 `custom_category_api_prompt.md` 文件

**SQL 查询示例**:
```sql
SELECT DISTINCT custom_category
FROM (
  SELECT custom_category_1 as custom_category FROM product_items WHERE shop_id = ? AND custom_category_1 IS NOT NULL AND custom_category_1 != ''
  UNION
  SELECT custom_category_2 as custom_category FROM product_items WHERE shop_id = ? AND custom_category_2 IS NOT NULL AND custom_category_2 != ''
  UNION
  SELECT custom_category_3 as custom_category FROM product_items WHERE shop_id = ? AND custom_category_3 IS NOT NULL AND custom_category_3 != ''
  UNION
  SELECT custom_category_4 as custom_category FROM product_items WHERE shop_id = ? AND custom_category_4 IS NOT NULL AND custom_category_4 != ''
) AS all_categories
ORDER BY custom_category;
```

