<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "ProductStageManual" });

// 阶段类型定义（与后端接口一致）
type StageType = "testing" | "potential" | "product" | "abandoned";

// 阶段时间段对象
type StageTimeRange = {
  start_time: string | null;
  end_time: string | null;
};

// 后端返回的商品数据结构
type BackendProduct = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage: StageTimeRange;
  potential_stage: StageTimeRange;
  product_stage: StageTimeRange;
  abandoned_stage: StageTimeRange;
};

// 前端使用的商品行数据
type ProductRow = {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  potential_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  product_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  abandoned_stage: {
    start_time: string | null;
    end_time: string | null;
  };
  // 保存状态
  savingFlags: Record<StageType, boolean>;
  // computed at runtime
  currentStage?: StageType | null;
};

// 阶段类型映射
const stageTypeMap: Record<StageType, string> = {
  testing: "测款阶段",
  potential: "潜力阶段",
  product: "成品阶段",
  abandoned: "放弃阶段"
};

// 筛选阶段类型（包含"全部"选项）
type FilterStageType = "all" | StageType;

const products = ref<ProductRow[]>([]);
const pageLoading = ref(false);
const filterStage = ref<FilterStageType>("all");
const selectedShop = ref<string>("1489850435"); // 默认选择第一个店铺

// 产品筛选条件（输入框的值，不触发筛选）
const productIdFilter = ref<string>("");
const productNameFilter = ref<string>("");

// 实际应用的筛选条件（用于筛选逻辑）
const appliedProductIdFilter = ref<string>("");
const appliedProductNameFilter = ref<string>("");

// 分页相关
const currentPage = ref(1); // 当前页码
const pageSize = ref(20); // 每页显示数量
const pageSizes = [10, 20, 50, 100, 200]; // 每页数量选项

// 排序相关
type SortOrder = "default" | "asc" | "desc";
const currentStageSort = ref<SortOrder>("default");

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

// 接口地址
const API_GET_PRODUCTS = "/api/products";
const API_UPDATE_STAGE = "/api/products/stage";

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

/**
 * 将 ISO 8601 格式字符串转换为日期时间选择器可用的格式
 * @param isoString ISO 8601 格式字符串，如 "2025-01-01T00:00:00.000Z"
 * @returns 日期时间字符串，如 "2025-01-01 00:00:00"，如果输入为 null 则返回 null
 */
function isoToDateTime(isoString: string | null): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return null;
  }
}

/**
 * 将日期时间字符串转换为 ISO 8601 格式
 * @param dateTimeString 日期时间字符串，如 "2025-01-01 00:00:00"
 * @returns ISO 8601 格式字符串，如 "2025-01-01T00:00:00.000Z"，如果输入为 null 或空则返回 null
 */
