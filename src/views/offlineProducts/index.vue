<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from "vue";
import { ElMessage, ElLoading, ElMessageBox } from "element-plus";
import type { LoadingInstance } from "element-plus";
import {
  getOfflineProductItems,
  updateProductItemStatus,
  getCustomCategoryOptions,
  deleteProductItem,
  type ProductItem
} from "@/api/productItems";
import { shopOptions, DEFAULT_SHOP_ID, getShopOption } from "@/constants/shops";

defineOptions({ name: "OfflineProducts" });

// 店铺选项从共享常量导入

// 选中的店铺
const selectedShop = ref<string>(DEFAULT_SHOP_ID); // 默认选择第一个店铺

// 商品数据
const products = shallowRef<ProductItem[]>([]);
const searchProductId = ref("");
const searchProductName = ref("");
const selectedCustomCategory = ref<string>("");
const customCategoryOptions = ref<string[]>([]);
const pageLoading = ref(false);

const filteredProducts = computed(() => {
  const idKeyword = searchProductId.value.trim();
  const nameKeyword = searchProductName.value.trim().toLowerCase();

  return products.value.filter(item => {
    const matchId =
      !idKeyword ||
      (item.product_id ?? "").toLowerCase().includes(idKeyword.toLowerCase());
    const matchName =
      !nameKeyword ||
      (item.product_name ?? "").toLowerCase().includes(nameKeyword);
    return matchId && matchName;
  });
});

// 分页相关
const currentPage = ref(1);
const pageSize = ref(20);
const pageSizes = [10, 20, 50, 100, 200];
const total = ref(0);

// 上架状态映射
const onliningMap = ref<Record<string, boolean>>({});
// 已上架的商品ID集合（用于隐藏按钮）
const onlinedProducts = ref<Record<string, boolean>>({});
// 删除状态映射
const deletingMap = ref<Record<string, boolean>>({});
// 已删除的商品ID集合（用于隐藏按钮）
const deletedProducts = ref<Record<string, boolean>>({});

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

/**
 * 拉取已下架商品数据
 */
