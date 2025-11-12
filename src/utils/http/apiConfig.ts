/**
 * API 基础路径配置
 * 开发环境：使用 /api 前缀（通过 vite proxy 代理）
 * 生产环境：不使用 /api 前缀（直接请求后端）
 */
export const getApiBasePath = (): string => {
  // 开发环境返回 /api，生产环境返回空字符串
  return import.meta.env.DEV ? "/api" : "";
};

/**
 * 处理 API URL
 * 根据环境自动添加或移除 /api 前缀
 * @param url 原始 URL
 * @returns 处理后的 URL
 */
export const processApiUrl = (url: string): string => {
  // 如果 URL 以 /api 开头，根据环境处理
  if (url.startsWith("/api")) {
    // 开发环境：保留 /api
    // 生产环境：去掉 /api
    return import.meta.env.DEV ? url : url.replace(/^\/api/, "");
  }
  // 如果 URL 不以 /api 开头，直接返回（保持兼容性）
  return url;
};

