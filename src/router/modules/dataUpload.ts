import { dataUpload } from "@/router/enums";

export default {
  path: "/dataUpload",
  redirect: "/dataUpload/index",
  meta: {
    icon: "ri/upload-cloud-2-line",
    title: "数据上传",
    rank: dataUpload // 你可以根据需要调整菜单排序
  },
  children: [
    {
      path: "/dataUpload/index",
      name: "DataUpload",
      component: () => import("@/views/dataUpload/index.vue"),
      meta: {
        icon: "ri/upload-cloud-2-line",
        title: "数据上传"
      }
    }
  ]
} satisfies RouteConfigsTable;
