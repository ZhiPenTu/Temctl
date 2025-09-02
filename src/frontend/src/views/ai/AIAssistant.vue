<template>
  <div class="ai-assistant">
    <!-- AI助手界面 - 使用AIChat组件 -->
    <AIChat />
  </div>
</template>

<script>
import AIChat from '../AIChat.vue';

export default {
  name: 'AIAssistant',
  components: {
    AIChat
  }
};
</script>

<style lang="scss" scoped>
.ai-assistant {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>