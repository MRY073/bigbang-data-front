<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { ElMessage, ElLoading, ElDialog, ElIcon } from "element-plus";
import { Picture } from "@element-plus/icons-vue";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

defineOptions({ name: "AdAnalysis" });

// 类型定义
type StageSpend = {
  product: number; // 成品阶段
  testing: number; // 测款阶段
  potential: number; // 潜力阶段
  abandoned: number; // 放弃阶段
  other: number; // 其他阶段
};

type DailyData = {
  date: string;
  stages: StageSpend;
  productRoi: number; // 成品阶段 ROI
};

type TrendData = {
  dates: string[];
  spendData: StageSpend[];
  roiData: number[]; // 成品阶段 ROI 序列
};

// 商品信息类型
type ProductItem = {
  productId: string; // 商品ID
  title: string; // 商品标题
  mainImage: string; // 主图URL
  adSpend: number; // 广告花费
  adSales: number; // 广告销售额
  roi: number; // ROI
};

// 阶段类型映射
type StageKey = "product" | "testing" | "potential" | "abandoned" | "other";

// 状态
const selectedDate = ref<string>(new Date().toISOString().split("T")[0]);
const selectedShop = ref<string>("1489850435"); // 默认选择第一个店铺
const dailyData = ref<DailyData | null>(null);
const trendData = ref<TrendData | null>(null);
const loading = ref(false);

// 商品列表弹窗状态
const dialogVisible = ref(false);
const dialogTitle = ref("");
const productList = ref<ProductItem[]>([]);
const productListLoading = ref(false);
const currentStage = ref<StageKey | null>(null);

// 店铺选项（与其他页面保持一致）
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

// 图表实例
const spendChart = ref<echarts.ECharts>();
const roiChart = ref<echarts.ECharts>();
const pieChart = ref<echarts.ECharts>();

// 图表容器引用
const spendChartRef = ref<HTMLElement>();
const roiChartRef = ref<HTMLElement>();
const pieChartRef = ref<HTMLElement>();

// 图表配色方案
const COLORS = {
  product: "#67C23A", // 成品阶段-绿色
  testing: "#409EFF", // 测款阶段-蓝色
  potential: "#E6A23C", // 潜力阶段-橙色
  abandoned: "#F56C6C", // 放弃阶段-红色
  other: "#909399" // 其他阶段-灰色
};

// API 端点
const API = {
  DAILY: "/api/ad-analysis/ad-ratio",
  TREND: "/api/ad-analysis/ad-trend",
  PRODUCTS: "/api/ad-analysis/stage-products" // 获取阶段商品列表
};

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

/**
 * 初始化堆叠柱状图（广告消耗结构趋势）
 */
function initSpendChart(container: HTMLElement) {
  spendChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      show: true,
      formatter: (params: any) => {
        if (!params || params.length === 0) return "";
        let result = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].axisValue}</div>`;
        let total = 0;
        params.forEach((item: any) => {
          const value = item.value || 0;
          result += `<div style="margin: 2px 0;">${item.marker}<span style="margin-right: 8px;">${item.seriesName}:</span><span style="font-weight: 600;">฿${value.toFixed(2)}</span></div>`;
          total += value;
        });
        result += `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #eee;"><span style="font-weight: 600;">总计: ฿${total.toFixed(2)}</span></div>`;
        return result;
      }
    },
    legend: {
      data: ["成品阶段", "测款阶段", "潜力阶段", "放弃阶段", "其他阶段"],
      top: 10
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: [],
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: "value",
      name: "广告消耗（泰铢）",
      axisLabel: {
        formatter: (value: number) => `฿${value.toFixed(0)}`
      }
    },
    series: [
      {
        name: "成品阶段",
        type: "bar",
        stack: "total",
        color: COLORS.product,
        data: []
      },
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
        name: "放弃阶段",
        type: "bar",
        stack: "total",
        color: COLORS.abandoned,
        data: []
      },
      {
        name: "其他阶段",
        type: "bar",
        stack: "total",
        color: COLORS.other,
        data: []
      }
    ]
  };
  spendChart.value.setOption(option);
}

/**
 * 初始化饼状图（各阶段消耗占比）
 */
