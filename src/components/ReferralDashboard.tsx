'use client';

import { useState, useEffect } from 'react';

interface ReferralStats {
  total_referrals: number;
  total_rewards: number;
  completed_referrals: number;
  pending_referrals: number;
  conversion_rate: number;
}

interface ReferralHistoryItem {
  id: string;
  referred_user_id: string;
  status: 'pending' | 'completed' | 'failed';
  reward_amount: number;
  created_at: string;
}

interface LeaderboardEntry {
  userId: string;
  totalReferrals: number;
  totalRewardsEarned: number;
  rank: number;
}

interface ReferralDashboardProps {
  userId: string;
}

type Tab = 'overview' | 'history' | 'leaderboard';

export function ReferralDashboard({ userId }: ReferralDashboardProps) {
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({
    total_referrals: 0,
    total_rewards: 0,
    completed_referrals: 0,
    pending_referrals: 0,
    conversion_rate: 0,
  });
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferralData();
  }, [userId]);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const [codeRes, statsRes, historyRes, leaderboardRes] = await Promise.all([
        fetch(`/api/offramp/referral?userId=${userId}`),
        fetch(`/api/offramp/referral/analytics?userId=${userId}`),
        fetch(`/api/offramp/referral/history?userId=${userId}`),
        fetch(`/api/offramp/referral/leaderboard`),
      ]);

      const codeData = await codeRes.json();
      if (codeData.code) setReferralCode(codeData.code.code);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.referrals ?? []);
      }

      if (leaderboardRes.ok) {
        const lbData = await leaderboardRes.json();
        setLeaderboard(lbData.leaderboard ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch referral data', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCode = async () => {
    try {
      const res = await fetch('/api/offramp/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'generate' }),
      });
      const data = await res.json();
      setReferralCode(data.code.code);
    } catch (error) {
      console.error('Failed to generate referral code', error);
    }
  };

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied('code');
    setTimeout(() => setCopied(null), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Join Stellar-Spend',
        text: 'Use my referral link to sign up and we both earn rewards!',
        url: referralLink,
      });
    } else {
      copyLink();
    }
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-green-400';
    if (status === 'pending') return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="border border-[#333333] bg-[#111111] p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white tracking-wider uppercase">Referral Program</h2>

      {/* Referral Code & Sharing */}
      <div className="space-y-2">
        <div className="text-[10px] text-[#777777] uppercase tracking-widest">Your Referral Code</div>
        {referralCode ? (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralCode}
                readOnly
                aria-label="Referral code"
                className="flex-1 bg-[#0a0a0a] border border-[#333333] px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none"
              />
              <button
                onClick={copyCode}
                className="px-4 py-2 border border-[#c9a962] text-[#c9a962] text-[10px] uppercase tracking-widest hover:bg-[#c9a962] hover:text-[#0a0a0a] transition-colors"
              >
                {copied === 'code' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                aria-label="Referral link"
                className="flex-1 bg-[#0a0a0a] border border-[#333333] px-3 py-2 text-xs text-[#777777] focus:outline-none truncate"
              />
              <button
                onClick={copyLink}
                className="px-3 py-2 border border-[#333333] text-[#777777] text-[10px] uppercase tracking-widest hover:border-[#c9a962] hover:text-[#c9a962] transition-colors"
              >
                {copied === 'link' ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={shareLink}
                className="px-3 py-2 border border-[#333333] text-[#777777] text-[10px] uppercase tracking-widest hover:border-[#c9a962] hover:text-[#c9a962] transition-colors"
              >
                Share
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={generateCode}
            className="w-full px-3 py-2 border border-[#c9a962] text-[#c9a962] text-[10px] uppercase tracking-widest hover:bg-[#c9a962] hover:text-[#0a0a0a] transition-colors"
          >
            Generate Code
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#222222]">
        {(['overview', 'history', 'leaderboard'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[10px] uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? 'text-[#c9a962] border-b border-[#c9a962] -mb-px'
                : 'text-[#555555] hover:text-[#777777]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-[#555555] text-center py-4">Loading...</div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-[#222222] p-3">
                  <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Total Referrals</div>
                  <div className="text-xl text-white font-semibold tabular-nums">{stats.total_referrals}</div>
                </div>
                <div className="border border-[#222222] p-3">
                  <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Total Rewards</div>
                  <div className="text-xl text-white font-semibold tabular-nums">${stats.total_rewards}</div>
                </div>
                <div className="border border-[#222222] p-3">
                  <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Completed</div>
                  <div className="text-xl text-green-400 font-semibold tabular-nums">{stats.completed_referrals}</div>
                </div>
                <div className="border border-[#222222] p-3">
                  <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Pending</div>
                  <div className="text-xl text-yellow-400 font-semibold tabular-nums">{stats.pending_referrals}</div>
                </div>
              </div>
              {stats.total_referrals > 0 && (
                <div className="border border-[#222222] p-3">
                  <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Conversion Rate</div>
                  <div className="text-sm text-white font-semibold">
                    {(stats.conversion_rate * 100).toFixed(1)}%
                  </div>
                  <div className="mt-2 h-1.5 bg-[#222222]">
                    <div
                      className="h-full bg-[#c9a962] transition-all"
                      style={{ width: `${stats.conversion_rate * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {history.length === 0 ? (
                <div className="text-xs text-[#555555] text-center py-4">No referral history yet</div>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border border-[#222222] p-3">
                    <div>
                      <div className="text-xs text-white font-mono">{item.referred_user_id.slice(0, 12)}…</div>
                      <div className="text-[10px] text-[#555555] mt-0.5">
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-semibold ${statusColor(item.status)}`}>
                        {item.status.toUpperCase()}
                      </div>
                      <div className="text-[10px] text-[#777777] mt-0.5">${item.reward_amount} reward</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-2">
              {leaderboard.length === 0 ? (
                <div className="text-xs text-[#555555] text-center py-4">No leaderboard data yet</div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between border p-3 ${
                      entry.userId === userId ? 'border-[#c9a962]' : 'border-[#222222]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold w-6 text-center ${
                          entry.rank === 1
                            ? 'text-yellow-400'
                            : entry.rank === 2
                            ? 'text-[#c0c0c0]'
                            : entry.rank === 3
                            ? 'text-[#cd7f32]'
                            : 'text-[#555555]'
                        }`}
                      >
                        #{entry.rank}
                      </span>
                      <div>
                        <div className="text-xs text-white font-mono">
                          {entry.userId === userId ? 'You' : `${entry.userId.slice(0, 10)}…`}
                        </div>
                        <div className="text-[10px] text-[#555555]">{entry.totalReferrals} referrals</div>
                      </div>
                    </div>
                    <div className="text-xs text-[#c9a962] font-semibold">${entry.totalRewardsEarned}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