async function fetchData() {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  // 重新拉取数据时清空已上架和已删除商品记录
  onlinedProducts.value = {};
  deletedProducts.value = {};

  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");

  try {
    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const result = await getOfflineProductItems({
      shopID: selectedShop.value,
      shopName: shopOption.label,
      page: currentPage.value,
      pageSize: pageSize.value,
      customCategory: selectedCustomCategory.value || undefined
    });

    if (result.success && Array.isArray(result.data)) {
      products.value = result.data;
      total.value = result.total || result.data.length;
      ElMessage.success(result.message || `数据拉取成功，共 ${total.value} 条`);
    } else {
      throw new Error(result.error || result.message || "查询失败");
    }
  } catch (error: any) {
    console.error("拉取数据失败:", error);
    ElMessage.error(error?.message || "网络连接失败，请检查网络后重试");
    products.value = [];
    total.value = 0;
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

/**
 * 上架商品
 */
async function handleOnlineProduct(productId: string) {
  try {
    await ElMessageBox.confirm("确定要上架该商品吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });

    // 设置上架状态
    onliningMap.value[productId] = true;

    try {
      const result = await updateProductItemStatus(productId, 0);

      if (result.success) {
        // 将商品ID添加到已上架集合中，用于隐藏按钮
        onlinedProducts.value[productId] = true;
        ElMessage.success(result.message || "上架成功");
      } else {
        throw new Error(result.error || result.message || "上架失败");
      }
    } catch (error: any) {
      console.error("上架商品失败:", error);
      ElMessage.error(error?.message || "上架失败，请检查网络后重试");
    } finally {
      delete onliningMap.value[productId];
    }
  } catch {
    // 用户取消操作
  }
}

/**
 * 删除商品
 */
async function handleDeleteProduct(productId: string) {
  try {
    await ElMessageBox.confirm("确定要删除该商品吗？此操作不可恢复！", "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });

    // 设置删除状态
    deletingMap.value[productId] = true;

    try {
      const result = await deleteProductItem(productId);

      if (result.success) {
        // 将商品ID添加到已删除集合中，用于隐藏按钮
        deletedProducts.value[productId] = true;
        ElMessage.success(result.message || "删除成功");
      } else {
        throw new Error(result.error || result.message || "删除失败");
      }
    } catch (error: any) {
      console.error("删除商品失败:", error);
      ElMessage.error(error?.message || "删除失败，请检查网络后重试");
    } finally {
      delete deletingMap.value[productId];
    }
  } catch {
    // 用户取消操作
  }
}

/** 处理页码变化 */
function handleCurrentChange(page: number) {
  currentPage.value = page;
  fetchData();
}

/** 处理每页数量变化 */
function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  fetchData();
}

/** 点击复制 id/name */
async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    ElMessage.success("已复制到剪贴板");
  } catch {
    ElMessage.error("复制失败");
  }
}

/** 处理店铺变化 */
function handleShopChange() {
  currentPage.value = 1;
  selectedCustomCategory.value = "";
  onlinedProducts.value = {}; // 清空已上架商品记录
  deletedProducts.value = {}; // 清空已删除商品记录
  loadCustomCategoryOptions();
  fetchData();
}

/** 加载自定义分类选项 */
async function loadCustomCategoryOptions() {
  if (!selectedShop.value) return;

  try {
    const result = await getCustomCategoryOptions({
      shopID: selectedShop.value
    });
    if (result.success && Array.isArray(result.data)) {
      customCategoryOptions.value = result.data;
    }
  } catch (error) {
    console.error("加载自定义分类选项失败:", error);
  }
}

/** 处理自定义分类变化 */
function handleCustomCategoryChange() {
  currentPage.value = 1;
  fetchData();
}

onMounted(() => {
  // 初始化时加载分类选项并拉取数据
  if (selectedShop.value) {
    loadCustomCategoryOptions();
    fetchData();
  }
});
</script>

<template>
  <div class="offline-products-page">
    <el-card class="products-card">
      <div class="card-header">
        <div class="left">
          <el-select
            v-model="selectedShop"
            placeholder="选择店铺"
            style="width: 200px"
            @change="handleShopChange"
          >
            <el-option
              v-for="item in shopOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>

          <div class="filters">
            <el-select
              v-model="selectedCustomCategory"
              placeholder="选择自定义分类"
              clearable
              style="width: 200px"
              @change="handleCustomCategoryChange"
            >
              <el-option
                v-for="category in customCategoryOptions"
                :key="category"
                :label="category"
                :value="category"
              />
            </el-select>
            <el-input
              v-model="searchProductId"
              placeholder="输入商品ID搜索"
              clearable
              class="filter-input"
            />
            <el-input
              v-model="searchProductName"
              placeholder="输入商品名称搜索（模糊）"
              clearable
              class="filter-input"
            />
          </div>
        </div>

        <div class="actions">
          <el-button
            type="primary"
            :loading="pageLoading"
            icon="el-icon-refresh"
            @click="fetchData"
            >拉取数据</el-button
          >
        </div>
      </div>

      <div class="table-wrapper">
        <el-table
          v-loading="pageLoading"
          :data="filteredProducts"
          stripe
          style="width: 100%"
          :row-key="row => row.product_id"
          :max-height="600"
        >
          <el-table-column
            prop="product_id"
            label="商品ID"
            width="200"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  class="plain-text"
                  title="点击复制"
                  @click.stop="copyToClipboard(row.product_id)"
                  >{{ row.product_id }}</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_name"
            label="商品名称"
            min-width="300"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  class="plain-text"
                  title="点击复制"
                  @click.stop="copyToClipboard(row.product_name)"
                  >{{ row.product_name }}</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_image"
            label="商品主图"
            width="120"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <img
                  v-if="row.product_image"
                  :src="row.product_image"
                  alt="主图"
                  class="thumb"
                />
                <div v-else class="no-img">无图</div>
              </div>
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column
            label="操作"
            width="180"
            align="center"
            header-align="center"
            fixed="right"
          >
            <template #default="{ row }">
              <div class="online-actions">
                <el-button
                  v-if="!onlinedProducts[row.product_id]"
                  type="success"
                  size="small"
                  :loading="onliningMap[row.product_id]"
                  @click="handleOnlineProduct(row.product_id)"
                  >上架</el-button
                >
                <el-button
                  v-if="!deletedProducts[row.product_id]"
                  type="danger"
                  size="small"
                  :loading="deletingMap[row.product_id]"
                  @click="handleDeleteProduct(row.product_id)"
                  >删除</el-button
                >
              </div>
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

      <!-- 空状态 -->
      <el-empty
        v-if="!pageLoading && filteredProducts.length === 0"
        description="暂无已下架商品"
      />
    </el-card>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.offline-products-page {
  @include dopamine.dopamine-page();
  padding: 32px;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
  color: var(--dopamine-contrast);
}

.products-card {
  width: 100%;
  margin: 0;
  border-radius: 26px;
  border: none;
  @include dopamine.dopamine-surface(26px);

  :deep(.el-card__body) {
    padding: 28px;
    background: transparent;
  }
}

.card-header {
  @include dopamine.dopamine-toolbar();
  justify-content: space-between;
  margin-bottom: 18px;
  background: linear-gradient(
    115deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(108, 99, 255, 0.21) 55%,
    rgba(255, 110, 199, 0.18) 100%
  );
}

.left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-input {
  width: 200px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: thin;
  scrollbar-color: rgba(108, 99, 255, 0.35) rgba(255, 255, 255, 0.2);

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.4);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(108, 99, 255, 0.4);
    border-radius: 4px;
  }
}

