import { useState, useEffect } from 'react';

interface FollowButtonProps {
  organizerId: string;
  initialFollowing: boolean;
  initialFollowersCount: number;
  apiBase: string;
}

export const FollowButton = ({
  organizerId,
  initialFollowing,
  initialFollowersCount,
  apiBase,
}: FollowButtonProps) => {
  const [following, setFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in by looking for token in localStorage
    const token = localStorage.getItem('sb-token');
    setIsLoggedIn(!!token);
  }, []);

  const handleFollow = async () => {
    if (!isLoggedIn) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('sb-token');
      const method = following ? 'DELETE' : 'POST';
      
      const res = await fetch(`${apiBase}/api/organizers/${organizerId}/follow`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        setFollowing(json.data.following);
        setFollowersCount(json.data.followers_count);
      } else {
        console.error('Follow action failed:', res.status);
      }
    } catch (err) {
      console.error('Follow action error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleFollow}
        disabled={loading}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
          ${following
            ? 'bg-surface-medium text-text-primary border border-border-default hover:bg-surface-elevated hover:border-accent-rose hover:text-accent-rose'
            : 'bg-accent-blue text-white hover:bg-accent-blue/90'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : following ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        )}
        {following ? 'フォロー中' : 'フォロー'}
      </button>
      <span className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{followersCount}</span> フォロワー
      </span>
    </div>
  );
};

export default FollowButton;
