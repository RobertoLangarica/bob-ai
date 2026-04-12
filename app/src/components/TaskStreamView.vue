<script setup lang="ts">
import { ref } from 'vue'
import { IconFile, IconActivity, ICON_WEIGHT } from '@/icons'
import { neon } from '@/theme'
import { agents } from '@/agents'

const agentStreams = ref([
  {
    agent: agents[0], // Lead — orange
    status: 'completed',
    action: 'Task delegation complete',
    thinking: [
      'Parsed user request for login page',
      'Identified 2 parallel workstreams',
      'Assigned UI Dev → form, Backend → API',
      'Monitoring progress...',
    ],
    tasks: [
      { label: 'Parse request', status: 'completed' },
      { label: 'Plan tasks', status: 'completed' },
      { label: 'Delegate', status: 'completed' },
      { label: 'Monitor', status: 'completed' },
    ],
    files: [],
  },
  {
    agent: agents[1], // UI — purple
    status: 'working',
    action: 'Building LoginForm.vue',
    thinking: [
      'Analyzing existing component patterns...',
      'Using composition API with defineProps',
      'Adding email validation with regex',
      'Wiring up v-model for form fields',
    ],
    tasks: [
      { label: 'Scaffold', status: 'completed' },
      { label: 'Form fields', status: 'completed' },
      { label: 'Validation', status: 'working' },
      { label: 'Styling', status: 'pending' },
      { label: 'Tests', status: 'pending' },
    ],
    files: ['LoginForm.vue', 'useAuth.ts'],
  },
  {
    agent: agents[2], // Backend — cyan
    status: 'working',
    action: 'Writing auth middleware',
    thinking: [
      'Setting up JWT token verification',
      'Creating middleware chain for protected routes',
      'Adding refresh token rotation logic',
    ],
    tasks: [
      { label: 'Schema', status: 'completed' },
      { label: 'Auth API', status: 'working' },
      { label: 'JWT', status: 'pending' },
      { label: 'Tests', status: 'pending' },
    ],
    files: ['auth.ts', 'middleware.ts'],
  },
  {
    agent: agents[3], // Research — green
    status: 'idle',
    action: 'Standing by',
    thinking: [],
    tasks: [],
    files: [],
  },
])

function taskColor(status: string, agentColor: string) {
  if (status === 'completed') return agentColor
  if (status === 'working') return agentColor
  return '#2a2a2e'
}

function taskBg(status: string, agentColor: string) {
  if (status === 'completed') return agentColor + '15'
  if (status === 'working') return agentColor + '15'
  return '#1a1a1d'
}

function taskText(status: string, agentColor: string) {
  if (status === 'completed') return agentColor
  if (status === 'working') return agentColor
  return '#505058'
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
      <div
        v-for="stream in agentStreams" :key="stream.agent.id"
        class="rounded-lg overflow-hidden flex flex-col"
        :style="{
          background: '#111113',
          border: `1px solid ${stream.status === 'idle' ? '#1e1e22' : stream.agent.color + '20'}`,
          opacity: stream.status === 'idle' ? 0.5 : 1,
        }"
      >
        <!-- Agent header row -->
        <div class="flex items-center gap-2 px-3 py-2">
          <n-badge
            dot
            :color="stream.status === 'working' ? stream.agent.color : stream.status === 'completed' ? stream.agent.color : '#505058'"
            :class="stream.status === 'working' ? 'animate-pulse' : ''"
          />
          <component :is="stream.agent.icon" :size="13" :weight="ICON_WEIGHT" :style="{ color: stream.agent.color }" />
          <n-text class="text-[11px] font-medium" :style="{ color: stream.agent.color }">{{ stream.agent.name }}</n-text>
          <n-text class="text-[10px] ml-auto" depth="3">{{ stream.action }}</n-text>
        </div>

        <!-- Task flow + Thinking (side by side on larger, stacked on small) -->
        <div v-if="stream.tasks.length || stream.thinking.length" class="flex flex-col gap-0" style="border-top: 1px solid #1e1e22">

          <!-- Task flow lane -->
          <div v-if="stream.tasks.length" class="flex items-center gap-1 px-3 py-2 overflow-x-auto">
            <div
              v-for="(t, i) in stream.tasks" :key="i"
              class="flex items-center justify-center rounded px-2 py-0.5 shrink-0 relative"
              :style="{
                background: taskBg(t.status, stream.agent.color),
                border: `1px solid ${taskColor(t.status, stream.agent.color)}`,
              }"
            >
              <n-text class="text-[9px] font-medium whitespace-nowrap" :style="{ color: taskText(t.status, stream.agent.color) }">
                {{ t.label }}
              </n-text>
              <span
                v-if="t.status === 'working'"
                class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
                :style="{ background: stream.agent.color }"
              />
            </div>
          </div>

          <!-- Thinking stream (compact) -->
          <div v-if="stream.thinking.length" class="px-3 py-1.5 space-y-0.5" style="border-top: 1px solid #1a1a1d">
            <div
              v-for="(line, i) in stream.thinking" :key="i"
              class="flex items-start gap-1.5"
            >
              <n-text class="text-[9px] font-mono shrink-0" :style="{ color: stream.agent.color, opacity: 0.35 }">›</n-text>
              <n-text
                class="text-[9px] font-mono leading-relaxed"
                :style="{
                  color: stream.agent.color,
                  opacity: i === stream.thinking.length - 1 && stream.status === 'working' ? 0.8 : 0.4,
                }"
              >{{ line }}</n-text>
            </div>
            <div v-if="stream.status === 'working'" class="flex items-center gap-1.5">
              <n-text class="text-[9px] font-mono" :style="{ color: stream.agent.color, opacity: 0.35 }">›</n-text>
              <span class="inline-block w-1 h-2.5 animate-pulse" :style="{ background: stream.agent.color, opacity: 0.5 }" />
            </div>
          </div>
        </div>

        <!-- Idle state -->
        <div v-else class="px-3 py-2 flex items-center" style="border-top: 1px solid #1a1a1d">
          <div class="h-px flex-1" style="background: #2a2a2e" />
          <n-text class="text-[9px] mx-3" depth="3">idle</n-text>
          <div class="h-px flex-1" style="background: #2a2a2e" />
        </div>

        <!-- File chips -->
        <div v-if="stream.files.length" class="px-3 py-1.5 flex flex-wrap gap-1" style="border-top: 1px solid #1a1a1d">
          <div v-for="f in stream.files" :key="f" class="flex items-center gap-0.5 px-1.5 py-0.5 rounded" style="background: #1a1a1d">
            <IconFile :size="9" :weight="ICON_WEIGHT" />
            <n-text class="text-[8px] font-mono" :style="{ color: stream.agent.color }">{{ f }}</n-text>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
