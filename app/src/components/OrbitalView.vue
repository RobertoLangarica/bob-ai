<script setup lang="ts">
import { IconBob, ICON_WEIGHT } from '@/icons'
import { neon } from '@/theme'
import { agents } from '@/agents'

const agentData = [
  { ...agents[0], status: 'completed', angle: 225, distance: 85 },   // Lead — orange
  { ...agents[1], status: 'working', angle: 45, distance: 90 },      // UI — purple
  { ...agents[2], status: 'working', angle: 135, distance: 95 },     // Backend — cyan
  { ...agents[3], status: 'idle', angle: 315, distance: 88 },        // Research — green
]

function pos(angle: number, dist: number) {
  const rad = (angle * Math.PI) / 180
  return { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist }
}

function statusOpacity(s: string) {
  if (s === 'working') return 1
  if (s === 'completed') return 0.7
  return 0.3
}
</script>

<template>
  <div class="h-full flex items-center justify-center relative overflow-hidden">

    <!-- Orbit rings -->
    <div class="absolute rounded-full" style="width: 180px; height: 180px; border: 1px solid #1e1e22" />
    <div class="absolute rounded-full" style="width: 120px; height: 120px; border: 1px dashed #1a1a1d" />

    <!-- Connection lines (SVG) -->
    <svg class="absolute inset-0 w-full h-full" style="pointer-events: none">
      <line
        v-for="a in agentData.filter(a => a.status === 'working')" :key="'l-'+a.id"
        :x1="'50%'" :y1="'50%'"
        :x2="50 + pos(a.angle, a.distance * 0.32).x + '%'"
        :y2="50 + pos(a.angle, a.distance * 0.32).y + '%'"
        :stroke="a.color" stroke-width="1" :opacity="0.2"
        stroke-dasharray="3,3"
      />
    </svg>

    <!-- BoB center -->
    <div class="absolute z-10">
      <n-avatar :size="38" round :style="{
        background: '#0D0D0F',
        border: `2px solid ${neon.cyan}`,
        boxShadow: `0 0 16px ${neon.cyan}20`,
      }">
        <IconBob :size="20" :weight="ICON_WEIGHT" :style="{ color: neon.cyan }" />
      </n-avatar>
    </div>

    <!-- Agents -->
    <div
      v-for="a in agentData" :key="a.id"
      class="absolute flex flex-col items-center gap-1 transition-all duration-700"
      :style="{
        transform: `translate(${pos(a.angle, a.distance).x}px, ${pos(a.angle, a.distance).y}px)`,
        opacity: statusOpacity(a.status),
      }"
    >
      <n-avatar :size="28" round :style="{
        background: a.color + '15',
        border: `1.5px solid ${a.color}`,
        boxShadow: a.status === 'working' ? `0 0 10px ${a.color}30` : 'none',
      }">
        <component :is="a.icon" :size="14" :weight="ICON_WEIGHT"
          :style="{ color: a.color }"
          :class="a.status === 'working' ? 'animate-pulse' : ''"
        />
      </n-avatar>
      <n-text class="text-[9px] font-medium" :style="{ color: a.color }">{{ a.name }}</n-text>
    </div>
  </div>
</template>
