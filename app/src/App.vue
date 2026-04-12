<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { darkTheme } from 'naive-ui'
import { themeOverrides, neon } from './theme'
import { getAgentColor } from './agents'
import {
  IconBob,
  IconUser,
  IconTeam,
  IconSettings,
  IconNew,
  IconSend,
  IconLead,
  IconUI,
  IconBackend,
  IconResearch,
  IconSuccess,
  IconWorking,
  IconActivity,
  IconFile,
  IconCustomize,
  IconCreate,
  IconCode,
  IconNewTeam,
  IconNewTeamAlt1,
  IconNewTeamAlt2,
  IconNewTeamAlt3,
  ICON_WEIGHT,
  ICON_SIZE,
  ICON_SIZE_SM,
} from './icons'
import OrbitalView from './components/OrbitalView.vue'
import TaskStreamView from './components/TaskStreamView.vue'

// ── Types ─────────────────────────────────────────────
interface Message {
  id: string
  from: 'user' | 'bob' | 'agent'
  agentName?: string
  agentIcon?: string
  text: string
  time: Date
  type: 'text' | 'card' | 'activity' | 'verbose'
  activities?: Activity[]
  thinking?: string[]
  thinkingCollapsed?: boolean
}
interface Activity {
  name: string
  icon: string
  status: 'working' | 'completed' | 'error'
  action: string
  files?: string[]
}
interface Team {
  id: string
  name: string
  icon: string
  status: 'idle' | 'running' | 'paused'
}

// ── Top-level mode ────────────────────────────────────
const mode = ref<'chat' | 'activity'>('chat')
const activityView = ref<'orbital' | 'tasks'>('orbital')
const menuOpen = ref(false)

// ── State ─────────────────────────────────────────────
const currentView = ref<'bob' | string>('swe')
const input = ref('')
const scrollEl = ref<HTMLElement>()
const teams = ref<Team[]>([
  { id: 'swe', name: 'SWE Team', icon: 'team', status: 'running' },
  { id: 'research', name: 'Research Team', icon: 'research', status: 'idle' },
])
const currentTeam = computed(() => teams.value.find((t) => t.id === currentView.value))
const currentLabel = computed(() => {
  if (currentView.value === 'bob') return 'BoB'
  return currentTeam.value?.name || 'BoB'
})
const peekTeams = computed(() => {
  // Show other teams for the stacked peek (no BoB — it's the brand, not a menu item)
  const others = teams.value.filter((t) => t.id !== currentView.value)
  return others.slice(0, 3)
})

