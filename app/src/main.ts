import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import naive from 'naive-ui'
import App from './App.vue'

// ---------------------------------------------------------------------------
// Router — single-page for V0, ready for future multi-page
// ---------------------------------------------------------------------------

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: App,
    },
  ],
})

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(naive)
app.mount('#app')