function initPieChart(container: HTMLElement) {
  if (
    !container ||
    container.offsetWidth === 0 ||
    container.offsetHeight === 0
  ) {
    console.warn("饼图容器尺寸为0，无法初始化");
    return;
  }

  // 如果已经初始化，先销毁
  if (pieChart.value) {
    pieChart.value.dispose();
  }

  pieChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: any) => {
        const total = params.data?.total || 0;
        const percentage =
          total > 0 ? ((params.value / total) * 100).toFixed(1) : "0.0";
        return `${params.name}<br/>${params.marker}${params.seriesName}: ฿${params.value.toFixed(2)}<br/>占比: ${percentage}%`;
      }
    },
    legend: {
      orient: "vertical",
      left: "left",
      top: "middle",
      data: ["成品阶段", "测款阶段", "潜力阶段", "放弃阶段", "其他阶段"]
    },
    series: [
      {
        name: "各阶段消耗",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["60%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 1
        },
        label: {
          show: true,
          formatter: (params: any) => {
            const total = params.data?.total || 0;
            const percentage =
              total > 0 ? ((params.value / total) * 100).toFixed(1) : "0.0";
            return `${params.name}\n${percentage}%`;
          }
        },
        data: []
      }
    ]
  };
  pieChart.value.setOption(option);
}

/**
 * 初始化折线图（成品阶段 ROI 趋势）
 */
function initRoiChart(container: HTMLElement) {
  roiChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      show: true,
      formatter: (params: any) => {
        if (!params || params.length === 0) return "";
        const param = params[0];
        const value = param.value || 0;
        return `<div style="font-weight: 600; margin-bottom: 4px;">${param.axisValue}</div><div style="margin: 2px 0;">${param.marker}<span style="margin-right: 8px;">${param.seriesName}:</span><span style="font-weight: 600;">${value.toFixed(2)}</span></div>`;
      }
    },
    legend: {
      data: ["成品阶段 ROI"],
      top: 10
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "15%",
      containLabel: true
    },
    xAxis: {
      type: "category",
      data: [],
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: "value",
      name: "ROI",
      axisLabel: {
        formatter: (value: number) => value.toFixed(2)
      }
    },
    series: [
      {
        name: "成品阶段 ROI",
        type: "line",
        smooth: true,
        color: COLORS.product,
        data: [],
        markPoint: {
          data: [
            { type: "max", name: "最大值" },
            { type: "min", name: "最小值" }
          ]
        },
        markLine: {
          data: [{ type: "average", name: "平均值" }]
        }
      }
    ]
  };
  roiChart.value.setOption(option);
}

/**
 * 获取指定日期的数据
 */
async function fetchDailyData() {
  if (!selectedDate.value) {
    ElMessage.warning("请选择日期");
    return;
  }

  if (!selectedShop.value) {
    ElMessage.warning("请选择店铺");
    return;
  }

  loading.value = true;
  const loader = ElLoading.service({ text: "加载数据..." });

  try {
    const url = new URL(API.DAILY, window.location.origin);
    url.searchParams.append("date", selectedDate.value);
    url.searchParams.append("shopID", selectedShop.value);
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (shopOption) {
      url.searchParams.append("shopName", shopOption.label);
    }
    const res = await fetch(url.toString());

    if (!res.ok) throw new Error("获取数据失败");
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || result.message || "查询失败");
    }

    // 转换数据格式
    const data = result.data;
    dailyData.value = {
      date: selectedDate.value,
      stages: {
        product: data.stages?.product_stage?.spend || 0,
        testing: data.stages?.testing_stage?.spend || 0,
        potential: data.stages?.potential_stage?.spend || 0,
        abandoned: data.stages?.abandoned_stage?.spend || 0,
        other: data.stages?.no_stage?.spend || 0
      },
      productRoi: data.stages?.product_stage?.roi || 0
    };

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取单日数据失败:", error);
    // 使用模拟数据
    dailyData.value = {
      date: selectedDate.value,
      stages: {
        product: 5678.9,
        testing: 2345.67,
        potential: 1800.5,
        abandoned: 450.2,
        other: 120.3
      },
      productRoi: 2.64
    };
    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/**
 * 获取趋势数据
 */
