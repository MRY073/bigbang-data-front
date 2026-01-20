<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage, ElLoading, ElDialog, ElMessageBox } from "element-plus";
import { Loading, Warning, ArrowDown, ArrowUp } from "@element-plus/icons-vue";
import type { LoadingInstance } from "element-plus";
import dayjs from "dayjs";
import {
  getPotentialLinkMonitorList,
  getPotentialLinkMonitorAISuggestion,
  batchGetPotentialLinkMonitorAISuggestion,
  getPotentialLinkMonitorChart,
  savePotentialLinkMonitorAnalysis,
  type ChartDataResponse
} from "@/api/monitor";
import { getCustomCategoryOptions } from "@/api/productItems";
import { shopOptions, DEFAULT_SHOP_ID, getShopOption } from "@/constants/shops";
import MonitorLineChart from "@/components/MonitorLineChart/index.vue";
import { getPickerShortcuts } from "@/views/monitor/utils";

// 简单的防抖函数
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

defineOptions({ name: "PotentialLinkMonitor" });

type WarningLevel = "严重" | "一般" | "轻微" | "正常";
type ChangeLevel = "极小" | "轻微" | "一般" | "明显" | "剧烈";

type Volatility = {
  window: number; // 滑动窗口天数：1, 3, 7, 15, 30
  direction: "+" | "-";
  strength: number;
  level: ChangeLevel;
};

type ProductCard = {
  id: string;
  name: string;
  image?: string | null;
  visitorsAvg?: number[]; // 已废弃
  visitorsVolatilityBaseline?: Volatility[]; // 已废弃
  adCostAvg?: number[]; // 已废弃
  adCostVolatilityBaseline?: Volatility[]; // 已废弃
  salesAvg?: number[]; // 已废弃
  salesVolatilityBaseline?: Volatility[]; // 已废弃
  warningLevel: WarningLevel;
  warningMessages?: string[];
  // 自定义分类字段（如果后端返回）
  custom_category_1?: string | null;
  custom_category_2?: string | null;
  custom_category_3?: string | null;
  custom_category_4?: string | null;
  analysis?: string | null;
  improvementPlan?: string | null;
};

const products = ref<ProductCard[]>([]);
const loading = ref(false);
const selectedShop = ref<string>(DEFAULT_SHOP_ID); // 默认选择第一个店铺

// 折叠展开状态
const expandedProducts = ref<Record<string, boolean>>({});

// 批量AI建议相关
const batchAISuggestionLoading = ref(false);

// 图表相关
const chartDataMap = ref<Record<string, ChartDataResponse | null>>({});
const chartLoadingMap = ref<Record<string, boolean>>({});
const chartErrorMap = ref<Record<string, string>>({});

// 日期范围 - 每个商品独立的日期范围
const dateRangeMap = ref<Record<string, [string, string]>>({});

// 可见系列控制 - 每个商品独立的控制
const visibleSeriesMap = ref<
  Record<
    string,
    {
      visitors: boolean;
      cartRate: boolean;
      conversionRate: boolean;
      orderCount: boolean;
      buyerCount: boolean;
      gmv: boolean;
    }
  >
>({});

// 分析内容 - 每个商品独立的分析内容
const analysisMap = ref<Record<string, string>>({});
const improvementPlanMap = ref<Record<string, string>>({});
const savingMap = ref<Record<string, boolean>>({});

// 分页相关
const currentPage = ref(1);
const pageSize = ref(10);

// 筛选后的商品数据
const filteredProducts = computed(() => {
  let filtered = products.value;

  // 根据自定义分类筛选
  if (selectedCustomCategory.value) {
    const selected = selectedCustomCategory.value.trim().toLowerCase();
    filtered = filtered.filter(item => {
      // 检查商品是否包含选中的分类
      return categoryFields.some(field => {
        const value = (item as any)[field];
        if (typeof value === "string") {
          return value.toLowerCase().includes(selected);
        }
        return false;
      });
    });
  }

  return filtered;
});

// 计算分页后的数据
const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredProducts.value.slice(start, end);
});

// 总条数（使用筛选后的数据）
const total = computed(() => filteredProducts.value.length);

// 店铺选项从共享常量导入

// 自定义分类筛选
const customCategoryOptions = ref<Array<{ label: string; value: string }>>([]);
const selectedCustomCategory = ref<string>("");

