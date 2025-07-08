<template>
  <div class="home">
    <h1>WebRTC Communication Tool</h1>
    <div class="room-controls">
      <input v-model="roomId" placeholder="ルーム ID を入力" />
      <button @click="joinRoom">参加</button>
      <button @click="createRoom">新規作成</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'Home',
  setup() {
    const router = useRouter()
    const roomId = ref('')

    const joinRoom = () => {
      if (roomId.value.trim()) {
        router.push(`/room/${roomId.value}`)
      }
    }

    const createRoom = () => {
      const newRoomId = Math.random().toString(36).substr(2, 9)
      router.push(`/room/${newRoomId}`)
    }

    return {
      roomId,
      joinRoom,
      createRoom
    }
  }
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.room-controls {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
}

input {
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background: #45a049;
}
</style>