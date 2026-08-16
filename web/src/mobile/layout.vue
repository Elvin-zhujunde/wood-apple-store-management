<template>
  <div class="m-shell">
    <router-view />
  </div>
</template>
<script setup>
import '@vant/touch-emulator'
</script>
<style scoped>
.m-shell { min-height:100vh; background:#f7f8fa; max-width:640px; margin:0 auto }
</style>
