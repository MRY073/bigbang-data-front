<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
// import type { LoadingInstance } from "element-plus";

defineOptions({ name: "AdAnalysis" });

// 类型定义
type AdType = "finished" | "trial" | "unknown";
type TrendData = {
  date: string;
  cost: number;
  finishedCost: number;
  trialCost: number;
  unknownCost: number;
};
type DailyData = {
  date: string;
  finishedCost: number;
  trialCost: number;
  unknownCost: number;
  finishedIds: string[];
  trialIds: string[];
  unknownIds: string[];
};

// 状态
const selectedDate = ref<string>(new Date().toISOString().split("T")[0]);
const trendChart = ref<echarts.ECharts>();
const pieChart = ref<echarts.ECharts>();
const dailyData = ref<DailyData>();
const loading = ref(false);

// API
const API = {
  TREND: "/api/ad/trend",
  DAILY: "/api/ad/daily"
};

// 图表配色方案
const COLORS = {
  finished: "#67C23A", // 成品-绿色
  trial: "#409EFF", // 测款-蓝色
  unknown: "#909399" // 未知-灰色
};

/**
 * 初始化趋势图表
 */
function initTrendChart(container: HTMLElement) {
  trendChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" }
    },
    legend: {
      data: ["成品广告", "测款广告", "未分类广告"]
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: []
    },
    yAxis: {
      type: "value",
      name: "广告花费"
    },
    series: [
      {
        name: "成品广告",
        type: "bar",
        stack: "total",
        color: COLORS.finished,
        data: []
      },
      {
        name: "测款广告",
        type: "bar",
        stack: "total",
        color: COLORS.trial,
        data: []
      },
      {
        name: "未分类广告",
        type: "bar",
        stack: "total",
        color: COLORS.unknown,
        data: []
      }
    ]
  };
  trendChart.value.setOption(option);
}

/**
 * 初始化饼图
 */
function initPieChart(container: HTMLElement) {
  pieChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)"
    },
    legend: {
      orient: "vertical",
      left: "left"
    },
    series: [
      {
        type: "pie",
        radius: "70%",
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)"
          }
        }
      }
    ]
  };
  pieChart.value.setOption(option);
}

/**
 * 更新趋势图数据
 */
async function updateTrendData() {
  loading.value = true;
  const loader = ElLoading.service({ text: "加载趋势数据..." });

  try {
    const res = await fetch(API.TREND);
    if (!res.ok) throw new Error("获取趋势数据失败");
    const data: TrendData[] = await res.json();

    const dates = data.map(d => d.date);
    const finishedCosts = data.map(d => d.finishedCost);
    const trialCosts = data.map(d => d.trialCost);
    const unknownCosts = data.map(d => d.unknownCost);

    trendChart.value?.setOption({
      xAxis: { data: dates },
      series: [
        { data: finishedCosts },
        { data: trialCosts },
        { data: unknownCosts }
      ]
    });
  } catch {
    // 使用模拟数据
    const mockData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split("T")[0],
        finishedCost: Math.random() * 5000 + 3000, // 3000-8000
        trialCost: Math.random() * 3000 + 1000, // 1000-4000
        unknownCost: Math.random() * 1000 + 500 // 500-1500
      };
    });

    const dates = mockData.map(d => d.date);
    const finishedCosts = mockData.map(d => d.finishedCost);
    const trialCosts = mockData.map(d => d.trialCost);
    const unknownCosts = mockData.map(d => d.unknownCost);

    trendChart.value?.setOption({
      xAxis: { data: dates },
      series: [
        { data: finishedCosts },
        { data: trialCosts },
        { data: unknownCosts }
      ]
    });

    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/**
 * 获取指定日期数据
 */
