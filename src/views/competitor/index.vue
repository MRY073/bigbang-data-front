<script setup lang="ts">
import { ref, computed, onMounted, shallowRef, watch } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";
import { getProducts, type BackendProduct } from "@/api/products";
import { updateCompetitorInfo } from "@/api/productItems";
import { getCustomCategoryOptions } from "@/api/productItems";
import { shopOptions, DEFAULT_SHOP_ID, getShopOption } from "@/constants/shops";

defineOptions({ name: "Competitor" });

// 阶段类型定义（与后端接口一致）
type StageType = "testing" | "potential" | "product" | "abandoned";

// 阶段时间段对象
type StageTimeRange = {
  start_time: string | null;
  end_time: string | null;
};

// 前端使用的商品行数据
type ProductRow = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  potential_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  product_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  abandoned_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  // computed at runtime
  currentStage?: StageType | null;
  customCategories: string[];
  customCategoriesText: string;
  // 竞争对手信息
  competitor_link: string | null;
  competitor_daily_sales: string | null;
  // 保存状态
  isSaving?: boolean;
};

// 阶段类型映射
const stageTypeMap: Record<StageType, string> = {
  testing: "测款阶段",
  potential: "潜力阶段",
  product: "成品阶段",
  abandoned: "放弃阶段"
};

// 筛选阶段类型（包含"全部"选项）
type FilterStageType = "all" | StageType;

// 使用 shallowRef 优化大数据量的响应式性能
const products = shallowRef<ProductRow[]>([]);
const pageLoading = ref(false);
const filterStage = ref<FilterStageType>("all");
const selectedShop = ref<string>(DEFAULT_SHOP_ID); // 默认选择第一个店铺

// 产品筛选条件（输入框的值，不触发筛选）
const productIdFilter = ref<string>("");
const productNameFilter = ref<string>("");

// 实际应用的筛选条件（用于筛选逻辑）
const appliedProductIdFilter = ref<string>("");
const appliedProductNameFilter = ref<string>("");

// 分页相关
const currentPage = ref(1); // 当前页码
const pageSize = ref(20); // 每页显示数量
const pageSizes = [10, 20, 50, 100, 200]; // 每页数量选项

// 排序相关
type SortOrder = "default" | "asc" | "desc";
const currentStageSort = ref<SortOrder>("default");

const categoryFields: Array<
  | "custom_category_1"
  | "custom_category_2"
  | "custom_category_3"
  | "custom_category_4"
> = [
  "custom_category_1",
  "custom_category_2",
  "custom_category_3",
  "custom_category_4"
];

const customCategoryOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedCustomCategory = ref<string>("");

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

function normalizeCategoryPayload(payload: any[]): string[] {
  return payload
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return (
          item.label ?? item.name ?? item.value ?? item.key ?? item.id ?? ""
        );
      }
      return "";
    })
    .map(text => (typeof text === "string" ? text.trim() : ""))
    .filter(Boolean);
}

function appendCustomCategoryOptions(values: string[]) {
  if (!values.length) return;
  const existing = new Set(customCategoryOptions.value.map(opt => opt.value));
  let changed = false;
  values.forEach(value => {
    const trimmed = value.trim();
    if (!trimmed || existing.has(trimmed)) return;
    customCategoryOptions.value.push({ label: trimmed, value: trimmed });
    existing.add(trimmed);
    changed = true;
  });
  if (changed) {
    customCategoryOptions.value.sort((a, b) =>
      a.label.localeCompare(b.label, "zh-Hans-CN")
    );
  }
}

function extractCategoriesFromProducts(items: BackendProduct[]): string[] {
  const collected: string[] = [];
  items.forEach(item => {
    categoryFields.forEach(field => {
      const value = item[field];
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) collected.push(trimmed);
      }
    });
  });
  return collected;
}

async function fetchCustomCategoryOptions() {
  try {
    const params: any = {};
    if (selectedShop.value) {
      params.shopID = selectedShop.value;
    }
    const result = await getCustomCategoryOptions(params);
    if (result.success && Array.isArray(result.data)) {
      appendCustomCategoryOptions(normalizeCategoryPayload(result.data));
    } else {
      throw new Error(result.error || result.message || "获取自定义分类失败");
    }
  } catch (error) {
    console.error("获取自定义分类失败:", error);
  }
}

