import { finishedLinkMonitor } from "@/router/enums";

export default {
  path: "/finishedLinkMonitor",
  redirect: "/finishedLinkMonitor/index",
  meta: {
    icon: "ri-monitor-line",
    title: "成品链接监控",
    rank: finishedLinkMonitor
  },
  children: [
    {
      path: "/finishedLinkMonitor/index",
      name: "FinishedLinkMonitor",
      component: () => import("@/views/finishedLinkMonitor/index.vue"),
      meta: {
        title: "成品链接监控",
        keepAlive: false
      }
    }
  ]
} satisfies RouteConfigsTable;
