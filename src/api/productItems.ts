import { http } from "@/utils/http";

// 商品项数据类型
export interface ProductItem {
  id?: number;
  product_id: string;
  product_name: string;
  product_image: string | null;
  status?: number; // 0=上架，1=下架
  custom_category_1: string | null;
  custom_category_2: string | null;
  custom_category_3: string | null;
  custom_category_4: string | null;
  prompt_note?: string | null; // 提示词备注
  [key: string]: any;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 分页响应类型
export interface PaginatedApiResponse<T = any> extends ApiResponse<T> {
  total?: number;
}

// 获取商品列表
export const getProductItems = (params?: {
  page?: number;
  pageSize?: number;
  shopID?: string;
  shopName?: string;
  customCategory?: string;
  [key: string]: any;
}): Promise<PaginatedApiResponse<ProductItem[]>> => {
  return http.request<PaginatedApiResponse<ProductItem[]>>(
    "get",
    "/api/product-items",
    {
      params
    }
  );
};

// 获取单个商品
export const getProductItem = (
  id: number | string
): Promise<ApiResponse<ProductItem>> => {
  return http.request<ApiResponse<ProductItem>>(
    "get",
    `/api/product-items/${id}`
  );
};

// 创建商品
export const createProductItem = (
  data: Partial<ProductItem>
): Promise<ApiResponse<ProductItem>> => {
  return http.post<ApiResponse<ProductItem>, Partial<ProductItem>>(
    "/api/product-items",
    {
      data
    }
  );
};

// 更新商品
export const updateProductItem = (
  id: number | string,
  data: Partial<ProductItem>
): Promise<ApiResponse<ProductItem>> => {
  return http.request<ApiResponse<ProductItem>>(
    "put",
    `/api/product-items/${id}`,
    {
      data
    }
  );
};

// 删除商品
export const deleteProductItem = (
  id: number | string
): Promise<ApiResponse<void>> => {
  return http.request<ApiResponse<void>>("delete", `/api/product-items/${id}`);
};

// 获取自定义分类选项
export const getCustomCategoryOptions = (params?: {
  shopID?: string;
}): Promise<ApiResponse<string[]>> => {
  return http.request<ApiResponse<string[]>>(
    "get",
    "/api/product-items/custom-categories",
    {
      params
    }
  );
};

// 更新商品上下架状态（0=上架，1=下架）
export const updateProductItemStatus = (
  id: string | number,
  status: 0 | 1
): Promise<ApiResponse<ProductItem>> => {
  return http.request<ApiResponse<ProductItem>>(
    "put",
    `/api/product-items/${id}/status`,
    {
      data: { status }
    }
  );
};

// 获取已下架商品列表
export const getOfflineProductItems = (params: {
  shopID: string; // 必填：店铺ID
  shopName: string; // 必填：店铺名称
  page?: number; // 可选：页码，默认 1
  pageSize?: number; // 可选：每页数量，默认 20，最大 100
  customCategory?: string; // 可选：自定义分类筛选
}): Promise<PaginatedApiResponse<ProductItem[]>> => {
  return http.request<PaginatedApiResponse<ProductItem[]>>(
    "get",
    "/api/product-items/offline",
    {
      params
    }
  );
};