// 自定义分类字段
const categoryFields = [
  "custom_category_1",
  "custom_category_2",
  "custom_category_3",
  "custom_category_4"
] as const;

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

// 初始化商品的日期范围和可见系列
function initProductSettings(productId: string) {
  if (!dateRangeMap.value[productId]) {
    const endDate = dayjs().format("YYYY-MM-DD");
    const startDate = dayjs().subtract(29, "day").format("YYYY-MM-DD");
    dateRangeMap.value[productId] = [startDate, endDate];
  }
  if (!visibleSeriesMap.value[productId]) {
    visibleSeriesMap.value[productId] = {
      visitors: true,
      cartRate: true,
      conversionRate: true,
      orderCount: true,
      buyerCount: true,
      gmv: true
    };
  }
}

// 获取商品的日期范围
function getProductDateRange(productId: string): [string, string] {
  initProductSettings(productId);
  return dateRangeMap.value[productId];
}

// 获取商品的可见系列
function getProductVisibleSeries(productId: string) {
  initProductSettings(productId);
  return visibleSeriesMap.value[productId];
}

// 获取商品的分析内容
function getProductAnalysis(productId: string): string {
  return analysisMap.value[productId] || "";
}

// 获取商品的改善方案
function getProductImprovementPlan(productId: string): string {
  return improvementPlanMap.value[productId] || "";
}

// 加载图表数据
async function loadChartData(productId: string) {
  if (!selectedShop.value) return;

  const shopOption = getShopOption(selectedShop.value);
  if (!shopOption) return;

  const [startDate, endDate] = getProductDateRange(productId);
  chartLoadingMap.value[productId] = true;
  chartErrorMap.value[productId] = "";

  try {
    const result = await getPotentialLinkMonitorChart({
      shopID: selectedShop.value,
      shopName: shopOption.label,
      productID: productId,
      startDate,
      endDate
    });

    if (result.success && result.data) {
      chartDataMap.value[productId] = result.data;
    } else {
      throw new Error(result.error || result.message || "获取图表数据失败");
    }
  } catch (error: any) {
    console.error("加载图表数据失败:", error);
    chartErrorMap.value[productId] = error?.message || "加载图表数据失败";
    chartDataMap.value[productId] = null;
  } finally {
    chartLoadingMap.value[productId] = false;
  }
}

// 处理日期范围变化
function handleDateRangeChange(productId: string, range: [string, string] | null) {
  if (!range) return;
  dateRangeMap.value[productId] = range;
  loadChartData(productId);
}

// 处理可见系列变化
function handleVisibleSeriesChange(
  productId: string,
  key: keyof typeof visibleSeriesMap.value[string],
  value: boolean
) {
  const visibleSeries = getProductVisibleSeries(productId);
  const newVisibleSeries = { ...visibleSeries, [key]: value };
  
  // 确保至少有一条折线显示
  const visibleCount = Object.values(newVisibleSeries).filter(v => v).length;
  if (visibleCount === 0) {
    ElMessage.warning("至少需要显示一条折线");
    return;
  }

  visibleSeriesMap.value[productId] = newVisibleSeries;
}

// 保存分析内容（防抖）
const debouncedSaveAnalysis = debounce(
  async (productId: string, analysis: string, improvementPlan: string) => {
    if (!selectedShop.value) return;

    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) return;

    savingMap.value[productId] = true;
    try {
      await savePotentialLinkMonitorAnalysis({
        shopID: selectedShop.value,
        shopName: shopOption.label,
        productID: productId,
        analysis: analysis || undefined,
        improvementPlan: improvementPlan || undefined
      });
      ElMessage.success("保存成功");
    } catch (error: any) {
      console.error("保存分析失败:", error);
      ElMessage.error(error?.message || "保存失败，请稍后重试");
    } finally {
      savingMap.value[productId] = false;
    }
  },
  800
);

// 处理分析内容变化
function handleAnalysisChange(productId: string, value: string) {
  if (value.length > 10000) {
    ElMessage.warning("分析内容不能超过10000字");
    return;
  }
  analysisMap.value[productId] = value;
  debouncedSaveAnalysis(
    productId,
    value,
    getProductImprovementPlan(productId)
  );
}

