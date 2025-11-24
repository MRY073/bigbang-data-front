<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { getAdRatio, getAdTrend } from "@/api/adAnalysis";
import { shopOptions, DEFAULT_SHOP_ID, getShopOption } from "@/constants/shops";
import { getCustomCategoryOptions } from "@/api/productItems";
import ProductListDialog from "./ProductListDialog.vue";

defineOptions({ name: "AdAnalysis" });

// 类型定义
type StageSpend = {
  product: number; // 成品阶段
  testing: number; // 测款阶段
  potential: number; // 潜力阶段
  abandoned: number; // 放弃阶段
  other: number; // 其他阶段
};

type StageSales = {
  product: number; // 成品阶段
  testing: number; // 测款阶段
  potential: number; // 潜力阶段
  abandoned: number; // 放弃阶段
  other: number; // 其他阶段
};

type StageRoi = {
  product: number; // 成品阶段 ROI
  testing: number; // 测款阶段 ROI
  potential: number; // 潜力阶段 ROI
  abandoned: number; // 放弃阶段 ROI
  other: number; // 其他阶段 ROI
};

type RangeData = {
  startDate: string;
  endDate: string;
  stages: StageSpend;
  sales: StageSales;
  roi: StageRoi;
};

type TrendData = {
  dates: string[];
  spendData: StageSpend[];
  salesData: StageSales[];
  roiData: StageRoi[];
};

// 阶段类型映射
type StageKey = "product" | "testing" | "potential" | "abandoned" | "other";

// 状态
const today = new Date().toISOString().split("T")[0];
const dateRange = ref<[string, string]>([today, today]);
const selectedShop = ref<string>(DEFAULT_SHOP_ID); // 默认选择第一个店铺
const rangeData = ref<RangeData | null>(null);
const trendData = ref<TrendData | null>(null);
const loading = ref(false);

// 自定义分类相关
const customCategoryOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedCustomCategory = ref<string>("");
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

// 商品列表弹窗状态
const dialogVisible = ref(false);
const currentStage = ref<StageKey | null>(null);

// 店铺选项从共享常量导入

// 图表实例
const spendChart = ref<echarts.ECharts>();
const roiChart = ref<echarts.ECharts>();
const pieChart = ref<echarts.ECharts>();
const salesPieChart = ref<echarts.ECharts>();

// 图表容器引用
const spendChartRef = ref<HTMLElement>();
const roiChartRef = ref<HTMLElement>();
const pieChartRef = ref<HTMLElement>();
const salesPieChartRef = ref<HTMLElement>();

// 图表配色方案
const COLORS = {
  product: "#2DE2E6", // 成品阶段-薄荷青
  testing: "#6C63FF", // 测款阶段-绛紫
  potential: "#FF9B6A", // 潜力阶段-珊瑚橙
  abandoned: "#FF6F91", // 放弃阶段-樱桃粉
  other: "#FFD33D" // 其他阶段-明黄
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
          fontSize: 14,
          fontWeight: 600,
          color: "#1f1235",
          formatter: (params: any) => {
            const total = params.data?.total || 0;
            const percentage =
              total > 0 ? ((params.value / total) * 100).toFixed(1) : "0.0";
            return `${params.name}\n${percentage}%`;
          }
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            width: 2
          }
        },
        data: []
      }
    ]
  };
  pieChart.value.setOption(option);
}

/**
 * 初始化折线图（各阶段 ROI 趋势）
 */
