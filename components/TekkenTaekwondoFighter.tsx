'use client';

import React from 'react';
import type { TaekwondoBelt, TaekwondoKickPose } from '@/lib/taekwondo_catalog';

export interface TekkenFighterProps {
  emoji: string;
  belt: TaekwondoBelt;
  pose: TaekwondoKickPose;
  facing: 'left' | 'right';
  rageActive?: boolean;
  blocking?: boolean;
  trailHex?: string;
  size?: 'sm' | 'lg';
}

export function TekkenTaekwondoFighter({
  emoji,
  belt,
  pose,
  facing,
  rageActive = false,
  blocking = false,
  trailHex,
  size = 'lg',
}: TekkenFighterProps) {
  const isKicking = pose !== 'idle' && pose !== 'hurt';
  const isAerial =
    pose === 'flying_spin' || pose === 'hurricane_540' || pose === 'sky_dragon';
  const flipX = facing === 'left' ? -1 : 1;
  const dims = size === 'sm' ? 'w-28 h-32' : 'w-36 h-40 sm:w-44 sm:h-48';
  const activeTrail = trailHex || (rageActive ? '#facc15' : '#38bdf8');

  const torsoRotate = blocking
    ? -6
    : pose === 'axe_kick'
    ? -18
    : pose === 'back_kick'
    ? 24
    : pose === 'high_kick'
    ? -28
    : pose === 'side_kick'
    ? -36
    : pose === 'front_kick'
    ? -16
    : pose === 'flying_spin'
    ? -22
    : pose === 'hurricane_540'
    ? -34
    : pose === 'sky_dragon'
    ? -42
    : pose === 'hurt'
    ? -32
    : 4;

  const kickLegAngle = blocking
    ? 6
    : pose === 'axe_kick'
    ? -158
    : pose === 'back_kick'
    ? -102
    : pose === 'high_kick'
    ? -134
    : pose === 'side_kick'
    ? -92
    : pose === 'front_kick'
    ? -76
    : pose === 'flying_spin'
    ? -116
    : pose === 'hurricane_540'
    ? -138
    : pose === 'sky_dragon'
    ? -148
    : pose === 'hurt'
    ? -18
    : 14;

  const supportLegAngle = blocking
    ? -8
    : pose === 'sky_dragon'
    ? 54
    : pose === 'hurricane_540'
    ? 48
    : pose === 'flying_spin'
    ? 36
    : pose === 'axe_kick'
    ? 4
    : pose === 'back_kick'
    ? -18
    : pose === 'high_kick'
    ? 12
    : pose === 'side_kick'
    ? 16
    : pose === 'front_kick'
    ? 8
    : pose === 'hurt'
    ? 24
    : -14;

  const frontArmAngle = blocking
    ? -118
    : pose === 'sky_dragon'
    ? -115
    : pose === 'hurricane_540'
    ? -98
    : pose === 'flying_spin'
    ? -84
    : pose === 'axe_kick'
    ? 48
    : pose === 'back_kick'
    ? -70
    : pose === 'high_kick'
    ? -44
    : pose === 'side_kick'
    ? -62
    : pose === 'front_kick'
    ? -38
    : pose === 'hurt'
    ? -130
    : -34;

  const backArmAngle = blocking
    ? -102
    : pose === 'sky_dragon'
    ? 110
    : pose === 'hurricane_540'
    ? 96
    : pose === 'flying_spin'
    ? 88
    : pose === 'axe_kick'
    ? 68
    : pose === 'back_kick'
    ? 80
    : pose === 'high_kick'
    ? 56
    : pose === 'side_kick'
    ? 70
    : pose === 'front_kick'
    ? 44
    : pose === 'hurt'
    ? 100
    : 32;

  const bodyLiftY =
    pose === 'sky_dragon'
      ? -22
      : pose === 'hurricane_540'
      ? -16
      : pose === 'flying_spin'
      ? -10
      : 0;

  return (
    <div
      className={`relative ${dims} select-none`}
      style={{
        transform: `scaleX(${flipX})`,
        transition: 'transform 75ms ease-out',
      }}
    >
      <svg
        viewBox="0 0 140 155"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_14px_rgba(0,0,0,0.85)]"
      >
        <defs>
          <radialGradient id={`tekkenRageAura-${belt.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={pose === 'sky_dragon' ? '#facc15' : '#ef4444'} stopOpacity="0.7" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>

        {(rageActive || pose === 'sky_dragon' || pose === 'hurricane_540') && (
          <ellipse
            cx="68"
            cy={88 + bodyLiftY}
            rx="58"
            ry="62"
            fill={`url(#tekkenRageAura-${belt.id})`}
            className="animate-pulse"
          />
        )}

        {/* Guard Shield Glow when Blocking */}
        {blocking && (
          <path
            d="M 96 34 Q 120 75 96 122"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}

        <ellipse
          cx="68"
          cy="144"
          rx={isAerial ? 20 : 34}
          ry="8"
          fill="rgba(0,0,0,0.6)"
        />

        {isKicking && !blocking && (
          <g>
            {pose === 'axe_kick' ? (
              <>
                <path
                  d="M 88 10 Q 124 44 106 112"
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="13"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <path
                  d="M 92 16 Q 118 46 102 104"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            ) : pose === 'hurricane_540' || pose === 'sky_dragon' ? (
              <>
                <ellipse
                  cx="76"
                  cy={72 + bodyLiftY}
                  rx="62"
                  ry="24"
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="10"
                  strokeDasharray="34 14"
                  opacity="0.9"
                />
                <ellipse
                  cx="76"
                  cy={64 + bodyLiftY}
                  rx="54"
                  ry="18"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeDasharray="24 16"
                />
              </>
            ) : (
              <>
                <path
                  d={
                    pose === 'high_kick'
                      ? 'M 72 108 Q 134 80 128 22'
                      : pose === 'flying_spin'
                      ? 'M 56 112 Q 142 74 134 18'
                      : pose === 'back_kick'
                      ? 'M 42 102 Q 108 106 138 66'
                      : 'M 70 106 Q 124 96 140 66'
                  }
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="12"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <path
                  d={
                    pose === 'high_kick'
                      ? 'M 78 100 Q 124 76 120 28'
                      : pose === 'flying_spin'
                      ? 'M 64 104 Q 132 72 124 26'
                      : 'M 76 100 Q 118 92 132 68'
                  }
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        )}

        <g
          transform={`translate(68, ${94 + bodyLiftY}) rotate(${torsoRotate})`}
          style={{ transition: 'transform 95ms cubic-bezier(0.2, 1, 0.35, 1)' }}
        >
          {/* Back Arm */}
          <g
            transform={`translate(-12, -28) rotate(${backArmAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-8" y="0" width="16" height="26" rx="7" fill="#cbd5e1" stroke="#475569" strokeWidth="2.2" />
            <circle cx="0" cy="30" r="7" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          </g>

          {/* Support Leg */}
          <g
            transform={`translate(-10, 4) rotate(${supportLegAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-9" y="0" width="18" height="38" rx="7" fill="#e2e8f0" stroke="#475569" strokeWidth="2.2" />
            <ellipse cx="4" cy="41" rx="10" ry="5.5" fill="#fde68a" stroke="#92400e" strokeWidth="1.8" />
          </g>

          {/* Kicking Leg */}
          <g
            transform={`translate(10, 2) rotate(${kickLegAngle})`}
            style={{ transition: 'transform 85ms cubic-bezier(0.18, 0.95, 0.3, 1.15)' }}
          >
            <rect
              x="-9"
              y="0"
              width="18"
              height={isKicking && !blocking ? 50 : 38}
              rx="7"
              fill="#ffffff"
              stroke="#334155"
              strokeWidth="2.2"
            />
            <rect
              x="-8"
              y={isKicking && !blocking ? 32 : 24}
              width="16"
              height="10"
              rx="3"
              fill={rageActive ? '#dc2626' : belt.tier >= 3 ? belt.beltHex : '#1d4ed8'}
              opacity="0.95"
            />
            <ellipse
              cx="5"
              cy={isKicking && !blocking ? 53 : 41}
              rx={isKicking && !blocking ? 12 : 9.5}
              ry="5.5"
              fill="#fde68a"
              stroke="#92400e"
              strokeWidth="2"
            />
            {isKicking && !blocking && (
              <g transform="translate(12, 53)">
                <circle cx="0" cy="0" r="9.5" fill={activeTrail} opacity="0.9" />
                <circle cx="0" cy="0" r="4.5" fill="#ffffff" />
              </g>
            )}
          </g>

          {/* White Dobok Torso */}
          <path
            d="M -20 -36 L 20 -36 L 23 8 L -23 8 Z"
            fill="#ffffff"
            stroke="#334155"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M -11 -36 L 0 -17 L 11 -36"
            fill="none"
            stroke={belt.tier >= 12 ? '#0f172a' : '#1e293b'}
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* Belt Waistband + Dynamic Flowing Tails (2-color supported) */}
          <rect
            x="-23"
            y="-4"
            width="46"
            height="10"
            rx="3.5"
            fill={belt.beltHex}
            stroke="#0f172a"
            strokeWidth="2"
          />
          {belt.secondaryHex && (
            <rect x="-22" y="1" width="44" height="4.5" rx="1.5" fill={belt.secondaryHex} />
          )}
          {belt.stripeHex && <rect x="8" y="-4" width="6" height="10" fill={belt.stripeHex} />}
          <path
            d={isKicking ? 'M -4 4 L -28 22 L -19 27 L 2 8 Z' : 'M -4 4 L -14 27 L -6 29 L 3 8 Z'}
            fill={belt.beltHex}
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <path
            d={isKicking ? 'M 4 4 L -18 28 L -9 31 L 8 8 Z' : 'M 4 4 L 13 27 L 20 23 L 9 8 Z'}
            fill={belt.secondaryHex || belt.beltHex}
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <circle cx="0" cy="1" r="5" fill={belt.beltHex} stroke="#0f172a" strokeWidth="1.8" />
          {belt.secondaryHex && (
            <path d="M -4.2 1 A 4.2 4.2 0 0 0 4.2 1 Z" fill={belt.secondaryHex} />
          )}

          {/* Front Guard Arm */}
          <g
            transform={`translate(13, -27) rotate(${frontArmAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-8" y="0" width="16" height="25" rx="7" fill="#ffffff" stroke="#334155" strokeWidth="2.2" />
            <circle cx="0" cy="29" r="7.2" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          </g>

          {/* Fighter Head + Belt-Colored Headband */}
          <g transform="translate(0, -56)">
            <circle cx="0" cy="0" r="20" fill="#fef3c7" stroke="#78350f" strokeWidth="2.4" />
            <path
              d="M -19 -7 Q 0 -13 19 -7 L 18 -1 Q 0 -7 -18 -1 Z"
              fill={belt.beltHex}
              stroke="#0f172a"
              strokeWidth="1.6"
            />
            {belt.secondaryHex && (
              <path
                d="M -18 -4 Q 0 -9.5 18 -4 L 18 -1 Q 0 -6.5 -18 -1 Z"
                fill={belt.secondaryHex}
              />
            )}
            <path
              d={isKicking ? 'M -18 -6 L -38 -15 L -33 -5 Z' : 'M -18 -5 L -30 -2 L -28 5 Z'}
              fill={belt.secondaryHex || belt.beltHex}
              stroke="#0f172a"
              strokeWidth="1.4"
            />
            <text
              x="0"
              y="8"
              textAnchor="middle"
              fontSize="23"
              style={{ transform: `scaleX(${flipX})`, transformOrigin: '0px 0px' }}
            >
              {pose === 'hurt' ? '😵' : emoji}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
