import { defineStore } from "pinia";
import {
  type userType,
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import {
  type UserResult,
  type RefreshTokenResult,
  getLogin,
  refreshTokenApi,
  logoutApi
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import { type DataInfo, setToken, removeToken, userKey } from "@/utils/auth";
import Cookies from "js-cookie";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => ({
    // 头像
    avatar: storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "",
    // 前端生成的验证码（按实际需求替换）
    verifyCode: "",
    // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
    currentPage: 0,
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储前端生成的验证码 */
    SET_VERIFYCODE(verifyCode: string) {
      this.verifyCode = verifyCode;
    },
    /** 存储登录页面显示哪个组件 */
    SET_CURRENTPAGE(value: number) {
      this.currentPage = value;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /** 登入 */
    async loginByUsername(data) {
      return new Promise<UserResult>((resolve, reject) => {
        getLogin(data)
          .then(data => {
            resolve(data);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 前端登出 */
    async logOut() {
      try {
        // 调用后端退出登录接口，清除后端的 auth_token Cookie（特别是 HTTP-only Cookie）
        // 如果后端没有退出登录接口，这个调用会失败，但不影响前端清除逻辑
        await logoutApi();
      } catch (error) {
        // 如果后端没有退出登录接口或调用失败，继续执行前端清除逻辑
        console.warn("退出登录接口调用失败，继续执行前端清除逻辑:", error);
      } finally {
        // 清除前端存储的 token 和用户信息
        removeToken();
        // 尝试清除后端设置的 auth_token Cookie（如果 Cookie 不是 HTTP-only，可以清除）
        // 注意：如果 auth_token 是 HTTP-only Cookie，前端无法直接清除，需要通过后端接口清除
        Cookies.remove("auth_token");
        // 清空用户信息
        this.username = "";
        this.avatar = "";
        this.nickname = "";
        // 重置路由
        resetRouter();
        // 跳转到登录页
        router.push("/login");
      }
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