.products-card :deep(.el-table) {
  width: 100%;
  background: transparent;
  color: var(--dopamine-contrast);
}

.products-card :deep(.el-table__header th) {
  background: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  color: var(--dopamine-soft-ink);
}

.products-card :deep(.el-table tr) {
  background: rgba(255, 255, 255, 0.72);
}

.products-card :deep(.el-table .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 14px;
  display: block;
  box-shadow: 0 8px 20px rgba(31, 18, 53, 0.15);
}

.no-img {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: var(--dopamine-secondary);
  border: 1px dashed rgba(108, 99, 255, 0.35);
  background: rgba(255, 255, 255, 0.65);
}

.online-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
}

.online-actions .el-button {
  width: 80px;
}

.plain-text {
  cursor: pointer;
  color: inherit;
  user-select: text;

  &:hover {
    color: var(--dopamine-primary);
  }
}

.products-card :deep(.el-table__body-wrapper) {
  overflow-x: visible;
  overflow-y: auto;
}

:deep(.el-table__fixed),
:deep(.el-table__fixed-right) {
  z-index: 3;
  background: transparent;
}

:deep(.el-table__fixed .cell),
:deep(.el-table__fixed-right .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-table__fixed .el-table__fixed-right-shadow),
:deep(.el-table__fixed-right .el-table__fixed-shadow) {
  box-shadow: none;
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  padding: 16px 0 8px;
}

:deep(.el-button--primary) {
  @include dopamine.dopamine-primary-button();
}

:deep(.el-button--success) {
  background: linear-gradient(135deg, #2de2e6 0%, #66ffb5 100%);
  border: 1px solid rgba(45, 226, 230, 0.6);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(45, 226, 230, 0.25);

  &:hover {
    background: linear-gradient(135deg, #22d2d6 0%, #55efaa 100%);
    box-shadow: 0 12px 28px rgba(45, 226, 230, 0.35);
  }

  &:active {
    transform: translateY(1px);
  }
}

:deep(.el-button--danger) {
  background: linear-gradient(135deg, #ff6b9d 0%, #ff4757 100%);
  border: 1px solid rgba(255, 107, 157, 0.6);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(255, 107, 157, 0.25);

  &:hover {
    background: linear-gradient(135deg, #ef5a8d 0%, #ee3d47 100%);
    box-shadow: 0 12px 28px rgba(255, 107, 157, 0.35);
  }

  &:active {
    transform: translateY(1px);
  }
}

@media (max-width: 1200px) {
  .offline-products-page {
    padding: 24px 20px;
  }
}

@media (max-width: 768px) {
  .offline-products-page {
    padding: 20px 16px;
  }

  .card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .left,
  .actions {
    width: 100%;
  }

  .products-card :deep(.el-card__body) {
    padding: 20px 16px;
  }

  .table-wrapper {
    &::-webkit-scrollbar {
      height: 6px;
    }
  }
}
</style>
