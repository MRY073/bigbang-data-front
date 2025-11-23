# 阶段商品列表接口增强版开发提示词

## 接口概述

广告分析模块需要增强现有的阶段商品列表接口，新增以下功能：
1. **支持自定义分类筛选**：根据商品的自定义分类字段进行筛选
2. **支持分页查询**：支持分页参数，避免一次性返回大量数据
3. **支持排序功能**：支持按广告花费、广告销售额、ROI进行排序

---

## 接口信息

**接口路径**: `/api/ad-analysis/stage-products`  
**请求方式**: `GET`  
**接口用途**: 获取指定日期、指定阶段、指定店铺的商品列表，支持自定义分类筛选、分页和排序

---

## 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| date | string | 是 | 日期，格式：`YYYY-MM-DD`，例如：`2024-01-15` |
| shopID | string | 是 | 店铺ID，例如：`1489850435` |
| stage | string | 是 | 阶段标识，可选值：`product_stage`（成品阶段）、`testing_stage`（测款阶段）、`potential_stage`（潜力阶段）、`abandoned_stage`（放弃阶段）、`no_stage`（其他阶段） |
| shopName | string | 否 | 店铺名称，例如：`Modern Nest|泰国`（用于日志记录） |
| customCategory | string | 否 | 自定义分类值，用于筛选商品。如果提供，需要匹配商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中的任意一个 |
| page | number | 否 | 页码，从1开始，默认为 `1` |
| pageSize | number | 否 | 每页数量，默认为 `20`，可选值：10, 20, 50, 100 |
| sortBy | string | 否 | 排序字段，可选值：`ad_spend`（广告花费）、`ad_sales`（广告销售额）、`roi`（ROI），默认为 `ad_spend` |
| sortOrder | string | 否 | 排序顺序，可选值：`asc`（升序）、`desc`（降序），默认为 `desc` |

---

## 返回数据结构

```typescript
type ApiResponse = {
  success: boolean;           // 请求是否成功
  message?: string;           // 提示信息（成功或错误信息）
  error?: string;             // 错误信息（当success为false时）
  data?: {
    items: Array<{            // 商品列表
      product_id: string;     // 商品ID
      title: string;          // 商品标题
      main_image: string;     // 主图URL
      ad_spend: number;       // 广告花费（泰铢）
      ad_sales: number;       // 广告销售额（泰铢）
      roi: number;           // ROI（投资回报率 = 广告销售额 / 广告花费）
    }>;
    total: number;            // 总记录数
    page: number;            // 当前页码
    pageSize: number;        // 每页数量
  };
};
```

---

## 功能实现说明

### 1. 自定义分类筛选

**筛选逻辑**：
- 如果 `customCategory` 参数存在且不为空，需要筛选出满足以下条件的商品：
  - 商品的 `custom_category_1`、`custom_category_2`、`custom_category_3`、`custom_category_4` 字段中**任意一个**等于 `customCategory` 的值
- 如果 `customCategory` 参数不存在或为空，则不进行自定义分类筛选

**SQL示例（伪代码）**：
```sql
WHERE (
  custom_category_1 = :customCategory OR
  custom_category_2 = :customCategory OR
  custom_category_3 = :customCategory OR
  custom_category_4 = :customCategory
)
```

### 2. 分页功能

**实现要求**：
- 使用 `page` 和 `pageSize` 参数进行分页
- 计算总记录数 `total`（在应用筛选条件后）
- 返回指定页的数据
- 如果 `page` 或 `pageSize` 未提供，使用默认值（page=1, pageSize=20）
- 验证 `pageSize` 的值，只允许：10, 20, 50, 100，其他值使用默认值 20

**SQL示例（伪代码）**：
```sql
LIMIT :pageSize OFFSET (:page - 1) * :pageSize
```

### 3. 排序功能

**排序字段映射**：
- `ad_spend` → 广告花费字段
- `ad_sales` → 广告销售额字段
- `roi` → ROI字段（如果数据库中没有直接存储，需要计算：`ad_sales / ad_spend`）

