# `/api/products` 接口自定义分类字段说明

## 接口信息
- **接口路径**: `GET /api/products`
- **请求参数**: 
  - `shopID` (string): 店铺ID
  - `shopName` (string): 店铺名称
  - `customCategory` (string, 可选): 自定义分类筛选条件

## 响应数据结构

### 响应格式
```json
{
  "success": true,
  "data": [
    {
      "product_id": "string",
      "product_name": "string",
      "product_image": "string | null",
      "testing_stage": {
        "start_time": "string | null",
        "end_time": "string | null"
      },
      "potential_stage": {
        "start_time": "string | null",
        "end_time": "string | null"
      },
      "product_stage": {
        "start_time": "string | null",
        "end_time": "string | null"
      },
      "abandoned_stage": {
        "start_time": "string | null",
        "end_time": "string | null"
      },
      "custom_category_1": "string | null",
      "custom_category_2": "string | null",
      "custom_category_3": "string | null",
      "custom_category_4": "string | null"
    }
  ]
}
```

## 自定义分类字段说明

### 字段列表
需要在每个商品对象中包含以下4个自定义分类字段：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `custom_category_1` | `string \| null` | 否 | 自定义分类1 |
| `custom_category_2` | `string \| null` | 否 | 自定义分类2 |
| `custom_category_3` | `string \| null` | 否 | 自定义分类3 |
| `custom_category_4` | `string \| null` | 否 | 自定义分类4 |

### 字段要求
- **类型**: 字符串或 `null`
- **必填**: 否（可选字段）
- **值格式**: 
  - 有值时：字符串，建议去除首尾空格
  - 无值时：`null` 或空字符串（前端会统一处理为 `null`）

### 示例

#### 示例1：有分类值
```json
{
  "product_id": "123456",
  "product_name": "示例商品",
  "custom_category_1": "家居用品",
  "custom_category_2": "厨房用具",
  "custom_category_3": null,
  "custom_category_4": null
}
```

#### 示例2：无分类值
```json
{
  "product_id": "123456",
  "product_name": "示例商品",
  "custom_category_1": null,
  "custom_category_2": null,
  "custom_category_3": null,
  "custom_category_4": null
}
```

## 注意事项
1. 所有4个字段都需要在响应中返回，即使值为 `null`
2. 字段值建议去除首尾空格
3. 前端会根据这些字段进行筛选和显示，请确保数据准确性

