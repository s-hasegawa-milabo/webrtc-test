import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import axios from 'axios'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    isConnected: false,
    messageCallbacks: [],
    userJoinedCallbacks: [],
    userLeftCallbacks: [],
    existingUsersCallbacks: []
  }),

  actions: {
    connect() {
      if (this.socket) {
        this.socket.disconnect()
      }
      
      this.socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001')
      
      this.socket.on('connect', () => {
        this.isConnected = true
        console.log('Connected to server')
      })

      this.socket.on('disconnect', () => {
        this.isConnected = false
        console.log('Disconnected from server')
      })

      this.socket.on('receive-message', (message) => {
        console.log('Socket received message:', message)
        this.messageCallbacks.forEach(callback => callback(message))
      })

      this.socket.on('user-joined', (userId) => {
        console.log('Socket received user-joined:', userId)
        this.userJoinedCallbacks.forEach(callback => callback(userId))
      })

      this.socket.on('user-left', (userId) => {
        console.log('Socket received user-left:', userId)
        this.userLeftCallbacks.forEach(callback => callback(userId))
      })

      this.socket.on('existing-users', (users) => {
        console.log('Socket received existing-users:', users)
        this.existingUsersCallbacks.forEach(callback => callback(users))
      })

      this.socket.on('user-video-toggle', (userId, enabled) => {
        console.log(`User ${userId} toggled video: ${enabled}`)
      })
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.isConnected = false
      }
    },

    joinRoom(roomId, userId) {
      if (this.socket && this.isConnected) {
        console.log('Emitting join-room:', roomId, userId)
        this.socket.emit('join-room', roomId, userId)
      } else {
        console.log('Cannot join room - socket not connected:', this.isConnected)
        // 接続を待ってから再試行
        setTimeout(() => {
          this.joinRoom(roomId, userId)
        }, 100)
      }
    },

    sendMessage(message, roomId) {
      if (this.socket) {
        this.socket.emit('send-message', message, roomId)
      }
    },

    sendFileMessage(fileMessage, roomId) {
      if (this.socket) {
        this.socket.emit('send-file-message', fileMessage, roomId)
      }
    },

    async uploadFile(file) {
      const formData = new FormData()
      formData.append('file', file)
      
      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
        const response = await axios.post(`${serverUrl}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
        
        console.log('File uploaded:', response.data)
        return response.data
      } catch (error) {
        console.error('File upload failed:', error)
        throw error
      }
    },

    onMessage(callback) {
      this.messageCallbacks.push(callback)
    },

    onUserJoined(callback) {
      this.userJoinedCallbacks.push(callback)
    },

    onUserLeft(callback) {
      this.userLeftCallbacks.push(callback)
    },

    onExistingUsers(callback) {
      this.existingUsersCallbacks.push(callback)
    },

    emit(event, ...args) {
      if (this.socket) {
        this.socket.emit(event, ...args)
      }
    },

    on(event, callback) {
      if (this.socket) {
        this.socket.on(event, callback)
      }
    },

    notifyVideoToggle(enabled, roomId) {
      if (this.socket) {
        this.socket.emit('video-toggle', enabled, roomId)
      }
    }
  }
})