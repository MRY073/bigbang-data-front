<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";
import {
  getTestingMonitorProducts,
  type TestingMonitorProduct
} from "@/api/products";

defineOptions({ name: "TrialLinkMonitor" });

// 前端使用的商品数据（与 API 返回类型一致）
type Product = TestingMonitorProduct;

// 测款状态枚举
type TestingStatus = "finished" | "watching" | "normal";

const products = ref<Product[]>([]);
const loading = ref(false);
const selectedShop = ref<string>("1489850435"); // 默认选择第一个店铺

// 店铺选项（与数据上传页面保持一致）
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

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

/**
 * 数字格式化（添加千分位）
 */
function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

/**
 * 格式化日期显示（正确处理 ISO 8601 格式）
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "未设置";
  try {
    // ISO 8601 格式可能是：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm:ss.sssZ 等
    // 直接提取日期部分，避免时区转换问题
    const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      // 验证日期有效性
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const day = parseInt(dateMatch[3], 10);

      // 基本验证
      if (
        year >= 1900 &&
        year <= 2100 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // 如果正则匹配失败，尝试使用 Date 对象（兼容其他格式）
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "日期格式错误";
  } catch {
    return "日期格式错误";
  }
}

/**
 * 判断测款日期是否超过15天（正确处理 ISO 8601 格式）
 */
function isTestingDateOver15Days(dateString: string | null): boolean {
  if (!dateString) return false;
  try {
    // 从 ISO 8601 格式中提取日期部分（YYYY-MM-DD），避免时区问题
    const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return false;

    const year = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1; // 月份从0开始
    const day = parseInt(dateMatch[3], 10);

    // 创建测试日期（使用本地时区，但只使用日期部分）
    const testingDate = new Date(year, month, day);
    const today = new Date();

    // 重置时间到0点，只比较日期
    today.setHours(0, 0, 0, 0);
    testingDate.setHours(0, 0, 0, 0);

    // 计算天数差
    const diffTime = today.getTime() - testingDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 15;
  } catch {
    return false;
  }
}

/**
 * 获取测款状态
 * 第一类：测款完毕 - 点击数 > 100 或 订单数 > 6 或 测款开始日期 > 15天
 * 第二类：测款关注中 - 点击数 50-100 或 订单数 3-6
 * 第三类：白板 - 点击数 < 50 或 订单数 0-2
 */
function getTestingStatus(p: Product): TestingStatus {
  const visitors = p.total_visitors;
  const orders = p.total_orders;
  const isOver15Days = isTestingDateOver15Days(p.testing_stage_start);

  // 第一类：测款完毕
  if (visitors > 100 || orders > 6 || isOver15Days) {
    return "finished";
  }

  // 第二类：测款关注中
  if ((visitors >= 50 && visitors <= 100) || (orders >= 3 && orders <= 6)) {
    return "watching";
  }

  // 第三类：白板
  return "normal";
}

/**
 * 根据状态判断卡片样式类
 */
function rowClass(p: Product) {
  const status = getTestingStatus(p);
  if (status === "finished") return "card-status-finished";
  if (status === "watching") return "card-status-watching";
  return "card-status-normal";
}

/**
 * 获取状态标签文本
 */
function getStatusLabel(p: Product): string {
  const status = getTestingStatus(p);
  if (status === "finished") return "测款完毕";
  if (status === "watching") return "测款关注中";
  return "";
}

/**
 * 获取状态提示信息
 */
function getStatusHint(p: Product): string {
  const status = getTestingStatus(p);
  if (status === "finished") return "测款已完成，需马上处理";
  if (status === "watching") return "数据优秀情况下及时转为潜力款，需尽快处理";
  return "";
}

/**
 * 获取状态优先级（用于排序）
 */
function getStatusPriority(status: TestingStatus): number {
  if (status === "finished") return 1; // 最高优先级
  if (status === "watching") return 2;
  return 3; // 白板最低优先级
}

/**
 * 对商品列表按状态排序
 */
function sortProductsByStatus(productsList: Product[]): Product[] {
  return [...productsList].sort((a, b) => {
    const statusA = getTestingStatus(a);
    const statusB = getTestingStatus(b);
    return getStatusPriority(statusA) - getStatusPriority(statusB);
  });
}

/**
 * 加载模拟数据（用于测试）
 */