function initRoiChart(container: HTMLElement) {
  roiChart.value = echarts.init(container);
  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      show: true,
      formatter: (params: any) => {
        if (!params || params.length === 0) return "";
        let result = `<div style="font-weight: 600; margin-bottom: 4px;">${params[0].axisValue}</div>`;
        params.forEach((item: any) => {
          const value = item.value || 0;
          result += `<div style="margin: 2px 0;">${item.marker}<span style="margin-right: 8px;">${item.seriesName}:</span><span style="font-weight: 600;">${value.toFixed(2)}</span></div>`;
        });
        return result;
      }
    },
    legend: {
      data: [
        "成品阶段 ROI",
        "测款阶段 ROI",
        "潜力阶段 ROI",
        "放弃阶段 ROI",
        "其他阶段 ROI"
      ],
      top: 10
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "20%",
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
        data: []
      },
      {
        name: "测款阶段 ROI",
        type: "line",
        smooth: true,
        color: COLORS.testing,
        data: []
      },
      {
        name: "潜力阶段 ROI",
        type: "line",
        smooth: true,
        color: COLORS.potential,
        data: []
      },
      {
        name: "放弃阶段 ROI",
        type: "line",
        smooth: true,
        color: COLORS.abandoned,
        data: []
      },
      {
        name: "其他阶段 ROI",
        type: "line",
        smooth: true,
        color: COLORS.other,
        data: []
      }
    ]
  };
  roiChart.value.setOption(option);
}

/**
 * 获取指定时间段的数据
 */
async function fetchRangeData() {
  if (
    !dateRange.value ||
    dateRange.value.length !== 2 ||
    !dateRange.value[0] ||
    !dateRange.value[1]
  ) {
    ElMessage.warning("请选择时间段");
    return;
  }

  if (!selectedShop.value) {
    ElMessage.warning("请选择店铺");
    return;
  }

  loading.value = true;
  const loader = ElLoading.service({ text: "加载数据..." });

  try {
    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const params: any = {
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      shopID: selectedShop.value,
      shopName: shopOption.label
    };

    // 如果选择了自定义分类，添加到请求参数中
    if (selectedCustomCategory.value) {
      params.customCategory = selectedCustomCategory.value;
    }

    const result = await getAdRatio(params);

    if (!result.success || !result.data) {
      throw new Error(result.error || result.message || "查询失败");
    }

    // 转换数据格式
    const data = result.data;
    rangeData.value = {
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      stages: {
        product: data.stages?.product_stage?.spend || 0,
        testing: data.stages?.testing_stage?.spend || 0,
        potential: data.stages?.potential_stage?.spend || 0,
        abandoned: data.stages?.abandoned_stage?.spend || 0,
        other: data.stages?.no_stage?.spend || 0
      },
      sales: {
        product: data.stages?.product_stage?.sales || 0,
        testing: data.stages?.testing_stage?.sales || 0,
        potential: data.stages?.potential_stage?.sales || 0,
        abandoned: data.stages?.abandoned_stage?.sales || 0,
        other: data.stages?.no_stage?.sales || 0
      },
      roi: {
        product: data.stages?.product_stage?.roi || 0,
        testing: data.stages?.testing_stage?.roi || 0,
        potential: data.stages?.potential_stage?.roi || 0,
        abandoned: data.stages?.abandoned_stage?.roi || 0,
        other: data.stages?.no_stage?.roi || 0
      }
    };

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取时间段数据失败:", error);
    // 使用模拟数据
    rangeData.value = {
      startDate: dateRange.value[0],
      endDate: dateRange.value[1],
      stages: {
        product: 5678.9,
        testing: 2345.67,
        potential: 1800.5,
        abandoned: 450.2,
        other: 120.3
      },
      sales: {
        product: 15000.0,
        testing: 6000.0,
        potential: 3500.0,
        abandoned: 800.0,
        other: 200.0
      },
      roi: {
        product: 2.64,
        testing: 2.56,
        potential: 1.94,
        abandoned: 1.78,
        other: 1.67
      }
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
    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const params: any = {
      shopID: selectedShop.value,
      shopName: shopOption.label
    };

    // 如果选择了自定义分类，添加到请求参数中
    if (selectedCustomCategory.value) {
      params.customCategory = selectedCustomCategory.value;
    }

    const result = await getAdTrend(params);

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
    const salesData: StageSales[] = data.map((item: any) => ({
      product: item.product_stage_sales || 0,
      testing: item.testing_stage_sales || 0,
      potential: item.potential_stage_sales || 0,
      abandoned: item.abandoned_stage_sales || 0,
      other: item.no_stage_sales || 0
    }));
    const roiData: StageRoi[] = data.map((item: any) => ({
      product: item.product_stage_roi || 0,
      testing: item.testing_stage_roi || 0,
      potential: item.potential_stage_roi || 0,
      abandoned: item.abandoned_stage_roi || 0,
      other: item.no_stage_roi || 0
    }));

    trendData.value = { dates, spendData, salesData, roiData };

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
      series: [
        { name: "成品阶段 ROI", data: roiData.map(d => d.product) },
        { name: "测款阶段 ROI", data: roiData.map(d => d.testing) },
        { name: "潜力阶段 ROI", data: roiData.map(d => d.potential) },
        { name: "放弃阶段 ROI", data: roiData.map(d => d.abandoned) },
        { name: "其他阶段 ROI", data: roiData.map(d => d.other) }
      ]
    });

    ElMessage.success(result.message || "查询成功");
  } catch (error: any) {
    console.error("拉取趋势数据失败:", error);
    // 使用模拟数据
    const mockDates: string[] = [];
    const mockSpendData: StageSpend[] = [];
    const mockSalesData: StageSales[] = [];
    const mockRoiData: StageRoi[] = [];

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

      mockSalesData.push({
        product: Math.random() * 12000 + 8000,
        testing: Math.random() * 5000 + 3000,
        potential: Math.random() * 3000 + 1500,
        abandoned: Math.random() * 1000 + 400,
        other: Math.random() * 500 + 200
      });

      mockRoiData.push({
        product: Math.random() * 2 + 1.5,
        testing: Math.random() * 2 + 1.3,
        potential: Math.random() * 2 + 1.0,
        abandoned: Math.random() * 1.5 + 0.8,
        other: Math.random() * 1.5 + 0.6
      });
    }

    trendData.value = {
      dates: mockDates,
      spendData: mockSpendData,
      salesData: mockSalesData,
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
      series: [
        { name: "成品阶段 ROI", data: mockRoiData.map(d => d.product) },
        { name: "测款阶段 ROI", data: mockRoiData.map(d => d.testing) },
        { name: "潜力阶段 ROI", data: mockRoiData.map(d => d.potential) },
        { name: "放弃阶段 ROI", data: mockRoiData.map(d => d.abandoned) },
        { name: "其他阶段 ROI", data: mockRoiData.map(d => d.other) }
      ]
    });

    ElMessage.info("使用模拟数据展示（后端接口未就绪）");
  } finally {
    loader.close();
    loading.value = false;
  }
}

