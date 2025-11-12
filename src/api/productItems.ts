import { http } from "@/utils/http";

// 商品项数据类型
export interface ProductItem {
  id?: number;
  product_id: string;
  product_name: string;
  product_image: string | null;
  custom_category_1: string | null;
  custom_category_2: string | null;
  custom_category_3: string | null;
  custom_category_4: string | null;
  [key: string]: any;
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 获取商品列表
export const getProductItems = (params?: {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}): Promise<ApiResponse<ProductItem[]>> => {
  return http.request<ApiResponse<ProductItem[]>>("get", "/api/product-items", {
    params
  });
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
  return http.post<ApiResponse<ProductItem>>("/api/product-items", {
    data
  });
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

