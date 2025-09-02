import { createStore } from 'vuex';
import app from './modules/app';
import hosts from './modules/hosts';
import connections from './modules/connections';
import fileTransfer from './modules/fileTransfer';
import ai from './modules/ai';
import security from './modules/security';
import logs from './modules/logs';
import settings from './modules/settings';

const store = createStore({
  modules: {
    app,
    hosts,
    connections,
    fileTransfer,
    ai,
    security,
    logs,
    settings
  },
  
  strict: process.env.NODE_ENV === 'development'
});

export default store;