import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/lab',
      name: 'lab',
      component: () => import('@/views/CountLabView.vue'),
    },
  ],
});

export default router;