/**
 * 将 ISO 8601 格式字符串转换为日期时间选择器可用的格式
 */
function isoToDateTime(isoString: string | null): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return null;
  }
}

/**
 * 将日期时间字符串转换为 ISO 8601 格式
 */
function dateTimeToIso(dateTimeString: string | null): string | null {
  if (!dateTimeString || dateTimeString.trim() === "") return null;
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * 计算商品当前所处的阶段
 */
function computeCurrentStageForRow(row: ProductRow): StageType | null {
  const today = new Date();
  // priority: abandoned -> product -> potential -> testing
  const order: StageType[] = ["abandoned", "product", "potential", "testing"];
  for (const stageType of order) {
    const stage = row[
      `${stageType}_stage` as keyof ProductRow
    ] as StageTimeRange;
    if (stage?.start_time && stage?.end_time) {
      try {
        const startTimeIso = dateTimeToIso(stage.start_time);
        const endTimeIso = dateTimeToIso(stage.end_time);
        if (startTimeIso && endTimeIso) {
          const start = new Date(startTimeIso);
          const end = new Date(endTimeIso);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            if (start <= today && today <= end) return stageType;
          }
        }
      } catch {
        // 忽略日期解析错误
      }
    }
  }
  return null;
}

/**
 * 初始化商品列表数据
 */