function loadMockData() {
  const today = new Date();
  const date20DaysAgo = new Date(today);
  date20DaysAgo.setDate(today.getDate() - 20); // 20天前（超过15天）
  const date10DaysAgo = new Date(today);
  date10DaysAgo.setDate(today.getDate() - 10); // 10天前（未超过15天）
  const date5DaysAgo = new Date(today);
  date5DaysAgo.setDate(today.getDate() - 5); // 5天前

  products.value = [
    // 测款完毕状态示例
    {
      product_id: "SKU-T1001",
      product_name: "测款 — 轻便跑鞋",
      product_image: "https://via.placeholder.com/160?text=T1001",
      testing_stage_start: date20DaysAgo.toISOString().split("T")[0], // 超过15天
      total_orders: 2,
      total_visitors: 60
    },
    {
      product_id: "SKU-T1002",
      product_name: "测款 — 多功能杯",
      product_image: "https://via.placeholder.com/160?text=T1002",
      testing_stage_start: date10DaysAgo.toISOString().split("T")[0],
      total_orders: 7, // 订单数 > 6
      total_visitors: 85
    },
    {
      product_id: "SKU-T1003",
      product_name: "测款 — 智能照明灯",
      product_image: "https://via.placeholder.com/160?text=T1003",
      testing_stage_start: date5DaysAgo.toISOString().split("T")[0],
      total_orders: 4,
      total_visitors: 120 // 点击数 > 100
    },
    // 测款关注中状态示例
    {
      product_id: "SKU-T1004",
      product_name: "测款 — 创意手机支架",
      product_image: null,
      testing_stage_start: date5DaysAgo.toISOString().split("T")[0],
      total_orders: 5, // 订单数 3-6
      total_visitors: 75 // 点击数 50-100
    },
    {
      product_id: "SKU-T1005",
      product_name: "测款 — 多彩背包",
      product_image: "https://via.placeholder.com/160?text=T1005",
      testing_stage_start: date10DaysAgo.toISOString().split("T")[0],
      total_orders: 1,
      total_visitors: 65 // 点击数 50-100
    },
    // 白板状态示例
    {
      product_id: "SKU-T1006",
      product_name: "测款 — 简约水杯",
      product_image: "https://via.placeholder.com/160?text=T1006",
      testing_stage_start: date5DaysAgo.toISOString().split("T")[0],
      total_orders: 0,
      total_visitors: 30 // 点击数 < 50
    },
    {
      product_id: "SKU-T1007",
      product_name: "测款 — 运动手环",
      product_image: "https://via.placeholder.com/160?text=T1007",
      testing_stage_start: date10DaysAgo.toISOString().split("T")[0],
      total_orders: 2, // 订单数 0-2
      total_visitors: 45 // 点击数 < 50
    }
  ];
}

async function fetchData() {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  loading.value = true;
  const loader = showLoader("拉取数据中...");
  try {
    // 将店铺ID和店铺名称作为查询参数传递
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const result = await getTestingMonitorProducts({
      shopID: selectedShop.value,
      shopName: shopOption.label
    });

    if (result.success && result.data) {
      // 直接使用后端返回的数据结构，并按状态排序
      const data = result.data as Product[];
      products.value = sortProductsByStatus(data);
      if (products.value.length === 0) {
        ElMessage.info("当前店铺暂无测款商品");
      } else {
        ElMessage.success(
          result.message || `查询成功，共 ${products.value.length} 条数据`
        );
      }
    } else {
      throw new Error(result.error || result.message || "查询失败");
    }
  } catch (error: any) {
    console.error("拉取数据失败:", error);
    // 如果是网络错误，使用模拟数据
    if (
      error?.message?.includes("HTTP error") ||
      error?.message?.includes("fetch") ||
      error?.message?.includes("Network")
    ) {
      loadMockData();
      // 对模拟数据也进行排序
      products.value = sortProductsByStatus(products.value);
      ElMessage.info("使用本地示例数据（后端不可用）");
    } else {
      ElMessage.error(error?.message || "网络连接失败，请检查网络后重试");
      products.value = [];
    }
  } finally {
    loader.close();
    loading.value = false;
  }
}

/** 处理图片加载失败 */
function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = "none";
  // 创建或显示占位符
  const placeholder = document.createElement("div");
  placeholder.className = "thumb placeholder";
  placeholder.textContent = "无图";
  img.parentElement?.appendChild(placeholder);
}

