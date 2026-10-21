'use client';

import React, { useState, useEffect } from 'react';
import { submitFeedback, trackEvent } from '../../utils/analytics';

const FEEDBACK_STORAGE_KEY = 'openjam_feedback_v1';
const DELAY_MS = 180000; // 3 minutes of listening

export default function SessionFeedbackToast({ roomId }) {
  const [visible, setVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const alreadySubmitted = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (alreadySubmitted) return;
    } catch (e) {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
      trackEvent('feedback_prompt_shown', { room_id: roomId });
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [roomId]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(FEEDBACK_STORAGE_KEY, 'dismissed');
    } catch (e) {}
    trackEvent('feedback_dismissed', { room_id: roomId });
  };

  const handleRatingClick = async (rating) => {
    setSelectedRating(rating);
    if (rating === 'great') {
      setSubmitting(true);
      await submitFeedback({ rating: 'great', room_id: roomId });
      setSubmitting(false);
      setSubmitted(true);
      try {
        window.localStorage.setItem(FEEDBACK_STORAGE_KEY, 'great');
      } catch (e) {}
      setTimeout(() => setVisible(false), 2200);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRating || submitting) return;
    setSubmitting(true);
    await submitFeedback({
      rating: selectedRating,
      comment: comment.trim(),
      room_id: roomId,
    });
    setSubmitting(false);
    setSubmitted(true);
    try {
      window.localStorage.setItem(FEEDBACK_STORAGE_KEY, selectedRating);
    } catch (e) {}
    setTimeout(() => setVisible(false), 2200);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Session feedback"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-88 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/95 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl p-4 text-white">
        {/* Glow ambient highlight */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss feedback"
          className="absolute top-3 right-3 text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-white/5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {submitted ? (
          <div className="py-3 px-1 text-center animate-in fade-in duration-200">
            <div className="text-2xl mb-1">🙌</div>
            <p className="text-sm font-medium text-white">Thank you for your feedback!</p>
            <p className="text-xs text-zinc-400 mt-0.5">Every thought helps make OpenJam better.</p>
          </div>
        ) : (
          <div>
            <div className="pr-6 mb-3">
              <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                <span>🎵</span> How’s your listening session?
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">Quick 1-second check-in</p>
            </div>

            {/* Emoji Rating Choices */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleRatingClick('great')}
                disabled={submitting}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition text-center ${
                  selectedRating === 'great'
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-zinc-200'
                }`}
              >
                <span className="text-xl mb-1">😍</span>
                <span className="text-xs font-medium">Great</span>
              </button>

              <button
                type="button"
                onClick={() => handleRatingClick('meh')}
                disabled={submitting}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition text-center ${
                  selectedRating === 'meh'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-zinc-200'
                }`}
              >
                <span className="text-xl mb-1">😐</span>
                <span className="text-xs font-medium">Meh</span>
              </button>

              <button
                type="button"
                onClick={() => handleRatingClick('confusing')}
                disabled={submitting}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition text-center ${
                  selectedRating === 'confusing'
                    ? 'border-rose-500 bg-rose-500/15 text-rose-300'
                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-zinc-200'
                }`}
              >
                <span className="text-xl mb-1">😕</span>
                <span className="text-xs font-medium">Confusing</span>
              </button>
            </div>

            {/* Comment Input for Meh / Confusing */}
            {(selectedRating === 'meh' || selectedRating === 'confusing') && (
              <form onSubmit={handleCommentSubmit} className="mt-3 pt-3 border-t border-white/5 animate-in fade-in duration-200">
                <label htmlFor="feedback-comment" className="block text-xs text-zinc-300 mb-1 font-medium">
                  What would make it better?
                </label>
                <div className="flex gap-2">
                  <input
                    id="feedback-comment"
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. queue took too long, audio cut off..."
                    maxLength={250}
                    autoFocus
                    className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !comment.trim()}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-zinc-950 font-semibold rounded-lg text-xs transition whitespace-nowrap"
                  >
                    {submitting ? '...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
