import { adAnalysis } from "@/router/enums";

export default {
  path: "/adAnalysis",
  redirect: "/adAnalysis/index",
  meta: {
    icon: "ri-pie-chart-2-line",
    title: "广告占比分析",
    rank: adAnalysis
  },
  children: [
    {
      path: "/adAnalysis/index",
      name: "AdAnalysis",
      component: () => import("@/views/adAnalysis/index.vue"),
      meta: {
        title: "广告占比分析"
      }
    }
  ]
} satisfies RouteConfigsTable;