import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import { ElMessage } from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import App from './App.vue';
import './styles.css';

const app = createApp(App);

// Global error handler
app.config.errorHandler = (err, _vm, info) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Global Error] ${info}:`, err);
  ElMessage.error({
    message: `应用错误: ${message}`,
    duration: 5000,
    showClose: true,
  });
};

// Register all Element Plus icons globally
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.mount('#app');
