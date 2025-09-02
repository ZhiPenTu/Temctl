// 仪表板组件测试

import { mount } from '@vue/test-utils';
import { createStore } from 'vuex';
import Dashboard from '../../src/frontend/src/views/Dashboard.vue';
import StatCard from '../../src/frontend/src/components/common/StatCard.vue';

// 模拟Vuex store
const createMockStore = () => {
  return createStore({
    modules: {
      hosts: {
        namespaced: true,
        state: {
          hosts: [
            {
              id: '1',
              name: '测试主机1',
              hostname: 'test1.example.com',
              status: 'connected',
              lastConnectedAt: new Date().toISOString()
            },
            {
              id: '2',
              name: '测试主机2',
              hostname: 'test2.example.com',
              status: 'disconnected',
              lastConnectedAt: null
            }
          ]
        },
        getters: {
          connectionStats: (state) => ({
            total: state.hosts.length,
            connected: state.hosts.filter(h => h.status === 'connected').length
          })
        },
        actions: {
          loadHosts: jest.fn(),
          connectHost: jest.fn(),
          updateHost: jest.fn()
        }
      },
      app: {
        namespaced: true,
        actions: {
          initApp: jest.fn()
        }
      }
    }
  });
};

// 模拟Vue Router
const mockRouter = {
  push: jest.fn()
};

describe('Dashboard组件', () => {
  let wrapper;
  let store;

  beforeEach(() => {
    store = createMockStore();
    wrapper = mount(Dashboard, {
      global: {
        plugins: [store],
        mocks: {
          $router: mockRouter
        },
        stubs: {
          'el-card': true,
          'el-button': true,
          'el-tag': true,
          'el-empty': true,
          'el-progress': true,
          'el-message': true,
          'StatCard': StatCard
        }
      }
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  test('应该正确渲染仪表板', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.dashboard').exists()).toBe(true);
    expect(wrapper.find('.dashboard-header h1').text()).toBe('仪表板');
  });

  test('应该显示统计卡片', () => {
    const statsGrid = wrapper.find('.stats-grid');
    expect(statsGrid.exists()).toBe(true);
    
    // 应该有4个统计卡片
    const statCards = wrapper.findAllComponents(StatCard);
    expect(statCards).toHaveLength(4);
  });

  test('应该显示最近连接列表', async () => {
    await wrapper.vm.$nextTick();
    
    const recentConnections = wrapper.find('.recent-connections');
    expect(recentConnections.exists()).toBe(true);
    
    const connectionItems = wrapper.findAll('.connection-item');
    expect(connectionItems.length).toBeGreaterThan(0);
  });

  test('点击快速操作按钮应该导航到相应页面', async () => {
    const newConnectionBtn = wrapper.find('[data-test="new-connection-btn"]');
    if (newConnectionBtn.exists()) {
      await newConnectionBtn.trigger('click');
      expect(mockRouter.push).toHaveBeenCalledWith('/connections/new');
    }
  });

  test('连接主机功能应该正常工作', async () => {
    const connectButton = wrapper.find('[data-test="connect-btn"]');
    if (connectButton.exists()) {
      await connectButton.trigger('click');
      
      // 验证store action被调用
      expect(store.dispatch).toHaveBeenCalledWith('hosts/connectHost', expect.any(String));
    }
  });

  test('应该正确显示连接状态', () => {
    const connectionStats = wrapper.vm.stats.hosts;
    expect(connectionStats.total).toBe(2);
    expect(connectionStats.connected).toBe(1);
  });

  test('系统状态应该正确显示', () => {
    const systemStatus = wrapper.find('.system-status');
    expect(systemStatus.exists()).toBe(true);
    
    const progressBars = wrapper.findAll('[data-test="progress-bar"]');
    expect(progressBars.length).toBeGreaterThan(0);
  });
});