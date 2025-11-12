<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import TypeIt from "@/components/ReTypeit";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useEventListener } from "@vueuse/core";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { operates, thirdParty } from "./utils/enums";
import { useLayout } from "@/layout/hooks/useLayout";
import LoginPhone from "./components/LoginPhone.vue";
import LoginRegist from "./components/LoginRegist.vue";
import LoginUpdate from "./components/LoginUpdate.vue";
import LoginQrCode from "./components/LoginQrCode.vue";
import { useUserStoreHook } from "@/store/modules/user";
import { getTopMenu, addPathMatch } from "@/router/utils";
import { illustration } from "./utils/static";
// import { ReImageVerify } from "@/components/ReImageVerify";
import { ref, toRaw, reactive, computed } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { usePermissionStoreHook } from "@/store/modules/permission";
import type { Options as TypeItOptions } from "typeit";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";
import Keyhole from "~icons/ri/shield-keyhole-line";

defineOptions({
  name: "Login"
});

const imgCode = ref("");
// const loginDay = ref(7); // 注：7天内免登录已注释
const router = useRouter();
const loading = ref(false);
// const checked = ref(false); // 注：记住我已注释
const disabled = ref(false);
const ruleFormRef = ref<FormInstance>();
const currentPage = computed(() => {
  return useUserStoreHook().currentPage;
});

const { t } = useI18n();
const { initStorage } = useLayout();
initStorage();
const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const { locale, translationCh, translationEn } = useTranslationLang();

const ruleForm = reactive({
  username: "",
  password: ""
});

const typeItOptions: TypeItOptions = {
  strings: [
    "激活你的数据多巴胺 ⚡",
    "洞察业务高光瞬间 🌈",
    "把经营分析调到最上头 💥"
  ],
  speed: 52,
  lifeLike: true,
  breakLines: false,
  waitUntilVisible: true,
  loop: true,
  nextStringDelay: 1200,
  cursorChar: "▋",
  deleteSpeed: 36
};

const dopamineHighlights = [
  "实时经营诊断",
  "AI 智能解读",
  "多维协同分析",
  "可视化体验升级"
];

const brandText = computed(() =>
  (title.value || "Bigbang Data Front").toUpperCase()
);

const onLogin = async (formEl: FormInstance | undefined) => {
  // 校验密码强度
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: ruleForm.password
        })
        .then(res => {
          if (res.success) {
            // 全部采取静态路由模式
            usePermissionStoreHook().handleWholeMenus([]);
            addPathMatch();
            router.push(getTopMenu(true).path);
            message(t("login.pureLoginSuccess"), { type: "success" });
            loading.value = false;
          } else {
            message(res.message, { type: "error" });
          }
        })
        .finally(() => (loading.value = false));
    }
  });
};

const immediateDebounce: any = debounce(
  formRef => onLogin(formRef),
  1000,
  true
);

useEventListener(document, "keydown", ({ code }) => {
  if (
    ["Enter", "NumpadEnter"].includes(code) &&
    !disabled.value &&
    !loading.value
  )
    immediateDebounce(ruleFormRef.value);
});

// 注：记住我、7天免登录相关逻辑已注释
// 注：验证码相关已注释，不再同步 verifyCode
</script>