// 处理改善方案变化
function handleImprovementPlanChange(productId: string, value: string) {
  if (value.length > 10000) {
    ElMessage.warning("改善方案不能超过10000字");
    return;
  }
  improvementPlanMap.value[productId] = value;
  debouncedSaveAnalysis(
    productId,
    getProductAnalysis(productId),
    value
  );
}

/** 切换商品展开/折叠状态 */
function toggleExpand(productId: string) {
  expandedProducts.value[productId] = !expandedProducts.value[productId];
  // 展开时加载图表数据
  if (expandedProducts.value[productId]) {
    initProductSettings(productId);
    loadChartData(productId);
  }
}

/** 获取商品展开状态 */
function isExpanded(productId: string) {
  return !!expandedProducts.value[productId];
}

/** 根据警告级别和展开状态获取背景色 */
function getCardBackgroundColor(
  warningLevel: WarningLevel,
  isExpanded: boolean
): string {
  if (isExpanded) {
    return ""; // 展开时背景色正常
  }
  switch (warningLevel) {
    case "严重":
      return "#ffebee"; // 红色背景
    case "一般":
      return "#fff3e0"; // 橙色背景
    case "轻微":
    case "正常":
    default:
      return ""; // 正常背景
  }
}

/** 格式化数字为最多2位小数（去掉末尾的0） */
function formatNumber(num: number): string {
  return parseFloat(num.toFixed(2)).toString();
}

/** 格式化数字为最多2位小数并添加千分位分隔符 */
function formatNumberWithLocale(num: number): string {
  return parseFloat(num.toFixed(2)).toLocaleString();
}

/** 安全格式化波动率强度（处理 null/undefined） */
function formatVolatilityStrength(strength: number | null | undefined): string {
  if (strength == null || isNaN(strength)) {
    return "0.00";
  }
  return strength.toFixed(2);
}

/** 滑动窗口配置 */
const WINDOWS = [1, 3, 7, 15, 30];

/** 窗口颜色映射 */
const WINDOW_COLORS: Record<number, string> = {
  1: "#FF6F91",
  3: "#FF9B6A",
  7: "#FFD33D",
  15: "#4A00E0", // 深紫色，高对比度
  30: "#0066CC" // 深蓝色，高对比度
};

/** 变化等级颜色 */
const levelColors: Record<ChangeLevel, string> = {
  极小: "#6C63FF",
  轻微: "#2DE2E6",
  一般: "#FF9B6A",
  明显: "#FF6F91",
  剧烈: "#FF3F6C"
};

/** 方向颜色 */
const directionColors = {
  "+": "#2DE2E6",
  "-": "#FF6F91"
};

