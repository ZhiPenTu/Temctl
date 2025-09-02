import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import './assets/styles/global.scss';

// 创建Vue应用实例
const app = createApp(App);

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 使用插件
app.use(store);
app.use(router);
app.use(ElementPlus, {
  locale: {
    // Element Plus中文语言包
    name: 'zh-cn'
  }
});

// 挂载应用
app.mount('#app');