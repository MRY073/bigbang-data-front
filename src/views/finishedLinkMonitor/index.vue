<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage, ElLoading, ElDialog } from "element-plus";
import { Loading, Warning } from "@element-plus/icons-vue";
import type { LoadingInstance } from "element-plus";
import dayjs from "dayjs";
import {
  getFinishedLinkMonitorList,
  getFinishedLinkMonitorAISuggestion
} from "@/api/monitor";
import { getCustomCategoryOptions } from "@/api/productItems";

defineOptions({ name: "FinishedLinkMonitor" });

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
  visitorsAvg: number[];
  visitorsVolatilityBaseline: Volatility[];
  adCostAvg: number[];
  adCostVolatilityBaseline: Volatility[];
  salesAvg: number[];
  salesVolatilityBaseline: Volatility[];
  warningLevel: WarningLevel;
  warningMessages?: string[];
  // 自定义分类字段（如果后端返回）
  custom_category_1?: string | null;
  custom_category_2?: string | null;
  custom_category_3?: string | null;
  custom_category_4?: string | null;
};

const products = ref<ProductCard[]>([]);
const loading = ref(false);
const selectedShop = ref<string>("1489850435"); // 默认选择第一个店铺
const selectedDate = ref<string>(dayjs().format("YYYY-MM-DD")); // 默认选择今天

// AI建议相关
const aiSuggestionDialog = ref(false);
const aiSuggestionContent = ref("");
const aiSuggestionLoading = ref(false);
const currentProductId = ref<string>("");

// 分页相关
const currentPage = ref(1);
const pageSize = ref(10);

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
  1: "#E91E63", // 更深的粉红色
  3: "#FF5722", // 更深的橙红色
  7: "#FFC107", // 更深的黄色
  15: "#3F51B5", // 更深的蓝色
  30: "#00BCD4" // 更深的青色
};

/** 变化等级颜色 */
const levelColors: Record<ChangeLevel, string> = {
  极小: "#3F51B5", // 更深的蓝色
  轻微: "#00BCD4", // 更深的青色
  一般: "#FF5722", // 更深的橙红色
  明显: "#E91E63", // 更深的粉红色
  剧烈: "#C2185B" // 更深的深粉红色
};

/** 方向颜色 */
const directionColors = {
  "+": "#00BCD4", // 更深的青色
  "-": "#E91E63" // 更深的粉红色
};

