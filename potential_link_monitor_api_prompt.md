# 潜力链接监控接口开发提示词

## 接口信息

**接口路径**: `/api/potential/link/monitor/list`  
**请求方式**: `GET`  
**接口用途**: 获取潜力链接监控数据列表，用于展示产品的访客、广告花费、销售额等指标的变化趋势和预警信息

## 返回数据结构

接口返回一个产品列表，每个产品对象包含以下字段：

```typescript
type ProductCard = {
  id: string;                    // 产品ID（SKU编号）
  name: string;                  // 产品名称
  image?: string | null;         // 产品图片URL（可选，可为null）
  visitorsAvg: number[];         // 日均访客数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  visitorsVolatilityBaseline: Volatility[];  // 访客数短期波动相对长期基准(60)指标
  adCostAvg: number[];           // 日均广告花费数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  adCostVolatilityBaseline: Volatility[];    // 广告花费短期波动相对长期基准(60)指标
  salesAvg: number[];            // 日均销售额数组，按时间维度：[30日, 15日, 7日, 3日, 1日]
  salesVolatilityBaseline: Volatility[];     // 销售额短期波动相对长期基准(60)指标
  warningLevel: "严重" | "一般" | "轻微" | "正常";  // 预警等级
  warningMessages?: string[];    // 预警消息列表（可选）
};

type Volatility = {
  window: number;                // 滑动窗口天数：1, 3, 7, 15, 30
  direction: "+" | "-";          // 变化方向：+ 表示上升，- 表示下降
  strength: number;              // 变化强度（百分比）
  level: "极小" | "轻微" | "一般" | "明显" | "剧烈";  // 变化等级
};
```

## 数据计算说明

### 时间维度说明
- 需要计算5个时间维度的数据：30天、15天、7天、3天、1天
- 每个维度都需要计算：
  - 平均值（Avg）：该时间范围内的日均值
  - 波动率（VolatilityBaseline）：相对于60天长期基准的波动情况

### 波动率计算说明

波动率（VolatilityBaseline）需要计算相对于60天长期基准的变化：

1. **长期基准值（60天）**：
   - 计算过去60天的日均值作为基准
   - 访客数基准：60天日均访客数
   - 广告花费基准：60天日均广告花费
   - 销售额基准：60天日均销售额

2. **短期窗口值**：
   - 对于每个滑动窗口（1天、3天、7天、15天、30天），计算该窗口内的日均值

3. **波动率计算**：
   - 变化强度 = |(短期窗口值 - 长期基准值) / 长期基准值| × 100%
   - 变化方向 = 短期窗口值 > 长期基准值 ? "+" : "-"
   - 变化等级根据变化强度判断：
     - 剧烈：变化强度 >= 50%
     - 明显：变化强度 >= 30% 且 < 50%
     - 一般：变化强度 >= 15% 且 < 30%
     - 轻微：变化强度 >= 5% 且 < 15%
     - 极小：变化强度 < 5%

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
   - 潜力产品是指具有增长潜力但尚未完全成熟的产品

2. **访客数据**（visitorsAvg, visitorsVolatilityBaseline）：
   - 从访问日志或统计数据中获取
   - 计算指定时间范围内的日均访客数
   - 计算相对于60天长期基准的波动率

3. **广告花费数据**（adCostAvg, adCostVolatilityBaseline）：
   - 从广告投放数据表中获取
   - 计算指定时间范围内的日均广告花费
   - 计算相对于60天长期基准的波动率

4. **销售额数据**（salesAvg, salesVolatilityBaseline）：
   - 从订单数据或销售统计表中获取
   - 计算指定时间范围内的日均销售额
   - 计算相对于60天长期基准的波动率

## 请求参数

接口需要接收以下查询参数：

- `shopID` (string, 必需): 店铺ID
- `shopName` (string, 必需): 店铺名称
- `date` (string, 必需): 查询日期，格式：YYYY-MM-DD

## 特殊要求

1. **warningMessages 字段**：
   - 该字段可选，用于返回预警消息列表
   - 可以根据波动率、预警等级等信息生成相应的预警消息
   - 如果不需要，可以返回空数组或省略该字段

2. **阈值配置位置**：
   - 预警等级的标准差阈值配置必须写在代码文件的最顶部
   - 使用常量或配置文件的方式，方便后续修改调整

3. **性能优化**：
   - 如果数据量较大，考虑使用缓存机制
   - 标准差和波动率计算可以使用数据库的聚合函数（如MySQL的STDDEV）或者在后端计算
   - 60天长期基准值可以缓存，避免每次都重新计算

4. **异常处理**：
   - 处理除零错误（平均值为0的情况）
   - 处理数据缺失的情况（某个时间维度没有数据）
   - 返回空数组而非null，避免前端处理异常
   - 如果60天数据不足，可以使用现有数据计算基准值，或返回默认值

