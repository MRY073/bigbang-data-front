<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElLoading } from "element-plus";
import type { LoadingInstance } from "element-plus";

defineOptions({ name: "ProductStageManual" });

type Product = {
  id: string;
  name: string;
  image?: string | null;
  endDate?: string | null;
  originalEndDate?: string | null;
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
    const end = p.endDate ?? null;
    return {
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      image: p.image ?? null,
      endDate: end,
      originalEndDate: end,
      modified: false
    } as Product;
  });
}

async function fetchData() {
  pageLoading.value = true;
  const loader = showLoader("拉取数据中...");
  try {
    const res = await fetch(API_LIST);
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    initProducts(data || []);
  } catch {
    initProducts([
      {
        id: "SKU1001",
        name: "示例商品 A",
        image: "https://via.placeholder.com/80",
        endDate: null
      },
      {
        id: "SKU1002",
        name: "示例商品 B",
        image: "https://via.placeholder.com/80",
        endDate: "2025-12-01"
      },
      { id: "SKU1003", name: "示例商品 C", image: null, endDate: null }
    ]);
    ElMessage.info("使用示例数据（后端不可用）");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

function onDateChange(row: Product, val: string | null) {
  row.endDate = val ?? null;
  row.modified = (row.endDate ?? null) !== (row.originalEndDate ?? null);
}

async function submitChanges() {
  const changed = products.value.filter(p => p.modified);
  if (!changed.length) {
    ElMessage.info("没有需要提交的更改");
    return;
  }

  pageLoading.value = true;
  const loader = showLoader("提交中...");
  try {
    const body = changed.map(p => ({ id: p.id, endDate: p.endDate }));
    const res = await fetch(API_UPDATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("提交失败");
    changed.forEach(p => {
      p.modified = false;
      p.originalEndDate = p.endDate ?? null;
    });
    ElMessage.success("提交成功");
  } catch {
    ElMessage.error("提交失败，请重试");
  } finally {
    loader.close();
    pageLoading.value = false;
  }
}

onMounted(() => {
  // fetchData();
});
</script>

<template>
  <div class="product-stage-page">
    <el-card class="stage-card">
      <div class="card-header">
        <h3 class="title">手动设置商品阶段</h3>
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

      <el-table :data="products" stripe style="width: 100%; margin-top: 12px">
        <el-table-column prop="id" label="产品ID" width="160">
          <template #default="{ row }">
            <span class="muted">{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="name" label="产品名称" min-width="220">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
          </template>
        </el-table-column>

        <!-- <el-table-column prop="image" label="产品主图" width="120">
          <template #default="{ row }">
            <img v-if="row.image" :src="row.image" alt="主图" class="thumb" />
            <div v-else class="no-img">无图</div>
          </template>
        </el-table-column> -->

        <el-table-column prop="endDate" label="测款期结束日期" width="320">
          <template #default="{ row }">
            <div class="date-row">
              <el-date-picker
                v-model="row.endDate"
                type="date"
                placeholder="请选择日期 / 可清空"
                value-format="yyyy-MM-dd"
                clearable
                @change="val => onDateChange(row, val)"
              />
              <span v-if="row.modified" class="modified-note">日期已修改</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.product-stage-page {
  min-height: calc(100vh - 100px);
  padding: 20px;
  background: #f7f9fc;
}

.stage-card {
  max-width: 1100px;
  padding: 16px;
  margin: 0 auto;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgb(32 45 61 / 6%);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}

.actions {
  display: flex;
  gap: 10px;
}

.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
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

.date-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.modified-note {
  font-size: 12px;
  font-weight: 500;
  color: #ff7a00;
}

.muted {
  color: #606266;
}
</style>
