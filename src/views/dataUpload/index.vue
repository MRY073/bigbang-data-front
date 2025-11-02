<script setup lang="ts">
import { ref } from "vue";
import type { UploadProps, UploadInstance, FormInstance } from "element-plus";
import { ElMessage } from "element-plus";
import { debounce } from "@pureadmin/utils";

defineOptions({
  name: "DataUpload"
});

// 表单引用
const formRef = ref<FormInstance>();
const uploadRef = ref<UploadInstance>();

// 表单数据
const formData = ref({
  type: "ad", // 默认选择广告文件上传
  shop: "modernNest" // 默认选择店铺
});

// 上传文件列表
const fileList = ref<UploadProps["fileList"]>([]);

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
    value: "porductID"
  }
];

// 店铺选项
const shopOptions = [
  {
    label: "Modern Nest|泰国",
    value: "modernNest"
  },
  {
    label: "shop07|泰国",
    value: "shop07"
  }
];

// 根据文件名校验后缀（更稳健）
const isValidExt = (name: string) => /\.(csv|xls|xlsx)$/i.test(name);

// 文件上传前的验证
const beforeUpload: UploadProps["beforeUpload"] = file => {
  const okExt = isValidExt(file.name);
  const isLt10 = fileList.value.length < 10;

  if (!okExt) {
    ElMessage.error("只能上传 .csv, .xls, .xlsx 格式的文件!");
    return false;
  }
  if (!isLt10) {
    ElMessage.error("最多只能上传10个文件!");
    return false;
  }
  return true;
};

// 模拟发送上传请求（替换为实际 API 调用）
const sendRequest = (files: File[], type: string) =>
  new Promise<void>(resolve => {
    // 模拟网络延迟
    setTimeout(() => {
      resolve();
    }, 1500);
  });

// 处理上传请求：启动请求后立即清空页面，接口完成后再弹出 toast
const handleUpload = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;

  try {
    await formEl.validate();
  } catch {
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
  fd.append("type", formData.value.type);
  fd.append("shop", formData.value.shop); // 添加店铺信息

  // 启动请求
  const req = sendRequest(filesToSend, formData.value.type);

  // 一旦请求成功发送（即已启动），立即清空页面，允许用户继续操作
  resetForm();
  ElMessage.info("上传请求已发送，正在后台处理...");

  // 等待请求完成，完成后弹出结果通知
  try {
    await req;
    ElMessage.success("文件上传完成");
  } catch {
    ElMessage.error("上传失败，请重试");
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
</script>

<template>
  <div class="data-upload-page">
    <el-card class="upload-card">
      <div class="card-head">
        <h2 class="title">数据上传</h2>
        <p class="subtitle">
          请选择上传类型并上传文件（最多 10
          个）。请勿修改文件名、文件格式或文件内容。
        </p>
      </div>

      <el-form
        ref="formRef"
        :model="formData"
        label-width="120px"
        class="upload-form"
      >
        <el-row :gutter="20" class="row-space">
          <el-col :span="24" lg="12">
            <el-form-item label="选择店铺" prop="shop" required>
              <el-radio-group v-model="formData.shop" class="type-group">
                <el-radio
                  v-for="item in shopOptions"
                  :key="item.value"
                  :label="item.value"
                >
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20" class="row-space">
          <el-col :span="24" lg="12">
            <el-form-item label="上传类型" prop="type" required>
              <el-radio-group v-model="formData.type" class="type-group">
                <el-radio
                  v-for="item in uploadTypes"
                  :key="item.value"
                  :label="item.value"
                >
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>

          <el-col :span="24" lg="12">
            <el-form-item label="当前已选">
              <div class="file-summary">
                <span class="count">{{ fileList.length }} / 10</span>
                <el-button
                  v-if="fileList.length"
                  type="text"
                  size="small"
                  @click="resetForm"
                >
                  清空
                </el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="文件上传" required>
          <el-upload
            ref="uploadRef"
            v-model:file-list="fileList"
            class="upload-demo"
            :auto-upload="false"
            :show-file-list="true"
            :on-exceed="() => ElMessage.warning('最多只能上传10个文件')"
            :before-upload="beforeUpload"
            :limit="10"
            multiple
            accept=".csv,.xls,.xlsx"
            action="#"
          >
            <template #trigger>
              <el-button
                type="primary"
                icon="el-icon-upload"
                text-align="center"
                >选择文件</el-button
              >
            </template>
            <template #tip>
              <div class="el-upload__tip">
                支持格式：.csv / .xls / .xlsx
                。请勿修改文件名、文件格式、文件内容。
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <div class="actions">
            <el-button
              type="primary"
              :disabled="!fileList.length"
              @click="debouncedUpload(formRef)"
            >
              提交上传
            </el-button>

            <el-button v-if="fileList.length" type="default" @click="resetForm">
              取消并清空
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.data-upload-page {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - 100px);
  padding: 28px;
  background: linear-gradient(180deg, #f5f7fa 0%, #fff 100%);
}

.upload-card {
  width: 100%;
  max-width: 980px;
  padding: 20px 22px;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgb(32 45 61 / 8%);
}

.card-head {
  margin-bottom: 12px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #606266;
}

.upload-form {
  margin-top: 12px;
}

.row-space {
  margin-bottom: 6px;
}

.type-group :deep(.el-radio) {
  margin-right: 12px;
}

.file-summary {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #606266;
}

.count {
  padding: 4px 8px;
  font-size: 12px;
  color: #3273dc;
  background: #f0f6ff;
  border-radius: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

:deep(.el-upload__tip) {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

:deep(.el-upload-list__item) {
  border-radius: 6px;
}

@media (width <= 768px) {
  .upload-card {
    padding: 16px;
  }

  .title {
    font-size: 18px;
  }
}
</style>
