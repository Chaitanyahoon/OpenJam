import React from 'react';

// Room Loading Skeleton Screen
export function RoomSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141318 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      overflow: 'hidden'
    }}>
      {/* Header Skeleton */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="skeleton" style={{ width: '200px', height: '24px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ width: '300px', height: '14px', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="skeleton" style={{ width: '100px', height: '32px', borderRadius: '16px' }} />
          <div className="skeleton" style={{ width: '40px', height: '32px', borderRadius: '16px' }} />
        </div>
      </div>

      {/* Main Grid Layout Skeleton (mimicking RoomClient's layout) */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '24px',
        minHeight: 0
      }}>
        {/* Left Column: Player & Queue controls */}
        <div style={{
          flex: '1 1 500px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '32px',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          padding: '40px'
        }}>
          {/* Vinyl / Cover Art circular skeleton */}
          <div className="skeleton" style={{
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }} />

          {/* Track Info Skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
            <div className="skeleton" style={{ width: '220px', height: '20px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '140px', height: '14px', borderRadius: '4px' }} />
          </div>

          {/* Progress bar skeleton */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100%', height: '6px', borderRadius: '3px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ width: '32px', height: '12px', borderRadius: '3px' }} />
              <div className="skeleton" style={{ width: '32px', height: '12px', borderRadius: '3px' }} />
            </div>
          </div>

          {/* Controls Skeleton */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '56px', height: '56px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
          </div>
        </div>

        {/* Right Column: Sidebar tabs skeleton */}
        <div style={{
          flex: '0 0 380px',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }} className="room-sidebar-skeleton">
          {/* Tabs header */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '16px 12px',
            gap: '8px'
          }}>
            <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ flex: 1, height: '36px', borderRadius: '12px' }} />
          </div>

          {/* Content area: mock list items */}
          <div style={{
            flex: 1,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflow: 'hidden'
          }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '65%', height: '14px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '40%', height: '10px', borderRadius: '3px' }} />
                </div>
                <div className="skeleton" style={{ width: '32px', height: '16px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Loading Skeleton Screen (both private and public)
export function ProfileSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #141318 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif',
      padding: '40px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      overflow: 'hidden'
    }}>
      {/* Back link placeholder */}
      <div className="skeleton" style={{ width: '100px', height: '20px', borderRadius: '4px' }} />

      {/* User Header Profile Card */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '24px',
        padding: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap'
      }} className="profile-header-skeleton">
        {/* Avatar skeleton */}
        <div className="skeleton" style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          flexShrink: 0
        }} />
        
        {/* Name and details skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 200px' }}>
          <div className="skeleton" style={{ width: '240px', height: '28px', borderRadius: '6px' }} />
          <div className="skeleton" style={{ width: '160px', height: '14px', borderRadius: '4px' }} />
        </div>

        {/* Action button */}
        <div className="skeleton" style={{ width: '120px', height: '40px', borderRadius: '20px', flexShrink: 0 }} />
      </div>

      {/* Layout: Sidebar and Main Content Area */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '32px',
        flex: 1
      }}>
        {/* Left: Sidebar selector skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 260px' }} className="profile-sidebar-skeleton">
          <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px' }} />
        </div>

        {/* Right: Main Dashboard Area */}
        <div style={{
          flex: '1 1 500px',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px'
        }}>
          {/* Header of Content area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: '150px', height: '24px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '18px' }} />
          </div>

          {/* List items skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: '16px'
              }}>
                <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ width: '40%', height: '14px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '20%', height: '10px', borderRadius: '3px' }} />
                </div>
                <div className="skeleton" style={{ width: '80px', height: '32px', borderRadius: '16px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Playlist Loading Skeleton Screen
export function PlaylistSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #16151c 0%, #08080a 70%)',
      color: '#fff',
      fontFamily: 'var(--font-sans), sans-serif',
      padding: '40px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      maxWidth: '1200px',
      margin: '0 auto',
      overflow: 'hidden'
    }}>
      {/* Back button */}
      <div className="skeleton" style={{ width: '100px', height: '20px', borderRadius: '4px' }} />

      {/* Playlist header layout */}
      <div style={{
        display: 'flex',
        gap: '32px',
        alignItems: 'flex-end',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexWrap: 'wrap'
      }} className="playlist-header-skeleton">
        {/* Cover Art Skeleton */}
        <div className="skeleton" style={{
          width: '230px',
          height: '230px',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          flexShrink: 0
        }} className="playlist-art-skeleton" />

        {/* Text Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 300px' }}>
          <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '80%', height: '40px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: '150px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Action Button */}
        <div className="skeleton" style={{ width: '160px', height: '48px', borderRadius: '24px', flexShrink: 0 }} />
      </div>

      {/* Tracks list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.03)',
            borderRadius: '16px'
          }}>
            {/* Number placeholder */}
            <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '4px', textAlign: 'center' }} />
            {/* Album art */}
            <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '8px', flexShrink: 0 }} />
            {/* Track Info */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton" style={{ width: '35%', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '20%', height: '10px', borderRadius: '3px' }} />
            </div>
            {/* Duration */}
            <div className="skeleton" style={{ width: '40px', height: '14px', borderRadius: '4px' }} />
            {/* Actions */}
            <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
