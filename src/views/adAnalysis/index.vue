<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
// import type { LoadingInstance } from "element-plus";

defineOptions({ name: "AdAnalysis" });

// 类型定义
type TrendDataItem = {
  date: string;
  testing_stage_spend: number;
  potential_stage_spend: number;
  product_stage_spend: number;
  abandoned_stage_spend: number;
  no_stage_spend: number;
};

type RatioData = {
  date: string;
  stages: {
    testing_stage: { spend: number };
    potential_stage: { spend: number };
    product_stage: {
      spend: number;
      sales_amount: number;
      roi: number;
    };
    abandoned_stage: { spend: number };
    no_stage: { spend: number };
  };
};

// 状态
const selectedDate = ref<string>(new Date().toISOString().split("T")[0]);
const selectedShop = ref<string>("1489850435"); // 默认选择第一个店铺
const trendChart = ref<echarts.ECharts>();
const pieChart = ref<echarts.ECharts>();
const ratioData = ref<RatioData>();
const loading = ref(false);
const trendLoading = ref(false); // 趋势图加载状态

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

// API
const API = {
  TREND: "/api/products/ad-trend",
  RATIO: "/api/products/ad-ratio"
};

// 图表配色方案
const COLORS = {
  testing: "#409EFF", // 测款阶段-蓝色
  potential: "#E6A23C", // 潜力阶段-橙色
  product: "#67C23A", // 成品阶段-绿色
  abandoned: "#F56C6C", // 放弃阶段-红色
  noStage: "#909399" // 无阶段-灰色
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
      data: ["测款阶段", "潜力阶段", "成品阶段", "放弃阶段", "无阶段"]
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
        name: "测款阶段",
        type: "bar",
        stack: "total",
        color: COLORS.testing,
        data: []
      },
      {
        name: "潜力阶段",
        type: "bar",
        stack: "total",
        color: COLORS.potential,
        data: []
      },
      {
        name: "成品阶段",
        type: "bar",
        stack: "total",
        color: COLORS.product,
        data: []
      },
      {
        name: "放弃阶段",
        type: "bar",
        stack: "total",
        color: COLORS.abandoned,
        data: []
      },
      {
        name: "无阶段",
        type: "bar",
        stack: "total",
        color: COLORS.noStage,
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
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  trendLoading.value = true;
  const loader = ElLoading.service({ text: "加载趋势数据..." });

  try {
    // 将店铺ID和店铺名称作为查询参数传递
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }
    const url = new URL(API.TREND, window.location.origin);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("shopName", shopOption.label);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("获取趋势数据失败");
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || result.message || "查询失败");
    }

    const data: TrendDataItem[] = result.data;

    const dates = data.map(d => d.date);
    const testingSpends = data.map(d => d.testing_stage_spend);
    const potentialSpends = data.map(d => d.potential_stage_spend);
    const productSpends = data.map(d => d.product_stage_spend);
    const abandonedSpends = data.map(d => d.abandoned_stage_spend);
    const noStageSpends = data.map(d => d.no_stage_spend);

    trendChart.value?.setOption({
      xAxis: { data: dates },
      series: [
        { data: testingSpends },
        { data: potentialSpends },
        { data: productSpends },
        { data: abandonedSpends },
        { data: noStageSpends }
      ]
    });

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取趋势数据失败:", error);
    // 使用模拟数据
    const mockData: TrendDataItem[] = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split("T")[0],
        testing_stage_spend: Math.random() * 2000 + 1000,
        potential_stage_spend: Math.random() * 1500 + 800,
        product_stage_spend: Math.random() * 5000 + 3000,
        abandoned_stage_spend: Math.random() * 500 + 200,
        no_stage_spend: Math.random() * 300 + 100
      };
    });

    const dates = mockData.map(d => d.date);
    const testingSpends = mockData.map(d => d.testing_stage_spend);
    const potentialSpends = mockData.map(d => d.potential_stage_spend);
    const productSpends = mockData.map(d => d.product_stage_spend);
    const abandonedSpends = mockData.map(d => d.abandoned_stage_spend);
    const noStageSpends = mockData.map(d => d.no_stage_spend);

    trendChart.value?.setOption({
      xAxis: { data: dates },
      series: [
        { data: testingSpends },
        { data: potentialSpends },
        { data: productSpends },
        { data: abandonedSpends },
        { data: noStageSpends }
      ]
    });

    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    trendLoading.value = false;
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

  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  loading.value = true;
  const loader = ElLoading.service({ text: "加载数据..." });

  try {
    // 将店铺ID、店铺名称和日期作为查询参数传递
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }
    const url = new URL(API.RATIO, window.location.origin);
    url.searchParams.append("date", selectedDate.value);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("shopName", shopOption.label);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("获取数据失败");
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || result.message || "查询失败");
    }

    const data: RatioData = result.data;
    ratioData.value = data;

    // 更新饼图
    const stages = data.stages;
    const total =
      stages.testing_stage.spend +
      stages.potential_stage.spend +
      stages.product_stage.spend +
      stages.abandoned_stage.spend +
      stages.no_stage.spend;

    pieChart.value?.setOption({
      series: [
        {
          data: [
            {
              name: "测款阶段",
              value: stages.testing_stage.spend,
              itemStyle: { color: COLORS.testing }
            },
            {
              name: "潜力阶段",
              value: stages.potential_stage.spend,
              itemStyle: { color: COLORS.potential }
            },
            {
              name: "成品阶段",
              value: stages.product_stage.spend,
              itemStyle: { color: COLORS.product }
            },
            {
              name: "放弃阶段",
              value: stages.abandoned_stage.spend,
              itemStyle: { color: COLORS.abandoned }
            },
            {
              name: "无阶段",
              value: stages.no_stage.spend,
              itemStyle: { color: COLORS.noStage }
            }
          ]
        }
      ]
    });

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取占比数据失败:", error);
    // 使用模拟数据
    const mockData: RatioData = {
      date: selectedDate.value,
      stages: {
        testing_stage: { spend: 2345.67 },
        potential_stage: { spend: 1800.5 },
        product_stage: {
          spend: 5678.9,
          sales_amount: 15000,
          roi: 2.64
        },
        abandoned_stage: { spend: 450.2 },
        no_stage: { spend: 120.3 }
      }
    };

    ratioData.value = mockData;

    // 更新饼图
    const stages = mockData.stages;
    pieChart.value?.setOption({
      series: [
        {
          data: [
            {
              name: "测款阶段",
              value: stages.testing_stage.spend,
              itemStyle: { color: COLORS.testing }
            },
            {
              name: "潜力阶段",
              value: stages.potential_stage.spend,
              itemStyle: { color: COLORS.potential }
            },
            {
              name: "成品阶段",
              value: stages.product_stage.spend,
              itemStyle: { color: COLORS.product }
            },
            {
              name: "放弃阶段",
              value: stages.abandoned_stage.spend,
              itemStyle: { color: COLORS.abandoned }
            },
            {
              name: "无阶段",
              value: stages.no_stage.spend,
              itemStyle: { color: COLORS.noStage }
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
    <!-- 店铺选择区域 -->
    <div class="shop-selector">
      <el-select
        v-model="selectedShop"
        placeholder="选择店铺"
        style="width: 200px"
      >
        <el-option
          v-for="item in shopOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </div>

    <!-- 趋势分析部分 -->
    <el-card class="trend-card">
      <template #header>
        <div class="card-header">
          <span class="title">广告占比趋势（近30天）</span>
          <el-button
            type="primary"
            :loading="trendLoading"
            icon="el-icon-refresh"
            @click="updateTrendData"
            >拉取数据</el-button
          >
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

      <div v-if="ratioData" class="daily-content">
        <!-- 数据概览 -->
        <div class="overview-section">
          <div class="cost-stats">
            <div class="stat-item">
              <h4>一、广告消耗分布</h4>
              <div class="stat-grid">
                <div class="stat-box testing">
                  <div class="label">测款阶段消耗</div>
                  <div class="value">
                    ¥{{ ratioData.stages.testing_stage.spend.toFixed(2) }}
                  </div>
                </div>
                <div class="stat-box potential">
                  <div class="label">潜力阶段消耗</div>
                  <div class="value">
                    ¥{{ ratioData.stages.potential_stage.spend.toFixed(2) }}
                  </div>
                </div>
                <div class="stat-box product">
                  <div class="label">成品阶段消耗</div>
                  <div class="value">
                    ¥{{ ratioData.stages.product_stage.spend.toFixed(2) }}
                  </div>
                </div>
                <div class="stat-box abandoned">
                  <div class="label">放弃阶段消耗</div>
                  <div class="value">
                    ¥{{ ratioData.stages.abandoned_stage.spend.toFixed(2) }}
                  </div>
                </div>
                <div class="stat-box no-stage">
                  <div class="label">无阶段消耗</div>
                  <div class="value">
                    ¥{{ ratioData.stages.no_stage.spend.toFixed(2) }}
                  </div>
                </div>
              </div>
            </div>
            <div ref="pieChartRef" class="pie-chart" />
          </div>
        </div>

        <!-- 成品阶段详细信息 -->
        <div class="product-detail-section">
          <h4>二、成品阶段详细信息</h4>
          <div class="product-detail-grid">
            <div class="detail-box">
              <div class="label">广告花费</div>
              <div class="value">
                ¥{{ ratioData.stages.product_stage.spend.toFixed(2) }}
              </div>
            </div>
            <div class="detail-box">
              <div class="label">销售额</div>
              <div class="value">
                ¥{{ ratioData.stages.product_stage.sales_amount.toFixed(2) }}
              </div>
            </div>
            <div class="detail-box">
              <div class="label">ROI</div>
              <div class="value roi-value">
                {{ ratioData.stages.product_stage.roi.toFixed(2) }}
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

.shop-selector {
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-start;
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
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.stat-box {
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
}

.stat-box.testing {
  border-left: 4px solid #409eff;
}
.stat-box.potential {
  border-left: 4px solid #e6a23c;
}
.stat-box.product {
  border-left: 4px solid #67c23a;
}
.stat-box.abandoned {
  border-left: 4px solid #f56c6c;
}
.stat-box.no-stage {
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

.product-detail-section {
  margin-top: 24px;
}

.product-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 16px;
}

.detail-box {
  background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e4e7ed;
  text-align: center;
}

.detail-box .label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 12px;
  font-weight: 500;
}

.detail-box .value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.detail-box .roi-value {
  color: #67c23a;
  font-size: 28px;
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

  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .product-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
