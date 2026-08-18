'use client';

import React, { useState } from 'react';
import { Activity, CheckCircle, Wifi, AlertTriangle } from 'lucide-react';

/**
 * SyncPrecisionBadge - Displays live NTP clock offset and RTT accuracy in real-time.
 * 
 * Thresholds:
 * - < 30ms:  🟢 Green Neon (Sub-30ms ultra precision)
 * - 30-100ms: 🟡 Amber Neon (Standard sync)
 * - > 100ms:  🟠 Orange/Rose (High latency / Jitter)
 * 
 * Props:
 * - offset: number (ms offset from server clock, positive or negative)
 * - rtt: number (round-trip time in ms)
 * - isSynced: boolean (true if synced, false if disconnected/recalibrating)
 * - compact: boolean (render smaller badge for tight bars)
 * - showDetails: boolean (render inline RTT label)
 * - className: string
 */
export default function SyncPrecisionBadge({
  offset = 0,
  rtt = 0,
  isSynced = true,
  compact = false,
  showDetails = false,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Normalize absolute offset and round RTT
  const absOffset = Math.round(Math.abs(offset || 0));
  const roundedRtt = Math.round(rtt || 0);
  const oneWayLatency = Math.max(1, Math.round(roundedRtt / 2));

  // Tier determination based on true network latency (RTT)
  let tierColor = '#10b981'; // Green (Ultra Precision)
  let tierBg = 'rgba(16, 185, 129, 0.12)';
  let tierBorder = 'rgba(16, 185, 129, 0.3)';
  let tierGlow = '0 0 10px rgba(16, 185, 129, 0.3)';
  let statusText = 'Synced';

  if (!isSynced) {
    tierColor = '#94a3b8';
    tierBg = 'rgba(148, 163, 184, 0.1)';
    tierBorder = 'rgba(148, 163, 184, 0.25)';
    tierGlow = 'none';
    statusText = 'Syncing…';
  } else if (roundedRtt >= 180) {
    tierColor = '#f43f5e'; // Rose / Orange-Red
    tierBg = 'rgba(244, 63, 94, 0.12)';
    tierBorder = 'rgba(244, 63, 94, 0.35)';
    tierGlow = '0 0 10px rgba(244, 63, 94, 0.35)';
    statusText = 'High Ping';
  } else if (roundedRtt >= 80) {
    tierColor = '#f59e0b'; // Amber
    tierBg = 'rgba(245, 158, 11, 0.12)';
    tierBorder = 'rgba(245, 158, 11, 0.35)';
    tierGlow = '0 0 10px rgba(245, 158, 11, 0.35)';
    statusText = 'Synced';
  }

  return (
    <div
      className={`sync-precision-badge-wrapper ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: compact ? '4px' : '6px',
          background: tierBg,
          border: `1px solid ${tierBorder}`,
          borderRadius: '9999px',
          padding: compact ? '2px 8px' : '4px 10px',
          fontSize: compact ? '10.5px' : '11.5px',
          fontWeight: 700,
          color: tierColor,
          boxShadow: isHovered ? tierGlow : 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono, "SF Mono", monospace)'
        }}
        title={`NTP Clock Sync: ${absOffset}ms offset, ${roundedRtt}ms RTT`}
      >
        {/* Pulsing Status Indicator Dot */}
        <span
          style={{
            display: 'inline-block',
            width: compact ? '6px' : '7px',
            height: compact ? '6px' : '7px',
            borderRadius: '50%',
            background: tierColor,
            boxShadow: `0 0 8px ${tierColor}`,
            animation: isSynced ? 'pulse 2s infinite' : 'none'
          }}
        />

        {/* Text / Metric */}
        <span>
          {isSynced ? `${statusText} • ${oneWayLatency}ms` : statusText}
        </span>

        {showDetails && isSynced && (
          <span style={{ opacity: 0.65, fontSize: '10px', marginLeft: '2px' }}>
            ({roundedRtt}ms RTT)
          </span>
        )}
      </div>

      {/* Interactive Tooltip on Hover */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '120%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d0d14',
            border: `1px solid ${tierBorder}`,
            borderRadius: '10px',
            padding: '8px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '11px',
            color: '#eee',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: tierColor }}>
            <Activity size={12} />
            <span>NTP Precision Clock</span>
          </div>
          <div style={{ color: '#aaa', fontSize: '10.5px' }}>
            Network Latency: <strong style={{ color: '#fff' }}>{oneWayLatency}ms</strong> <span style={{ color: '#777' }}>({roundedRtt}ms RTT)</span>
          </div>
          <div style={{ color: '#aaa', fontSize: '10.5px' }}>
            Clock Drift (Compensated): <strong style={{ color: '#fff' }}>{offset > 0 ? `+${absOffset}` : `-${absOffset}`}ms</strong>
          </div>
          <div style={{ color: '#666', fontSize: '9.5px', marginTop: '2px' }}>
            Cristian's Algorithm Continuous Sync
          </div>
        </div>
      )}
    </div>
  );
}
