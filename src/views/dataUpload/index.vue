<script setup lang="ts">
import { ref, watch } from "vue";
import type { UploadProps, UploadInstance, FormInstance } from "element-plus";
import { ElMessage } from "element-plus";
import { debounce } from "@pureadmin/utils";
import { uploadData } from "@/api/uploadData";
import {
  Upload,
  Setting,
  Shop,
  Document,
  Folder,
  Delete,
  UploadFilled,
  InfoFilled,
  Check,
  Close
} from "@element-plus/icons-vue";

defineOptions({
  name: "DataUpload"
});

// 表单引用
const formRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();

// 表单数据
const formData = ref({
  type: "", // 必须手动选择上传类型
  shop: "" // 必须手动选择店铺
});

// 上传文件列表
const fileList = ref<UploadProps["fileList"]>([]);

// 上传状态
const uploading = ref(false);

// 上传类型选项
const uploadTypes = [
  {
    label: "广告文件上传（单日）",
    value: "ad"
  },
  {
    label: "每日文件上传（单日）",
    value: "daily"
  },
  {
    label: "商品ID更新（全量）",
    value: "productID"
  }
];

// 店铺选项
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

// 根据文件名校验后缀（更稳健）
const isValidExt = (name: string) => /\.(csv|xls|xlsx)$/i.test(name);

// 文件上传前的验证
const beforeUpload: UploadProps["beforeUpload"] = file => {
  const okExt = isValidExt(file.name);

  if (!okExt) {
    ElMessage.error("只能上传 .csv, .xls, .xlsx 格式的文件!");
    return false;
  }

  // 检查是否已选择上传类型
  if (!formData.value.type) {
    ElMessage.error("请先选择上传类型!");
    return false;
  }

  // 商品ID更新（全量）类型只能上传一个文件
  if (formData.value.type === "productID") {
    if (fileList.value.length >= 1) {
      ElMessage.error("商品ID更新（全量）类型只能上传一个文件!");
      return false;
    }
    return true;
  }

  // 其他类型最多上传100个文件
  const isLt100 = fileList.value.length < 100;
  if (!isLt100) {
    ElMessage.error("最多只能上传100个文件!");
    return false;
  }
  return true;
};

// 模拟发送上传请求（替换为实际 API 调用）
// const sendRequest = (fd: FormData) => uploadData(fd); // 返回一个 Promise

// 处理上传请求：启动请求后立即清空页面，接口完成后再弹出 toast
const handleUpload = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;

  // 验证是否已选择店铺
  if (!formData.value.shop) {
    ElMessage.warning("请先选择店铺");
    return;
  }

  // 验证是否已选择上传类型
  if (!formData.value.type) {
    ElMessage.warning("请先选择上传类型");
    return;
  }

  if (!fileList.value || !fileList.value.length) {
    ElMessage.warning("请先选择要上传的文件");
    return;
  }

  // 收集本次要上传的文件（复制一份，后续清空 UI 不影响上传数据）
  const filesToSend: File[] = fileList.value
    .map(f => (f.raw instanceof File ? (f.raw as File) : undefined))
    .filter(Boolean) as File[];

  if (!filesToSend.length) {
    ElMessage.warning("无有效文件可上传");
    return;
  }

  // 构造 FormData（示例）
  const fd = new FormData();
  filesToSend.forEach((f, i) => fd.append(`files`, f));
  fd.append("type", formData.value.type); // 添加上传文件的类型（广告、商业分析、映射表）
  const shopOption = shopOptions.find(opt => opt.value === formData.value.shop);
  if (shopOption) {
    fd.append("shopID", formData.value.shop); // 添加店铺ID
    fd.append("shopName", shopOption.label); // 添加店铺名称
  }

  // 设置上传状态
  uploading.value = true;

  // 启动请求
  // const req = sendRequest(fd);

  // 一旦请求成功发送（即已启动），立即清空页面，允许用户继续操作
  resetForm();
  ElMessage.info("上传请求已发送，正在后台处理...");

  // 等待请求完成，完成后弹出结果通知
  try {
    const result = await uploadData(fd);
    if (result.success) {
      ElMessage.success(result.message || "文件上传完成");
    } else {
      ElMessage.error(result.message || "上传失败，请重试");
    }
  } catch (error: any) {
    console.error("上传错误:", error);
    ElMessage.error(
      error?.response?.data?.message || error?.message || "上传失败，请重试"
    );
  } finally {
    uploading.value = false;
  }
};

