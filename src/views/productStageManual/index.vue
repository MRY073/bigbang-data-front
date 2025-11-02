<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "ProductStageManual" });

type Product = {
  id: string;
  name: string;
  image?: string | null;
  stage?: "trial" | "rise" | "finished" | null;
  originalStage?: "trial" | "rise" | "finished" | null;
  visitorsMin?: number;
  originalVisitorsMin?: number;
  focus?: boolean;
  originalFocus?: boolean;
  modified?: boolean;
};

const products = ref<Product[]>([]);
const pageLoading = ref(false);

const API_LIST = "/api/products/stage/list";
const API_UPDATE = "/api/products/stage/update";

function showLoader(text = "加载中..."): LoadingInstance {
  return ElLoading.service({ lock: true, text, background: "rgba(0,0,0,0.2)" });
}

function initProducts(list: Partial<Product>[]) {
  products.value = list.map(p => {
    const stage = (p.stage ?? null) as Product["stage"];
    const visitors = typeof p.visitorsMin === "number" ? p.visitorsMin : 0;
    const focus = typeof p.focus === "boolean" ? p.focus : true; // 默认为关注
    return {
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      image: p.image ?? null,
      stage,
      originalStage: stage ?? null,
      visitorsMin: visitors,
      originalVisitorsMin: visitors,
      focus,
      originalFocus: focus,
      modified: false
    } as Product;
  });
}

/**
 * 复制到剪贴板（兼容回退）
 */
async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
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

/**
 * 手动拉取数据（按钮触发）
 */
