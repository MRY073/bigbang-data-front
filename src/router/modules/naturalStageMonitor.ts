import { naturalStageMonitor } from "@/router/enums";

export default {
  path: "/naturalStageMonitor",
  redirect: "/naturalStageMonitor/index",
  meta: {
    icon: "ep/monitor",
    title: "自然流商品监控",
    rank: naturalStageMonitor
  },
  children: [
    {
      path: "/naturalStageMonitor/index",
      name: "NaturalStageMonitor",
      component: () => import("@/views/naturalStageMonitor/index.vue"),
      meta: {
        title: "自然流商品监控"
      }
    }
  ]
} satisfies RouteConfigsTable;