// 防抖处理的上传函数（对外暴露接受可选参数）
const debouncedUpload = debounce(
  (formEl?: FormInstance) => {
    handleUpload(formEl);
  },
  1000,
  true
) as unknown as (formEl?: FormInstance) => void;

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields();
  fileList.value = [];
  uploadRef.value?.clearFiles();
};

// 监听上传类型变化，当切换到商品ID更新类型时，如果已有多个文件，只保留第一个
watch(
  () => formData.value.type,
  (newType, oldType) => {
    // 如果切换到商品ID更新类型，且文件列表中有多个文件
    if (newType && newType === "productID" && fileList.value.length > 1) {
      // 只保留第一个文件
      fileList.value = [fileList.value[0]];
      uploadRef.value?.clearFiles();
      // 重新添加第一个文件
      if (fileList.value[0]?.raw) {
        uploadRef.value?.handleStart(fileList.value[0].raw);
      }
      ElMessage.warning(
        "商品ID更新（全量）类型只能上传一个文件，已自动清除多余文件"
      );
    }
  }
);
</script>

<template>
  <div class="data-upload-page">
    <!-- 页面头部 -->
    <!-- <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <el-icon :size="32">
            <Upload />
          </el-icon>
        </div>
        <div class="header-text">
          <h1 class="page-title">数据上传</h1>
          <p class="page-desc">上传您的数据文件，系统将自动处理和分析</p>
        </div>
      </div>
    </div> -->

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 上传配置卡片 -->
      <el-card class="config-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><Setting /></el-icon>
            <span>上传配置</span>
          </div>
        </template>

        <el-form
          ref="formRef"
          :model="formData"
          label-width="140px"
          class="upload-form"
        >
          <!-- 店铺选择 -->
          <el-form-item label="选择店铺" prop="shop" required>
            <el-radio-group
              v-model="formData.shop"
              class="type-group shop-group"
            >
              <el-radio-button
                v-for="item in shopOptions"
                :key="item.value"
                :label="item.value"
                class="shop-radio"
              >
                <el-icon class="radio-icon"><Shop /></el-icon>
                <span>{{ item.label }}</span>
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <!-- 上传类型 -->
          <el-form-item label="上传类型" prop="type" required>
            <el-radio-group v-model="formData.type" class="type-group">
              <el-radio
                v-for="item in uploadTypes"
                :key="item.value"
                :label="item.value"
                class="type-radio"
                border
              >
                <div class="radio-content">
                  <el-icon class="radio-icon"><Document /></el-icon>
                  <span>{{ item.label }}</span>
                </div>
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <!-- 文件统计 -->
          <el-form-item label="文件统计">
            <div class="file-summary-card">
              <div class="summary-item">
                <el-icon class="summary-icon"><Folder /></el-icon>
                <div class="summary-info">
                  <span class="summary-label">已选文件</span>
                  <span class="summary-value">{{ fileList.length }} / 100</span>
                </div>
              </div>
              <el-progress
                :percentage="(fileList.length / 100) * 100"
                :stroke-width="8"
                :show-text="false"
                class="progress-bar"
              />
              <el-button
                v-if="fileList.length"
                type="danger"
                size="small"
                plain
                @click="resetForm"
              >
                <el-icon><Delete /></el-icon>
                清空全部
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 文件上传卡片 -->
      <el-card class="upload-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <el-icon><UploadFilled /></el-icon>
            <span>文件上传</span>
          </div>
        </template>

        <div class="upload-area">
          <el-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
            :before-upload="beforeUpload"
            :multiple="formData.type && formData.type !== 'productID'"
            accept=".csv,.xls,.xlsx"
            action="#"
            drag
          >
            <template #trigger>
              <div class="upload-trigger">
                <el-icon class="upload-icon" :size="48"><Upload /></el-icon>
                <p class="upload-text">点击或拖拽文件到此区域上传</p>
                <p class="upload-hint">支持 .csv / .xls / .xlsx 格式文件</p>
              </div>
            </template>
            <template #tip>
              <div class="upload-tip">
                <el-icon><InfoFilled /></el-icon>
                <span>请勿修改文件名、文件格式或文件内容</span>
              </div>
            </template>
          </el-upload>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :disabled="!fileList.length || !formData.shop || !formData.type"
            :loading="uploading"
            @click="debouncedUpload(formRef)"
          >
            <el-icon><Check /></el-icon>
            提交上传
          </el-button>

          <el-button
            v-if="fileList.length"
            size="large"
            class="cancel-btn"
            @click="resetForm"
          >
            <el-icon><Close /></el-icon>
            取消并清空
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/style/dopamine.scss" as dopamine;

