<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "ProductStageManual" });

type StageKey = "trial" | "potential" | "finished" | "abandon" | "other";

type StageRange = [string, string] | null; // ["yyyy-MM-dd","yyyy-MM-dd"] or null

type ProductRow = {
  id: string;
  name: string;
  image?: string | null;
  stages: Record<StageKey, StageRange>;
  originalStages: Record<StageKey, StageRange>;
  modifiedFlags: Record<StageKey, boolean>;
  // computed at runtime
  currentStage?: StageKey | null;
};

const products = ref<ProductRow[]>([]);
const pageLoading = ref(false);
const filterStage = ref<"all" | StageKey>("all");

const API_LIST = "/api/products/stage/manual/list";
const API_UPDATE = "/api/products/stage/manual/update";

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

function parseDateStr(s?: string | null) {
  if (!s) return null;
  return new Date(s + "T00:00:00");
}

function formatRangeForCompare(r: StageRange) {
  return r ? `${r[0]}_${r[1]}` : "null";
}

function computeCurrentStageForRow(row: ProductRow): StageKey | null {
  const today = new Date();
  // priority: abandon -> other -> finished -> potential -> trial
  const order: StageKey[] = [
    "abandon",
    "other",
    "finished",
    "potential",
    "trial"
  ];
  for (const key of order) {
    const rng = row.stages[key];
    if (rng && rng[0] && rng[1]) {
      const start = parseDateStr(rng[0])!;
      const end = parseDateStr(rng[1])!;
      if (start <= today && today <= end) return key;
    }
  }
  return null;
}

function initProducts(list: Partial<ProductRow>[]) {
  products.value = list.map(item => {
    const stagesDefault: Record<StageKey, StageRange> = {
      trial: null,
      potential: null,
      finished: null,
      abandon: null,
      other: null
    };
    const srcStages = (item as any).stages ?? {};
    const merged: Record<StageKey, StageRange> = { ...stagesDefault };
    (Object.keys(merged) as StageKey[]).forEach(k => {
      const v = srcStages[k];
      merged[k] =
        Array.isArray(v) && v.length === 2
          ? [String(v[0]), String(v[1])]
          : null;
    });

    const row: ProductRow = {
      id: String((item as any).id ?? ""),
      name: String((item as any).name ?? ""),
      image: (item as any).image ?? null,
      stages: merged,
      originalStages: JSON.parse(JSON.stringify(merged)),
      modifiedFlags: {
        trial: false,
        potential: false,
        finished: false,
        abandon: false,
        other: false
      },
      currentStage: null
    };
    row.currentStage = computeCurrentStageForRow(row);
    return row;
  });
}

/** 标记单个阶段的修改状态 */
function markStageModified(row: ProductRow, key: StageKey) {
  const orig = row.originalStages[key];
  const cur = row.stages[key];
  row.modifiedFlags[key] =
    formatRangeForCompare(orig) !== formatRangeForCompare(cur);
  // recompute current stage after any change
  row.currentStage = computeCurrentStageForRow(row);
}