function loadMockData() {
  products.value = [
    {
      id: "SKU-1001",
      name: "潜力 — 舒适运动鞋",
      image: "https://via.placeholder.com/120?text=SKU-1001",
      visitorsAvg: [4200, 4500, 4700, 4900, 5100],
      visitorsVolatilityBaseline: [
        { window: 1, direction: "+", strength: 21.4, level: "一般" },
        { window: 3, direction: "+", strength: 18.6, level: "轻微" },
        { window: 7, direction: "+", strength: 15.2, level: "轻微" },
        { window: 15, direction: "+", strength: 12.3, level: "轻微" },
        { window: 30, direction: "+", strength: 8.5, level: "极小" }
      ],
      adCostAvg: [1200.5, 1400.2, 1500.3, 1600.0, 1700.9],
      adCostVolatilityBaseline: [
        { window: 1, direction: "+", strength: 15.3, level: "轻微" },
        { window: 3, direction: "+", strength: 12.8, level: "轻微" },
        { window: 7, direction: "+", strength: 10.5, level: "轻微" },
        { window: 15, direction: "+", strength: 8.1, level: "极小" },
        { window: 30, direction: "+", strength: 5.2, level: "极小" }
      ],
      salesAvg: [32000, 33000, 34000, 35000, 36000],
      salesVolatilityBaseline: [
        { window: 1, direction: "+", strength: 16.2, level: "轻微" },
        { window: 3, direction: "+", strength: 13.7, level: "轻微" },
        { window: 7, direction: "+", strength: 11.5, level: "轻微" },
        { window: 15, direction: "+", strength: 9.2, level: "极小" },
        { window: 30, direction: "+", strength: 6.8, level: "极小" }
      ],
      warningLevel: "正常",
      warningMessages: []
    },
    {
      id: "SKU-2002",
      name: "潜力 — 高端皮带",
      image: "https://via.placeholder.com/120?text=SKU-2002",
      visitorsAvg: [800, 760, 700, 650, 620],
      visitorsVolatilityBaseline: [
        { window: 1, direction: "-", strength: 22.5, level: "一般" },
        { window: 3, direction: "-", strength: 35.5, level: "一般" },
        { window: 7, direction: "-", strength: 25.0, level: "一般" },
        { window: 15, direction: "-", strength: 12.5, level: "轻微" },
        { window: 30, direction: "-", strength: 5.0, level: "极小" }
      ],
      adCostAvg: [900, 880, 860, 840, 820],
      adCostVolatilityBaseline: [
        { window: 1, direction: "-", strength: 11.1, level: "轻微" },
        { window: 3, direction: "-", strength: 8.9, level: "极小" },
        { window: 7, direction: "-", strength: 6.7, level: "极小" },
        { window: 15, direction: "-", strength: 4.4, level: "极小" },
        { window: 30, direction: "-", strength: 2.2, level: "极小" }
      ],
      salesAvg: [5000, 4800, 4500, 4200, 4000],
      salesVolatilityBaseline: [
        { window: 1, direction: "-", strength: 20.0, level: "一般" },
        { window: 3, direction: "-", strength: 30.0, level: "明显" },
        { window: 7, direction: "-", strength: 20.0, level: "一般" },
        { window: 15, direction: "-", strength: 10.0, level: "轻微" },
        { window: 30, direction: "-", strength: 4.0, level: "极小" }
      ],
      warningLevel: "轻微",
      warningMessages: ["近1/3天访客下降，建议关注"]
    },
    {
      id: "SKU-3003",
      name: "潜力 — 电子秤（热销）",
      image: "https://via.placeholder.com/120?text=SKU-3003",
      visitorsAvg: [12000, 12500, 13000, 13500, 14000],
      visitorsVolatilityBaseline: [
        { window: 1, direction: "+", strength: 16.7, level: "轻微" },
        { window: 3, direction: "+", strength: 18.7, level: "轻微" },
        { window: 7, direction: "+", strength: 12.5, level: "轻微" },
        { window: 15, direction: "+", strength: 8.3, level: "极小" },
        { window: 30, direction: "+", strength: 4.2, level: "极小" }
      ],
      adCostAvg: [5000, 5200, 5400, 5600, 5800],
      adCostVolatilityBaseline: [
        { window: 1, direction: "+", strength: 20.0, level: "一般" },
        { window: 3, direction: "+", strength: 16.0, level: "轻微" },
        { window: 7, direction: "+", strength: 12.0, level: "轻微" },
        { window: 15, direction: "+", strength: 8.0, level: "极小" },
        { window: 30, direction: "+", strength: 4.0, level: "极小" }
      ],
      salesAvg: [80000, 82000, 84000, 86000, 88000],
      salesVolatilityBaseline: [
        { window: 1, direction: "+", strength: 10.0, level: "轻微" },
        { window: 3, direction: "+", strength: 10.0, level: "轻微" },
        { window: 7, direction: "+", strength: 7.5, level: "极小" },
        { window: 15, direction: "+", strength: 5.0, level: "极小" },
        { window: 30, direction: "+", strength: 2.5, level: "极小" }
      ],
      warningLevel: "一般",
      warningMessages: [
        "广告费用波动较大，ROI 下降",
        "访客数波动较大，趋势上升，变化强度45.20%，需要关注趋势变化"
      ]
    },
    {
      id: "SKU-4004",
      name: "潜力 — 夏季连衣裙",
      image: null,
      visitorsAvg: [300, 280, 250, 220, 200],
      visitorsVolatilityBaseline: [
        { window: 1, direction: "-", strength: 33.3, level: "明显" },
        { window: 3, direction: "-", strength: 50.0, level: "明显" },
        { window: 7, direction: "-", strength: 33.3, level: "明显" },
        { window: 15, direction: "-", strength: 16.7, level: "轻微" },
        { window: 30, direction: "-", strength: 6.7, level: "极小" }
      ],
      adCostAvg: [50, 45, 40, 35, 30],
      adCostVolatilityBaseline: [
        { window: 1, direction: "-", strength: 40.0, level: "明显" },
        { window: 3, direction: "-", strength: 40.0, level: "明显" },
        { window: 7, direction: "-", strength: 30.0, level: "明显" },
        { window: 15, direction: "-", strength: 20.0, level: "一般" },
        { window: 30, direction: "-", strength: 10.0, level: "轻微" }
      ],
      salesAvg: [1200, 1100, 1000, 900, 800],
      salesVolatilityBaseline: [
        { window: 1, direction: "-", strength: 33.3, level: "明显" },
        { window: 3, direction: "-", strength: 50.0, level: "明显" },
        { window: 7, direction: "-", strength: 33.3, level: "明显" },
        { window: 15, direction: "-", strength: 16.7, level: "轻微" },
        { window: 30, direction: "-", strength: 8.3, level: "极小" }
      ],
      warningLevel: "严重",
      warningMessages: [
        "流量与转化骤降，需立刻处理",
        "销售额波动剧烈，趋势下降，变化强度78.50%，风险较高，建议及时处理"
      ]
    }
  ];
}