// ── Chat histories ────────────────────────────────────
const chats = ref<Record<string, Message[]>>({
  bob: [
    {
      id: 'w1',
      from: 'bob',
      text: "Hey! I'm BoB. I can set up AI teams for your projects. What are you working on?",
      time: new Date(),
      type: 'text',
    },
  ],
  swe: [
    {
      id: 's1',
      from: 'user',
      text: 'Add a login page with email/password auth',
      time: new Date(Date.now() - 45 * 60000),
      type: 'text',
    },
    {
      id: 's2',
      from: 'agent',
      agentName: 'Team Lead',
      agentIcon: 'lead',
      text: "I'll coordinate this. Breaking it down into parallel workstreams for UI and Backend.",
      time: new Date(Date.now() - 44 * 60000),
      type: 'verbose',
      thinking: [
        'Analyzing request: "login page with email/password auth"',
        'This requires both frontend UI work and backend API work',
        'These can be parallelized — UI form + Backend auth API',
        'UI Dev → LoginForm component with validation',
        'Backend Dev → POST /auth/login, /auth/register, JWT middleware',
        'No research needed, standard auth pattern',
      ],
      thinkingCollapsed: true,
    },
    {
      id: 's3',
      from: 'agent',
      agentName: 'UI Developer',
      agentIcon: 'ui',
      text: 'Starting on the login form. Will use composition API with proper validation.',
      time: new Date(Date.now() - 43 * 60000),
      type: 'verbose',
      thinking: [
        'Checking existing component patterns in src/components/',
        'Found: uses <script setup> + defineProps pattern',
        'Will create LoginForm.vue with email + password fields',
        'Adding Zod schema for client-side validation',
        'Using existing useAuth composable as base',
      ],
      thinkingCollapsed: true,
    },
    {
      id: 's4',
      from: 'agent',
      agentName: 'Backend Dev',
      agentIcon: 'backend',
      text: 'Setting up auth endpoints and JWT middleware.',
      time: new Date(Date.now() - 42 * 60000),
      type: 'verbose',
      thinking: [
        'Reviewing existing API structure in src/api/',
        'Using Express router pattern from other endpoints',
        'bcrypt for password hashing, jsonwebtoken for JWT',
        'Creating: POST /api/auth/login, POST /api/auth/register',
        'Adding auth middleware to verify JWT on protected routes',
        'Implementing refresh token rotation for security',
      ],
      thinkingCollapsed: true,
    },
    {
      id: 's5',
      from: 'agent',
      agentName: 'Activity',
      agentIcon: 'activity',
      text: '',
      time: new Date(Date.now() - 40 * 60000),
      type: 'activity',
      activities: [
        {
          name: 'UI Developer',
          icon: 'ui',
          status: 'completed',
          action: 'Created login form component with validation',
          files: ['src/components/LoginForm.vue', 'src/composables/useAuth.ts'],
        },
        {
          name: 'Backend Dev',
          icon: 'backend',
          status: 'completed',
          action: 'Auth API endpoints and JWT middleware',
          files: ['src/api/auth.ts', 'src/middleware/auth.ts'],
        },
      ],
    },
    {
      id: 's6',
      from: 'agent',
      agentName: 'Team Lead',
      agentIcon: 'lead',
      text: '✅ Login page complete.\n\n• LoginForm.vue with email/password fields and Zod validation\n• POST /api/auth/login and /register endpoints\n• JWT token middleware with refresh rotation\n• 8 tests passing across both workstreams',
      time: new Date(Date.now() - 30 * 60000),
      type: 'verbose',
      thinking: [
        'UI Dev completed: LoginForm.vue ✓',
        'Backend Dev completed: auth.ts, middleware ✓',
        'All 8 tests passing (5 backend, 3 frontend)',
        'Integration verified — form submits to correct endpoint',
        'No conflicts between workstreams',
        'Ready to report completion to user',
      ],
      thinkingCollapsed: true,
    },
  ],
  research: [],
})
const messages = computed(() => chats.value[currentView.value] || [])

// ── Helpers ───────────────────────────────────────────
function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function scrollBottom() {
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  })
}

function nav(id: string) {
  currentView.value = id
  mode.value = 'chat'
  menuOpen.value = false
  nextTick(() => scrollBottom())
}

function newTeam() {
  currentView.value = 'bob'
  mode.value = 'chat'
  nextTick(() => scrollBottom())
}

function toggleThinking(msg: Message) {
  msg.thinkingCollapsed = !msg.thinkingCollapsed
}

function agentColor(iconKey?: string) {
  return iconKey ? getAgentColor(iconKey) : '#707078'
}

function send() {
  const text = input.value.trim()
  if (!text) return
  const view = currentView.value
  if (!chats.value[view]) chats.value[view] = []
  chats.value[view].push({
    id: `u-${Date.now()}`,
    from: 'user',
    text,
    time: new Date(),
    type: 'text',
  })
  input.value = ''
  scrollBottom()
  if (view === 'bob') {
    setTimeout(() => {
      const isTeamReq = /team|build|react|project|app|create/i.test(text)
      chats.value.bob.push({
        id: `b-${Date.now()}`,
        from: 'bob',
        text: isTeamReq
          ? 'I can set up a team for that. How does this look?'
          : "Tell me about your project and I'll suggest a team for you.",
        time: new Date(),
        type: isTeamReq ? 'card' : 'text',
      })
      scrollBottom()
    }, 500)
  } else {
    setTimeout(() => {
      chats.value[view].push({
        id: `l-${Date.now()}`,
        from: 'agent',
        agentName: 'Team Lead',
        agentIcon: 'lead',
        text: "On it. I'll break this down and get the team started.",
        time: new Date(),
        type: 'verbose',
        thinking: [
          `Analyzing request: "${text}"`,
          'Determining which agents are needed...',
          'Creating task breakdown...',
        ],
        thinkingCollapsed: false,
      })
      scrollBottom()
      setTimeout(() => {
        chats.value[view].push({
          id: `a-${Date.now()}`,
          from: 'agent',
          agentName: 'Activity',
          agentIcon: 'activity',
          text: '',
          time: new Date(),
          type: 'activity',
          activities: [
            { name: 'UI Developer', icon: 'ui', status: 'working', action: 'Working on it...' },
            { name: 'Backend Dev', icon: 'backend', status: 'working', action: 'Working on it...' },
          ],
        })
        scrollBottom()
      }, 1200)
    }, 600)
  }
}

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
}

