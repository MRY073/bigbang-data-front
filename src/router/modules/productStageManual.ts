import { productStageManual } from "@/router/enums";

export default {
  path: "/productStageManual",
  redirect: "/productStageManual/index",
  meta: {
    icon: "ep/edit",
    title: "手动设置商品阶段",
    rank: productStageManual
  },
  children: [
    {
      path: "/productStageManual/index",
      name: "ProductStageManual",
      component: () => import("@/views/productStageManual/index.vue"),
      meta: {
        title: "手动设置商品阶段",
        keepAlive: true // ✅ 页面允许缓存
      }
    }
  ]
} satisfies RouteConfigsTable;
