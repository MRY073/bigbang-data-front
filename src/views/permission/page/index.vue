<script setup lang="ts">
import { type CSSProperties, ref, computed } from "vue";
import { useUserStoreHook } from "@/store/modules/user";

defineOptions({
  name: "PermissionPage"
});

const elStyle = computed((): CSSProperties => {
  return {
    width: "85vw",
    justifyContent: "start"
  };
});

const username = ref(useUserStoreHook()?.username);

const options = [
  {
    value: "admin",
    label: "管理员角色"
  },
  {
    value: "common",
    label: "普通角色"
  }
];

function onChange() {
  // 注意：当前项目使用静态路由，不再支持动态路由切换
  // 如需切换角色，请重新登录
  useUserStoreHook()
    .loginByUsername({ username: username.value, password: "admin123" })
    .then(res => {
      if (res.success) {
        // 静态路由模式，无需重新初始化路由
        window.location.reload();
      }
    });
}
</script>

<template>
  <div>
    <p class="mb-2!">
      当前项目使用静态路由模式，所有路由在代码中定义。如需切换角色，请重新登录。
    </p>
    <el-card shadow="never" :style="elStyle">
      <template #header>
        <div class="card-header">
          <span>当前角色：{{ username }}</span>
        </div>
        <el-link
          class="mt-2"
          href="https://github.com/pure-admin/vue-pure-admin/blob/main/src/views/permission/page/index.vue"
          target="_blank"
        >
          代码位置 src/views/permission/page/index.vue
        </el-link>
      </template>
      <el-select v-model="username" class="w-[160px]!" @change="onChange">
        <el-option
          v-for="item in options"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-card>
  </div>
</template>
