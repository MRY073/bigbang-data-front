import "@/utils/sso";
// import Cookies from "js-cookie";
import { getConfig } from "@/config";
import NProgress from "@/utils/progress";
import { transformI18n } from "@/plugins/i18n";
import { buildHierarchyTree } from "@/utils/tree";
import remainingRouter from "./modules/remaining";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
import {
  isUrl,
  openLink,
  cloneDeep,
  isAllEmpty
  // storageLocal
} from "@pureadmin/utils";
import {
  ascending,
  getTopMenu,
  // isOneOfArray,
  getHistoryMode,
  findRouteByPath,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes
} from "./utils";
import {
  type Router,
  type RouteRecordRaw,
  type RouteComponent,
  createRouter
} from "vue-router";
// import {
//   type DataInfo,
//   userKey,
//   removeToken,
//   multipleTabsKey
// } from "@/utils/auth";
import { addPathMatch } from "./utils";
import { checkAuth } from "@/api/user";

/** 自动导入全部静态路由，无需再手动引入！匹配 src/router/modules 目录（任何嵌套级别）中具有 .ts 扩展名的所有文件，除了 remaining.ts 文件
 * 如何匹配所有文件请看：https://github.com/mrmlnc/fast-glob#basic-syntax
 * 如何排除文件请看：https://cn.vitejs.dev/guide/features.html#negative-patterns
 */
const modules: Record<string, any> = import.meta.glob(
  ["./modules/**/*.ts", "!./modules/**/remaining.ts"],
  {
    eager: true
  }
);

/** 原始静态路由（未做任何处理） */
const routes = [];

Object.keys(modules).forEach(key => {
  routes.push(modules[key].default);
});

/** 导出处理后的静态路由（三级及以上的路由全部拍成二级） */
export const constantRoutes: Array<RouteRecordRaw> = formatTwoStageRoutes(
  formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
);

/** 初始的静态路由，用于退出登录时重置路由 */
const initConstantRoutes: Array<RouteRecordRaw> = cloneDeep(constantRoutes);

/** 用于渲染菜单，保持原始层级 */
export const constantMenus: Array<RouteComponent> = ascending(
  routes.flat(Infinity)
).concat(...remainingRouter);

/** 不参与菜单的路由 */
export const remainingPaths = Object.keys(remainingRouter).map(v => {
  return remainingRouter[v].path;
});

/** 创建路由实例 */
export const router: Router = createRouter({
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY),
  routes: constantRoutes.concat(...(remainingRouter as any)),
  strict: true,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(resolve => {
      if (savedPosition) {
        return savedPosition;
      } else {
        if (from.meta.saveSrollTop) {
          const top: number =
            document.documentElement.scrollTop || document.body.scrollTop;
          resolve({ left: 0, top });
        }
      }
    });
  }
});

/** 记录已经加载的页面路径 */
const loadedPaths = new Set<string>();

/** 重置已加载页面记录 */
export function resetLoadedPaths() {
  loadedPaths.clear();
}

/** 重置路由 */
export function resetRouter() {
  router.clearRoutes();
  for (const route of initConstantRoutes.concat(...(remainingRouter as any))) {
    router.addRoute(route);
  }
  router.options.routes = formatTwoStageRoutes(
    formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
  );
  usePermissionStoreHook().clearAllCachePage();
  resetLoadedPaths();
}

/** 路由白名单 */
const whiteList = ["/login"];

// const { VITE_HIDE_HOME } = import.meta.env;

router.beforeEach(async (to: ToRouteType, _from, next) => {
  // 1. 页面加载状态管理
  to.meta.loaded = loadedPaths.has(to.path);
  if (!to.meta.loaded) {
    NProgress.start();
  }

  // 2. Keep-Alive 缓存处理
  if (to.meta?.keepAlive) {
    handleAliveRoute(to, "add");
    // 页面整体刷新和点击标签页刷新
    if (_from.name === undefined || _from.name === "Redirect") {
      handleAliveRoute(to);
    }
  }

  // 3. 页面标题设置
  const externalLink = isUrl(to?.name as string);
  if (!externalLink) {
    to.matched.some(item => {
      if (!item.meta.title) return "";
      const Title = getConfig().Title;
      if (Title)
        document.title = `${transformI18n(item.meta.title)} | ${Title}`;
      else document.title = transformI18n(item.meta.title);
    });
  }

  // 4. 外部链接处理
  if (externalLink) {
    openLink(to?.name as string);
    NProgress.done();
    return;
  }

  // 5. 白名单路由直接放行
  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  // 6. 检查登录状态（调用 /auth/me 接口）
  try {
    const response = await checkAuth();
    // 如果接口返回成功，说明已登录，允许访问
    if (response.success) {
      // 已登录，继续路由导航
    } else {
      // 未登录，跳转到登录页
      next({ path: "/login" });
      return;
    }
  } catch (error) {
    // 接口调用失败（可能是401未登录），跳转到登录页
    // 注意：401错误会在响应拦截器中处理，这里捕获其他错误
    console.error("检查登录状态失败:", error);
    next({ path: "/login" });
    return;
  }

  // 7. 正常导航或页面刷新处理
  if (_from?.name) {
    // 正常导航（有来源路由）
    next();
  } else {
    // 页面刷新处理
    if (
      usePermissionStoreHook().wholeMenus.length === 0 &&
      to.path !== "/login"
    ) {
      // 处理静态路由
      usePermissionStoreHook().handleWholeMenus([]);
      addPathMatch();

      // 处理标签页
      if (!useMultiTagsStoreHook().getMultiTagsCache) {
        const { path } = to;
        const route = findRouteByPath(path, router.options.routes[0].children);
        getTopMenu(true);
        // query、params模式路由传参数的标签页不在此处处理
        if (route && route.meta?.title) {
          if (isAllEmpty(route.parentId) && route.meta?.backstage) {
            // 此处为顶级路由（目录）
            const { path, name, meta } = route.children[0];
            useMultiTagsStoreHook().handleTags("push", {
              path,
              name,
              meta
            });
          } else {
            const { path, name, meta } = route;
            useMultiTagsStoreHook().handleTags("push", {
              path,
              name,
              meta
            });
          }
        }
      }
      // 确保路由正常跳转
      if (isAllEmpty(to.name)) router.push(to.fullPath);
    }
    next();
  }
});

router.afterEach(to => {
  loadedPaths.add(to.path);
  NProgress.done();
});

export default router;
