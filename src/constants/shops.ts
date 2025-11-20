/**
 * 店铺相关常量
 */

export interface ShopOption {
  label: string;
  value: string;
}

/**
 * 店铺选项列表
 */
export const shopOptions: ShopOption[] = [
  {
    label: "Modern Nest|泰国",
    value: "1489850435"
  },
  {
    label: "shop07|泰国",
    value: "1638595255"
  }
];

/**
 * 默认店铺ID
 */
export const DEFAULT_SHOP_ID = "1489850435";

/**
 * 根据店铺ID获取店铺名称
 * @param shopId 店铺ID
 * @returns 店铺名称，如果未找到则返回空字符串
 */
export function getShopName(shopId: string): string {
  const shop = shopOptions.find(opt => opt.value === shopId);
  return shop?.label || "";
}

/**
 * 根据店铺ID获取店铺选项
 * @param shopId 店铺ID
 * @returns 店铺选项，如果未找到则返回 undefined
 */
export function getShopOption(shopId: string): ShopOption | undefined {
  return shopOptions.find(opt => opt.value === shopId);
}