function initProducts(backendProducts: BackendProduct[]) {
  products.value = backendProducts.map(item => {
    const customCategories = categoryFields
      .map(field => item[field] ?? "")
      .map(value => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    const customCategoriesText = customCategories.join(" / ");
    const row: ProductRow = {
      product_id: item.product_id,
      product_name: item.product_name,
      product_image: item.product_image,
      testing_stage: {
        start_time: isoToDateTime(item.testing_stage?.start_time || null),
        end_time: isoToDateTime(item.testing_stage?.end_time || null)
      },
      potential_stage: {
        start_time: isoToDateTime(item.potential_stage?.start_time || null),
        end_time: isoToDateTime(item.potential_stage?.end_time || null)
      },
      product_stage: {
        start_time: isoToDateTime(item.product_stage?.start_time || null),
        end_time: isoToDateTime(item.product_stage?.end_time || null)
      },
      abandoned_stage: {
        start_time: isoToDateTime(item.abandoned_stage?.start_time || null),
        end_time: isoToDateTime(item.abandoned_stage?.end_time || null)
      },
      currentStage: null,
      customCategories,
      customCategoriesText,
      competitor_link: item.competitor_link || null,
      competitor_daily_sales: item.competitor_daily_sales || null,
      isSaving: false
    };
    row.currentStage = computeCurrentStageForRow(row);
    return row;
  });
}

/** 拉取数据（仅手动触发） */
async function fetchData() {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");

  try {
    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }
    const params: any = {
      shopID: selectedShop.value,
      shopName: shopOption.label
    };
    if (selectedCustomCategory.value) {
      params.customCategory = selectedCustomCategory.value;
    }

    const result = await getProducts(params);
    if (result.success && result.data) {
      initProducts(result.data);
      appendCustomCategoryOptions(extractCategoriesFromProducts(result.data));
      // 重置到第一页
      currentPage.value = 1;
      ElMessage.success(
        result.message || `数据拉取成功，共 ${products.value.length} 条`
      );
    } else {
      console.error("数据验证失败:", {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
        message: result.message
      });
      throw new Error(result.error || result.message || "查询失败");
    }
  } catch (error: any) {
    console.error("拉取数据失败:", error);
    ElMessage.error(error?.message || "网络连接失败，请检查网络后重试");
    // 清空数据
    products.value = [];
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

/**
 * 保存竞争对手信息
 */
async function saveCompetitorInfo(productId: string) {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  // 找到对应的商品行
  const row = products.value.find(r => r.product_id === productId);
  if (!row) {
    ElMessage.error("商品不存在");
    return;
  }

  // 设置保存状态
  row.isSaving = true;

  try {
    // 准备请求数据，去除首尾空格
    const competitorLink = row.competitor_link?.trim() || null;
    const competitorDailySales = row.competitor_daily_sales?.trim() || null;

    const result = await updateCompetitorInfo(productId, {
      competitor_link: competitorLink === "" ? null : competitorLink,
      competitor_daily_sales: competitorDailySales === "" ? null : competitorDailySales
    });

    if (result.success) {
      ElMessage.success(result.message || "保存成功");
    } else {
      throw new Error(result.error || result.message || "更新失败");
    }
  } catch (error: any) {
    console.error("保存竞争对手信息失败:", error);
    ElMessage.error(error?.message || "保存失败，请检查网络后重试");
  } finally {
    row.isSaving = false;
  }
}

// 缓存筛选和排序后的完整列表，避免重复计算
const filteredAndSortedProducts = computed(() => {
  const productsList = products.value;
  if (productsList.length === 0) {
    return [];
  }

  // 先根据阶段筛选
  let filtered: ProductRow[];
  if (filterStage.value === "all") {
    filtered = productsList;
  } else {
    const stageType = filterStage.value as StageType;
    filtered = productsList.filter(row => {
      const stage = row[
        `${stageType}_stage` as keyof ProductRow
      ] as StageTimeRange;
      const hasRange = stage?.start_time && stage?.end_time;
      const isCurrent = row.currentStage === stageType;
      return hasRange || isCurrent;
    });
  }

  // 根据自定义分类筛选
  if (selectedCustomCategory.value) {
    const selected = selectedCustomCategory.value.trim();
    filtered = filtered.filter(row =>
      row.customCategories.some(category => category.trim() === selected)
    );
  }

  // 根据产品ID筛选
  const idFilterTrimmed = appliedProductIdFilter.value.trim();
  if (idFilterTrimmed) {
    const idFilter = idFilterTrimmed.toLowerCase();
    filtered = filtered.filter(row =>
      row.product_id.toLowerCase().includes(idFilter)
    );
  }

  // 根据产品名称筛选
  const nameFilterTrimmed = appliedProductNameFilter.value.trim();
  if (nameFilterTrimmed) {
    const nameFilter = nameFilterTrimmed.toLowerCase();
    filtered = filtered.filter(row =>
      row.product_name.toLowerCase().includes(nameFilter)
    );
  }

  // 按当前阶段字符串排序（只在需要排序时创建新数组）
  if (currentStageSort.value !== "default") {
    filtered = filtered.slice().sort((a, b) => {
      const stageA = a.currentStage || "";
      const stageB = b.currentStage || "";

      // 没有当前阶段的排在最后
      if (!stageA && !stageB) return 0;
      if (!stageA) return 1;
      if (!stageB) return -1;

      // 按阶段字符串排序
      if (currentStageSort.value === "asc") {
        return stageA.localeCompare(stageB);
      } else {
        return stageB.localeCompare(stageA);
      }
    });
  }

  return filtered;
});

/** 过滤后的产品列表（分页后的数据） */
const filteredProducts = computed(() => {
  const filtered = filteredAndSortedProducts.value;
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filtered.slice(start, end);
});

/** 过滤后的总数（用于分页显示） */
const filteredTotal = computed(() => {
  return filteredAndSortedProducts.value.length;
});

/** 处理页码变化 */
function handleCurrentChange(page: number) {
  currentPage.value = page;
}

/** 处理每页数量变化 */
function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1; // 重置到第一页
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

/** 执行筛选 */
function handleFilter() {
  appliedProductIdFilter.value = productIdFilter.value;
  appliedProductNameFilter.value = productNameFilter.value;
  currentPage.value = 1;
}

/** 取消筛选 */
function handleClearFilter() {
  productIdFilter.value = "";
  productNameFilter.value = "";
  appliedProductIdFilter.value = "";
  appliedProductNameFilter.value = "";
  currentPage.value = 1;
}

/** 切换当前时段排序 */
function toggleCurrentStageSort() {
  if (currentStageSort.value === "default") {
    currentStageSort.value = "asc";
  } else if (currentStageSort.value === "asc") {
    currentStageSort.value = "desc";
  } else {
    currentStageSort.value = "default";
  }
  currentPage.value = 1;
}

function handleCustomCategoryChange() {
  currentPage.value = 1;
}

/** 处理店铺变化 */
function handleShopChange() {
  customCategoryOptions.value = [];
  selectedCustomCategory.value = "";
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
  currentPage.value = 1;
}

// 监听店铺变化
watch(selectedShop, () => {
  handleShopChange();
});

onMounted(() => {
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
});
</script>

<template>
  <div class="competitor-page">
    <el-card class="competitor-card">
      <div class="card-header">
        <div class="left">
          <el-select
            v-model="filterStage"
            placeholder="筛选阶段"
            style="width: 220px"
          >
            <el-option label="全部" value="all" />
            <el-option label="测款阶段" value="testing" />
            <el-option label="潜力阶段" value="potential" />
            <el-option label="成品阶段" value="product" />
            <el-option label="放弃阶段" value="abandoned" />
          </el-select>
          <el-select
            v-model="selectedCustomCategory"
            placeholder="自定义分类"
            clearable
            filterable
            style="width: 220px"
            @change="handleCustomCategoryChange"
          >
            <el-option
              v-for="item in customCategoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div class="actions">
          <el-select
            v-model="selectedShop"
            placeholder="选择店铺"
            style="width: 200px; margin-right: 12px"
            @change="handleShopChange"
          >
            <el-option
              v-for="item in shopOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-button
            type="primary"
            :loading="pageLoading"
            icon="el-icon-refresh"
            @click="fetchData"
            >拉取数据</el-button
          >
        </div>
      </div>

      <!-- 产品筛选区域 -->
      <div class="filter-section">
        <div class="filter-inputs">
          <el-input
            v-model="productIdFilter"
            placeholder="产品ID"
            clearable
            style="width: 200px; margin-right: 12px"
          />
          <el-input
            v-model="productNameFilter"
            placeholder="产品名称"
            clearable
            style="width: 200px; margin-right: 12px"
          />
        </div>
        <div class="filter-buttons">
          <el-button type="primary" @click="handleFilter">筛选</el-button>
          <el-button @click="handleClearFilter">取消筛选</el-button>
        </div>
      </div>

      <div class="table-wrapper">
        <el-table
          :data="filteredProducts"
          stripe
          style="width: 100%"
          :row-key="row => row.product_id"
          :row-class-name="
            ({ row }) =>
              row.currentStage === 'abandoned' ? 'row-abandoned' : ''
          "
          :max-height="600"
        >
          <!-- 当前阶段 -->
          <el-table-column
            prop="currentStage"
            label="当前阶段"
            width="140"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #header>
              <div class="sortable-header" @click="toggleCurrentStageSort">
                <span>当前阶段</span>
                <span class="sort-icon">
                  <span v-if="currentStageSort === 'default'">⇅</span>
                  <span v-else-if="currentStageSort === 'asc'">↑</span>
                  <span v-else>↓</span>
                </span>
              </div>
            </template>
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  v-if="row.currentStage"
                  :class="`current-badge stage-${row.currentStage}`"
                  >{{
                    stageTypeMap[row.currentStage] || row.currentStage
                  }}</span
                >
                <span v-else class="dash">-</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_id"
            label="产品ID"
            width="160"
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
            label="产品名称"
            width="300"
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
            label="产品主图"
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

          <!-- 操作列 - 保存按钮 -->
          <el-table-column
            label="操作"
            width="120"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="save-actions">
                <el-button
                  type="primary"
                  size="small"
                  :loading="row.isSaving"
                  @click="saveCompetitorInfo(row.product_id)"
                  >保存</el-button
                >
              </div>
            </template>
          </el-table-column>

          <!-- 竞争对手链接 -->
          <el-table-column
            label="竞争对手链接"
            min-width="300"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.competitor_link"
                type="textarea"
                :rows="2"
                placeholder="请输入竞争对手链接"
                clearable
              />
            </template>
          </el-table-column>

          <!-- 竞争对手日销 -->
          <el-table-column
            label="竞争对手日销"
            width="200"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <el-input
                v-model="row.competitor_daily_sales"
                placeholder="请输入竞争对手日销"
                clearable
              />
            </template>
          </el-table-column>

          <el-table-column
            label="自定义分类"
            min-width="220"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  v-if="
                    row.customCategoriesText && row.customCategoriesText.length
                  "
                >
                  {{ row.customCategoriesText }}
                </span>
                <span v-else class="dash">-</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页组件 -->
      <div v-if="filteredTotal > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="filteredTotal"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.competitor-page {
  @include dopamine.dopamine-page();
  padding: 32px;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
  color: var(--dopamine-contrast);
}

.competitor-card {
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

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 18px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(108, 99, 255, 0.2);
  background: linear-gradient(
    135deg,
    rgba(108, 99, 255, 0.12) 0%,
    rgba(255, 110, 199, 0.14) 55%,
    rgba(102, 255, 181, 0.18) 100%
  );
  backdrop-filter: blur(12px);
}

.filter-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-buttons {
  display: flex;
  gap: 12px;
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

.competitor-card :deep(.el-table) {
  width: 100%;
  min-width: 1440px;
  background: transparent;
  color: var(--dopamine-contrast);
}

.competitor-card :deep(.el-table__header th) {
  background: rgba(255, 255, 255, 0.8);
  font-weight: 600;
  color: var(--dopamine-soft-ink);
}

.competitor-card :deep(.el-table tr) {
  background: rgba(255, 255, 255, 0.72);
}

.competitor-card :deep(.el-table .cell) {
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

.save-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.save-actions .el-button {
  width: 96px;
  @include dopamine.dopamine-primary-button();
}

.current-badge {
  padding: 6px 14px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 14px;
  display: inline-block;
  min-width: 90px;
  text-align: center;
  color: #fff;
  box-shadow: 0 12px 25px rgba(31, 18, 53, 0.15);
}

.current-badge.stage-testing {
  background: linear-gradient(135deg, #6c63ff 0%, #8c7bff 100%);
  border: 1px solid rgba(108, 99, 255, 0.65);
}

.current-badge.stage-potential {
  background: linear-gradient(135deg, #ff9b6a 0%, #ffd33d 95%);
  border: 1px solid rgba(255, 155, 106, 0.55);
}

.current-badge.stage-product {
  background: linear-gradient(135deg, #2de2e6 0%, #66ffb5 100%);
  border: 1px solid rgba(45, 226, 230, 0.6);
}

.current-badge.stage-abandoned {
  background: linear-gradient(135deg, #ff6f91 0%, #ff3f6c 100%);
  border: 1px solid rgba(255, 63, 108, 0.55);
}

.dash {
  color: var(--dopamine-soft-ink);
}

:deep(.el-table__row.row-abandoned) > td {
  background: rgba(31, 18, 53, 0.88) !important;
  color: #fff !important;
}

.plain-text {
  cursor: pointer;
  color: inherit;
  user-select: text;

  &:hover {
    color: var(--dopamine-primary);
  }
}

.competitor-card :deep(.el-table__body-wrapper) {
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

.sortable-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;

  &:hover {
    color: var(--dopamine-secondary);
  }
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--dopamine-soft-ink);
  transition: color 0.2s;
}

.sortable-header:hover .sort-icon {
  color: var(--dopamine-secondary);
}

:deep(.el-button--primary) {
  @include dopamine.dopamine-primary-button();
}

:deep(.el-button--default) {
  @include dopamine.dopamine-ghost-button();
}

.cell-center {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

@media (max-width: 1200px) {
  .competitor-page {
    padding: 24px 20px;
  }

  .filter-section {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-buttons {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .competitor-page {
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

  .filter-section {
    padding: 16px;
  }

  .competitor-card :deep(.el-card__body) {
    padding: 20px 16px;
  }

  .table-wrapper {
    &::-webkit-scrollbar {
      height: 6px;
    }
  }
}
</style>

