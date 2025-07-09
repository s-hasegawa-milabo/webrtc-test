<template>
  <div class="room">
    <div class="room-header">
      <h2>ルーム: {{ roomId }}</h2>
      <div class="controls">
        <button @click="toggleMute" :class="{ active: !isMuted, muted: isMuted }">
          {{ isMuted ? '🔇' : '🔊' }}
        </button>
        <button @click="toggleVideo" :class="{ active: !isVideoOff, 'video-off': isVideoOff }">
          {{ isVideoOff ? '📹' : '📷' }}
        </button>
        <button @click="toggleScreenShare" :class="{ active: isScreenSharing }">
          {{ isScreenSharing ? '🛑' : '🖥️' }}
        </button>
        <div class="user-count">参加者: {{ remoteUsers.length + 1 }}</div>
      </div>
    </div>
    
    <div class="main-content">
      <div class="video-area">
        <div class="video-grid" :class="{ 'single-user': totalUsers === 1, 'two-users': totalUsers === 2, 'three-users': totalUsers === 3, 'four-plus-users': totalUsers >= 4 }">
          <!-- 自分の映像 -->
          <div class="video-container">
            <video 
              ref="localVideo" 
              autoplay 
              muted 
              playsinline>
            </video>
            <div v-if="isVideoOff" class="video-placeholder">
              <div class="user-avatar">{{ userId.charAt(0).toUpperCase() }}</div>
              <div class="user-name">あなた</div>
            </div>
            <div class="video-label">あなた</div>
          </div>
          
          <!-- 他の参加者の映像 -->
          <div 
            v-for="user in remoteUsers" 
            :key="user.id" 
            class="video-container">
            <video 
              :data-user-id="user.id"
              autoplay 
              playsinline>
            </video>
            <div v-if="!user.hasVideo" class="video-placeholder">
              <div class="user-avatar">{{ user.name.charAt(0).toUpperCase() }}</div>
              <div class="user-name">{{ user.name }}</div>
            </div>
            <div class="video-label">{{ user.name }}</div>
          </div>
        </div>
      </div>
      
      <div class="chat-area">
        <div class="messages" ref="messagesContainer">
          <div 
            v-for="message in messages" 
            :key="message.id"
            class="message"
            :class="{ own: message.userId === userId }">
            <strong>{{ message.userId }}:</strong> 
            <span v-if="message.type === 'text'">{{ message.text }}</span>
            <div v-else-if="message.type === 'file'" class="file-message">
              <a :href="message.fileUrl" :download="message.filename">
                📎 {{ message.filename }}
              </a>
              <span class="file-size">({{ formatFileSize(message.fileSize) }})</span>
            </div>
            <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
          </div>
        </div>
        
        <div class="message-input">
          <input 
            v-model="newMessage" 
            @keyup.enter="sendMessage"
            placeholder="メッセージを入力..."
          />
          <button @click="sendMessage">送信</button>
        </div>
        
        <div class="file-upload">
          <input 
            type="file" 
            ref="fileInput" 
            @change="uploadFile"
            style="display: none"
          />
          <button @click="$refs.fileInput.click()">ファイル選択</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSocketStore } from '../stores/socket'
import { useWebRTCStore } from '../stores/webrtc'

