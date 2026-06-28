'use client';

import React from 'react';
import Link from 'next/link';
import { User, Search } from 'lucide-react';

export default function ProfileDiscover({
  searchQuery,
  setSearchQuery,
  results
}) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <User size={28} style={{ color: 'var(--theme-accent, #ff9f1c)' }} />
        <h3 style={{ fontSize: '24px', fontWeight: 800 }}>Discover Users</h3>
      </div>

      {/* Search Input */}
      <div className="profile-search-wrapper" style={{ marginBottom: '32px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', color: '#666' }} />
        <input
          type="text"
          placeholder="Search music lovers by name or Discord tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="profile-search-input"
          style={{ padding: '14px 20px 14px 48px', fontSize: '15px' }}
        />
      </div>

      {/* Results grid */}
      {results.length === 0 ? (
        <div className="profile-empty-state" style={{ padding: '80px 20px' }}>
          <User size={48} style={{ marginBottom: '16px', opacity: 0.15 }} />
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>
            {searchQuery.trim().length >= 2 ? "No users found" : "Search for other listeners"}
          </p>
          <p style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
            {searchQuery.trim().length >= 2 
              ? "Try adjusting your search query." 
              : "Type at least 2 characters to search OpenJam profiles."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {results.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.id}`}
              className="profile-card-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px',
                background: 'rgba(255,255,255,0.01)',
                borderRadius: '16px',
                textDecoration: 'none',
                color: '#fff'
              }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.05)' }}
                />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} color="#666" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <h4 style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.display_name}
                </h4>
                {user.discord_username && (
                  <p style={{ color: '#555', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px', fontWeight: 600 }}>
                    @{user.discord_username}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
