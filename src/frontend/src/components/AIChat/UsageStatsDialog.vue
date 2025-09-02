<template>
  <el-dialog
    v-model="dialogVisible"
    title="使用统计"
    width="700px"
    @close="handleClose">
    <div class="stats-content" v-if="stats">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-statistic title="总消息数" :value="stats.totalMessages" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="总令牌数" :value="stats.totalTokens" />
        </el-col>
        <el-col :span="8">
          <el-statistic title="命令翻译" :value="stats.totalCommands" />
        </el-col>
      </el-row>
      
      <div class="charts-section">
        <h4>使用趋势</h4>
        <el-empty description="图表功能开发中..." />
      </div>
    </div>
    
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'UsageStatsDialog',
  props: {
    modelValue: Boolean,
    stats: Object
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })
    
    const handleClose = () => {
      dialogVisible.value = false
    }
    
    return {
      dialogVisible,
      handleClose
    }
  }
}
</script>

<style lang="scss" scoped>
.charts-section {
  margin-top: 30px;
  
  h4 {
    margin: 0 0 16px 0;
    color: var(--el-text-color-primary);
  }
}
</style>