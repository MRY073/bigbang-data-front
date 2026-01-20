<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  getCurrentInstance
} from "vue";
import { useDark } from "@pureadmin/utils";
import { Loading, Warning } from "@element-plus/icons-vue";
import type { ChartDataResponse } from "@/api/monitor";
import type { EChartsOption } from "echarts";

const props = defineProps<{
  data: ChartDataResponse | null;
  visibleSeries: {
    visitors: boolean;
    cartRate: boolean;
    conversionRate: boolean;
    orderBuyerRatio: boolean; // 订单量/买家数
    gmv: boolean;
  };
  loading?: boolean;
  error?: string;
}>();

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref<HTMLDivElement>();
let chartInstance: any = null;
// 保存上一次的数据引用，用于判断是数据变化还是只是显示状态变化
let lastDataRef: ChartDataResponse | null = null;

// 获取当前实例以访问全局属性
const instance = getCurrentInstance();

// 获取 ECharts 实例
function getECharts() {
  if (!instance) return null;
  return (instance.appContext.config.globalProperties as any).$echarts;
}

// 销毁图表
function disposeChart() {
  if (chartInstance) {
    try {
      chartInstance.dispose();
      console.log("[MonitorLineChart] 图表实例已销毁");
    } catch (error) {
      console.warn("[MonitorLineChart] 销毁图表时出错", error);
    }
    chartInstance = null;
  } else if (chartRef.value) {
    // 尝试通过 DOM 获取并销毁
    const echarts = getECharts();
    if (echarts && echarts.getInstanceByDom) {
      try {
        const existingInstance = echarts.getInstanceByDom(chartRef.value);
        if (existingInstance) {
          existingInstance.dispose();
          console.log("[MonitorLineChart] 通过 DOM 找到并销毁图表实例");
        }
      } catch (error) {
        console.warn("[MonitorLineChart] 通过 DOM 销毁图表时出错", error);
      }
    }
  }
}

// 初始化图表
function initChart() {
  if (!chartRef.value) {
    console.warn("[MonitorLineChart] 容器不存在，无法初始化图表");
    return;
  }

  const echarts = getECharts();
  if (!echarts) {
    console.error("[MonitorLineChart] 无法获取 ECharts 实例");
    return;
  }

  // 先销毁旧实例
  disposeChart();

  // 创建新实例
  try {
    chartInstance = echarts.init(chartRef.value, theme.value, {
      renderer: "canvas"
    });
    console.log("[MonitorLineChart] 图表实例已创建");
  } catch (error) {
    console.error("[MonitorLineChart] 创建图表实例失败", error);
    chartInstance = null;
  }
}

// 格式化访客数
function formatVisitors(value: number | null): string {
  if (value === null || value === undefined) return "";
  return Math.round(value).toString();
}

// 格式化百分比
function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "";
  return `${(value * 100).toFixed(2)}%`;
}

// 格式化货币
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(2);
}

// 计算Y轴范围
function calculateYAxisRange(
  data: (number | null)[],
  minPadding = 0.1
): { min: number; max: number } {
  const validData = data.filter(
    (v): v is number => v !== null && v !== undefined && !isNaN(v)
  );
  if (validData.length === 0) {
    return { min: 0, max: 100 };
  }
  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min;
  const padding = range * minPadding || max * minPadding || 1;
  return {
    min: Math.max(0, min - padding),
    max: max + padding
  };
}

