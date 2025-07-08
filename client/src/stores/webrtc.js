import { defineStore } from 'pinia'
import { useSocketStore } from './socket'

export const useWebRTCStore = defineStore('webrtc', {
  state: () => ({
    localStream: null,
    remoteStreams: new Map(),
    peerConnections: new Map(),
    isInitialized: false,
    screenStream: null,
    remoteVideoCallbacks: []
  }),

  actions: {
    async initializeMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        })
        
        this.localStream = stream
        this.isInitialized = true
        
        setTimeout(() => {
          const localVideo = document.querySelector('video')
          if (localVideo) {
            localVideo.srcObject = stream
          }
        }, 100)
        
        this.setupWebRTCHandlers()
        
      } catch (error) {
        console.error('Error accessing media devices:', error)
      }
    },

    setupWebRTCHandlers() {
      const socketStore = useSocketStore()
      
      socketStore.on('webrtc-offer', async (offer, fromUserId) => {
        console.log('Received offer from:', fromUserId)
        await this.handleOffer(offer, fromUserId)
      })

      socketStore.on('webrtc-answer', async (answer, fromUserId) => {
        console.log('Received answer from:', fromUserId)
        await this.handleAnswer(answer, fromUserId)
      })

      socketStore.on('webrtc-ice-candidate', async (candidate, fromUserId) => {
        console.log('Received ICE candidate from:', fromUserId)
        await this.handleIceCandidate(candidate, fromUserId)
      })
    },

    async createPeerConnection(userId) {
      console.log('Creating peer connection for:', userId)
      
      // 既存の接続があれば削除
      if (this.peerConnections.has(userId)) {
        console.log('Closing existing peer connection for:', userId)
        this.peerConnections.get(userId).close()
        this.peerConnections.delete(userId)
      }
      
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }

      const peerConnection = new RTCPeerConnection(configuration)
      this.peerConnections.set(userId, peerConnection)

      // 接続状態の監視
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state with ${userId}:`, peerConnection.connectionState)
        if (peerConnection.connectionState === 'failed') {
          console.log('Connection failed, attempting to restart for:', userId)
          setTimeout(() => {
            this.makeCall(userId)
          }, 1000)
        }
      }

      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state with ${userId}:`, peerConnection.iceConnectionState)
      }

      // ローカルストリームの追加
      if (this.localStream) {
        console.log('Adding local stream tracks to peer connection for:', userId)
        this.localStream.getTracks().forEach(track => {
          console.log('Adding track:', track.kind, track.enabled)
          peerConnection.addTrack(track, this.localStream)
        })
      } else {
        console.log('No local stream available for:', userId)
      }

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate to:', userId)
          const socketStore = useSocketStore()
          socketStore.emit('webrtc-ice-candidate', event.candidate, userId)
        } else {
          console.log('All ICE candidates sent for:', userId)
        }
      }

      peerConnection.ontrack = (event) => {
        console.log('Received remote track from:', userId, 'streams:', event.streams.length)
        const remoteStream = event.streams[0]
        this.remoteStreams.set(userId, remoteStream)
        
        console.log('Remote stream tracks:', remoteStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })))
        
        // リモートビデオ要素を探して設定
        this.setRemoteVideoSource(userId, remoteStream)
        
        // ビデオトラックの状態を監視
        const videoTrack = remoteStream.getVideoTracks()[0]
        if (videoTrack) {
          console.log('Video track found for:', userId, 'enabled:', videoTrack.enabled)
          // ビデオトラックが見つかったら即座に通知
          this.remoteVideoCallbacks.forEach(callback => {
            callback(userId, true)
          })
          
          videoTrack.addEventListener('ended', () => {
            this.remoteVideoCallbacks.forEach(callback => {
              callback(userId, false)
            })
          })
        } else {
          console.log('No video track found for:', userId)
          // ビデオトラックがない場合
          this.remoteVideoCallbacks.forEach(callback => {
            callback(userId, false)
          })
        }
      }

      return peerConnection
    },

    setRemoteVideoSource(userId, remoteStream) {
      let attempts = 0
      const maxAttempts = 10
      
      const trySetVideo = () => {
        // デバッグ：全てのビデオ要素を調べる
        const allVideos = document.querySelectorAll('video')
        console.log('All video elements:', allVideos.length)
        allVideos.forEach((video, index) => {
          console.log(`Video ${index}:`, {
            'data-user-id': video.getAttribute('data-user-id'),
            'id': video.id,
            'class': video.className
          })
        })
        
        const remoteVideo = document.querySelector(`video[data-user-id="${userId}"]`)
        console.log(`Looking for video with data-user-id="${userId}":`, remoteVideo)
        
        if (remoteVideo) {
          remoteVideo.srcObject = remoteStream
          console.log('Set remote video source for:', userId)
        } else {
          attempts++
          if (attempts < maxAttempts) {
            console.log(`Remote video element not found for ${userId}, retrying... (${attempts}/${maxAttempts})`)
            setTimeout(trySetVideo, 200)
          } else {
            console.log('Failed to find remote video element for:', userId)
            // 最終的にもう一度全てのビデオ要素を表示
            const finalVideos = document.querySelectorAll('video')
            console.log('Final video elements:', finalVideos.length)
            finalVideos.forEach((video, index) => {
              console.log(`Final Video ${index}:`, {
                'data-user-id': video.getAttribute('data-user-id'),
                'id': video.id,
                'class': video.className
              })
            })
          }
        }
      }
      
      trySetVideo()
    },

    async makeCall(userId) {
      console.log('Making call to:', userId)
      
      try {
        const peerConnection = await this.createPeerConnection(userId)
        
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        
        console.log('Sending offer to:', userId)
        const socketStore = useSocketStore()
        socketStore.emit('webrtc-offer', offer, userId)
      } catch (error) {
        console.error('Error making call to:', userId, error)
      }
    },

    async handleOffer(offer, fromUserId) {
      console.log('Handling offer from:', fromUserId)
      
      try {
        const peerConnection = await this.createPeerConnection(fromUserId)
        
        await peerConnection.setRemoteDescription(offer)
        
        const answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        
        console.log('Sending answer to:', fromUserId)
        const socketStore = useSocketStore()
        socketStore.emit('webrtc-answer', answer, fromUserId)
      } catch (error) {
        console.error('Error handling offer from:', fromUserId, error)
      }
    },

    async handleAnswer(answer, fromUserId) {
      console.log('Handling answer from:', fromUserId)
      const peerConnection = this.peerConnections.get(fromUserId)
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer)
        console.log('Set remote description for answer from:', fromUserId)
      } else {
        console.log('No peer connection found for answer from:', fromUserId)
      }
    },

    async handleIceCandidate(candidate, fromUserId) {
      console.log('Handling ICE candidate from:', fromUserId)
      const peerConnection = this.peerConnections.get(fromUserId)
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate)
        console.log('Added ICE candidate from:', fromUserId)
      } else {
        console.log('No peer connection found for ICE candidate from:', fromUserId)
      }
    },

    toggleMute(muted) {
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
          track.enabled = !muted
        })
      }
    },

    toggleVideo(disabled) {
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(track => {
          track.enabled = !disabled
        })
      }
    },

    async toggleScreenShare(enabled) {
      if (enabled) {
        try {
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          })
          
          this.peerConnections.forEach(async (peerConnection, userId) => {
            const videoTrack = this.screenStream.getVideoTracks()[0]
            const sender = peerConnection.getSenders().find(s => 
              s.track && s.track.kind === 'video'
            )
            
            if (sender) {
              await sender.replaceTrack(videoTrack)
            }
          })
          
          this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
            this.stopScreenShare()
          })
          
        } catch (error) {
          console.error('Error sharing screen:', error)
        }
      } else {
        this.stopScreenShare()
      }
    },

    stopScreenShare() {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
        this.screenStream = null
        
        this.peerConnections.forEach(async (peerConnection, userId) => {
          const videoTrack = this.localStream.getVideoTracks()[0]
          const sender = peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          )
          
          if (sender && videoTrack) {
            await sender.replaceTrack(videoTrack)
          }
        })
      }
    },

    cleanup() {
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop())
        this.localStream = null
      }
      
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop())
        this.screenStream = null
      }
      
      this.peerConnections.forEach(peerConnection => {
        peerConnection.close()
      })
      
      this.peerConnections.clear()
      this.remoteStreams.clear()
      this.isInitialized = false
    },

    onRemoteVideoEnabled(callback) {
      this.remoteVideoCallbacks.push(callback)
    }
  }
})