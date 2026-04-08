<script setup lang="ts">
import { ref, onMounted } from 'vue';

const message = ref('Loading...');

onMounted(async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/hello`);
    const data = await res.json();
    message.value = data.message;
  } catch {
    message.value = 'API not available';
  }
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-950 text-white">
    <div class="text-center">
      <h1 class="text-4xl font-bold mb-4">Devoq AI</h1>
      <p class="text-gray-400">{{ message }}</p>
    </div>
  </div>
</template>
