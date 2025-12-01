# 后台API开发提示词：获取已上传日期列表接口

## 需求描述

为数据上传功能开发一个后台API接口，用于获取广告和商业分析文件已上传的日期列表。该接口将用于前端日历组件显示，帮助用户快速识别哪些日期的数据已经上传，哪些日期还需要上传。

## 接口规范

### 1. 接口信息

- **接口路径**: `/api/upload/dates`
- **请求方法**: `GET`
- **接口描述**: 获取已上传文件的日期列表，支持按店铺ID筛选

### 2. 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| shopID | string | 否 | 店铺ID。如果不传，则返回所有店铺的已上传日期；如果传入，则只返回该店铺的已上传日期 |

**请求示例**:
```
GET /api/upload/dates
GET /api/upload/dates?shopID=1489850435
```

### 3. 响应格式

**成功响应** (HTTP 200):
```json
{
  "success": true,
  "message": "获取成功",
  "data": {
    "ad": [
      "2024-01-01",
      "2024-01-02",
      "2024-01-05",
      "2024-01-10"
    ],
    "daily": [
      "2024-01-01",
      "2024-01-03",
      "2024-01-07"
    ]
  }
}
```

**失败响应** (HTTP 500):
```json
{
  "success": false,
  "message": "获取失败：具体错误信息",
  "data": null
}
```

### 4. 响应字段说明

- `success`: 布尔值，表示请求是否成功
- `message`: 字符串，响应消息
- `data`: 对象，包含已上传日期列表
  - `ad`: 字符串数组，广告文件已上传的日期列表，日期格式为 `YYYY-MM-DD`
  - `daily`: 字符串数组，商业分析文件已上传的日期列表，日期格式为 `YYYY-MM-DD`

## 业务逻辑要求

### 1. 数据来源

需要从数据库中查询已上传的文件记录，根据以下条件筛选：

- **广告文件 (`ad`)**: 
  - 查询 `type = 'ad'` 的上传记录
  - 提取每条记录对应的日期（从文件名或上传记录中的日期字段获取）
  
- **商业分析文件 (`daily`)**:
  - 查询 `type = 'daily'` 的上传记录
  - 提取每条记录对应的日期（从文件名或上传记录中的日期字段获取）

### 2. 店铺筛选

- 如果请求参数中包含 `shopID`，则只返回该店铺的已上传日期
- 如果请求参数中不包含 `shopID`，则返回所有店铺的已上传日期（可能需要去重）

### 3. 日期提取逻辑

需要从上传记录中提取日期，可能的来源：
1. 文件名中包含日期（如：`ad_2024-01-01.csv`）
2. 上传记录表中有专门的日期字段
3. 上传时间对应的日期（作为备选方案）

**建议**: 优先使用文件名解析或专门的日期字段，确保日期准确对应文件内容的数据日期，而不是上传时间。

### 4. 日期格式

- 所有日期必须格式化为 `YYYY-MM-DD` 格式（例如：`2024-01-01`）
- 日期列表需要去重，同一个日期只出现一次
- 日期列表建议按时间倒序排列（最新的在前）

### 5. 性能优化

- 如果数据量较大，考虑添加缓存机制
- 可以考虑只返回最近3-6个月的日期，减少数据传输量
- 如果数据库查询较慢，可以考虑使用索引优化

## 数据库设计建议

### 上传记录表结构（如果还没有，需要创建）

```sql
CREATE TABLE upload_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  shop_id VARCHAR(50) NOT NULL COMMENT '店铺ID',
  shop_name VARCHAR(200) COMMENT '店铺名称',
  upload_type VARCHAR(20) NOT NULL COMMENT '上传类型：ad(广告), daily(商业分析), productID(商品ID更新)',
  file_name VARCHAR(500) COMMENT '文件名',
  file_date DATE COMMENT '文件对应的数据日期（从文件名解析或手动指定）',
  upload_time DATETIME NOT NULL COMMENT '上传时间',
  status VARCHAR(20) DEFAULT 'success' COMMENT '上传状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shop_type_date (shop_id, upload_type, file_date),
  INDEX idx_upload_type_date (upload_type, file_date)
) COMMENT='文件上传记录表';
```

### 查询SQL示例

```sql
-- 查询广告已上传日期（指定店铺）
SELECT DISTINCT DATE_FORMAT(file_date, '%Y-%m-%d') as date
FROM upload_records
WHERE upload_type = 'ad' 
  AND shop_id = ? 
  AND file_date IS NOT NULL
  AND status = 'success'
ORDER BY date DESC;

-- 查询商业分析已上传日期（指定店铺）
SELECT DISTINCT DATE_FORMAT(file_date, '%Y-%m-%d') as date
FROM upload_records
WHERE upload_type = 'daily' 
  AND shop_id = ? 
  AND file_date IS NOT NULL
  AND status = 'success'
ORDER BY date DESC;

-- 查询所有店铺的已上传日期（不指定店铺）
SELECT DISTINCT DATE_FORMAT(file_date, '%Y-%m-%d') as date
FROM upload_records
WHERE upload_type = 'ad' 
  AND file_date IS NOT NULL
  AND status = 'success'
ORDER BY date DESC;
```

## 实现步骤

1. **创建或确认上传记录表结构**
   - 确保表中有 `shop_id`、`upload_type`、`file_date` 等字段
   - 如果使用文件名解析日期，需要实现日期提取逻辑

2. **实现日期提取逻辑**
   - 从文件名中提取日期（正则表达式匹配）
   - 或从上传记录中的日期字段直接获取
   - 确保日期格式统一为 `YYYY-MM-DD`

3. **实现查询接口**
   - 根据 `upload_type` 和 `shop_id`（可选）查询已上传日期
   - 对日期进行去重和排序
   - 返回格式化的日期列表

4. **添加错误处理**
   - 处理数据库查询异常
   - 处理参数验证错误
   - 返回友好的错误信息

5. **测试验证**
   - 测试不同店铺的查询
   - 测试不传店铺ID的查询
   - 验证日期格式正确性
   - 验证去重和排序功能

## 注意事项

1. **日期准确性**: 确保返回的日期是文件实际对应的数据日期，而不是上传时间
2. **时区处理**: 注意时区问题，确保日期计算准确
3. **数据一致性**: 如果上传接口已经保存了上传记录，确保日期字段正确填充
4. **性能考虑**: 如果数据量很大，考虑添加分页或时间范围限制
5. **安全性**: 验证 `shopID` 参数，防止SQL注入等安全问题

## 前端对接说明

前端会调用此接口获取已上传日期，并在日历组件中标记这些日期。接口需要：
- 快速响应（建议响应时间 < 500ms）
- 数据准确（日期格式统一，无重复）
- 支持按店铺筛选

## 相关文件

- 前端API文件: `src/api/uploadData.ts`
- 前端页面: `src/views/dataUpload/index.vue`
- 上传接口: `/api/upload` (需要确保上传时保存了日期信息)

