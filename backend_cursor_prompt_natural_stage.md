# 后台开发提示词：添加【自然流阶段】支持

## 需求概述

在前端已添加【自然流阶段】（natural stage）的基础上，需要在后端系统中同步添加对该阶段的支持。自然流阶段的逻辑与其他阶段（测款阶段、潜力阶段、成品阶段、放弃阶段）完全一致。

## 需要完成的任务

### 1. 数据库变更

#### 1.1 商品表添加字段

需要在商品相关表中添加 `natural_stage_start_time` 和 `natural_stage_end_time` 两个字段，类型与其他阶段字段一致（通常是 `DATETIME` 或 `TIMESTAMP`，允许为 NULL）。

**参考现有字段结构：**
- `testing_stage_start_time` / `testing_stage_end_time`
- `potential_stage_start_time` / `potential_stage_end_time`
- `product_stage_start_time` / `product_stage_end_time`
- `abandoned_stage_start_time` / `abandoned_stage_end_time`

**需要添加：**
- `natural_stage_start_time` / `natural_stage_end_time`

**数据库迁移脚本示例（MySQL）：**
```sql
ALTER TABLE products 
ADD COLUMN natural_stage_start_time DATETIME NULL COMMENT '自然流阶段开始时间',
ADD COLUMN natural_stage_end_time DATETIME NULL COMMENT '自然流阶段结束时间';
```

**注意：**
- 字段类型和约束应与现有阶段字段保持一致
- 如果使用了数据库迁移工具（如 Alembic、Flyway 等），请创建相应的迁移文件
- 确保字段可以为 NULL，因为新商品可能没有设置自然流阶段

### 2. 后端 API 接口更新

#### 2.1 获取商品列表接口（GET /api/products）

**需要修改：**
- 在返回的商品数据中添加 `natural_stage` 字段
- 字段结构与现有阶段字段一致：`{ start_time: string | null, end_time: string | null }`

**返回数据结构示例：**
```json
{
  "success": true,
  "data": [
    {
      "product_id": "123456",
      "product_name": "商品名称",
      "product_image": "https://...",
      "testing_stage": {
        "start_time": "2025-01-01T00:00:00.000Z",
        "end_time": "2025-01-31T23:59:59.000Z"
      },
      "potential_stage": {
        "start_time": null,
        "end_time": null
      },
      "product_stage": {
        "start_time": null,
        "end_time": null
      },
      "abandoned_stage": {
        "start_time": null,
        "end_time": null
      },
      "natural_stage": {
        "start_time": "2025-02-01T00:00:00.000Z",
        "end_time": "2025-02-28T23:59:59.000Z"
      },
      "custom_category_1": "...",
      "custom_category_2": "...",
      "custom_category_3": "...",
      "custom_category_4": "..."
    }
  ]
}
```

#### 2.2 更新商品阶段接口（PUT /api/products/stage）

**需要修改：**
- 在 `stage_type` 参数中支持 `"natural"` 值
- 处理 `natural_stage_start_time` 和 `natural_stage_end_time` 的更新逻辑

**请求参数示例：**
```json
{
  "product_id": "123456",
  "shopID": "1489850435",
  "shopName": "店铺名称",
  "stage_type": "natural",
  "start_time": "2025-02-01T00:00:00.000Z",
  "end_time": "2025-02-28T23:59:59.000Z"
}
```

**支持的 stage_type 值：**
- `"testing"` - 测款阶段
- `"potential"` - 潜力阶段
- `"product"` - 成品阶段
- `"abandoned"` - 放弃阶段
- `"natural"` - 自然流阶段（新增）

**实现要点：**
- 验证 `stage_type` 参数，确保包含 `"natural"`
- 更新数据库时，将 `start_time` 写入 `natural_stage_start_time`，`end_time` 写入 `natural_stage_end_time`
- 时间格式处理与其他阶段保持一致（ISO 8601 格式）
- 支持 `start_time` 和 `end_time` 为 `null` 的情况（清空阶段）

### 3. 业务逻辑更新

#### 3.1 阶段优先级计算

如果系统中有计算商品当前阶段的逻辑，需要将自然流阶段加入优先级队列。

**优先级顺序（从高到低）：**
1. `abandoned` - 放弃阶段
2. `product` - 成品阶段
3. `potential` - 潜力阶段
4. `testing` - 测款阶段
5. `natural` - 自然流阶段（新增，优先级最低）

**实现逻辑：**
- 遍历优先级顺序，找到第一个当前时间在 `start_time` 和 `end_time` 范围内的阶段
- 如果多个阶段时间重叠，返回优先级更高的阶段

#### 3.2 时间段重叠校验

如果系统中有校验阶段时间段是否重叠的逻辑，需要将自然流阶段纳入校验范围。

**校验规则：**
- 同一商品的任意两个阶段时间段不能重叠
- 自然流阶段需要与其他所有阶段（testing、potential、product、abandoned）进行重叠校验

#### 3.3 批量更新逻辑

如果系统支持批量更新商品阶段，需要确保自然流阶段也能被批量更新。

### 4. 数据模型/实体类更新

#### 4.1 商品实体类

在商品实体类（Model/Entity）中添加自然流阶段字段：

**示例（Python/SQLAlchemy）：**
```python
class Product(Base):
    # ... 现有字段 ...
    
    natural_stage_start_time = Column(DateTime, nullable=True, comment='自然流阶段开始时间')
    natural_stage_end_time = Column(DateTime, nullable=True, comment='自然流阶段结束时间')
```