function loadMockData() {
  products.value = [
    {
      id: "SKU-1001",
      name: "成品 — 舒适运动鞋",
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
      name: "成品 — 高端皮带",
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
      name: "成品 — 电子秤（热销）",
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
      name: "成品 — 夏季连衣裙",
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
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }
    const params: any = {
      shopID: selectedShop.value,
      shopName: shopOption.label,
      date: selectedDate.value
    };
    // 如果选择了自定义分类，添加到请求参数中
    if (selectedCustomCategory.value) {
      params.customCategory = selectedCustomCategory.value;
    }
    const result = await getFinishedLinkMonitorList(params);
    if (result.success && result.data) {
      // 规范化数据，确保每个产品都有必要的字段
      products.value = (result.data || []).map((item: ProductCard) => ({
        ...item,
        visitorsVolatilityBaseline: item.visitorsVolatilityBaseline || [],
        adCostVolatilityBaseline: item.adCostVolatilityBaseline || [],
        salesVolatilityBaseline: item.salesVolatilityBaseline || [],
        warningMessages: item.warningMessages || []
      }));
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
    loadMockData();
    ElMessage.info("使用本地示例数据（后端接口未就绪）");
    // 数据加载后重置到第一页
    currentPage.value = 1;
  } finally {
    loader.close();
    loading.value = false;
  }
}

/** 获取AI建议 */
async function getAISuggestion(productId: string, productName: string) {
  currentProductId.value = productId;
  aiSuggestionDialog.value = true;
  aiSuggestionContent.value = "";
  aiSuggestionLoading.value = true;

  try {
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }

    const result = await getFinishedLinkMonitorAISuggestion({
      shopID: selectedShop.value,
      shopName: shopOption.label,
      date: selectedDate.value,
      productID: productId,
      productName: productName
    });

    if (result.success && result.data) {
      aiSuggestionContent.value = result.data.suggestion || "暂无建议";
    } else {
      throw new Error(result.error || result.message || "获取AI建议失败");
    }
  } catch (error: any) {
    console.error("获取AI建议失败:", error);
    ElMessage.error(error?.message || "获取AI建议失败，请稍后重试");
    aiSuggestionContent.value = "获取AI建议失败，请稍后重试";
  } finally {
    aiSuggestionLoading.value = false;
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
  items.forEach(item => {
    categoryFields.forEach(field => {
      const value = (item as any)[field];
      if (typeof value === "string" && value.trim()) {
        collected.push(value.trim());
      }
    });
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
  <div class="finished-monitor-page">
    <div class="controls">
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
      <el-date-picker
        v-model="selectedDate"
        type="date"
        placeholder="选择日期"
        value-format="YYYY-MM-DD"
        :disabled-date="(date: Date) => date > new Date()"
        style="width: 200px; margin-right: 12px"
      />
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
            </div>
            <div
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
            </div>
          </div>

          <!-- 右侧关注开关 -->
          <div class="follow-area">
            <el-button
              type="primary"
              size="small"
              :loading="aiSuggestionLoading && currentProductId === p.id"
              style="margin-right: 12px"
              @click="getAISuggestion(p.id, p.name)"
            >
              获取AI建议
            </el-button>
            <el-switch
              :model-value="isFollowed(p.id)"
              active-text="已关注"
              inactive-text="未关注"
              @change="val => toggleFollow(p.id, !!val)"
            />
            <div v-if="isFollowed(p.id)" class="follow-time">
              {{ followTimeText(p.id) }}
            </div>
            <!-- <div v-if="isFollowed(p.id)" class="follow-time">
              {{ followTimeText(p.id) }}
            </div> -->
          </div>
        </div>

        <div class="metrics">
          <div class="metric-block">
            <div class="metric-title">日均访客(30/15/7/3/1日)</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.visitorsAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >{{ formatNumber(v) }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">访客数短期波动相对长期基准(60)指标</div>
            <div class="metric-values volatility-values">
              <span
                v-for="window in WINDOWS.filter(w => w !== 1)"
                :key="window"
                class="volatility-item"
                :class="{
                  'volatility-highlight':
                    p.visitorsVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '明显' ||
                    p.visitorsVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '剧烈',
                  'volatility-subtle':
                    p.visitorsVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '极小' ||
                    p.visitorsVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '轻微' ||
                    p.visitorsVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '一般'
                }"
                :style="{
                  borderColor: WINDOW_COLORS[window],
                  backgroundColor: WINDOW_COLORS[window] + '40'
                }"
              >
                <template
                  v-if="
                    p.visitorsVolatilityBaseline &&
                    p.visitorsVolatilityBaseline.find(v => v.window === window)
                  "
                >
                  <template
                    v-for="vol in p.visitorsVolatilityBaseline.filter(
                      v => v.window === window
                    )"
                    :key="vol.window"
                  >
                    <span
                      class="volatility-window"
                      :style="{ color: '#000000' }"
                    >
                      {{ window }}天
                    </span>
                    <span
                      class="volatility-direction"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ vol.direction === "+" ? "↑" : "↓" }}
                    </span>
                    <span
                      class="volatility-strength"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ formatVolatilityStrength(vol.strength) }}%
                    </span>
                    <span
                      class="volatility-level"
                      :style="{
                        color: '#000000',
                        backgroundColor: levelColors[vol.level] || '#6b7280'
                      }"
                    >
                      [{{ vol.level }}]
                    </span>
                  </template>
                </template>
              </span>
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">日均广告花费(30/15/7/3/1日)</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.adCostAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >{{ formatNumber(v) }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">广告花费短期波动相对长期基准(60)指标</div>
            <div class="metric-values volatility-values">
              <span
                v-for="window in WINDOWS.filter(w => w !== 1)"
                :key="window"
                class="volatility-item"
                :class="{
                  'volatility-highlight':
                    p.adCostVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '明显' ||
                    p.adCostVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '剧烈',
                  'volatility-subtle':
                    p.adCostVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '极小' ||
                    p.adCostVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '轻微' ||
                    p.adCostVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '一般'
                }"
                :style="{
                  borderColor: WINDOW_COLORS[window],
                  backgroundColor: WINDOW_COLORS[window] + '40'
                }"
              >
                <template
                  v-if="
                    p.adCostVolatilityBaseline &&
                    p.adCostVolatilityBaseline.find(v => v.window === window)
                  "
                >
                  <template
                    v-for="vol in p.adCostVolatilityBaseline.filter(
                      v => v.window === window
                    )"
                    :key="vol.window"
                  >
                    <span
                      class="volatility-window"
                      :style="{ color: '#000000' }"
                    >
                      {{ window }}天
                    </span>
                    <span
                      class="volatility-direction"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ vol.direction === "+" ? "↑" : "↓" }}
                    </span>
                    <span
                      class="volatility-strength"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ formatVolatilityStrength(vol.strength) }}%
                    </span>
                    <span
                      class="volatility-level"
                      :style="{
                        color: '#000000',
                        backgroundColor: levelColors[vol.level] || '#6b7280'
                      }"
                    >
                      [{{ vol.level }}]
                    </span>
                  </template>
                </template>
              </span>
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">日均销售额(30/15/7/3/1日)</div>
            <div class="metric-values">
              <span
                v-for="(v, i) in p.salesAvg"
                :key="i"
                :class="['metric-value', 'c' + i]"
                >{{ formatNumberWithLocale(v) }}</span
              >
            </div>
          </div>

          <div class="metric-block">
            <div class="metric-title">销售额短期波动相对长期基准(60)指标</div>
            <div class="metric-values volatility-values">
              <span
                v-for="window in WINDOWS.filter(w => w !== 1)"
                :key="window"
                class="volatility-item"
                :class="{
                  'volatility-highlight':
                    p.salesVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '明显' ||
                    p.salesVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '剧烈',
                  'volatility-subtle':
                    p.salesVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '极小' ||
                    p.salesVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '轻微' ||
                    p.salesVolatilityBaseline?.find(v => v.window === window)
                      ?.level === '一般'
                }"
                :style="{
                  borderColor: WINDOW_COLORS[window],
                  backgroundColor: WINDOW_COLORS[window] + '40'
                }"
              >
                <template
                  v-if="
                    p.salesVolatilityBaseline &&
                    p.salesVolatilityBaseline.find(v => v.window === window)
                  "
                >
                  <template
                    v-for="vol in p.salesVolatilityBaseline.filter(
                      v => v.window === window
                    )"
                    :key="vol.window"
                  >
                    <span
                      class="volatility-window"
                      :style="{ color: '#000000' }"
                    >
                      {{ window }}天
                    </span>
                    <span
                      class="volatility-direction"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ vol.direction === "+" ? "↑" : "↓" }}
                    </span>
                    <span
                      class="volatility-strength"
                      :style="{
                        color: '#000000'
                      }"
                    >
                      {{ formatVolatilityStrength(vol.strength) }}%
                    </span>
                    <span
                      class="volatility-level"
                      :style="{
                        color: '#FFFFFF',
                        backgroundColor: levelColors[vol.level] || '#6b7280'
                      }"
                    >
                      [{{ vol.level }}]
                    </span>
                  </template>
                </template>
              </span>
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

    <!-- AI建议对话框 -->
    <el-dialog
      v-model="aiSuggestionDialog"
      title="AI建议"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="aiSuggestionLoading" style="text-align: center; padding: 20px">
        <el-icon class="is-loading" style="font-size: 24px">
          <Loading />
        </el-icon>
        <p style="margin-top: 10px">AI正在分析中...</p>
      </div>
      <div
        v-else
        style="
          white-space: pre-wrap;
          line-height: 1.6;
          color: #303133;
          max-height: 400px;
          overflow-y: auto;
        "
      >
        {{ aiSuggestionContent || "暂无建议" }}
      </div>
      <template #footer>
        <el-button @click="aiSuggestionDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.finished-monitor-page {
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
    border 0.25s ease;

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
}

.card-row.top {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
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

.follow-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  min-width: 160px;
  position: relative;
}

.follow-time {
  font-size: 12px;
  color: var(--dopamine-soft-ink);
  background: rgba(255, 255, 255, 0.8);
  padding: 4px 10px;
  border-radius: 10px;
  box-shadow: 0 10px 18px rgba(31, 18, 53, 0.15);
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

:deep(.el-dialog__body) {
  background: rgba(255, 255, 255, 0.9);
  color: var(--dopamine-contrast);
}

@media (max-width: 1024px) {
  .finished-monitor-page {
    padding: 24px 20px;
  }

  .controls {
    justify-content: center;
    gap: 12px;
  }

  .follow-area {
    width: 100%;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .finished-monitor-page {
    padding: 20px 16px;
  }

  .card-row.top {
    flex-direction: column;
    align-items: flex-start;
  }

  .follow-area {
    align-items: stretch;
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
