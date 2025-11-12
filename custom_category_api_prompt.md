# 自定义分类管理 - 后端接口开发提示词

## 需求概述
需要为自定义分类管理功能开发相应的后端接口。前端页面路径：`/custom-category`，用于管理商品的自定义分类字段。

## 数据库表结构
表名：`product_items`

字段说明：
- `id`: 商品主键ID（自增）
- `product_id`: 商品ID（字符串，唯一标识）
- `product_name`: 商品名称
- `product_image`: 商品图片URL（可为空）
- `custom_category_1`: 自定义分类1（可为空）
- `custom_category_2`: 自定义分类2（可为空）
- `custom_category_3`: 自定义分类3（可为空）
- `custom_category_4`: 自定义分类4（可为空）
- `shop_id`: 店铺ID（用于关联店铺）
- 其他字段：根据实际业务需要添加

## 接口需求

### 1. 获取商品列表接口

**接口路径：** `GET /api/product-items`

**请求参数（Query Parameters）：**
- `shopID` (string, 必填): 店铺ID，例如 "1489850435"
- `shopName` (string, 必填): 店铺名称，例如 "Modern Nest|泰国"
- `page` (integer, 可选): 页码，默认值为 1
- `pageSize` (integer, 可选): 每页数量，默认值为 20

**响应格式：**
```json
{
  "success": true,
  "message": "拉取成功，共 100 条数据",
  "data": [
    {
      "id": 1,
      "product_id": "PROD001",
      "product_name": "商品名称",
      "product_image": "https://example.com/image.jpg",
      "custom_category_1": "分类1",
      "custom_category_2": "分类2",
      "custom_category_3": "分类3",
      "custom_category_4": "分类4"
    }
  ],
  "total": 100
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "错误信息",
  "message": "错误描述"
}
```

**业务逻辑要求：**
1. 根据 `shopID` 筛选商品（使用 `shop_id` 字段）
2. 支持分页查询
3. 返回所有字段，包括4个自定义分类字段
4. 如果某个自定义分类字段为 NULL，返回 `null` 或空字符串
5. 按 `id` 或 `product_id` 排序（建议按创建时间倒序）

---

### 2. 更新商品自定义分类接口

**接口路径：** `PUT /api/product-items/:id`

**路径参数：**
- `id` (string/integer): 商品ID，可以是主键 `id` 或 `product_id`

**请求体（JSON）：**
```json
{
  "custom_category_1": "新分类1",
  "custom_category_2": "新分类2",
  "custom_category_3": "新分类3",
  "custom_category_4": "新分类4"
}
```
注意：每次可能只更新其中一个字段，例如：
```json
{
  "custom_category_1": "新分类1"
}
```

**响应格式：**
```json
{
  "success": true,
  "message": "保存成功",
  "data": {
    "id": 1,
    "product_id": "PROD001",
    "product_name": "商品名称",
    "product_image": "https://example.com/image.jpg",
    "custom_category_1": "新分类1",
    "custom_category_2": "分类2",
    "custom_category_3": "分类3",
    "custom_category_4": "分类4"
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "商品不存在",
  "message": "无法找到指定的商品"
}
```

**业务逻辑要求：**
1. 支持通过主键 `id` 或 `product_id` 查找商品
2. 只更新请求体中提供的字段
3. 允许将字段设置为 `null` 或空字符串（清空分类）
4. 更新成功后返回更新后的完整商品数据
5. 如果商品不存在，返回错误信息

---

### 3. 删除商品接口

**接口路径：** `DELETE /api/product-items/:id`

**路径参数：**
- `id` (string/integer): 商品ID，可以是主键 `id` 或 `product_id`