async function fetchData() {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  loading.value = true;
  const loader = showLoader("拉取数据...");
  try {
    // 将店铺ID和店铺名称作为查询参数传递
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
    const result = await getPotentialLinkMonitorList(params);
    if (result.code === 200 && result.data) {
      // 规范化数据，确保每个产品都有必要的字段
      products.value = (result.data || []).map((item: ProductCard) => {
        const product = {
          ...item,
          warningMessages: item.warningMessages || [],
          analysis: item.analysis || null,
          improvementPlan: item.improvementPlan || null
        };
        
        // 初始化商品设置
        initProductSettings(item.id);
        
        // 加载分析内容
        if (item.analysis) {
          analysisMap.value[item.id] = item.analysis;
        }
        if (item.improvementPlan) {
          improvementPlanMap.value[item.id] = item.improvementPlan;
        }
        
        return product;
      });
      // 从返回的数据中提取分类选项
      if (result.data && Array.isArray(result.data)) {
        const categories: string[] = [];
        result.data.forEach((item: any) => {
          categoryFields.forEach(field => {
            const value = item[field];
            if (typeof value === "string" && value.trim()) {
              categories.push(value.trim());
            }
          });
        });
        appendCustomCategoryOptions([...new Set(categories)]);
      }
      // 数据加载后重置到第一页
      currentPage.value = 1;
    } else {
      throw new Error(result.error || result.message || "查询失败");
    }
  } catch (error: any) {
    console.error("拉取数据失败:", error);
    // loadMockData();
    // ElMessage.info("使用本地示例数据（后端接口未就绪）");
    // 数据加载后重置到第一页
    currentPage.value = 1;
  } finally {
    loader.close();
    loading.value = false;
  }
}

/** 批量获取AI建议 */
async function batchGetAISuggestion() {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  batchAISuggestionLoading.value = true;
  try {
    const shopOption = getShopOption(selectedShop.value);
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const result = await batchGetPotentialLinkMonitorAISuggestion({
      shopID: selectedShop.value,
      shopName: shopOption.label
    });

    if (result.success && result.data) {
      const status = result.data.status;
      if (status === "new") {
        ElMessage.success("新增AI任务，请等待");
      } else if (status === "running") {
        ElMessage.warning("正在执行同条件任务，请等待");
      } else if (status === "exists") {
        ElMessageBox.confirm(
          "已经获取AI建议，是否再次获取并覆盖之前建议？",
          "提示",
          {
            confirmButtonText: "确定",
            cancelButtonText: "取消",
            type: "warning"
          }
        )
          .then(async () => {
            // 用户确认覆盖，再次调用接口（可能需要force参数）
            const retryResult = await batchGetPotentialLinkMonitorAISuggestion({
              shopID: selectedShop.value,
              shopName: shopOption.label
            });
            if (retryResult.success) {
              ElMessage.success("已重新获取AI建议");
            }
          })
          .catch(() => {
            // 用户取消
          });
      }
    } else {
      throw new Error(result.error || result.message || "获取AI建议失败");
    }
  } catch (error: any) {
    console.error("批量获取AI建议失败:", error);
    ElMessage.error(error?.message || "批量获取AI建议失败，请稍后重试");
  } finally {
    batchAISuggestionLoading.value = false;
  }
}

/** 获取当天日期字符串（用于限制日期选择器） */
function getTodayDateString(): string {
  return dayjs().format("YYYY-MM-DD");
}

