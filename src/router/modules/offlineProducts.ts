import { offlineProducts } from "@/router/enums";

export default {
  path: "/offline-products",
  redirect: "/offline-products/index",
  meta: {
    icon: "ep/shopping-bag",
    title: "下架商品列表",
    rank: offlineProducts
  },
  children: [
    {
      path: "/offline-products/index",
      name: "OfflineProducts",
      component: () => import("@/views/offlineProducts/index.vue"),
      meta: {
        title: "下架商品列表",
        keepAlive: true
      }
    }
  ]
} satisfies RouteConfigsTable;