**排序逻辑**：
- 根据 `sortBy` 参数选择排序字段
- 根据 `sortOrder` 参数决定升序（asc）或降序（desc）
- 默认排序：`sortBy=ad_spend, sortOrder=desc`（按广告花费降序）

**SQL示例（伪代码）**：
```sql
ORDER BY 
  CASE :sortBy
    WHEN 'ad_spend' THEN ad_spend
    WHEN 'ad_sales' THEN ad_sales
    WHEN 'roi' THEN (ad_sales / NULLIF(ad_spend, 0))
  END
  :sortOrder
```

**注意事项**：
- 如果 `ad_spend` 为 0，ROI 计算时应该返回 0 或 NULL，避免除零错误
- 建议使用 `NULLIF(ad_spend, 0)` 或类似函数处理

---

## 数据计算说明

### 1. 筛选条件

- **日期筛选**：仅统计指定日期的数据
- **店铺筛选**：仅统计指定店铺的数据
- **阶段筛选**：仅统计指定阶段的商品
- **广告花费筛选**：仅返回有广告花费的商品（`ad_spend > 0`）
- **自定义分类筛选**：如果提供了 `customCategory`，需要匹配商品的任意一个自定义分类字段

### 2. 数据聚合

- **广告花费（ad_spend）**：指定日期、指定店铺、指定阶段的广告花费总和
- **广告销售额（ad_sales）**：指定日期、指定店铺、指定阶段的广告销售额总和
- **ROI（roi）**：`ad_sales / ad_spend`，如果 `ad_spend` 为 0，则 ROI 为 0

### 3. 阶段字段映射

确保数据库中的阶段字段值与接口参数值一致：
- `product_stage` → 成品阶段
- `testing_stage` → 测款阶段
- `potential_stage` → 潜力阶段
- `abandoned_stage` → 放弃阶段
- `no_stage` → 其他阶段

---

## 接口调用示例

### 请求示例 1：基础查询（无分页、无排序、无自定义分类）

```
GET /api/ad-analysis/stage-products?date=2024-01-15&shopID=1489850435&stage=product_stage&shopName=Modern%20Nest%7C%E6%B3%B0%E5%9B%BD
```

### 请求示例 2：带自定义分类筛选

```
GET /api/ad-analysis/stage-products?date=2024-01-15&shopID=1489850435&stage=product_stage&customCategory=热销商品
```

### 请求示例 3：带分页和排序

```
GET /api/ad-analysis/stage-products?date=2024-01-15&shopID=1489850435&stage=product_stage&page=1&pageSize=20&sortBy=roi&sortOrder=desc
```

### 请求示例 4：完整参数

```
GET /api/ad-analysis/stage-products?date=2024-01-15&shopID=1489850435&stage=product_stage&customCategory=热销商品&page=2&pageSize=50&sortBy=ad_sales&sortOrder=asc
```

### 响应示例