async function fetchTrendData() {
  if (!selectedShop.value) {
    ElMessage.warning("请选择店铺");
    return;
  }

  loading.value = true;
  const loader = ElLoading.service({ text: "加载趋势数据..." });

  try {
    const url = new URL(API.TREND, window.location.origin);
    url.searchParams.append("shopID", selectedShop.value);
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (shopOption) {
      url.searchParams.append("shopName", shopOption.label);
    }
    const res = await fetch(url.toString());

    if (!res.ok) throw new Error("获取趋势数据失败");
    const result = await res.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || result.message || "查询失败");
    }

    // 转换数据格式
    const data = result.data;
    const dates = data.map((item: any) => item.date);
    const spendData: StageSpend[] = data.map((item: any) => ({
      product: item.product_stage_spend || 0,
      testing: item.testing_stage_spend || 0,
      potential: item.potential_stage_spend || 0,
      abandoned: item.abandoned_stage_spend || 0,
      other: item.no_stage_spend || 0
    }));
    const roiData = data.map((item: any) => item.product_stage_roi || 0);

    trendData.value = { dates, spendData, roiData };

    // 更新堆叠柱状图
    spendChart.value?.setOption({
      xAxis: { data: dates },
      series: [
        { data: spendData.map(d => d.product) },
        { data: spendData.map(d => d.testing) },
        { data: spendData.map(d => d.potential) },
        { data: spendData.map(d => d.abandoned) },
        { data: spendData.map(d => d.other) }
      ]
    });

    // 更新折线图
    roiChart.value?.setOption({
      xAxis: { data: dates },
      series: [{ data: roiData }]
    });

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取趋势数据失败:", error);
    // 使用模拟数据
    const mockDates: string[] = [];
    const mockSpendData: StageSpend[] = [];
    const mockRoiData: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      mockDates.push(date.toISOString().split("T")[0]);

      mockSpendData.push({
        product: Math.random() * 5000 + 3000,
        testing: Math.random() * 2000 + 1000,
        potential: Math.random() * 1500 + 800,
        abandoned: Math.random() * 500 + 200,
        other: Math.random() * 300 + 100
      });

      mockRoiData.push(Math.random() * 2 + 1.5);
    }

    trendData.value = {
      dates: mockDates,
      spendData: mockSpendData,
      roiData: mockRoiData
    };

    // 更新堆叠柱状图
    spendChart.value?.setOption({
      xAxis: { data: mockDates },
      series: [
        { data: mockSpendData.map(d => d.product) },
        { data: mockSpendData.map(d => d.testing) },
        { data: mockSpendData.map(d => d.potential) },
        { data: mockSpendData.map(d => d.abandoned) },
        { data: mockSpendData.map(d => d.other) }
      ]
    });

    // 更新折线图
    roiChart.value?.setOption({
      xAxis: { data: mockDates },
      series: [{ data: mockRoiData }]
    });

    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/**
 * 更新饼状图数据
 */
function updatePieChart() {
  if (!dailyData.value) return;

  // 等待 DOM 渲染完成
  nextTick(() => {
    if (!pieChartRef.value) {
      console.warn("饼图容器引用不存在");
      return;
    }

    // 检查容器尺寸
    const container = pieChartRef.value;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn("饼图容器尺寸为0，等待渲染");
      setTimeout(() => updatePieChart(), 100);
      return;
    }

    // 如果图表还没初始化，先初始化
    if (!pieChart.value) {
      initPieChart(container);
    }

    if (!pieChart.value) {
      console.warn("饼图初始化失败");
      return;
    }

    const stages = dailyData.value!.stages;
    const total = totalSpend.value;

    const pieData = [
      {
        value: stages.product,
        name: "成品阶段",
        itemStyle: { color: COLORS.product },
        total
      },
      {
        value: stages.testing,
        name: "测款阶段",
        itemStyle: { color: COLORS.testing },
        total
      },
      {
        value: stages.potential,
        name: "潜力阶段",
        itemStyle: { color: COLORS.potential },
        total
      },
      {
        value: stages.abandoned,
        name: "放弃阶段",
        itemStyle: { color: COLORS.abandoned },
        total
      },
      {
        value: stages.other,
        name: "其他阶段",
        itemStyle: { color: COLORS.other },
        total
      }
    ];

    pieChart.value.setOption({
      series: [{ data: pieData }]
    });

    // 确保图表大小正确
    setTimeout(() => {
      pieChart.value?.resize();
    }, 100);
  });
}

/**
 * 计算各阶段占比
 */
function getStagePercentage(stage: keyof StageSpend, total: number): number {
  if (!dailyData.value || total === 0) return 0;
  return (dailyData.value.stages[stage] / total) * 100;
}

/**
 * 计算总消耗
 */
const totalSpend = computed(() => {
  if (!dailyData.value) return 0;
  const stages = dailyData.value.stages;
  return (
    stages.product +
    stages.testing +
    stages.potential +
    stages.abandoned +
    stages.other
  );
});

