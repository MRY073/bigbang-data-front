<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "FinishedLinkMonitor" });

type WarningLevel = "严重" | "一般" | "轻微" | "正常";

type ProductCard = {
  id: string;
  name: string;
  image?: string | null;
  visitorsAvg: number[];
  visitorsStd: number[];
  adCostAvg: number[];
  adCostStd: number[];
  salesAvg: number[];
  salesStd: number[];
  warningLevel: WarningLevel;
  warningMsg?: string;
};

const products = ref<ProductCard[]>([]);
const loading = ref(false);

const API_LIST = "/api/finished/link/monitor/list"; // placeholder

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

/** 本地前端关注开关状态（仅内存保留，组件 keep-alive 时会保存；刷新页面会重置） */
const followState = ref<Record<string, { on: boolean; time?: string }>>({});

/** 切换关注开关（只在前端保存） */
function toggleFollow(id: string, val: boolean) {
  if (!followState.value[id]) followState.value[id] = { on: false };
  followState.value[id].on = val;
  followState.value[id].time = val ? new Date().toLocaleString() : undefined;
}

/** 获取关注状态（默认关） */
function isFollowed(id: string) {
  return !!followState.value[id]?.on;
}

/** 获取关注时间文本 */
function followTimeText(id: string) {
  return followState.value[id]?.time ?? "";
}

function loadMockData() {
  products.value = [
    {
      id: "SKU-1001",
      name: "成品 — 舒适运动鞋",
      image: "https://via.placeholder.com/120?text=SKU-1001",
      visitorsAvg: [4200, 4500, 4700, 4900, 5100],
      visitorsStd: [200, 210, 180, 150, 120],
      adCostAvg: [1200.5, 1400.2, 1500.3, 1600.0, 1700.9],
      adCostStd: [150.3, 120.5, 110.2, 90.1, 80.0],
      salesAvg: [32000, 33000, 34000, 35000, 36000],
      salesStd: [1200, 1100, 900, 800, 700],
      warningLevel: "正常",
      warningMsg: "指标均在正常区间"
    },
    {
      id: "SKU-2002",
      name: "成品 — 高端皮带",
      image: "https://via.placeholder.com/120?text=SKU-2002",
      visitorsAvg: [800, 760, 700, 650, 620],
      visitorsStd: [90, 85, 80, 70, 60],
      adCostAvg: [900, 880, 860, 840, 820],
      adCostStd: [200, 220, 240, 260, 280],
      salesAvg: [5000, 4800, 4500, 4200, 4000],
      salesStd: [400, 420, 450, 480, 500],
      warningLevel: "轻微",
      warningMsg: "近1/3天访客下降，建议关注"
    },
    {
      id: "SKU-3003",
      name: "成品 — 电子秤（热销）",
      image: "https://via.placeholder.com/120?text=SKU-3003",
      visitorsAvg: [12000, 12500, 13000, 13500, 14000],
      visitorsStd: [600, 620, 630, 640, 650],
      adCostAvg: [5000, 5200, 5400, 5600, 5800],
      adCostStd: [800, 820, 840, 860, 880],
      salesAvg: [80000, 82000, 84000, 86000, 88000],
      salesStd: [2000, 2100, 2200, 2300, 2400],
      warningLevel: "一般",
      warningMsg: "广告费用波动较大，ROI 下降"
    },
    {
      id: "SKU-4004",
      name: "成品 — 夏季连衣裙",
      image: null,
      visitorsAvg: [300, 280, 250, 220, 200],
      visitorsStd: [30, 28, 25, 22, 20],
      adCostAvg: [50, 45, 40, 35, 30],
      adCostStd: [5, 6, 7, 8, 9],
      salesAvg: [1200, 1100, 1000, 900, 800],
      salesStd: [80, 85, 90, 95, 100],
      warningLevel: "严重",
      warningMsg: "流量与转化骤降，需立刻处理"
    }
  ];
}

