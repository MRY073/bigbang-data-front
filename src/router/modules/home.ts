import { $t } from "@/plugins/i18n";
import { home } from "@/router/enums";
const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "Home",
  component: Layout,
  redirect: "/dataUpload/index",
  meta: {
    icon: "ep/home-filled",
    title: $t("menus.pureHome"),
    rank: home,
    showLink: false // 隐藏首页菜单项
  },
  children: [
    {
      path: "/welcome",
      name: "Welcome",
      component: () => import("@/views/welcome/index.vue"),
      meta: {
        title: $t("menus.pureHome"),
        showLink: false // 隐藏首页菜单项
      }
    }
  ]
} satisfies RouteConfigsTable;
