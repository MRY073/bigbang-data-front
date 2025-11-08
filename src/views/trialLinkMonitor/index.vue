<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "TrialLinkMonitor" });

// 后端返回的商品数据结构
type BackendProduct = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_start_date: string | null; // 测款日期开始
  total_visitors: number;
  total_orders: number;
};

// 前端使用的商品数据
type Product = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_start_date: string | null; // 测款日期开始
  total_visitors: number;
  total_orders: number;
};

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

const API_LIST = "/api/products/testing-monitor";

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
 * 格式化日期显示
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "未设置";
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "日期格式错误";
  }
}

/**
 * 判断测款日期是否超过15天
 */
function isTestingDateOver15Days(dateString: string | null): boolean {
  if (!dateString) return false;
  try {
    const testingDate = new Date(dateString);
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
 * 判断是否需要显示警告（需要更改链接状态）
 */
function shouldShowAlert(p: Product): boolean {
  return (
    p.total_visitors >= 100 ||
    p.total_orders >= 5 ||
    isTestingDateOver15Days(p.testing_start_date)
  );
}

/**
 * 根据数据判断卡片样式类
 */
function rowClass(p: Product) {
  if (shouldShowAlert(p)) return "card-alert-red";
  if (p.total_visitors >= 50) return "card-alert-green";
  return "";
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
    {
      product_id: "SKU-T1001",
      product_name: "测款 — 轻便跑鞋",
      product_image: "https://via.placeholder.com/160?text=T1001",
      testing_start_date: date20DaysAgo.toISOString().split("T")[0],
      total_orders: 2,
      total_visitors: 60
    },
    {
      product_id: "SKU-T1002",
      product_name: "测款 — 多功能杯",
      product_image: "https://via.placeholder.com/160?text=T1002",
      testing_start_date: date10DaysAgo.toISOString().split("T")[0],
      total_orders: 6,
      total_visitors: 110
    },
    {
      product_id: "SKU-T1003",
      product_name: "测款 — 创意手机支架",
      product_image: null,
      testing_start_date: date5DaysAgo.toISOString().split("T")[0],
      total_orders: 0,
      total_visitors: 45
    },
    {
      product_id: "SKU-T1004",
      product_name: "测款 — 智能照明灯",
      product_image: "https://via.placeholder.com/160?text=T1004",
      testing_start_date: date20DaysAgo.toISOString().split("T")[0],
      total_orders: 4,
      total_visitors: 98
    },
    {
      product_id: "SKU-T1005",
      product_name: "测款 — 多彩背包",
      product_image: "https://via.placeholder.com/160?text=T1005",
      testing_start_date: date10DaysAgo.toISOString().split("T")[0],
      total_orders: 1,
      total_visitors: 52
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
    const url = new URL(API_LIST, window.location.origin);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("shopName", shopOption.label);
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const result = await res.json();

    if (result.success && result.data) {
      // 直接使用后端返回的数据结构
      products.value = result.data as Product[];
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
      error?.message?.includes("fetch")
    ) {
      loadMockData();
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
              <el-tag v-if="shouldShowAlert(p)" type="danger">需处理</el-tag>
              <el-tag v-else-if="p.total_visitors >= 50" type="success"
                >关注中</el-tag
              >
            </div>
          </div>
        </div>

        <div class="card-metrics">
          <div class="metric">
            <div class="label">测款日期开始</div>
            <div class="value">{{ formatDate(p.testing_start_date) }}</div>
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
          <div v-if="shouldShowAlert(p)" class="hint">及时更改该链接状态</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trial-monitor-page {
  padding: 20px;
  background: #f6f8fb;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
}

/* 控制区 */
.controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

/* 网格布局：左到右、自动换行，每个商品一个块 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}

/* 卡片样式（每个商品一个块） */
.prod-card {
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 8px 18px rgba(32, 45, 61, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease;
}
.prod-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 30px rgba(32, 45, 61, 0.08);
}

/* 颜色类 */
.card-alert-green {
  background: linear-gradient(180deg, #f6fff7 0%, #eefcf0 100%);
  border: 1px solid rgba(34, 197, 94, 0.08);
}
.card-alert-red {
  background: linear-gradient(180deg, #fff6f6 0%, #fff1f1 100%);
  border: 1px solid rgba(255, 77, 79, 0.08);
}

/* 顶部：图片 + 基本信息 */
.card-top {
  display: flex;
  gap: 12px;
  align-items: center;
}

.img-area {
  flex: 0 0 96px;
  width: 96px;
  height: 96px;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid rgba(16, 34, 70, 0.04);
}
.thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb.placeholder {
  color: #9aa8bf;
  background: #f2f6fb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  padding: 6px;
}

/* 信息区 */
.info-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0; /* 确保 flex 子元素可以收缩 */
}
.id {
  font-weight: 700;
  color: #1f2d3d;
  cursor: pointer;
  user-select: text;
  font-size: 13px;
}
.name {
  font-size: 15px;
  color: #2b2b2b;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%; /* 确保不超过父容器宽度 */
  width: 100%; /* 占据父容器全部宽度 */
}
.tags {
  margin-top: 6px;
}

/* 指标区域 */
.card-metrics {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.metric {
  flex: 1 1 30%;
  background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
  border-radius: 8px;
  padding: 10px;
  min-width: 90px;
  box-shadow: 0 6px 12px rgba(32, 45, 61, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metric .label {
  font-size: 12px;
  color: #909399;
}
.metric .value {
  font-size: 18px;
  font-weight: 800;
  color: #1f2d3d;
}

/* 底部提示 */
.card-foot .hint {
  color: #cf1322;
  font-weight: 700;
  font-size: 13px;
}

/* 响应式：窄屏时每行一个块 */
@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .metric {
    min-width: 100%;
  }
}
</style>