const iconMap: Record<string, any> = {
  bob: IconBob,
  user: IconUser,
  team: IconTeam,
  lead: IconLead,
  ui: IconUI,
  backend: IconBackend,
  research: IconResearch,
  success: IconSuccess,
  working: IconWorking,
  activity: IconActivity,
  file: IconFile,
}
function getIcon(key: string) {
  return iconMap[key] || IconTeam
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <!-- Compact window wrapper -->
    <div class="h-screen w-screen flex items-center justify-center" style="background: #080809">
      <div
        class="flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style="width: 720px; height: 520px; background: #0d0d0f; border: 1px solid #2a2a2e"
      >
        <!-- ── Top Nav Bar ───────────────────────── -->
        <div
          class="flex items-center gap-1 px-3 py-1.5 shrink-0"
          style="border-bottom: 1px solid #2a2a2e"
        >
          <!-- BoB avatar → hoverable team menu -->
          <n-popover
            trigger="hover"
            placement="bottom-start"
            :show-arrow="false"
            :delay="150"
            raw
            style="padding: 0"
            v-model:show="menuOpen"
          >
            <template #trigger>
              <div class="flex flex-col cursor-pointer py-0.5" style="min-width: 120px">
                <!-- Primary: current selection -->
                <div class="flex items-center gap-2 px-1.5 py-0.5 rounded-md transition-colors">
                  <n-avatar
                    :size="18"
                    round
                    :style="{
                      background: '#0D0D0F',
                      border: `1px solid ${neon.cyan}40`,
                      flexShrink: 0,
                    }"
                  >
                    <IconBob :size="10" :weight="ICON_WEIGHT" :style="{ color: neon.cyan }" />
                  </n-avatar>
                  <span class="text-[11px] font-medium" style="color: #e0e0e4">{{
                    currentLabel
                  }}</span>
                  <span
                    class="text-[8px] transition-opacity"
                    :style="{ color: '#404048', opacity: menuOpen ? 0 : 0.6 }"
                    >▾</span
                  >
                </div>
                <!-- Peek: stacked teams below with alpha fade -->
                <div
                  v-if="!menuOpen"
                  class="relative overflow-hidden"
                  style="height: 20px; margin-left: 2px"
                >
                  <div
                    v-for="(team, i) in peekTeams"
                    :key="team.id"
                    class="flex items-center gap-2 px-1.5"
                    :style="{
                      height: '13px',
                      opacity: i === 0 ? 0.3 : 0.12,
                      marginTop: i === 0 ? '1px' : '0',
                    }"
                  >
                    <component
                      :is="getIcon(team.icon)"
                      :size="9"
                      :weight="ICON_WEIGHT"
                      style="color: #606068"
                    />
                    <span class="text-[9px]" style="color: #606068">{{ team.name }}</span>
                  </div>
                  <!-- Alpha gradient mask -->
                  <div
                    class="absolute inset-x-0 bottom-0 h-3"
                    style="background: linear-gradient(transparent, #0d0d0f)"
                  />
                </div>
              </div>
            </template>

            <!-- Dropdown menu — naked, just teams -->
            <div
              class="rounded-lg py-1.5 px-1"
              style="background: #131315; border: 1px solid #222226; min-width: 160px"
            >
              <!-- Teams -->
              <button
                v-for="team in teams"
                :key="team.id"
                class="w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer border-0 rounded"
                style="background: transparent"
                @click="nav(team.id)"
              >
                <component
                  :is="getIcon(team.icon)"
                  :size="12"
                  :weight="ICON_WEIGHT"
                  :style="{ color: currentView === team.id ? '#b0b0b8' : '#606068' }"
                />
                <span
                  class="text-[11px] flex-1 text-left"
                  :style="{ color: currentView === team.id ? '#e0e0e4' : '#808088' }"
                  >{{ team.name }}</span
                >
              </button>
            </div>
          </n-popover>

          <div class="flex-1" />

          <!-- Activity sub-views (only when active) -->
          <div v-if="mode === 'activity'" class="flex items-center gap-0.5 mr-1">
            <button
              class="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer border-0 transition-colors"
              :style="{
                background: activityView === 'orbital' ? neon.cyan + '15' : 'transparent',
                color: activityView === 'orbital' ? neon.cyan : '#505058',
              }"
              @click="activityView = 'orbital'"
            >
              Orbital
            </button>
            <button
              class="px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer border-0 transition-colors"
              :style="{
                background: activityView === 'tasks' ? neon.cyan + '15' : 'transparent',
                color: activityView === 'tasks' ? neon.cyan : '#505058',
              }"
              @click="activityView = 'tasks'"
            >
              Tasks
            </button>
          </div>

          <!-- Activity toggle -->
          <button
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer border-0 transition-colors"
            :style="{
              background: mode === 'activity' ? neon.cyan + '15' : 'transparent',
              border: mode === 'activity' ? `1px solid ${neon.cyan}25` : '1px solid transparent',
            }"
            @click="mode = mode === 'activity' ? 'chat' : 'activity'"
          >
            <IconActivity
              :size="12"
              :weight="ICON_WEIGHT"
              :style="{ color: mode === 'activity' ? neon.cyan : '#505058' }"
            />
            <span
              class="text-[10px] font-medium"
              :style="{ color: mode === 'activity' ? neon.cyan : '#505058' }"
              >Activity</span
            >
          </button>

          <!-- Settings -->
          <button
            class="flex items-center px-1.5 py-1 rounded-md cursor-pointer border-0 transition-colors hover:bg-[#1e1e22]/50"
            style="background: transparent"
          >
            <IconSettings :size="13" :weight="ICON_WEIGHT" style="color: #505058" />
          </button>
        </div>

        <!-- ── Activity Views (full screen) ──────── -->
        <div v-if="mode === 'activity'" class="flex-1 overflow-hidden">
          <OrbitalView v-if="activityView === 'orbital'" />
          <TaskStreamView v-else />
        </div>

        <!-- ── Chat ──────────────────────────────── -->
        <template v-else>
          <div class="flex-1 overflow-y-auto relative" ref="scrollEl">
            <div class="py-2">
              <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex gap-2.5 px-4 py-2"
                :class="msg.from === 'user' ? 'flex-row-reverse' : ''"
              >
                <n-avatar
                  :size="28"
                  round
                  :style="{
                    background:
                      msg.from === 'user'
                        ? '#1e1e22'
                        : msg.from === 'bob'
                          ? '#0D0D0F'
                          : agentColor(msg.agentIcon) + '12',
                    border:
                      msg.from === 'user'
                        ? `1px solid ${neon.purple}35`
                        : msg.from === 'bob'
                          ? `1px solid ${neon.cyan}`
                          : `1px solid ${agentColor(msg.agentIcon)}40`,
                    flexShrink: 0,
                  }"
                >
                  <component
                    :is="
                      msg.from === 'user'
                        ? IconUser
                        : msg.from === 'bob'
                          ? IconBob
                          : getIcon(msg.agentIcon || 'lead')
                    "
                    :size="14"
                    :weight="ICON_WEIGHT"
                    :style="{
                      color:
                        msg.from === 'user'
                          ? neon.purple
                          : msg.from === 'bob'
                            ? neon.cyan
                            : agentColor(msg.agentIcon),
                    }"
                  />
                </n-avatar>

                <div
                  class="flex-1 max-w-[78%]"
                  :class="msg.from === 'user' ? 'flex flex-col items-end' : ''"
                >
                  <div class="flex items-center gap-2 mb-0.5">
                    <n-text
                      class="text-[11px]"
                      :style="{
                        color:
                          msg.from === 'user'
                            ? '#707078'
                            : msg.from === 'bob'
                              ? neon.cyan
                              : agentColor(msg.agentIcon),
                        opacity: msg.from === 'user' ? 1 : 0.8,
                      }"
                    >
                      {{ msg.from === 'user' ? 'You' : msg.from === 'bob' ? 'BoB' : msg.agentName }}
                    </n-text>
                    <n-text depth="3" class="text-[10px]" style="opacity: 0.4">{{
                      fmt(msg.time)
                    }}</n-text>
                  </div>

                  <!-- User text -->
                  <n-card
                    v-if="msg.type === 'text'"
                    size="small"
                    :content-style="{ padding: '8px 12px' }"
                    :style="{
                      background: msg.from === 'user' ? neon.purple + '15' : undefined,
                      borderColor: msg.from === 'user' ? neon.purple + '25' : undefined,
                      borderRadius: '10px',
                    }"
                  >
                    <n-text class="text-[13px] leading-relaxed whitespace-pre-wrap">{{
                      msg.text
                    }}</n-text>
                  </n-card>

                  <!-- Verbose message with thinking -->
                  <div v-else-if="msg.type === 'verbose'" class="w-full">
                    <div
                      v-if="msg.thinking?.length"
                      class="mb-1 rounded-lg overflow-hidden transition-all"
                      :style="{
                        border: `1px solid ${msg.thinkingCollapsed ? '#222225' : agentColor(msg.agentIcon) + '18'}`,
                      }"
                    >
                      <button
                        class="w-full flex items-center gap-2 px-2.5 py-1 cursor-pointer border-0 transition-colors"
                        :style="{
                          background: msg.thinkingCollapsed
                            ? '#111113'
                            : agentColor(msg.agentIcon) + '08',
                        }"
                        @click="toggleThinking(msg)"
                      >
                        <IconCode
                          :size="10"
                          :weight="ICON_WEIGHT"
                          :style="{ color: agentColor(msg.agentIcon), opacity: 0.5 }"
                        />
                        <n-text
                          class="text-[9px] font-mono"
                          :style="{ color: agentColor(msg.agentIcon), opacity: 0.6 }"
                        >
                          thinking · {{ msg.thinking.length }} steps
                        </n-text>
                        <n-text class="text-[9px] ml-auto" :style="{ color: '#505058' }">
                          {{ msg.thinkingCollapsed ? '▸' : '▾' }}
                        </n-text>
                      </button>
                      <div
                        v-if="!msg.thinkingCollapsed"
                        class="px-2.5 py-1.5 space-y-0.5"
                        style="background: #0d0d0f"
                      >
                        <div
                          v-for="(line, i) in msg.thinking"
                          :key="i"
                          class="flex items-start gap-1.5"
                        >
                          <n-text
                            class="text-[9px] font-mono shrink-0"
                            :style="{ color: agentColor(msg.agentIcon), opacity: 0.3 }"
                            >›</n-text
                          >
                          <n-text
                            class="text-[9px] font-mono leading-relaxed"
                            :style="{ color: agentColor(msg.agentIcon), opacity: 0.5 }"
                            >{{ line }}</n-text
                          >
                        </div>
                      </div>
                    </div>

                    <n-card
                      size="small"
                      :content-style="{ padding: '8px 12px' }"
                      style="border-radius: 10px"
                    >
                      <n-text class="text-[13px] leading-relaxed whitespace-pre-wrap">{{
                        msg.text
                      }}</n-text>
                    </n-card>
                  </div>

                  <!-- Team card -->
                  <div v-else-if="msg.type === 'card'" class="w-full">
                    <n-text v-if="msg.text" class="text-[13px] mb-2 block">{{ msg.text }}</n-text>
                    <n-card size="small" :content-style="{ padding: '12px 14px' }">
                      <n-space vertical :size="10">
                        <n-space align="center" :size="6">
                          <n-avatar :size="18" round style="background: #1e1e22"
                            ><IconTeam :size="10" :weight="ICON_WEIGHT"
                          /></n-avatar>
                          <n-text strong class="text-[13px]">SWE Team</n-text>
                        </n-space>
                        <n-space vertical :size="4">
                          <n-space align="center" :size="6"
                            ><IconLead
                              :size="12"
                              :weight="ICON_WEIGHT"
                              :style="{ color: neon.orange }"
                            /><n-text class="text-[12px]">Team Lead</n-text></n-space
                          >
                          <n-space align="center" :size="6"
                            ><IconUI
                              :size="12"
                              :weight="ICON_WEIGHT"
                              :style="{ color: neon.purple }"
                            /><n-text class="text-[12px]">UI Developer</n-text></n-space
                          >
                          <n-space align="center" :size="6"
                            ><IconBackend
                              :size="12"
                              :weight="ICON_WEIGHT"
                              :style="{ color: neon.cyan }"
                            /><n-text class="text-[12px]">Backend Dev</n-text></n-space
                          >
                        </n-space>
                        <n-space :size="6">
                          <n-button size="tiny" quaternary
                            ><template #icon
                              ><IconCustomize :size="12" :weight="ICON_WEIGHT" /></template
                            >Customize</n-button
                          >
                          <n-button size="tiny" type="primary"
                            ><template #icon
                              ><IconCreate :size="12" :weight="ICON_WEIGHT" /></template
                            >Create Team</n-button
                          >
                        </n-space>
                      </n-space>
                    </n-card>
                  </div>

                  <!-- Activity card -->
                  <div v-else-if="msg.type === 'activity'" class="w-full">
                    <n-card size="small" :content-style="{ padding: '10px 14px' }">
                      <n-text
                        depth="3"
                        class="text-[10px] font-medium uppercase tracking-wider mb-2 block"
                      >
                        <IconActivity
                          :size="10"
                          :weight="ICON_WEIGHT"
                          class="inline mr-1"
                          style="vertical-align: -1px"
                        />Activity
                      </n-text>
                      <div class="space-y-2.5">
                        <div
                          v-for="act in msg.activities"
                          :key="act.name"
                          class="flex items-start gap-2"
                        >
                          <n-badge
                            dot
                            :color="
                              act.status === 'working'
                                ? agentColor(act.icon)
                                : act.status === 'completed'
                                  ? agentColor(act.icon)
                                  : neon.pink
                            "
                            :class="act.status === 'working' ? 'mt-1.5 animate-pulse' : 'mt-1.5'"
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                              <component
                                :is="getIcon(act.icon)"
                                :size="12"
                                :weight="ICON_WEIGHT"
                                :style="{ color: agentColor(act.icon) }"
                              />
                              <n-text class="text-[12px]" strong>{{ act.name }}</n-text>
                            </div>
                            <n-text depth="3" class="text-[11px] mt-0.5 block">{{
                              act.action
                            }}</n-text>
                            <div v-if="act.files?.length" class="mt-1 space-y-0.5">
                              <div
                                v-for="file in act.files"
                                :key="file"
                                class="flex items-center gap-1"
                              >
                                <IconFile :size="10" :weight="ICON_WEIGHT" />
                                <n-text
                                  class="text-[10px] font-mono"
                                  :style="{ color: agentColor(act.icon) }"
                                  >{{ file }}</n-text
                                >
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </n-card>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Input -->
          <div class="px-4 py-2.5 shrink-0" style="border-top: 1px solid #2a2a2e">
            <!-- BoB brand — tap to start a new team -->
            <div v-if="currentView !== 'bob'" class="flex justify-start mb-1.5">
              <button
                class="flex items-center gap-1 px-2 py-0.5 cursor-pointer border-0 rounded-full transition-colors"
                style="background: transparent"
                @click="newTeam"
              >
                <span class="relative" style="width: 18px; height: 14px; display: inline-flex">
                  <IconBob
                    :size="14"
                    :weight="ICON_WEIGHT"
                    :style="{ color: neon.cyan, opacity: 0.6 }"
                  />
                  <span
                    class="absolute -top-0.5 text-[9px] font-bold leading-none"
                    style="color: #fa8072; right: -1px"
                    >+</span
                  >
                </span>
                <span class="text-[10px]" style="color: #505058">New Team</span>
              </button>
            </div>
            <n-input-group>
              <n-input
                v-model:value="input"
                type="textarea"
                size="small"
                :placeholder="
                  currentView === 'bob'
                    ? 'Describe your project to conjure a team...'
                    : 'Message this team...'
                "
                :autosize="{ minRows: 1, maxRows: 3 }"
                @keydown="handleKey"
              />
              <n-button
                type="primary"
                size="small"
                :disabled="!input.trim()"
                @click="send"
                style="align-self: flex-end"
              >
                <template #icon><IconSend :size="12" :weight="ICON_WEIGHT" /></template>
              </n-button>
            </n-input-group>
          </div>
        </template>
      </div>
    </div>
  </n-config-provider>
</template>
