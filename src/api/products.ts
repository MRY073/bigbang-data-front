import { http } from "@/utils/http";

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 阶段时间段对象
export interface StageTimeRange {
  start_time: string | null;
  end_time: string | null;
}

// 后端返回的商品数据结构
export interface BackendProduct {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage: StageTimeRange;
  potential_stage: StageTimeRange;
  product_stage: StageTimeRange;
  abandoned_stage: StageTimeRange;
  custom_category_1?: string | null;
  custom_category_2?: string | null;
  custom_category_3?: string | null;
  custom_category_4?: string | null;
}

// 更新阶段请求参数
export interface UpdateStageParams {
  product_id: string;
  shopID: string;
  shopName: string;
  stage_type: "testing" | "potential" | "product" | "abandoned";
  start_time: string | null;
  end_time: string | null;
}

// 获取商品列表
export const getProducts = (params: {
  shopID: string;
  shopName: string;
  customCategory?: string;
}): Promise<ApiResponse<BackendProduct[]>> => {
  return http.request<ApiResponse<BackendProduct[]>>("get", "/api/products", {
    params
  });
};

// 更新商品阶段
export const updateProductStage = (
  data: UpdateStageParams
): Promise<ApiResponse<void>> => {
  return http.request<ApiResponse<void>>("put", "/api/products/stage", {
    data
  });
};

// 测款监控商品数据类型
export interface TestingMonitorProduct {
  product_id: string;
  product_name: string;
  product_image: string | null;
  testing_stage_start: string | null; // 测款日期开始
  total_visitors: number;
  total_orders: number;
}

// 获取测款监控列表
export const getTestingMonitorProducts = (params: {
  shopID: string;
  shopName: string;
}): Promise<ApiResponse<TestingMonitorProduct[]>> => {
  return http.request<ApiResponse<TestingMonitorProduct[]>>(
    "get",
    "/api/products/testing-monitor",
    {
      params
    }
  );
};