function dateTimeToIso(dateTimeString: string | null): string | null {
  if (!dateTimeString || dateTimeString.trim() === "") return null;
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * 检查时间段是否重叠
 * @param timeRange1 时间段1
 * @param timeRange2 时间段2
 * @returns 是否重叠
 */
function isTimeRangeOverlap(
  timeRange1: { start_time: string | null; end_time: string | null },
  timeRange2: { start_time: string | null; end_time: string | null }
): boolean {
  // 如果任一时间段为空，则不重叠
  if (
    !timeRange1.start_time ||
    !timeRange1.end_time ||
    !timeRange2.start_time ||
    !timeRange2.end_time
  ) {
    return false;
  }

  try {
    const start1 = dateTimeToIso(timeRange1.start_time);
    const end1 = dateTimeToIso(timeRange1.end_time);
    const start2 = dateTimeToIso(timeRange2.start_time);
    const end2 = dateTimeToIso(timeRange2.end_time);

    if (!start1 || !end1 || !start2 || !end2) {
      return false;
    }

    const date1Start = new Date(start1);
    const date1End = new Date(end1);
    const date2Start = new Date(start2);
    const date2End = new Date(end2);

    // 检查是否重叠：时间段1的开始时间在时间段2内，或时间段1的结束时间在时间段2内，或时间段1完全包含时间段2
    return (
      (date1Start >= date2Start && date1Start <= date2End) ||
      (date1End >= date2Start && date1End <= date2End) ||
      (date1Start <= date2Start && date1End >= date2End)
    );
  } catch {
    return false;
  }
}

/**
 * 校验所有阶段时间段是否重叠
 * @param row 商品行数据
 * @returns 返回重叠的阶段对，如果没有重叠则返回空数组
 */
function validateStageTimeRanges(
  row: ProductRow
): Array<[StageType, StageType]> {
  const stages: StageType[] = ["testing", "potential", "product", "abandoned"];
  const overlaps: Array<[StageType, StageType]> = [];

  for (let i = 0; i < stages.length; i++) {
    for (let j = i + 1; j < stages.length; j++) {
      const stage1 = stages[i];
      const stage2 = stages[j];
      const timeRange1 = row[
        `${stage1}_stage` as keyof ProductRow
      ] as StageTimeRange;
      const timeRange2 = row[
        `${stage2}_stage` as keyof ProductRow
      ] as StageTimeRange;

      if (isTimeRangeOverlap(timeRange1, timeRange2)) {
        overlaps.push([stage1, stage2]);
      }
    }
  }

  return overlaps;
}

/**
 * 计算商品当前所处的阶段
 */
function computeCurrentStageForRow(row: ProductRow): StageType | null {
  const today = new Date();
  // priority: abandoned -> product -> potential -> testing
  const order: StageType[] = ["abandoned", "product", "potential", "testing"];
  for (const stageType of order) {
    const stage = row[
      `${stageType}_stage` as keyof ProductRow
    ] as StageTimeRange;
    if (stage?.start_time && stage?.end_time) {
      try {
        // 将本地格式转换为ISO格式后再解析，确保日期解析正确
        const startTimeIso = dateTimeToIso(stage.start_time);
        const endTimeIso = dateTimeToIso(stage.end_time);
        if (startTimeIso && endTimeIso) {
          const start = new Date(startTimeIso);
          const end = new Date(endTimeIso);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            if (start <= today && today <= end) return stageType;
          }
        }
      } catch {
        // 忽略日期解析错误
      }
    }
  }
  return null;
}

/**
 * 初始化商品列表数据
 */
function initProducts(backendProducts: BackendProduct[]) {
  products.value = backendProducts.map(item => {
    const row: ProductRow = {
      product_id: item.product_id,
      product_name: item.product_name,
      product_image: item.product_image,
      testing_stage: {
        start_time: isoToDateTime(item.testing_stage?.start_time || null),
        end_time: isoToDateTime(item.testing_stage?.end_time || null)
      },
      potential_stage: {
        start_time: isoToDateTime(item.potential_stage?.start_time || null),
        end_time: isoToDateTime(item.potential_stage?.end_time || null)
      },
      product_stage: {
        start_time: isoToDateTime(item.product_stage?.start_time || null),
        end_time: isoToDateTime(item.product_stage?.end_time || null)
      },
      abandoned_stage: {
        start_time: isoToDateTime(item.abandoned_stage?.start_time || null),
        end_time: isoToDateTime(item.abandoned_stage?.end_time || null)
      },
      savingFlags: {
        testing: false,
        potential: false,
        product: false,
        abandoned: false
      },
      currentStage: null
    };
    row.currentStage = computeCurrentStageForRow(row);
    return row;
  });
}