.data-upload-page {
  @include dopamine.dopamine-page();
  min-height: calc(100vh - 84px);
  padding: 48px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  color: var(--dopamine-contrast);
}

.main-content {
  display: flex;
  gap: 28px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 28px 0;

  @media (min-width: 1400px) {
    padding-inline: 48px;
  }
}

.config-card,
.upload-card {
  @include dopamine.dopamine-surface();
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 26px 50px rgba(255, 110, 199, 0.28),
      0 14px 30px rgba(108, 99, 255, 0.22);
  }

  :deep(.el-card__header) {
    @include dopamine.dopamine-card-header();

    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 18px;
      font-weight: 600;

      .el-icon {
        font-size: 22px;
        color: #fff;
      }
    }
  }

  :deep(.el-card__body) {
    padding: 28px;
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.92) 0%,
      rgba(255, 255, 255, 0.72) 100%
    );
  }
}

.upload-form {
  .type-group {
    width: 100%;

    &.shop-group {
      :deep(.el-radio-button) {
        flex: 1;
        margin-right: 12px;
        border-radius: 14px;
        overflow: hidden;

        &:last-child {
          margin-right: 0;
        }

        .el-radio-button__inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 12px;
          transition: all 0.25s ease;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid transparent;

          .radio-icon {
            font-size: 18px;
            color: var(--dopamine-secondary);
            transition: inherit;
          }
        }

        &.is-active .el-radio-button__inner {
          background: linear-gradient(
            120deg,
            rgba(108, 99, 255, 0.95) 0%,
            rgba(255, 110, 199, 0.9) 60%,
            rgba(255, 211, 61, 0.85) 100%
          );
          border-color: transparent;
          color: #fff;
          box-shadow: 0 15px 30px rgba(108, 99, 255, 0.3);

          .radio-icon {
            color: #fff;
            transform: scale(1.1);
          }
        }
      }
    }

    .type-radio {
      width: 100%;
      margin-bottom: 14px;
      border-radius: 14px;
      padding: 2px;
      transition: all 0.25s ease;

      &:hover {
        border-color: rgba(108, 99, 255, 0.35);
        transform: translateX(4px);
      }

      :deep(.el-radio__input.is-checked + .el-radio__label) {
        color: var(--dopamine-secondary);
      }

      :deep(.el-radio__input.is-checked .el-radio__inner) {
        border-color: var(--dopamine-secondary);
        background-color: var(--dopamine-secondary);
      }

      .radio-content {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 6px;

        .radio-icon {
          font-size: 20px;
          color: var(--dopamine-secondary);
        }
      }
    }
  }
}

