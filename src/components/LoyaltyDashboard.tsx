"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import {
  type LoyaltyProfile,
  type LoyaltyTier,
  type RedemptionRecord,
  LoyaltyStorage,
  TIERS,
  getTierConfig,
  getNextTier,
  volumeToNextTier,
  DEFAULT_PROGRAM_CONFIG,
  pointsToUSDC,
} from "@/lib/loyalty";

interface Props {
  userAddress: string;
  onTierUpgrade?: (tier: LoyaltyTier) => void;
}

type Tab = "overview" | "rewards" | "tiers" | "history";

const REWARDS_CATALOG = [
  { id: "r1", name: "Fee Waiver", description: "Waive next transaction fee", points: 500, tier: "bronze" as LoyaltyTier },
  { id: "r2", name: "Priority Processing", description: "Skip the queue for 7 days", points: 1000, tier: "silver" as LoyaltyTier },
  { id: "r3", name: "Rate Boost", description: "0.1% better rate for 30 days", points: 2500, tier: "gold" as LoyaltyTier },
  { id: "r4", name: "VIP Support", description: "Dedicated support agent for 30 days", points: 5000, tier: "platinum" as LoyaltyTier },
];

export default function LoyaltyDashboard({ userAddress, onTierUpgrade }: Props) {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [redemptionHistory, setRedemptionHistory] = useState<RedemptionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) return;
    setProfile(LoyaltyStorage.get(userAddress));
    setRedemptionHistory(LoyaltyStorage.getRedemptionHistory(userAddress));
  }, [userAddress]);

  if (!profile) return null;

  const tierConfig = getTierConfig(profile.tier);
  const nextTier = getNextTier(profile.tier);
  const remaining = volumeToNextTier(profile);
  const currentTierDef = TIERS.find((t) => t.tier === profile.tier)!;
  const progressPct = nextTier
    ? Math.min(
        100,
        ((profile.totalVolume - currentTierDef.minVolume) /
          (nextTier.minVolume - currentTierDef.minVolume)) *
          100,
      )
    : 100;

  const handleRedeem = (points: number) => {
    setRedeemError(null);
    setRedeemSuccess(null);
    const result = LoyaltyStorage.redeemPoints(userAddress, points);
    if (result.success) {
      setProfile(result.profile);
      setRedemptionHistory(LoyaltyStorage.getRedemptionHistory(userAddress));
      setRedeemSuccess(`Redeemed ${points} pts for $${result.usdcValue.toFixed(2)} USDC`);
      setRedeemPoints("");
    } else {
      setRedeemError(result.error ?? "Redemption failed");
    }
  };

  const handleCustomRedeem = () => {
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      setRedeemError("Enter a valid points amount");
      return;
    }
    handleRedeem(pts);
  };

  const config = DEFAULT_PROGRAM_CONFIG;

  return (
    <div className="border border-[#333333] bg-[#111111] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white tracking-wider uppercase">Loyalty Status</h2>
        <span
          className="text-xs font-bold tracking-widest uppercase px-3 py-1 border"
          style={{ color: tierConfig.color, borderColor: tierConfig.color + "55" }}
        >
          {tierConfig.label}
        </span>
      </div>

      {/* Points Balance */}
      <div className="border border-[#222222] p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Points Balance</div>
          <div className="text-2xl text-white font-bold tabular-nums">{profile.points.toLocaleString()}</div>
          <div className="text-[10px] text-[#555555] mt-0.5">
            ≈ ${pointsToUSDC(profile.points, config).toFixed(2)} USDC
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Lifetime</div>
          <div className="text-sm text-[#aaaaaa] tabular-nums">{profile.lifetimePoints.toLocaleString()} pts</div>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && remaining !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-[#777777]">
            <span>Progress to {nextTier.label}</span>
            <span>{remaining.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDC remaining</span>
          </div>
          <div className="h-1.5 bg-[#222222] w-full">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: nextTier.color }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#222222]">
        {(["overview", "rewards", "tiers", "history"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-[10px] uppercase tracking-widest transition-colors ${
              activeTab === tab
                ? "text-[#c9a962] border-b border-[#c9a962] -mb-px"
                : "text-[#555555] hover:text-[#777777]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-[#222222] p-3">
              <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Total Volume</div>
              <div className="text-sm text-white font-semibold tabular-nums">
                {profile.totalVolume.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
              </div>
            </div>
            <div className="border border-[#222222] p-3">
              <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-1">Transactions</div>
              <div className="text-sm text-white font-semibold tabular-nums">{profile.transactionCount}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#777777] uppercase tracking-widest mb-2">Exclusive Benefits</div>
            <ul className="space-y-1">
              {tierConfig.benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-xs text-[#aaaaaa]">
                  <span style={{ color: tierConfig.color }}>✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-[#222222] p-3 space-y-1">
            <div className="text-[10px] text-[#777777] uppercase tracking-widest">Multipliers & Limits</div>
            <div className="flex justify-between text-xs text-[#aaaaaa]">
              <span>Points multiplier</span>
              <span className="text-white">{tierConfig.pointsMultiplier}×</span>
            </div>
            <div className="flex justify-between text-xs text-[#aaaaaa]">
              <span>Fee discount</span>
              <span className="text-white">{(tierConfig.feeDiscount * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-xs text-[#aaaaaa]">
              <span>Daily withdrawal limit</span>
              <span className="text-white">{tierConfig.withdrawalLimit.toLocaleString()} USDC</span>
            </div>
          </div>
        </div>
      )}

      {/* Rewards Catalog Tab */}
      {activeTab === "rewards" && (
        <div className="space-y-3">
          {redeemError && <p className="text-xs text-red-400">{redeemError}</p>}
          {redeemSuccess && <p className="text-xs text-green-400">{redeemSuccess}</p>}

          <div className="space-y-2">
            {REWARDS_CATALOG.map((reward) => {
              const tierCfg = getTierConfig(reward.tier);
              const canAfford = profile.points >= reward.points;
              const tierUnlocked = TIERS.findIndex((t) => t.tier === profile.tier) >=
                TIERS.findIndex((t) => t.tier === reward.tier);
              const available = canAfford && tierUnlocked;
              return (
                <div
                  key={reward.id}
                  className={cn(
                    "border p-3 flex items-center justify-between",
                    available ? "border-[#333333]" : "border-[#1a1a1a] opacity-50",
                  )}
                >
                  <div>
                    <div className="text-xs text-white font-semibold">{reward.name}</div>
                    <div className="text-[10px] text-[#777777] mt-0.5">{reward.description}</div>
                    <div className="text-[10px] mt-1" style={{ color: tierCfg.color }}>
                      {tierCfg.label}+ · {reward.points.toLocaleString()} pts
                    </div>
                  </div>
                  <button
                    onClick={() => handleRedeem(reward.points)}
                    disabled={!available}
                    className={cn(
                      "text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors",
                      available
                        ? "border-[#c9a962] text-[#c9a962] hover:bg-[#c9a962] hover:text-[#0a0a0a]"
                        : "border-[#222222] text-[#333333] cursor-not-allowed",
                    )}
                  >
                    Redeem
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom redemption */}
          <div className="border border-[#222222] p-3 space-y-2">
            <div className="text-[10px] text-[#777777] uppercase tracking-widest">Custom Redemption</div>
            <div className="flex gap-2">
              <input
                type="number"
                min={config.minRedemptionPoints}
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder={`Min ${config.minRedemptionPoints} pts`}
                aria-label="Points to redeem"
                className="flex-1 bg-[#0a0a0a] border border-[#333333] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c9a962]"
              />
              <button
                onClick={handleCustomRedeem}
                className="px-4 py-2 border border-[#c9a962] text-[#c9a962] text-[10px] uppercase tracking-widest hover:bg-[#c9a962] hover:text-[#0a0a0a] transition-colors"
              >
                Redeem
              </button>
            </div>
            {redeemPoints && !isNaN(parseInt(redeemPoints)) && (
              <div className="text-[10px] text-[#555555]">
                ≈ ${pointsToUSDC(parseInt(redeemPoints), config).toFixed(2)} USDC
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tier Comparison Tab */}
      {activeTab === "tiers" && (
        <div className="space-y-2">
          {TIERS.map((t) => {
            const isActive = t.tier === profile.tier;
            const isUnlocked = TIERS.findIndex((x) => x.tier === profile.tier) >= TIERS.findIndex((x) => x.tier === t.tier);
            return (
              <div
                key={t.tier}
                className={cn(
                  "border p-3 space-y-2",
                  isActive ? "" : isUnlocked ? "border-[#222222]" : "border-[#1a1a1a] opacity-40",
                )}
                style={isActive ? { borderColor: t.color + "88" } : {}}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: t.color }}>{t.label}</span>
                  <span className="text-[10px] text-[#555555]">{t.minVolume.toLocaleString()}+ USDC</span>
                  {isActive && (
                    <span className="text-[10px] px-2 py-0.5 border" style={{ color: t.color, borderColor: t.color + "55" }}>
                      Current
                    </span>
                  )}
                </div>
                <ul className="space-y-0.5">
                  {t.benefits.map((b) => (
                    <li key={b} className="text-[10px] text-[#777777] flex items-center gap-1.5">
                      <span style={{ color: t.color }}>✓</span>{b}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-4 text-[10px] text-[#555555]">
                  <span>{t.pointsMultiplier}× points</span>
                  <span>{(t.feeDiscount * 100).toFixed(2)}% fee off</span>
                  <span>{t.withdrawalLimit.toLocaleString()} USDC/day</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Redemption History Tab */}
      {activeTab === "history" && (
        <div className="space-y-2">
          {redemptionHistory.length === 0 ? (
            <div className="text-xs text-[#555555] text-center py-4">No redemption history yet</div>
          ) : (
            redemptionHistory.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-[#222222] p-3">
                <div>
                  <div className="text-xs text-white">{r.pointsRedeemed.toLocaleString()} pts redeemed</div>
                  <div className="text-[10px] text-[#555555] mt-0.5">
                    {new Date(r.redeemedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-xs text-green-400 font-semibold">+${r.usdcValue.toFixed(2)} USDC</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
