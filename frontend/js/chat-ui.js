/* ==========================================================================
   OPEN JAM — Chat UI Module
   Manages room chat rendering, typing states, and tactile emoji reactions.
   ========================================================================== */

(function() {
  let _chatQueue = [];
  let _chatRetrying = false;

  async function _processChatQueue() {
    const app = window.roomApp;
    if (!app || !app.sc) return;
    if (_chatRetrying || _chatQueue.length === 0) return;
    _chatRetrying = true;
    const item = _chatQueue[0];
    try {
      const ack = await app.sc.sendChat(item.text);
      if (ack) {
        _chatQueue.shift();
      } else {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch(e) {
      await new Promise(r => setTimeout(r, 2000));
    }
    _chatRetrying = false;
    _processChatQueue();
  }

  // Global hook to append chat message
  window.addChat = function(msg) {
    const app = window.roomApp;
    if (!app) return;
    const msgs = $('#chat-msgs');
    if (!msgs) return;
    const dedupKey = msg.id || `${msg.user_id}_${msg.content}_${msg.timestamp}`;
    if (msgs.querySelector(`[data-dedup="${CSS.escape(dedupKey)}"]`)) return;

    const empty = $('#chat-empty');
    if (empty) empty.style.display = 'none';
    const isSelf = app.me && msg.user_id === app.me.id;
    const el = document.createElement('div');
    el.className = `chat-message${isSelf?' self':''}`;
    el.dataset.dedup = dedupKey;

    el.innerHTML = `
      ${app.avatarHTML(msg.user_name)}
      <div class="chat-msg-body">
        <div class="chat-msg-bubble">
          <div class="chat-msg-header">
            <span class="chat-msg-name">${esc(msg.user_name)}</span>
          </div>
          <div class="chat-msg-text">${esc(msg.content).replace(/(https?:\/\/[^\s&lt;]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#60a5fa;text-decoration:underline">$1</a>')}</div>
        </div>
      </div>`;
    
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    if (!isSelf && window._mobMarkUnread) window._mobMarkUnread();
  };

  function sendMsg() {
    const input = $('#chat-input');
    const v = input.value.trim();
    if (v) {
      _chatQueue.push({ text: v });
      _processChatQueue();
      input.value = '';
      input.style.height = 'auto';
      updateSendButton();
    }
  }

  function updateSendButton() {
    const input = $('#chat-input');
    const btn = $('#btn-send');
    if (btn) btn.disabled = !input.value.trim();
  }

  function autoResizeTextarea() {
    const textarea = $('#chat-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'; // Max 4 lines
  }

  // Global hook to update typing indicators
  window.updateTypingIndicator = function(typingUsers) {
    let ind = document.getElementById('typing-indicator');
    if (!ind) {
      ind = document.createElement('div');
      ind.id = 'typing-indicator';
      ind.className = 'typing-indicator';
      ind.style.display = 'none';
      const msgsPanel = $('#chat-msgs');
      if (msgsPanel) msgsPanel.appendChild(ind);
    }
    if (!typingUsers || typingUsers.size === 0) {
      ind.style.display = 'none';
    } else {
      ind.style.display = 'flex';
      const names = Array.from(typingUsers);
      const text = names.length > 2 ? 'Several people are typing...' : `${names.join(' and ')} is typing...`;
      ind.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div> <div class="typing-text">${esc(text)}</div>`;
      const msgs = $('#chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const app = window.roomApp;

    $('#btn-send')?.addEventListener('click', sendMsg);
    
    let typingTimeout;
    $('#chat-input')?.addEventListener('input', () => {
      updateSendButton();
      autoResizeTextarea();
      if (app.sc?.socket) {
        app.sc.socket.emit('typing', { room_id: app.roomId });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => app.sc.socket.emit('stop_typing', { room_id: app.roomId }), 2000);
      }
    });

    $('#chat-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    // Reaction click events
    $$('.btn-react').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        if (window.gsap) {
          window.gsap.to(btn, {
            scale: 1.35,
            rotation: (Math.random() - 0.5) * 20,
            duration: 0.1,
            yoyo: true,
            repeat: 1
          });
        }
        if (app.sc) app.sc.emit('send_reaction', { room_id: app.roomId, emoji: emoji });
      });
    });

    // Spawning engine for floating emoji reactions
    window.spawnFloatingEmoji = function(emoji) {
      if (!window.gsap) return;
      const container = document.body;
      const el = document.createElement('div');
      el.className = 'gsap-floating-emoji';
      el.textContent = emoji;
      
      const isMobile = window.innerWidth <= 640;
      const rightVal = isMobile ? '20px' : '30px';
      const bottomVal = isMobile ? '70px' : '80px';
      
      el.style.cssText = `
        position: fixed;
        bottom: ${bottomVal};
        right: ${rightVal};
        font-size: 32px;
        pointer-events: none;
        z-index: 10000;
        user-select: none;
        will-change: transform, opacity;
      `;
      container.appendChild(el);

      const xOffset = (Math.random() - 0.5) * 160;
      const yDistance = 250 + Math.random() * 150;
      const duration = 1.6 + Math.random() * 0.8;
      const startRot = (Math.random() - 0.5) * 40;
      const targetRot = startRot + (Math.random() - 0.5) * 120;

      window.gsap.fromTo(el,
        { x: 0, y: 0, scale: 0.2, opacity: 0, rotation: startRot },
        {
          opacity: 1,
          scale: 1.4,
          duration: duration * 0.2,
          ease: 'power1.out',
          onComplete: () => {
            window.gsap.to(el, {
              opacity: 0,
              scale: 0.6,
              duration: duration * 0.8,
              ease: 'power1.in',
              onComplete: () => el.remove()
            });
          }
        }
      );

      window.gsap.to(el, {
        x: xOffset,
        y: -yDistance,
        rotation: targetRot,
        duration: duration,
        ease: 'power2.out'
      });
    };

    // Process socket reactions
    const setupReactionListener = setInterval(() => {
      if (app.sc && app.sc.socket) {
        clearInterval(setupReactionListener);
        
        app.sc.on('reaction', d => {
          app.playReactionSound();
          if (window.spawnFloatingEmoji) {
            window.spawnFloatingEmoji(d.emoji);
          }

          const msgs = $('#chat-msgs');
          if (msgs) {
            const empty = $('#chat-empty');
            if (empty) empty.style.display = 'none';
            const el = document.createElement('div');
            el.className = 'chat-system-msg reaction-alert';
            el.innerHTML = `
              <div class="reaction-avatar-small">${app.avatarHTML(d.display_name)}</div>
              <div class="reaction-alert-content">
                <span class="reaction-user-name">${esc(d.display_name)}</span> reacted with <span class="reaction-emoji">${esc(d.emoji)}</span>
              </div>
            `;
            msgs.appendChild(el);
            msgs.scrollTop = msgs.scrollHeight;
          }
        });

        // Typing states
        const typingUsers = new Set();
        app.sc.on('user_typing', d => {
          typingUsers.add(d.display_name);
          window.updateTypingIndicator(typingUsers);
        });
        app.sc.on('user_stop_typing', d => {
          typingUsers.delete(d.display_name);
          window.updateTypingIndicator(typingUsers);
        });
      }
    }, 500);
  });
})();
