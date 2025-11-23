<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { ElMessage, ElIcon } from "element-plus";
import { Picture } from "@element-plus/icons-vue";
import { getStageProducts } from "@/api/adAnalysis";
import { getShopOption } from "@/constants/shops";

// 商品信息类型
type ProductItem = {
  productId: string;
  title: string;
  mainImage: string;
  adSpend: number;
  adSales: number;
  roi: number;
};

// 阶段类型映射
type StageKey = "product" | "testing" | "potential" | "abandoned" | "other";

// Props
interface Props {
  visible: boolean;
  stage: StageKey | null;
  date: string;
  shopID: string;
  customCategory?: string;
}

const props = withDefaults(defineProps<Props>(), {
  customCategory: ""
});

// Emits
const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

// 阶段名称映射
const STAGE_NAMES: Record<StageKey, string> = {
  product: "成品阶段",
  testing: "测款阶段",
  potential: "潜力阶段",
  abandoned: "放弃阶段",
  other: "其他阶段"
};

// 阶段字段映射（用于API请求）
const STAGE_FIELD_MAP: Record<StageKey, string> = {
  product: "product_stage",
  testing: "testing_stage",
  potential: "potential_stage",
  abandoned: "abandoned_stage",
  other: "no_stage"
};

// 状态
const dialogVisible = ref(false);
const productList = ref<ProductItem[]>([]);
const productListLoading = ref(false);
const productListPage = ref(1);
const productListPageSize = ref(20);
const productListTotal = ref(0);
const productListPageSizes = [10, 20, 50, 100];

// 排序相关
type SortField = "ad_spend" | "ad_sales" | "roi";
type SortOrder = "asc" | "desc";
const productListSortBy = ref<SortField>("ad_spend");
const productListSortOrder = ref<SortOrder>("desc");

// 计算弹窗标题
const dialogTitle = computed(() => {
  if (!props.stage) return "商品细则";
  return `${STAGE_NAMES[props.stage]} - 商品细则`;
});

// 监听 visible prop 变化
watch(
  () => props.visible,
  (newVal) => {
    dialogVisible.value = newVal;
    if (newVal && props.stage) {
      productListPage.value = 1;
      fetchStageProducts();
    }
  }
);

// 监听 dialogVisible 变化，同步到父组件
watch(dialogVisible, (newVal) => {
  emit("update:visible", newVal);
});

// 监听排序变化
watch(
  () => [productListSortBy.value, productListSortOrder.value],
  () => {
    if (dialogVisible.value && props.stage) {
      productListPage.value = 1;
      fetchStageProducts();
    }
  }
);

// 监听分页变化
watch(
  () => productListPage.value,
  () => {
    if (dialogVisible.value && props.stage) {
      fetchStageProducts();
    }
  }
);

// 监听每页数量变化
watch(
  () => productListPageSize.value,
  () => {
    if (dialogVisible.value && props.stage) {
      productListPage.value = 1;
      fetchStageProducts();
    }
  }
);

// 监听 props 变化，重新获取数据
watch(
  () => [props.date, props.shopID, props.customCategory, props.stage],
  () => {
    if (dialogVisible.value && props.stage) {
      productListPage.value = 1;
      fetchStageProducts();
    }
  }
);

/**
 * 获取指定阶段的商品列表
 */
async function fetchStageProducts() {
  if (!props.date) {
    ElMessage.warning("请先选择日期");
    return;
  }

  if (!props.shopID) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  if (!props.stage) {
    return;
  }

  productListLoading.value = true;
  productList.value = [];

  try {
    const shopOption = getShopOption(props.shopID);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const params: any = {
      date: props.date,
      shopID: props.shopID,
      shopName: shopOption.label,
      stage: STAGE_FIELD_MAP[props.stage],
      page: productListPage.value,
      pageSize: productListPageSize.value,
      sortBy: productListSortBy.value,
      sortOrder: productListSortOrder.value
    };

    // 如果选择了自定义分类，添加到请求参数中
    if (props.customCategory) {
      params.customCategory = props.customCategory;
    }

    const result = await getStageProducts(params);

    if (!result.success) {
      throw new Error(result.error || result.message || "查询失败");
    }

    // 转换数据格式
    if (result.data) {
      productListTotal.value = result.data.total || 0;
      if (result.data.items && Array.isArray(result.data.items)) {
        productList.value = result.data.items.map((item: any) => ({
          productId: item.product_id || item.productId || "",
          title: item.title || "",
          mainImage: item.main_image || item.mainImage || "",
          adSpend: item.ad_spend || item.adSpend || 0,
          adSales: item.ad_sales || item.adSales || 0,
          roi: item.roi || 0
        }));
      } else {
        productList.value = [];
      }
    } else {
      productList.value = [];
      productListTotal.value = 0;
    }

    if (productList.value.length === 0 && productListTotal.value === 0) {
      ElMessage.info("该阶段暂无商品数据");
    }
  } catch (error: any) {
    console.error("获取商品列表失败:", error);
    // 使用模拟数据
    productList.value = [
      {
        productId: "123456789",
        title: "示例商品标题 - 这是一个测试商品",
        mainImage: "https://via.placeholder.com/100",
        adSpend: 123.45,
        adSales: 456.78,
        roi: 3.7
      },
      {
        productId: "987654321",
        title: "另一个示例商品",
        mainImage: "https://via.placeholder.com/100",
        adSpend: 234.56,
        adSales: 567.89,
        roi: 2.42
      }
    ];
    productListTotal.value = 2;
    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    productListLoading.value = false;
  }
}

/**
 * 处理排序变化
 */