/** 规范化分类数据 */
function normalizeCategoryPayload(payload: any[]): string[] {
  return payload
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return (
          item.label ?? item.name ?? item.value ?? item.key ?? item.id ?? ""
        );
      }
      return "";
    })
    .map(text => (typeof text === "string" ? text.trim() : ""))
    .filter(Boolean);
}

/** 追加自定义分类选项 */
function appendCustomCategoryOptions(values: string[]) {
  if (!values.length) return;
  const existing = new Set(customCategoryOptions.value.map(opt => opt.value));
  let changed = false;
  values.forEach(value => {
    const trimmed = value.trim();
    if (!trimmed || existing.has(trimmed)) return;
    customCategoryOptions.value.push({ label: trimmed, value: trimmed });
    existing.add(trimmed);
    changed = true;
  });
  if (changed) {
    customCategoryOptions.value.sort((a, b) =>
      a.label.localeCompare(b.label, "zh-Hans-CN")
    );
  }
}

/** 从商品数据中提取分类 */
function extractCategoriesFromProducts(items: ProductCard[]): string[] {
  const collected: string[] = [];
  // 注意：ProductCard 类型可能不包含分类字段，这里需要根据实际情况调整
  // 如果后端返回的数据包含分类字段，需要更新 ProductCard 类型
  items.forEach(item => {
    // 如果商品数据中包含分类字段，在这里提取
    // 目前 ProductCard 类型中没有分类字段，所以这里暂时返回空数组
    // 实际使用时需要根据后端返回的数据结构调整
  });
  return collected;
}

/** 获取自定义分类选项 */
async function fetchCustomCategoryOptions() {
  if (!selectedShop.value) {
    return;
  }
  try {
    const result = await getCustomCategoryOptions({
      shopID: selectedShop.value
    });
    if (result.success && Array.isArray(result.data)) {
      appendCustomCategoryOptions(normalizeCategoryPayload(result.data));
    } else {
      throw new Error(result.error || result.message || "获取分类失败");
    }
  } catch (error: any) {
    console.error("获取自定义分类选项失败:", error);
    // 不显示错误提示，避免干扰用户操作
  }
}

/** 处理自定义分类变化 */
function handleCustomCategoryChange() {
  currentPage.value = 1;
  // 如果数据已经加载，可以在这里进行前端筛选
  // 或者重新调用 fetchData 从后端获取筛选后的数据
}

/** 处理店铺变化 */
function handleShopChange() {
  // 清空分类选项和选中分类
  customCategoryOptions.value = [];
  selectedCustomCategory.value = "";
  // 如果选择了店铺，则获取分类选项
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
  currentPage.value = 1;
}

// 监听店铺变化，重置分页和获取分类选项
watch(selectedShop, () => {
  handleShopChange();
});

onMounted(() => {
  // 初始化时获取自定义分类选项
  if (selectedShop.value) {
    fetchCustomCategoryOptions();
  }
  // 如果需要自动加载数据，取消下面的注释
  // fetchData();
});
</script>