/**
 * 规范化分类数据
 */
function normalizeCategoryPayload(payload: any[]): string[] {
  if (!Array.isArray(payload)) return [];
  const result: string[] = [];
  payload.forEach(item => {
    if (typeof item === "string" && item.trim()) {
      result.push(item.trim());
    } else if (item && typeof item === "object") {
      categoryFields.forEach(field => {
        const value = item[field];
        if (value && typeof value === "string" && value.trim()) {
          result.push(value.trim());
        }
      });
    }
  });
  return [...new Set(result)];
}

/**
 * 追加自定义分类选项
 */
function appendCustomCategoryOptions(values: string[]) {
  const existing = new Set(customCategoryOptions.value.map(opt => opt.value));
  values.forEach(value => {
    const trimmed = value.trim();
    if (trimmed && !existing.has(trimmed)) {
      customCategoryOptions.value.push({ label: trimmed, value: trimmed });
      existing.add(trimmed);
    }
  });
  customCategoryOptions.value.sort((a, b) =>
    a.label.localeCompare(b.label, "zh-CN")
  );
}

/**
 * 获取自定义分类选项
 */
async function fetchCustomCategoryOptions() {
  if (!selectedShop.value) return;
  try {
    const result = await getCustomCategoryOptions({
      shopID: selectedShop.value
    });
    if (result.success && result.data) {
      appendCustomCategoryOptions(normalizeCategoryPayload(result.data));
    }
  } catch (error) {
    console.error("获取自定义分类选项失败:", error);
  }
}

/**
 * 初始化销售额饼状图（各阶段销售额占比）
 */
