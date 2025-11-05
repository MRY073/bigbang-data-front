import { http } from "@/utils/http";

/** 数据上传接口 */
export const uploadData = formData => {
  return http.request("post", "/api/upload", formData);
};
