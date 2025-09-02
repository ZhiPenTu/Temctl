<template>
  <div class="file-transfer-view">
    <!-- 文件传输界面 - 使用FileTransfer组件 -->
    <FileTransfer />
  </div>
</template>

<script>
import FileTransfer from '../FileTransfer.vue';

export default {
  name: 'FileTransferView',
  components: {
    FileTransfer
  }
};
</script>

<style lang="scss" scoped>
.file-transfer-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>