5. **潜力产品筛选**：
   - 潜力产品是指具有增长潜力但尚未完全成熟的产品
   - 可以根据业务规则筛选潜力产品，例如：增长率较高、但销量尚未达到成品级别的产品

## 示例返回数据

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "SKU-1001",
      "name": "潜力 — 舒适运动鞋",
      "image": "https://example.com/image1.jpg",
      "visitorsAvg": [4200, 4500, 4700, 4900, 5100],
      "visitorsVolatilityBaseline": [
        { "window": 3, "direction": "+", "strength": 18.6, "level": "轻微" },
        { "window": 7, "direction": "+", "strength": 15.2, "level": "轻微" },
        { "window": 15, "direction": "+", "strength": 12.3, "level": "轻微" },
        { "window": 30, "direction": "+", "strength": 8.5, "level": "极小" }
      ],
      "adCostAvg": [1200.5, 1400.2, 1500.3, 1600.0, 1700.9],
      "adCostVolatilityBaseline": [
        { "window": 3, "direction": "+", "strength": 12.8, "level": "轻微" },
        { "window": 7, "direction": "+", "strength": 10.5, "level": "轻微" },
        { "window": 15, "direction": "+", "strength": 8.1, "level": "极小" },
        { "window": 30, "direction": "+", "strength": 5.2, "level": "极小" }
      ],
      "salesAvg": [32000, 33000, 34000, 35000, 36000],
      "salesVolatilityBaseline": [
        { "window": 3, "direction": "+", "strength": 13.7, "level": "轻微" },
        { "window": 7, "direction": "+", "strength": 11.5, "level": "轻微" },
        { "window": 15, "direction": "+", "strength": 9.2, "level": "极小" },
        { "window": 30, "direction": "+", "strength": 6.8, "level": "极小" }
      ],
      "warningLevel": "正常",
      "warningMessages": []
    },
    {
      "id": "SKU-2002",
      "name": "潜力 — 高端皮带",
      "image": null,
      "visitorsAvg": [800, 760, 700, 650, 620],
      "visitorsVolatilityBaseline": [
        { "window": 3, "direction": "-", "strength": 35.5, "level": "一般" },
        { "window": 7, "direction": "-", "strength": 25.0, "level": "一般" },
        { "window": 15, "direction": "-", "strength": 12.5, "level": "轻微" },
        { "window": 30, "direction": "-", "strength": 5.0, "level": "极小" }
      ],
      "adCostAvg": [900, 880, 860, 840, 820],
      "adCostVolatilityBaseline": [
        { "window": 3, "direction": "-", "strength": 8.9, "level": "极小" },
        { "window": 7, "direction": "-", "strength": 6.7, "level": "极小" },
        { "window": 15, "direction": "-", "strength": 4.4, "level": "极小" },
        { "window": 30, "direction": "-", "strength": 2.2, "level": "极小" }
      ],
      "salesAvg": [5000, 4800, 4500, 4200, 4000],
      "salesVolatilityBaseline": [
        { "window": 3, "direction": "-", "strength": 30.0, "level": "明显" },
        { "window": 7, "direction": "-", "strength": 20.0, "level": "一般" },
        { "window": 15, "direction": "-", "strength": 10.0, "level": "轻微" },
        { "window": 30, "direction": "-", "strength": 4.0, "level": "极小" }
      ],
      "warningLevel": "轻微",
      "warningMessages": ["近1/3天访客下降，建议关注"]
    }
  ]
}
```

## AI建议接口

**接口路径**: `/api/potential/link/monitor/ai-suggestion`  
**请求方式**: `GET`  
**接口用途**: 获取针对特定潜力产品的AI建议

### 请求参数

- `shopID` (string, 必需): 店铺ID
- `shopName` (string, 必需): 店铺名称
- `date` (string, 必需): 查询日期，格式：YYYY-MM-DD
- `productID` (string, 必需): 产品ID
- `productName` (string, 必需): 产品名称

### 返回数据

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "suggestion": "基于当前数据分析，该潜力产品在近期表现出良好的增长趋势。建议：1. 继续保持当前广告投入水平；2. 关注访客转化率的提升；3. 可以考虑扩大库存以应对潜在的需求增长。"
  }
}
```

## 开发建议

1. 使用数据库聚合函数计算平均值和标准差，提高性能
2. 将预警等级计算逻辑封装成独立函数，便于测试和维护
3. 将波动率计算逻辑封装成独立函数，便于复用
4. 添加日志记录，方便排查问题和优化算法
5. 考虑添加分页功能（如果需要）
6. 考虑添加筛选功能（如按预警等级筛选）
7. 60天长期基准值可以每日计算一次并缓存，避免实时计算影响性能
8. 潜力产品的筛选规则需要与业务团队确认，确保筛选逻辑符合业务需求

