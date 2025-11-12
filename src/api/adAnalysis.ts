import { http } from "@/utils/http";

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 阶段消耗数据类型
export interface StageSpendData {
  product_stage?: {
    spend: number;
    roi: number;
  };
  testing_stage?: {
    spend: number;
    roi?: number;
  };
  potential_stage?: {
    spend: number;
    roi?: number;
  };
  abandoned_stage?: {
    spend: number;
    roi?: number;
  };
  no_stage?: {
    spend: number;
    roi?: number;
  };
}

// 单日数据响应类型
export interface DailyDataResponse {
  stages: StageSpendData;
}

// 趋势数据项类型
export interface TrendDataItem {
  date: string;
  product_stage_spend?: number;
  testing_stage_spend?: number;
  potential_stage_spend?: number;
  abandoned_stage_spend?: number;
  no_stage_spend?: number;
  product_stage_roi?: number;
}

// 商品信息类型
export interface ProductItem {
  product_id: string;
  productId?: string;
  title: string;
  main_image?: string;
  mainImage?: string;
  ad_spend?: number;
  adSpend?: number;
  ad_sales?: number;
  adSales?: number;
  roi: number;
}

// 获取单日广告消耗占比
export const getAdRatio = (params: {
  date: string;
  shopID: string;
  shopName: string;
}): Promise<ApiResponse<DailyDataResponse>> => {
  return http.request<ApiResponse<DailyDataResponse>>(
    "get",
    "/api/ad-analysis/ad-ratio",
    {
      params
    }
  );
};

// 获取广告消耗趋势
export const getAdTrend = (params: {
  shopID: string;
  shopName: string;
}): Promise<ApiResponse<TrendDataItem[]>> => {
  return http.request<ApiResponse<TrendDataItem[]>>(
    "get",
    "/api/ad-analysis/ad-trend",
    {
      params
    }
  );
};

// 获取阶段商品列表
export const getStageProducts = (params: {
  date: string;
  shopID: string;
  shopName: string;
  stage: string;
}): Promise<ApiResponse<ProductItem[]>> => {
  return http.request<ApiResponse<ProductItem[]>>(
    "get",
    "/api/ad-analysis/stage-products",
    {
      params
    }
  );
};

