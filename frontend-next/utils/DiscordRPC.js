/**
 * Client-Side Discord Rich Presence (RPC) Manager
 * Establishes a local WebSocket connection directly to the user's running Discord desktop client.
 * Sets user presence status with details of the song they are listening to on OpenJam.
 */
class DiscordRPC {
  constructor(clientId) {
    this.clientId = clientId || '1384074213192306718'; // Fallback to default OpenJam Discord Application
    this.socket = null;
    this.connected = false;
    this.retryTimeout = null;
    this.currentActivity = null;
  }

  connect() {
    if (this.socket || this.connected) return;

    // Discord client listens for RPC WebSocket connections on ports 6463 - 6472
    const port = 6463;
    const url = `ws://127.0.0.1:${port}/rpc?v=1&client_id=${this.clientId}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('[Discord RPC] Connected to local Discord client');
        this.connected = true;
        
        // Handshake: Discord expects a client handshake or authorization
        // For setting activity, we authorize by sending the client ID details
        if (this.currentActivity) {
          this.setActivity(this.currentActivity);
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.evt === 'READY') {
            console.log('[Discord RPC] Ready to push activities');
          }
        } catch (err) {
          // Quietly ignore parsing anomalies
        }
      };

      this.socket.onerror = () => {
        // Quietly fail (Discord desktop app might not be running)
      };

      this.socket.onclose = () => {
        this.connected = false;
        this.socket = null;
        
        // Retry connection in 12 seconds to handle Discord restarts
        this.retryTimeout = setTimeout(() => this.connect(), 12000);
      };
    } catch (e) {
      this.connected = false;
      this.socket = null;
    }
  }

  setActivity(activity) {
    this.currentActivity = activity;
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
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
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
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
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.socket) {
      try {
        this.clearActivity();
        this.socket.close();
      } catch (e) {
        // Suppress close faults
      }
    }
  }
}

export default DiscordRPC;