async function fetchData() {
  loading.value = true;
  const loader = showLoader("拉取数据...");
  try {
    const res = await fetch(API_LIST);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    products.value = data || [];
  } catch {
    loadMockData();
    ElMessage.info("使用本地示例数据（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="finished-monitor-page">
    <div class="controls">
      <el-button
        type="primary"
        :loading="loading"
        icon="el-icon-refresh"
        @click="fetchData"
        >拉取数据</el-button
      >
    </div>

    <div class="cards">
      <el-card
        v-for="p in products"
        :key="p.id"
        class="prod-card"
        :class="{ 'prod-followed': isFollowed(p.id) }"
      >
        <div class="card-row top">
          <div class="left">
            <img v-if="p.image" :src="p.image" alt="主图" class="prod-img" />
            <div v-else class="prod-img placeholder">无图</div>
          </div>

          <div class="meta">
            <div class="id">{{ p.id }}</div>
            <div class="name">{{ p.name }}</div>
            <div class="warn-row">
              <el-tag
                :type="
                  p.warningLevel === '严重'
                    ? 'danger'
                    : p.warningLevel === '一般'
                      ? 'warning'
                      : p.warningLevel === '轻微'
                        ? 'info'
                        : 'success'
                "
              >
                {{ p.warningLevel }}
              </el-tag>
              <span class="warn-msg">{{ p.warningMsg }}</span>
            </div>
          </div>

          <!-- 右侧关注开关 -->
          <div class="follow-area">
            <el-switch
              :model-value="isFollowed(p.id)"
              active-text="已关注"
              inactive-text="未关注"
              @change="val => toggleFollow(p.id, !!val)"
            />
            <div
              v-if="isFollowed(p.id)"
              class="follow-time"
              style="
                position: absolute;
                right: 50px;
                top: 30px;
                background: #fff;
                padding: 2px 8px;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
                z-index: 2;
              "
            >
              {{ followTimeText(p.id) }}
            </div>
            <!-- <div v-if="isFollowed(p.id)" class="follow-time">
              {{ followTimeText(p.id) }}
            </div> -->
          </div>
        </div>

        <div class="metrics">
          <div class="metric-block">
            <div class="metric-title">日均访客</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.visitorsAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >{{ v }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">访客数标准差</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.visitorsStd"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >{{ v }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">日均广告花费</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.adCostAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >¥{{ v.toFixed(2) }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">广告花费标准差</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.adCostStd"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >¥{{ v.toFixed(2) }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">日均销售额</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.salesAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >¥{{ (v as number).toLocaleString() }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">销售额标准差</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.salesStd"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >¥{{ (v as number).toLocaleString() }}</span
              >
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.finished-monitor-page {
  padding: 20px;
  background: #f6f8fb;
  min-height: calc(100vh - 80px);
  box-sizing: border-box;
}

.controls {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prod-card {
  padding: 16px;
  border-radius: 10px;
  position: relative;
}

/* 当关注开关打开时，整个卡片背景变为浅灰 */
.prod-card.prod-followed {
  background-color: #e3e5e8;
}

/* 顶部行：图+元信息 */
.card-row.top {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;
}

.left .prod-img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  background: #fff;
}

.left .prod-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aa8bf;
  background: #f2f6fb;
}

/* 元信息 */
.meta {
  flex: 1;
}
.meta .id {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}
.meta .name {
  font-size: 16px;
  color: #2b2b2b;
  margin-bottom: 8px;
}
.warn-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.warn-msg {
  color: #606266;
  font-size: 13px;
}

/* 右侧关注区域，固定靠右显示 */
.follow-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 160px;
}

/* 关注时间显示（本地时间） */
.follow-time {
  font-size: 12px;
  color: #909399;
}

/* 指标区域：分多块竖向排列（行内显示五个值） */
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

/* 单个指标块 */
.metric-block {
  background: #ffffff;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 6px 12px rgba(32, 45, 61, 0.04);
}

.metric-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
  text-align: left;
}

.metric-values {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
}

.metric-value {
  padding: 6px 10px;
  border-radius: 6px;
  min-width: 72px;
  text-align: center;
  font-weight: 700;
  color: #fff;
  box-shadow: 0 2px 6px rgba(16, 34, 70, 0.06);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial;
  font-size: 14px;
}

/* 不同位置不同颜色（便于区分 30/15/7/3/1） */
.metric-value.c0 {
  background: linear-gradient(135deg, #2b8cff 0%, #4aa6ff 100%);
}
.metric-value.c1 {
  background: linear-gradient(135deg, #1abc9c 0%, #34d9b1 100%);
}
.metric-value.c2 {
  background: linear-gradient(135deg, #ffb400 0%, #ffc857 100%);
}
.metric-value.c3 {
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8f8f 100%);
}
.metric-value.c4 {
  background: linear-gradient(135deg, #6f42c1 0%, #8a6fe6 100%);
}

/* 响应式 */
@media (max-width: 900px) {
  .metric-values {
    gap: 8px;
  }
  .metric-value {
    min-width: 60px;
    font-size: 13px;
    padding: 6px 8px;
  }
  .left .prod-img {
    width: 96px;
    height: 96px;
  }
}
</style>
