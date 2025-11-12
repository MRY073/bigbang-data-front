<script setup lang="ts">
import { ref, shallowRef, nextTick, onMounted } from "vue";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";
import { Edit, Refresh } from "@element-plus/icons-vue";
import {
  updateProductItem,
  deleteProductItem,
  type ProductItem
} from "@/api/productItems";

defineOptions({ name: "CustomCategory" });

// 店铺选项
const shopOptions = [
  {
    label: "Modern Nest|泰国",
    value: "1489850435"
  },
  {
    label: "shop07|泰国",
    value: "1638595255"
  }
];

// 选中的店铺
const selectedShop = ref<string>("");

// 商品数据
const products = shallowRef<ProductItem[]>([]);
const loading = ref(false);
const pageLoading = ref(false);
const originalValues = ref<Record<string, Partial<ProductItem>>>({});

// 分页相关
const currentPage = ref(1);
const pageSize = ref(20);
const pageSizes = [10, 20, 50, 100];
const total = ref(0);

// 编辑状态映射（用于跟踪哪些字段正在编辑）
const editingMap = ref<Record<string, Record<string, boolean>>>({});

// 接口地址
const API_GET_PRODUCTS = "/api/product-items";
const API_GET_CUSTOM_CATEGORY_OPTIONS = "/api/product-items/custom-categories";

// 自定义分类筛选
const customCategoryOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedCustomCategory = ref<string>("");

const fetchCustomCategoryOptions = async () => {
  if (!selectedShop.value) {
    return;
  }
  try {
    const url = new URL(
      API_GET_CUSTOM_CATEGORY_OPTIONS,
      window.location.origin
    );
    url.searchParams.append("shopID", selectedShop.value);
    const response = await fetch(url.toString(), {
      method: "GET"
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      appendCustomCategoryOptions(normalizeCategoryPayload(result.data));
    } else {
      throw new Error(result.error || result.message || "获取分类失败");
    }
  } catch (error: any) {
    console.error("获取自定义分类选项失败:", error);
    ElMessage.error(error?.message || "获取自定义分类选项失败");
  }
};

const categoryFields: Array<keyof ProductItem> = [
  "custom_category_1",
  "custom_category_2",
  "custom_category_3",
  "custom_category_4"
];

const normalizeCategoryPayload = (payload: any[]): string[] => {
  return payload
    .map(item => {
      if (typeof item === "string") {
        return item;
      }
      if (item && typeof item === "object") {
        return (
          item.label ?? item.name ?? item.value ?? item.key ?? item.id ?? ""
        );
      }
      return "";
    })
    .map(text => (typeof text === "string" ? text.trim() : ""))
    .filter(Boolean);
};

const appendCustomCategoryOptions = (values: string[]) => {
  if (!values.length) return;
  const existing = new Set(customCategoryOptions.value.map(opt => opt.value));
  let changed = false;
  values.forEach(value => {
    const trimmed = value.trim();
    if (!trimmed || existing.has(trimmed)) {
      return;
    }
    customCategoryOptions.value.push({
      label: trimmed,
      value: trimmed
    });
    existing.add(trimmed);
    changed = true;
  });
  if (changed) {
    customCategoryOptions.value.sort((a, b) =>
      a.label.localeCompare(b.label, "zh-Hans-CN")
    );
  }
};

const extractCategoriesFromProducts = (items: ProductItem[]) => {
  const collected: string[] = [];
  items.forEach(item => {
    categoryFields.forEach(field => {
      const value = item[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          collected.push(trimmed);
        }
      }
    });
  });
  return collected;
};

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

