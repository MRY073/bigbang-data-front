import { trialLinkMonitor } from "@/router/enums";

export default {
  path: "/trialLinkMonitor",
  redirect: "/trialLinkMonitor/index",
  meta: {
    icon: "ri/links-line",
    title: "测款链接监控",
    rank: trialLinkMonitor
  },
  children: [
    {
      path: "/trialLinkMonitor/index",
      name: "TrialLinkMonitor",
      component: () => import("@/views/trialLinkMonitor/index.vue"),
      meta: {
        title: "测款链接监控"
      }
    }
  ]
} satisfies RouteConfigsTable;
