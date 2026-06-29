'use client';

import React from 'react';
import Link from 'next/link';
import { User, Search, Users } from 'lucide-react';

const THEME_GRADIENTS = {
  amber: 'linear-gradient(135deg, #78350f 0%, #ff9f1c 50%, #b45309 100%)',
  cobalt: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1d4ed8 100%)',
  rose: 'linear-gradient(135deg, #581c87 0%, #ec4899 50%, #be185d 100%)',
  emerald: 'linear-gradient(135deg, #064e3b 0%, #10b981 50%, #047857 100%)',
  violet: 'linear-gradient(135deg, #2e1065 0%, #8b5cf6 50%, #6d28d9 100%)'
};

export default function ProfileDiscover({
  searchQuery,
  setSearchQuery,
  results
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <Users size={28} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
        <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Discover Users</h3>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#555', zIndex: 2 }} />
        <input
          type="text"
          placeholder="Search by name or Discord tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 20px 14px 48px',
            fontSize: '14px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '14px',
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--theme-accent, #ff9f1c)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,159,28,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Results grid */}
      {results.length === 0 ? (
        <div style={{
          padding: '80px 20px',
          textAlign: 'center',
          border: '1px dashed rgba(255,255,255,0.06)',
          borderRadius: '20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Users size={28} style={{ opacity: 0.2 }} />
          </div>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
            {searchQuery.trim().length >= 2 ? "No users found" : "Find other listeners"}
          </p>
          <p style={{ fontSize: '13px', color: '#555', marginTop: '6px', lineHeight: 1.3 }}>
            {searchQuery.trim().length >= 2
              ? "Try a different name or Discord tag."
              : "Type at least 2 characters to discover OpenJam profiles."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {results.map((user) => {
            const themeGradient = THEME_GRADIENTS[user.profile_theme] || THEME_GRADIENTS.amber;
            return (
              <Link
                key={user.id}
                href={`/profile/${user.username ? `@${user.username}` : user.id}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: '#fff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Mini banner strip */}
                <div style={{
                  height: '56px',
                  width: '100%',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {user.banner_url ? (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url(${user.banner_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }} />
                  ) : (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: themeGradient,
                      opacity: 0.7
                    }} />
                  )}
                  {/* Bottom fade */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '28px',
                    background: 'linear-gradient(to bottom, transparent, rgba(10,10,14,0.9))'
                  }} />
                </div>

                {/* User info section */}
                <div style={{ padding: '0 16px 16px', marginTop: '-22px', position: 'relative', zIndex: 2 }}>
                  {/* Avatar */}
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid #0e0e12',
                        background: '#0e0e12',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: '#1a1a22',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '3px solid #0e0e12'
                    }}>
                      <User size={22} color="#555" />
                    </div>
                  )}

                  {/* Name + username */}
                  <div style={{ marginTop: '10px' }}>
                    <h4 style={{
                      fontWeight: 800,
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      letterSpacing: '-0.01em'
                    }}>
                      {user.display_name}
                    </h4>
                    {user.discord_username && (
                      <p style={{
                        color: '#555',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                        fontWeight: 600
                      }}>
                        @{user.discord_username}
                      </p>
                    )}
                    {user.bio && (
                      <p style={{
                        color: '#666',
                        fontSize: '11px',
                        marginTop: '6px',
                        lineHeight: 1.3,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
