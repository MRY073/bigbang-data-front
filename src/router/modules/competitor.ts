import { competitor } from "@/router/enums";

export default {
  path: "/competitor",
  redirect: "/competitor/index",
  meta: {
    icon: "ep/connection",
    title: "竞争对手",
    rank: competitor
  },
  children: [
    {
      path: "/competitor/index",
      name: "Competitor",
      component: () => import("@/views/competitor/index.vue"),
      meta: {
        title: "竞争对手",
        keepAlive: true // ✅ 页面允许缓存
      }
    }
  ]
} satisfies RouteConfigsTable;

