<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "TrialLinkMonitor" });

type Product = {
  id: string;
  name: string;
  image?: string | null;
  cumulativeClicks: number;
  ordersCount: number;
  cumulativeVisitors: number;
};

const products = ref<Product[]>([]);
const loading = ref(false);

const API_LIST = "/api/trial/link/monitor/list";

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

function rowClass(p: Product) {
  if (p.cumulativeVisitors >= 100 || p.ordersCount >= 5)
    return "card-alert-red";
  if (p.cumulativeVisitors >= 50) return "card-alert-green";
  return "card-normal";
}

function loadMockData() {
  products.value = [
    {
      id: "SKU-T1001",
      name: "测款 — 轻便跑鞋",
      image: "https://via.placeholder.com/160?text=T1001",
      cumulativeClicks: 1240,
      ordersCount: 2,
      cumulativeVisitors: 60
    },
    {
      id: "SKU-T1002",
      name: "测款 — 多功能杯",
      image: "https://via.placeholder.com/160?text=T1002",
      cumulativeClicks: 540,
      ordersCount: 6,
      cumulativeVisitors: 110
    },
    {
      id: "SKU-T1003",
      name: "测款 — 创意手机支架",
      image: null,
      cumulativeClicks: 230,
      ordersCount: 0,
      cumulativeVisitors: 45
    },
    {
      id: "SKU-T1004",
      name: "测款 — 智能照明灯",
      image: "https://via.placeholder.com/160?text=T1004",
      cumulativeClicks: 980,
      ordersCount: 4,
      cumulativeVisitors: 98
    },
    {
      id: "SKU-T1005",
      name: "测款 — 多彩背包",
      image: "https://via.placeholder.com/160?text=T1005",
      cumulativeClicks: 320,
      ordersCount: 1,
      cumulativeVisitors: 52
    }
  ];
}

async function fetchData() {
  loading.value = true;
  const loader = showLoader("拉取数据中...");
  try {
    const res = await fetch(API_LIST);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    products.value = data || [];
  } catch {
    loadMockData();
    ElMessage.info("使用本地示例数据（后端不可用）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/** 复制 id */
function copyId(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="trial-monitor-page">
    <div class="controls">
      <el-button
        type="primary"
        :loading="loading"
        icon="el-icon-refresh"
        @click="fetchData"
        >拉取数据</el-button
      >
    </div>

    <div class="grid">
      <div
        v-for="p in products"
        :key="p.id"
        class="prod-card"
        :class="rowClass(p)"
      >
        <div class="card-top">
          <div class="img-area">
            <img v-if="p.image" :src="p.image" alt="主图" class="thumb" />
            <div v-else class="thumb placeholder">无图</div>
          </div>

          <div class="info-area">
            <div class="id" title="点击复制ID" @click="copyId(p.id)">
              {{ p.id }}
            </div>
            <div class="name" :title="p.name">{{ p.name }}</div>
            <div class="tags">
              <el-tag
                v-if="p.cumulativeVisitors >= 100 || p.ordersCount >= 5"
                type="danger"
                >需处理</el-tag
              >
              <el-tag v-else-if="p.cumulativeVisitors >= 50" type="success"
                >关注中</el-tag
              >
            </div>
          </div>
        </div>

        <div class="card-metrics">
          <div class="metric">
            <div class="label">累计点击</div>
            <div class="value">{{ p.cumulativeClicks }}</div>
          </div>
          <div class="metric">
            <div class="label">出单数</div>
            <div class="value">{{ p.ordersCount }}</div>
          </div>
          <div class="metric">
            <div class="label">累计访客</div>
            <div class="value">{{ p.cumulativeVisitors }}</div>
          </div>
        </div>

        <div class="card-foot">
          <div
            v-if="p.cumulativeVisitors >= 100 || p.ordersCount >= 5"
            class="hint"
          >
            及时更改该链接状态
          </div>
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
.card-normal {
}
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