// 拉取商品数据
const fetchProducts = async (resetPage = true) => {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  // 如果重置页码，则设为第一页
  if (resetPage) {
    currentPage.value = 1;
  }

  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");

  try {
    // 获取店铺信息
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    // 构建请求URL
    const url = new URL(API_GET_PRODUCTS, window.location.origin);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("shopName", shopOption.label);
    url.searchParams.append("page", currentPage.value.toString());
    url.searchParams.append("pageSize", pageSize.value.toString());
    if (selectedCustomCategory.value) {
      url.searchParams.append("customCategory", selectedCustomCategory.value);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const result = await res.json();

    if (result.success && result.data) {
      const filteredData = selectedCustomCategory.value
        ? result.data.filter(item =>
            categoryFields.some(field => {
              const value = item[field];
              return (
                typeof value === "string" &&
                value.includes(selectedCustomCategory.value)
              );
            })
          )
        : result.data;
      products.value = filteredData;
      editingMap.value = {};
      originalValues.value = {};
      // 如果正在筛选，使用筛选后的数量；否则使用后端返回的总数
      total.value = selectedCustomCategory.value
        ? filteredData.length
        : result.total || result.data.length;
      if (resetPage) {
        ElMessage.success(
          result.message || `拉取成功，共 ${total.value} 条数据`
        );
      }
    } else {
      throw new Error(result.error || result.message || "拉取失败");
    }
  } catch (error: any) {
    console.error("拉取数据失败:", error);
    ElMessage.error(error?.message || "拉取失败，请稍后重试");
    products.value = [];
    total.value = 0;
  } finally {
    loader.close();
    pageLoading.value = false;
  }
};

const handleCustomCategoryChange = () => {
  if (!selectedShop.value) {
    return;
  }
  currentPage.value = 1;
  fetchProducts();
};

const handleShopChange = () => {
  // 清空分类选项和选中分类
  customCategoryOptions.value = [];
  selectedCustomCategory.value = "";
  // 如果选择了店铺，则获取分类选项
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
};

onMounted(() => {
  // 不再在挂载时获取分类选项，因为需要先选择店铺
});

// 开始编辑
const startEdit = async (row: ProductItem, field: string) => {
  const key = `${row.id || row.product_id}`;
  if (!editingMap.value[key]) {
    editingMap.value[key] = {};
  }
  const productField = field as keyof ProductItem;
  if (!originalValues.value[key]) {
    originalValues.value[key] = {};
  }
  if (!(productField in originalValues.value[key]!)) {
    originalValues.value[key]![productField] = row[productField];
  }
  editingMap.value[key][field] = true;
  // 等待 DOM 更新后聚焦输入框
  await nextTick();
  // 通过 data 属性查找编辑区域，然后在其中查找 input 元素
  const cell = document.querySelector(
    `.editable-cell[data-field="${field}"][data-key="${key}"]`
  ) as HTMLElement;
  if (cell) {
    // 在编辑区域内查找 input 元素
    const input = cell.querySelector("input") as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  }
};

// 取消编辑
const cancelEdit = (row: ProductItem, field: string) => {
  const key = `${row.id || row.product_id}`;
  if (editingMap.value[key]) {
    editingMap.value[key][field] = false;
  }
  const productField = field as keyof ProductItem;
  if (originalValues.value[key] && productField in originalValues.value[key]!) {
    row[productField] = originalValues.value[key]![productField] ?? null;
    delete originalValues.value[key]![productField];
    if (Object.keys(originalValues.value[key]).length === 0) {
      delete originalValues.value[key];
    }
  }
};

// 保存单个字段
const saveField = async (row: ProductItem, field: string) => {
  const key = `${row.id || row.product_id}`;
  if (!row.id && !row.product_id) {
    ElMessage.warning("商品ID不存在，无法保存");
    return;
  }

  loading.value = true;
  try {
    const updateData: Partial<ProductItem> = {
      [field]: row[field] || null
    };

    const id = row.id || row.product_id;
    const response = await updateProductItem(id, updateData);

    if (response.success) {
      ElMessage.success("保存成功");
      if (editingMap.value[key]) {
        editingMap.value[key][field] = false;
      }
      const productField = field as keyof ProductItem;
      if (
        originalValues.value[key] &&
        productField in originalValues.value[key]!
      ) {
        delete originalValues.value[key]![productField];
        if (Object.keys(originalValues.value[key]).length === 0) {
          delete originalValues.value[key];
        }
      }
      // 保存成功后不再刷新数据，提高工作效率
    } else {
      ElMessage.error(response.message || "保存失败");
      // 保存失败时恢复原值
      const productField = field as keyof ProductItem;
      if (
        originalValues.value[key] &&
        productField in originalValues.value[key]!
      ) {
        row[productField] = originalValues.value[key]![productField] ?? null;
      }
      if (editingMap.value[key]) {
        editingMap.value[key][field] = false;
      }
    }
  } catch (error: any) {
    console.error("保存失败:", error);
    ElMessage.error(error?.message || "保存失败，请稍后重试");
    // 保存失败时恢复原值
    const productField = field as keyof ProductItem;
    if (
      originalValues.value[key] &&
      productField in originalValues.value[key]!
    ) {
      row[productField] = originalValues.value[key]![productField] ?? null;
    }
    if (editingMap.value[key]) {
      editingMap.value[key][field] = false;
    }
  } finally {
    loading.value = false;
  }
};

// 检查是否正在编辑
const isEditing = (row: ProductItem, field: string): boolean => {
  const key = `${row.id || row.product_id}`;
  return editingMap.value[key]?.[field] === true;
};

// 删除商品
const handleDelete = async (row: ProductItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除商品 "${row.product_name}" 吗？`,
      "提示",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );

    loading.value = true;
    const id = row.id || row.product_id;
    const response = await deleteProductItem(id);

    if (response.success) {
      ElMessage.success("删除成功");
      await fetchProducts();
    } else {
      ElMessage.error(response.message || "删除失败");
    }
  } catch (error: any) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error(error?.message || "删除失败，请稍后重试");
    }
  } finally {
    loading.value = false;
  }
};

// 分页变化
const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  if (selectedShop.value) {
    fetchProducts(false); // 分页变化时不重置页码
  }
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1; // 改变每页数量时重置到第一页
  if (selectedShop.value) {
    fetchProducts(false); // 不重置页码（因为上面已经重置了）
  }
};
</script>

<template>
  <div class="custom-category-page">
    <el-card class="category-card" shadow="never">
      <!-- 卡片头部 -->
      <template #header>
        <div class="card-header">
          <span class="card-title">自定义分类管理</span>
        </div>
      </template>

      <!-- 店铺选择和拉取按钮 -->
      <div class="filter-section">
        <div class="filter-left">
          <el-select
            v-model="selectedShop"
            placeholder="请选择店铺"
            clearable
            style="width: 250px"
            @change="handleShopChange"
          >
            <el-option
              v-for="option in shopOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="selectedCustomCategory"
            placeholder="请选择自定义分类"
            clearable
            style="width: 220px"
            @change="handleCustomCategoryChange"
          >
            <el-option
              v-for="option in customCategoryOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button
            type="primary"
            :disabled="!selectedShop"
            :loading="pageLoading"
            @click="() => fetchProducts()"
          >
            <el-icon><Refresh /></el-icon>
            拉取商品
          </el-button>
        </div>
      </div>

      <!-- 表格区域 -->
      <div class="table-wrapper">
        <el-table
          v-loading="pageLoading"
          :data="products"
          stripe
          border
          style="width: 100%"
          :header-cell-style="{
            background: 'var(--el-fill-color-light)',
            color: 'var(--el-text-color-primary)',
            textAlign: 'center'
          }"
        >
          <!-- 商品ID -->
          <el-table-column
            prop="product_id"
            label="商品ID"
            width="150"
            align="center"
            show-overflow-tooltip
          />

          <!-- 商品名称 -->
          <el-table-column
            prop="product_name"
            label="商品名称"
            width="200"
            align="center"
            show-overflow-tooltip
          />

          <!-- 商品图片 -->
          <el-table-column label="商品图片" width="120" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.product_image"
                :src="row.product_image"
                :preview-src-list="[row.product_image]"
                fit="cover"
                style="width: 80px; height: 80px; border-radius: 4px"
                :preview-teleported="true"
              />
              <span v-else class="no-image">暂无图片</span>
            </template>
          </el-table-column>

          <!-- 自定义分类1 -->
          <el-table-column label="自定义分类1" width="200" align="center">
            <template #default="{ row }">
              <div
                class="editable-cell"
                :data-field="'custom_category_1'"
                :data-key="`${row.id || row.product_id}`"
              >
                <div
                  v-if="isEditing(row, 'custom_category_1')"
                  class="edit-wrapper"
                >
                  <el-input
                    v-model="row.custom_category_1"
                    placeholder="请输入分类"
                    size="small"
                    @keyup.enter="saveField(row, 'custom_category_1')"
                    @keyup.esc="cancelEdit(row, 'custom_category_1')"
                  />
                  <div class="edit-actions">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="saveField(row, 'custom_category_1')"
                    >
                      保存
                    </el-button>
                    <el-button
                      link
                      size="small"
                      @click="cancelEdit(row, 'custom_category_1')"
                    >
                      取消
                    </el-button>
                  </div>
                </div>
                <div
                  v-else
                  class="cell-content"
                  @click="startEdit(row, 'custom_category_1')"
                >
                  <span v-if="row.custom_category_1">
                    {{ row.custom_category_1 }}
                  </span>
                  <span v-else class="empty-text">点击编辑</span>
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 自定义分类2 -->
          <el-table-column label="自定义分类2" width="200" align="center">
            <template #default="{ row }">
              <div
                class="editable-cell"
                :data-field="'custom_category_2'"
                :data-key="`${row.id || row.product_id}`"
              >
                <div
                  v-if="isEditing(row, 'custom_category_2')"
                  class="edit-wrapper"
                >
                  <el-input
                    v-model="row.custom_category_2"
                    placeholder="请输入分类"
                    size="small"
                    @keyup.enter="saveField(row, 'custom_category_2')"
                    @keyup.esc="cancelEdit(row, 'custom_category_2')"
                  />
                  <div class="edit-actions">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="saveField(row, 'custom_category_2')"
                    >
                      保存
                    </el-button>
                    <el-button
                      link
                      size="small"
                      @click="cancelEdit(row, 'custom_category_2')"
                    >
                      取消
                    </el-button>
                  </div>
                </div>
                <div
                  v-else
                  class="cell-content"
                  @click="startEdit(row, 'custom_category_2')"
                >
                  <span v-if="row.custom_category_2">
                    {{ row.custom_category_2 }}
                  </span>
                  <span v-else class="empty-text">点击编辑</span>
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 自定义分类3 -->
          <el-table-column label="自定义分类3" width="200" align="center">
            <template #default="{ row }">
              <div
                class="editable-cell"
                :data-field="'custom_category_3'"
                :data-key="`${row.id || row.product_id}`"
              >
                <div
                  v-if="isEditing(row, 'custom_category_3')"
                  class="edit-wrapper"
                >
                  <el-input
                    v-model="row.custom_category_3"
                    placeholder="请输入分类"
                    size="small"
                    @keyup.enter="saveField(row, 'custom_category_3')"
                    @keyup.esc="cancelEdit(row, 'custom_category_3')"
                  />
                  <div class="edit-actions">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="saveField(row, 'custom_category_3')"
                    >
                      保存
                    </el-button>
                    <el-button
                      link
                      size="small"
                      @click="cancelEdit(row, 'custom_category_3')"
                    >
                      取消
                    </el-button>
                  </div>
                </div>
                <div
                  v-else
                  class="cell-content"
                  @click="startEdit(row, 'custom_category_3')"
                >
                  <span v-if="row.custom_category_3">
                    {{ row.custom_category_3 }}
                  </span>
                  <span v-else class="empty-text">点击编辑</span>
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 自定义分类4 -->
          <el-table-column label="自定义分类4" width="200" align="center">
            <template #default="{ row }">
              <div
                class="editable-cell"
                :data-field="'custom_category_4'"
                :data-key="`${row.id || row.product_id}`"
              >
                <div
                  v-if="isEditing(row, 'custom_category_4')"
                  class="edit-wrapper"
                >
                  <el-input
                    v-model="row.custom_category_4"
                    placeholder="请输入分类"
                    size="small"
                    @keyup.enter="saveField(row, 'custom_category_4')"
                    @keyup.esc="cancelEdit(row, 'custom_category_4')"
                  />
                  <div class="edit-actions">
                    <el-button
                      link
                      type="primary"
                      size="small"
                      @click="saveField(row, 'custom_category_4')"
                    >
                      保存
                    </el-button>
                    <el-button
                      link
                      size="small"
                      @click="cancelEdit(row, 'custom_category_4')"
                    >
                      取消
                    </el-button>
                  </div>
                </div>
                <div
                  v-else
                  class="cell-content"
                  @click="startEdit(row, 'custom_category_4')"
                >
                  <span v-if="row.custom_category_4">
                    {{ row.custom_category_4 }}
                  </span>
                  <span v-else class="empty-text">点击编辑</span>
                  <el-icon class="edit-icon"><Edit /></el-icon>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column
            label="操作"
            width="120"
            align="center"
            fixed="right"
          >
            <template #default="{ row }">
              <el-button
                link
                type="danger"
                size="small"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页组件 -->
      <div v-if="total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="total"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.custom-category-page {
  padding: 12px;
  min-height: calc(100vh - 80px);
  background: #f7f9fc;
  box-sizing: border-box;
}

.category-card {
  width: 100%;
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(32, 45, 61, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin-bottom: 16px;
}

.editable-cell {
  width: 100%;
  min-height: 32px;
}

.edit-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
}

.edit-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 4px 0;
}

.cell-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;
  min-height: 32px;
}

.cell-content:hover {
  background-color: var(--el-fill-color-light);
}

.empty-text {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.edit-icon {
  color: var(--el-color-primary);
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s;
}

.cell-content:hover .edit-icon {
  opacity: 1;
}

.no-image {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-light);
}

:deep(.el-table .cell) {
  padding: 8px;
}
</style>