async function fetchDailyData() {
  if (!selectedDate.value) {
    ElMessage.warning("请选择日期");
    return;
  }

  loading.value = true;
  const loader = ElLoading.service({ text: "加载数据..." });

  try {
    const res = await fetch(`${API.DAILY}?date=${selectedDate.value}`);
    if (!res.ok) throw new Error("获取数据失败");
    const data: DailyData = await res.json();
    dailyData.value = data;

    // 更新饼图
    const total = data.finishedCost + data.trialCost + data.unknownCost;
    pieChart.value?.setOption({
      series: [
        {
          data: [
            {
              name: "成品广告",
              value: data.finishedCost,
              itemStyle: { color: COLORS.finished }
            },
            {
              name: "测款广告",
              value: data.trialCost,
              itemStyle: { color: COLORS.trial }
            },
            {
              name: "未分类广告",
              value: data.unknownCost,
              itemStyle: { color: COLORS.unknown }
            }
          ]
        }
      ]
    });
  } catch {
    // 使用模拟数据
    const mockData: DailyData = {
      date: selectedDate.value,
      finishedCost: 5678.9,
      trialCost: 2345.67,
      unknownCost: 890.12,
      finishedIds: [
        "SKU001234",
        "SKU005678",
        "SKU009012",
        "SKU003456",
        "SKU007890",
        "SKU001122",
        "SKU334455",
        "SKU667788",
        "SKU990011"
      ],
      trialIds: [
        "SKU112233",
        "SKU445566",
        "SKU778899",
        "SKU123456",
        "SKU789012",
        "SKU345678"
      ],
      unknownIds: [
        "SKU998877",
        "SKU665544",
        "SKU332211",
        "SKU102938",
        "SKU475869"
      ]
    };

    dailyData.value = mockData;

    // 更新饼图
    const total =
      mockData.finishedCost + mockData.trialCost + mockData.unknownCost;
    pieChart.value?.setOption({
      series: [
        {
          data: [
            {
              name: "成品广告",
              value: mockData.finishedCost,
              itemStyle: { color: COLORS.finished }
            },
            {
              name: "测款广告",
              value: mockData.trialCost,
              itemStyle: { color: COLORS.trial }
            },
            {
              name: "未分类广告",
              value: mockData.unknownCost,
              itemStyle: { color: COLORS.unknown }
            }
          ]
        }
      ]
    });

    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/**
 * 复制商品ID到剪贴板
 */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

// 监听图表容器大小变化
function handleResize() {
  trendChart.value?.resize();
  pieChart.value?.resize();
}

onMounted(() => {
  window.addEventListener("resize", handleResize);
  // 初始加载趋势数据
  updateTrendData();
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  trendChart.value?.dispose();
  pieChart.value?.dispose();
});
</script>

<template>
  <div class="ad-analysis-page">
    <!-- 趋势分析部分 -->
    <el-card class="trend-card">
      <template #header>
        <div class="card-header">
          <span class="title">广告占比趋势（近30天）</span>
        </div>
      </template>
      <div ref="trendChartRef" class="trend-chart" />
    </el-card>

    <!-- 日期分析部分 -->
    <el-card class="daily-card">
      <template #header>
        <div class="card-header">
          <span class="title">单日广告占比分析</span>
          <div class="date-picker">
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="选择日期"
              :disabled="loading"
              value-format="YYYY-MM-DD"
            />
            <el-button
              type="primary"
              :loading="loading"
              @click="fetchDailyData"
            >
              确定
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="dailyData" class="daily-content">
        <!-- 数据概览 -->
        <div class="overview-section">
          <div class="cost-stats">
            <div class="stat-item">
              <h4>一、广告消耗分布</h4>
              <div class="stat-grid">
                <div class="stat-box finished">
                  <div class="label">成品广告消耗</div>
                  <div class="value">
                    ¥{{ dailyData.finishedCost.toFixed(2) }}
                  </div>
                </div>
                <div class="stat-box trial">
                  <div class="label">测款广告消耗</div>
                  <div class="value">¥{{ dailyData.trialCost.toFixed(2) }}</div>
                </div>
                <div class="stat-box unknown">
                  <div class="label">未分类广告消耗</div>
                  <div class="value">
                    ¥{{ dailyData.unknownCost.toFixed(2) }}
                  </div>
                </div>
              </div>
            </div>
            <div ref="pieChartRef" class="pie-chart" />
          </div>
        </div>

        <!-- 商品ID列表 -->
        <div class="products-section">
          <h4>二、广告商品明细</h4>
          <div class="lists-container">
            <div class="id-list finished">
              <div class="list-header">成品广告商品</div>
              <div class="id-chips">
                <span
                  v-for="id in dailyData.finishedIds"
                  :key="id"
                  class="id-chip"
                  title="点击复制"
                  @click="copyToClipboard(id)"
                >
                  {{ id }}
                </span>
              </div>
            </div>
            <div class="id-list trial">
              <div class="list-header">测款广告商品</div>
              <div class="id-chips">
                <span
                  v-for="id in dailyData.trialIds"
                  :key="id"
                  class="id-chip"
                  title="点击复制"
                  @click="copyToClipboard(id)"
                >
                  {{ id }}
                </span>
              </div>
            </div>
            <div class="id-list unknown">
              <div class="list-header">未分类广告商品</div>
              <div class="id-chips">
                <span
                  v-for="id in dailyData.unknownIds"
                  :key="id"
                  class="id-chip"
                  title="点击复制"
                  @click="copyToClipboard(id)"
                >
                  {{ id }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">请选择日期并点击确定按钮查看分析</div>
    </el-card>
  </div>
</template>

<style scoped>
.ad-analysis-page {
  padding: 20px;
  background: #f7f9fc;
  min-height: calc(100vh - 80px);
}

.trend-card,
.daily-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.trend-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.date-picker {
  display: flex;
  gap: 12px;
}

.trend-chart {
  height: 400px;
  width: 100%;
}

.daily-content {
  padding: 16px 0;
}

.overview-section {
  margin-bottom: 24px;
}

.cost-stats {
  display: flex;
  gap: 24px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.stat-box {
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
}

.stat-box.finished {
  border-left: 4px solid #67c23a;
}
.stat-box.trial {
  border-left: 4px solid #409eff;
}
.stat-box.unknown {
  border-left: 4px solid #909399;
}

.stat-box .label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

.stat-box .value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.pie-chart {
  width: 320px;
  height: 320px;
}

.products-section {
  margin-top: 24px;
}

.lists-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 16px;
}

.id-list {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
}

.list-header {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 12px;
}

.id-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.id-chip {
  padding: 4px 12px;
  background: #fff;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  user-select: all;
  transition: all 0.2s;
}

.id-chip:hover {
  background: #ecf5ff;
  color: #409eff;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
  font-size: 14px;
}

@media (max-width: 1200px) {
  .cost-stats {
    flex-direction: column;
  }

  .pie-chart {
    width: 100%;
    height: 280px;
  }

  .lists-container {
    grid-template-columns: 1fr;
  }
}
</style>