<template>
  <div class="potential-monitor-page">
    <div class="controls">
      <el-button
        type="primary"
        :loading="batchAISuggestionLoading"
        style="margin-right: 12px"
        @click="batchGetAISuggestion"
        >为每条链接获取AI建议</el-button
      >
      <el-select
        v-model="selectedShop"
        placeholder="选择店铺"
        style="width: 200px; margin-right: 12px"
        @change="handleShopChange"
      >
        <el-option
          v-for="item in shopOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="selectedCustomCategory"
        placeholder="请选择自定义分类"
        clearable
        filterable
        style="width: 220px; margin-right: 12px"
        @change="handleCustomCategoryChange"
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
        icon="el-icon-refresh"
        @click="fetchData"
        >拉取数据</el-button
      >
    </div>

    <div class="cards">
      <el-card
        v-for="p in paginatedProducts"
        :key="p.id"
        class="prod-card"
        :class="{
          'warning-severe': p.warningLevel === '严重' && !isExpanded(p.id),
          'warning-normal': p.warningLevel === '一般' && !isExpanded(p.id)
        }"
      >
        <div class="card-row top">
          <div class="expand-icon" @click="toggleExpand(p.id)">
            <el-icon>
              <ArrowDown v-if="!isExpanded(p.id)" />
              <ArrowUp v-else />
            </el-icon>
          </div>
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
                class="warning-level-tag"
              >
                {{ p.warningLevel }}
              </el-tag>
            </div>
            <!-- 暂时隐藏模板生成的 message，未来显示AI生成的message -->
            <!-- <div
              v-if="p.warningMessages && p.warningMessages.length > 0"
              class="warning-messages"
            >
              <div
                v-for="(msg, idx) in p.warningMessages"
                :key="idx"
                class="warning-message-item"
              >
                <el-icon class="warning-icon"><Warning /></el-icon>
                <span>{{ msg }}</span>
              </div>
            </div> -->
          </div>
        </div>

        <div v-if="isExpanded(p.id)" class="expanded-content">
          <!-- 图表控制区域 -->
          <div class="chart-controls">
            <div class="control-group">
              <label class="control-label">日期范围：</label>
              <el-date-picker
                v-model="dateRangeMap[p.id]"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                :disabled-date="(date: Date) => date > new Date()"
                :shortcuts="getPickerShortcuts()"
                :disabled="chartLoadingMap[p.id] || false"
                style="width: 300px"
                @change="(val: [string, string] | null) => handleDateRangeChange(p.id, val)"
              />
            </div>
            <div class="control-group">
              <label class="control-label">显示指标：</label>
              <div class="checkbox-group">
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].visitors"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'visitors', val)"
                  >访客数</el-checkbox
                >
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].cartRate"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'cartRate', val)"
                  >加购率</el-checkbox
                >
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].conversionRate"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'conversionRate', val)"
                  >转化率</el-checkbox
                >
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].orderCount"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'orderCount', val)"
                  >订单量</el-checkbox
                >
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].buyerCount"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'buyerCount', val)"
                  >买家数</el-checkbox
                >
                <el-checkbox
                  v-model="visibleSeriesMap[p.id].gmv"
                  @change="(val: boolean) => handleVisibleSeriesChange(p.id, 'gmv', val)"
                  >GMV</el-checkbox
                >
              </div>
            </div>
          </div>

          <!-- 折线图 -->
          <div class="chart-section">
            <MonitorLineChart
              :data="chartDataMap[p.id] || null"
              :visible-series="getProductVisibleSeries(p.id)"
              :loading="chartLoadingMap[p.id] || false"
              :error="chartErrorMap[p.id] || undefined"
            />
          </div>

          <!-- 分析输入框 -->
          <div class="analysis-section">
            <div class="section-header">
              <label class="section-label">分析</label>
              <span class="char-count">
                {{ (getProductAnalysis(p.id) || '').length }}/10000
              </span>
            </div>
            <el-input
              v-model="analysisMap[p.id]"
              type="textarea"
              :rows="4"
              placeholder="请输入分析内容..."
              :maxlength="10000"
              show-word-limit
              @input="(val: string) => handleAnalysisChange(p.id, val)"
            />
            <div v-if="savingMap[p.id]" class="saving-indicator">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>保存中...</span>
            </div>
          </div>

          <!-- 改善方案输入框 -->
          <div class="improvement-section">
            <div class="section-header">
              <label class="section-label">改善方案</label>
              <span class="char-count">
                {{ (getProductImprovementPlan(p.id) || '').length }}/10000
              </span>
            </div>
            <el-input
              v-model="improvementPlanMap[p.id]"
              type="textarea"
              :rows="4"
              placeholder="请输入改善方案..."
              :maxlength="10000"
              show-word-limit
              @input="(val: string) => handleImprovementPlanChange(p.id, val)"
            />
            <div v-if="savingMap[p.id]" class="saving-indicator">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>保存中...</span>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 分页组件 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="() => (currentPage = 1)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.potential-monitor-page {
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
  flex-wrap: wrap;
  background: linear-gradient(
    120deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(108, 99, 255, 0.22) 55%,
    rgba(255, 110, 199, 0.2) 100%
  );
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding: 16px 0 8px;
}