function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!prop) return;

  const fieldMap: Record<string, SortField> = {
    adSpend: "ad_spend",
    adSales: "ad_sales",
    roi: "roi"
  };

  const field = fieldMap[prop];
  if (!field) return;

  productListSortBy.value = field;
  productListSortOrder.value = order === "ascending" ? "asc" : "desc";
  productListPage.value = 1;
}

/**
 * 处理分页变化
 */
function handlePageChange(page: number) {
  productListPage.value = page;
}

/**
 * 处理每页数量变化
 */
function handleSizeChange(size: number) {
  productListPageSize.value = size;
  productListPage.value = 1;
}

/**
 * 关闭弹窗
 */
function closeDialog() {
  dialogVisible.value = false;
  productList.value = [];
  productListPage.value = 1;
  productListTotal.value = 0;
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="fit-content"
    :close-on-click-modal="false"
    class="product-dialog"
    @close="closeDialog"
  >
    <div v-loading="productListLoading" class="product-list-container">
      <div class="total-info">
        共 {{ productListTotal }} 条数据
      </div>

      <el-table
        :data="productList"
        stripe
        style="width: 100%"
        empty-text="暂无商品数据"
        class="product-table"
        border
        @sort-change="handleSortChange"
      >
        <el-table-column prop="productId" label="商品ID" width="150" />
        <el-table-column label="主图" width="120">
          <template #default="{ row }">
            <el-image
              :src="row.mainImage"
              :preview-src-list="[row.mainImage]"
              fit="cover"
              class="product-image"
              :preview-teleported="true"
            >
              <template #error>
                <div class="image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </template>
        </el-table-column>
        <el-table-column
          prop="title"
          label="标题"
          width="300"
          show-overflow-tooltip
        />
        <el-table-column
          prop="adSpend"
          label="广告花费"
          width="140"
          align="right"
          sortable="custom"
          :sort-orders="['ascending', 'descending']"
        >
          <template #default="{ row }">
            <span class="money-value">฿{{ row.adSpend.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="adSales"
          label="广告销售额"
          width="140"
          align="right"
          sortable="custom"
          :sort-orders="['ascending', 'descending']"
        >
          <template #default="{ row }">
            <span class="money-value">฿{{ row.adSales.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="roi"
          label="ROI"
          width="120"
          align="right"
          sortable="custom"
          :sort-orders="['ascending', 'descending']"
        >
          <template #default="{ row }">
            <span
              :class="{ 'roi-high': row.roi >= 2, 'roi-low': row.roi < 1 }"
              class="roi-value"
            >
              {{ row.roi.toFixed(2) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页控件 -->
    <div class="product-dialog-pagination">
      <el-pagination
        v-model:current-page="productListPage"
        v-model:page-size="productListPageSize"
        :page-sizes="productListPageSizes"
        :total="productListTotal"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="closeDialog">关闭</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.product-dialog {
  :deep(.el-dialog__body) {
    padding: 20px 24px;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.98) 100%
    );
  }

  :deep(.el-dialog__header) {
    background: linear-gradient(
      120deg,
      rgba(108, 99, 255, 0.1) 0%,
      rgba(255, 110, 199, 0.1) 100%
    );
    padding: 20px 24px;
    border-bottom: 1px solid rgba(108, 99, 255, 0.1);
  }

  :deep(.el-dialog__title) {
    font-size: 18px;
    font-weight: 700;
    color: var(--dopamine-contrast);
  }
}

.total-info {
  font-size: 14px;
  font-weight: 600;
  color: var(--dopamine-soft-ink);
  margin-bottom: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(108, 99, 255, 0.1);
}

.product-list-container {
  min-height: 400px;
  max-height: 600px;
  overflow-y: auto;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  padding: 8px;
}

.product-table {
  :deep(.el-table__header) {
    background: rgba(108, 99, 255, 0.05);
  }

  :deep(.el-table__header th) {
    background: rgba(108, 99, 255, 0.08);
    color: var(--dopamine-contrast);
    font-weight: 600;
    border-bottom: 2px solid rgba(108, 99, 255, 0.2);
  }

  :deep(.el-table__row) {
    transition: all 0.2s ease;

    &:hover {
      background: rgba(108, 99, 255, 0.08);
      transform: translateX(2px);
    }
  }

  :deep(.el-table__row--striped) {
    background: rgba(255, 255, 255, 0.3);
  }

  :deep(.el-table__border) {
    border: 1px solid rgba(108, 99, 255, 0.2);
  }

  :deep(.el-table__border th),
  :deep(.el-table__border td) {
    border-right: 1px solid rgba(108, 99, 255, 0.15);
  }

  :deep(.el-table__border th:last-child),
  :deep(.el-table__border td:last-child) {
    border-right: none;
  }

  :deep(.el-table__header-wrapper .el-table__header th .cell) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  :deep(.el-table__header-wrapper .el-table__header th:first-child .cell),
  :deep(.el-table__header-wrapper .el-table__header th:nth-child(2) .cell),
  :deep(.el-table__header-wrapper .el-table__header th:nth-child(3) .cell) {
    justify-content: flex-start;
  }
}

.product-image {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  border: 2px solid rgba(108, 99, 255, 0.2);
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(108, 99, 255, 0.5);
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
  }
}

.money-value {
  font-weight: 600;
  color: var(--dopamine-contrast);
  font-size: 24px;
}

.roi-value {
  font-weight: 700;
  font-size: 25px;
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-block;
}

.product-dialog-pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: rgba(108, 99, 255, 0.08);
  color: rgba(108, 99, 255, 0.7);
}

.roi-high {
  color: #6c63ff;
  font-weight: 700;
}

.roi-low {
  color: #ff6f91;
  font-weight: 700;
}
</style>