/** 拉取数据（仅手动触发） */
async function fetchData() {
  debugger; // 1. 函数入口
  console.log("=== fetchData 开始 ===");
  console.log("selectedShop.value:", selectedShop.value);

  if (!selectedShop.value) {
    debugger; // 2. 店铺ID为空
    ElMessage.warning("请先选择店铺");
    return;
  }

  debugger; // 3. 店铺ID验证通过
  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");

  try {
    // 将店铺ID和店铺名称作为查询参数传递
    debugger; // 4. 开始构建URL
    const shopOption = shopOptions.find(
      opt => opt.value === selectedShop.value
    );
    if (!shopOption) {
      throw new Error("店铺信息不存在");
    }
    const url = new URL(API_GET_PRODUCTS, window.location.origin);
    url.searchParams.append("shopID", selectedShop.value);
    url.searchParams.append("shopName", shopOption.label);
    const requestUrl = url.toString();
    console.log("请求URL:", requestUrl);
    console.log("API_GET_PRODUCTS:", API_GET_PRODUCTS);
    console.log("window.location.origin:", window.location.origin);

    debugger; // 5. 发送fetch请求前
    const res = await fetch(requestUrl);
    console.log("响应状态:", res.status, res.statusText);
    console.log("响应headers:", res.headers);

    debugger; // 6. fetch响应后
    if (!res.ok) {
      debugger; // 7. HTTP状态错误
      const errorText = await res.text();
      console.error("HTTP错误响应内容:", errorText);
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    debugger; // 8. 开始解析JSON
    const result = await res.json();
    console.log("接口返回结果:", result);
    console.log("result.success:", result.success);
    console.log("result.data:", result.data);
    console.log(
      "result.data类型:",
      Array.isArray(result.data) ? "数组" : typeof result.data
    );
    if (result.data && Array.isArray(result.data)) {
      console.log("result.data长度:", result.data.length);
      if (result.data.length > 0) {
        console.log("第一个商品数据:", result.data[0]);
      }
    }

    debugger; // 9. JSON解析完成
    if (result.success && result.data) {
      debugger; // 10. 数据验证通过，准备初始化
      console.log("准备调用 initProducts，数据:", result.data);
      initProducts(result.data);
      console.log("initProducts 完成，products.value:", products.value);
      // 重置到第一页
      currentPage.value = 1;
      ElMessage.success(
        result.message || `数据拉取成功，共 ${products.value.length} 条`
      );
    } else {
      debugger; // 11. 数据验证失败
      console.error("数据验证失败:", {
        success: result.success,
        hasData: !!result.data,
        error: result.error,
        message: result.message
      });
      throw new Error(result.error || result.message || "查询失败");
    }
  } catch (error: any) {
    debugger; // 12. 捕获到错误
    console.error("=== fetchData 错误 ===");
    console.error("错误类型:", error?.constructor?.name);
    console.error("错误消息:", error?.message);
    console.error("错误堆栈:", error?.stack);
    console.error("完整错误对象:", error);
    ElMessage.error(error?.message || "网络连接失败，请检查网络后重试");
    // 清空数据
    products.value = [];
  } finally {
    debugger; // 13. finally清理
    console.log("=== fetchData 结束 ===");
    loader.close();
    pageLoading.value = false;
  }
}

/**
 * 更新单个阶段的时间段（内部函数，用于并行保存）
 */
async function updateSingleStage(
  productId: string,
  stageType: StageType,
  startTime: string | null,
  endTime: string | null
): Promise<void> {
  const shopOption = shopOptions.find(opt => opt.value === selectedShop.value);
  if (!shopOption) {
    throw new Error("店铺信息不存在");
  }

  const startTimeIso = dateTimeToIso(startTime);
  const endTimeIso = dateTimeToIso(endTime);

  const response = await fetch(API_UPDATE_STAGE, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      product_id: productId,
      shopID: selectedShop.value,
      shopName: shopOption.label,
      stage_type: stageType,
      start_time: startTimeIso,
      end_time: endTimeIso
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || result.message || "更新失败");
  }
}

/**
 * 保存商品的所有阶段
 */
async function saveProductStages(productId: string) {
  if (!selectedShop.value) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  // 找到对应的商品行
  const row = products.value.find(r => r.product_id === productId);
  if (!row) {
    ElMessage.error("商品不存在");
    return;
  }

  // 校验时间段是否重叠
  const overlaps = validateStageTimeRanges(row);
  if (overlaps.length > 0) {
    const overlapNames = overlaps
      .map(([s1, s2]) => `${stageTypeMap[s1]}和${stageTypeMap[s2]}`)
      .join("、");
    ElMessage.error(
      `时间段重叠：${overlapNames}的时间段存在重叠，请检查后重试`
    );
    return;
  }

  // 设置所有阶段的保存状态
  const allStages: StageType[] = [
    "testing",
    "potential",
    "product",
    "abandoned"
  ];
  allStages.forEach(stageType => {
    row.savingFlags[stageType] = true;
  });

  try {
    // 使用 Promise.all 并行保存所有4个阶段
    const savePromises = allStages.map(stageType => {
      const stage = row[
        `${stageType}_stage` as keyof ProductRow
      ] as StageTimeRange;
      return updateSingleStage(
        productId,
        stageType,
        stage.start_time,
        stage.end_time
      );
    });

    await Promise.all(savePromises);

    // 重新计算当前阶段
    row.currentStage = computeCurrentStageForRow(row);

    ElMessage.success("保存成功");
  } catch (error: any) {
    console.error("保存阶段失败:", error);
    ElMessage.error(error?.message || "保存失败，请检查网络后重试");
  } finally {
    // 清除所有保存状态
    allStages.forEach(stageType => {
      row.savingFlags[stageType] = false;
    });
  }
}

