<script setup lang="ts">
import { ref, watch } from "vue";
import { getUploadedDates } from "@/api/uploadData";
import { Document } from "@element-plus/icons-vue";
import dayjs from "dayjs";

interface Props {
  visible: boolean;
  shopID?: string;
}

interface Emits {
  (e: "update:visible", value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 抽屉显示状态
const drawerVisible = ref(props.visible);

// 日历当前日期（用于控制日历显示）
const calendarDate = ref(new Date());

// 已上传的日期列表
const uploadedDates = ref<{
  ad: string[];
  daily: string[];
}>({
  ad: [],
  daily: []
});

// 加载状态
const loading = ref(false);

// 加载已上传日期列表
const loadUploadedDates = async () => {
  // 检查 shopID 是否存在且不为空字符串
  if (!props.shopID || props.shopID.trim() === "") {
    console.warn("shopID 为空，无法加载已上传日期");
    return;
  }

  loading.value = true;
  try {
    console.log("正在加载已上传日期，shopID:", props.shopID);
    const result = await getUploadedDates(props.shopID);
    if (result.success && result.data) {
      uploadedDates.value = {
        ad: result.data.ad || [],
        daily: result.data.daily || []
      };
    }
  } catch (error: any) {
    console.error("获取已上传日期失败:", error);
  } finally {
    loading.value = false;
  }
};

// 日历日期格式化函数
const formatDate = (date: Date | string): string => {
  return dayjs(date).format("YYYY-MM-DD");
};

// 判断日期是否已上传（广告）
const isAdDateUploaded = (date: Date | string): boolean => {
  const dateStr = formatDate(date);
  return uploadedDates.value.ad.includes(dateStr);
};

// 判断日期是否已上传（商业分析）
const isDailyDateUploaded = (date: Date | string): boolean => {
  const dateStr = formatDate(date);
  return uploadedDates.value.daily.includes(dateStr);
};

// 监听 visible 变化
watch(
  () => props.visible,
  newVal => {
    drawerVisible.value = newVal;
    if (newVal) {
      // 打开抽屉时加载数据
      console.log("抽屉打开，shopID:", props.shopID);
      loadUploadedDates();
    }
  }
);

// 监听 drawerVisible 变化，同步到父组件
watch(drawerVisible, newVal => {
  emit("update:visible", newVal);
});

// 监听 shopID 变化，重新加载数据
watch(
  () => props.shopID,
  (newVal, oldVal) => {
    console.log("shopID 变化:", {
      oldVal,
      newVal,
      drawerVisible: drawerVisible.value
    });
    if (drawerVisible.value && newVal && newVal.trim() !== "") {
      loadUploadedDates();
    }
  }
);
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="已上传日期查看"
    direction="rtl"
    size="800px"
  >
    <template #default>
      <div v-loading="loading" class="calendar-container">
        <!-- 广告日历 -->
        <div class="calendar-section">
          <div class="calendar-title">
            <el-icon><Document /></el-icon>
            <span>广告</span>
          </div>
          <el-calendar v-model="calendarDate">
            <template #date-cell="{ data }">
              <div
                class="calendar-cell"
                :class="{
                  'uploaded-date': isAdDateUploaded(data.date)
                }"
              >
                <span class="cell-date">{{
                  dayjs(data.date).format("DD")
                }}</span>
                <span v-if="isAdDateUploaded(data.date)" class="uploaded-badge">
                  已上传
                </span>
              </div>
            </template>
          </el-calendar>
        </div>

        <!-- 商业分析日历 -->
        <div class="calendar-section">
          <div class="calendar-title">
            <el-icon><Document /></el-icon>
            <span>商业分析</span>
          </div>
          <el-calendar v-model="calendarDate">
            <template #date-cell="{ data }">
              <div
                class="calendar-cell"
                :class="{
                  'uploaded-date': isDailyDateUploaded(data.date)
                }"
              >
                <span class="cell-date">{{
                  dayjs(data.date).format("DD")
                }}</span>
                <span
                  v-if="isDailyDateUploaded(data.date)"
                  class="uploaded-badge"
                >
                  已上传
                </span>
              </div>
            </template>
          </el-calendar>
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
.calendar-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.calendar-section {
  .calendar-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 18px;
    font-weight: 600;
    color: var(--dopamine-contrast);

    .el-icon {
      font-size: 20px;
      color: var(--dopamine-secondary);
    }
  }

  :deep(.el-calendar) {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(108, 99, 255, 0.2);
    background: rgba(255, 255, 255, 0.95);
  }

  :deep(.el-calendar__header) {
    padding: 16px;
    background: linear-gradient(
      120deg,
      rgba(108, 99, 255, 0.1) 0%,
      rgba(255, 110, 199, 0.1) 100%
    );
    border-bottom: 1px solid rgba(108, 99, 255, 0.2);
  }

  :deep(.el-calendar__body) {
    padding: 12px;
  }

  :deep(.el-calendar-table) {
    .el-calendar-day {
      padding: 0;
      height: 60px;
    }
  }

  .calendar-cell {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 6px;
    transition: all 0.2s ease;

    .cell-date {
      font-size: 14px;
      font-weight: 500;
      color: var(--dopamine-contrast);
    }

    .uploaded-badge {
      font-size: 10px;
      color: #fff;
      background: linear-gradient(
        120deg,
        rgba(108, 99, 255, 0.9) 0%,
        rgba(255, 110, 199, 0.9) 100%
      );
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 2px;
      white-space: nowrap;
    }

    &.uploaded-date {
      background: linear-gradient(
        135deg,
        rgba(108, 99, 255, 0.15) 0%,
        rgba(255, 110, 199, 0.15) 100%
      );
      border: 1px solid rgba(108, 99, 255, 0.3);
    }
  }
}
</style>