// 更新图表
async function updateChart(onlyUpdateSeries = false) {
  console.log("[MonitorLineChart] updateChart 被调用", {
    hasData: !!props.data,
    hasChartRef: !!chartRef.value,
    loading: props.loading,
    visibleSeries: props.visibleSeries,
    dataDatesLength: props.data?.dates?.length,
    chartRefWidth: chartRef.value?.offsetWidth,
    chartRefHeight: chartRef.value?.offsetHeight,
    onlyUpdateSeries
  });

  if (!props.data || !chartRef.value) {
    console.warn("[MonitorLineChart] updateChart 提前返回", {
      hasData: !!props.data,
      hasChartRef: !!chartRef.value
    });
    return;
  }

  // 确保 DOM 已经渲染完成
  await nextTick();

  // 检查容器尺寸，如果为0则等待一下
  if (chartRef.value.offsetWidth === 0 || chartRef.value.offsetHeight === 0) {
    console.warn("[MonitorLineChart] 容器尺寸为0，等待重试", {
      width: chartRef.value.offsetWidth,
      height: chartRef.value.offsetHeight
    });
    setTimeout(() => {
      updateChart(onlyUpdateSeries);
    }, 100);
    return;
  }

  // 如果图表未初始化，先初始化
  if (!chartInstance) {
    console.log("[MonitorLineChart] 图表未初始化，先初始化");
    initChart();
    await nextTick();
    onlyUpdateSeries = false; // 初始化时必须完全重建
  }

  // 确保图表实例存在
  if (!chartInstance) {
    console.error("[MonitorLineChart] 图表实例不存在，无法更新");
    return;
  }

  // 如果只是更新系列显示状态，且图表已存在，使用轻量级更新
  if (onlyUpdateSeries && chartInstance && lastDataRef === props.data) {
    console.log("[MonitorLineChart] 仅更新系列显示状态");
    try {
      // 使用 ECharts 的 dispatchAction 来切换系列的显示/隐藏
      // 或者直接更新 series 配置
      const currentOption = chartInstance.getOption();
      const currentSeries = currentOption.series || [];

      // 构建新的系列配置
      const {
        dates,
        visitors,
        cartRate,
        conversionRate,
        orderCount,
        buyerCount,
        gmv
      } = props.data;
      const newSeries: any[] = [];
      const newYAxis: any[] = [];
      let yAxisIndex = 0;

      // 访客数
      if (props.visibleSeries.visitors) {
        const range = calculateYAxisRange(visitors);
        newSeries.push({
          name: "访客数",
          type: "line",
          yAxisIndex: yAxisIndex,
          data: visitors,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#5470c6" },
          itemStyle: { color: "#5470c6" },
          connectNulls: false
        });
        newYAxis.push({
          type: "value",
          name: "访客数(人)",
          position: "left",
          min: range.min,
          max: range.max,
          axisLabel: { formatter: (value: number) => formatVisitors(value) }
        });
        yAxisIndex++;
      }

      // 加购率
      if (props.visibleSeries.cartRate) {
        const range = calculateYAxisRange(cartRate.map(v => (v || 0) * 100));
        newSeries.push({
          name: "加购率",
          type: "line",
          yAxisIndex: yAxisIndex,
          data: cartRate.map(v => (v || 0) * 100),
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#91cc75" },
          itemStyle: { color: "#91cc75" },
          connectNulls: false
        });
        newYAxis.push({
          type: "value",
          name: "加购率(%)",
          position: yAxisIndex === 0 ? "left" : "right",
          min: range.min,
          max: range.max,
          axisLabel: { formatter: (value: number) => `${value.toFixed(2)}%` }
        });
        yAxisIndex++;
      }

      // 转化率
      if (props.visibleSeries.conversionRate) {
        // 注意：conversionRate 后端返回的就是“百分比数值”（例如 5.02 表示 5.02%），前端不应再 * 100
        const range = calculateYAxisRange(conversionRate.map(v => v || 0));
        newSeries.push({
          name: "转化率",
          type: "line",
          yAxisIndex: yAxisIndex,
          data: conversionRate.map(v => v || 0),
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#fac858" },
          itemStyle: { color: "#fac858" },
          connectNulls: false
        });
        newYAxis.push({
          type: "value",
          name: "转化率(%)",
          position: yAxisIndex === 0 ? "left" : "right",
          min: range.min,
          max: range.max,
          axisLabel: { formatter: (value: number) => `${value.toFixed(2)}%` }
        });
        yAxisIndex++;
      }

      // 订单量/买家数
      if (props.visibleSeries.orderBuyerRatio) {
        // 计算订单量/买家数，处理除零和null值
        const orderBuyerRatioData = orderCount.map((order, index) => {
          const buyer = buyerCount[index];
          if (order === null || buyer === null || buyer === 0) {
            return null;
          }
          return order / buyer;
        });
        const range = calculateYAxisRange(orderBuyerRatioData);
        newSeries.push({
          name: "订单量/买家数",
          type: "line",
          yAxisIndex: yAxisIndex,
          data: orderBuyerRatioData,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#ee6666" },
          itemStyle: { color: "#ee6666" },
          connectNulls: false
        });
        newYAxis.push({
          type: "value",
          name: "订单量/买家数",
          position: yAxisIndex === 0 ? "left" : "right",
          min: range.min,
          max: range.max,
          axisLabel: {
            formatter: (value: number) => value.toFixed(2)
          }
        });
        yAxisIndex++;
      }

      // GMV
      if (props.visibleSeries.gmv) {
        const range = calculateYAxisRange(gmv);
        newSeries.push({
          name: "GMV",
          type: "line",
          yAxisIndex: yAxisIndex,
          data: gmv,
          smooth: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { width: 2, color: "#3ba272" },
          itemStyle: { color: "#3ba272" },
          connectNulls: false
        });
        newYAxis.push({
          type: "value",
          name: "GMV(THB)",
          position: yAxisIndex === 0 ? "left" : "right",
          min: range.min,
          max: range.max,
          axisLabel: { formatter: (value: number) => formatCurrency(value) }
        });
        yAxisIndex++;
      }

      // 使用合并模式更新，只更新 series 和 yAxis
      chartInstance.setOption(
        {
          series: newSeries,
          yAxis:
            newYAxis.length > 0 ? newYAxis : [{ type: "value", name: "数值" }],
          legend: {
            data: newSeries.map(s => s.name),
            bottom: 0,
            type: "scroll"
          }
        },
        false
      ); // false 表示合并模式，不替换整个配置

      console.log("[MonitorLineChart] 系列更新成功（轻量级更新）");
      return;
    } catch (error) {
      console.error("[MonitorLineChart] 轻量级更新失败，回退到完全重建", error);
      onlyUpdateSeries = false; // 失败时回退到完全重建
    }
  }
  const {
    dates,
    visitors,
    cartRate,
    conversionRate,
    orderCount,
    buyerCount,
    gmv
  } = props.data;

  // 构建系列数据
  const series: any[] = [];
  const yAxis: any[] = [];
  let yAxisIndex = 0;

  // 访客数 - 左侧Y轴
  if (props.visibleSeries.visitors) {
    const range = calculateYAxisRange(visitors);
    series.push({
      name: "访客数",
      type: "line",
      yAxisIndex: yAxisIndex,
      data: visitors,
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: "#5470c6"
      },
      itemStyle: {
        color: "#5470c6"
      },
      connectNulls: false
    });
    yAxis.push({
      type: "value",
      name: "访客数(人)",
      position: "left",
      min: range.min,
      max: range.max,
      axisLabel: {
        formatter: (value: number) => formatVisitors(value)
      }
    });
    yAxisIndex++;
  }

  // 加购率 - 右侧Y轴
  if (props.visibleSeries.cartRate) {
    const range = calculateYAxisRange(cartRate.map(v => (v || 0) * 100));
    series.push({
      name: "加购率",
      type: "line",
      yAxisIndex: yAxisIndex,
      data: cartRate.map(v => (v || 0) * 100),
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: "#91cc75"
      },
      itemStyle: {
        color: "#91cc75"
      },
      connectNulls: false
    });
    yAxis.push({
      type: "value",
      name: "加购率(%)",
      position: yAxisIndex === 0 ? "left" : "right",
      min: range.min,
      max: range.max,
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    });
    yAxisIndex++;
  }

  // 转化率 - 右侧Y轴
  if (props.visibleSeries.conversionRate) {
    // 注意：conversionRate 后端返回的就是“百分比数值”（例如 5.02 表示 5.02%），前端不应再 * 100
    const range = calculateYAxisRange(conversionRate.map(v => v || 0));
    series.push({
      name: "转化率",
      type: "line",
      yAxisIndex: yAxisIndex,
      data: conversionRate.map(v => v || 0),
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: "#fac858"
      },
      itemStyle: {
        color: "#fac858"
      },
      connectNulls: false
    });
    yAxis.push({
      type: "value",
      name: "转化率(%)",
      position: yAxisIndex === 0 ? "left" : "right",
      min: range.min,
      max: range.max,
      axisLabel: {
        formatter: (value: number) => `${value.toFixed(2)}%`
      }
    });
    yAxisIndex++;
  }

  // 订单量/买家数 - 右侧Y轴
  if (props.visibleSeries.orderBuyerRatio) {
    // 计算订单量/买家数，处理除零和null值
    const orderBuyerRatioData = orderCount.map((order, index) => {
      const buyer = buyerCount[index];
      if (order === null || buyer === null || buyer === 0) {
        return null;
      }
      return order / buyer;
    });
    const range = calculateYAxisRange(orderBuyerRatioData);
    series.push({
      name: "订单量/买家数",
      type: "line",
      yAxisIndex: yAxisIndex,
      data: orderBuyerRatioData,
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: "#ee6666"
      },
      itemStyle: {
        color: "#ee6666"
      },
      connectNulls: false
    });
    yAxis.push({
      type: "value",
      name: "订单量/买家数",
      position: yAxisIndex === 0 ? "left" : "right",
      min: range.min,
      max: range.max,
      axisLabel: {
        formatter: (value: number) => value.toFixed(2)
      }
    });
    yAxisIndex++;
  }

  // GMV - 右侧Y轴
  if (props.visibleSeries.gmv) {
    const range = calculateYAxisRange(gmv);
    series.push({
      name: "GMV",
      type: "line",
      yAxisIndex: yAxisIndex,
      data: gmv,
      smooth: true,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: {
        width: 2,
        color: "#3ba272"
      },
      itemStyle: {
        color: "#3ba272"
      },
      connectNulls: false
    });
    yAxis.push({
      type: "value",
      name: "GMV(THB)",
      position: yAxisIndex === 0 ? "left" : "right",
      min: range.min,
      max: range.max,
      axisLabel: {
        formatter: (value: number) => formatCurrency(value)
      }
    });
    yAxisIndex++;
  }

  // 如果没有可见的系列，显示空图表
  if (series.length === 0) {
    // 销毁并重新创建图表
    disposeChart();
    await nextTick();
    initChart();
    await nextTick();

    if (chartInstance) {
      chartInstance.setOption(
        {
          xAxis: {
            type: "category",
            data: dates,
            axisLabel: {
              rotate: 45,
              formatter: (value: string) => {
                if (!value) return "";
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }
            }
          },
          yAxis: [
            {
              type: "value",
              name: "数值"
            }
          ],
          series: [],
          tooltip: {
            trigger: "axis"
          },
          grid: {
            left: "60px",
            right: "60px",
            top: "40px",
            bottom: "60px"
          }
        },
        true
      );
    }
    return;
  }

  console.log("[MonitorLineChart] 调用 setOptions", {
    seriesCount: series.length,
    yAxisCount: yAxis.length,
    datesLength: dates.length,
    chartRefWidth: chartRef.value?.offsetWidth,
    chartRefHeight: chartRef.value?.offsetHeight,
    hasChartInstance: !!chartInstance
  });

  // 确保容器已准备好
  if (
    !chartRef.value ||
    chartRef.value.offsetWidth === 0 ||
    chartRef.value.offsetHeight === 0
  ) {
    console.warn("[MonitorLineChart] 容器未准备好，延迟重试");
    setTimeout(() => {
      updateChart();
    }, 100);
    return;
  }

  try {
    // 构建完整的配置对象
    const chartOptions = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross"
        },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return "";
          let result = `<div style="margin-bottom: 4px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            if (param.seriesName === "访客数") {
              result += `<div>${param.marker}${param.seriesName}: ${formatVisitors(param.value)}人</div>`;
            } else if (param.seriesName === "加购率") {
              result += `<div>${param.marker}${param.seriesName}: ${formatPercent((param.value || 0) / 100)}</div>`;
            } else if (param.seriesName === "转化率") {
              result += `<div>${param.marker}${param.seriesName}: ${formatPercent((param.value || 0) / 100)}</div>`;
            } else if (param.seriesName === "订单量/买家数") {
              // ECharts tooltip 的 value 可能是 number / string / undefined / [x, y]
              const raw = Array.isArray(param.value)
                ? param.value[param.value.length - 1]
                : param.value;
              const v = typeof raw === "number" ? raw : Number(raw);
              const text = Number.isFinite(v) ? v.toFixed(2) : "N/A";
              result += `<div>${param.marker}${param.seriesName}: ${text}</div>`;
            } else if (param.seriesName === "GMV") {
              result += `<div>${param.marker}${param.seriesName}: ${formatCurrency(param.value)} THB</div>`;
            }
          });
          return result;
        }
      },
      legend: {
        data: series.map(s => s.name),
        bottom: 0,
        type: "scroll"
      },
      grid: {
        left: "60px",
        right: "60px",
        top: "40px",
        bottom: "80px"
      },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: {
          rotate: 45,
          formatter: (value: string) => {
            if (!value) return "";
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }
        }
      },
      yAxis:
        yAxis.length > 0
          ? yAxis
          : [
              {
                type: "value",
                name: "数值"
              }
            ],
      series: series
    };

    console.log("[MonitorLineChart] 准备设置图表配置", {
      hasTooltip: !!chartOptions.tooltip,
      hasLegend: !!chartOptions.legend,
      hasXAxis: !!chartOptions.xAxis,
      yAxisCount: Array.isArray(chartOptions.yAxis)
        ? chartOptions.yAxis.length
        : 0,
      seriesCount: chartOptions.series.length,
      hasChartInstance: !!chartInstance
    });

    // 如果是完全重建，销毁并重新创建图表实例
    if (!onlyUpdateSeries) {
      disposeChart();
      await nextTick();
      initChart();
      await nextTick();
    }

    // 设置新配置
    if (chartInstance) {
      chartInstance.setOption(chartOptions, !onlyUpdateSeries); // 完全重建时不合并，轻量级更新时合并
      console.log("[MonitorLineChart] setOption 调用成功", {
        onlyUpdateSeries
      });
      // 更新数据引用
      lastDataRef = props.data;
    } else {
      console.error("[MonitorLineChart] 图表实例不存在，无法设置配置");
    }

    // 检查图表是否渲染
    await nextTick();
    setTimeout(() => {
      if (chartRef.value) {
        const canvas = chartRef.value.querySelector("canvas");
        const svg = chartRef.value.querySelector("svg");
        console.log("[MonitorLineChart] 图表渲染检查", {
          hasCanvas: !!canvas,
          hasSvg: !!svg,
          containerChildren: chartRef.value.children.length,
          containerInnerHTML: chartRef.value.innerHTML.substring(0, 100)
        });

        // 如果图表没有渲染，尝试再次调用 setOptions
        if (!canvas && !svg) {
          console.warn("[MonitorLineChart] 图表未渲染，尝试重新设置");
          // 不重复调用，因为可能是配置问题
        }
      }
    }, 200);
  } catch (error) {
    console.error("[MonitorLineChart] setOptions 调用失败", error);
    throw error;
  }
}

// 只监听显示指标的变化
watch(
  () => props.visibleSeries,
  async (newVal, oldVal) => {
    console.log("[MonitorLineChart] visibleSeries watch 触发", {
      newVal,
      oldVal,
      loading: props.loading,
      hasData: !!props.data,
      changed: JSON.stringify(newVal) !== JSON.stringify(oldVal)
    });

    // 如果正在加载，不更新图表
    if (props.loading) {
      console.log("[MonitorLineChart] visibleSeries watch: 正在加载，跳过");
      return;
    }

    // 检查显示指标是否发生变化
    const visibleSeriesChanged =
      JSON.stringify(newVal) !== JSON.stringify(oldVal);

    // 如果显示指标发生变化，且数据未变化，使用轻量级更新
    if (visibleSeriesChanged && !props.loading && props.data && chartInstance) {
      console.log(
        "[MonitorLineChart] visibleSeries watch: 指标变化，轻量级更新图表"
      );
      await nextTick();
      // 使用轻量级更新，只更新系列显示状态
      updateChart(true);
    } else if (visibleSeriesChanged && !props.loading && props.data) {
      console.log(
        "[MonitorLineChart] visibleSeries watch: 指标变化，但图表未初始化，完全重建"
      );
      await nextTick();
      await nextTick();
      setTimeout(() => {
        updateChart(false);
      }, 50);
    } else {
      console.log("[MonitorLineChart] visibleSeries watch: 条件不满足", {
        visibleSeriesChanged,
        loading: props.loading,
        hasData: !!props.data,
        hasChartInstance: !!chartInstance
      });
    }
  },
  { deep: true, immediate: false }
);

// 监听数据变化，当数据加载完成时更新图表
watch(
  () => [props.data, props.loading],
  async ([newData, newLoading], [oldData, oldLoading]) => {
    console.log("[MonitorLineChart] data/loading watch 触发", {
      hasNewData: !!newData,
      hasOldData: !!oldData,
      newLoading,
      oldLoading,
      dataChanged: newData !== oldData,
      loadingChanged: newLoading !== oldLoading,
      newDataDatesLength:
        newData && typeof newData === "object" && "dates" in newData
          ? newData.dates?.length
          : 0,
      oldDataDatesLength:
        oldData && typeof oldData === "object" && "dates" in oldData
          ? oldData.dates?.length
          : 0
    });

    // 如果正在加载，不更新图表
    if (newLoading) {
      console.log("[MonitorLineChart] data/loading watch: 正在加载，跳过");
      return;
    }

    // 检查数据是否真的变化了（通过比较引用）
    const dataChanged = newData !== oldData;

    // 如果数据从无到有，或者 loading 从 true 变为 false，或者数据引用变化，更新图表
    const condition1 = !!(newData && !oldData);
    const condition2 = !!(oldLoading && !newLoading && newData);
    const condition3 = !!(dataChanged && newData && !newLoading);
    const shouldUpdate = condition1 || condition2 || condition3;

    console.log("[MonitorLineChart] data/loading watch: 更新判断", {
      shouldUpdate: !!shouldUpdate,
      dataChanged,
      condition1,
      condition2,
      condition3
    });

    if (shouldUpdate) {
      console.log(
        "[MonitorLineChart] data/loading watch: 更新图表（完全重建）"
      );
      // 等待 DOM 更新完成
      await nextTick();
      await nextTick();
      // 再等待一小段时间确保容器已渲染
      setTimeout(() => {
        updateChart(false); // 数据变化时完全重建
      }, 50);
    } else {
      console.log("[MonitorLineChart] data/loading watch: 不满足更新条件");
    }
  },
  { deep: false }
);

// 组件挂载后初始化图表
onMounted(() => {
  console.log("[MonitorLineChart] onMounted", {
    hasData: !!props.data,
    loading: props.loading,
    hasChartRef: !!chartRef.value
  });

  // 等待 DOM 完全渲染
  nextTick(() => {
    setTimeout(() => {
      if (chartRef.value) {
        console.log("[MonitorLineChart] onMounted: 初始化图表");
        initChart();

        // 如果有数据，更新图表（初始化时完全重建）
        if (props.data && !props.loading) {
          updateChart(false);
        }
      }
    }, 100);
  });
});

// 组件卸载时销毁图表
onUnmounted(() => {
  console.log("[MonitorLineChart] onUnmounted: 销毁图表");
  disposeChart();
});
</script>

<template>
  <div class="monitor-line-chart">
    <div v-if="loading" class="chart-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="chart-error">
      <el-icon><Warning /></el-icon>
      <span>{{ error }}</span>
    </div>
    <div
      v-else-if="!data || !data.dates || data.dates.length === 0"
      class="chart-empty"
    >
      <el-empty description="暂无数据" :image-size="80" />
    </div>
    <div v-else class="chart-wrapper">
      <div ref="chartRef" class="chart-container" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.monitor-line-chart {
  width: 100%;
  height: 100%;
  min-height: 400px;
  position: relative;

  .chart-wrapper {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  .chart-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  .chart-loading,
  .chart-error,
  .chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: var(--el-text-color-secondary);
    gap: 12px;

    .el-icon {
      font-size: 32px;
    }
  }

  .chart-error {
    color: var(--el-color-error);
  }
}
</style>