.file-summary-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 18px;
  border: 1px solid rgba(108, 99, 255, 0.18);
  background: linear-gradient(
    135deg,
    rgba(108, 99, 255, 0.12) 0%,
    rgba(255, 110, 199, 0.16) 50%,
    rgba(255, 211, 61, 0.12) 100%
  );
  backdrop-filter: blur(16px);

  .summary-item {
    display: flex;
    align-items: center;
    gap: 14px;

    .summary-icon {
      font-size: 26px;
      color: var(--dopamine-secondary);
      filter: drop-shadow(0 6px 12px rgba(108, 99, 255, 0.4));
    }

    .summary-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .summary-label {
        font-size: 13px;
        color: var(--dopamine-soft-ink);
        letter-spacing: 0.5px;
      }

      .summary-value {
        font-size: 22px;
        font-weight: 700;
        color: var(--dopamine-contrast);
      }
    }
  }

  .progress-bar {
    margin: 6px 0 0;

    :deep(.el-progress-bar__inner) {
      background: linear-gradient(
        120deg,
        var(--dopamine-secondary) 0%,
        var(--dopamine-primary) 60%,
        var(--dopamine-accent) 100%
      );
    }
  }

  .el-button {
    @include dopamine.dopamine-ghost-button();
  }
}

.upload-area {
  .upload-demo {
    width: 100%;
  }

  .upload-trigger {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    border-radius: 18px;
    border: 1px dashed rgba(108, 99, 255, 0.45);
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.8) 0%,
      rgba(255, 255, 255, 0.58) 100%
    );
    transition: all 0.28s ease;
    backdrop-filter: blur(12px);

    &:hover {
      border-color: rgba(255, 110, 199, 0.68);
      transform: translateY(-4px);
      box-shadow: 0 18px 30px rgba(255, 110, 199, 0.24);

      .upload-icon {
        color: var(--dopamine-primary);
        transform: scale(1.12) rotate(-3deg);
      }
    }

    .upload-icon {
      color: var(--dopamine-secondary);
      margin-bottom: 18px;
      transition: inherit;
    }

    .upload-text {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.3px;
      color: var(--dopamine-contrast);
    }

    .upload-hint {
      margin: 0;
      font-size: 14px;
      color: var(--dopamine-soft-ink);
    }
  }

  .upload-tip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 18px;
    padding: 14px 18px;
    border-radius: 14px;
    font-size: 14px;
    color: #8b6914;
    @include dopamine.dopamine-chip(#ffb347);

    .el-icon {
      font-size: 18px;
    }
  }
}

:deep(.el-upload-list) {
  margin-top: 22px;

  .el-upload-list__item {
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid rgba(108, 99, 255, 0.2);
    transition: all 0.25s ease;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);

    &:hover {
      border-color: rgba(255, 110, 199, 0.5);
      box-shadow: 0 12px 28px rgba(108, 99, 255, 0.22);
    }
  }
}

.action-buttons {
  display: flex;
  gap: 18px;
  margin-top: 26px;
  padding-top: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.55);

  .submit-btn {
    flex: 1;
    height: 52px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    @include dopamine.dopamine-primary-button();
  }

  .cancel-btn {
    height: 52px;
    padding: 0 34px;
    font-size: 16px;
    border-radius: 14px;
    @include dopamine.dopamine-ghost-button();
  }
}

@media (max-width: 991px) {
  .main-content {
    flex-direction: column;
    padding-inline: 20px;
  }

  .action-buttons {
    flex-direction: column;

    .submit-btn,
    .cancel-btn {
      width: 100%;
    }
  }
}

@media (max-width: 768px) {
  .data-upload-page {
    padding: 28px 0;
  }

  .main-content {
    padding-inline: 18px;
    gap: 18px;
  }

  .config-card,
  .upload-card {
    :deep(.el-card__body) {
      padding: 20px;
    }

    :deep(.el-card__header) {
      padding: 18px 20px;
    }
  }

  .upload-form {
    :deep(.el-form-item__label) {
      width: 100% !important;
      text-align: left;
      margin-bottom: 10px;
    }
  }
}
</style>