**响应格式：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "商品不存在",
  "message": "无法找到指定的商品"
}
```

**业务逻辑要求：**
1. 支持通过主键 `id` 或 `product_id` 查找商品
2. 物理删除或软删除（根据业务需求决定）
3. 如果商品不存在，返回错误信息
4. 删除成功返回成功消息

---

## 技术实现要求

### 1. 统一响应格式
所有接口必须遵循统一的响应格式：
- 成功：`{ success: true, message?: string, data?: any, total?: number }`
- 失败：`{ success: false, error?: string, message?: string }`

### 2. 错误处理
- 参数验证失败：返回 400 状态码和错误信息
- 资源不存在：返回 404 状态码和错误信息
- 服务器错误：返回 500 状态码和错误信息
- 数据库错误：记录日志并返回友好的错误信息

### 3. 数据验证
- `shopID` 必须存在且有效
- `product_id` 必须唯一（如果使用）
- 自定义分类字段可以为空，但如果提供，应该进行基本的字符串验证（长度限制等）

### 4. 分页处理
- 默认页码：1
- 默认每页数量：20
- 返回总记录数 `total`，用于前端分页组件
- 计算总页数：`Math.ceil(total / pageSize)`

### 5. 数据库查询优化
- 使用索引优化 `shop_id` 字段的查询
- 分页查询使用 `LIMIT` 和 `OFFSET`
- 避免 N+1 查询问题

### 6. 安全性
- 验证用户权限（如果需要）
- 防止 SQL 注入（使用参数化查询）
- 验证输入数据的合法性
- 对敏感操作进行日志记录

---

## 示例 SQL 查询

### 获取商品列表（带分页）
```sql
SELECT 
  id,
  product_id,
  product_name,
  product_image,
  custom_category_1,
  custom_category_2,
  custom_category_3,
  custom_category_4
FROM product_items
WHERE shop_id = ?
ORDER BY id DESC
LIMIT ? OFFSET ?;
```

### 获取总数
```sql
SELECT COUNT(*) as total
FROM product_items
WHERE shop_id = ?;
```

### 更新商品分类
```sql
UPDATE product_items
SET 
  custom_category_1 = COALESCE(?, custom_category_1),
  custom_category_2 = COALESCE(?, custom_category_2),
  custom_category_3 = COALESCE(?, custom_category_3),
  custom_category_4 = COALESCE(?, custom_category_4)
WHERE id = ? OR product_id = ?;
```

### 删除商品
```sql
DELETE FROM product_items
WHERE id = ? OR product_id = ?;
```

---

## 测试用例

### 1. 获取商品列表
- 测试正常查询：提供有效的 shopID 和 shopName
- 测试分页：验证 page 和 pageSize 参数
- 测试空结果：当店铺没有商品时
- 测试无效店铺：提供不存在的 shopID

### 2. 更新商品分类
- 测试更新单个字段
- 测试更新多个字段
- 测试清空分类（设置为 null）
- 测试更新不存在的商品

### 3. 删除商品
- 测试删除存在的商品
- 测试删除不存在的商品
- 测试删除后的数据一致性

---

## 注意事项

1. **店铺ID匹配**：确保 `shopID` 参数与数据库中的 `shop_id` 字段匹配
2. **字段命名**：数据库字段使用下划线命名（snake_case），API 响应可以使用相同格式
3. **空值处理**：自定义分类字段可以为 `null`，前端会正确处理
4. **分页边界**：处理边界情况，如 page=0 或 pageSize=0
5. **性能考虑**：如果商品数量很大，考虑使用游标分页而不是偏移分页
6. **事务处理**：更新操作建议使用事务，确保数据一致性

---

## 前端调用示例

### 获取商品列表
```javascript
const url = new URL("/api/product-items", window.location.origin);
url.searchParams.append("shopID", "1489850435");
url.searchParams.append("shopName", "Modern Nest|泰国");
url.searchParams.append("page", "1");
url.searchParams.append("pageSize", "20");
const res = await fetch(url.toString());
```

### 更新商品分类
```javascript
const response = await fetch(`/api/product-items/${productId}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    custom_category_1: "新分类1"
  })
});
```

### 删除商品
```javascript
const response = await fetch(`/api/product-items/${productId}`, {
  method: "DELETE"
});
```

---

## 开发 checklist

- [ ] 实现 GET /api/product-items 接口（支持 shopID 筛选和分页）
- [ ] 实现 PUT /api/product-items/:id 接口（更新自定义分类）
- [ ] 实现 DELETE /api/product-items/:id 接口（删除商品）
- [ ] 统一响应格式
- [ ] 错误处理和完善
- [ ] 参数验证
- [ ] 数据库查询优化
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 更新 API 文档
- [ ] 性能测试和优化

---

## 联系信息

如有疑问，请参考前端代码：
- 前端页面：`src/views/customCategory/index.vue`
- API 调用：`src/api/productItems.ts`