/** 过滤后的产品列表（先过滤阶段和产品ID/名称，再排序，最后分页） */
const filteredProducts = computed(() => {
  // 先根据阶段筛选
  let filtered: ProductRow[];
  if (filterStage.value === "all") {
    filtered = products.value;
  } else {
    const stageType = filterStage.value as StageType;
    // 只保留那些在该阶段有时间段或当前阶段为该阶段
    filtered = products.value.filter(row => {
      const stage = row[
        `${stageType}_stage` as keyof ProductRow
      ] as StageTimeRange;
      const hasRange = stage?.start_time && stage?.end_time;
      const isCurrent = row.currentStage === stageType;
      return hasRange || isCurrent;
    });
  }

  // 根据产品ID筛选
  if (appliedProductIdFilter.value.trim()) {
    const idFilter = appliedProductIdFilter.value.trim().toLowerCase();
    filtered = filtered.filter(row =>
      row.product_id.toLowerCase().includes(idFilter)
    );
  }

  // 根据产品名称筛选
  if (appliedProductNameFilter.value.trim()) {
    const nameFilter = appliedProductNameFilter.value.trim().toLowerCase();
    filtered = filtered.filter(row =>
      row.product_name.toLowerCase().includes(nameFilter)
    );
  }

  // 按当前阶段字符串排序
  if (currentStageSort.value !== "default") {
    filtered = [...filtered].sort((a, b) => {
      const stageA = a.currentStage || "";
      const stageB = b.currentStage || "";

      // 没有当前阶段的排在最后
      if (!stageA && !stageB) return 0;
      if (!stageA) return 1;
      if (!stageB) return -1;

      // 按阶段字符串排序
      if (currentStageSort.value === "asc") {
        return stageA.localeCompare(stageB);
      } else {
        return stageB.localeCompare(stageA);
      }
    });
  }

  // 然后进行分页
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filtered.slice(start, end);
});

/** 过滤后的总数（用于分页显示） */
const filteredTotal = computed(() => {
  // 先根据阶段筛选
  let filtered: ProductRow[];
  if (filterStage.value === "all") {
    filtered = products.value;
  } else {
    const stageType = filterStage.value as StageType;
    filtered = products.value.filter(row => {
      const stage = row[
        `${stageType}_stage` as keyof ProductRow
      ] as StageTimeRange;
      const hasRange = stage?.start_time && stage?.end_time;
      const isCurrent = row.currentStage === stageType;
      return hasRange || isCurrent;
    });
  }

  // 根据产品ID筛选
  if (appliedProductIdFilter.value.trim()) {
    const idFilter = appliedProductIdFilter.value.trim().toLowerCase();
    filtered = filtered.filter(row =>
      row.product_id.toLowerCase().includes(idFilter)
    );
  }

  // 根据产品名称筛选
  if (appliedProductNameFilter.value.trim()) {
    const nameFilter = appliedProductNameFilter.value.trim().toLowerCase();
    filtered = filtered.filter(row =>
      row.product_name.toLowerCase().includes(nameFilter)
    );
  }

  return filtered.length;
});

/** 处理页码变化 */
function handleCurrentChange(page: number) {
  currentPage.value = page;
}

/** 处理每页数量变化 */
function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1; // 重置到第一页
}

