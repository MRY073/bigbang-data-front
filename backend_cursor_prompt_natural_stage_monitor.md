# 后台开发提示词：添加【自然流商品监控】功能

## 需求概述

需要实现【自然流商品监控】功能，所有逻辑与【成品链接监控】完全等效。该功能用于监控处于自然流阶段的商品，提供访客数、广告花费、销售额等指标的监控和分析。

## 参考实现

请参考【成品链接监控】的完整实现逻辑，包括：
- 数据查询逻辑
- 指标计算逻辑
- 波动率计算逻辑
- 警告级别判断逻辑
- AI建议生成逻辑

## 需要实现的 API 接口

### 1. 获取自然流商品监控列表

**接口路径：** `GET /api/natural/stage/monitor/list`

**请求参数：**
```typescript
{
  shopID: string;        // 店铺ID
  shopName: string;      // 店铺名称
  date: string;          // 查询日期，格式：YYYY-MM-DD
  customCategory?: string; // 可选，自定义分类筛选
}
```

**响应数据结构：**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
  data: ProductCard[];
}

interface ProductCard {
  id: string;                    // 商品ID
  name: string;                  // 商品名称
  image?: string | null;         // 商品主图URL
  visitorsAvg: number[];         // 日均访客数数组，顺序：[30日, 15日, 7日, 3日, 1日]
  visitorsVolatilityBaseline: Volatility[];  // 访客数波动率（相对60日基准）
  adCostAvg: number[];           // 日均广告花费数组，顺序：[30日, 15日, 7日, 3日, 1日]
  adCostVolatilityBaseline: Volatility[];    // 广告花费波动率（相对60日基准）
  salesAvg: number[];            // 日均销售额数组，顺序：[30日, 15日, 7日, 3日, 1日]
  salesVolatilityBaseline: Volatility[];     // 销售额波动率（相对60日基准）
  warningLevel: "严重" | "一般" | "轻微" | "正常";  // 警告级别
  warningMessages?: string[];    // 警告消息数组
  custom_category_1?: string | null;  // 自定义分类1
  custom_category_2?: string | null;  // 自定义分类2
  custom_category_3?: string | null;  // 自定义分类3
  custom_category_4?: string | null;  // 自定义分类4
}

interface Volatility {
  window: number;        // 滑动窗口天数：1, 3, 7, 15, 30
  direction: "+" | "-";  // 变化方向：上升或下降
  strength: number;      // 变化强度（百分比）
  level: "极小" | "轻微" | "一般" | "明显" | "剧烈";  // 变化等级
}
```

**业务逻辑：**

1. **商品筛选条件：**
   - 查询指定店铺（shopID）的商品
   - 商品必须处于自然流阶段（natural_stage）
   - 查询日期（date）必须在自然流阶段的时间范围内（natural_stage_start_time <= date <= natural_stage_end_time）
   - 如果提供了 customCategory，需要按自定义分类筛选

2. **指标计算：**
   - **日均访客数（visitorsAvg）：** 计算最近 30日、15日、7日、3日、1日的日均访客数
   - **日均广告花费（adCostAvg）：** 计算最近 30日、15日、7日、3日、1日的日均广告花费
   - **日均销售额（salesAvg）：** 计算最近 30日、15日、7日、3日、1日的日均销售额

3. **波动率计算（visitorsVolatilityBaseline、adCostVolatilityBaseline、salesVolatilityBaseline）：**
   - 基准期：最近 60 日的平均值
   - 短期窗口：1日、3日、7日、15日、30日
   - 对每个短期窗口，计算相对于 60 日基准的变化
   - 计算公式：`strength = |(短期平均值 - 60日平均值) / 60日平均值| * 100`
   - 方向判断：`direction = (短期平均值 > 60日平均值) ? "+" : "-"`
   - 等级判断（根据 strength 值）：
     - 极小：strength < 5%
     - 轻微：5% <= strength < 15%
     - 一般：15% <= strength < 30%
     - 明显：30% <= strength < 50%
     - 剧烈：strength >= 50%

4. **警告级别判断（warningLevel）：**
   - 根据波动率计算警告级别
   - 规则（参考成品链接监控）：
     - **严重：** 存在"明显"或"剧烈"级别的下降趋势，且影响多个指标
     - **一般：** 存在"明显"或"剧烈"级别的波动，但趋势可能上升
     - **轻微：** 存在"一般"级别的波动
     - **正常：** 波动在"轻微"或"极小"级别

5. **警告消息生成（warningMessages）：**
   - 根据波动情况生成具体的警告消息
   - 例如：
     - "近1/3天访客下降，建议关注"
     - "广告费用波动较大，ROI 下降"
     - "流量与转化骤降，需立刻处理"

### 2. 获取自然流商品监控的AI建议（单个商品）

**接口路径：** `GET /api/natural/stage/monitor/ai-suggestion`

**请求参数：**
```typescript
{
  shopID: string;
  shopName: string;
  date: string;          // 查询日期
  productID: string;     // 商品ID
  productName: string;   // 商品名称
}
```

**响应数据结构：**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
  data: {
    suggestion?: string;  // AI建议内容
  };
}
```

**业务逻辑：**
- 根据商品的监控数据生成AI建议
- 参考成品链接监控的AI建议生成逻辑
- 建议内容应针对自然流阶段的特点进行优化

### 3. 批量获取自然流商品监控的AI建议

**接口路径：** `POST /api/natural/stage/monitor/batch-ai-suggestion`

