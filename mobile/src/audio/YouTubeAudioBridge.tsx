/**
 * YouTube Audio Bridge — Headless WebView executing YouTube IFrame Player API.
 *
 * Runs client-side directly on the user's Android phone IP (bypassing cloud
 * datacenter scraping blocks and bot protections). Matches the exact fallback
 * mechanism used by the Next.js PWA (frontend-next/utils/YouTubePlayer.js).
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface YouTubeAudioBridgeRef {
  loadVideo: (videoId: string, startSeconds?: number, autoplay?: boolean) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
}

interface YouTubeAudioBridgeProps {
  onProgress?: (currentTimeSec: number, durationSec: number) => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: (code: number | string) => void;
}

const YOUTUBE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { margin: 0; padding: 0; background: transparent; overflow: hidden; }</style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player = null;
    var isReady = false;
    var pending = null;

    function post(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    }

    function onPlayerReady(e) {
      isReady = true;
      post({ type: 'ready' });
      if (pending) {
        executeCommand(pending);
        pending = null;
      }
    }

    function onPlayerStateChange(e) {
      // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
      var states = { '-1': 'unstarted', '0': 'ended', '1': 'playing', '2': 'paused', '3': 'buffering', '5': 'cued' };
      var cur = player && player.getCurrentTime ? player.getCurrentTime() : 0;
      var dur = player && player.getDuration ? player.getDuration() : 0;
      post({
        type: 'stateChange',
        state: states[e.data] || 'unknown',
        code: e.data,
        currentTime: cur,
        duration: dur
      });
    }

    function onPlayerError(e) {
      post({ type: 'error', code: e.data });
    }

    setInterval(function() {
      if (isReady && player && player.getPlayerState && player.getPlayerState() === 1) {
        post({
          type: 'progress',
          currentTime: player.getCurrentTime ? player.getCurrentTime() : 0,
          duration: player.getDuration ? player.getDuration() : 0
        });
      }
    }, 400);

    function executeCommand(cmd) {
      if (!isReady || !player) {
        pending = cmd;
        return;
      }
      try {
        if (cmd.action === 'load') {
          if (cmd.autoplay) {
            player.loadVideoById({ videoId: cmd.videoId, startSeconds: cmd.startSeconds || 0 });
          } else {
            player.cueVideoById({ videoId: cmd.videoId, startSeconds: cmd.startSeconds || 0 });
          }
        } else if (cmd.action === 'play') {
          if (player.playVideo) player.playVideo();
        } else if (cmd.action === 'pause') {
          if (player.pauseVideo) player.pauseVideo();
        } else if (cmd.action === 'seek') {
          if (player.seekTo) player.seekTo(cmd.seconds, true);
        } else if (cmd.action === 'volume') {
          if (player.setVolume) player.setVolume(Math.round(cmd.volume * 100));
        }
      } catch (err) {
        post({ type: 'exception', message: String(err) });
      }
    }

    function handleMsg(evt) {
      try {
        var data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        if (data && data.action) executeCommand(data);
      } catch (e) {}
    }

    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;

export const YouTubeAudioBridge = forwardRef<
  YouTubeAudioBridgeRef,
  YouTubeAudioBridgeProps
>(function YouTubeAudioBridge(
  { onProgress, onPlaying, onPaused, onEnded, onError },
  ref,
) {
  const webViewRef = useRef<WebView>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const pendingCommandRef = useRef<any>(null);

  const sendCommand = (cmd: any) => {
    const json = JSON.stringify(cmd);
    if (!bridgeReady || !webViewRef.current) {
      pendingCommandRef.current = cmd;
      return;
    }
    webViewRef.current.postMessage(json);
  };

  useImperativeHandle(ref, () => ({
    loadVideo: (videoId: string, startSeconds = 0, autoplay = true) => {
      sendCommand({
        action: 'load',
        videoId,
        startSeconds,
        autoplay,
      });
    },
    play: () => {
      sendCommand({ action: 'play' });
    },
    pause: () => {
      sendCommand({ action: 'pause' });
    },
    seekTo: (seconds: number) => {
      sendCommand({ action: 'seek', seconds });
    },
    setVolume: (volume: number) => {
      sendCommand({ action: 'volume', volume });
    },
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setBridgeReady(true);
        if (pendingCommandRef.current && webViewRef.current) {
          webViewRef.current.postMessage(JSON.stringify(pendingCommandRef.current));
          pendingCommandRef.current = null;
        }
      } else if (data.type === 'progress') {
        onProgress?.(data.currentTime || 0, data.duration || 0);
      } else if (data.type === 'stateChange') {
        if (data.state === 'playing') onPlaying?.();
        else if (data.state === 'paused') onPaused?.();
        else if (data.state === 'ended') onEnded?.();
      } else if (data.type === 'error') {
        onError?.(data.code);
      }
    } catch {}
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: YOUTUBE_HTML, baseUrl: 'https://www.youtube.com' }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        style={styles.webView}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    opacity: 0.01,
    position: 'absolute',
    top: -10,
    left: -10,
    overflow: 'hidden',
  },
  webView: {
    width: 1,
    height: 1,
  },
});
