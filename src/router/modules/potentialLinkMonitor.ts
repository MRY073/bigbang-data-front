import { potentialLinkMonitor } from "@/router/enums";

export default {
  path: "/potentialLinkMonitor",
  redirect: "/potentialLinkMonitor/index",
  meta: {
    icon: "ep/monitor",
    title: "潜力链接监控",
    rank: potentialLinkMonitor
  },
  children: [
    {
      path: "/potentialLinkMonitor/index",
      name: "PotentialLinkMonitor",
      component: () => import("@/views/potentialLinkMonitor/index.vue"),
      meta: {
        title: "潜力链接监控"
      }
    }
  ]
} satisfies RouteConfigsTable;

