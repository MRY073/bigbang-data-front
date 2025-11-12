import { customCategory } from "@/router/enums";

export default {
  path: "/custom-category",
  redirect: "/custom-category/index",
  meta: {
    icon: "ep/folder-opened",
    title: "自定义分类管理",
    rank: customCategory
  },
  children: [
    {
      path: "/custom-category/index",
      name: "CustomCategory",
      component: () => import("@/views/customCategory/index.vue"),
      meta: {
        title: "自定义分类管理",
        keepAlive: true
      }
    }
  ]
} satisfies RouteConfigsTable;

