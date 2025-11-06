import { http } from "@/utils/http";

/**
 * 文件上传接口响应类型
 */
export type UploadResponse = {
  success: boolean;
  message?: string;
  data?: any;
};

/**
 * 文件上传接口
 * @param formData FormData 对象，包含文件和其他表单字段
 * @returns Promise<UploadResponse>
 *
 * @example
 * ```typescript
 * // 创建 FormData
 * const fd = new FormData();
 *
 * // 添加文件（支持多个文件）
 * files.forEach(file => {
 *   fd.append('files', file);
 * });
 *
 * // 添加其他字段
 * fd.append('type', 'ad');
 * fd.append('shop', 'modernNest');
 *
 * // 调用接口
 * const result = await uploadData(fd);
 * if (result.success) {
 *   console.log('上传成功');
 * }
 * ```
 */
export const uploadData = (formData: FormData): Promise<UploadResponse> => {
  return http.request<UploadResponse>(
    "post",
    "/api/upload",
    // 将 FormData 作为 data 传递
    { data: formData },
    {
      // 文件上传配置
      // 注意：当使用 FormData 时，axios 会自动设置 Content-Type 为 multipart/form-data
      // 并自动添加 boundary。如果手动设置 Content-Type，需要删除它，让浏览器自动处理
      headers: {
        // 不设置 Content-Type，让 axios 自动处理（会自动添加 boundary）
        // 如果后端需要特定的 Content-Type，可以在这里设置
      },
      // 文件上传需要更长的超时时间
      timeout: 60000 * 10 // 600秒
    }
  );
};