function initSalesPieChart(container: HTMLElement) {
  if (
    !container ||
    container.offsetWidth === 0 ||
    container.offsetHeight === 0
  ) {
    console.warn("销售额饼图容器尺寸为0，无法初始化");
    return;
  }

  // 如果已经初始化，先销毁
  if (salesPieChart.value) {
    salesPieChart.value.dispose();
  }

  salesPieChart.value = echarts.init(container);
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
        name: "各阶段销售额",
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
          fontSize: 14,
          fontWeight: 600,
          color: "#1f1235",
          formatter: (params: any) => {
            const total = params.data?.total || 0;
            const percentage =
              total > 0 ? ((params.value / total) * 100).toFixed(1) : "0.0";
            return `${params.name}\n${percentage}%`;
          }
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            width: 2
          }
        },
        data: []
      }
    ]
  };
  salesPieChart.value.setOption(option);
}

/**
 * 更新销售额饼状图数据
 */
function updateSalesPieChart() {
  if (!rangeData.value) return;

  // 等待 DOM 渲染完成
  nextTick(() => {
    if (!salesPieChartRef.value) {
      console.warn("销售额饼图容器引用不存在");
      return;
    }

    // 检查容器尺寸
    const container = salesPieChartRef.value;
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
      console.warn("销售额饼图容器尺寸为0，等待渲染");
      setTimeout(() => updateSalesPieChart(), 100);
      return;
    }

    // 如果图表还没初始化，先初始化
    if (!salesPieChart.value) {
      initSalesPieChart(container);
    }

    if (!salesPieChart.value) {
      console.warn("销售额饼图初始化失败");
      return;
    }

    const sales = rangeData.value!.sales;
    const total = totalSales.value;

    const pieData = [
      {
        value: sales.product,
        name: "成品阶段",
        itemStyle: { color: COLORS.product },
        total
      },
      {
        value: sales.testing,
        name: "测款阶段",
        itemStyle: { color: COLORS.testing },
        total
      },
      {
        value: sales.potential,
        name: "潜力阶段",
        itemStyle: { color: COLORS.potential },
        total
      },
      {
        value: sales.abandoned,
        name: "放弃阶段",
        itemStyle: { color: COLORS.abandoned },
        total
      },
      {
        value: sales.other,
        name: "其他阶段",
        itemStyle: { color: COLORS.other },
        total
      }
    ];

    salesPieChart.value.setOption({
      series: [{ data: pieData }]
    });

    // 确保图表大小正确
    setTimeout(() => {
      salesPieChart.value?.resize();
    }, 100);
  });
}

/**
 * 更新饼状图数据
 */
