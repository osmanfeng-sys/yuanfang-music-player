import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '远方音乐 - 首页' }
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/views/BrowseView.vue'),
    meta: { title: '浏览音乐' }
  },
  {
    path: '/artist/:id',
    name: 'artist',
    component: () => import('@/views/ArtistView.vue'),
    meta: { title: '艺人详情' },
    props: true
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { title: '搜索' },
    props: (route: { query: { q?: string } }) => ({ query: route.query.q || '' })
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('@/views/PlaylistView.vue'),
    meta: { title: '播放列表' },
    props: true
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 动态 title
router.afterEach((to) => {
  document.title = (to.meta.title as string) || '远方音乐'
})

export default router
