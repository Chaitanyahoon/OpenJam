/**
 * Client-Side Discord Rich Presence (RPC) Manager
 * Establishes a local WebSocket connection directly to the user's running Discord desktop client.
 * Sets user presence status with details of the song they are listening to on OpenJam.
 */
class DiscordRPC {
  constructor(clientId) {
    this.clientId = clientId || '1514249657549586482'; // Fallback to default OpenJam Discord Application
    this.socket = null;
    this.connected = false;
    this.ready = false;
    this.retryTimeout = null;
    this.currentActivity = null;
  }

  connect() {
    if (this.socket || this.connected) return;
    this.portIndex = 0;
    this.tryNextPort();
  }

  tryNextPort() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Suppress
      }
      this.socket = null;
    }

    if (this.portIndex > 9) {
      console.warn('[Discord RPC] Local Discord client not found on ports 6463-6472.');
      this.connected = false;
      this.ready = false;
      
      // Check again after 15 seconds
      this.retryTimeout = setTimeout(() => {
        this.portIndex = 0;
        this.tryNextPort();
      }, 15000);
      return;
    }

    const port = 6463 + this.portIndex;
    const url = `ws://127.0.0.1:${port}/rpc?v=1&client_id=${this.clientId}`;

    try {
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        if (this.socket !== socket) {
          socket.close();
          return;
        }
        console.log(`[Discord RPC] Connected to local Discord client on port ${port}`);
        this.connected = true;
        
        // Handshake: Discord expects a client handshake frame (Opcode 0) to authorize the session
        try {
          const handshake = {
            op: 0,
            d: {
              v: 1,
              client_id: this.clientId
            }
          };
          socket.send(JSON.stringify(handshake));
        } catch (err) {
          console.error('[Discord RPC] Handshake send failed:', err);
        }
      };

      socket.onmessage = (event) => {
        if (this.socket !== socket) return;
        console.log('[Discord RPC] Message received:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.evt === 'READY' || (data.cmd === 'DISPATCH' && data.evt === 'READY')) {
            console.log('[Discord RPC] Handshake successful, ready to push presence status');
            this.ready = true;
            if (this.currentActivity) {
              this.setActivity(this.currentActivity);
            }
          }
        } catch (err) {
          // Quietly ignore parsing anomalies
        }
      };

      socket.onerror = (err) => {
        if (this.socket !== socket) return;
        console.warn('[Discord RPC] Error occurred on socket:', err);
      };

      socket.onclose = (event) => {
        if (this.socket !== socket) return;

        console.log(`[Discord RPC] Connection closed. Code: ${event.code}, Reason: ${event.reason || 'none'}`);

        const wasConnected = this.connected;
        this.connected = false;
        this.ready = false;
        this.socket = null;

        if (wasConnected) {
          console.log('[Discord RPC] Lost connection to local Discord client. Retrying in 15s.');
          this.retryTimeout = setTimeout(() => {
            this.portIndex = 0;
            this.tryNextPort();
          }, 15000);
        } else {
          // Immediately try the next port in the range
          this.portIndex++;
          this.tryNextPort();
        }
      };
    } catch (e) {
      if (this.socket === socket) {
        this.connected = false;
        this.ready = false;
        this.socket = null;
        this.portIndex++;
        this.tryNextPort();
      }
    }
  }

  setActivity(activity) {
    this.currentActivity = activity;
    if (!this.ready || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: 9999, // Dummy process identifier
          activity: {
            details: activity.details.substring(0, 127),
            state: activity.state.substring(0, 127),
            timestamps: activity.timestamps,
            assets: {
              large_image: 'logo',
              large_text: 'OpenJam — Listen Together'
            },
            buttons: activity.buttons || []
          }
        },
        nonce: Math.random().toString(36).substring(2, 15)
      };

      this.socket.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[Discord RPC] Failed to push activity update:', err);
    }
  }

  clearActivity() {
    this.currentActivity = null;
    if (!this.ready || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const payload = {
        cmd: 'SET_ACTIVITY',
        args: {
          pid: 9999,
          activity: null
        },
        nonce: Math.random().toString(36).substring(2, 15)
      };

      this.socket.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[Discord RPC] Failed to clear activity:', err);
    }
  }

  destroy() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      try {
        // Try clearing presence cleanly before closing
        const payload = {
          cmd: 'SET_ACTIVITY',
          args: {
            pid: 9999,
            activity: null
          },
          nonce: Math.random().toString(36).substring(2, 15)
        };
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
        }
        socket.close();
      } catch (e) {
        // Suppress close faults
      }
    }
  }
}

export default DiscordRPC;