export default {
  name: 'Room',
  setup() {
    const route = useRoute()
    const socketStore = useSocketStore()
    const webrtcStore = useWebRTCStore()
    
    const roomId = route.params.roomId
    const userId = ref(Math.random().toString(36).substr(2, 9))
    const messages = ref([])
    const newMessage = ref('')
    const remoteUsers = ref([])
    const isMuted = ref(false)
    const isVideoOff = ref(false)
    const isScreenSharing = ref(false)
    const totalUsers = computed(() => remoteUsers.value.length + 1)

    const sendMessage = () => {
      if (newMessage.value.trim()) {
        const message = {
          id: Date.now().toString(),
          type: 'text',
          text: newMessage.value,
          userId: userId.value,
          timestamp: new Date().toISOString()
        }
        
        socketStore.sendMessage(message, roomId)
        newMessage.value = ''
      }
    }

    const toggleMute = () => {
      isMuted.value = !isMuted.value
      webrtcStore.toggleMute(isMuted.value)
    }

    const toggleVideo = () => {
      isVideoOff.value = !isVideoOff.value
      webrtcStore.toggleVideo(isVideoOff.value)
      socketStore.notifyVideoToggle(!isVideoOff.value, roomId)
    }

    const toggleScreenShare = () => {
      isScreenSharing.value = !isScreenSharing.value
      webrtcStore.toggleScreenShare(isScreenSharing.value)
    }

    const uploadFile = async (event) => {
      const file = event.target.files[0]
      if (file) {
        try {
          const fileData = await socketStore.uploadFile(file)
          
          const fileMessage = {
            id: Date.now().toString(),
            type: 'file',
            userId: userId.value,
            filename: fileData.originalname,
            fileUrl: `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/download/${fileData.filename}`,
            fileSize: fileData.size,
            timestamp: new Date().toISOString()
          }
          
          messages.value.push(fileMessage)
          socketStore.sendFileMessage(fileMessage, roomId)
          
        } catch (error) {
          console.error('File upload failed:', error)
        }
      }
    }

    const formatTime = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString()
    }

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    onMounted(() => {
      console.log('Room component mounted, userId:', userId.value, 'roomId:', roomId)
      
      // コールバック関数を最初に登録
      socketStore.onMessage((message) => {
        messages.value.push(message)
      })
      
      socketStore.onExistingUsers((existingUsers) => {
        console.log('Existing users received:', existingUsers)
        console.log('Current userId:', userId.value)
        existingUsers.forEach(existingUserId => {
          if (existingUserId !== userId.value) {
            console.log('Adding existing user:', existingUserId)
            remoteUsers.value.push({
              id: existingUserId,
              name: existingUserId,
              hasVideo: false
            })
          }
        })
        console.log('Total remote users after existing:', remoteUsers.value.length)
        
        // UIの更新を待ってから接続を開始
        setTimeout(() => {
          existingUsers.forEach(existingUserId => {
            if (existingUserId !== userId.value) {
              console.log('New user making call to existing user:', existingUserId)
              webrtcStore.makeCall(existingUserId)
            }
          })
        }, 1000)
      })

      socketStore.onUserJoined((newUserId) => {
        console.log('New user joined:', newUserId)
        console.log('Current userId:', userId.value)
        if (newUserId !== userId.value) {
          remoteUsers.value.push({
            id: newUserId,
            name: newUserId,
            hasVideo: false
          })
          console.log('Making call to new user:', newUserId)
          // 既存ユーザーが新規ユーザーに対してWebRTC接続を開始
          setTimeout(() => {
            webrtcStore.makeCall(newUserId)
          }, 500)
        }
        console.log('Total remote users after join:', remoteUsers.value.length)
      })
      
      socketStore.onUserLeft((leftUserId) => {
        const index = remoteUsers.value.findIndex(user => user.id === leftUserId)
        if (index > -1) {
          remoteUsers.value.splice(index, 1)
        }
      })
      
      webrtcStore.onRemoteVideoEnabled((userId, enabled) => {
        console.log('Remote video enabled callback:', userId, enabled)
        console.log('Current remoteUsers:', remoteUsers.value)
        const user = remoteUsers.value.find(u => u.id === userId)
        if (user) {
          user.hasVideo = enabled
          console.log('Updated user hasVideo:', user)
        } else {
          console.log('User not found in remoteUsers:', userId)
        }
      })

      socketStore.on('user-video-toggle', (userId, enabled) => {
        const user = remoteUsers.value.find(u => u.id === userId)
        if (user) {
          user.hasVideo = enabled
        }
      })
      
      // 全てのコールバック登録後にソケット接続とWebRTC初期化
      socketStore.connect()
      
      // WebRTCの初期化とソケット接続を並行して行う
      Promise.all([
        webrtcStore.initializeMedia(),
        new Promise((resolve) => {
          // ソケット接続完了を待つ
          const checkConnection = () => {
            if (socketStore.isConnected) {
              resolve()
            } else {
              setTimeout(checkConnection, 100)
            }
          }
          checkConnection()
        })
      ]).then(() => {
        // 両方の準備が完了したらルームに参加
        console.log('Both WebRTC and Socket ready. Joining room:', roomId, 'as user:', userId.value)
        socketStore.joinRoom(roomId, userId.value)
      })
    })

    onUnmounted(() => {
      socketStore.disconnect()
      webrtcStore.cleanup()
    })

    return {
      roomId,
      userId,
      messages,
      newMessage,
      remoteUsers,
      isMuted,
      isVideoOff,
      isScreenSharing,
      sendMessage,
      toggleMute,
      toggleVideo,
      toggleScreenShare,
      uploadFile,
      formatTime,
      formatFileSize,
      totalUsers
    }
  }
}
</script>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #2c3e50;
  color: white;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.controls button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 50%;
  background: #3498db;
  color: white;
  cursor: pointer;
  font-size: 1.2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.controls button:hover {
  background: #2980b9;
  transform: scale(1.1);
}

.controls button.active {
  background: #27ae60;
}

.controls button.muted {
  background: #e74c3c;
}

.controls button.video-off {
  background: #e74c3c;
}

.user-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  margin-left: 1rem;
}

.main-content {
  display: flex;
  flex: 1;
}

.video-area {
  flex: 2;
  background: #000;
  display: flex;
  flex-direction: column;
  position: relative;
}

.video-grid {
  display: grid;
  gap: 10px;
  padding: 10px;
  height: 100%;
}

.video-grid.single-user {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.video-grid.two-users {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

.video-grid.three-users {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.video-grid.three-users .video-container:first-child {
  grid-column: 1 / 3;
}

.video-grid.four-plus-users {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.video-container {
  position: relative;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid #3498db;
  min-height: 200px;
}

.video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #2c3e50;
  color: white;
  z-index: 10;
}

.user-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #3498db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 10px;
}

.user-name {
  font-size: 1.2rem;
  font-weight: 500;
}

.video-label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9rem;
  z-index: 11;
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #ddd;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  background: #f8f9fa;
}

.message {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  background: white;
}

.message.own {
  background: #e3f2fd;
  margin-left: 2rem;
}

.timestamp {
  font-size: 0.8rem;
  color: #666;
  float: right;
}

.message-input {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #ddd;
}

.message-input input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.message-input button {
  margin-left: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #4CAF50;
  color: white;
  cursor: pointer;
}

.file-upload {
  padding: 1rem;
  border-top: 1px solid #ddd;
}

.file-upload button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background: #ff9800;
  color: white;
  cursor: pointer;
}

.file-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-message a {
  color: #2196F3;
  text-decoration: none;
}

.file-message a:hover {
  text-decoration: underline;
}

.file-size {
  color: #666;
  font-size: 0.8rem;
}
</style>