```json
{
  "success": true,
  "message": "查询成功",
  "data": {
    "items": [
      {
        "product_id": "123456789",
        "title": "示例商品标题",
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
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## 错误处理

### 参数验证错误

如果参数不合法，返回：
```json
{
  "success": false,
  "error": "参数错误：pageSize 必须是 10, 20, 50, 100 之一",
  "message": "参数验证失败"
}
```

### 数据查询错误

如果查询失败，返回：
```json
{
  "success": false,
  "error": "数据库查询失败",
  "message": "查询失败，请稍后重试"
}
```

---

## 性能优化建议

1. **索引优化**：
   - 为 `date`、`shopID`、`stage` 字段建立联合索引
   - 为自定义分类字段（`custom_category_1` 到 `custom_category_4`）建立索引
   - 为 `ad_spend`、`ad_sales` 字段建立索引（用于排序）

2. **查询优化**：
   - 先应用筛选条件，再进行排序和分页
   - 使用 `COUNT(*)` 计算总数时，考虑使用近似值或缓存（如果数据量大）

3. **缓存策略**：
   - 对于相同参数的查询，可以考虑短期缓存（如5分钟）
   - 注意缓存失效策略，确保数据实时性

---

## 注意事项

1. **阶段名称映射**：确保数据库中的阶段字段值与接口参数值一致，如不一致需要做映射转换
2. **时区处理**：确保日期计算使用正确的时区
3. **数据一致性**：确保广告花费数据和销售额数据的时间维度一致（都按天统计）
4. **空值处理**：所有数值字段不应返回 `null`，应返回 `0`
5. **图片URL处理**：确保主图URL完整可用，如果图片不存在，返回占位图URL或空字符串
6. **数据过滤**：仅返回有广告花费的商品（`ad_spend > 0`），避免返回无意义的空数据
7. **自定义分类匹配**：自定义分类的匹配是**或**关系，只要任意一个字段匹配即可
8. **分页边界**：如果请求的页码超出范围，返回空数组，但 `total` 应该返回实际总数
9. **排序默认值**：如果 `sortBy` 或 `sortOrder` 参数不合法，使用默认值（`sortBy=ad_spend, sortOrder=desc`）

---

## 与现有接口的关系

此接口与现有的两个接口配合使用：

1. **单日广告占比接口** (`/api/ad-analysis/ad-ratio`)：获取各阶段的总体消耗数据
2. **广告消耗趋势接口** (`/api/ad-analysis/ad-trend`)：获取各阶段的趋势数据
3. **阶段商品列表接口** (`/api/ad-analysis/stage-products`)：获取各阶段的详细商品列表（本接口）

这三个接口都支持 `customCategory` 参数，确保筛选条件一致。

---

## 测试用例

### 测试用例 1：基础查询
- 输入：`date=2024-01-15, shopID=1489850435, stage=product_stage`
- 预期：返回该阶段的所有商品（第一页，20条，按广告花费降序）

### 测试用例 2：自定义分类筛选
- 输入：`date=2024-01-15, shopID=1489850435, stage=product_stage, customCategory=热销商品`
- 预期：只返回自定义分类为"热销商品"的商品

### 测试用例 3：分页查询
- 输入：`date=2024-01-15, shopID=1489850435, stage=product_stage, page=2, pageSize=10`
- 预期：返回第2页的10条数据，`total` 为总记录数

### 测试用例 4：排序查询
- 输入：`date=2024-01-15, shopID=1489850435, stage=product_stage, sortBy=roi, sortOrder=desc`
- 预期：返回按ROI降序排列的商品

### 测试用例 5：完整参数
- 输入：所有参数都提供
- 预期：按照所有条件筛选、排序、分页后返回结果

### 测试用例 6：边界情况
- 输入：`page=999`（超出范围）
- 预期：返回空数组，但 `total` 为实际总数

### 测试用例 7：参数验证
- 输入：`pageSize=999`（不合法）
- 预期：使用默认值 20，或返回错误信息

---

## 前端调用示例

### TypeScript 调用示例

```typescript
import { getStageProducts } from "@/api/adAnalysis";

// 基础查询
const result1 = await getStageProducts({
  date: "2024-01-15",
  shopID: "1489850435",
  shopName: "Modern Nest|泰国",
  stage: "product_stage"
});

// 带自定义分类
const result2 = await getStageProducts({
  date: "2024-01-15",
  shopID: "1489850435",
  shopName: "Modern Nest|泰国",
  stage: "product_stage",
  customCategory: "热销商品"
});

// 带分页和排序
const result3 = await getStageProducts({
  date: "2024-01-15",
  shopID: "1489850435",
  shopName: "Modern Nest|泰国",
  stage: "product_stage",
  page: 1,
  pageSize: 20,
  sortBy: "roi",
  sortOrder: "desc"
});
```

---

## 版本历史

- **v1.0**（原始版本）：基础查询功能
- **v2.0**（当前版本）：新增自定义分类筛选、分页、排序功能

---

## 开发检查清单

- [ ] 实现自定义分类筛选逻辑
- [ ] 实现分页功能（page, pageSize, total）
- [ ] 实现排序功能（sortBy, sortOrder）
- [ ] 添加参数验证
- [ ] 添加错误处理
- [ ] 优化数据库查询（索引、SQL优化）
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 更新API文档
- [ ] 性能测试（大数据量场景）