<template>
  <div class="login-page select-none">
    <div class="dopamine-background">
      <span class="blob blob-1" />
      <span class="blob blob-2" />
      <span class="blob blob-3" />
      <span class="beam beam-1" />
      <span class="beam beam-2" />
      <span class="grid-layer" />
    </div>

    <header class="login-toolbar">
      <Motion>
        <div class="brand">
          <span class="brand-badge">{{ brandText }}</span>
          <p class="brand-subtitle">
            {{ (title || "奇点比格邦经营数据中台") + " · Dopamine Mode" }}
          </p>
        </div>
      </Motion>
      <div class="toolbar-actions">
        <el-switch
          v-model="dataTheme"
          inline-prompt
          :active-icon="dayIcon"
          :inactive-icon="darkIcon"
          @change="dataThemeChange"
        />
        <el-dropdown trigger="click">
          <globalization class="lang-trigger" />
          <template #dropdown>
            <el-dropdown-menu class="translation">
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'zh')"
                :class="[
                  'dark:text-white!',
                  getDropdownItemClass(locale, 'zh')
                ]"
                @click="translationCh"
              >
                <IconifyIconOffline
                  v-show="locale === 'zh'"
                  class="check-zh"
                  :icon="Check"
                />
                简体中文
              </el-dropdown-item>
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'en')"
                :class="[
                  'dark:text-white!',
                  getDropdownItemClass(locale, 'en')
                ]"
                @click="translationEn"
              >
                <span v-show="locale === 'en'" class="check-en">
                  <IconifyIconOffline :icon="Check" />
                </span>
                English
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <main class="login-wrapper">
      <section class="login-showcase">
        <Motion :delay="80">
          <h1 class="showcase-title">
            奇点比格邦经营数据中台
            <span class="title-highlight">LOGIN</span>
          </h1>
        </Motion>
        <Motion :delay="160">
          <TypeIt :options="typeItOptions">
            <span class="type-it showcase-type" />
          </TypeIt>
        </Motion>
        <Motion :delay="240">
          <p class="showcase-description">
            以更上头的色彩节奏和设计语言，点燃你对数据的灵感，实时把握经营高光时刻。
          </p>
        </Motion>
        <Motion :delay="320">
          <div class="showcase-chips">
            <span v-for="chip in dopamineHighlights" :key="chip" class="chip">
              {{ chip }}
            </span>
          </div>
        </Motion>
        <Motion :delay="380">
          <div class="illustration-card">
            <component :is="toRaw(illustration)" />
          </div>
        </Motion>
      </section>

      <section class="login-panel">
        <Motion>
          <div class="panel-header">
            <span class="panel-tag">Welcome Back</span>
            <h2>登录即刻点亮数据灵感</h2>
            <p>输入账号密码，沉浸式启动多巴胺级别的经营分析体验。</p>
          </div>
        </Motion>

        <Motion :delay="140">
          <el-form
            v-if="currentPage === 0"
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
            class="login-form"
          >
            <Motion :delay="60">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: transformI18n($t('login.pureUsernameReg')),
                    trigger: 'blur'
                  }
                ]"
                prop="username"
              >
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  :placeholder="t('login.pureUsername')"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="120">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  :placeholder="t('login.purePassword')"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>

            <!-- 验证码模块已注释，如需恢复，取消注释以下代码 -->
            <!--
            <Motion :delay="180">
              <el-form-item prop="verifyCode">
                <el-input
                  v-model="ruleForm.verifyCode"
                  clearable
                  :placeholder="t('login.pureVerifyCode')"
                  :prefix-icon="useRenderIcon(Keyhole)"
                >
                  <template #append>
                    <ReImageVerify v-model:code="imgCode" />
                  </template>
                </el-input>
              </el-form-item>
            </Motion>
            -->

            <Motion :delay="200">
              <el-form-item>
                <div class="form-actions">
                  <!-- <el-button
                    link
                    type="primary"
                    @click="useUserStoreHook().SET_CURRENTPAGE(4)"
                  >
                    {{ t("login.pureForget") }}
                  </el-button> -->
                </div>
                <el-button
                  class="submit-btn"
                  size="default"
                  type="primary"
                  :loading="loading"
                  :disabled="disabled"
                  @click="onLogin(ruleFormRef)"
                >
                  {{ t("login.pureLogin") }}
                </el-button>
              </el-form-item>
            </Motion>

            <!-- <Motion :delay="260">
              <el-form-item>
                <div class="w-full h-[20px] flex justify-between items-center">
                  <el-button
                    v-for="(item, index) in operates"
                    :key="index"
                    class="w-full mt-4!"
                    size="default"
                    @click="useUserStoreHook().SET_CURRENTPAGE(index + 1)"
                  >
                    {{ t(item.title) }}
                  </el-button>
                </div>
              </el-form-item>
            </Motion> -->
          </el-form>
        </Motion>

        <!-- <Motion v-if="currentPage === 0" :delay="220">
          <el-form-item>
            <el-divider>
              <p class="text-gray-500 text-xs">
                {{ t("login.pureThirdLogin") }}
              </p>
            </el-divider>
            <div class="w-full flex justify-evenly">
              <span
                v-for="(item, index) in thirdParty"
                :key="index"
                :title="t(item.title)"
              >
                <IconifyIconOnline
                  :icon="`ri:${item.icon}-fill`"
                  width="20"
                  class="cursor-pointer text-gray-500 hover:text-blue-400"
                />
              </span>
            </div>
          </el-form-item>
        </Motion> -->
        <!-- 手机号登录 -->
        <!-- <LoginPhone v-if="currentPage === 1" /> -->
        <!-- 二维码登录 -->
        <!-- <LoginQrCode v-if="currentPage === 2" /> -->
        <!-- 注册 -->
        <!-- <LoginRegist v-if="currentPage === 3" /> -->
        <!-- 忘记密码 -->
        <!-- <LoginUpdate v-if="currentPage === 4" /> -->
      </section>
    </main>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.translation {
  ::v-deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-zh {
    position: absolute;
    left: 20px;
  }

  .check-en {
    position: absolute;
    left: 20px;
  }
}
</style>
