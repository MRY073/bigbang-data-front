import { http } from "@/utils/http";

// API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 商品卡片数据类型
export interface ProductCard {
  id: string;
  name: string;
  image?: string | null;
  visitorsAvg: number[];
  visitorsVolatilityBaseline: any[];
  adCostAvg: number[];
  adCostVolatilityBaseline: any[];
  salesAvg: number[];
  salesVolatilityBaseline: any[];
  warningLevel: "严重" | "一般" | "轻微" | "正常";
  warningMessages?: string[];
  custom_category_1?: string | null;
  custom_category_2?: string | null;
  custom_category_3?: string | null;
  custom_category_4?: string | null;
}

// AI建议响应类型
export interface AISuggestionResponse {
  suggestion?: string;
}

// 获取已完成链接监控列表
export const getFinishedLinkMonitorList = (params: {
  shopID: string;
  shopName: string;
  date: string;
  customCategory?: string;
}): Promise<ApiResponse<ProductCard[]>> => {
  return http.request<ApiResponse<ProductCard[]>>(
    "get",
    "/api/finished/link/monitor/list",
    {
      params
    }
  );
};

// 获取已完成链接监控的AI建议
export const getFinishedLinkMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
  productID: string;
  productName: string;
}): Promise<ApiResponse<AISuggestionResponse>> => {
  return http.request<ApiResponse<AISuggestionResponse>>(
    "get",
    "/api/finished/link/monitor/ai-suggestion",
    {
      params
    }
  );
};

// 获取潜力链接监控列表
export const getPotentialLinkMonitorList = (params: {
  shopID: string;
  shopName: string;
  date: string;
  customCategory?: string;
}): Promise<ApiResponse<ProductCard[]>> => {
  return http.request<ApiResponse<ProductCard[]>>(
    "get",
    "/api/potential/link/monitor/list",
    {
      params
    }
  );
};

// 获取潜力链接监控的AI建议
export const getPotentialLinkMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
  productID: string;
  productName: string;
}): Promise<ApiResponse<AISuggestionResponse>> => {
  return http.request<ApiResponse<AISuggestionResponse>>(
    "get",
    "/api/potential/link/monitor/ai-suggestion",
    {
      params
    }
  );
};

// 批量AI建议响应类型
export interface BatchAISuggestionResponse {
  status: "new" | "running" | "exists"; // new: 新增任务, running: 正在执行, exists: 已存在
  message?: string;
}

// 批量获取已完成链接监控的AI建议
export const batchGetFinishedLinkMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
}): Promise<ApiResponse<BatchAISuggestionResponse>> => {
  return http.request<ApiResponse<BatchAISuggestionResponse>>(
    "post",
    "/api/finished/link/monitor/batch-ai-suggestion",
    {
      data: params
    }
  );
};

// 批量获取潜力链接监控的AI建议
export const batchGetPotentialLinkMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
}): Promise<ApiResponse<BatchAISuggestionResponse>> => {
  return http.request<ApiResponse<BatchAISuggestionResponse>>(
    "post",
    "/api/potential/link/monitor/batch-ai-suggestion",
    {
      data: params
    }
  );
};

// 获取自然流商品监控列表
export const getNaturalStageMonitorList = (params: {
  shopID: string;
  shopName: string;
  date: string;
  customCategory?: string;
}): Promise<ApiResponse<ProductCard[]>> => {
  return http.request<ApiResponse<ProductCard[]>>(
    "get",
    "/api/natural/stage/monitor/list",
    {
      params
    }
  );
};

// 获取自然流商品监控的AI建议
export const getNaturalStageMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
  productID: string;
  productName: string;
}): Promise<ApiResponse<AISuggestionResponse>> => {
  return http.request<ApiResponse<AISuggestionResponse>>(
    "get",
    "/api/natural/stage/monitor/ai-suggestion",
    {
      params
    }
  );
};

// 批量获取自然流商品监控的AI建议
export const batchGetNaturalStageMonitorAISuggestion = (params: {
  shopID: string;
  shopName: string;
  date: string;
}): Promise<ApiResponse<BatchAISuggestionResponse>> => {
  return http.request<ApiResponse<BatchAISuggestionResponse>>(
    "post",
    "/api/natural/stage/monitor/batch-ai-suggestion",
    {
      data: params
    }
  );
};

