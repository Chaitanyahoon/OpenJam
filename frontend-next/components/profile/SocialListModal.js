'use client';

import React, { useState } from 'react';
import { X, User, UserMinus } from 'lucide-react';
import Link from 'next/link';

export default function SocialListModal({
  isOpen,
  onClose,
  followers = [],
  following = [],
  onUnfollow,
  initialTab = 'followers'
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'followers' | 'following'

  if (!isOpen) return null;

  const currentList = activeTab === 'followers' ? followers : following;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#0d0d12',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>Social Connections</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
          <button
            onClick={() => setActiveTab('followers')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'followers' ? '2px solid var(--theme-accent, #ff9f1c)' : '2px solid transparent',
              color: activeTab === 'followers' ? '#fff' : '#666',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Followers ({followers.length})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'following' ? '2px solid var(--theme-accent, #ff9f1c)' : '2px solid transparent',
              color: activeTab === 'following' ? '#fff' : '#666',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Following ({following.length})
          </button>
        </div>

        {/* List Content */}
        <div style={{ maxHeight: '350px', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {currentList.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#555', fontSize: '13px' }}>
              No users to display here.
            </div>
          ) : (
            currentList.map((usr) => (
              <div
                key={usr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: '16px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
              >
                {/* User Info Link */}
                <Link
                  href={`/profile/${usr.id}`}
                  target="_blank"
                  onClick={onClose}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    textDecoration: 'none',
                    color: '#fff',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  {usr.avatar_url ? (
                    <img
                      src={usr.avatar_url}
                      alt={usr.display_name}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={18} color="#666" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {usr.display_name}
                    </div>
                    {usr.discord_username && (
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '1px' }}>
                        @{usr.discord_username}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Unfollow button inside following tab */}
                {activeTab === 'following' && onUnfollow && (
                  <button
                    onClick={() => onUnfollow(usr.id)}
                    title="Unfollow user"
                    style={{
                      background: 'rgba(255, 71, 87, 0.1)',
                      border: '1px solid rgba(255, 71, 87, 0.2)',
                      color: '#ff4757',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      marginLeft: '12px',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ff4757';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)';
                      e.currentTarget.style.color = '#ff4757';
                    }}
                  >
                    <UserMinus size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