.prod-card {
  position: relative;
  padding: 24px;
  border-radius: 24px;
  border: none;
  @include dopamine.dopamine-surface(24px);
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border 0.25s ease,
    background-color 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 24px 48px rgba(255, 110, 199, 0.28),
      0 16px 32px rgba(108, 99, 255, 0.22);
  }

  &.prod-followed {
    box-shadow:
      0 26px 54px rgba(108, 99, 255, 0.34),
      0 18px 36px rgba(45, 226, 230, 0.24);
    border: 1px solid rgba(108, 99, 255, 0.4);
  }

  // 根据警告级别设置背景色
  &.warning-severe {
    background-color: #ffebee !important;
    :deep(.el-card__body) {
      background-color: #ffebee !important;
    }
  }

  &.warning-normal {
    background-color: #fff3e0 !important;
    :deep(.el-card__body) {
      background-color: #fff3e0 !important;
    }
  }
}

.card-row.top {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.expand-icon {
  cursor: pointer;
  font-size: 20px;
  color: var(--dopamine-contrast);
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;

  &:hover {
    transform: scale(1.1);
  }
}

.left .prod-img {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 18px;
  box-shadow: 0 12px 24px rgba(31, 18, 53, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.left .prod-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dopamine-secondary);
  background: rgba(108, 99, 255, 0.1);
}

.meta {
  flex: 1;
  min-width: 240px;
}

.meta .id {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 6px;
  letter-spacing: 0.3px;
}

.meta .name {
  font-size: 18px;
  font-weight: 600;
  color: var(--dopamine-contrast);
  margin-bottom: 10px;
}

.warn-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.warning-messages {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warning-message-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #7a4b0f;
  @include dopamine.dopamine-chip(#ffd33d);
}

.warning-icon {
  color: #ff9b6a;
  font-size: 18px;
  margin-top: 2px;
  flex-shrink: 0;
}

.expanded-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 20px;
}

.chart-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(45, 226, 230, 0.16) 45%,
    rgba(108, 99, 255, 0.12) 100%
  );
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 22px rgba(31, 18, 53, 0.12);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--dopamine-soft-ink);
  white-space: nowrap;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.chart-section {
  width: 100%;
  min-height: 400px;
  padding: 16px;
  border-radius: 12px;
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(45, 226, 230, 0.16) 45%,
    rgba(108, 99, 255, 0.12) 100%
  );
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 22px rgba(31, 18, 53, 0.12);
}

.analysis-section,
.improvement-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--dopamine-soft-ink);
}

.char-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.saving-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.metric-block {
  border-radius: 20px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: linear-gradient(
    140deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(45, 226, 230, 0.16) 45%,
    rgba(108, 99, 255, 0.12) 100%
  );
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 22px rgba(31, 18, 53, 0.12);
}

.metric-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dopamine-soft-ink);
  margin-bottom: 12px;
  text-align: left;
}

.metric-values {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.metric-value {
  padding: 8px 12px;
  border-radius: 12px;
  min-width: 76px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--dopamine-contrast);
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 6px 12px rgba(31, 18, 53, 0.12);
}

.volatility-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.volatility-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  border: 2px solid;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 6px 14px rgba(31, 18, 53, 0.12);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.volatility-item.volatility-subtle {
  opacity: 0.72;
  border-width: 1px;
  box-shadow: none;
}

.volatility-item.volatility-highlight {
  transform: scale(1.05);
  box-shadow: 0 12px 24px rgba(255, 110, 199, 0.28);
}

.volatility-window {
  font-weight: 700;
  font-size: 12px;
  min-width: 36px;
}

.volatility-direction {
  font-size: 18px;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

.volatility-strength {
  font-weight: 600;
  font-size: 14px;
  min-width: 58px;
}

.volatility-level {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.6);
}

:deep(.el-button--primary) {
  @include dopamine.dopamine-primary-button();
}

:deep(.el-button--default) {
  @include dopamine.dopamine-ghost-button();
}

:deep(.el-tag) {
  border-radius: 999px;
  padding-inline: 14px;
  font-weight: 600;
}

:deep(.warning-level-tag) {
  font-size: 16px !important;
  padding: 10px 20px !important;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

:deep(.el-dialog__body) {
  background: rgba(255, 255, 255, 0.9);
  color: var(--dopamine-contrast);
}

@media (max-width: 1024px) {
  .potential-monitor-page {
    padding: 24px 20px;
  }

  .controls {
    justify-content: center;
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .potential-monitor-page {
    padding: 20px 16px;
  }

  .card-row.top {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .metrics {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }

  .left .prod-img {
    width: 100%;
    height: auto;
    max-width: 220px;
  }
}
</style>