function updatePieChart() {
  if (!rangeData.value) return;

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

    const stages = rangeData.value!.stages;
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
 * 计算各阶段占比（消耗）
 */
function getStagePercentage(stage: keyof StageSpend, total: number): number {
  if (!rangeData.value || total === 0) return 0;
  return (rangeData.value.stages[stage] / total) * 100;
}

/**
 * 计算各阶段占比（销售额）
 */
function getSalesPercentage(stage: keyof StageSales, total: number): number {
  if (!rangeData.value || total === 0) return 0;
  return (rangeData.value.sales[stage] / total) * 100;
}

/**
 * 计算总消耗
 */
const totalSpend = computed(() => {
  if (!rangeData.value) return 0;
  const stages = rangeData.value.stages;
  return (
    stages.product +
    stages.testing +
    stages.potential +
    stages.abandoned +
    stages.other
  );
});

/**
 * 计算总销售额
 */
const totalSales = computed(() => {
  if (!rangeData.value) return 0;
  const sales = rangeData.value.sales;
  return (
    sales.product +
    sales.testing +
    sales.potential +
    sales.abandoned +
    sales.other
  );
});

// 监听图表容器大小变化
function handleResize() {
  spendChart.value?.resize();
  roiChart.value?.resize();
  pieChart.value?.resize();
  salesPieChart.value?.resize();
}

/**
 * 执行搜索（点击搜索按钮时调用）
 */
async function handleSearch() {
  await Promise.all([fetchRangeData(), fetchTrendData()]);
}

/**
 * 打开指定阶段的商品列表弹窗
 */
function fetchStageProducts(stage: StageKey) {
  if (
    !dateRange.value ||
    dateRange.value.length !== 2 ||
    !dateRange.value[0] ||
    !dateRange.value[1]
  ) {
    ElMessage.warning("请先选择时间段");
    return;
  }

  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  currentStage.value = stage;
  dialogVisible.value = true;
}

// 监听 rangeData 变化，自动更新饼图
watch(
  () => rangeData.value,
  () => {
    if (rangeData.value) {
      // 等待 DOM 渲染完成（因为饼图容器在 v-if 中）
      nextTick(() => {
        // 再次等待，确保容器已完全渲染
        setTimeout(() => {
          updatePieChart();
          updateSalesPieChart();
        }, 50);
      });
    }
  },
  { deep: true }
);

// 监听店铺变化，更新自定义分类选项
watch(
  () => selectedShop.value,
  () => {
    if (selectedShop.value) {
      selectedCustomCategory.value = "";
      fetchCustomCategoryOptions();
    }
  }
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
    if (pieChartRef.value && rangeData.value) {
      initPieChart(pieChartRef.value);
      updatePieChart();
    }
    if (salesPieChartRef.value && rangeData.value) {
      initSalesPieChart(salesPieChartRef.value);
      updateSalesPieChart();
    }
  });
  // 初始化时获取自定义分类选项
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  spendChart.value?.dispose();
  roiChart.value?.dispose();
  pieChart.value?.dispose();
  salesPieChart.value?.dispose();
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
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :disabled="loading"
            value-format="YYYY-MM-DD"
            size="large"
            style="width: 120px; margin-right: 12px"
          />
          <el-select
            v-model="selectedCustomCategory"
            placeholder="自定义分类"
            filterable
            clearable
            style="width: 200px; margin-right: 12px"
            :disabled="loading"
            size="large"
          >
            <el-option
              v-for="option in customCategoryOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-button
            type="primary"
            :loading="loading"
            size="large"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </div>

        <div v-if="rangeData" class="overview-content">
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
                        rangeData.stages[key as keyof StageSpend].toFixed(2)
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

            <!-- 各阶段销售额占比 -->
            <div class="section-title" style="margin-top: 32px">
              各阶段销售额占比
            </div>
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
                      ฿{{ rangeData.sales[key as keyof StageSales].toFixed(2) }}
                    </div>
                    <div class="stage-percentage">
                      {{
                        getSalesPercentage(
                          key as keyof StageSales,
                          totalSales
                        ).toFixed(1)
                      }}%
                    </div>
                  </div>
                </div>
              </div>
              <div class="pie-chart-container">
                <div ref="salesPieChartRef" class="pie-chart" />
              </div>
            </div>
          </div>

          <!-- 各阶段 ROI 总览 -->
          <div class="roi-overview">
            <div class="section-title">各阶段 ROI</div>
            <div class="roi-grid">
              <div
                v-for="(stage, key) in {
                  product: '成品阶段',
                  testing: '测款阶段',
                  potential: '潜力阶段',
                  abandoned: '放弃阶段',
                  other: '其他阶段'
                }"
                :key="key"
                class="roi-item"
              >
                <div class="roi-stage-label">{{ stage }}</div>
                <div class="roi-value-small">
                  {{ rangeData.roi[key as keyof StageRoi].toFixed(2) }}
                </div>
              </div>
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

    <!-- 底部：折线图（各阶段 ROI 趋势） -->
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">各阶段 ROI 趋势</span>
        </div>
      </template>
      <div ref="roiChartRef" class="chart-container" />
    </el-card>

    <!-- 商品列表弹窗 -->
    <ProductListDialog
      v-model:visible="dialogVisible"
      :stage="currentStage"
      :start-date="dateRange?.[0] || ''"
      :end-date="dateRange?.[1] || ''"
      :shop-i-d="selectedShop"
      :custom-category="selectedCustomCategory"
    />
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.ad-analysis-page {
  @include dopamine.dopamine-page();
  padding: 32px;
  min-height: calc(100vh - 80px);
  color: var(--dopamine-contrast);
}

.overview-card,
.chart-card {
  @include dopamine.dopamine-surface(24px);
  border: none;
  margin-bottom: 24px;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 26px 50px rgba(255, 110, 199, 0.28),
      0 12px 28px rgba(108, 99, 255, 0.2);
  }

  :deep(.el-card__body) {
    padding: 28px;
    background: transparent;
  }
}