**请求参数：**
```typescript
{
  shopID: string;
  shopName: string;
  date: string;
}
```

**响应数据结构：**
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
  data: {
    status: "new" | "running" | "exists";  // 任务状态
    message?: string;
  };
}
```

**业务逻辑：**
- 为指定店铺和日期的所有自然流商品批量生成AI建议
- 任务状态说明：
  - `new`: 新增任务，开始处理
  - `running`: 正在执行同条件的任务，请等待
  - `exists`: 已经存在该条件的AI建议，可以覆盖
- 建议使用异步任务队列处理，避免长时间阻塞

## 数据查询逻辑

### 1. 商品筛选SQL示例

```sql
-- 查询处于自然流阶段的商品
SELECT 
  p.product_id,
  p.product_name,
  p.product_image,
  p.custom_category_1,
  p.custom_category_2,
  p.custom_category_3,
  p.custom_category_4
FROM products p
WHERE p.shop_id = ?
  AND p.natural_stage_start_time <= ?
  AND p.natural_stage_end_time >= ?
  -- 可选：自定义分类筛选
  AND (? IS NULL OR (
    p.custom_category_1 = ? OR
    p.custom_category_2 = ? OR
    p.custom_category_3 = ? OR
    p.custom_category_4 = ?
  ))
```

### 2. 指标数据查询

需要从商品数据表或统计表中查询以下数据：
- 访客数（visitors）
- 广告花费（ad_cost）
- 销售额（sales）

**时间范围：**
- 查询日期范围：从查询日期往前推 60 天（用于计算基准）
- 需要按天聚合数据

**SQL示例：**
```sql
-- 查询商品在指定日期范围内的每日数据
SELECT 
  DATE(stat_date) as date,
  SUM(visitors) as visitors,
  SUM(ad_cost) as ad_cost,
  SUM(sales) as sales
FROM product_daily_stats
WHERE product_id = ?
  AND stat_date >= DATE_SUB(?, INTERVAL 60 DAY)
  AND stat_date <= ?
GROUP BY DATE(stat_date)
ORDER BY date DESC
```

## 实现要点

### 1. 代码复用

- 参考【成品链接监控】的实现代码
- 尽量复用现有的指标计算、波动率计算、警告判断等逻辑
- 通过配置或参数区分不同的监控类型（finished vs natural）

### 2. 性能优化

- 对于大量商品的批量AI建议，使用异步任务处理
- 指标计算可以考虑缓存，避免重复计算
- 数据库查询优化，确保索引正确

### 3. 数据一致性

- 确保计算逻辑与【成品链接监控】完全一致
- 时间格式统一使用 ISO 8601 格式
- 数值精度保持一致（保留2位小数）

### 4. 错误处理

- 处理商品数据不存在的情况
- 处理统计数据不完整的情况（某些日期可能没有数据）
- 处理除零错误（计算平均值时）

## 测试要点

### 1. 单元测试

- 测试指标计算逻辑（日均值计算）
- 测试波动率计算逻辑
- 测试警告级别判断逻辑

### 2. 集成测试

- 测试 GET /api/natural/stage/monitor/list 接口
- 测试 GET /api/natural/stage/monitor/ai-suggestion 接口
- 测试 POST /api/natural/stage/monitor/batch-ai-suggestion 接口

### 3. 边界情况测试

- 测试没有统计数据的情况
- 测试数据不完整的情况（某些日期缺失）
- 测试商品不在自然流阶段的情况
- 测试自定义分类筛选

## 验收标准

完成开发后，需要验证以下功能：

- [ ] GET /api/natural/stage/monitor/list 接口返回正确的商品列表和指标数据
- [ ] 指标计算逻辑正确（日均值、波动率）
- [ ] 警告级别判断准确
- [ ] 警告消息生成合理
- [ ] AI建议接口正常工作
- [ ] 批量AI建议接口支持异步处理
- [ ] 自定义分类筛选功能正常
- [ ] 所有相关测试用例通过
- [ ] 性能满足要求（响应时间、并发处理能力）

## 参考前端实现

前端已完成的修改：
- 视图文件：`src/views/naturalStageMonitor/index.vue`
- API接口：`src/api/monitor.ts` 中的 `getNaturalStageMonitorList`、`getNaturalStageMonitorAISuggestion`、`batchGetNaturalStageMonitorAISuggestion`
- 路由配置：`src/router/modules/naturalStageMonitor.ts`

前端期望的接口格式已在本文档中说明，请确保后端实现与前端保持一致。

## 与成品链接监控的对应关系

| 功能 | 成品链接监控 | 自然流商品监控 |
|------|------------|--------------|
| 列表接口 | GET /api/finished/link/monitor/list | GET /api/natural/stage/monitor/list |
| AI建议接口 | GET /api/finished/link/monitor/ai-suggestion | GET /api/natural/stage/monitor/ai-suggestion |
| 批量AI建议 | POST /api/finished/link/monitor/batch-ai-suggestion | POST /api/natural/stage/monitor/batch-ai-suggestion |
| 商品筛选条件 | product_stage | natural_stage |
| 时间字段 | product_stage_start_time, product_stage_end_time | natural_stage_start_time, natural_stage_end_time |

**提示：** 在实现过程中，可以参考【成品链接监控】的完整实现，保持代码风格和逻辑的一致性。只需要将商品筛选条件从 `product_stage` 改为 `natural_stage`，将接口路径从 `/api/finished/link/monitor/` 改为 `/api/natural/stage/monitor/` 即可。

