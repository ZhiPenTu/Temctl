<template>
  <div class="stat-card" :style="{ borderLeftColor: color }">
    <div class="stat-icon" :style="{ backgroundColor: color + '20', color }">
      <el-icon><component :is="icon" /></el-icon>
    </div>
    
    <div class="stat-content">
      <div class="stat-value">{{ formattedValue }}</div>
      <div class="stat-title">{{ title }}</div>
      
      <div class="stat-trend" v-if="trend">
        <span class="trend-value">{{ trend.value }}</span>
        <span class="trend-label">{{ trend.label }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'StatCard',
  props: {
    title: {
      type: String,
      required: true
    },
    value: {
      type: [Number, String],
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: '#409eff'
    },
    trend: {
      type: Object,
      default: null
    },
    formatter: {
      type: Function,
      default: null
    }
  },
  setup(props) {
    // 格式化数值
    const formattedValue = computed(() => {
      if (props.formatter) {
        return props.formatter(props.value);
      }
      
      if (typeof props.value === 'number') {
        // 大数字格式化
        if (props.value >= 1000000) {
          return (props.value / 1000000).toFixed(1) + 'M';
        } else if (props.value >= 1000) {
          return (props.value / 1000).toFixed(1) + 'K';
        }
        return props.value.toLocaleString();
      }
      
      return props.value;
    });

    return {
      formattedValue
    };
  }
};
</script>

<style lang="scss" scoped>
.stat-card {
  background: var(--bg-color-overlay);
  border-radius: var(--border-radius-base);
  padding: var(--space-lg);
  border-left: 4px solid var(--primary-color);
  box-shadow: var(--box-shadow-light);
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  transition: all var(--transition-duration);
  
  &:hover {
    box-shadow: var(--box-shadow-dark);
    transform: translateY(-2px);
  }
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color-primary);
    margin-bottom: 4px;
    line-height: 1;
  }
  
  .stat-title {
    font-size: var(--font-size-base);
    color: var(--text-color-secondary);
    margin-bottom: var(--space-sm);
  }
  
  .stat-trend {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    
    .trend-value {
      font-size: var(--font-size-small);
      font-weight: 600;
      color: var(--success-color);
    }
    
    .trend-label {
      font-size: var(--font-size-small);
      color: var(--text-color-placeholder);
    }
  }
}

@media (max-width: 480px) {
  .stat-card {
    flex-direction: column;
    text-align: center;
    
    .stat-content {
      .stat-trend {
        justify-content: center;
      }
    }
  }
}
</style>