async function fetchData() {
  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");
  try {
    const res = await fetch(API_LIST);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    initProducts(data || []);
  } catch {
    // 使用示例数据（后端不可用时）
    initProducts([
      {
        id: "SKU1001",
        name: "示例商品 A",
        image: "https://via.placeholder.com/80",
        stage: null,
        visitorsMin: 0,
        focus: true
      },
      {
        id: "SKU1002",
        name: "示例商品 B",
        image: "https://via.placeholder.com/80",
        stage: "trial",
        visitorsMin: 0,
        focus: true
      },
      {
        id: "SKU1003",
        name: "示例商品 C",
        image: null,
        stage: "rise",
        visitorsMin: 120,
        focus: false
      }
    ]);
    ElMessage.info("使用示例数据（后端不可用）");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

/**
 * 任一可编辑字段变化时调用，标记该行是否被修改
 */
function markRowModified(row: Product) {
  const stageChanged = (row.stage ?? null) !== (row.originalStage ?? null);
  const visitorsChanged =
    (row.visitorsMin ?? 0) !== (row.originalVisitorsMin ?? 0);
  const focusChanged = (row.focus ?? true) !== (row.originalFocus ?? true);
  row.modified = stageChanged || visitorsChanged || focusChanged;
}

/**
 * 表格行 class，根据 focus 决定是否蒙版显示
 */
function tableRowClass({ row }: { row: Product }) {
  return row.focus === false ? "row-muted" : "";
}

/**
 * 提交已修改行
 */
async function submitChanges() {
  const changed = products.value.filter(p => p.modified);
  if (!changed.length) {
    ElMessage.info("没有需要提交的更改");
    return;
  }

  pageLoading.value = true;
  const loader = showLoader("提交中...");
  try {
    const body = changed.map(p => ({
      id: p.id,
      stage: p.stage ?? null,
      visitorsMin: p.visitorsMin ?? 0,
      focus: p.focus ?? true
    }));

    const res = await fetch(API_UPDATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("提交失败");

    // 提交成功后同步原始值并清除标记
    changed.forEach(p => {
      p.originalStage = p.stage ?? null;
      p.originalVisitorsMin = p.visitorsMin ?? 0;
      p.originalFocus = p.focus ?? true;
      p.modified = false;
    });

    ElMessage.success("提交成功");
  } catch {
    ElMessage.error("提交失败，请重试");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}
</script>

<template>
  <div class="product-stage-page">
    <el-card class="stage-card">
      <div class="card-header">
        <h3 class="title">商品阶段手动设置</h3>
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
        :data="products"
        stripe
        style="width: 100%; margin-top: 12px"
        :row-key="row => row.id"
        :row-class-name="tableRowClass"
      >
        <el-table-column
          prop="id"
          label="产品ID"
          width="160"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <span
              class="copy-text"
              title="点击复制产品ID"
              @click.stop="copyToClipboard(row.id)"
              >{{ row.id }}</span
            >
          </template>
        </el-table-column>

        <el-table-column
          prop="name"
          label="产品名称"
          min-width="220"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <span
              class="copy-text"
              title="点击复制产品名称"
              @click.stop="copyToClipboard(row.name)"
              >{{ row.name }}</span
            >
          </template>
        </el-table-column>

        <el-table-column
          prop="image"
          label="产品主图"
          width="120"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <img v-if="row.image" :src="row.image" alt="主图" class="thumb" />
            <div v-else class="no-img">无图</div>
          </template>
        </el-table-column>

        <el-table-column
          prop="stage"
          label="选择商品生命阶段"
          width="300"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-select
                v-model="row.stage"
                placeholder="选择阶段"
                clearable
                style="width: 220px"
                @change="() => markRowModified(row)"
              >
                <el-option label="测款阶段" value="trial" />
                <el-option label="上升阶段" value="rise" />
                <el-option label="成品阶段" value="finished" />
              </el-select>

              <div class="modified-wrap">
                <span
                  v-if="(row.stage ?? null) !== (row.originalStage ?? null)"
                  class="modified-mark"
                  >已修改</span
                >
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="visitorsMin"
          label="成品阶段最低日访客数"
          width="240"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <div class="editable-cell">
              <el-input-number
                v-model="row.visitorsMin"
                :min="0"
                :controls="true"
                @change="() => markRowModified(row)"
              />
              <div class="modified-wrap">
                <span
                  v-if="
                    (row.visitorsMin ?? 0) !== (row.originalVisitorsMin ?? 0)
                  "
                  class="modified-mark"
                  >已修改</span
                >
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 右侧 focus 开关 -->
        <el-table-column
          prop="focus"
          label="关注"
          width="120"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            <el-switch
              v-model="row.focus"
              @change="() => markRowModified(row)"
            />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.product-stage-page {
  min-height: calc(100vh - 80px);
  padding: 12px 0;
  background: #f7f9fc;
}

/* 使卡片基本占满可视宽度并居中，左右留 20px 间距 */
.stage-card {
  width: calc(100% - 40px);
  max-width: none;
  margin: 0 20px;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgb(32 45 61 / 6%);
}

/* 表头区域居中 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* 表格占满卡片可用宽度 */
.stage-card :deep(.el-table) {
  width: 100%;
}

/* 表格单元格内容垂直水平居中 */
.stage-card :deep(.el-table .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

/* 允许表格在小屏水平滚动 */
.stage-card :deep(.el-table__body-wrapper) {
  overflow-x: auto;
}

/* 主图固定大小 */
.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
  margin: 0 auto;
}

.no-img {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  font-size: 12px;
  color: #9aa8bf;
  background: #f2f6fb;
  border-radius: 6px;
}

/* 可编辑单元格布局：保留下方空间用于“已修改”标记 */
.editable-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  padding-bottom: 18px; /* 预留空间，不影响行高 */
}

/* 为“已修改”单独容器，置于下方 */
.modified-wrap {
  position: absolute;
  left: 50px;
  bottom: -5px;
  width: 100%;
  display: flex;
  justify-content: flex-start;
}

/* 变更标记，红色突出显示（不改变布局） */
.modified-mark {
  color: #ff4d4f;
  font-size: 12px;
  font-weight: 600;
}

/* 次要文本颜色 */
.muted {
  color: #606266;
}

/* 复制文本样式：正常文本，不像超链接 */
.copy-text {
  cursor: pointer;
  user-select: text;
  color: inherit;
  text-decoration: none;
}
.copy-text:hover {
  color: inherit;
  text-decoration: underline; /* 可选，保留轻微 hover 提示 */
}

/* 不关注时整行浅灰背景：使用深度选择器确保作用于 el-table 渲染的 tr/td */
:deep(.el-table__row.row-muted) > td {
  background-color: #606266 !important;
  color: #9aa8bf;
}

/* 保持行本身正常可交互，不使用透明度或灰度过滤 */
:deep(.el-table__row.row-muted) {
  opacity: 1 !important;
  filter: none !important;
}

/* 保证 switch、按钮等控件在浅灰行上仍可交互 */
:deep(.el-table__row.row-muted) .el-switch,
:deep(.el-table__row.row-muted) .el-button,
:deep(.el-table__row.row-muted) input,
:deep(.el-table__row.row-muted) select {
  pointer-events: auto;
  opacity: 1;
}

/* 响应式：窄屏时减少左右间距 */
@media (max-width: 768px) {
  .stage-card {
    margin: 0 8px;
    padding: 12px;
  }
  .stage-card :deep(.el-table .cell) {
    gap: 6px;
  }
}
</style>