.overview-header {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.search-controls {
  @include dopamine.dopamine-toolbar();
  justify-content: flex-start;
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(108, 99, 255, 0.2) 55%,
    rgba(255, 110, 199, 0.2) 100%
  );
}

.overview-content {
  display: flex;
  gap: 32px;
  align-items: stretch;
}

.stages-overview {
  flex: 1;
}

.stages-content {
  display: flex;
  gap: 28px;
  align-items: stretch;
}

.pie-chart-container {
  flex-shrink: 0;
  width: 400px;
  @include dopamine.dopamine-surface(20px);
  padding: 18px;
}

.pie-chart {
  height: 320px;
  width: 100%;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 18px;
  @include dopamine.dopamine-punchy-text();
}

.stages-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
}

.stage-card-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stage-card {
  padding: 18px;
  border-radius: 18px;
  color: var(--dopamine-contrast);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 24px rgba(31, 18, 53, 0.12);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease;

  &:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 18px 32px rgba(108, 99, 255, 0.32);
  }
}

.stage-card.product {
  @include dopamine.dopamine-chip(#2de2e6);
}

.stage-card.testing {
  @include dopamine.dopamine-chip(#6c63ff);
}

.stage-card.potential {
  @include dopamine.dopamine-chip(#ff9b6a);
}

.stage-card.abandoned {
  @include dopamine.dopamine-chip(#ff6f91);
}

.stage-card.other {
  @include dopamine.dopamine-chip(#ffd33d);
  color: #7a5610;
}

.stage-label {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: #1f1235;
}

.stage-value {
  font-size: 24px;
  font-weight: 700;
  margin: 8px 0;
  color: #1f1235;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stage-percentage {
  font-size: 16px;
  font-weight: 600;
  opacity: 1;
  color: #1f1235;
  margin-top: 4px;
}

.stage-detail-btn {
  width: 100%;
  @include dopamine.dopamine-ghost-button();
}

.roi-overview {
  min-width: 280px;
  @include dopamine.dopamine-surface(20px);
  padding: 24px;
}

.roi-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roi-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  transition:
    transform 0.2s ease,
    background 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.6);
  }
}

.roi-stage-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--dopamine-soft-ink);
  letter-spacing: 0.3px;
}

.roi-value-small {
  font-size: 24px;
  font-weight: 700;
  color: #1f1235;
  line-height: 1;
  letter-spacing: 0.5px;
}

.roi-value {
  font-size: 42px;
  font-weight: 700;
  color: #1f1235;
  line-height: 1;
  letter-spacing: 1px;
  text-shadow: 0 10px 24px rgba(31, 18, 53, 0.2);
}

.roi-label {
  font-size: 14px;
  color: var(--dopamine-soft-ink);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  @include dopamine.dopamine-card-header();
  border-radius: 20px 20px 0 0;
  margin: -28px -28px 24px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
}

.chart-container {
  height: 420px;
  width: 100%;
}

:deep(.el-button--primary) {
  @include dopamine.dopamine-primary-button();
}

:deep(.el-dialog__body) {
  background: rgba(255, 255, 255, 0.92);
  color: var(--dopamine-contrast);
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  background: linear-gradient(
    120deg,
    var(--dopamine-secondary) 0%,
    var(--dopamine-primary) 90%
  );
  box-shadow: 0 10px 18px rgba(108, 99, 255, 0.25);
}

@media (max-width: 1400px) {
  .overview-content {
    flex-direction: column;
  }

  .roi-overview {
    width: 100%;
  }

  .stages-content {
    flex-direction: column;
  }

  .pie-chart-container {
    width: 100%;
  }

  .pie-chart {
    height: 380px;
  }
}

@media (max-width: 1200px) {
  .ad-analysis-page {
    padding: 24px 20px;
  }

  .stages-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .ad-analysis-page {
    padding: 20px 16px;
  }

  .stages-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-container {
    height: 320px;
  }

  .search-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .pie-chart {
    height: 320px;
  }
}
</style>