// 监听图表容器大小变化
function handleResize() {
  spendChart.value?.resize();
  roiChart.value?.resize();
  pieChart.value?.resize();
}

/**
 * 执行搜索（点击搜索按钮时调用）
 */
async function handleSearch() {
  await Promise.all([fetchDailyData(), fetchTrendData()]);
}

/**
 * 获取指定阶段的商品列表
 */
async function fetchStageProducts(stage: StageKey) {
  if (!selectedDate.value) {
    ElMessage.warning("请先选择日期");
    return;
  }

  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  currentStage.value = stage;
  dialogTitle.value = `${STAGE_NAMES[stage]} - 商品细则`;
  dialogVisible.value = true;
  productListLoading.value = true;
  productList.value = [];

  try {
    const url = new URL(API.PRODUCTS, window.location.origin);
    url.searchParams.append("date", selectedDate.value);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("stage", STAGE_FIELD_MAP[stage]);

    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (shopOption) {
      url.searchParams.append("shopName", shopOption.label);
    }

    const res = await fetch(url.toString());

    if (!res.ok) throw new Error("获取商品列表失败");
    const result = await res.json();

    if (!result.success) {
      throw new Error(result.error || result.message || "查询失败");
    }

    // 转换数据格式
    if (result.data && Array.isArray(result.data)) {
      productList.value = result.data.map((item: any) => ({
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

    if (productList.value.length === 0) {
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
    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    productListLoading.value = false;
  }
}

/**
 * 关闭商品列表弹窗
 */
function closeProductDialog() {
  dialogVisible.value = false;
  productList.value = [];
  currentStage.value = null;
}

// 监听 dailyData 变化，自动更新饼图
watch(
  () => dailyData.value,
  () => {
    if (dailyData.value) {
      // 等待 DOM 渲染完成（因为饼图容器在 v-if 中）
      nextTick(() => {
        // 再次等待，确保容器已完全渲染
        setTimeout(() => {
          updatePieChart();
        }, 50);
      });
    }
  },
  { deep: true }
);

onMounted(() => {
  window.addEventListener("resize", handleResize);
  // 初始化图表容器（使用 nextTick 确保 DOM 已渲染）
  nextTick(() => {
    if (spendChartRef.value) {
      initSpendChart(spendChartRef.value);
    }
    if (roiChartRef.value) {
      initRoiChart(roiChartRef.value);
    }
    // 饼图在有数据时再初始化
    if (pieChartRef.value && dailyData.value) {
      initPieChart(pieChartRef.value);
      updatePieChart();
    }
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  spendChart.value?.dispose();
  roiChart.value?.dispose();
  pieChart.value?.dispose();
});
</script>

<template>
  <div class="ad-analysis-page">
    <!-- 顶部：日期选择器 + 各阶段占比 + 成品阶段 ROI 总览 -->
    <el-card class="overview-card">
      <div class="overview-header">
        <div class="search-controls">
          <el-select
            v-model="selectedShop"
            placeholder="选择店铺"
            style="width: 200px; margin-right: 12px"
            :disabled="loading"
            size="large"
          >
            <el-option
              v-for="item in shopOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            :disabled="loading"
            value-format="YYYY-MM-DD"
            size="large"
            style="margin-right: 12px"
          />
          <el-button
            type="primary"
            :loading="loading"
            size="large"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </div>

        <div v-if="dailyData" class="overview-content">
          <!-- 各阶段占比 -->
          <div class="stages-overview">
            <div class="section-title">各阶段消耗占比</div>
            <div class="stages-content">
              <div class="stages-grid">
                <div
                  v-for="(stage, key) in {
                    product: '成品阶段',
                    testing: '测款阶段',
                    potential: '潜力阶段',
                    abandoned: '放弃阶段',
                    other: '其他阶段'
                  }"
                  :key="key"
                  class="stage-card-wrapper"
                >
                  <div class="stage-card" :class="key">
                    <div class="stage-label">{{ stage }}</div>
                    <div class="stage-value">
                      ฿{{
                        dailyData.stages[key as keyof StageSpend].toFixed(2)
                      }}
                    </div>
                    <div class="stage-percentage">
                      {{
                        getStagePercentage(
                          key as keyof StageSpend,
                          totalSpend
                        ).toFixed(1)
                      }}%
                    </div>
                  </div>
                  <el-button
                    type="primary"
                    size="small"
                    class="stage-detail-btn"
                    :loading="productListLoading && currentStage === key"
                    @click="fetchStageProducts(key as StageKey)"
                  >
                    查看相应商品细则
                  </el-button>
                </div>
              </div>
              <div class="pie-chart-container">
                <div ref="pieChartRef" class="pie-chart" />
              </div>
            </div>
          </div>

          <!-- 成品阶段 ROI 总览 -->
          <div class="roi-overview">
            <div class="section-title">成品阶段 ROI</div>
            <div class="roi-card">
              <div class="roi-value">{{ dailyData.productRoi.toFixed(2) }}</div>
              <div class="roi-label">投资回报率</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 中部：堆叠柱状图（广告消耗结构趋势） -->
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">广告消耗结构趋势</span>
        </div>
      </template>
      <div ref="spendChartRef" class="chart-container" />
    </el-card>

    <!-- 底部：折线图（成品阶段 ROI 趋势） -->
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">成品阶段 ROI 趋势</span>
        </div>
      </template>
      <div ref="roiChartRef" class="chart-container" />
    </el-card>

    <!-- 商品列表弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="80%"
      :close-on-click-modal="false"
      @close="closeProductDialog"
    >
      <div v-loading="productListLoading" class="product-list-container">
        <el-table
          :data="productList"
          stripe
          style="width: 100%"
          empty-text="暂无商品数据"
        >
          <el-table-column prop="productId" label="商品ID" width="150" />
          <el-table-column label="主图" width="100">
            <template #default="{ row }">
              <el-image
                :src="row.mainImage"
                :preview-src-list="[row.mainImage]"
                fit="cover"
                style="width: 80px; height: 80px; border-radius: 4px"
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
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column label="广告花费" width="120" align="right">
            <template #default="{ row }">
              ฿{{ row.adSpend.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="广告销售额" width="120" align="right">
            <template #default="{ row }">
              ฿{{ row.adSales.toFixed(2) }}
            </template>
          </el-table-column>
          <el-table-column label="ROI" width="100" align="right">
            <template #default="{ row }">
              <span
                :class="{ 'roi-high': row.roi >= 2, 'roi-low': row.roi < 1 }"
              >
                {{ row.roi.toFixed(2) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeProductDialog">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ad-analysis-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: calc(100vh - 80px);
}

.overview-card {
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid #e4e7ed;
}

.overview-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.search-controls {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.overview-content {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}

.stages-overview {
  flex: 1;
}

.stages-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.pie-chart-container {
  flex-shrink: 0;
  width: 400px;
}

.pie-chart {
  height: 300px;
  width: 100%;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.stages-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.stage-card-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-card {
  padding: 16px;
  border: 1px solid #e4e7ed;
  background: #fff;
  border-left: 3px solid;
}

.stage-card.product {
  border-left-color: #67c23a;
}

.stage-card.testing {
  border-left-color: #409eff;
}

.stage-card.potential {
  border-left-color: #e6a23c;
}

.stage-card.abandoned {
  border-left-color: #f56c6c;
}

.stage-card.other {
  border-left-color: #909399;
}

.stage-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.stage-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.stage-percentage {
  font-size: 12px;
  color: #909399;
}

.stage-detail-btn {
  width: 100%;
  margin-top: 8px;
}

.product-list-container {
  min-height: 300px;
  max-height: 600px;
  overflow-y: auto;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
}

.roi-high {
  color: #67c23a;
  font-weight: 600;
}

.roi-low {
  color: #f56c6c;
  font-weight: 600;
}

.roi-overview {
  min-width: 200px;
}

.roi-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  padding: 24px;
  text-align: center;
}

.roi-value {
  font-size: 36px;
  font-weight: 600;
  color: #67c23a;
  margin-bottom: 8px;
  line-height: 1;
}

.roi-label {
  font-size: 14px;
  color: #909399;
}

.chart-card {
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid #e4e7ed;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  height: 400px;
  width: 100%;
}

@media (max-width: 1400px) {
  .overview-content {
    flex-direction: column;
  }

  .roi-overview {
    width: 100%;
  }

  .roi-card {
    max-width: 300px;
  }

  .stages-content {
    flex-direction: column;
  }

  .pie-chart-container {
    width: 100%;
  }

  .pie-chart {
    height: 400px;
  }
}

@media (max-width: 1200px) {
  .stages-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stages-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-container {
    height: 300px;
  }
}
</style>
