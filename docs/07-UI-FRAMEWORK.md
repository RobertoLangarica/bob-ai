# bob-ai — UI Framework

## Stack Decision

**Vue 3 + Naive UI + Tailwind CSS** inside a **Tauri** desktop shell.

## Why Naive UI

| Criteria | Naive UI | Vuetify | Element Plus | Headless UI |
|---|---|---|---|---|
| Desktop-native feel | ✅ Clean, minimal | ❌ Material Design | ❌ Enterprise web | ⚠️ No default style |
| TypeScript support | ✅ First-class | ✅ Good | ✅ Good | ✅ Good |
| Tree-shaking | ✅ Full | ⚠️ Partial | ⚠️ Partial | ✅ Full |
| Dark mode | ✅ Built-in | ✅ Built-in | ⚠️ Manual | ⚠️ Manual |
| Bundle size | ✅ Small | ❌ Large | ❌ Large | ✅ Tiny |
| Component richness | ✅ 80+ components | ✅ 70+ | ✅ 60+ | ❌ ~15 |
| Drag-drop support | ⚠️ Pair with lib | ⚠️ Pair with lib | ⚠️ Pair with lib | ❌ None |

### Key Naive UI Components We'll Use

| Component | bob-ai Usage |
|---|---|
| `NLayout` / `NLayoutSider` | Main app layout with sidebar |
| `NMenu` | Navigation sidebar |
| `NCard` | Agent config cards, hook nodes |
| `NModal` | Hook configuration panel |
| `NInput` / `NInputGroup` | Chat input, prompt editors |
| `NSelect` | Model/agent dropdowns |
| `NButton` | Actions (Pause, Resume, Stop) |
| `NTag` | Agent status badges |
| `NTimeline` | Activity feed |
| `NTree` | Knowledge doc browser |
| `NTabs` | View switching |
| `NSwitch` | Hook enable/disable toggles |
| `NNotification` | Agent events, hook results |
| `NScrollbar` | Chat message scrolling |
| `NCollapse` | Expandable agent details |

### For Drag-Drop (Workflow Builder)

Naive UI doesn't include drag-drop. Pair with:
- **VueDraggable Plus** (`vue-draggable-plus`) — Simple sortable lists
- **Vue Flow** (`@vue-flow/core`) — Node-based graph editor (for workflow canvas)

**Recommendation**: Use **Vue Flow** for the workflow builder canvas — it's purpose-built for visual node editors.

```bash
npm install @vue-flow/core @vue-flow/background @vue-flow/controls
```

## Why Tailwind CSS (Alongside Naive UI)

- **Naive UI** handles component styling (buttons, modals, inputs)
- **Tailwind** handles layout, spacing, custom styling, responsive design
- No conflicts — they complement each other

```bash
npm install -D tailwindcss @tailwindcss/vite
```

## Theme Configuration

### Dark Mode (Default)

```typescript
// src/theme.ts
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#6366f1',        // Indigo accent
    primaryColorHover: '#818cf8',
    borderRadius: '8px',
  },
  Card: {
    borderRadius: '12px',
  },
  Button: {
    borderRadiusMedium: '8px',
  },
}

export { darkTheme }
```

### App Setup

```typescript
// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(naive)
app.mount('#app')
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import { darkTheme } from 'naive-ui'
import { themeOverrides } from './theme'
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-notification-provider>
        <router-view />
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>
```

## Dependencies Summary

```json
{
  "dependencies": {
    "vue": "^3.5",
    "vue-router": "^4",
    "pinia": "^3",
    "naive-ui": "^2.40",
    "@vue-flow/core": "^1.40",
    "@vue-flow/background": "^1",
    "@vue-flow/controls": "^1",
    "@tauri-apps/api": "^2",
    "@vueuse/core": "^12"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vite": "^6",
    "@vitejs/plugin-vue": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4"
  }
}
```

## Design Language

### Colors (Dark Theme)

| Role | Color | Usage |
|---|---|---|
| Background | `#18181b` | App background |
| Surface | `#27272a` | Cards, panels |
| Border | `#3f3f46` | Dividers |
| Primary | `#6366f1` | Buttons, links, active states |
| Success | `#22c55e` | Running, completed |
| Warning | `#f59e0b` | Paused, waiting |
| Danger | `#ef4444` | Stopped, errors |
| Text | `#fafafa` | Primary text |
| Muted | `#a1a1aa` | Secondary text |

### Typography
- **Font**: System font stack (SF Pro on macOS via Tauri)
- **Monospace**: `"SF Mono", "Fira Code", monospace` for code blocks

### Spacing
- Use Tailwind spacing scale (`p-2`, `gap-4`, `m-6`)
- Card padding: `p-4` (compact) or `p-6` (spacious)
- Section gaps: `gap-6`
