import { createRouter, createWebHistory } from 'vue-router';

// 路由组件懒加载
const Dashboard = () => import('../views/Dashboard.vue');
const Connections = () => import('../views/connections/Connections.vue');
const ConnectionDetail = () => import('../views/connections/ConnectionDetail.vue');
const NewConnection = () => import('../views/connections/NewConnection.vue');
const FileTransfer = () => import('../views/files/FileTransfer.vue');
const AIAssistant = () => import('../views/ai/AIAssistant.vue');
const SecurityAudit = () => import('../views/security/SecurityAudit.vue');
const OperationLogs = () => import('../views/logs/OperationLogs.vue');
const Settings = () => import('../views/settings/Settings.vue');

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: {
      title: '仪表板',
      icon: 'Monitor'
    }
  },
  {
    path: '/connections',
    name: 'Connections',
    component: Connections,
    meta: {
      title: '连接管理',
      icon: 'Link'
    }
  },
  {
    path: '/connections/new',
    name: 'NewConnection',
    component: NewConnection,
    meta: {
      title: '新建连接',
      icon: 'Plus',
      parent: 'Connections'
    }
  },
  {
    path: '/connections/:id',
    name: 'ConnectionDetail',
    component: ConnectionDetail,
    props: true,
    meta: {
      title: '连接详情',
      icon: 'Connection',
      parent: 'Connections'
    }
  },
  {
    path: '/files',
    name: 'FileTransfer',
    component: FileTransfer,
    meta: {
      title: '文件传输',
      icon: 'Folder'
    }
  },
  {
    path: '/ai',
    name: 'AIAssistant',
    component: AIAssistant,
    meta: {
      title: 'AI助手',
      icon: 'ChatDotRound'
    }
  },
  {
    path: '/security',
    name: 'SecurityAudit',
    component: SecurityAudit,
    meta: {
      title: '安全审计',
      icon: 'Lock'
    }
  },
  {
    path: '/logs',
    name: 'OperationLogs',
    component: OperationLogs,
    meta: {
      title: '操作日志',
      icon: 'Document'
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: {
      title: '设置',
      icon: 'Setting'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - Temctl`;
  } else {
    document.title = 'Temctl';
  }
  
  next();
});

router.afterEach((to) => {
  // 路由变化后的处理
  console.log(`导航到: ${to.path}`);
});

export default router;