/** 拉取数据（仅手动触发） */
async function fetchData() {
  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");
  try {
    const res = await fetch(API_LIST);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    initProducts(data || []);
  } catch {
    // mock 初始数据（便于直接看到页面效果）
    initProducts([
      {
        id: "SKU1001",
        name: "商品 A",
        image: "https://via.placeholder.com/80?text=A",
        stages: {
          trial: ["2025-09-01", "2025-09-10"],
          potential: ["2025-09-11", "2025-09-20"],
          finished: ["2025-09-21", "2025-10-20"],
          abandon: null,
          other: null
        }
      },
      {
        id: "SKU1002",
        name: "商品 B",
        image: "https://via.placeholder.com/80?text=B",
        stages: {
          trial: null,
          potential: null,
          finished: null,
          abandon: ["2025-08-01", "2025-12-31"],
          other: null
        }
      },
      {
        id: "SKU1003",
        name: "商品 C 非常长的名称示例",
        image: "https://via.placeholder.com/80?text=C",
        stages: {
          trial: ["2025-10-01", "2025-10-10"],
          potential: null,
          finished: null,
          abandon: null,
          other: ["2025-10-11", "2025-10-20"]
        }
      },
      {
        id: "SKU1004",
        name: "商品 D",
        image: null,
        stages: {
          trial: null,
          potential: ["2025-10-01", "2025-12-31"],
          finished: null,
          abandon: null,
          other: null
        }
      }
    ]);
    ElMessage.info("使用本地示例数据（后端不可用）");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

/** 提交改变（只提交被修改的阶段数据） */
async function submitChanges() {
  // 收集修改项
  const payload = products.value
    .map(row => {
      const changedStages: Record<string, StageRange> = {};
      (Object.keys(row.stages) as StageKey[]).forEach(k => {
        if (row.modifiedFlags[k]) changedStages[k] = row.stages[k];
      });
      return {
        id: row.id,
        changes: changedStages
      };
    })
    .filter(item => Object.keys(item.changes).length > 0);

  if (!payload.length) {
    ElMessage.info("没有需要提交的更改");
    return;
  }

  pageLoading.value = true;
  const loader = showLoader("提交中...");
  try {
    const res = await fetch(API_UPDATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("提交失败");
    // 假设成功：同步 originalStages 与清除 modifiedFlags
    payload.forEach(p => {
      const row = products.value.find(r => r.id === p.id);
      if (!row) return;
      Object.keys(p.changes).forEach((k: string) => {
        const key = k as StageKey;
        row.originalStages[key] = row.stages[key];
        row.modifiedFlags[key] = false;
      });
    });
    ElMessage.success("提交成功");
  } catch {
    ElMessage.error("提交失败，请重试");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

/** 过滤后的产品列表 */
const filteredProducts = computed(() => {
  if (filterStage.value === "all") return products.value;
  const key = filterStage.value as StageKey;
  // 只保留那些在该阶段有时间段或当前阶段为该阶段
  return products.value.filter(row => {
    const rng = row.stages[key];
    const hasRange = rng && rng[0] && rng[1];
    const isCurrent = row.currentStage === key;
    return hasRange || isCurrent;
  });
});

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

onMounted(() => {
  // 页面进入不自动拉取，使用示例数据以便查看（也可按需注释）
  fetchData();
});
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
            <el-option label="测款阶段" value="trial" />
            <el-option label="潜力阶段" value="potential" />
            <el-option label="成品阶段" value="finished" />
            <el-option label="放弃阶段" value="abandon" />
            <el-option label="其他阶段" value="other" />
          </el-select>
        </div>

        <div class="actions">
          <el-button
            type="primary"
            :loading="pageLoading"
            icon="el-icon-refresh"
            @click="fetchData"
            >拉取数据</el-button
          >
          <el-button
            type="success"
            :loading="pageLoading"
            icon="el-icon-upload"
            @click="submitChanges"
            >提交更改</el-button
          >
        </div>
      </div>

      <el-table
        :data="filteredProducts"
        stripe
        style="width: 100%"
        :row-key="row => row.id"
        :row-class-name="
          ({ row }) =>
            row.currentStage === 'abandon'
              ? 'row-abandon'
              : row.currentStage === 'other'
                ? 'row-other'
                : ''
        "
      >
        <el-table-column
          prop="id"
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
                @click.stop="copyToClipboard(row.id)"
                >{{ row.id }}</span
              >
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="name"
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
                @click.stop="copyToClipboard(row.name)"
                >{{ row.name }}</span
              >
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="image"
          label="产品主图"
          width="120"
          align="center"
          header-align="center"
          fixed="left"
        >
          <template #default="{ row }">
            <div class="cell-center">
              <img v-if="row.image" :src="row.image" alt="主图" class="thumb" />
              <div v-else class="no-img">无图</div>
            </div>
          </template>
        </el-table-column>

        <!-- 各阶段列，使用日期区间选择器 -->
        <el-table-column
          label="测款阶段"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-date-picker
                v-model="row.stages.trial"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="yyyy-MM-dd"
                unlink-panels
                clearable
                style="width: 200px"
                @change="() => markStageModified(row, 'trial')"
              />
              <div v-if="row.modifiedFlags.trial" class="modified-note">
                已修改
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="潜力阶段"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-date-picker
                v-model="row.stages.potential"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="yyyy-MM-dd"
                clearable
                style="width: 200px"
                @change="() => markStageModified(row, 'potential')"
              />
              <div v-if="row.modifiedFlags.potential" class="modified-note">
                已修改
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="成品阶段"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-date-picker
                v-model="row.stages.finished"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="yyyy-MM-dd"
                clearable
                style="width: 200px"
                @change="() => markStageModified(row, 'finished')"
              />
              <div v-if="row.modifiedFlags.finished" class="modified-note">
                已修改
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="放弃阶段"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-date-picker
                v-model="row.stages.abandon"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="yyyy-MM-dd"
                clearable
                style="width: 200px"
                @change="() => markStageModified(row, 'abandon')"
              />
              <div v-if="row.modifiedFlags.abandon" class="modified-note">
                已修改
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="其他阶段"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-date-picker
                v-model="row.stages.other"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="yyyy-MM-dd"
                clearable
                style="width: 200px"
                @change="() => markStageModified(row, 'other')"
              />
              <div v-if="row.modifiedFlags.other" class="modified-note">
                已修改
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="currentStage"
          label="当前阶段"
          width="140"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="cell-center">
              <span v-if="row.currentStage" class="current-badge">{{
                row.currentStage === "trial"
                  ? "测款"
                  : row.currentStage === "potential"
                    ? "潜力"
                    : row.currentStage === "finished"
                      ? "成品"
                      : row.currentStage === "abandon"
                        ? "放弃"
                        : "其他"
              }}</span>
              <span v-else class="dash">-</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
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

/* 表格占满父元素宽度 */
.stage-card :deep(.el-table) {
  width: 100%;
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

/* 单元格内竖直布局，预留底部空间显示已修改 */
.editable-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* 已修改提示：红色，小字，固定在选择器下方 */
.modified-note {
  color: #ff4d4f;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

/* 当前阶段样式 */
.current-badge {
  padding: 4px 8px;
  border-radius: 12px;
  background: #eef6ff;
  color: #409eff;
  font-weight: 600;
  font-size: 13px;
}

/* 空时显示短横线 */
.dash {
  color: #909399;
}

/* 放弃阶段整行深灰，字体浅白 */
:deep(.el-table__row.row-abandon) > td {
  background-color: #2f2f33 !important;
  color: #f5f5f7 !important;
}
:deep(.el-table__row.row-abandon) {
  --el-color-text: #f5f5f7;
}

/* 其他阶段整行浅灰，字体白色 */
:deep(.el-table__row.row-other) > td {
  background-color: #6b6f73 !important;
  color: #ffffff !important;
}
:deep(.el-table__row.row-other) {
  --el-color-text: #ffffff;
}

/* 复制文本样式为正常文本 */
.plain-text {
  cursor: pointer;
  color: inherit;
  user-select: text;
}

/* 响应式处理：小屏滚动 */
.stage-card :deep(.el-table__body-wrapper) {
  overflow-x: auto;
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
</style>
