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
  type: "ad", // 默认选择广告文件上传
  shop: "1489850435" // 默认选择店铺
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
  debugger;
  if (!formEl) return;

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
    if (newType === "productID" && fileList.value.length > 1) {
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
            :multiple="formData.type !== 'productID'"
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
            :disabled="!fileList.length"
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
.data-upload-page {
  min-height: calc(100vh - 84px);
  padding: 40px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-attachment: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

/* 页面头部 */
.page-header {
  margin-bottom: 24px;

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px 32px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
    }

    .header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      color: white;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .header-text {
      flex: 1;

      .page-title {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .page-desc {
        margin: 0;
        font-size: 14px;
        color: #606266;
        line-height: 1.6;
      }
    }
  }
}

/* 主内容区域 */
.main-content {
  display: flex;
  // grid-template-columns: 1fr;
  gap: 24px;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  padding-top: 20px;

  @media (min-width: 992px) {
    grid-template-columns: 1fr 1.2fr;
    padding: 0 40px;
    padding-top: 20px;
  }

  @media (min-width: 1400px) {
    padding: 0 60px;
    padding-top: 20px;
  }
}

/* 卡片通用样式 */
.config-card,
.upload-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  overflow: hidden;

  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  :deep(.el-card__header) {
    padding: 20px 24px;
    background: linear-gradient(135deg, #f5f7fa 0%, #fff 100%);
    border-bottom: 1px solid #ebeef5;

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      .el-icon {
        font-size: 20px;
        color: #667eea;
      }
    }
  }

  :deep(.el-card__body) {
    padding: 24px;
  }
}

/* 表单样式 */
.upload-form {
  .type-group {
    width: 100%;

    &.shop-group {
      :deep(.el-radio-button) {
        flex: 1;
        margin-right: 12px;

        &:last-child {
          margin-right: 0;
        }

        .el-radio-button__inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 8px;
          transition: all 0.3s ease;

          .radio-icon {
            font-size: 16px;
          }
        }

        &.is-active .el-radio-button__inner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: #667eea;
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
      }
    }

    .type-radio {
      width: 100%;
      margin-bottom: 12px;
      margin-right: 0;
      border-radius: 8px;
      transition: all 0.3s ease;

      &:hover {
        border-color: #667eea;
        transform: translateX(4px);
      }

      :deep(.el-radio__input.is-checked + .el-radio__label) {
        color: #667eea;
      }

      :deep(.el-radio__input.is-checked .el-radio__inner) {
        background-color: #667eea;
        border-color: #667eea;
      }

      .radio-content {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;

        .radio-icon {
          font-size: 18px;
          color: #667eea;
        }
      }
    }
  }
}

/* 文件统计卡片 */
.file-summary-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
  border-radius: 12px;
  border: 1px solid #e4e7ed;

  .summary-item {
    display: flex;
    align-items: center;
    gap: 12px;

    .summary-icon {
      font-size: 24px;
      color: #667eea;
    }

    .summary-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .summary-label {
        font-size: 12px;
        color: #909399;
      }

      .summary-value {
        font-size: 20px;
        font-weight: 600;
        color: #303133;
      }
    }
  }

  .progress-bar {
    margin: 8px 0;
  }
}

/* 上传区域 */
.upload-area {
  .upload-demo {
    width: 100%;
  }

  .upload-trigger {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
    border: 2px dashed #d3d4d6;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      border-color: #667eea;
      background: linear-gradient(135deg, #f0f4ff 0%, #fff 100%);

      .upload-icon {
        color: #667eea;
        transform: scale(1.1);
      }
    }

    .upload-icon {
      color: #909399;
      margin-bottom: 16px;
      transition: all 0.3s ease;
    }

    .upload-text {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }

    .upload-hint {
      margin: 0;
      font-size: 14px;
      color: #909399;
    }
  }

  .upload-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
    padding: 12px;
    background: #fff7e6;
    border-radius: 8px;
    font-size: 13px;
    color: #e6a23c;

    .el-icon {
      font-size: 16px;
    }
  }
}

/* 文件列表样式 */
:deep(.el-upload-list) {
  margin-top: 20px;

  .el-upload-list__item {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #e4e7ed;
    transition: all 0.3s ease;

    &:hover {
      border-color: #667eea;
      background: #f8f9ff;
    }
  }
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #ebeef5;

  .submit-btn {
    flex: 1;
    height: 48px;
    font-size: 16px;
    font-weight: 500;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .cancel-btn {
    height: 48px;
    padding: 0 32px;
    font-size: 16px;
    border-radius: 8px;
  }
}

/* 响应式设计 */
@media (max-width: 991px) {
  .main-content {
    grid-template-columns: 1fr;
    padding: 0 20px;
    gap: 20px;
  }

  .page-header .header-content {
    padding: 20px;
    flex-direction: column;
    text-align: center;

    .header-icon {
      width: 56px;
      height: 56px;
    }

    .header-text .page-title {
      font-size: 24px;
    }
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
    padding: 20px 0;
  }

  .main-content {
    padding: 0 16px;
    gap: 16px;
  }

  .config-card,
  .upload-card {
    :deep(.el-card__body) {
      padding: 16px;
    }

    :deep(.el-card__header) {
      padding: 16px;
    }
  }

  .upload-form {
    :deep(.el-form-item__label) {
      width: 100% !important;
      text-align: left;
      margin-bottom: 8px;
    }
  }
}
</style>