**示例（TypeScript/TypeORM）：**
```typescript
@Entity('products')
export class Product {
  // ... 现有字段 ...
  
  @Column({ type: 'datetime', nullable: true })
  natural_stage_start_time: Date | null;
  
  @Column({ type: 'datetime', nullable: true })
  natural_stage_end_time: Date | null;
}
```

#### 4.2 DTO/请求响应模型

更新相关的 DTO（Data Transfer Object）类，添加自然流阶段字段：

**请求 DTO：**
```typescript
interface UpdateStageRequest {
  product_id: string;
  shopID: string;
  shopName: string;
  stage_type: "testing" | "potential" | "product" | "abandoned" | "natural";
  start_time: string | null;
  end_time: string | null;
}
```

**响应 DTO：**
```typescript
interface ProductResponse {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage: { start_time: string | null; end_time: string | null };
  potential_stage: { start_time: string | null; end_time: string | null };
  product_stage: { start_time: string | null; end_time: string | null };
  abandoned_stage: { start_time: string | null; end_time: string | null };
  natural_stage: { start_time: string | null; end_time: string | null }; // 新增
  // ... 其他字段
}
```

### 5. 查询逻辑更新

#### 5.1 商品列表查询

在查询商品列表时，需要：
- SELECT 语句中包含 `natural_stage_start_time` 和 `natural_stage_end_time` 字段
- 将数据库字段转换为 API 响应格式（`natural_stage` 对象）

**SQL 查询示例：**
```sql
SELECT 
  product_id,
  product_name,
  product_image,
  testing_stage_start_time,
  testing_stage_end_time,
  potential_stage_start_time,
  potential_stage_end_time,
  product_stage_start_time,
  product_stage_end_time,
  abandoned_stage_start_time,
  abandoned_stage_end_time,
  natural_stage_start_time,  -- 新增
  natural_stage_end_time,     -- 新增
  custom_category_1,
  custom_category_2,
  custom_category_3,
  custom_category_4
FROM products
WHERE shop_id = ?
```

#### 5.2 阶段更新查询

在更新阶段时，根据 `stage_type` 动态更新对应字段：

**伪代码示例：**
```python
def update_product_stage(product_id, stage_type, start_time, end_time):
    field_map = {
        "testing": ("testing_stage_start_time", "testing_stage_end_time"),
        "potential": ("potential_stage_start_time", "potential_stage_end_time"),
        "product": ("product_stage_start_time", "product_stage_end_time"),
        "abandoned": ("abandoned_stage_start_time", "abandoned_stage_end_time"),
        "natural": ("natural_stage_start_time", "natural_stage_end_time")  # 新增
    }
    
    start_field, end_field = field_map[stage_type]
    # 执行更新操作
    update_query = f"""
        UPDATE products 
        SET {start_field} = ?, {end_field} = ?
        WHERE product_id = ?
    """
```

### 6. 测试要点

#### 6.1 单元测试
- 测试自然流阶段的创建、更新、删除
- 测试自然流阶段与其他阶段的时间段重叠校验
- 测试自然流阶段的优先级计算

#### 6.2 集成测试
- 测试 GET /api/products 接口返回 natural_stage 字段
- 测试 PUT /api/products/stage 接口支持 stage_type="natural"
- 测试自然流阶段的时间格式转换

#### 6.3 边界情况测试
- 测试 start_time 和 end_time 为 null 的情况
- 测试自然流阶段与其他阶段时间重叠的情况
- 测试自然流阶段优先级计算（与其他阶段同时有效时）

### 7. 注意事项

1. **向后兼容性**：
   - 确保现有接口在添加新字段后仍能正常工作
   - 对于没有设置自然流阶段的商品，返回 `null` 值

2. **数据一致性**：
   - 确保数据库字段命名规范与其他阶段保持一致
   - 时间格式统一使用 ISO 8601 格式

3. **性能考虑**：
   - 如果商品表数据量很大，添加新字段时考虑使用在线 DDL 或分批迁移
   - 确保新增字段不影响现有查询性能

4. **代码复用**：
   - 尽量复用现有阶段处理的代码逻辑，避免重复代码
   - 使用配置或映射表来管理阶段类型，便于后续扩展

5. **文档更新**：
   - 更新 API 文档，说明新增的 natural_stage 字段
   - 更新数据库设计文档

### 8. 验收标准

完成开发后，需要验证以下功能：

- [ ] 数据库已添加 `natural_stage_start_time` 和 `natural_stage_end_time` 字段
- [ ] GET /api/products 接口返回数据包含 `natural_stage` 字段
- [ ] PUT /api/products/stage 接口支持 `stage_type="natural"`
- [ ] 自然流阶段的时间段可以正常设置和更新
- [ ] 自然流阶段与其他阶段的时间段重叠校验正常工作
- [ ] 商品当前阶段计算逻辑包含自然流阶段
- [ ] 所有相关测试用例通过

### 9. 参考前端实现

前端已完成的修改：
- 类型定义：`StageType` 包含 `"natural"`
- 数据结构：`BackendProduct` 和 `ProductRow` 包含 `natural_stage` 字段
- UI 界面：表格中新增"自然流阶段"列，包含开始时间和结束时间选择器
- 业务逻辑：自然流阶段参与时间段重叠校验和当前阶段计算

前端期望的后端接口格式已在本文档中说明，请确保后端实现与前端保持一致。

---

**提示：** 在实现过程中，可以参考现有阶段（如 testing_stage、potential_stage）的实现方式，保持代码风格和逻辑的一致性。

