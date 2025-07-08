import { createRouter, createWebHistory } from 'vue-router'
import Room from '../views/Room.vue'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/room/:roomId',
    name: 'Room',
    component: Room
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router