/** 点击复制 id/name */
async function copyToClipboard(text: string) {
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

/** 执行筛选 */
function handleFilter() {
  // 将输入框的值应用到筛选条件
  appliedProductIdFilter.value = productIdFilter.value;
  appliedProductNameFilter.value = productNameFilter.value;
  // 重置到第一页
  currentPage.value = 1;
}

/** 取消筛选 */
function handleClearFilter() {
  // 清空输入框的值
  productIdFilter.value = "";
  productNameFilter.value = "";
  // 清空应用的筛选条件
  appliedProductIdFilter.value = "";
  appliedProductNameFilter.value = "";
  // 重置到第一页
  currentPage.value = 1;
}

/** 切换当前时段排序 */
function toggleCurrentStageSort() {
  if (currentStageSort.value === "default") {
    currentStageSort.value = "asc";
  } else if (currentStageSort.value === "asc") {
    currentStageSort.value = "desc";
  } else {
    currentStageSort.value = "default";
  }
  // 重置到第一页
  currentPage.value = 1;
}
</script>

<template>
  <div class="product-stage-page">
    <el-card class="stage-card">
      <div class="card-header">
        <div class="left">
          <el-select
            v-model="filterStage"
            placeholder="筛选阶段"
            style="width: 220px"
          >
            <el-option label="全部" value="all" />
            <el-option label="测款阶段" value="testing" />
            <el-option label="潜力阶段" value="potential" />
            <el-option label="成品阶段" value="product" />
            <el-option label="放弃阶段" value="abandoned" />
          </el-select>
        </div>

        <div class="actions">
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
            :loading="pageLoading"
            icon="el-icon-refresh"
            @click="fetchData"
            >拉取数据</el-button
          >
        </div>
      </div>

      <!-- 产品筛选区域 -->
      <div class="filter-section">
        <div class="filter-inputs">
          <el-input
            v-model="productIdFilter"
            placeholder="产品ID"
            clearable
            style="width: 200px; margin-right: 12px"
          />
          <el-input
            v-model="productNameFilter"
            placeholder="产品名称"
            clearable
            style="width: 200px; margin-right: 12px"
          />
        </div>
        <div class="filter-buttons">
          <el-button type="primary" @click="handleFilter">筛选</el-button>
          <el-button @click="handleClearFilter">取消筛选</el-button>
        </div>
      </div>

      <div class="table-wrapper">
        <el-table
          :data="filteredProducts"
          stripe
          style="width: 100%"
          :row-key="row => row.product_id"
          :row-class-name="
            ({ row }) =>
              row.currentStage === 'abandoned' ? 'row-abandoned' : ''
          "
          :max-height="600"
        >
          <!-- 当前阶段 - 移到最前面 -->
          <el-table-column
            prop="currentStage"
            label="当前阶段"
            width="140"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #header>
              <div class="sortable-header" @click="toggleCurrentStageSort">
                <span>当前阶段</span>
                <span class="sort-icon">
                  <span v-if="currentStageSort === 'default'">⇅</span>
                  <span v-else-if="currentStageSort === 'asc'">↑</span>
                  <span v-else>↓</span>
                </span>
              </div>
            </template>
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  v-if="row.currentStage"
                  :class="`current-badge stage-${row.currentStage}`"
                  >{{
                    stageTypeMap[row.currentStage] || row.currentStage
                  }}</span
                >
                <span v-else class="dash">-</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_id"
            label="产品ID"
            width="160"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  class="plain-text"
                  title="点击复制"
                  @click.stop="copyToClipboard(row.product_id)"
                  >{{ row.product_id }}</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_name"
            label="产品名称"
            width="300"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <span
                  class="plain-text"
                  title="点击复制"
                  @click.stop="copyToClipboard(row.product_name)"
                  >{{ row.product_name }}</span
                >
              </div>
            </template>
          </el-table-column>

          <el-table-column
            prop="product_image"
            label="产品主图"
            width="120"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="cell-center">
                <img
                  v-if="row.product_image"
                  :src="row.product_image"
                  alt="主图"
                  class="thumb"
                />
                <div v-else class="no-img">无图</div>
              </div>
            </template>
          </el-table-column>

          <!-- 操作列 - 保存按钮 -->
          <el-table-column
            label="操作"
            width="120"
            align="center"
            header-align="center"
            fixed="left"
          >
            <template #default="{ row }">
              <div class="save-actions">
                <el-button
                  type="primary"
                  size="small"
                  :loading="
                    row.savingFlags.testing ||
                    row.savingFlags.potential ||
                    row.savingFlags.product ||
                    row.savingFlags.abandoned
                  "
                  @click="saveProductStages(row.product_id)"
                  >保存</el-button
                >
              </div>
            </template>
          </el-table-column>

          <!-- 测款阶段 -->
          <el-table-column
            label="测款阶段"
            width="280"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <div class="stage-editor">
                <div class="time-picker-group">
                  <el-date-picker
                    v-model="row.testing_stage.start_time"
                    type="datetime"
                    placeholder="开始时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px; margin-bottom: 8px"
                  />
                  <el-date-picker
                    v-model="row.testing_stage.end_time"
                    type="datetime"
                    placeholder="结束时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px"
                  />
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 潜力阶段 -->
          <el-table-column
            label="潜力阶段"
            width="280"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <div class="stage-editor">
                <div class="time-picker-group">
                  <el-date-picker
                    v-model="row.potential_stage.start_time"
                    type="datetime"
                    placeholder="开始时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px; margin-bottom: 8px"
                  />
                  <el-date-picker
                    v-model="row.potential_stage.end_time"
                    type="datetime"
                    placeholder="结束时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px"
                  />
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 成品阶段 -->
          <el-table-column
            label="成品阶段"
            width="280"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <div class="stage-editor">
                <div class="time-picker-group">
                  <el-date-picker
                    v-model="row.product_stage.start_time"
                    type="datetime"
                    placeholder="开始时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px; margin-bottom: 8px"
                  />
                  <el-date-picker
                    v-model="row.product_stage.end_time"
                    type="datetime"
                    placeholder="结束时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px"
                  />
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 放弃阶段 -->
          <el-table-column
            label="放弃阶段"
            width="280"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <div class="stage-editor">
                <div class="time-picker-group">
                  <el-date-picker
                    v-model="row.abandoned_stage.start_time"
                    type="datetime"
                    placeholder="开始时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px; margin-bottom: 8px"
                  />
                  <el-date-picker
                    v-model="row.abandoned_stage.end_time"
                    type="datetime"
                    placeholder="结束时间"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    format="YYYY-MM-DD HH:mm:ss"
                    clearable
                    style="width: 140px"
                  />
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页组件 -->
      <div v-if="filteredTotal > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizes"
          :total="filteredTotal"
          :background="true"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.product-stage-page {
  padding: 12px;
  min-height: calc(100vh - 80px);
  background: #f7f9fc;
  box-sizing: border-box;
}

/* 卡片尽量占满父元素 */
.stage-card {
  width: 100%;
  margin: 0;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(32, 45, 61, 0.06);
}

/* 顶部区域 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

/* 产品筛选区域 */
.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.filter-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

/* 表格容器 - 添加横向滚动 */
.table-wrapper {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  /* 优化滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;
}

/* Webkit浏览器滚动条样式 */
.table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* 表格占满父元素宽度 */
.stage-card :deep(.el-table) {
  width: 100%;
  min-width: 1440px; /* 设置最小宽度，确保所有列都能显示 */
}

/* 表格单元格内容水平垂直居中 */
.stage-card :deep(.el-table .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* 主图固定像素大小 */
.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

/* 无图占位 */
.no-img {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f2f6fb;
  color: #9aa8bf;
  border-radius: 6px;
}

/* 阶段编辑器布局 */
.stage-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
}

.time-picker-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* 保存操作按钮组 */
.save-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.save-actions .el-button {
  width: 80px;
}

/* 当前阶段基础样式 */
.current-badge {
  padding: 6px 12px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 14px;
  display: inline-block;
  min-width: 80px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 测款阶段 - 蓝色系 */
.current-badge.stage-testing {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: #ffffff;
  border: 2px solid #66b1ff;
}

/* 潜力阶段 - 绿色系 */
.current-badge.stage-potential {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  color: #ffffff;
  border: 2px solid #85ce61;
}

/* 成品阶段 - 橙色/金色系 */
.current-badge.stage-product {
  background: linear-gradient(135deg, #e6a23c 0%, #f0a020 100%);
  color: #ffffff;
  border: 2px solid #f0a020;
}

/* 放弃阶段 - 灰色/深色系 */
.current-badge.stage-abandoned {
  background: linear-gradient(135deg, #909399 0%, #606266 100%);
  color: #ffffff;
  border: 2px solid #606266;
}

/* 空时显示短横线 */
.dash {
  color: #909399;
}

/* 放弃阶段整行深灰，字体浅白 */
:deep(.el-table__row.row-abandoned) > td {
  background-color: #2f2f33 !important;
  color: #f5f5f7 !important;
}
:deep(.el-table__row.row-abandoned) {
  --el-color-text: #f5f5f7;
}

/* 复制文本样式为正常文本 */
.plain-text {
  cursor: pointer;
  color: inherit;
  user-select: text;
}

/* 响应式处理：确保表格内部滚动正常工作 */
.stage-card :deep(.el-table__body-wrapper) {
  overflow-x: visible;
  overflow-y: auto;
}

/* 确保固定列在视觉上正常覆盖（Element Plus 固定列样式增强） */
:deep(.el-table__fixed) {
  z-index: 3;
}
:deep(.el-table__fixed-right) {
  z-index: 2;
}
:deep(.el-table__fixed .cell),
:deep(.el-table__fixed-right .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 当有水平滚动时，固定列右侧显示分隔阴影（可选美化） */
:deep(.el-table__fixed .el-table__fixed-right-shadow),
:deep(.el-table__fixed-right .el-table__fixed-shadow) {
  box-shadow: none;
}

/* 分页组件样式 */
.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}

/* 可排序表头样式 */
.sortable-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.sortable-header:hover {
  color: #409eff;
}

.sort-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: #909399;
  transition: color 0.2s;
}

.sortable-header:hover .sort-icon {
  color: #409eff;
}
</style>