/** 复制 id */
async function copyId(text: string) {
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

// 页面加载时不自动拉取数据，需要用户手动选择店铺后点击查询
// onMounted(() => {
//   fetchData();
// });
</script>

<template>
  <div class="trial-monitor-page">
    <div class="controls">
      <el-select
        v-model="selectedShop"
        placeholder="选择店铺"
        style="width: 200px; margin-right: 12px"
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
        :loading="loading"
        icon="el-icon-refresh"
        @click="fetchData"
        >拉取数据</el-button
      >
    </div>

    <!-- 空数据提示 -->
    <el-empty
      v-if="!loading && products.length === 0 && selectedShop"
      description="当前店铺暂无测款商品"
      :image-size="120"
    />

    <!-- 数据展示 -->
    <div v-else class="grid">
      <div
        v-for="p in products"
        :key="p.product_id"
        class="prod-card"
        :class="rowClass(p)"
      >
        <div class="card-top">
          <div class="img-area">
            <img
              v-if="p.product_image"
              :src="p.product_image"
              alt="主图"
              class="thumb"
              @error="handleImageError"
            />
            <div v-if="!p.product_image" class="thumb placeholder">无图</div>
          </div>

          <div class="info-area">
            <div class="id" title="点击复制ID" @click="copyId(p.product_id)">
              {{ p.product_id }}
            </div>
            <div class="name" :title="p.product_name">{{ p.product_name }}</div>
            <div class="tags">
              <el-tag v-if="getTestingStatus(p) === 'finished'" type="danger"
                >测款完毕</el-tag
              >
              <el-tag
                v-else-if="getTestingStatus(p) === 'watching'"
                type="warning"
                >测款关注中</el-tag
              >
            </div>
          </div>
        </div>

        <div class="card-metrics">
          <div class="metric">
            <div class="label">测款日期开始</div>
            <div class="value">{{ formatDate(p.testing_stage_start) }}</div>
          </div>
          <div class="metric">
            <div class="label">出单数</div>
            <div class="value">{{ formatNumber(p.total_orders) }}</div>
          </div>
          <div class="metric">
            <div class="label">累计访客</div>
            <div class="value">{{ formatNumber(p.total_visitors) }}</div>
          </div>
        </div>

        <div class="card-foot">
          <div v-if="getStatusHint(p)" class="hint">{{ getStatusHint(p) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.trial-monitor-page {
  @include dopamine.dopamine-page();
  padding: 32px;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
  color: var(--dopamine-contrast);
}

.controls {
  @include dopamine.dopamine-toolbar();
  justify-content: flex-end;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(108, 99, 255, 0.2) 55%,
    rgba(255, 110, 199, 0.18) 100%
  );
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  align-items: start;
}

.prod-card {
  @include dopamine.dopamine-surface(22px);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: none;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-6px);
    box-shadow:
      0 26px 50px rgba(255, 110, 199, 0.3),
      0 18px 36px rgba(108, 99, 255, 0.24);
  }
}

.card-status-finished {
  background: linear-gradient(
    135deg,
    rgba(255, 110, 145, 0.22) 0%,
    rgba(255, 155, 106, 0.22) 45%,
    rgba(255, 211, 61, 0.2) 100%
  );
  border: 1px solid rgba(255, 110, 145, 0.3);
}

.card-status-watching {
  background: linear-gradient(
    135deg,
    rgba(45, 226, 230, 0.22) 0%,
    rgba(108, 99, 255, 0.18) 60%,
    rgba(255, 211, 61, 0.16) 100%
  );
  border: 1px solid rgba(108, 99, 255, 0.28);
}

.card-status-normal {
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.72) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.card-top {
  display: flex;
  gap: 16px;
  align-items: center;
}

.img-area {
  flex: 0 0 96px;
  width: 96px;
  height: 96px;
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 20px rgba(31, 18, 53, 0.14);
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb.placeholder {
  color: var(--dopamine-secondary);
  background: rgba(108, 99, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.info-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.id {
  font-weight: 700;
  font-size: 14px;
  color: var(--dopamine-secondary);
  cursor: pointer;
  user-select: text;
  text-shadow: 0 6px 14px rgba(108, 99, 255, 0.2);

  &:hover {
    color: var(--dopamine-primary);
  }
}

.name {
  font-size: 16px;
  font-weight: 600;
  color: var(--dopamine-contrast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.tags {
  margin-top: 4px;

  :deep(.el-tag) {
    border-radius: 999px;
    padding: 0 16px;
    font-weight: 600;
    border: none;
    box-shadow: 0 10px 16px rgba(255, 110, 199, 0.25);
  }

  :deep(.el-tag--danger) {
    background: linear-gradient(120deg, #ff6f91 0%, #ff3f6c 100%);
    color: #fff;
  }

  :deep(.el-tag--warning) {
    background: linear-gradient(120deg, #ffd33d 0%, #ff9b6a 100%);
    color: #7a4b0f;
    box-shadow: 0 10px 18px rgba(255, 211, 61, 0.35);
  }
}

.card-metrics {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.metric {
  flex: 1 1 30%;
  min-width: 100px;
  border-radius: 16px;
  padding: 12px 14px;
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.88) 0%,
    rgba(108, 99, 255, 0.12) 45%,
    rgba(45, 226, 230, 0.12) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow: 0 12px 20px rgba(31, 18, 53, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric .label {
  font-size: 12px;
  color: var(--dopamine-soft-ink);
  letter-spacing: 0.4px;
}

.metric .value {
  font-size: 20px;
  font-weight: 700;
  color: var(--dopamine-contrast);
}

.card-foot .hint {
  font-weight: 700;
  font-size: 13px;
  color: var(--dopamine-contrast);
}

.card-status-finished .card-foot .hint {
  color: #ff3f6c;
}

.card-status-watching .card-foot .hint {
  color: #ff9b6a;
}

:deep(.el-button--primary) {
  @include dopamine.dopamine-primary-button();
}

@media (max-width: 1024px) {
  .trial-monitor-page {
    padding: 24px 20px;
  }

  .controls {
    justify-content: center;
  }
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .metric {
    min-width: 100%;
  }
}
</style>

