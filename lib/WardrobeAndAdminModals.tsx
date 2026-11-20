'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  getQualityConfig,
  disposeObject3D,
  type QualityMode,
} from '@/lib/device_perf';
import {
  GOAL_TYPES,
  SPECIES_CATEGORIES,
  SPECIES_LIST,
  HERO_CATEGORIES,
  HERO_LIST,
  ANIME_CATEGORIES,
  ANIME_LIST,
  MONSTER_CATEGORIES,
  MONSTER_LIST,
  JOB_CATEGORIES,
  JOB_LIST,
  SHOP_ITEMS,
  GACHA_EXCLUSIVE_ITEMS,
  GACHA_SPIN_COST,
  GACHA_MULTI_COUNT,
  GACHA_MULTI_COST,
  GACHA_DUPLICATE_REFUND,
  type GachaRollResult,
  FREE_DEFAULT_ITEMS,
  type GoalType,
  type GenderType,
  type ShopCategory,
  type ShopItem,
  type PropColorKey,
  type PropColorMap,
  type SpeciesCategoryId,
  type HeroCategoryId,
  type AnimeCategoryId,
  type MonsterCategoryId,
  type JobCategoryId,
  type SpeciesOption,
  computeBmiMeta,
  getGoalTypeMeta,
  isHeroSpecies,
  isAnimeSpecies,
  isMonsterSpecies,
  isJobSpecies,
  resolveBreedOption,
} from '@/lib/rpg_catalog';
import {
  buildCharacterMesh,
  buildPetMesh,
  animatePetMotion,
  applyCharacterBellyScale,
  syncCharacterMountPose,
  buildTrackMarkerMesh,
  animateTrackMarkerMesh,
} from '@/lib/character_3d';
import { FIT_ACTIVITIES, EAT_ACTIVITIES } from '@/lib/spectator_activities';

interface WardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  qualityMode?: QualityMode;
  editingPlayerId: number | null;
  currentUserId: number | null;
  userPoints: number;
  unlockedItems: string[];
  onUnlockOrEquipItem: (itemId: string) => Promise<void>;
  onSpinGacha: (count?: 1 | 8) => Promise<GachaRollResult[]>;
  initialRightTab?: ShopCategory | 'gacha';
  joinRole: 'competitor' | 'spectator';
  setJoinRole: (r: 'competitor' | 'spectator') => void;
  joinName: string;
  setJoinName: (v: string) => void;
  joinEmoji: string;
  setJoinEmoji: (v: string) => void;
  joinColor: string;
  setJoinColor: (v: string) => void;
  joinBandColor: string;
  setJoinBandColor: (v: string) => void;
  joinSpecies: string;
  setJoinSpecies: (v: string) => void;
  joinThemeId: string;
  setJoinThemeId: (v: string) => void;
  joinEquipHat: string;
  setJoinEquipHat: (v: string) => void;
  joinEquipFace: string;
  setJoinEquipFace: (v: string) => void;
  joinEquipArmor: string;
  setJoinEquipArmor: (v: string) => void;
  joinEquipWeapon: string;
  setJoinEquipWeapon: (v: string) => void;
  joinEquipWings: string;
  setJoinEquipWings: (v: string) => void;
  joinEquipAura: string;
  setJoinEquipAura: (v: string) => void;
  joinEquipPetGear: string;
  setJoinEquipPetGear: (v: string) => void;
  joinEquipMount?: string;
  setJoinEquipMount?: (v: string) => void;
  joinEquipMarker?: string;
  setJoinEquipMarker?: (v: string) => void;
  joinPropColors?: PropColorMap;
  setJoinPropColors?: React.Dispatch<React.SetStateAction<PropColorMap>>;
  joinGoalType: GoalType;
  setJoinGoalType: (v: GoalType) => void;
  joinStart: string;
  setJoinStart: (v: string) => void;
  joinGoal: string;
  setJoinGoal: (v: string) => void;
  joinBodyWeight?: string;
  setJoinBodyWeight?: (v: string) => void;
  joinHeightCm?: string;
  setJoinHeightCm?: (v: string) => void;
  joinGender?: GenderType;
  setJoinGender?: (v: GenderType) => void;
  joinWorkout: 'fit' | 'eat';
  setJoinWorkout: (v: 'fit' | 'eat') => void;
  joinStatus: string;
  setJoinStatus: (v: string) => void;
  joinPin: string;
  setJoinPin: (v: string) => void;
  joinError: string;
  joining: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const INITIAL_FACING_YAW = -Math.PI / 2 + 0.52;

function StoneFrameCorners() {
  const renderBracket = (posCls: string, rotDeg: number) => (
    <svg
      viewBox="0 0 44 44"
      className={`pointer-events-none absolute w-9 h-9 z-20 drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)] ${posCls}`}
      style={{ transform: `rotate(${rotDeg}deg)` }}
    >
      {/* Chiseled Outer Stone Corner Block */}
      <path
        d="M2 2 H34 L28 12 H12 V28 L2 34 Z"
        fill="#646c7a"
        stroke="#111318"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M5 5 H29 L25 10 H10 V25 L5 29 Z" fill="#464d59" />
      {/* Subtle Stone Crack */}
      <path d="M18 4 L15 9 L19 11" fill="none" stroke="#1e2229" strokeWidth="1.3" strokeLinecap="round" />
      {/* Inset Beveled Gold Corner Shield */}
      <path
        d="M3 3 H21 L13 13 L3 21 Z"
        fill="url(#rpgCornerGold)"
        stroke="#271703"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="rpgCornerGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
    </svg>
  );

  return (
    <>
      {renderBracket('-top-3 -left-3', 0)}
      {renderBracket('-top-3 -right-3', 90)}
      {renderBracket('-bottom-3 -right-3', 180)}
      {renderBracket('-bottom-3 -left-3', 270)}
    </>
  );
}

function RpgWingedHeaderPlaque({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative -mt-5 mb-1 mx-1 flex items-center justify-center z-20">
      {/* Left Golden Wing Flourish */}
      <svg viewBox="0 0 28 36" className="w-6 h-8 -mr-2 shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">
        <path
          d="M26 6 L6 12 L2 18 L8 25 L26 30 Z"
          fill="url(#plaqueWingG)"
          stroke="#1c1305"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="plaqueWingG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="55%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>
      </svg>

      <div
        className="flex-1 rounded-2xl px-3 py-1.5 text-center border-[2.5px] border-[#eab308] shadow-[inset_0_1.5px_0_rgba(254,249,195,0.45),inset_0_-3px_6px_rgba(0,0,0,0.75),0_4px_8px_rgba(0,0,0,0.7)]"
        style={{
          background: 'linear-gradient(180deg, #4b473f 0%, #302d29 52%, #1f1d1b 100%)',
        }}
      >
        <div
          className="font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base text-white leading-tight"
          style={{ textShadow: '0 2px 3px rgba(0,0,0,0.95)' }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-[10.5px] font-extrabold text-amber-300 leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {/* Right Golden Wing Flourish */}
      <svg
        viewBox="0 0 28 36"
        className="w-6 h-8 -ml-2 shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]"
        style={{ transform: 'scaleX(-1)' }}
      >
        <path
          d="M26 6 L6 12 L2 18 L8 25 L26 30 Z"
          fill="url(#plaqueWingG)"
          stroke="#1c1305"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function ChibiHeroBustSvg({
  species,
  outfitHex,
  accentHex,
  hatType = 'none',
  propEmoji,
}: {
  species: SpeciesOption;
  outfitHex: string;
  accentHex: string;
  hatType?: string;
  propEmoji?: string;
}) {
  if (species.isHero) {
    const skin = species.skinHex || '#FAD6B8';
    const primary = species.colorHex || '#18181B';
    const shirtFill = species.defaultShirtHex || outfitHex || species.bandColor || '#38BDF8';
    const secondary = species.bandColor || '#FACC15';
    const hs = species.heroStyle || 'snow_bob_bow';
    const isLotso = species.id === 'disney_lotso';

    return (
      <div className="relative w-12 h-12 -my-1 shrink-0 flex items-center justify-center drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)]">
        <svg viewBox="0 0 64 64" className="w-12 h-12 overflow-visible">
          {/* Disney Chibi Outfit Bust */}
          <path
            d="M13 58 C13 43, 51 43, 51 58 Z"
            fill={shirtFill}
            stroke="#14171c"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path
            d="M23 46 Q32 52 41 46"
            fill="none"
            stroke={species.defaultPantsHex || accentHex}
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Back Hair / Ears / Braids behind head */}
          {hs === 'merida_wild_curls' && (
            <circle cx="32" cy="29" r="22" fill={primary} stroke="#14171c" strokeWidth="2.5" />
          )}
          {(hs === 'ariel_wave_flower' || hs === 'rapunzel_floral_long' || hs === 'royal_tiara_curls') && (
            <path d="M13 28 C11 46, 53 46, 51 28 Z" fill={primary} stroke="#14171c" strokeWidth="2.3" />
          )}
          {hs === 'elsa_side_braid' && (
            <path d="M40 36 Q48 46 44 56 Q37 52 38 40 Z" fill={primary} stroke="#14171c" strokeWidth="2" />
          )}
          {hs === 'anna_twin_braids' && (
            <>
              <rect x="14" y="36" width="5" height="16" rx="2.5" fill={primary} stroke="#14171c" strokeWidth="2" />
              <rect x="45" y="36" width="5" height="16" rx="2.5" fill={primary} stroke="#14171c" strokeWidth="2" />
            </>
          )}
          {hs === 'boo_twintails' && (
            <>
              <circle cx="13" cy="24" r="6" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="51" cy="24" r="6" fill={primary} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}
          {(hs === 'mickey_ears' || hs === 'minnie_bow_ears') && (
            <>
              <circle cx="16" cy="14" r={isLotso ? '7' : '9.5'} fill={primary} stroke="#14171c" strokeWidth="2.5" />
              <circle cx="48" cy="14" r={isLotso ? '7' : '9.5'} fill={primary} stroke="#14171c" strokeWidth="2.5" />
            </>
          )}
          {hs === 'stitch_alien_ears' && (
            <>
              <ellipse cx="9" cy="24" rx="5.5" ry="13" transform="rotate(-38 9 24)" fill={skin} stroke="#14171c" strokeWidth="2.3" />
              <ellipse cx="55" cy="24" rx="5.5" ry="13" transform="rotate(38 55 24)" fill={skin} stroke="#14171c" strokeWidth="2.3" />
              <ellipse cx="9" cy="24" rx="3" ry="9" transform="rotate(-38 9 24)" fill={secondary} />
              <ellipse cx="55" cy="24" rx="3" ry="9" transform="rotate(38 55 24)" fill={secondary} />
            </>
          )}
          {hs === 'sulley_horns' && (
            <>
              <path d="M19 20 Q11 11 16 6" fill="none" stroke="#cbd5e1" strokeWidth="4.2" strokeLinecap="round" />
              <path d="M45 20 Q53 11 48 6" fill="none" stroke="#cbd5e1" strokeWidth="4.2" strokeLinecap="round" />
            </>
          )}
          {hs === 'maleficent_horns' && (
            <>
              <path d="M21 21 Q10 10 17 3 Q22 10 25 19" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M43 21 Q54 10 47 3 Q42 10 39 19" fill={primary} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}

          {/* Human Ears (when applicable) */}
          {!['mickey_ears', 'minnie_bow_ears', 'stitch_alien_ears', 'baymax_eyes', 'mike_cyclops', 'three_eye_alien', 'donald_sailor_beak', 'olaf_snowman', 'buzz_space_dome'].includes(hs) && (
            <>
              <circle cx="15" cy="34" r="4" fill={skin} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="49" cy="34" r="4" fill={skin} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}

          {/* Head Circle */}
          <circle cx="32" cy="33" r="16" fill={skin} stroke="#14171c" strokeWidth="2.8" />

          {/* Special Faces: Baymax / Mike / Three-Eye Alien / Donald / Olaf / Stitch */}
          {hs === 'baymax_eyes' ? (
            <>
              <line x1="24" y1="33" x2="40" y2="33" stroke="#18181b" strokeWidth="2.4" />
              <circle cx="24" cy="33" r="3" fill="#18181b" />
              <circle cx="40" cy="33" r="3" fill="#18181b" />
            </>
          ) : hs === 'mike_cyclops' ? (
            <>
              <circle cx="32" cy="31" r="9.5" fill="#ffffff" stroke="#14171c" strokeWidth="2" />
              <circle cx="32" cy="31" r="5.5" fill="#10b981" />
              <circle cx="32" cy="31" r="2.8" fill="#18181b" />
              <circle cx="30.5" cy="29.5" r="1.2" fill="#ffffff" />
              <path d="M26 43 Q32 46 38 43" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : hs === 'three_eye_alien' ? (
            <>
              <line x1="32" y1="17" x2="32" y2="8" stroke={skin} strokeWidth="2.8" />
              <circle cx="32" cy="7" r="3.2" fill={skin} stroke="#14171c" strokeWidth="1.8" />
              {[23, 32, 41].map((ex) => (
                <g key={ex}>
                  <circle cx={ex} cy="31" r="4" fill="#ffffff" stroke="#14171c" strokeWidth="1.6" />
                  <circle cx={ex} cy="31" r="1.8" fill="#18181b" />
                </g>
              ))}
              <path d="M24 40 Q32 44 40 40" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
            </>
          ) : (
            <>
              {/* Standard Chibi Disney Eyes */}
              {hs === 'incredible_mask' && species.id === 'disney_mr_incredible' && (
                <rect x="19" y="29" width="26" height="7.5" rx="3.5" fill="#111827" />
              )}
              <circle cx="25.5" cy="33" r="2.7" fill="#18181b" />
              <circle cx="38.5" cy="33" r="2.7" fill="#18181b" />
              <circle cx="24.7" cy="32" r="1" fill="#ffffff" />
              <circle cx="37.7" cy="32" r="1" fill="#ffffff" />
              <ellipse cx="20.5" cy="37" rx="3" ry="1.8" fill="#fb7185" opacity="0.65" />
              <ellipse cx="43.5" cy="37" rx="3" ry="1.8" fill="#fb7185" opacity="0.65" />

              {hs === 'mirabel_glasses_curls' && (
                <>
                  <circle cx="25.5" cy="33" r="5.2" fill="none" stroke={secondary} strokeWidth="2" />
                  <circle cx="38.5" cy="33" r="5.2" fill="none" stroke={secondary} strokeWidth="2" />
                  <line x1="30.7" y1="33" x2="33.3" y2="33" stroke={secondary} strokeWidth="2" />
                </>
              )}

              {hs === 'donald_sailor_beak' ? (
                <ellipse cx="32" cy="39" rx="7.5" ry="3.8" fill={secondary} stroke="#14171c" strokeWidth="1.8" />
              ) : hs === 'olaf_snowman' ? (
                <>
                  <polygon points="31,34 43,36 31,38" fill={secondary} stroke="#14171c" strokeWidth="1.5" />
                  <path d="M27 41 Q32 45 37 41" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
                  <path d="M32 17 L32 8 M32 14 L27 9 M32 14 L37 9" stroke={primary} strokeWidth="2.2" strokeLinecap="round" />
                </>
              ) : hs === 'pinocchio_hat_nose' ? (
                <>
                  <line x1="32" y1="35" x2="43" y2="35" stroke={skin} strokeWidth="3.8" strokeLinecap="round" />
                  <path d="M28.5 40 Q32 43 35.5 40" fill="none" stroke="#18181b" strokeWidth="1.9" strokeLinecap="round" />
                </>
              ) : hs === 'stitch_alien_ears' ? (
                <>
                  <ellipse cx="32" cy="35.5" rx="4.2" ry="3.2" fill={primary} />
                  <path d="M26 41 Q32 44 38 41" fill="none" stroke="#18181b" strokeWidth="2" strokeLinecap="round" />
                </>
              ) : (
                <path d="M28.5 40 Q32 43.2 35.5 40" fill="none" stroke="#18181b" strokeWidth="1.9" strokeLinecap="round" />
              )}
            </>
          )}

          {/* Front Hair / Crowns / Hats */}
          {hs === 'cruella_half_hair' && (
            <>
              <path d="M16 30 C16 14, 32 14, 32 25 L32 18 L16 30 Z" fill="#ffffff" stroke="#14171c" strokeWidth="2.2" />
              <path d="M15 29 C15 14, 32 14, 32 26 Z" fill="#ffffff" stroke="#14171c" strokeWidth="2.2" />
              <path d="M32 26 C32 14, 49 14, 49 29 Z" fill="#18181b" stroke="#14171c" strokeWidth="2.2" />
            </>
          )}
          {hs === 'hades_flame_hair' && (
            <polygon
              points="18,24 16,12 24,17 28,5 33,15 39,4 43,17 49,11 46,24"
              fill={primary}
              stroke={secondary}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
          {(hs === 'cowboy_hat' || hs === 'villain_tophat_plume' || hs === 'pirate_dreads_tricorne') && (
            <>
              <ellipse cx="32" cy="21" rx="22" ry="4.8" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M21 21 L23 10 L41 10 L43 21 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <rect x="22" y="17" width="20" height="3.2" fill={secondary} />
            </>
          )}
          {(hs === 'peter_robin_cap' || hs === 'pinocchio_hat_nose') && (
            <>
              <polygon points="16,24 34,8 48,23" fill={primary} stroke="#14171c" strokeWidth="2.2" strokeLinejoin="round" />
              <line x1="41" y1="16" x2="49" y2="7" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" />
            </>
          )}
          {hs === 'donald_sailor_beak' && (
            <ellipse cx="34" cy="16" rx="14" ry="5.5" transform="rotate(-10 34 16)" fill={primary} stroke="#14171c" strokeWidth="2.2" />
          )}
          {hs === 'buzz_space_dome' && (
            <>
              <path d="M16 30 C16 14, 48 14, 48 30 Q32 22 16 30 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="32" cy="32" r="20" fill="#bae6fd" fillOpacity="0.28" stroke={secondary} strokeWidth="2.2" />
            </>
          )}
          {(hs === 'cinderella_updo' || hs === 'tinker_pom_bun' || hs === 'mulan_jade_bun') && (
            <>
              <circle cx="32" cy="11" r="7" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}
          {hs === 'genie_topknot_beard' && (
            <path d="M32 17 Q34 5 42 8" fill="none" stroke={primary} strokeWidth="4.5" strokeLinecap="round" />
          )}
          {hs === 'aladdin_fez' && (
            <>
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <polygon points="28,16 29,8 36,8 37,16" fill={secondary} stroke="#14171c" strokeWidth="1.8" />
            </>
          )}
          {(hs === 'snow_bob_bow' || hs === 'minnie_bow_ears') && (
            <>
              {hs === 'snow_bob_bow' && (
                <path d="M15 31 C15 14, 49 14, 49 31 Q32 21 15 31 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              )}
              <path
                d="M22 15 Q27 7 32 15 Q37 7 42 15 Q37 22 32 16 Q27 22 22 15 Z"
                fill={secondary}
                stroke="#14171c"
                strokeWidth="2"
              />
            </>
          )}
          {(hs === 'royal_tiara_curls' || hs === 'queen_crown_veil' || hs === 'elsa_side_braid') && (
            <>
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <polygon
                points="23,18 26,9 32,14 38,9 41,18"
                fill={hs === 'elsa_side_braid' ? secondary : '#facc15'}
                stroke="#14171c"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </>
          )}
          {['anna_twin_braids', 'ariel_wave_flower', 'rapunzel_floral_long', 'jasmine_ponytail_gem', 'mirabel_glasses_curls', 'boo_twintails', 'incredible_mask', 'maleficent_horns'].includes(hs) && (
            <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
          )}

          {/* 🎌 Anime Specific SVG Head & Face Overlays */}
          {(hs === 'anime_spiky_shonen' || hs === 'anime_headband_spiky' || hs === 'anime_slayer_earrings' || hs === 'anime_blindfold_spiky') && (
            <>
              <polygon
                points="15,27 11,14 21,19 25,5 32,16 39,5 43,19 53,14 49,27"
                fill={primary}
                stroke="#14171c"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {hs === 'anime_headband_spiky' && (
                <rect x="16" y="21" width="32" height="5" rx="2" fill={secondary} stroke="#14171c" strokeWidth="1.6" />
              )}
              {hs === 'anime_blindfold_spiky' && (
                <rect x="16" y="28" width="32" height="8" rx="3" fill={secondary} stroke="#14171c" strokeWidth="1.8" />
              )}
            </>
          )}
          {hs === 'anime_straw_hat' && (
            <>
              <ellipse cx="32" cy="21" rx="23" ry="5" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M20 21 C20 9, 44 9, 44 21 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <rect x="21" y="17" width="22" height="3.5" fill={secondary} />
            </>
          )}
          {hs === 'anime_boar_mask' && (
            <>
              <circle cx="32" cy="33" r="16.5" fill={primary} stroke="#14171c" strokeWidth="2.6" />
              <polygon points="18,21 13,8 26,17" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <polygon points="46,21 51,8 38,17" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <ellipse cx="32" cy="37" rx="6" ry="4.2" fill="#f9a8d4" stroke="#14171c" strokeWidth="1.8" />
              <circle cx="24" cy="31" r="3" fill={secondary} />
              <circle cx="40" cy="31" r="3" fill={secondary} />
            </>
          )}
          {hs === 'anime_sailor_odango' && (
            <>
              <circle cx="17" cy="14" r="5.5" fill={primary} stroke="#14171c" strokeWidth="2" />
              <circle cx="47" cy="14" r="5.5" fill={primary} stroke="#14171c" strokeWidth="2" />
              <circle cx="17" cy="14" r="2.2" fill={secondary} />
              <circle cx="47" cy="14" r="2.2" fill={secondary} />
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}
          {hs === 'anime_bamboo_muzzle' && (
            <>
              <path d="M15 30 C16 14, 48 14, 49 30 Q32 21 15 30 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <rect x="23" y="38" width="18" height="5.5" rx="2.5" fill="#22c55e" stroke="#14171c" strokeWidth="1.8" />
            </>
          )}
          {hs === 'anime_anya_cones' && (
            <>
              <path d="M15 30 C16 15, 48 15, 49 30 Q32 21 15 30 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <polygon points="18,21 21,9 26,20" fill={secondary} stroke="#14171c" strokeWidth="1.8" />
              <polygon points="46,21 43,9 38,20" fill={secondary} stroke="#14171c" strokeWidth="1.8" />
            </>
          )}
          {hs === 'anime_elf_twintails' && (
            <>
              <ellipse cx="11" cy="36" rx="4.8" ry="13" transform="rotate(14 11 36)" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <ellipse cx="53" cy="36" rx="4.8" ry="13" transform="rotate(-14 53 36)" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
            </>
          )}
          {hs === 'anime_maid_bob' && (
            <path d="M15 30 C16 14, 48 14, 49 30 Q32 21 15 30 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
          )}
          {hs === 'anime_doraemon_bell' && (
            <>
              <path d="M16 34 C16 14, 48 14, 48 34 C46 23, 18 23, 16 34 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="32" cy="35" r="3.4" fill="#ef4444" stroke="#14171c" strokeWidth="1.5" />
              <rect x="20" y="46" width="24" height="4" rx="2" fill={secondary} stroke="#14171c" strokeWidth="1.5" />
              <circle cx="32" cy="49" r="3.2" fill="#facc15" stroke="#14171c" strokeWidth="1.5" />
            </>
          )}
          {hs === 'anime_shinchan_brows' && (
            <>
              <path d="M17 25 C19 15, 45 15, 47 25 Z" fill={primary} stroke="#14171c" strokeWidth="2" />
              <path d="M21 27 Q25 23 29 27" fill="none" stroke="#18181b" strokeWidth="4.2" strokeLinecap="round" />
              <path d="M35 27 Q39 23 43 27" fill="none" stroke="#18181b" strokeWidth="4.2" strokeLinecap="round" />
            </>
          )}
          {hs === 'anime_glasses_detective' && (
            <>
              <path d="M16 27 C17 15, 47 15, 48 27 Q32 21 16 27 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="25.5" cy="33" r="5.4" fill="none" stroke="#18181b" strokeWidth="2.2" />
              <circle cx="38.5" cy="33" r="5.4" fill="none" stroke="#18181b" strokeWidth="2.2" />
              <line x1="30.9" y1="33" x2="33.1" y2="33" stroke="#18181b" strokeWidth="2.2" />
            </>
          )}
          {hs === 'anime_pikachu_ears' && (
            <>
              <polygon points="18,22 11,4 25,17" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <polygon points="46,22 53,4 39,17" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <circle cx="20" cy="38" r="3.8" fill={secondary} />
              <circle cx="44" cy="38" r="3.8" fill={secondary} />
            </>
          )}
          {hs === 'anime_chopper_hat' && (
            <>
              <ellipse cx="32" cy="22" rx="22" ry="4.5" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <rect x="21" y="7" width="22" height="15" rx="3" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <path d="M29 11 L35 17 M35 11 L29 17" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
              <circle cx="32" cy="36" r="2.8" fill={secondary} />
            </>
          )}
          {hs === 'anime_ninja_mask_silver' && (
            <>
              <polygon points="16,26 20,8 30,17 37,5 48,25" fill={primary} stroke="#14171c" strokeWidth="2.2" strokeLinejoin="round" />
              {species.id === 'anime_kakashi' && (
                <path d="M17 35 Q32 33 47 35 C46 46, 18 46, 17 35 Z" fill={secondary} stroke="#14171c" strokeWidth="2" />
              )}
            </>
          )}
          {hs === 'anime_chainsaw_head' && (
            <>
              <circle cx="32" cy="33" r="16" fill={primary} stroke="#14171c" strokeWidth="2.6" />
              <rect x="29" y="3" width="6" height="24" rx="2" fill="#cbd5e1" stroke="#14171c" strokeWidth="2" />
              <circle cx="25" cy="32" r="3" fill={secondary} />
              <circle cx="39" cy="32" r="3" fill={secondary} />
            </>
          )}
          {hs === 'anime_korosensei_smile' && (
            <>
              <path d="M18 21 C20 11, 44 11, 46 21 Z" fill={primary} stroke="#14171c" strokeWidth="2" />
            </>
          )}
          {hs === 'anime_jotaro_cap' && (
            <>
              <path d="M16 25 L18 13 L46 13 L48 25 Z" fill={primary} stroke="#14171c" strokeWidth="2.2" />
              <rect x="16" y="22" width="34" height="4" rx="1.5" fill={primary} stroke="#14171c" strokeWidth="1.8" />
            </>
          )}
        </svg>
        {propEmoji && (
          <span className="absolute -bottom-0.5 -right-1 text-sm leading-none drop-shadow">
            {propEmoji}
          </span>
        )}
      </div>
    );
  }

  const fur = species.colorHex || '#F8FAFC';
  const ear = species.earStyle;
  const pat = species.facePattern || 'none';

  return (
    <div className="relative w-12 h-12 -my-1 shrink-0 flex items-center justify-center drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)]">
      <svg viewBox="0 0 64 64" className="w-12 h-12 overflow-visible">
        {/* Cute Chibi Outfit / Dress Bust */}
        <path
          d="M14 58 C14 44, 50 44, 50 58 Z"
          fill={outfitHex}
          stroke="#14171c"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d="M23 46 Q32 52 41 46"
          fill="none"
          stroke={accentHex}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Species Ears Behind Head */}
        {ear === 'bunny' && (
          <>
            <ellipse cx="23" cy="14" rx="5.2" ry="12" fill={fur} stroke="#14171c" strokeWidth="2.6" />
            <ellipse cx="41" cy="14" rx="5.2" ry="12" fill={fur} stroke="#14171c" strokeWidth="2.6" />
            <ellipse cx="23" cy="15" rx="2.5" ry="7.5" fill="#f472b6" />
            <ellipse cx="41" cy="15" rx="2.5" ry="7.5" fill="#f472b6" />
          </>
        )}
        {(ear === 'lop' || ear === 'dog_floppy') && (
          <>
            <ellipse cx="14" cy="34" rx="5.5" ry="11" transform="rotate(18 14 34)" fill={fur} stroke="#14171c" strokeWidth="2.6" />
            <ellipse cx="50" cy="34" rx="5.5" ry="11" transform="rotate(-18 50 34)" fill={fur} stroke="#14171c" strokeWidth="2.6" />
          </>
        )}
        {(ear === 'cat' || ear === 'fox' || ear === 'corgi' || ear === 'shiba') && (
          <>
            <polygon points="15,28 19,10 29,22" fill={fur} stroke="#14171c" strokeWidth="2.6" strokeLinejoin="round" />
            <polygon points="49,28 45,10 35,22" fill={fur} stroke="#14171c" strokeWidth="2.6" strokeLinejoin="round" />
            <polygon points="18,25 20,14 26,22" fill="#fda4af" />
            <polygon points="46,25 44,14 38,22" fill="#fda4af" />
          </>
        )}
        {(ear === 'folded_cat' || ear === 'pug') && (
          <>
            <path d="M15 24 Q18 15 26 20 Z" fill="#475569" stroke="#14171c" strokeWidth="2.5" />
            <path d="M49 24 Q46 15 38 20 Z" fill="#475569" stroke="#14171c" strokeWidth="2.5" />
          </>
        )}
        {(ear === 'bear' || ear === 'panda' || ear === 'pig' || ear === 'monkey' || ear === 'capybara' || ear === 'alpaca') && (
          <>
            <circle
              cx={ear === 'monkey' ? 13 : 18}
              cy={ear === 'monkey' ? 32 : 19}
              r="6.5"
              fill={ear === 'panda' ? '#18181b' : fur}
              stroke="#14171c"
              strokeWidth="2.6"
            />
            <circle
              cx={ear === 'monkey' ? 51 : 46}
              cy={ear === 'monkey' ? 32 : 19}
              r="6.5"
              fill={ear === 'panda' ? '#18181b' : fur}
              stroke="#14171c"
              strokeWidth="2.6"
            />
          </>
        )}
        {ear === 'frog' && (
          <>
            <circle cx="21" cy="19" r="6" fill={fur} stroke="#14171c" strokeWidth="2.6" />
            <circle cx="43" cy="19" r="6" fill={fur} stroke="#14171c" strokeWidth="2.6" />
          </>
        )}
        {ear === 'triceratops' && (
          <circle cx="32" cy="24" r="21" fill="#0284c7" stroke="#14171c" strokeWidth="2.6" />
        )}
        {ear === 'mammoth' && (
          <>
            <ellipse cx="12" cy="34" rx="5.5" ry="10" fill={fur} stroke="#14171c" strokeWidth="2.4" />
            <ellipse cx="52" cy="34" rx="5.5" ry="10" fill={fur} stroke="#14171c" strokeWidth="2.4" />
          </>
        )}
        {(ear === 'sabretooth' || ear === 'griffin') && (
          <>
            <circle cx="18" cy="19" r="5.5" fill={fur} stroke="#14171c" strokeWidth="2.5" />
            <circle cx="46" cy="19" r="5.5" fill={fur} stroke="#14171c" strokeWidth="2.5" />
          </>
        )}
        {ear === 'dragon' && (
          <>
            <polygon points="18,22 12,5 26,16" fill="#facc15" stroke="#14171c" strokeWidth="2.4" strokeLinejoin="round" />
            <polygon points="46,22 52,5 38,16" fill="#facc15" stroke="#14171c" strokeWidth="2.4" strokeLinejoin="round" />
          </>
        )}
        {ear === 'unicorn' && (
          <>
            <polygon points="18,24 20,12 27,20" fill={fur} stroke="#14171c" strokeWidth="2.4" />
            <polygon points="46,24 44,12 37,20" fill={fur} stroke="#14171c" strokeWidth="2.4" />
            <circle cx="21" cy="18" r="4.5" fill="#f472b6" />
            <circle cx="43" cy="18" r="4.5" fill="#38bdf8" />
          </>
        )}
        {ear === 'kitsune' && (
          <>
            <polygon points="15,28 19,8 29,21" fill="#fffbeb" stroke="#14171c" strokeWidth="2.5" />
            <polygon points="49,28 45,8 35,21" fill="#fffbeb" stroke="#14171c" strokeWidth="2.5" />
            <polygon points="17,17 19,8 24,16" fill="#ef4444" />
            <polygon points="47,17 45,8 40,16" fill="#ef4444" />
          </>
        )}
        {ear === 'cerberus' && (
          <>
            <circle cx="11" cy="36" r="8" fill={fur} stroke="#14171c" strokeWidth="2.3" />
            <circle cx="53" cy="36" r="8" fill={fur} stroke="#14171c" strokeWidth="2.3" />
            <circle cx="9" cy="35" r="1.7" fill="#ef4444" />
            <circle cx="13" cy="35" r="1.7" fill="#ef4444" />
            <circle cx="51" cy="35" r="1.7" fill="#ef4444" />
            <circle cx="55" cy="35" r="1.7" fill="#ef4444" />
            <polygon points="18,24 20,11 28,20" fill={fur} stroke="#14171c" strokeWidth="2.4" />
            <polygon points="46,24 44,11 36,20" fill={fur} stroke="#14171c" strokeWidth="2.4" />
          </>
        )}
        {ear === 'pterodactyl' && (
          <polygon points="24,19 32,3 44,18" fill={fur} stroke="#14171c" strokeWidth="2.5" strokeLinejoin="round" />
        )}
        {ear === 'lion' && (
          <circle cx="32" cy="33" r="21" fill="#b45309" stroke="#14171c" strokeWidth="2.6" strokeDasharray="7 2" />
        )}
        {ear === 'elephant' && (
          <>
            <ellipse cx="11" cy="33" rx="6.5" ry="11.5" fill={fur} stroke="#14171c" strokeWidth="2.5" />
            <ellipse cx="53" cy="33" rx="6.5" ry="11.5" fill={fur} stroke="#14171c" strokeWidth="2.5" />
          </>
        )}
        {ear === 'axolotl' && (
          <>
            <path d="M16 26 L7 21 M15 33 L6 33 M16 40 L7 45" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M48 26 L57 21 M49 33 L58 33 M48 40 L57 45" stroke="#f43f5e" strokeWidth="3.5" strokeLinecap="round" />
          </>
        )}
        {ear === 'shark' && (
          <polygon points="26,18 33,4 39,18" fill={fur} stroke="#14171c" strokeWidth="2.4" strokeLinejoin="round" />
        )}
        {(ear === 'deer' || ear === 'jackalope') && (
          <>
            <path d="M22 19 L17 6 M19 12 L13 10" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
            <path d="M42 19 L47 6 M45 12 L51 10" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
            {ear === 'jackalope' && (
              <>
                <ellipse cx="25" cy="15" rx="3.8" ry="10" fill={fur} stroke="#14171c" strokeWidth="2.2" />
                <ellipse cx="39" cy="15" rx="3.8" ry="10" fill={fur} stroke="#14171c" strokeWidth="2.2" />
              </>
            )}
          </>
        )}
        {ear === 'bull' && (
          <>
            <path d="M18 22 Q10 14 14 7" fill="none" stroke="#fef3c7" strokeWidth="4" strokeLinecap="round" />
            <path d="M46 22 Q54 14 50 7" fill="none" stroke="#fef3c7" strokeWidth="4" strokeLinecap="round" />
          </>
        )}

        {/* Chibi Head Circle */}
        <circle cx="32" cy="33" r="16.5" fill={fur} stroke="#14171c" strokeWidth="2.8" />

        {/* Markings */}
        {(pat === 'raccoon_mask' || ear === 'panda') && (
          <>
            <ellipse cx="25" cy="32" rx="4.6" ry="3.8" fill="#1e293b" />
            <ellipse cx="39" cy="32" rx="4.6" ry="3.8" fill="#1e293b" />
          </>
        )}
        {ear === 'kitsune' && (
          <>
            <path d="M20 29 L26 31" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M44 29 L38 31" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="32" cy="22" r="2.8" fill="#38bdf8" />
          </>
        )}
        {pat === 'cow_spots' && (
          <path d="M18 26 Q24 23 25 30 Q20 33 17 29 Z" fill="#1e293b" />
        )}
        {pat === 'siamese_points' && (
          <ellipse cx="32" cy="36" rx="7.5" ry="5.5" fill="#78350f" opacity="0.75" />
        )}

        {/* Eyes & Cute Shine */}
        <circle cx="25.5" cy="32" r="2.7" fill={ear === 'cerberus' ? '#ef4444' : '#18181b'} />
        <circle cx="38.5" cy="32" r="2.7" fill={ear === 'cerberus' ? '#ef4444' : '#18181b'} />
        <circle cx="24.7" cy="31" r="1" fill="#ffffff" />
        <circle cx="37.7" cy="31" r="1" fill="#ffffff" />

        {/* Rosy Cheeks */}
        <ellipse cx="20.5" cy="36.5" rx="3.2" ry="2" fill="#fb7185" opacity="0.75" />
        <ellipse cx="43.5" cy="36.5" rx="3.2" ry="2" fill="#fb7185" opacity="0.75" />

        {/* Snout / Beak / Mouth / Prehistoric & Mythical Features */}
        {ear === 'pig' ? (
          <>
            <ellipse cx="32" cy="36.5" rx="5.5" ry="3.8" fill="#fbcfe8" stroke="#14171c" strokeWidth="1.8" />
            <circle cx="30.2" cy="36.5" r="1.1" fill="#9d174d" />
            <circle cx="33.8" cy="36.5" r="1.1" fill="#9d174d" />
          </>
        ) : ear === 'duck' || ear === 'dodo' || ear === 'pterodactyl' || ear === 'phoenix' || ear === 'griffin' ? (
          <polygon
            points="26,35 38,35 32,42"
            fill={ear === 'dodo' ? '#facc15' : '#f97316'}
            stroke="#14171c"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        ) : ear === 'mammoth' ? (
          <>
            <path d="M21 39 Q15 44 18 35" fill="none" stroke="#fffbeb" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M43 39 Q49 44 46 35" fill="none" stroke="#fffbeb" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M32 34 Q32 45 37 44" fill="none" stroke={fur} strokeWidth="5" strokeLinecap="round" />
          </>
        ) : ear === 'sabretooth' ? (
          <>
            <polygon points="26,38 28,47 30,38" fill="#ffffff" stroke="#14171c" strokeWidth="1.4" />
            <polygon points="34,38 36,47 38,38" fill="#ffffff" stroke="#14171c" strokeWidth="1.4" />
            <ellipse cx="32" cy="35.5" rx="2.5" ry="1.8" fill="#18181b" />
          </>
        ) : ear === 'trex' || ear === 'shark' ? (
          <>
            <polygon points="26,39 28,43 30,39 32,43 34,39 36,43 38,39" fill="#ffffff" stroke="#14171c" strokeWidth="1.3" />
          </>
        ) : ear === 'elephant' ? (
          <path d="M32 34 Q32 45 38 43" fill="none" stroke={fur} strokeWidth="5.2" strokeLinecap="round" />
        ) : ear === 'bull' ? (
          <>
            <ellipse cx="32" cy="36.5" rx="5.5" ry="3.6" fill="#292524" stroke="#14171c" strokeWidth="1.6" />
            <circle cx="32" cy="40.5" r="3.2" fill="none" stroke="#facc15" strokeWidth="1.8" />
          </>
        ) : (
          <>
            <ellipse cx="32" cy="35" rx="2.2" ry="1.6" fill={ear === 'bunny' ? '#f472b6' : '#18181b'} />
            <path
              d="M28.5 38.2 Q30.2 40.8 32 38.2 Q33.8 40.8 35.5 38.2"
              fill="none"
              stroke="#18181b"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Mythical & Extinct Forehead Horns / Crests */}
        {ear === 'unicorn' && hatType === 'none' && (
          <polygon points="29,19 32,4 35,19" fill="#fde047" stroke="#14171c" strokeWidth="2" />
        )}
        {ear === 'triceratops' && hatType === 'none' && (
          <>
            <polygon points="21,23 17,11 26,20" fill="#fef3c7" stroke="#14171c" strokeWidth="1.8" />
            <polygon points="43,23 47,11 38,20" fill="#fef3c7" stroke="#14171c" strokeWidth="1.8" />
            <polygon points="30,35 32,29 34,35" fill="#fef3c7" stroke="#14171c" strokeWidth="1.5" />
          </>
        )}
        {ear === 'phoenix' && hatType === 'none' && (
          <polygon points="24,18 28,7 32,14 36,5 40,18" fill="#fde047" stroke="#ea580c" strokeWidth="2" />
        )}
        {ear === 'trex' && hatType === 'none' && (
          <polygon points="26,17 29,11 32,17 35,11 38,17" fill="#facc15" stroke="#14171c" strokeWidth="1.6" />
        )}

        {/* Head Toppers & Theme Hats */}
        {species.headTopper === 'capybara_orange' && hatType === 'none' && (
          <circle cx="32" cy="14" r="4.8" fill="#f97316" stroke="#14171c" strokeWidth="2" />
        )}
        {species.headTopper === 'alpaca_fluff' && hatType === 'none' && (
          <path
            d="M24 18 Q28 11 32 15 Q36 11 40 18 Z"
            fill="#fffbeb"
            stroke="#14171c"
            strokeWidth="2"
          />
        )}
        {hatType === 'hat_red_bow' && (
          <path
            d="M23 16 Q27 9 32 16 Q37 9 41 16 Q37 22 32 17 Q27 22 23 16 Z"
            fill="#ef4444"
            stroke="#14171c"
            strokeWidth="2"
          />
        )}
        {(hatType === 'hat_tiara' || hatType === 'hat_ice_crown') && (
          <polygon
            points="23,18 26,10 32,15 38,10 41,18"
            fill={hatType === 'hat_ice_crown' ? '#38bdf8' : '#facc15'}
            stroke="#14171c"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {hatType === 'hat_fez' && (
          <polygon points="26,18 28,9 36,9 38,18" fill="#dc2626" stroke="#14171c" strokeWidth="2" />
        )}
        {hatType === 'hat_robin' && (
          <polygon points="21,19 33,9 43,18" fill="#16a34a" stroke="#14171c" strokeWidth="2" />
        )}
        {hatType === 'hat_knight_helm' && (
          <path d="M22 20 Q32 8 42 20 Z" fill="#94a3b8" stroke="#14171c" strokeWidth="2" />
        )}
      </svg>
      {propEmoji && (
        <span className="absolute -bottom-0.5 -right-1 text-sm leading-none drop-shadow">
          {propEmoji}
        </span>
      )}
    </div>
  );
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : 'F8FAFC';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const lNorm = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function WardrobeShopModal({
  isOpen,
  onClose,
  mode,
  qualityMode = 'auto',
  editingPlayerId,
  currentUserId,
  userPoints,
  unlockedItems,
  onUnlockOrEquipItem,
  onSpinGacha,
  initialRightTab,
  joinRole,
  setJoinRole,
  joinName,
  setJoinName,
  joinEmoji,
  setJoinEmoji,
  joinColor,
  setJoinColor,
  joinBandColor,
  setJoinBandColor,
  joinSpecies,
  setJoinSpecies,
  joinThemeId,
  setJoinThemeId,
  joinEquipHat,
  setJoinEquipHat,
  joinEquipFace,
  setJoinEquipFace,
  joinEquipArmor,
  setJoinEquipArmor,
  joinEquipWeapon,
  setJoinEquipWeapon,
  joinEquipWings,
  setJoinEquipWings,
  joinEquipAura,
  setJoinEquipAura,
  joinEquipPetGear,
  setJoinEquipPetGear,
  joinEquipMount = 'mount_none',
  setJoinEquipMount = () => {},
  joinEquipMarker = 'marker_wood',
  setJoinEquipMarker = () => {},
  joinPropColors = {},
  setJoinPropColors = () => {},
  joinGoalType,
  setJoinGoalType,
  joinStart,
  setJoinStart,
  joinGoal,
  setJoinGoal,
  joinBodyWeight = '',
  setJoinBodyWeight = () => {},
  joinHeightCm = '',
  setJoinHeightCm = () => {},
  joinGender = 'female',
  setJoinGender = () => {},
  joinWorkout,
  setJoinWorkout,
  joinStatus,
  setJoinStatus,
  joinPin,
  setJoinPin,
  joinError,
  joining,
  onSubmit,
}: WardrobeModalProps) {
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const rotYRef = useRef<number>(INITIAL_FACING_YAW);
  const autoSpinRef = useRef<boolean>(true);
  const [autoSpinUi, setAutoSpinUi] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<'species' | 'hero' | 'anime' | 'monster' | 'job'>(() =>
    isJobSpecies(joinSpecies)
      ? 'job'
      : isMonsterSpecies(joinSpecies)
      ? 'monster'
      : isAnimeSpecies(joinSpecies)
      ? 'anime'
      : isHeroSpecies(joinSpecies)
      ? 'hero'
      : 'species'
  );
  const [selectedCategory, setSelectedCategory] = useState<SpeciesCategoryId>(
    () => resolveBreedOption(joinSpecies).category
  );
  const [selectedHeroCat, setSelectedHeroCat] = useState<HeroCategoryId>(
    () => resolveBreedOption(joinSpecies).heroCategory || 'princess'
  );
  const [selectedAnimeCat, setSelectedAnimeCat] = useState<AnimeCategoryId>(
    () => resolveBreedOption(joinSpecies).animeCategory || 'shonen'
  );
  const [selectedMonsterCat, setSelectedMonsterCat] = useState<MonsterCategoryId>(
    () => resolveBreedOption(joinSpecies).monsterCategory || 'thai_ghost'
  );
  const [selectedJobCat, setSelectedJobCat] = useState<JobCategoryId>(
    () => resolveBreedOption(joinSpecies).jobCategory || 'melee'
  );
  const [leftSearch, setLeftSearch] = useState<string>('');
  const [colorEditTarget, setColorEditTarget] = useState<'body' | 'band'>('body');
  const [showFineSliders, setShowFineSliders] = useState<boolean>(false);
  const [armorColorPart, setArmorColorPart] = useState<'shirt' | 'pants'>('shirt');
  const [showPropFineSliders, setShowPropFineSliders] = useState<boolean>(false);
  const [showBmiCard, setShowBmiCard] = useState<boolean>(true);
  const [showConfirmBmiEdit, setShowConfirmBmiEdit] = useState<boolean>(false);
  const [rightCategory, setRightCategory] = useState<ShopCategory | 'gacha'>(initialRightTab || 'armor');
  const [mobileSheetTab, setMobileSheetTab] = useState<'species' | 'shop' | 'bmi'>(
    initialRightTab === 'gacha' ? 'shop' : 'species'
  );
  const [previewBelly, setPreviewBelly] = useState<number>(1.0);
  const [shopBusyId, setShopBusyId] = useState<string | null>(null);
  const [shopMsg, setShopMsg] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [gachaSpinning, setGachaSpinning] = useState<boolean>(false);
  const [lastWonGachaItem, setLastWonGachaItem] = useState<ShopItem | null>(null);
  const [gachaStage, setGachaStage] = useState<null | 'charging' | 'fakeout' | 'reveal'>(null);
  const [gachaOverlayResults, setGachaOverlayResults] = useState<GachaRollResult[]>([]);
  const [gachaPullCount, setGachaPullCount] = useState<1 | 8>(1);
  const [gachaRevealKey, setGachaRevealKey] = useState<number>(0);
  const gachaSkipRef = useRef<boolean>(false);
  const [onlyOwnedFilter, setOnlyOwnedFilter] = useState<boolean>(false);
  const [previewOverrides, setPreviewOverrides] = useState<Record<ShopCategory, string | null>>({
    hat: null,
    face: null,
    armor: null,
    weapon: null,
    wings: null,
    aura: null,
    pet: null,
    mount: null,
    marker: null,
  });

  const clearAllPreviewOverrides = () => {
    setPreviewOverrides({
      hat: null,
      face: null,
      armor: null,
      weapon: null,
      wings: null,
      aura: null,
      pet: null,
      mount: null,
      marker: null,
    });
  };

  const effectiveHat = previewOverrides.hat ?? joinEquipHat;
  const effectiveFace = previewOverrides.face ?? joinEquipFace;
  const effectiveArmor = previewOverrides.armor ?? joinEquipArmor;
  const effectiveWeapon = previewOverrides.weapon ?? joinEquipWeapon;
  const effectiveWings = previewOverrides.wings ?? joinEquipWings;
  const effectiveAura = previewOverrides.aura ?? joinEquipAura;
  const effectivePet = previewOverrides.pet ?? joinEquipPetGear;
  const effectiveMount = previewOverrides.mount ?? joinEquipMount;
  const effectiveMarker = previewOverrides.marker ?? joinEquipMarker;
  const propColorsJson = JSON.stringify(joinPropColors || {});

  const ownedSet = new Set([...Array.from(FREE_DEFAULT_ITEMS), ...unlockedItems]);
  const gachaOwnedCount = GACHA_EXCLUSIVE_ITEMS.filter((it) => ownedSet.has(it.id)).length;
  const goalMeta = getGoalTypeMeta(joinGoalType);
  const parsedBodyWeight = parseFloat(joinBodyWeight || '0');
  const parsedHeightCm = parseFloat(joinHeightCm || '0');
  const bmiMeta = computeBmiMeta(parsedBodyWeight, parsedHeightCm, joinGender);
  const effectiveBellyScale = bmiMeta.isValid ? bmiMeta.bellyScale : previewBelly;
  const liveBellyRef = useRef<number>(effectiveBellyScale);
  liveBellyRef.current = effectiveBellyScale;

  useEffect(() => {
    if (isOpen) {
      rotYRef.current = INITIAL_FACING_YAW;
      autoSpinRef.current = true;
      setAutoSpinUi(true);
      setShowConfirmModal(false);
      setShowConfirmBmiEdit(false);
      setLastWonGachaItem(null);
      setMobileSheetTab(initialRightTab === 'gacha' ? 'shop' : 'species');
      clearAllPreviewOverrides();
      const curBreed = resolveBreedOption(joinSpecies);
      if (isJobSpecies(joinSpecies) || curBreed.jobCategory) {
        setLeftTab('job');
        if (curBreed.jobCategory) setSelectedJobCat(curBreed.jobCategory);
      } else if (isMonsterSpecies(joinSpecies) || curBreed.monsterCategory) {
        setLeftTab('monster');
        if (curBreed.monsterCategory) setSelectedMonsterCat(curBreed.monsterCategory);
      } else if (isAnimeSpecies(joinSpecies) || curBreed.animeCategory) {
        setLeftTab('anime');
        if (curBreed.animeCategory) setSelectedAnimeCat(curBreed.animeCategory);
      } else if (curBreed.isHero) {
        setLeftTab('hero');
        if (curBreed.heroCategory) setSelectedHeroCat(curBreed.heroCategory);
      } else {
        setLeftTab('species');
        setSelectedCategory(curBreed.category);
      }
      if (initialRightTab) {
        setRightCategory(initialRightTab);
      }
    }
  }, [isOpen, initialRightTab]);

  useEffect(() => {
    if (!isOpen || !previewContainerRef.current) return;
    const container = previewContainerRef.current;
    container.innerHTML = '';

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const qCfg = getQualityConfig(qualityMode);
    const isCompactStage = width < 1024;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.016);

    const hasMount = effectiveMount && effectiveMount !== 'mount_none';
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 140);
    // On mobile/iPad portrait (< 1024px), shift camera lookAt lower so the character sits cleanly in the upper 42% above the bottom sheet
    const targetY = hasMount ? (isCompactStage ? -0.45 : 0.65) : isCompactStage ? -0.55 : 0.45;
    camera.position.set(
      0,
      hasMount ? (isCompactStage ? 2.25 : 2.65) : isCompactStage ? 1.95 : 2.35,
      hasMount ? (isCompactStage ? 11.4 : 10.4) : isCompactStage ? 10.4 : 9.6
    );
    camera.lookAt(0, targetY, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    // EffectComposer with subtle UnrealBloomPass (full on Desktop, half-res on iPad, bypassed on Mobile Lite)
    let composer: EffectComposer | null = null;
    if (qCfg.enableBloom) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bw = Math.max(1, Math.floor(width * qCfg.bloomResolutionScale));
      const bh = Math.max(1, Math.floor(height * qCfg.bloomResolutionScale));
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(bw, bh), 0.36, 0.55, 0.8);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    }

    // Warm Sunlight + Sky Hemisphere Light + Cool Blue-White Rim Light behind character
    const hemi = new THREE.HemisphereLight(0xffffff, 0xfef08a, 0.9);
    hemi.position.set(0, 25, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfffbeb, 1.25);
    dir.position.set(5, 11, 8);
    dir.castShadow = true;
    const wShadowSize = Math.min(1024, qCfg.shadowMapSize);
    dir.shadow.mapSize.set(wShadowSize, wShadowSize);
    scene.add(dir);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 1.45);
    rimLight.position.set(-4, 5, -6);
    scene.add(rimLight);

    // 1. Lush Floating Sky Island with Displaced Jagged Rock Underside (strictly below y = 0!)
    const islandGroup = new THREE.Group();
    const grassTop = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.05, 0.42, 32),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.68 })
    );
    grassTop.position.y = -0.21;
    grassTop.receiveShadow = true;

    const grassRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.26, 0.09, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72 })
    );
    grassRim.rotation.x = Math.PI / 2;
    grassRim.position.y = -0.04;

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6b5b4d,
      roughness: 0.92,
      flatShading: true,
    });
    // Jagged rocky clusters strictly beneath the grassy island (top <= -0.35)
    const rockSpecs: [number, number, number, number, number][] = [
      [0, -1.75, 0, 1.65, 0.85],
      [-1.05, -0.98, 0.75, 0.72, 0.72],
      [1.1, -1.0, 0.65, 0.7, 0.7],
      [0.15, -1.02, -1.05, 0.75, 0.72],
      [-0.85, -0.95, -0.7, 0.65, 0.68],
      [0.95, -0.96, -0.55, 0.66, 0.68],
    ];
    rockSpecs.forEach(([rx, ry, rz, rad, sy]) => {
      const rMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 1), rockMat);
      rMesh.scale.set(1, sy, 1);
      rMesh.position.set(rx, ry, rz);
      rMesh.rotation.set(rx * 0.4, ry * 0.6, rz * 0.3);
      islandGroup.add(rMesh);
    });

    // Glowing Golden Magic Ring on Island Surface
    const magicRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.045, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    magicRing.rotation.x = Math.PI / 2;
    magicRing.position.y = 0.03;

    const outerGlowRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.02, 0.025, 10, 40),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.65 })
    );
    outerGlowRing.rotation.x = Math.PI / 2;
    outerGlowRing.position.y = 0.02;

    islandGroup.add(grassTop, grassRim, magicRing, outerGlowRing);
    scene.add(islandGroup);

    // 2. Distant Misty Floating Castle Islands (NO hard cylinders behind character!)
    const castleIslands: THREE.Group[] = [];
    const mistyCastleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
    const mistyRoofMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 });
    const islandSpecs: [number, number, number, number][] = [
      [11.5, 4.2, -26, 1.15],
      [-12.5, 3.6, -30, 0.95],
    ];
    islandSpecs.forEach(([ix, iy, iz, sc]) => {
      const isl = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.1 * sc, 1), rockMat);
      rock.scale.set(1.1, 1.35, 1.0);
      rock.position.y = -2.2 * sc;
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2 * sc, 2.9 * sc, 0.55 * sc, 14),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.75 })
      );
      const keep = new THREE.Mesh(new THREE.BoxGeometry(2.1 * sc, 2.5 * sc, 2.1 * sc), mistyCastleMat);
      keep.position.y = 1.35 * sc;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65 * sc, 1.9 * sc, 8), mistyRoofMat);
      roof.position.y = 3.45 * sc;
      [-1.1, 1.1].forEach((tx) => {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * sc, 0.48 * sc, 2.8 * sc, 8), mistyCastleMat);
        tower.position.set(tx * sc, 1.5 * sc, 0.8 * sc);
        const tRoof = new THREE.Mesh(new THREE.ConeGeometry(0.58 * sc, 1.0 * sc, 8), mistyRoofMat);
        tRoof.position.set(tx * sc, 3.35 * sc, 0.8 * sc);
        isl.add(tower, tRoof);
      });
      isl.add(rock, top, keep, roof);
      isl.position.set(ix, iy, iz);
      scene.add(isl);
      castleIslands.push(isl);
    });

    // 3. Drifting Fluffy 3D Clouds
    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    for (let c = 0; c < 7; c++) {
      const cg = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.95 + (p % 2) * 0.35, 12, 12), cloudMat);
        puff.position.set((p - 1) * 0.95, (p % 2) * 0.25, 0);
        cg.add(puff);
      }
      cg.position.set(-20 + c * 7.2, 5.2 + (c % 3) * 1.4, -20 - (c % 2) * 6);
      scene.add(cg);
      clouds.push(cg);
    }

    // 4. Rising Golden Star Motes around Character
    const sparkleCount = 36;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      const a = (i / sparkleCount) * Math.PI * 2;
      const r = 1.05 + Math.random() * 1.1;
      sparklePositions[i * 3] = Math.cos(a) * r;
      sparklePositions[i * 3 + 1] = Math.random() * 2.8;
      sparklePositions[i * 3 + 2] = Math.sin(a) * r;
    }
    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
    const sparkles = new THREE.Points(
      sparkleGeo,
      new THREE.PointsMaterial({ color: 0xfef08a, size: 0.14, transparent: true, opacity: 0.92 })
    );
    scene.add(sparkles);

    // 5. Build Character 3D Mesh facing angled ~30 deg toward camera
    const isMuscle = joinGoalType === 'muscle_gain';
    const initBelly = liveBellyRef.current;
    const charParts = buildCharacterMesh({
      colorHex: joinColor,
      accessory: 'none',
      bandColor: joinBandColor,
      bellyScale: isMuscle ? Math.max(0.95, initBelly * 0.92) : initBelly,
      muscleScale: isMuscle ? Math.max(1.1, initBelly) : 1.0,
      showDumbbells: isMuscle,
      species: joinSpecies,
      equipHat: effectiveHat,
      equipFace: effectiveFace,
      equipArmor: effectiveArmor,
      equipWeapon: effectiveWeapon,
      equipWings: effectiveWings,
      equipAura: effectiveAura,
      equipMount: effectiveMount,
      propColors: joinPropColors,
      animMode: 'idle',
    });
    charParts.rootGroup.rotation.y = rotYRef.current;
    scene.add(charParts.rootGroup);

    const petParts = buildPetMesh(effectivePet, joinPropColors?.pet);
    if (petParts) {
      charParts.rootGroup.add(petParts.petGroup);
    }

    let isDragging = false;
    let prevX = 0;
    const onDown = (e: PointerEvent) => {
      isDragging = true;
      autoSpinRef.current = false;
      setAutoSpinUi(false);
      prevX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      rotYRef.current += dx * 0.014;
    };
    const onUp = () => {
      isDragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!previewContainerRef.current) return;
      const w = previewContainerRef.current.clientWidth || window.innerWidth;
      const h = previewContainerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let t = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.05, clock.getDelta());
      t += delta;
      if (autoSpinRef.current) {
        rotYRef.current += 0.0045;
      }
      charParts.rootGroup.rotation.y = rotYRef.current;
      charParts.mixer?.update(delta);
      petParts?.mixer?.update(delta);
      charParts.bounceGroup.position.y = charParts.mixer ? 0 : Math.abs(Math.sin(t * 3.2)) * 0.09;

      // Rising star motes
      const spAttr = sparkleGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < sparkleCount; i++) {
        let sy = spAttr.getY(i) + delta * 0.65;
        if (sy > 3.0) sy = 0.05;
        spAttr.setY(i, sy);
      }
      spAttr.needsUpdate = true;
      sparkles.rotation.y = t * 0.35;

      magicRing.scale.setScalar(1 + Math.sin(t * 2.5) * 0.02);
      clouds.forEach((cl) => {
        cl.position.x += 0.008;
        if (cl.position.x > 24) cl.position.x = -24;
      });
      castleIslands.forEach((isl, idx) => {
        isl.position.y += Math.sin(t * 0.8 + idx * 1.8) * 0.004;
      });

      const bVal = liveBellyRef.current;
      const scaleTarget = isMuscle ? Math.max(0.95, bVal * 0.92) : bVal;
      const muscleTarget = isMuscle ? Math.max(1.1, bVal) : 1.0;
      applyCharacterBellyScale(charParts, scaleTarget, muscleTarget);
      syncCharacterMountPose(charParts, t, 0, true, false);
      if (charParts.auraSpinGroup) {
        charParts.auraSpinGroup.rotation.y = t * 1.45;
      }
      if (petParts) {
        animatePetMotion(petParts, charParts, effectivePet, false, t, 0);
      }
      if (markerPreviewParts) {
        animateTrackMarkerMesh(markerPreviewParts, t, 0);
      }
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };
    const showMarkerOnStage = rightCategory === 'marker' || Boolean(previewOverrides.marker);
    const markerPreviewParts = showMarkerOnStage
      ? buildTrackMarkerMesh(effectiveMarker, joinBandColor || joinColor)
      : null;
    if (markerPreviewParts) {
      markerPreviewParts.group.position.set(1.35, 0.02, 0.25);
      markerPreviewParts.group.scale.setScalar(0.85);
      scene.add(markerPreviewParts.group);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      charParts.rootGroup.userData.disposed = true;
      if (petParts) petParts.petGroup.userData.disposed = true;
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      composer?.dispose();
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [
    isOpen,
    qualityMode,
    joinColor,
    joinBandColor,
    joinSpecies,
    effectiveHat,
    effectiveFace,
    effectiveArmor,
    effectiveWeapon,
    effectiveWings,
    effectiveAura,
    effectivePet,
    effectiveMount,
    effectiveMarker,
    rightCategory,
    propColorsJson,
    joinGoalType,
  ]);

  if (!isOpen) return null;

  const handleSelectSpecies = (sp: SpeciesOption) => {
    const wasHero = isHeroSpecies(joinSpecies);
    setJoinSpecies(sp.id);
    setJoinEmoji(sp.emoji);
    setJoinColor(sp.colorHex);
    setJoinBandColor(sp.bandColor);
    setJoinThemeId('none');
    if (wasHero) {
      setJoinPropColors((prev) => {
        const next = { ...prev };
        delete next.shirt;
        delete next.pants;
        return next;
      });
    }
  };

  const handleSelectHero = (hero: SpeciesOption) => {
    setJoinSpecies(hero.id);
    setJoinEmoji(hero.emoji);
    setJoinColor(hero.colorHex);
    setJoinBandColor(hero.bandColor);
    setJoinThemeId('none');
    setJoinEquipHat('none');
    const targetArmor = hero.defaultArmor || 'armor_none';
    if (ownedSet.has(targetArmor)) {
      setJoinEquipArmor(targetArmor);
    } else {
      setJoinEquipArmor('armor_none');
    }
    setJoinPropColors((prev) => ({
      ...prev,
      shirt: hero.defaultShirtHex || undefined,
      pants: hero.defaultPantsHex || undefined,
    }));
  };

  const handleResetToDefault = () => {
    const breed = resolveBreedOption(joinSpecies);
    setJoinThemeId('none');
    setJoinColor(breed.colorHex);
    setJoinBandColor(breed.bandColor);
    setJoinEquipHat('none');
    setJoinEquipFace('face_none');
    setJoinEquipArmor(breed.isHero ? breed.defaultArmor || 'armor_none' : 'armor_bare');
    setJoinEquipWeapon('weapon_none');
    setJoinEquipWings('wings_none');
    setJoinEquipAura('aura_none');
    setJoinEquipPetGear('pet_none');
    setJoinEquipMount('mount_none');
    setJoinEquipMarker('marker_wood');
    setJoinPropColors({});
    setPreviewBelly(1.0);
    clearAllPreviewOverrides();
    setShopMsg('✨ รีเซ็ตชุด พรอพ สีพรอพ และสัตว์ขี่เป็นค่าเริ่มต้นแล้ว! เลือกแต่งใหม่ได้เลย');
  };

  const handleTogglePreview = (item: ShopItem) => {
    setPreviewOverrides((prev) => {
      const isAlreadyPreviewing = prev[item.category] === item.id;
      const next = {
        ...prev,
        [item.category]: isAlreadyPreviewing ? null : item.id,
      };
      if (isAlreadyPreviewing) {
        setShopMsg(`ถอดพรีวิว "${item.name}" แล้ว`);
      } else {
        setShopMsg(`👀 กำลังลองสวมพรีวิว "${item.icon} ${item.name}" บนตัวละคร 3D!`);
      }
      return next;
    });
  };

  const handleItemAction = async (item: (typeof SHOP_ITEMS)[number]) => {
    setShopMsg('');
    const isOwned = ownedSet.has(item.id);
    if (isOwned) {
      setPreviewOverrides((prev) => ({ ...prev, [item.category]: null }));
      if (item.category === 'hat') setJoinEquipHat(item.id);
      else if (item.category === 'face') setJoinEquipFace(item.id);
      else if (item.category === 'armor') setJoinEquipArmor(item.id);
      else if (item.category === 'weapon') setJoinEquipWeapon(item.id);
      else if (item.category === 'wings') setJoinEquipWings(item.id);
      else if (item.category === 'aura') setJoinEquipAura(item.id);
      else if (item.category === 'pet') setJoinEquipPetGear(item.id);
      else if (item.category === 'mount') setJoinEquipMount(item.id);
      else if (item.category === 'marker') setJoinEquipMarker(item.id);
      return;
    }

    if (item.isGachaOnly) {
      setRightCategory('gacha');
      setShopMsg('🎰 ไอเทมแรร์ชิ้นนี้หาซื้อไม่ได้! กดหมุนตู้Gachaเพื่อลุ้นรับได้เลย!');
      return;
    }

    if (mode === 'create' || !editingPlayerId) {
      handleTogglePreview(item);
      setShopMsg(`👀 ลองใส่พรีวิว "${item.name}" แล้ว! (กด "อัญเชิญลงสนามแข่ง" ก่อนเพื่อสะสมแต้มปลดล็อกจริง)`);
      return;
    }

    setShopBusyId(item.id);
    try {
      await onUnlockOrEquipItem(item.id);
      setPreviewOverrides((prev) => ({ ...prev, [item.category]: null }));
      if (item.category === 'hat') setJoinEquipHat(item.id);
      else if (item.category === 'face') setJoinEquipFace(item.id);
      else if (item.category === 'armor') setJoinEquipArmor(item.id);
      else if (item.category === 'weapon') setJoinEquipWeapon(item.id);
      else if (item.category === 'wings') setJoinEquipWings(item.id);
      else if (item.category === 'aura') setJoinEquipAura(item.id);
      else if (item.category === 'pet') setJoinEquipPetGear(item.id);
      else if (item.category === 'mount') setJoinEquipMount(item.id);
      else if (item.category === 'marker') setJoinEquipMarker(item.id);
      setShopMsg(`🎉 ปลดล็อกและสวมใส่ "${item.name}" สำเร็จ!`);
    } catch (err: any) {
      setShopMsg(err?.message || 'ปลดล็อกไม่สำเร็จ');
    } finally {
      setShopBusyId(null);
    }
  };

  const playGachaSfx = (kind: 'charge' | 'rare' | 'epic' | 'legendary_upgrade' | 'legendary') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const tone = (
        freq: number,
        start: number,
        dur: number,
        type: OscillatorType = 'triangle',
        gainVal = 0.14
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(gainVal, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.03);
      };

      if (kind === 'charge') {
        [330, 392, 440, 523, 587, 659].forEach((f, i) => tone(f, i * 0.13, 0.14, 'triangle', 0.1));
      } else if (kind === 'rare') {
        tone(523.25, 0, 0.2, 'sine', 0.16);
        tone(659.25, 0.1, 0.25, 'sine', 0.16);
        tone(783.99, 0.2, 0.4, 'triangle', 0.18);
      } else if (kind === 'epic') {
        [440, 554.37, 659.25, 880].forEach((f, i) => tone(f, i * 0.09, 0.32, 'sawtooth', 0.1));
        tone(1108.73, 0.34, 0.55, 'triangle', 0.16);
      } else if (kind === 'legendary_upgrade') {
        tone(220, 0, 0.18, 'sawtooth', 0.15);
        tone(440, 0.1, 0.22, 'sawtooth', 0.15);
        tone(880, 0.22, 0.3, 'square', 0.12);
        tone(1318.5, 0.36, 0.35, 'triangle', 0.16);
      } else if (kind === 'legendary') {
        const fanfare = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5, 1318.5, 1567.98];
        fanfare.forEach((f, i) => tone(f, i * 0.085, i === fanfare.length - 1 ? 0.75 : 0.22, 'triangle', 0.16));
      }
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 1800);
    } catch {
      // ignore audio context restrictions
    }
  };

  const equipWonItemLocally = (item: ShopItem) => {
    setPreviewOverrides((prev) => ({ ...prev, [item.category]: null }));
    if (item.category === 'hat') setJoinEquipHat(item.id);
    else if (item.category === 'face') setJoinEquipFace(item.id);
    else if (item.category === 'armor') setJoinEquipArmor(item.id);
    else if (item.category === 'weapon') setJoinEquipWeapon(item.id);
    else if (item.category === 'wings') setJoinEquipWings(item.id);
    else if (item.category === 'aura') setJoinEquipAura(item.id);
    else if (item.category === 'pet') setJoinEquipPetGear(item.id);
    else if (item.category === 'mount') setJoinEquipMount(item.id);
    else if (item.category === 'marker') setJoinEquipMarker(item.id);
  };

  const isItemCurrentlyEquipped = (item: ShopItem) =>
    (item.category === 'hat' && joinEquipHat === item.id) ||
    (item.category === 'face' && joinEquipFace === item.id) ||
    (item.category === 'armor' && joinEquipArmor === item.id) ||
    (item.category === 'weapon' && joinEquipWeapon === item.id) ||
    (item.category === 'wings' && joinEquipWings === item.id) ||
    (item.category === 'aura' && joinEquipAura === item.id) ||
    (item.category === 'pet' && joinEquipPetGear === item.id) ||
    (item.category === 'mount' && joinEquipMount === item.id) ||
    (item.category === 'marker' && joinEquipMarker === item.id);

  const waitSkippable = (ms: number) =>
    new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => {
        if (gachaSkipRef.current || Date.now() - start >= ms) {
          resolve();
        } else {
          setTimeout(tick, 45);
        }
      };
      tick();
    });

  const handleGachaSpinClick = async (count: 1 | 8 = 1) => {
    setShopMsg('');
    if (mode === 'create' || !editingPlayerId) {
      setShopMsg('💡 กด "อัญเชิญลงสนามแข่ง" สร้างตัวละครก่อน แล้วกลับมาหมุนGachaได้เลย!');
      return;
    }
    if (gachaSpinning) return;
    gachaSkipRef.current = false;
    setGachaSpinning(true);
    setGachaPullCount(count);
    setLastWonGachaItem(null);
    setGachaOverlayResults([]);
    setGachaStage('charging');
    playGachaSfx('charge');
    try {
      const [rollResults] = await Promise.all([
        onSpinGacha(count),
        waitSkippable(count === 8 ? 1450 : 1150),
      ]);
      if (!rollResults || rollResults.length === 0) {
        throw new Error('ไม่ได้รับไอเทมจากตู้Gacha');
      }
      setGachaOverlayResults(rollResults);

      const hasLegendary = rollResults.some((r) => r.item.rarity === 'legendary');
      const hasEpic = rollResults.some((r) => r.item.rarity === 'epic');

      if (hasLegendary && !gachaSkipRef.current) {
        // จังหวะ Fake-Out สไตล์ Ni no Kuni! วงเวทย์ม่วงแตกออกเป็นแสงทองสายรุ้ง!
        setGachaStage('fakeout');
        playGachaSfx('legendary_upgrade');
        await waitSkippable(950);
      }

      const bestNew =
        rollResults.find((r) => !r.isDuplicate && r.item.rarity === 'legendary')?.item ||
        rollResults.find((r) => !r.isDuplicate && r.item.rarity === 'epic')?.item ||
        rollResults.find((r) => !r.isDuplicate)?.item;
      const bestWon =
        bestNew ||
        rollResults.find((r) => r.item.rarity === 'legendary')?.item ||
        rollResults.find((r) => r.item.rarity === 'epic')?.item ||
        rollResults[0].item;
      setLastWonGachaItem(bestWon);
      if (bestNew) {
        equipWonItemLocally(bestNew);
      }

      const totalRefund = rollResults.reduce((sum, r) => sum + (r.refundPoints || 0), 0);
      setGachaRevealKey((k) => k + 1);
      setGachaStage('reveal');
      if (hasLegendary) {
        playGachaSfx('legendary');
        confetti({ particleCount: 140, spread: 110, origin: { y: 0.55 }, colors: ['#facc15', '#f472b6', '#38bdf8', '#4ade80', '#ffffff'] });
        setTimeout(() => confetti({ particleCount: 90, spread: 90, origin: { x: 0.22, y: 0.58 }, colors: ['#facc15', '#fb923c', '#f472b6'] }), 240);
        setTimeout(() => confetti({ particleCount: 90, spread: 90, origin: { x: 0.78, y: 0.58 }, colors: ['#38bdf8', '#c084fc', '#fde047'] }), 480);
      } else if (hasEpic) {
        playGachaSfx('epic');
        confetti({ particleCount: 95, spread: 88, origin: { y: 0.55 }, colors: ['#c084fc', '#f472b6', '#facc15', '#ffffff'] });
      } else {
        playGachaSfx('rare');
        confetti({ particleCount: 55, spread: 68, origin: { y: 0.55 }, colors: ['#38bdf8', '#bae6fd', '#ffffff'] });
      }
      setShopMsg(
        rollResults.length > 1
          ? `🌟 อัญเชิญ ×${rollResults.length} สำเร็จ!${totalRefund > 0 ? ` (คืนแต้มของซ้ำ +${totalRefund} 💰)` : ''}`
          : rollResults[0].isDuplicate
          ? `🔁 ได้ "${bestWon.icon} ${bestWon.name}" ซ้ำ! คืนแต้ม +${rollResults[0].refundPoints} 💰`
          : `🎉 ยินดีด้วย! สุ่มได้ "${bestWon.icon} ${bestWon.name}"!`
      );
    } catch (err: any) {
      setGachaStage(null);
      setGachaOverlayResults([]);
      setShopMsg(err?.message || 'หมุนGachaไม่สำเร็จ');
    } finally {
      setGachaSpinning(false);
    }
  };

  const activePreviewItems = (Object.values(previewOverrides).filter(Boolean) as string[])
    .map((id) => SHOP_ITEMS.find((it) => it.id === id))
    .filter((it): it is ShopItem => Boolean(it));

  const activeBreedMeta = resolveBreedOption(joinSpecies);

  const categoryItems =
    rightCategory === 'gacha'
      ? GACHA_EXCLUSIVE_ITEMS
      : SHOP_ITEMS.filter((it) => {
          if (it.category !== rightCategory) return false;
          if (activeBreedMeta.isHero && (it.id === 'armor_bare' || it.id === 'armor_chibi_animal')) {
            return false;
          }
          return true;
        });
  const ownedCountInCurrentCat = categoryItems.filter((it) => ownedSet.has(it.id)).length;
  const displayedCategoryItems = onlyOwnedFilter
    ? categoryItems.filter((it) => ownedSet.has(it.id))
    : categoryItems;
  const hatObj = SHOP_ITEMS.find((i) => i.id === effectiveHat);
  const faceObj = SHOP_ITEMS.find((i) => i.id === effectiveFace);
  const armorObj = SHOP_ITEMS.find((i) => i.id === effectiveArmor);
  const weaponObj = SHOP_ITEMS.find((i) => i.id === effectiveWeapon);
  const wingsObj = SHOP_ITEMS.find((i) => i.id === effectiveWings);
  const auraObj = SHOP_ITEMS.find((i) => i.id === effectiveAura);
  const petObj = SHOP_ITEMS.find((i) => i.id === effectivePet);
  const mountObj = SHOP_ITEMS.find((i) => i.id === effectiveMount);
  const markerObj = SHOP_ITEMS.find((i) => i.id === effectiveMarker);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* FULL-SCREEN 3D FLOATING ISLAND + BLOOM SKY ARENA */}
      <div
        ref={previewContainerRef}
        className="fixed inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
      />

      {/* OVERLAY HUD & STONE-GOLD RPG PANELS */}
      <div className="relative z-10 h-dvh max-w-[1440px] mx-auto px-2.5 sm:px-6 pt-2.5 sm:py-3 pb-2 pb-safe pt-safe flex flex-col justify-between pointer-events-none">
        {/* TOP HUD BAR */}
        <div className="flex flex-nowrap lg:flex-wrap items-center justify-between gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            title="คลิกเพื่อเปลี่ยนชื่อตัวละคร / ตั้งค่าสายภารกิจ"
            className="rpg-stone-frame rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center gap-2 sm:gap-2.5 min-w-0 sm:min-w-[210px] max-w-[55vw] sm:max-w-none text-left cursor-pointer hover:brightness-110 transition group"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl border-2 border-amber-300 bg-slate-900/90 flex items-center justify-center overflow-hidden shrink-0 shadow">
              <ChibiHeroBustSvg
                species={{ ...activeBreedMeta, colorHex: joinColor }}
                outfitHex={joinBandColor}
                accentHex="#fde047"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-extrabold text-amber-200 truncate flex items-center gap-1">
                <span className="truncate">{joinName || 'ผู้กล้าคนใหม่'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 border border-amber-400/60 text-amber-300 shrink-0 group-hover:bg-amber-400 group-hover:text-black transition">
                  ✏️ <span className="hidden sm:inline">แก้ชื่อ</span>
                </span>
              </div>
              <div className="hidden sm:block w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-amber-500/70 mt-1">
                <div className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 w-3/4" />
              </div>
              <div className="hidden sm:block text-[10px] font-bold text-amber-100/85 mt-0.5 truncate">
                {joinGoal
                  ? `👟 Step Challenge • เสริม: ${goalMeta.shortTag} (${joinGoal} ${goalMeta.unit})`
                  : '👟 ผู้เข้าแข่งขัน Step Challenge'}
              </div>
            </div>
          </button>

          <div className="hidden lg:block text-center mx-auto">
            <h2 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-4xl font-extrabold tracking-wide rpg-gold-title">
              ศึกชิงบัลลังก์เอวเอส 3D
            </h2>
            <div
              className="font-[family-name:var(--font-kanit)] text-sm sm:text-lg font-extrabold text-white tracking-wide"
              style={{ WebkitTextStroke: '3px #1c1917', paintOrder: 'stroke fill', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.75))' }}
            >
              แต่งตัวละคร &amp; ยศคืบหน้า
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
            <div className="rpg-ribbon-header px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-extrabold">
              <span>💰</span>
              <span>{userPoints.toLocaleString()}</span>
              <span className="hidden sm:inline">Gacha</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-b from-rose-500 to-rose-700 text-white border-2 border-amber-300 rounded-xl font-extrabold text-base cursor-pointer shadow-lg hover:brightness-110"
            >
              ✕
            </button>
          </div>
        </div>

        {/* MOBILE / IPAD PORTRAIT (< lg): Compact 360° Pill + Tab Bar sitting cleanly below the open top 3D stage */}
        <div className="lg:hidden mt-auto flex flex-col gap-1.5 pointer-events-none">
          <div className="flex items-center justify-between gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                const next = !autoSpinRef.current;
                autoSpinRef.current = next;
                setAutoSpinUi(next);
              }}
              className={`px-2.5 py-1 rounded-full border-2 flex items-center gap-1 text-[11px] font-extrabold shadow-lg cursor-pointer ${
                autoSpinUi
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100 text-stone-950'
                  : 'bg-slate-900/90 border-amber-400/80 text-amber-200'
              }`}
            >
              <span>🔄</span>
              <span>หมุน 360°</span>
            </button>

            <div className="flex md:hidden items-center gap-1 rpg-panel rounded-xl p-1">
              {(
                [
                  { id: 'species', label: '🐾 สายพันธุ์' },
                  { id: 'shop', label: '👕 ชุด/ร้าน' },
                  { id: 'bmi', label: '⚖️ BMI' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileSheetTab(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition ${
                    mobileSheetTab === tab.id
                      ? 'rpg-btn-gold'
                      : 'text-amber-100/90'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="md:hidden rpg-btn-blue px-3 py-1 rounded-full text-[11px] font-extrabold cursor-pointer shadow-lg"
            >
              🚀 บันทึก
            </button>
          </div>
        </div>

        {/* MIDDLE ROW: LEFT STONE PANEL + OPEN SKY CENTER STAGE + RIGHT STONE PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5 lg:gap-4 items-end lg:items-center lg:flex-1 my-1 lg:my-2 min-h-0">
          {/* LEFT PANEL: Carved Stone & Gold Selector (🐾 120 Animals vs 🏰 56 Disney vs 🎌 56 Anime) */}
          <div className={`${mobileSheetTab === 'species' ? 'flex' : 'hidden'} md:flex lg:col-span-4 xl:col-span-3 rpg-stone-frame rounded-2xl px-3 pb-3 pt-2.5 space-y-2 pointer-events-auto h-[48dvh] md:h-[46dvh] lg:h-[68dvh] flex-col relative`}>
            <StoneFrameCorners />
            <RpgWingedHeaderPlaque
              title={
                leftTab === 'species'
                  ? 'เลือกสายพันธุ์สัตว์'
                  : leftTab === 'anime'
                  ? 'เลือกตัวละครอนิเมะดัง'
                  : leftTab === 'monster'
                  ? 'เลือกผี & สัตว์ประหลาด'
                  : leftTab === 'job'
                  ? 'เลือกอาชีพสายเกม RPG'
                  : 'เลือกตัวละครดิสนีย์ & พิกซาร์'
              }
              subtitle={
                leftTab === 'species'
                  ? '(เลี้ยง • ป่า • สูญพันธุ์ • เทพนิยาย 🐉)'
                  : leftTab === 'anime'
                  ? '(โชเน็น • นางเอก • วัยเด็ก • ตัวตึง 🎌)'
                  : leftTab === 'monster'
                  ? '(ผีไทย • ฮาโลวีน • ไคจู • โยไค 👻)'
                  : leftTab === 'job'
                  ? '(นักรบ • สายเวท • ว่องไว • คราฟต์ ⚔️)'
                  : '(เจ้าหญิง • คลาสสิก • พิกซาร์ • วายร้าย 🏰)'
              }
            />

            {/* 5 Side Tabs on wide desktop (protruding right edge of stone frame), compact strip on tablet/mobile */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 xl:absolute xl:left-full xl:top-10 xl:flex xl:flex-col xl:gap-1.5 xl:ml-[5px] z-10">
              <button
                type="button"
                onClick={() => {
                  setLeftTab('species');
                  setLeftSearch('');
                }}
                className={`py-1.5 px-1.5 xl:py-2 xl:px-3 rounded-lg xl:rounded-l-none xl:rounded-r-xl text-[11px] xl:text-xs font-extrabold border-2 cursor-pointer transition xl:whitespace-nowrap xl:text-left shadow-md ${
                  leftTab === 'species'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                🐾 สัตว์ ({SPECIES_LIST.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('hero');
                  setLeftSearch('');
                }}
                className={`py-1.5 px-1.5 xl:py-2 xl:px-3 rounded-lg xl:rounded-l-none xl:rounded-r-xl text-[11px] xl:text-xs font-extrabold border-2 cursor-pointer transition xl:whitespace-nowrap xl:text-left shadow-md ${
                  leftTab === 'hero'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                🏰 ดิสนีย์ ({HERO_LIST.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('anime');
                  setLeftSearch('');
                }}
                className={`py-1.5 px-1.5 xl:py-2 xl:px-3 rounded-lg xl:rounded-l-none xl:rounded-r-xl text-[11px] xl:text-xs font-extrabold border-2 cursor-pointer transition xl:whitespace-nowrap xl:text-left shadow-md ${
                  leftTab === 'anime'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                🎌 อนิเมะ ({ANIME_LIST.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('monster');
                  setLeftSearch('');
                }}
                className={`py-1.5 px-1.5 xl:py-2 xl:px-3 rounded-lg xl:rounded-l-none xl:rounded-r-xl text-[11px] xl:text-xs font-extrabold border-2 cursor-pointer transition xl:whitespace-nowrap xl:text-left shadow-md ${
                  leftTab === 'monster'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                👻 ผี/ปีศาจ ({MONSTER_LIST.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('job');
                  setLeftSearch('');
                }}
                className={`py-1.5 px-1.5 xl:py-2 xl:px-3 rounded-lg xl:rounded-l-none xl:rounded-r-xl text-[11px] xl:text-xs font-extrabold border-2 cursor-pointer transition xl:whitespace-nowrap xl:text-left shadow-md ${
                  leftTab === 'job'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                ⚔️ อาชีพ ({JOB_LIST.length})
              </button>
            </div>

            {/* Quick Search across Animals, Disney/Pixar, Anime, Ghosts/Monsters, or RPG Jobs */}
            <div className="relative">
              <input
                type="text"
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                placeholder={
                  leftTab === 'species'
                    ? '🔍 ค้นหาใน 120 สายพันธุ์ (เช่น มังกร, หมูเด้ง, ทีเร็กซ์)...'
                    : leftTab === 'anime'
                    ? '🔍 ค้นหาอนิเมะ (เช่น โงกุน, ลูฟี่, โกโจ, อาเนีย, โดราเอมอน, ชินจัง)...'
                    : leftTab === 'monster'
                    ? '🔍 ค้นหาผี & ปีศาจ (เช่น กระสือ, เจียงซือ, มัมมี่, ก็อตซิลล่า, คัปปะ)...'
                    : leftTab === 'job'
                    ? '🔍 ค้นหาอาชีพ RPG (เช่น พาลาดิน, จอมเวท, นินจา, ซามูไร, นักบินอวกาศ)...'
                    : '🔍 ค้นหาดิสนีย์ (เช่น เอลซ่า, สโนว์ไวท์, สติทช์, เบย์แมกซ์, วู้ดดี้)...'
                }
                className="w-full bg-slate-950/90 text-amber-100 placeholder:text-slate-400 border border-slate-600 focus:border-amber-400 outline-none rounded-xl px-3 py-1.5 text-xs font-semibold pr-7"
              />
              {leftSearch && (
                <button
                  type="button"
                  onClick={() => setLeftSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {leftTab === 'anime' ? (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-slate-700/80">
                  {ANIME_CATEGORIES.map((aCat) => {
                    const isAActive = selectedAnimeCat === aCat.id && !leftSearch.trim();
                    return (
                      <button
                        key={aCat.id}
                        type="button"
                        onClick={() => {
                          setSelectedAnimeCat(aCat.id);
                          setLeftSearch('');
                        }}
                        title={aCat.desc}
                        className={`py-1 px-1 rounded-lg border text-[10px] font-extrabold cursor-pointer transition text-center truncate ${
                          isAActive
                            ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100 text-stone-950 shadow'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {aCat.emoji} {aCat.name}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 py-0.5">
                  {ANIME_LIST.filter((ani) => {
                    const q = leftSearch.trim().toLowerCase();
                    if (q) {
                      return (
                        ani.name.toLowerCase().includes(q) ||
                        ani.nickname.toLowerCase().includes(q) ||
                        ani.desc.toLowerCase().includes(q)
                      );
                    }
                    return ani.animeCategory === selectedAnimeCat;
                  }).map((ani) => {
                    const active = joinSpecies === ani.id;
                    return (
                      <button
                        key={ani.id}
                        type="button"
                        onClick={() => handleSelectHero(ani)}
                        title={ani.desc}
                        className={`w-full px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center gap-3 ${
                          active ? 'rpg-hero-row-active' : 'rpg-hero-row'
                        }`}
                      >
                        <ChibiHeroBustSvg
                          species={ani}
                          outfitHex={ani.bandColor}
                          accentHex="#fde047"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-[family-name:var(--font-kanit)] text-sm sm:text-[15px] font-extrabold text-white truncate flex items-center gap-1.5"
                            style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9)' }}
                          >
                            <span className="truncate">{ani.name}</span>
                            <span className="shrink-0">{ani.emoji}</span>
                          </div>
                          <div className="text-[10px] font-bold text-amber-200/90 truncate">
                            {ani.nickname} • {ani.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : leftTab === 'hero' ? (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-slate-700/80">
                  {HERO_CATEGORIES.map((hCat) => {
                    const isHActive = selectedHeroCat === hCat.id && !leftSearch.trim();
                    return (
                      <button
                        key={hCat.id}
                        type="button"
                        onClick={() => {
                          setSelectedHeroCat(hCat.id);
                          setLeftSearch('');
                        }}
                        title={hCat.desc}
                        className={`py-1 px-1 rounded-lg border text-[10px] font-extrabold cursor-pointer transition text-center truncate ${
                          isHActive
                            ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100 text-stone-950 shadow'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {hCat.emoji} {hCat.name}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 py-0.5">
                  {HERO_LIST.filter((hero) => {
                    const q = leftSearch.trim().toLowerCase();
                    if (q) {
                      return (
                        hero.name.toLowerCase().includes(q) ||
                        hero.nickname.toLowerCase().includes(q) ||
                        hero.desc.toLowerCase().includes(q)
                      );
                    }
                    return hero.heroCategory === selectedHeroCat;
                  }).map((hero) => {
                    const active = joinSpecies === hero.id;
                    return (
                      <button
                        key={hero.id}
                        type="button"
                        onClick={() => handleSelectHero(hero)}
                        title={hero.desc}
                        className={`w-full px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center gap-3 ${
                          active ? 'rpg-hero-row-active' : 'rpg-hero-row'
                        }`}
                      >
                        <ChibiHeroBustSvg
                          species={hero}
                          outfitHex={hero.bandColor}
                          accentHex="#fde047"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-[family-name:var(--font-kanit)] text-sm sm:text-[15px] font-extrabold text-white truncate flex items-center gap-1.5"
                            style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9)' }}
                          >
                            <span className="truncate">{hero.name}</span>
                            <span className="shrink-0">{hero.emoji}</span>
                          </div>
                          <div className="text-[10px] font-bold text-amber-200/90 truncate">
                            {hero.nickname} • {hero.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : leftTab === 'monster' ? (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-purple-700/80">
                  {MONSTER_CATEGORIES.map((mCat) => {
                    const isMActive = selectedMonsterCat === mCat.id && !leftSearch.trim();
                    return (
                      <button
                        key={mCat.id}
                        type="button"
                        onClick={() => {
                          setSelectedMonsterCat(mCat.id);
                          setLeftSearch('');
                        }}
                        title={mCat.desc}
                        className={`py-1 px-1 rounded-lg border text-[10px] font-extrabold cursor-pointer transition text-center truncate ${
                          isMActive
                            ? 'bg-gradient-to-b from-purple-400 to-fuchsia-600 border-amber-100 text-white shadow'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-purple-400'
                        }`}
                      >
                        {mCat.emoji} {mCat.name}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 py-0.5">
                  {MONSTER_LIST.filter((mon) => {
                    const q = leftSearch.trim().toLowerCase();
                    if (q) {
                      return (
                        mon.name.toLowerCase().includes(q) ||
                        mon.nickname.toLowerCase().includes(q) ||
                        mon.desc.toLowerCase().includes(q)
                      );
                    }
                    return mon.monsterCategory === selectedMonsterCat;
                  }).map((mon) => {
                    const active = joinSpecies === mon.id;
                    return (
                      <button
                        key={mon.id}
                        type="button"
                        onClick={() => handleSelectHero(mon)}
                        title={mon.desc}
                        className={`w-full px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center gap-3 ${
                          active ? 'rpg-hero-row-active' : 'rpg-hero-row'
                        }`}
                      >
                        <ChibiHeroBustSvg
                          species={mon}
                          outfitHex={mon.bandColor}
                          accentHex="#fde047"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-[family-name:var(--font-kanit)] text-sm sm:text-[15px] font-extrabold text-white truncate flex items-center gap-1.5"
                            style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9)' }}
                          >
                            <span className="truncate">{mon.name}</span>
                            <span className="shrink-0">{mon.emoji}</span>
                          </div>
                          <div className="text-[10px] font-bold text-amber-200/90 truncate">
                            {mon.nickname} • {mon.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : leftTab === 'job' ? (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-sky-700/80">
                  {JOB_CATEGORIES.map((jCat) => {
                    const isJActive = selectedJobCat === jCat.id && !leftSearch.trim();
                    return (
                      <button
                        key={jCat.id}
                        type="button"
                        onClick={() => {
                          setSelectedJobCat(jCat.id);
                          setLeftSearch('');
                        }}
                        title={jCat.desc}
                        className={`py-1 px-1 rounded-lg border text-[10px] font-extrabold cursor-pointer transition text-center truncate ${
                          isJActive
                            ? 'bg-gradient-to-b from-sky-300 to-cyan-500 border-amber-100 text-slate-950 shadow'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-sky-400'
                        }`}
                      >
                        {jCat.emoji} {jCat.name}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 py-0.5">
                  {JOB_LIST.filter((job) => {
                    const q = leftSearch.trim().toLowerCase();
                    if (q) {
                      return (
                        job.name.toLowerCase().includes(q) ||
                        job.nickname.toLowerCase().includes(q) ||
                        job.desc.toLowerCase().includes(q)
                      );
                    }
                    return job.jobCategory === selectedJobCat;
                  }).map((job) => {
                    const active = joinSpecies === job.id;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => handleSelectHero(job)}
                        title={job.desc}
                        className={`w-full px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center gap-3 ${
                          active ? 'rpg-hero-row-active' : 'rpg-hero-row'
                        }`}
                      >
                        <ChibiHeroBustSvg
                          species={job}
                          outfitHex={job.bandColor}
                          accentHex="#fde047"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-[family-name:var(--font-kanit)] text-sm sm:text-[15px] font-extrabold text-white truncate flex items-center gap-1.5"
                            style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9)' }}
                          >
                            <span className="truncate">{job.name}</span>
                            <span className="shrink-0">{job.emoji}</span>
                          </div>
                          <div className="text-[10px] font-bold text-amber-200/90 truncate">
                            {job.nickname} • {job.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 flex-1 min-h-0">
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-slate-700/80">
                  {SPECIES_CATEGORIES.map((cat) => {
                    const isCatActive = selectedCategory === cat.id && !leftSearch.trim();
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setLeftSearch('');
                        }}
                        className={`py-1 px-1 rounded-lg border text-[10px] font-extrabold cursor-pointer transition text-center truncate ${
                          isCatActive
                            ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100 text-stone-950 shadow'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-amber-400'
                        }`}
                      >
                        {cat.emoji} {cat.name}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2 overflow-y-auto pr-1 flex-1 py-0.5">
                  {SPECIES_LIST.filter((sp) => {
                    const q = leftSearch.trim().toLowerCase();
                    if (q) {
                      return (
                        sp.name.toLowerCase().includes(q) ||
                        sp.nickname.toLowerCase().includes(q) ||
                        sp.desc.toLowerCase().includes(q)
                      );
                    }
                    return sp.category === selectedCategory;
                  }).map((sp) => {
                    const active = joinSpecies === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => handleSelectSpecies(sp)}
                        title={sp.desc}
                        className={`w-full px-3 py-2 rounded-xl text-left transition cursor-pointer flex items-center gap-3 ${
                          active ? 'rpg-hero-row-active' : 'rpg-hero-row'
                        }`}
                      >
                        <ChibiHeroBustSvg
                          species={sp}
                          outfitHex={sp.bandColor}
                          accentHex="#fde047"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-[family-name:var(--font-kanit)] text-sm sm:text-[15px] font-extrabold text-white truncate flex items-center gap-1.5"
                            style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9)' }}
                          >
                            <span className="truncate">{sp.name}</span>
                            <span className="shrink-0">{sp.emoji}</span>
                          </div>
                          <div className="text-[10px] font-bold text-amber-200/90 truncate">
                            {sp.nickname} • {sp.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fine-Grained Shade & Spectrum Color Studio (16.7M Colors!) */}
            {(() => {
              const activeHex = colorEditTarget === 'body' ? joinColor : joinBandColor;
              const setActiveHex = colorEditTarget === 'body' ? setJoinColor : setJoinBandColor;
              const hsl = hexToHsl(activeHex);
              return (
                <div className="pt-2 border-t border-amber-600/50 space-y-1.5 bg-black/25 rounded-xl p-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setColorEditTarget('body')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                          colorEditTarget === 'body'
                            ? 'bg-amber-400 text-black border-amber-100'
                            : 'bg-slate-900 text-amber-200 border-slate-700'
                        }`}
                      >
                        {activeBreedMeta.isHero ? '🎨 สีผม/หมวก' : '🎨 สีตัว'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorEditTarget('band')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                          colorEditTarget === 'band'
                            ? 'bg-amber-400 text-black border-amber-100'
                            : 'bg-slate-900 text-amber-200 border-slate-700'
                        }`}
                      >
                        ✨ สีรอง
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label
                        title="คลิกเปิดจานดูดสีละเอียด (RGB / Eyedropper)"
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-amber-400/80 cursor-pointer hover:brightness-110"
                      >
                        <input
                          type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(activeHex) ? activeHex : '#F8FAFC'}
                          onChange={(e) => setActiveHex(e.target.value.toUpperCase())}
                          className="w-4 h-4 rounded border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-[10px] font-mono font-extrabold text-amber-200">
                          {activeHex.toUpperCase()}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFineSliders((v) => !v)}
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-600 cursor-pointer"
                        title="พับ/กางแถบไล่เฉดละเอียด"
                      >
                        {showFineSliders ? '▾' : '▸'}
                      </button>
                    </div>
                  </div>

                  {showFineSliders && (
                    <div className="space-y-1.5 pt-0.5">
                      {/* Rainbow Hue Bar (0-360°) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-bold text-slate-300 w-10 shrink-0">โทนสี</span>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={hsl.h}
                          onChange={(e) =>
                            setActiveHex(
                              hslToHex(
                                Number(e.target.value),
                                Math.max(25, hsl.s),
                                Math.min(88, Math.max(20, hsl.l))
                              )
                            )
                          }
                          className="w-full h-2.5 rounded-full appearance-none cursor-pointer border border-black/60"
                          style={{
                            background:
                              'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                          }}
                        />
                      </div>

                      {/* Shade / Lightness Bar (Dark -> Vivid -> Pastel -> White) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-bold text-slate-300 w-10 shrink-0">อ่อน-เข้ม</span>
                        <input
                          type="range"
                          min={12}
                          max={96}
                          value={hsl.l}
                          onChange={(e) =>
                            setActiveHex(hslToHex(hsl.h, Math.max(15, hsl.s), Number(e.target.value)))
                          }
                          className="w-full h-2.5 rounded-full appearance-none cursor-pointer border border-black/60"
                          style={{
                            background: `linear-gradient(90deg, #111827 0%, hsl(${hsl.h}, ${Math.max(50, hsl.s)}%, 50%) 50%, #ffffff 100%)`,
                          }}
                        />
                      </div>

                      {/* Saturation Bar (Muted Gray/Cream -> Pure Neon) */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] font-bold text-slate-300 w-10 shrink-0">ความสด</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={hsl.s}
                          onChange={(e) =>
                            setActiveHex(hslToHex(hsl.h, Number(e.target.value), hsl.l))
                          }
                          className="w-full h-2.5 rounded-full appearance-none cursor-pointer border border-black/60"
                          style={{
                            background: `linear-gradient(90deg, hsl(${hsl.h}, 0%, ${hsl.l}%) 0%, hsl(${hsl.h}, 100%, ${hsl.l}%) 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick Swatches */}
                  <div className="flex items-center justify-between pt-0.5">
                    {[
                      '#F8FAFC',
                      '#FDE68A',
                      '#FB923C',
                      '#EF4444',
                      '#F472B6',
                      '#A855F7',
                      '#38BDF8',
                      '#4ADE80',
                      '#92400E',
                      '#1E293B',
                    ].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setActiveHex(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-4 h-4 rounded-full border cursor-pointer transition ${
                          activeHex.toUpperCase() === hex
                            ? 'border-amber-300 scale-125 ring-1 ring-amber-300'
                            : 'border-black/80 hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* CENTER STAGE: Clean open sky + 360° pill + BMI Card aligned flush with Left & Right panel bottom edges */}
          <div className={`${mobileSheetTab === 'bmi' ? 'flex' : 'hidden'} lg:flex lg:col-span-4 xl:col-span-6 lg:h-[68dvh] flex-col items-center justify-end lg:min-h-[260px] pointer-events-none relative`}>
            {/* Floating Compact 360° Spin Pill centered cleanly above BMI Card (Desktop lg+ only; < lg uses pill above sheet) */}
            <button
              type="button"
              onClick={() => {
                const next = !autoSpinRef.current;
                autoSpinRef.current = next;
                setAutoSpinUi(next);
              }}
              title="เปิด/ปิดหมุนตัวละครอัตโนมัติ 360°"
              className={`hidden lg:flex pointer-events-auto self-center mb-2 px-3 py-1 rounded-full border-2 items-center gap-1.5 text-xs font-extrabold shadow-lg cursor-pointer transition hover:scale-105 ${
                autoSpinUi
                  ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-100 text-stone-950'
                  : 'bg-slate-900/90 border-amber-400/80 text-amber-200'
              }`}
            >
              <span>🔄</span>
              <span>หมุน 360°</span>
            </button>

            <div className="w-full max-w-[390px] flex flex-col items-center gap-1.5 pointer-events-auto">
              {/* BMI-Driven 3D Body Sculptor Card (Compact & Collapsible) */}
              <div className="w-full rpg-stone-frame rounded-2xl px-3 py-2 space-y-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className="text-[11px] font-extrabold text-amber-200 flex items-center gap-1 truncate"
                    title="ปั้นขนาดพุงตาม BMI จริง • ซ่อนตัวเลขน้ำหนัก/ส่วนสูง/BMI จากสาธารณะทั้งหมด"
                  >
                    <span>⚖️ รูปร่างตาม BMI</span>
                    <span className="text-[9.5px] text-amber-200/75 font-semibold">🔒</span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${bmiMeta.badgeClass}`}
                    >
                      {bmiMeta.isValid ? `BMI ${bmiMeta.bmi} • ${bmiMeta.label}` : bmiMeta.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBmiCard((v) => !v)}
                      className="px-1.5 py-0.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-amber-400/60 text-amber-200 text-[10px] font-extrabold cursor-pointer transition"
                      title={showBmiCard ? 'พับกล่อง BMI เพื่อชมตัวละครเต็มตัว' : 'กางกล่องกรอกน้ำหนัก/ส่วนสูง'}
                    >
                      {showBmiCard ? 'ซ่อน ▾' : 'แก้ไข ▴'}
                    </button>
                  </div>
                </div>

                {showBmiCard && (
                  <>
                    {/* Gender + Weight + Height Row */}
                    <div className="grid grid-cols-12 gap-1.5 items-end">
                      <div className="col-span-4">
                        <label className="block text-[9.5px] font-bold text-amber-100/80 mb-0.5">
                          เพศ
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setJoinGender('female')}
                            className={`py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                              joinGender === 'female'
                                ? 'bg-pink-500 text-white border-amber-200 shadow'
                                : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-amber-400'
                            }`}
                          >
                            👩 หญิง
                          </button>
                          <button
                            type="button"
                            onClick={() => setJoinGender('male')}
                            className={`py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                              joinGender === 'male'
                                ? 'bg-sky-500 text-white border-amber-200 shadow'
                                : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-amber-400'
                            }`}
                          >
                            👨 ชาย
                          </button>
                        </div>
                      </div>

                      <div className="col-span-4">
                        <label className="block text-[9.5px] font-bold text-amber-100/80 mb-0.5">
                          น้ำหนัก (กก.)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="16"
                          max="300"
                          value={joinBodyWeight}
                          onChange={(e) => {
                            const val = e.target.value;
                            setJoinBodyWeight(val);
                            if (!goalMeta.isCumulative && mode === 'create') {
                              setJoinStart(val);
                            }
                          }}
                          className="w-full bg-slate-950 text-amber-200 placeholder:text-slate-500 border border-amber-500/70 rounded-lg px-2 py-1 text-xs font-extrabold text-center"
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="block text-[9.5px] font-bold text-amber-100/80 mb-0.5">
                          ส่วนสูง (ซม.)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="80"
                          max="250"
                          value={joinHeightCm}
                          onChange={(e) => setJoinHeightCm(e.target.value)}
                          className="w-full bg-slate-950 text-sky-200 placeholder:text-slate-500 border border-amber-500/70 rounded-lg px-2 py-1 text-xs font-extrabold text-center"
                        />
                      </div>
                    </div>

                    {/* 5-Segment Asian BMI Gauge Bar */}
                    <div className="space-y-0.5 pt-0.5">
                      <div className="relative w-full h-2.5 rounded-full overflow-visible border border-black/80 flex shadow-inner">
                        <div className="w-1/5 h-full bg-sky-400 rounded-l-full" title="ผอม (<18.5)" />
                        <div className="w-1/5 h-full bg-emerald-400" title="สมส่วน (18.5–22.9)" />
                        <div className="w-1/5 h-full bg-amber-300" title="เริ่มท้วม (23–24.9)" />
                        <div className="w-1/5 h-full bg-orange-500" title="อ้วนระดับ 1 (25–29.9)" />
                        <div className="w-1/5 h-full bg-rose-500 rounded-r-full" title="อ้วนระดับ 2 (30+)" />
                        {bmiMeta.isValid && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-stone-950 shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-300"
                            style={{ left: `${bmiMeta.gaugePct}%` }}
                          />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[8.5px] font-bold text-amber-100/75">
                        <span className="text-sky-300">ผอม</span>
                        <span className="text-emerald-300">สมส่วน</span>
                        <span className="text-amber-300">ท้วม</span>
                        <span className="text-orange-300">อ้วน 1</span>
                        <span className="text-rose-300">อ้วน 2</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Carved Stone & Gold Props + Vertical Category Sidebar */}
          <div className={`${mobileSheetTab === 'shop' ? 'flex' : 'hidden'} md:flex lg:col-span-4 xl:col-span-3 rpg-stone-frame rounded-2xl px-3 pb-3 pt-2.5 space-y-2 pointer-events-auto h-[48dvh] md:h-[46dvh] lg:h-[68dvh] flex-col relative`}>
            <StoneFrameCorners />
            <RpgWingedHeaderPlaque title="พรอพตกแต่ง & ร้านค้า" subtitle="(ปลดล็อกด้วย Gacha 💰)" />

            {/* Vertical Bookmark Sidebar on Wide Desktop (xl:, protruding left edge of right panel), horizontal scroll strip on tablet/mobile so it never overlaps Center Stage */}
            <div className="flex gap-1 overflow-x-auto pb-1 xl:pb-0 xl:overflow-visible xl:absolute xl:right-full xl:top-6 xl:flex-col xl:gap-1 xl:mr-[5px] z-10 shrink-0">
              {(
                [
                  { cat: 'hat' as ShopCategory, label: 'หมวก/ผม', fallbackIcon: '🎩', obj: hatObj },
                  { cat: 'face' as ShopCategory, label: 'แว่น/หน้า', fallbackIcon: '🕶️', obj: faceObj },
                  { cat: 'armor' as ShopCategory, label: 'เสื้อ/ชุด', fallbackIcon: '👕', obj: armorObj },
                  { cat: 'weapon' as ShopCategory, label: 'ของถือเล่น', fallbackIcon: '⚔️', obj: weaponObj },
                  { cat: 'wings' as ShopCategory, label: 'เป้/ปีก', fallbackIcon: '🎒', obj: wingsObj },
                  { cat: 'aura' as ShopCategory, label: 'ออร่า', fallbackIcon: '✨', obj: auraObj },
                  { cat: 'pet' as ShopCategory, label: 'สัตว์เลี้ยง', fallbackIcon: '🐾', obj: petObj },
                  { cat: 'mount' as ShopCategory, label: 'สัตว์ขี่', fallbackIcon: '🐎', obj: mountObj },
                  { cat: 'marker' as ShopCategory, label: 'ป้ายจองลู่', fallbackIcon: '📍', obj: markerObj },
                ] as const
              ).map((slot) => {
                const isSelected = rightCategory === slot.cat;
                const slotDyeHex =
                  slot.cat === 'armor'
                    ? joinPropColors.shirt || joinPropColors.pants
                    : joinPropColors[slot.cat as PropColorKey];
                const equippedIcon =
                  slot.obj && slot.obj.icon && slot.obj.icon !== '➖'
                    ? slot.obj.icon
                    : slot.fallbackIcon;
                const isEquipped =
                  Boolean(slot.obj) &&
                  !slot.obj?.id.endsWith('_none') &&
                  slot.obj?.id !== 'none';
                const collectibleItems = SHOP_ITEMS.filter(
                  (it) =>
                    it.category === slot.cat &&
                    it.id !== 'none' &&
                    !it.id.endsWith('_none') &&
                    it.id !== 'armor_bare'
                );
                const ownedInCat = collectibleItems.filter((it) => ownedSet.has(it.id)).length;
                return (
                  <button
                    key={slot.cat}
                    type="button"
                    onClick={() => setRightCategory(slot.cat)}
                    className={`relative py-1.5 px-2 xl:py-1.5 xl:px-2.5 rounded-lg xl:rounded-r-none xl:rounded-l-xl text-[11px] font-extrabold border-2 cursor-pointer transition whitespace-nowrap flex items-center gap-1.5 shadow-md shrink-0 ${
                      isSelected
                        ? 'rpg-btn-gold'
                        : 'bg-slate-900/95 text-amber-100 border-amber-700 hover:border-amber-400'
                    }`}
                  >
                    <span className="text-sm leading-none">{equippedIcon}</span>
                    <span>{slot.label}</span>
                    <span className="text-[10px] opacity-80">({ownedInCat})</span>
                    {isEquipped && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                    {slotDyeHex && (
                      <span
                        title={`ย้อมสี ${slotDyeHex}`}
                        style={{ backgroundColor: slotDyeHex }}
                        className="w-2 h-2 rounded-full border border-white shrink-0"
                      />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setRightCategory('gacha')}
                className={`py-1.5 px-2 xl:py-2 xl:px-2.5 rounded-lg xl:rounded-r-none xl:rounded-l-xl text-[11px] font-extrabold border-2 cursor-pointer transition whitespace-nowrap flex items-center gap-1.5 shadow-md shrink-0 ${
                  rightCategory === 'gacha'
                    ? 'bg-gradient-to-r from-pink-500 via-amber-400 to-cyan-400 text-black border-white shadow-[0_0_12px_rgba(244,114,182,0.7)]'
                    : 'bg-gradient-to-r from-purple-900 via-fuchsia-900 to-pink-900 text-yellow-200 border-pink-400/80 hover:border-yellow-300'
                }`}
              >
                <span>🎰</span>
                <span>กาชา ({gachaOwnedCount})</span>
              </button>
            </div>

            {/* แถบเครื่องมือย่อ: หมวดปัจจุบัน + ติ๊กกรองเฉพาะที่มีแล้ว + ปุ่มถอดหมด */}
            <div className="flex items-center justify-between gap-1 shrink-0">
              <span className="text-[10.5px] font-extrabold text-amber-200 px-2 py-1 rounded-lg bg-slate-950/70 border border-amber-500/40 truncate">
                {rightCategory === 'gacha'
                  ? `🎰 กาชา (${gachaOwnedCount})`
                  : rightCategory === 'hat'
                  ? '🎩 หมวก/ผม'
                  : rightCategory === 'face'
                  ? '🕶️ แว่น/หน้า'
                  : rightCategory === 'armor'
                  ? '👕 เสื้อ/ชุด'
                  : rightCategory === 'weapon'
                  ? '⚔️ ของถือ'
                  : rightCategory === 'wings'
                  ? '🎒 เป้/ปีก'
                  : rightCategory === 'aura'
                  ? '✨ ออร่า'
                  : rightCategory === 'pet'
                  ? '🐾 สัตว์เลี้ยง'
                  : rightCategory === 'mount'
                  ? '🐎 สัตว์ขี่ (30)'
                  : '📍 ป้ายจองลู่'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setOnlyOwnedFilter((v) => !v)}
                  className={`py-1 px-2 rounded-lg border text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer transition shrink-0 ${
                    onlyOwnedFilter
                      ? 'bg-emerald-500 text-black border-white shadow-[0_0_8px_rgba(16,185,129,0.55)]'
                      : 'bg-slate-900/90 text-emerald-200 border-emerald-500/50 hover:border-emerald-300'
                  }`}
                  title="ติ๊กเพื่อแสดงเฉพาะไอเทมที่ซื้อหรือปลดล็อกมาแล้วในหมวดนี้"
                >
                  <span>{onlyOwnedFilter ? '☑️' : '☐'}</span>
                  <span>มีแล้ว ({ownedCountInCurrentCat})</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="py-1 px-2 rounded-lg bg-slate-900/90 hover:bg-rose-950/80 border border-amber-400/50 hover:border-rose-400 text-amber-200 hover:text-rose-200 text-[10.5px] font-extrabold flex items-center gap-1 cursor-pointer transition shrink-0"
                  title="ถอดชุด หมวก แว่น ของถือ กระเป๋า ออร่า สัตว์เลี้ยง และสัตว์ขี่ออกทั้งหมด"
                >
                  <span>🔄</span>
                  <span>ถอดหมด</span>
                </button>
              </div>
            </div>

            {/* 🎨 สตูดิโอย้อมสีพรอพ & เสื้อกางเกง (Prop & Outfit Dye Bar — ซ่อนเมื่อไม่สวมใส่ และยุบเหลือ 1 แถว) */}
            {rightCategory !== 'gacha' && rightCategory !== 'marker' && (() => {
              const effectiveCategoryItemId =
                rightCategory === 'hat'
                  ? effectiveHat
                  : rightCategory === 'face'
                  ? effectiveFace
                  : rightCategory === 'armor'
                  ? effectiveArmor
                  : rightCategory === 'weapon'
                  ? effectiveWeapon
                  : rightCategory === 'wings'
                  ? effectiveWings
                  : rightCategory === 'aura'
                  ? effectiveAura
                  : rightCategory === 'pet'
                  ? effectivePet
                  : effectiveMount;
              if (
                rightCategory !== 'armor' &&
                (!effectiveCategoryItemId ||
                  effectiveCategoryItemId === 'none' ||
                  effectiveCategoryItemId.endsWith('_none'))
              ) {
                return null;
              }
              const activePropKey: PropColorKey =
                rightCategory === 'armor' ? armorColorPart : (rightCategory as PropColorKey);
              const activeSlotObj =
                rightCategory === 'hat'
                  ? hatObj
                  : rightCategory === 'face'
                  ? faceObj
                  : rightCategory === 'armor'
                  ? armorObj
                  : rightCategory === 'weapon'
                  ? weaponObj
                  : rightCategory === 'wings'
                  ? wingsObj
                  : rightCategory === 'aura'
                  ? auraObj
                  : rightCategory === 'pet'
                  ? petObj
                  : mountObj;
              const fallbackItemHex =
                activeSlotObj && activeSlotObj.colorHex > 0
                  ? `#${(rightCategory === 'armor' && armorColorPart === 'pants'
                      ? activeSlotObj.accentHex || activeSlotObj.colorHex
                      : activeSlotObj.colorHex
                    )
                      .toString(16)
                      .padStart(6, '0')
                      .toUpperCase()}`
                  : '#38BDF8';
              const currentCustomHex = joinPropColors[activePropKey];
              const displayHex = currentCustomHex || fallbackItemHex;
              const propHsl = hexToHsl(displayHex);

              const slotDyeLabelMap: Record<Exclude<ShopCategory, 'marker'>, string> = {
                hat: 'หมวก/เครื่องหัว',
                face: 'แว่น/หน้ากาก',
                armor: 'เสื้อ & กางเกง',
                weapon: 'ของถือเล่น',
                wings: 'กระเป๋า/ปีกหลัง',
                aura: 'ออร่า',
                pet: 'สัตว์เลี้ยง',
                mount: 'สัตว์ขี่',
              };

              const applyPropColor = (hex: string) => {
                const cleanHex = hex.toUpperCase();
                if (rightCategory === 'armor' && effectiveArmor === 'armor_bare') {
                  setJoinEquipArmor('armor_none');
                }
                setJoinPropColors((prev) => ({
                  ...prev,
                  [activePropKey]: cleanHex,
                }));
              };

              const resetSinglePropColor = () => {
                setJoinPropColors((prev) => {
                  const next = { ...prev };
                  delete next[activePropKey];
                  return next;
                });
              };

              return (
                <div className="bg-black/35 border border-amber-500/40 rounded-xl p-2 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    {rightCategory === 'armor' ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setArmorColorPart('shirt')}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                            armorColorPart === 'shirt'
                              ? 'bg-amber-400 text-black border-amber-100'
                              : 'bg-slate-900 text-amber-200 border-slate-700'
                          }`}
                        >
                          👕 สีเสื้อ
                        </button>
                        <button
                          type="button"
                          onClick={() => setArmorColorPart('pants')}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${
                            armorColorPart === 'pants'
                              ? 'bg-amber-400 text-black border-amber-100'
                              : 'bg-slate-900 text-amber-200 border-slate-700'
                          }`}
                        >
                          👖 สีกางเกง/กระโปรง
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10.5px] font-extrabold text-amber-200 truncate">
                        🎨 ย้อมสี{slotDyeLabelMap[rightCategory]}
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {currentCustomHex && (
                        <button
                          type="button"
                          onClick={resetSinglePropColor}
                          title="คืนค่าสีดั้งเดิมของพรอพชิ้นนี้"
                          className="px-1.5 py-0.5 rounded bg-rose-950/90 hover:bg-rose-700 text-rose-200 border border-rose-400/60 text-[9.5px] font-extrabold cursor-pointer transition"
                        >
                          ↺ สีเดิม
                        </button>
                      )}
                      <label
                        title="คลิกเลือกสีพรอพได้ทุกเฉด (RGB / Eyedropper)"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900 border border-amber-400/80 cursor-pointer hover:brightness-110"
                      >
                        <input
                          type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(displayHex) ? displayHex : '#38BDF8'}
                          onChange={(e) => applyPropColor(e.target.value)}
                          className="w-3.5 h-3.5 rounded border-0 p-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-[9.5px] font-mono font-extrabold text-amber-200">
                          {currentCustomHex || 'ต้นฉบับ'}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPropFineSliders((v) => !v)}
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-600 cursor-pointer"
                        title="พับ/กางจานสีและแถบไล่โทนสีพรอพ"
                      >
                        {showPropFineSliders ? 'จานสี ▾' : 'จานสี ▸'}
                      </button>
                    </div>
                  </div>

                  {showPropFineSliders && (
                    <div className="space-y-1.5 pt-0.5">
                      {/* ปุ่มกดย้อมสีด่วน 10 เฉดยอดฮิต */}
                      <div className="flex items-center justify-between">
                        {[
                          '#F8FAFC',
                          '#FACC15',
                          '#FB923C',
                          '#EF4444',
                          '#F472B6',
                          '#C084FC',
                          '#38BDF8',
                          '#34D399',
                          '#92400E',
                          '#18181B',
                        ].map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => applyPropColor(hex)}
                            style={{ backgroundColor: hex }}
                            title={`ย้อมสี ${hex}`}
                            className={`w-4 h-4 rounded-full border cursor-pointer transition ${
                              currentCustomHex === hex
                                ? 'border-amber-300 scale-125 ring-1 ring-amber-300'
                                : 'border-black/80 hover:scale-110'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-300 w-9 shrink-0">โทนสี</span>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={propHsl.h}
                          onChange={(e) =>
                            applyPropColor(
                              hslToHex(
                                Number(e.target.value),
                                Math.max(45, propHsl.s),
                                Math.min(86, Math.max(22, propHsl.l))
                              )
                            )
                          }
                          className="w-full h-2 rounded-full appearance-none cursor-pointer border border-black/60"
                          style={{
                            background:
                              'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-300 w-9 shrink-0">อ่อน-เข้ม</span>
                        <input
                          type="range"
                          min={14}
                          max={95}
                          value={propHsl.l}
                          onChange={(e) =>
                            applyPropColor(hslToHex(propHsl.h, Math.max(20, propHsl.s), Number(e.target.value)))
                          }
                          className="w-full h-2 rounded-full appearance-none cursor-pointer border border-black/60"
                          style={{
                            background: `linear-gradient(90deg, #111827 0%, hsl(${propHsl.h}, ${Math.max(55, propHsl.s)}%, 50%) 50%, #ffffff 100%)`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {activePreviewItems.length > 0 && (
              <div className="bg-sky-500/20 border border-sky-300 text-sky-100 rounded-xl px-2.5 py-1.5 text-[10.5px] font-extrabold flex items-center justify-between gap-2">
                <span className="truncate">
                  👀 ลองพรีวิวอยู่: {activePreviewItems.map((p) => `${p.icon} ${p.name}`).join(', ')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearAllPreviewOverrides();
                    setShopMsg('ถอดไอเทมพรีวิวออกทั้งหมดแล้ว');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-rose-600 text-white shrink-0 cursor-pointer hover:bg-rose-500"
                >
                  ✕ ล้างพรีวิว
                </button>
              </div>
            )}

            {shopMsg && (
              <div className="bg-slate-950/90 border border-amber-400 text-amber-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-center shadow">
                {shopMsg}
              </div>
            )}

            {rightCategory === 'gacha' ? (
              <div className="space-y-2 overflow-y-auto pr-1 flex-1">
                {/* ตู้หมุนGacha */}
                <div className="rounded-2xl border-2 border-pink-400/80 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 p-3 text-center space-y-2 shadow-lg">
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span className="text-pink-300">✨ ลิมิเต็ดเฉพาะตู้กาชา</span>
                    <span className="px-2 py-0.5 rounded-full bg-black/50 border border-amber-400/60 text-amber-300">
                      มีแล้ว {gachaOwnedCount} ชิ้น
                    </span>
                  </div>

                  {lastWonGachaItem && !gachaSpinning && (
                    <div className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-yellow-300 text-xs font-extrabold text-yellow-200">
                      🎉 ล่าสุดได้รับ: {lastWonGachaItem.icon} {lastWonGachaItem.name}!
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/25 text-yellow-300 border border-yellow-400/50">
                      🌈 Legendary 12%
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-400/50">
                      💜 Epic 33%
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-200 border border-sky-400/50">
                      🌟 Rare 55%
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-300 font-bold">
                    🔁 ออกซ้ำคืนแต้มทันที! (Rare +{GACHA_DUPLICATE_REFUND.rare} / Epic +{GACHA_DUPLICATE_REFUND.epic} / Legend +{GACHA_DUPLICATE_REFUND.legendary} 💰)
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={gachaSpinning}
                      onClick={() => handleGachaSpinClick(1)}
                      className="py-2 px-2 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-xs border-2 border-sky-200 bg-gradient-to-b from-sky-400 to-indigo-600 text-white shadow-[0_3px_0_#000] hover:brightness-110 cursor-pointer transition disabled:opacity-50"
                    >
                      <div>🎰 อัญเชิญ ×1</div>
                      <div className="text-[10px] text-amber-200">{GACHA_SPIN_COST.toLocaleString()} 💰</div>
                    </button>
                    <button
                      type="button"
                      disabled={gachaSpinning}
                      onClick={() => handleGachaSpinClick(8)}
                      className="relative py-2 px-2 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-xs border-2 border-yellow-100 bg-gradient-to-r from-amber-400 via-pink-400 to-cyan-300 text-slate-950 shadow-[0_3px_0_#000] hover:brightness-110 cursor-pointer transition disabled:opacity-50"
                    >
                      <span className="absolute -top-2 right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-extrabold border border-white shadow">
                        ลด 160!
                      </span>
                      <div>🌟 อัญเชิญ ×{GACHA_MULTI_COUNT}</div>
                      <div className="text-[10px] text-slate-900 font-black">
                        {GACHA_MULTI_COST.toLocaleString()} 💰
                      </div>
                    </button>
                  </div>
                </div>

                {/* รายการของรางวัลลิมิเต็ดในตู้Gachaทั้งหมด (กดลองใส่พรีวิวได้ทุกชิ้น!) */}
                <div className="text-[11px] font-extrabold text-amber-200 px-1">
                  🎁 รายการไอเทมในตู้ ({onlyOwnedFilter ? `มีแล้ว ${displayedCategoryItems.length} ชิ้น` : 'กด 👀 ลองใส่พรีวิวได้!'}):
                </div>
                {displayedCategoryItems.length === 0 ? (
                  <div className="rounded-xl bg-slate-950/75 border border-amber-500/40 p-4 text-center text-xs font-bold text-amber-100/75">
                    ยังไม่มีไอเทมจากตู้Gacha ลองหมุนด้านบนหรือเอาติ๊ก &quot;มีแล้ว&quot; ออกเพื่อดูของทั้งหมดครับ!
                  </div>
                ) : displayedCategoryItems.map((item) => {
                  const isOwned = ownedSet.has(item.id);
                  const isPreviewing = previewOverrides[item.category] === item.id;
                  const isEquipped =
                    !isPreviewing &&
                    ((item.category === 'hat' && joinEquipHat === item.id) ||
                      (item.category === 'face' && joinEquipFace === item.id) ||
                      (item.category === 'armor' && joinEquipArmor === item.id) ||
                      (item.category === 'weapon' && joinEquipWeapon === item.id) ||
                      (item.category === 'wings' && joinEquipWings === item.id) ||
                      (item.category === 'aura' && joinEquipAura === item.id) ||
                      (item.category === 'mount' && joinEquipMount === item.id));
                  const rarityBadge =
                    item.rarity === 'legendary'
                      ? 'bg-gradient-to-r from-amber-400 to-pink-500 text-black'
                      : item.rarity === 'epic'
                      ? 'bg-purple-500 text-white'
                      : 'bg-sky-500 text-black';
                  const rarityLabel =
                    item.rarity === 'legendary' ? '🌈 LEGENDARY' : item.rarity === 'epic' ? '💜 EPIC' : '🌟 RARE';

                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-xl border-2 flex items-center justify-between gap-2 transition ${
                        isPreviewing
                          ? 'bg-sky-950/90 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                          : isOwned
                          ? 'bg-slate-900/90 border-amber-400/70'
                          : 'bg-slate-950/75 border-slate-700/80 hover:border-sky-400'
                      }`}
                    >
                      <div
                        onClick={() => (isOwned ? handleItemAction(item) : handleTogglePreview(item))}
                        className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                      >
                        <div className="w-10 h-10 rounded-xl shrink-0 bg-slate-950 border border-pink-400/50 flex items-center justify-center text-xl">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${rarityBadge}`}>
                              {rarityLabel}
                            </span>
                            <span className="text-xs font-extrabold text-amber-100 truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">{item.desc}</div>
                        </div>
                      </div>

                      {isOwned ? (
                        <button
                          type="button"
                          onClick={() => handleItemAction(item)}
                          className={`px-2 py-1 rounded-xl text-[11px] font-extrabold shrink-0 cursor-pointer ${
                            isEquipped ? 'bg-emerald-500 text-black border border-white' : 'rpg-btn-gold'
                          }`}
                        >
                          {isEquipped ? '✓ ใส่อยู่' : 'สวมใส่'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(item)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold shrink-0 cursor-pointer border transition ${
                            isPreviewing
                              ? 'bg-sky-400 text-black border-white'
                              : 'bg-slate-800 hover:bg-sky-600 text-sky-200 hover:text-white border-sky-400/60'
                          }`}
                        >
                          {isPreviewing ? '👁️ ถอดพรีวิว' : '👀 ลองใส่'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1 flex-1 content-start">
              {displayedCategoryItems.map((item) => {
                const isOwned = ownedSet.has(item.id);
                const isPreviewing = previewOverrides[item.category] === item.id;
                const isEquipped =
                  !isPreviewing &&
                  ((item.category === 'hat' && joinEquipHat === item.id) ||
                    (item.category === 'face' && joinEquipFace === item.id) ||
                    (item.category === 'armor' && joinEquipArmor === item.id) ||
                    (item.category === 'weapon' && joinEquipWeapon === item.id) ||
                    (item.category === 'wings' && joinEquipWings === item.id) ||
                    (item.category === 'aura' && joinEquipAura === item.id) ||
                    (item.category === 'pet' && joinEquipPetGear === item.id) ||
                    (item.category === 'mount' && joinEquipMount === item.id) ||
                    (item.category === 'marker' && joinEquipMarker === item.id));
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-xl flex flex-col justify-between gap-1.5 transition ${
                      isPreviewing
                        ? 'border-2 bg-sky-950/85 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.45)]'
                        : isEquipped
                        ? 'rpg-hero-row-active'
                        : item.isGachaOnly
                        ? 'border-2 bg-purple-950/60 border-pink-500/50 hover:border-yellow-300'
                        : 'rpg-hero-row'
                    }`}
                  >
                    <div
                      onClick={() => (isOwned ? handleItemAction(item) : handleTogglePreview(item))}
                      className="flex items-center gap-2 min-w-0 cursor-pointer"
                      title={isOwned ? 'คลิกเพื่อสวมใส่' : 'คลิกเพื่อลองสวมพรีวิว 3D'}
                    >
                      <div className="w-9 h-9 rounded-xl shrink-0 bg-slate-950/80 border border-amber-500/40 flex items-center justify-center text-lg shadow">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-extrabold text-amber-100 leading-tight line-clamp-2">
                          {item.isGachaOnly ? `🎰 ${item.name}` : item.name}
                        </div>
                      </div>
                    </div>

                    {isOwned ? (
                      <button
                        type="button"
                        disabled={shopBusyId === item.id}
                        onClick={() => handleItemAction(item)}
                        className={`w-full py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition ${
                          isEquipped
                            ? 'bg-emerald-500 text-black border border-white'
                            : 'rpg-btn-gold'
                        }`}
                      >
                        {isEquipped ? '✓ ใส่อยู่' : 'สวมใส่'}
                      </button>
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(item)}
                          className={`py-1 rounded-lg text-[10px] font-extrabold cursor-pointer border transition ${
                            isPreviewing
                              ? 'bg-sky-400 text-black border-white'
                              : 'bg-slate-800 hover:bg-sky-600 text-sky-200 hover:text-white border-sky-400/60'
                          }`}
                          title="ลองสวมใส่ดูบนตัวละคร 3D ฟรี"
                        >
                          {isPreviewing ? '👁️ ถอด' : '👀 ลองใส่'}
                        </button>
                        <button
                          type="button"
                          disabled={shopBusyId === item.id}
                          onClick={() => handleItemAction(item)}
                          className={`py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition ${
                            item.isGachaOnly
                              ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border border-pink-200'
                              : 'rpg-btn-blue'
                          }`}
                        >
                          {shopBusyId === item.id
                            ? '...'
                            : item.isGachaOnly
                            ? '🎰 ตู้สุ่ม'
                            : `🔓 ${item.cost}💰`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full rpg-btn-blue font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base py-3 rounded-2xl cursor-pointer"
            >
              {mode === 'edit' ? '🚀 บันทึกชุด & ลงสนามแข่ง!' : '🚀 อัญเชิญลงสนามแข่ง!'}
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION & GOAL SETUP SUB-MODAL (Moved from under character's feet) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="rpg-stone-frame rounded-2xl max-w-md w-full p-5 relative space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl border-2 border-amber-300 bg-slate-900/90 flex items-center justify-center overflow-hidden shrink-0">
                  <ChibiHeroBustSvg
                    species={{ ...activeBreedMeta, colorHex: joinColor }}
                    outfitHex={joinBandColor}
                    accentHex="#fde047"
                  />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-kanit)] text-lg font-extrabold text-amber-300">
                    ตั้งชื่อ &amp; ลงทะเบียนแข่ง Step Challenge
                  </h3>
                  <p className="text-[11px] text-amber-100/80">
                    ทุกคนลงสนามแข่งสะสมก้าวเดินประจำเดือน • เลือกทำภารกิจเสริมเพื่อรับแต้มโบนัสเพิ่มได้!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 bg-rose-600 text-white rounded-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="rounded-xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 border-2 border-amber-400/80 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-200">
                  👟 ภารกิจหลัก: Step Challenge (สะสมก้าวเดินรายซีซั่น)
                </span>
                <span className="text-[10px] font-extrabold bg-amber-400 text-black px-2 py-0.5 rounded-full shrink-0">
                  เข้าร่วมทุกคน
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-amber-200 mb-1">
                    ชื่อตัวละคร
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="เช่น สโนว์ไวท์"
                    className="w-full bg-slate-950 text-white placeholder:text-slate-400 border-2 border-amber-500/80 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-amber-200 mb-1">
                    💬 คำพูดบนหัว
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={joinStatus}
                    onChange={(e) => setJoinStatus(e.target.value)}
                    placeholder="เช่น สู้ตายเพื่อชาบู!"
                    className="w-full bg-slate-950 text-white placeholder:text-slate-400 border-2 border-amber-500/80 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              </div>

              {true ? (
                <div className="space-y-2.5">
                  {/* Synced Personal BMI Section (Compact 1-line summary if already filled, auto-expand if missing) */}
                  {(() => {
                    const isEditingOther = mode === 'edit' && editingPlayerId !== currentUserId;
                    const showInputs = showConfirmBmiEdit || (!isEditingOther && !bmiMeta.isValid);
                    return (
                      <div className="rounded-xl bg-slate-950/80 border border-amber-500/50 px-2.5 py-2 space-y-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className="text-[11px] font-extrabold text-amber-200 truncate"
                            title="ซ่อนตัวเลขน้ำหนัก/ส่วนสูง/BMI จากสาธารณะทั้งหมด"
                          >
                            {showInputs
                              ? '⚖️ ข้อมูลส่วนตัวคำนวณหุ่น BMI 🔒'
                              : isEditingOther
                              ? '⚖️ หุ่น BMI: คงค่าเดิม 🔒'
                              : `⚖️ ${joinGender === 'male' ? '👨 ชาย' : '👩 หญิง'} • ${joinBodyWeight} กก. / ${joinHeightCm} ซม. 🔒`}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {bmiMeta.isValid && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${bmiMeta.badgeClass}`}
                              >
                                BMI {bmiMeta.bmi}
                              </span>
                            )}
                            {(!showInputs || bmiMeta.isValid || isEditingOther) && (
                              <button
                                type="button"
                                onClick={() => setShowConfirmBmiEdit((v) => !v)}
                                className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-400/60 text-amber-200 text-[10px] font-extrabold cursor-pointer transition"
                              >
                                {showInputs ? 'ซ่อน' : 'แก้ไข'}
                              </button>
                            )}
                          </div>
                        </div>

                        {showInputs && (
                          <div className="grid grid-cols-12 gap-1.5">
                            <div className="col-span-4">
                              <label className="block text-[10px] font-bold text-amber-100/80 mb-0.5">
                                เพศ
                              </label>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setJoinGender('female')}
                                  className={`py-1.5 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                                    joinGender === 'female'
                                      ? 'bg-pink-500 text-white border-amber-200'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  👩 หญิง
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setJoinGender('male')}
                                  className={`py-1.5 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                                    joinGender === 'male'
                                      ? 'bg-sky-500 text-white border-amber-200'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  👨 ชาย
                                </button>
                              </div>
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[10px] font-bold text-amber-100/80 mb-0.5">
                                น้ำหนักจริง (กก.)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="16"
                                max="300"
                                required={!isEditingOther}
                                value={joinBodyWeight}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setJoinBodyWeight(val);
                                  if (!goalMeta.isCumulative && mode === 'create') {
                                    setJoinStart(val);
                                  }
                                }}
                                placeholder={isEditingOther ? 'คงค่าเดิม' : ''}
                                className="w-full bg-slate-900 text-white placeholder:text-slate-500 border border-amber-500/70 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="block text-[10px] font-bold text-amber-100/80 mb-0.5">
                                ส่วนสูง (ซม.)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="80"
                                max="250"
                                required={!isEditingOther}
                                value={joinHeightCm}
                                onChange={(e) => setJoinHeightCm(e.target.value)}
                                placeholder={isEditingOther ? 'คงค่าเดิม' : ''}
                                className="w-full bg-slate-900 text-sky-200 placeholder:text-slate-500 border border-amber-500/70 rounded-lg px-2 py-1.5 text-xs font-bold text-center"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="rounded-xl bg-slate-950/65 border border-amber-500/40 p-2.5 space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-200 mb-1">
                        🎯 ภารกิจเสริมรับโบนัสเพิ่ม (Side Quest • ไม่บังคับ)
                      </label>
                      <select
                        value={joinGoalType}
                        onChange={(e) => setJoinGoalType(e.target.value as GoalType)}
                        className="w-full bg-slate-950 text-amber-200 border-2 border-amber-500 rounded-xl px-2.5 py-2 text-xs font-extrabold cursor-pointer"
                      >
                        {GOAL_TYPES.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.icon} {g.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-amber-100/75 mt-1">{goalMeta.description}</p>
                    </div>

                    {joinGoalType !== 'none' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {!goalMeta.isCumulative && (
                          <div>
                            <label className="block text-[10px] font-bold text-amber-200 mb-0.5">
                              ค่าเริ่มต้นภารกิจเสริม ({goalMeta.unit})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={joinStart}
                              onChange={(e) => {
                                const val = e.target.value;
                                setJoinStart(val);
                                if (mode === 'create' && val) {
                                  setJoinBodyWeight(val);
                                }
                              }}
                              placeholder="เว้นว่างได้"
                              className="w-full bg-slate-950 text-white placeholder:text-slate-500 border-2 border-amber-500/70 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                            />
                          </div>
                        )}
                        <div className={goalMeta.isCumulative ? 'col-span-2' : ''}>
                          <label className="block text-[10px] font-bold text-amber-200 mb-0.5">
                            เป้าหมายภารกิจเสริม ({goalMeta.unit})
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={joinGoal}
                            onChange={(e) => setJoinGoal(e.target.value)}
                            placeholder={goalMeta.isCumulative ? 'เช่น 1000 (เว้นว่างได้)' : 'เช่น 58.0 (เว้นว่างได้)'}
                            className="w-full bg-slate-950 text-emerald-300 placeholder:text-slate-500 border-2 border-amber-500/70 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-950/70 border border-slate-600 px-3 py-2 text-[11px] font-bold text-slate-200">
                        👟 ไม่เลือกภารกิจเสริม — ลงแข่ง Step Challenge หลักอย่างเดียว (กลับมาเลือกเพิ่มทีหลังได้ตลอดเวลา!)
                      </div>
                    )}
                  </div>

                  {bmiMeta.isValid && (joinGoalType === 'weight_loss' || joinGoalType === 'weight_gain') && (
                    <div className="flex items-center justify-between gap-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-[10px] text-emerald-200">
                      <span>
                        💡 เกณฑ์สมส่วนตามส่วนสูง: {bmiMeta.healthyMinKg}–{bmiMeta.healthyMaxKg} กก.
                      </span>
                      <button
                        type="button"
                        onClick={() => setJoinGoal(String(bmiMeta.recommendedTargetKg))}
                        className="px-2 py-0.5 rounded-lg bg-emerald-400 text-black font-extrabold cursor-pointer hover:brightness-110 shrink-0"
                      >
                        ใช้เป้าแนะนำ {bmiMeta.recommendedTargetKg} กก.
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {mode === 'edit' && editingPlayerId !== currentUserId && (
                <div>
                  <label className="block text-[11px] font-bold text-amber-200 mb-1">
                    รหัส PIN 4 หลักของตัวละครนี้
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    value={joinPin}
                    onChange={(e) => setJoinPin(e.target.value)}
                    className="w-full bg-slate-950 text-white border-2 border-amber-500 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              )}

              {joinError && (
                <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-2xl cursor-pointer"
              >
                {joining
                  ? 'กำลังบันทึก...'
                  : mode === 'edit'
                  ? '✨ ยืนยันบันทึก & ลงสนาม!'
                  : '🚀 ยืนยันอัญเชิญลงสนามแข่ง!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✨ NI NO KUNI–INSPIRED CINEMATIC GACHA SUMMON & 8x MULTI-REVEAL OVERLAY */}
      {gachaStage && (() => {
        const hasLeg = gachaOverlayResults.some((r) => r.item.rarity === 'legendary');
        const hasEpic = gachaOverlayResults.some((r) => r.item.rarity === 'epic');
        const totalRefund = gachaOverlayResults.reduce((sum, r) => sum + (r.refundPoints || 0), 0);
        const topRarity = hasLeg ? 'legendary' : hasEpic ? 'epic' : 'rare';
        const isLeg = topRarity === 'legendary';
        const isEpic = topRarity === 'epic';

        const raysBg =
          gachaStage === 'reveal' && isLeg
            ? 'repeating-conic-gradient(from 0deg, rgba(250,204,21,0.38) 0deg 10deg, rgba(244,114,182,0.22) 10deg 20deg, rgba(56,189,248,0.22) 20deg 30deg)'
            : gachaStage === 'reveal' && isEpic
            ? 'repeating-conic-gradient(from 0deg, rgba(192,132,252,0.34) 0deg 14deg, rgba(244,114,182,0.14) 14deg 28deg)'
            : 'repeating-conic-gradient(from 0deg, rgba(56,189,248,0.28) 0deg 16deg, rgba(255,255,255,0.06) 16deg 32deg)';

        const orbCount = gachaPullCount === 8 ? 8 : 1;

        return (
          <div
            className={`fixed inset-0 z-[80] flex flex-col items-center justify-center p-3 sm:p-5 overflow-y-auto overflow-x-hidden transition-colors duration-500 ${
              gachaStage === 'fakeout'
                ? 'bg-[radial-gradient(ellipse_at_center,_#581c87_0%,_#1e1b4b_48%,_#020617_100%)]'
                : gachaStage === 'reveal' && isLeg
                ? 'bg-[radial-gradient(ellipse_at_center,_#451a03_0%,_#3b0764_48%,_#020617_100%)]'
                : gachaStage === 'reveal' && isEpic
                ? 'bg-[radial-gradient(ellipse_at_center,_#3b0764_0%,_#1e1b4b_52%,_#020617_100%)]'
                : 'bg-[radial-gradient(ellipse_at_center,_#0c4a6e_0%,_#0f172a_52%,_#020617_100%)]'
            } backdrop-blur-md`}
          >
            {/* Starry Ni no Kuni Sky Backdrop */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
              {[
                { top: '8%', left: '12%', size: 4, delay: '0s' },
                { top: '16%', left: '78%', size: 5, delay: '0.4s' },
                { top: '28%', left: '22%', size: 3, delay: '0.8s' },
                { top: '22%', left: '62%', size: 4, delay: '1.1s' },
                { top: '72%', left: '15%', size: 5, delay: '0.2s' },
                { top: '80%', left: '84%', size: 4, delay: '0.7s' },
                { top: '65%', left: '72%', size: 3, delay: '1.3s' },
                { top: '42%', left: '8%', size: 4, delay: '0.5s' },
                { top: '38%', left: '90%', size: 5, delay: '0.9s' },
                { top: '88%', left: '38%', size: 3, delay: '0.3s' },
              ].map((st, idx) => (
                <span
                  key={idx}
                  className="absolute rounded-full bg-amber-200 animate-pulse shadow-[0_0_12px_rgba(253,224,71,0.95)]"
                  style={{
                    top: st.top,
                    left: st.left,
                    width: st.size,
                    height: st.size,
                    animationDelay: st.delay,
                  }}
                />
              ))}
            </div>

            {/* Rotating Sunburst Rays */}
            {(gachaStage === 'reveal' || gachaStage === 'fakeout') && (
              <div
                className="pointer-events-none fixed left-1/2 top-1/2 w-[1100px] h-[1100px] rounded-full gacha-rays-spin opacity-80"
                style={{ background: raysBg }}
              />
            )}

            {/* Supernova Flash on Reveal */}
            {gachaStage === 'reveal' && (
              <div
                key={`flash-${gachaRevealKey}`}
                className={`pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full nnk-flash-burst ${
                  isLeg
                    ? 'bg-gradient-to-r from-yellow-200 via-white to-pink-300'
                    : isEpic
                    ? 'bg-gradient-to-r from-fuchsia-300 via-white to-purple-300'
                    : 'bg-gradient-to-r from-sky-200 via-white to-cyan-200'
                }`}
              />
            )}

            {/* Top HUD: Points + Skip Button */}
            <div className="fixed top-4 inset-x-4 z-30 flex items-center justify-between max-w-5xl mx-auto pointer-events-none">
              <div className="pointer-events-auto px-3 py-1.5 rounded-full bg-slate-950/80 border border-amber-400/70 text-amber-200 text-xs sm:text-sm font-extrabold shadow-lg flex items-center gap-1.5">
                <span>💰</span>
                <span>แต้มคงเหลือ: {userPoints.toLocaleString()}</span>
                <span className="text-amber-300/70 text-[11px]">
                  (มีแล้ว {gachaOwnedCount} ชิ้น)
                </span>
              </div>
              {gachaStage !== 'reveal' && (
                <button
                  type="button"
                  onClick={() => {
                    gachaSkipRef.current = true;
                  }}
                  className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 border border-amber-300/80 text-amber-200 text-xs font-extrabold cursor-pointer shadow-lg transition"
                >
                  ข้าม ⏭
                </button>
              )}
            </div>

            {/* STAGE 1: NI NO KUNI MAGIC CIRCLE SUMMONING */}
            {gachaStage === 'charging' && (
              <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                  {/* Vertical Light Pillar */}
                  <div className="absolute bottom-1/2 w-24 h-72 bg-gradient-to-t from-sky-400/60 via-amber-200/30 to-transparent blur-xl nnk-beam-rise" />

                  {/* Outer Golden Magic Rune Circle (SVG) */}
                  <svg
                    viewBox="0 0 260 260"
                    className="absolute inset-0 w-full h-full nnk-rune-spin drop-shadow-[0_0_18px_rgba(250,204,21,0.85)]"
                  >
                    <circle cx="130" cy="130" r="120" fill="none" stroke="#fde047" strokeWidth="2.5" strokeDasharray="10 6" opacity="0.9" />
                    <circle cx="130" cy="130" r="106" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.85" />
                    <polygon
                      points="130,18 227,186 33,186"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="1.6"
                      opacity="0.7"
                    />
                    <polygon
                      points="130,242 33,74 227,74"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="1.6"
                      opacity="0.7"
                    />
                  </svg>

                  {/* Inner Counter-Rotating Rune Ring */}
                  <svg
                    viewBox="0 0 200 200"
                    className="absolute w-48 h-48 sm:w-52 sm:h-52 nnk-rune-spin-rev drop-shadow-[0_0_14px_rgba(56,189,248,0.9)]"
                  >
                    <circle cx="100" cy="100" r="88" fill="none" stroke="#e0f2fe" strokeWidth="2" strokeDasharray="4 8" />
                    <circle cx="100" cy="100" r="68" fill="none" stroke="#fbbf24" strokeWidth="1.8" />
                  </svg>

                  {/* Orbiting Summon Orbs (8 orbs for multi-pull) */}
                  {orbCount === 8 ? (
                    <div className="absolute inset-0 nnk-rune-spin-fast">
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const angle = (idx / 8) * Math.PI * 2;
                        const radius = 104;
                        const x = 50 + (Math.cos(angle) * radius) / 2.8;
                        const y = 50 + (Math.sin(angle) * radius) / 2.8;
                        const orbColor =
                          idx % 3 === 0
                            ? 'from-yellow-200 via-amber-400 to-orange-500 shadow-[0_0_20px_rgba(250,204,21,0.95)]'
                            : idx % 3 === 1
                            ? 'from-fuchsia-200 via-purple-400 to-indigo-600 shadow-[0_0_20px_rgba(192,132,252,0.95)]'
                            : 'from-cyan-100 via-sky-400 to-blue-600 shadow-[0_0_20px_rgba(56,189,248,0.95)]';
                        return (
                          <div
                            key={idx}
                            className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gradient-to-br ${orbColor} nnk-orb-pulse flex items-center justify-center text-xs`}
                            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${idx * 0.12}s` }}
                          >
                            ✦
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* Center Summoning Prism Core */}
                  <div className="relative w-28 h-28 rounded-full border-4 border-amber-200 bg-gradient-to-b from-cyan-200 via-sky-400 to-indigo-700 flex items-center justify-center shadow-[0_0_60px_rgba(56,189,248,0.95)] gacha-shake">
                    <div className="absolute -inset-4 rounded-full bg-amber-300/30 blur-xl animate-pulse" />
                    <span className="text-4xl drop-shadow z-10">{orbCount === 8 ? '🌟' : '✨'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-sky-200 drop-shadow animate-pulse">
                    {orbCount === 8 ? 'กำลังร่ายวงเวทย์อัญเชิญ ×8...' : 'กำลังร่ายวงเวทย์อัญเชิญ...'}
                  </div>
                  <div className="text-xs text-sky-200/80 font-bold">
                    ✨ รวมพลังดวงดาวสู่ประตูมิติ ✨
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: LEGENDARY FAKE-OUT GOLDEN BREAKTHROUGH */}
            {gachaStage === 'fakeout' && (
              <div className="relative z-10 flex flex-col items-center gap-5 text-center">
                <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 text-black font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base border-2 border-white shadow-[0_0_28px_rgba(250,204,21,1)] animate-bounce">
                  ⚡ ประตูมิติแตกออก! อัปเกรดเป็น LEGENDARY!! ⚡
                </div>
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <div className="absolute -inset-8 rounded-full bg-gradient-to-r from-yellow-400 via-pink-500 to-cyan-400 blur-3xl opacity-85 animate-pulse" />
                  <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full nnk-rune-spin-fast">
                    <circle cx="130" cy="130" r="118" fill="none" stroke="#fef08a" strokeWidth="3.5" strokeDasharray="14 6" />
                    <polygon points="130,14 230,190 30,190" fill="none" stroke="#f472b6" strokeWidth="2.5" />
                    <polygon points="130,246 30,70 230,70" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
                  </svg>
                  <div className="w-36 h-36 rounded-full border-4 border-white bg-gradient-to-tr from-amber-300 via-pink-500 to-cyan-300 flex items-center justify-center shadow-[0_0_80px_rgba(250,204,21,1)] gacha-mega-shake relative">
                    <span className="text-6xl drop-shadow">🌈</span>
                  </div>
                </div>
                <div className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-extrabold text-yellow-200 drop-shadow">
                  ✨ แสงทองสายรุ้งกำลังระเบิดออก!! ✨
                </div>
              </div>
            )}

            {/* STAGE 3: REVEAL (1 HERO CARD OR 2×4 NI NO KUNI MULTI-PULL GRID) */}
            {gachaStage === 'reveal' && gachaOverlayResults.length > 0 && (
              <div
                key={`reveal-${gachaRevealKey}`}
                className="relative z-20 w-full max-w-4xl flex flex-col items-center gap-4 pt-10 pb-4"
              >
                {/* Header Banner */}
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-slate-950/75 border border-amber-300/80 text-amber-200 text-xs sm:text-sm font-extrabold shadow-lg">
                    <span>{hasLeg ? '🌈' : hasEpic ? '💜' : '✨'}</span>
                    <span>
                      {gachaOverlayResults.length > 1
                        ? `ผลการอัญเชิญรัว ×${gachaOverlayResults.length} ชิ้น!`
                        : isLeg
                        ? 'LEGENDARY • แจ็กพอตระดับตำนาน!!'
                        : isEpic
                        ? 'EPIC • แรร์สุดอลังการ!'
                        : 'RARE • ลิมิเต็ดGacha!'}
                    </span>
                  </div>
                  {totalRefund > 0 && (
                    <div>
                      <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/80 text-amber-200 text-[11px] font-extrabold">
                        🔁 คืนแต้มจากของซ้ำรวม +{totalRefund.toLocaleString()} 💰
                      </span>
                    </div>
                  )}
                  {gachaOverlayResults.length > 1 && (
                    <p className="text-[11px] text-amber-100/80 font-semibold">
                      คลิกที่การ์ดใบใดก็ได้เพื่อสวมใส่ให้ตัวละครทันที!
                    </p>
                  )}
                </div>

                {/* Single Pull Hero Card */}
                {gachaOverlayResults.length === 1 ? (
                  (() => {
                    const roll = gachaOverlayResults[0];
                    const item = roll.item;
                    const itemLeg = item.rarity === 'legendary';
                    const itemEpic = item.rarity === 'epic';
                    const equippedNow = isItemCurrentlyEquipped(item);
                    return (
                      <div
                        className={`relative overflow-hidden max-w-sm w-full rounded-3xl p-6 text-center space-y-4 border-4 nnk-card-reveal ${
                          itemLeg
                            ? 'bg-gradient-to-b from-amber-950/95 via-rose-950/95 to-slate-950 border-yellow-300 shadow-[0_0_70px_rgba(250,204,21,0.9)] nnk-shimmer'
                            : itemEpic
                            ? 'bg-gradient-to-b from-purple-950/95 via-fuchsia-950/95 to-slate-950 border-fuchsia-300 shadow-[0_0_55px_rgba(192,132,252,0.85)] nnk-shimmer'
                            : 'bg-gradient-to-b from-sky-950/95 via-slate-900/95 to-slate-950 border-sky-300 shadow-[0_0_45px_rgba(56,189,248,0.8)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          {roll.isDuplicate ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black shadow">
                              🔁 ซ้ำ +{roll.refundPoints} 💰
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-black text-[10px] font-black shadow">
                              NEW!
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-amber-300">
                            {itemLeg ? '★★★★★' : itemEpic ? '★★★★' : '★★★'}
                          </span>
                        </div>
                        <div className="flex justify-center py-1">
                          <div
                            className={`w-28 h-28 rounded-3xl border-4 flex items-center justify-center text-6xl shadow-2xl ${
                              itemLeg
                                ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-pink-500 border-white animate-bounce'
                                : itemEpic
                                ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-fuchsia-200'
                                : 'bg-gradient-to-br from-sky-400 to-indigo-600 border-sky-200'
                            }`}
                          >
                            {item.icon}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-[family-name:var(--font-kanit)] text-2xl font-extrabold text-amber-200 drop-shadow">
                            {item.name}
                          </h4>
                          <p className="text-xs text-amber-100/85 font-medium mt-1">{item.desc}</p>
                        </div>
                        <div className="text-[11px] font-extrabold text-emerald-300">
                          {roll.isDuplicate
                            ? `🔁 มีชิ้นนี้อยู่แล้ว — คืนแต้มให้ +${roll.refundPoints} 💰 ทันที!`
                            : equippedNow
                            ? '✓ สวมใส่ให้ตัวละครแล้ว!'
                            : 'เก็บเข้าตู้เสื้อผ้าแล้ว'}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Multi-Pull 2×4 Ni no Kuni Card Grid */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full">
                    {gachaOverlayResults.map((roll, idx) => {
                      const item = roll.item;
                      const itemLeg = item.rarity === 'legendary';
                      const itemEpic = item.rarity === 'epic';
                      const equippedNow = isItemCurrentlyEquipped(item);
                      return (
                        <button
                          key={`${item.id}-${idx}`}
                          type="button"
                          onClick={() => equipWonItemLocally(item)}
                          style={{ animationDelay: `${idx * 95}ms` }}
                          className={`group relative overflow-hidden rounded-2xl p-3 text-center flex flex-col items-center justify-between gap-2 border-2 cursor-pointer transition hover:scale-[1.04] nnk-card-reveal ${
                            itemLeg
                              ? 'bg-gradient-to-b from-amber-900/95 via-rose-950/95 to-slate-950 border-yellow-300 shadow-[0_0_28px_rgba(250,204,21,0.75)] nnk-shimmer'
                              : itemEpic
                              ? 'bg-gradient-to-b from-purple-900/95 via-fuchsia-950/95 to-slate-950 border-fuchsia-300 shadow-[0_0_22px_rgba(192,132,252,0.65)] nnk-shimmer'
                              : 'bg-gradient-to-b from-sky-950/95 via-slate-900/95 to-slate-950 border-sky-400/80 shadow-[0_0_16px_rgba(56,189,248,0.45)]'
                          }`}
                        >
                          {/* Top Badges */}
                          <div className="w-full flex items-center justify-between gap-1">
                            {roll.isDuplicate ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-black leading-none">
                                ซ้ำ +{roll.refundPoints}💰
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-black text-[9px] font-black leading-none">
                                NEW
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-black leading-none ${
                                itemLeg ? 'text-yellow-300' : itemEpic ? 'text-fuchsia-300' : 'text-sky-300'
                              }`}
                            >
                              {itemLeg ? '★★★★★' : itemEpic ? '★★★★' : '★★★'}
                            </span>
                          </div>

                          {/* Item Orb / Icon */}
                          <div
                            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl sm:text-4xl shadow-xl transition group-hover:scale-110 ${
                              itemLeg
                                ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-pink-500 border-white'
                                : itemEpic
                                ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-fuchsia-200'
                                : 'bg-gradient-to-br from-sky-400 to-indigo-600 border-sky-200'
                            }`}
                          >
                            {item.icon}
                          </div>

                          {/* Item Name & Equip Status */}
                          <div className="w-full space-y-1">
                            <div className="font-[family-name:var(--font-kanit)] text-xs sm:text-[13px] font-extrabold text-amber-100 leading-tight line-clamp-2 min-h-[2rem] flex items-center justify-center">
                              {item.name}
                            </div>
                            <div
                              className={`w-full py-0.5 rounded-lg text-[9.5px] font-extrabold ${
                                equippedNow
                                  ? 'bg-emerald-500 text-black'
                                  : itemLeg
                                  ? 'bg-amber-400/25 text-yellow-200 border border-yellow-300/60'
                                  : itemEpic
                                  ? 'bg-purple-500/25 text-fuchsia-200 border border-fuchsia-300/50'
                                  : 'bg-sky-500/20 text-sky-200 border border-sky-300/40'
                              }`}
                            >
                              {equippedNow ? '✓ ใส่อยู่' : 'แตะเพื่อใส่'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Bottom Action Bar: Close + Summon ×1 Again + Summon ×8 Again */}
                <div className="w-full max-w-2xl flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setGachaStage(null)}
                    className="px-5 py-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-amber-100 border-2 border-slate-500 font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm cursor-pointer shadow-lg transition"
                  >
                    ✓ รับของ &amp; ปิด
                  </button>

                  <button
                    type="button"
                    disabled={gachaSpinning || userPoints < GACHA_SPIN_COST}
                    onClick={() => handleGachaSpinClick(1)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-b from-sky-400 to-indigo-600 text-white border-2 border-sky-200 font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm cursor-pointer shadow-[0_4px_0_#000] hover:brightness-110 transition disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    🎰 สุ่มต่อ ×1 ({GACHA_SPIN_COST.toLocaleString()} 💰)
                  </button>

                  <button
                    type="button"
                    disabled={gachaSpinning || userPoints < GACHA_MULTI_COST}
                    onClick={() => handleGachaSpinClick(8)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm cursor-pointer shadow-[0_4px_0_#000] hover:brightness-110 transition disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    🌟 สุ่มต่อ ×{GACHA_MULTI_COUNT} ({GACHA_MULTI_COST.toLocaleString()} 💰)
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export interface LoginGatePlayerSummary {
  id: number;
  name: string;
  emoji: string;
  role?: 'competitor' | 'spectator';
  colorHex: string;
  bandColor?: string;
  species?: string;
  breed?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWeapon?: string;
  equipWings?: string;
  equipAura?: string;
  equipPetGear?: string;
  petType?: string;
  equipMount?: string;
  propColors?: PropColorMap;
  goalType?: GoalType;
  progressPct?: number;
  diffLabel?: string;
  bellyScale?: number;
  bmiBellyScale?: number;
  muscleScale?: number;
}

interface LoginGateModalProps {
  isOpen: boolean;
  qualityMode?: QualityMode;
  players: LoginGatePlayerSummary[];
  champion: LoginGatePlayerSummary | null;
  signInUsername: string;
  setSignInUsername: (v: string) => void;
  signInError: string;
  setSignInError: (v: string) => void;
  signingIn: boolean;
  onSubmitSignIn: (e: React.FormEvent) => void;
  onOpenCreate: () => void;
  onSpectateGuest: () => void;
}

export function LoginGateModal({
  isOpen,
  qualityMode = 'auto',
  players,
  champion,
  signInUsername,
  setSignInUsername,
  signInError,
  setSignInError,
  signingIn,
  onSubmitSignIn,
  onOpenCreate,
  onSpectateGuest,
}: LoginGateModalProps) {
  const champContainerRef = useRef<HTMLDivElement | null>(null);
  const [loginTab, setLoginTab] = useState<'existing' | 'new'>('existing');
  const [filterQuery, setFilterQuery] = useState('');

  const effectiveFilter = isOpen && signInUsername ? filterQuery.trim().toLowerCase() : '';
  const filteredPlayers = effectiveFilter
    ? players.filter((pl) => pl.name.toLowerCase().includes(effectiveFilter))
    : players;

  useEffect(() => {
    if (!isOpen || !champContainerRef.current) return;
    const container = champContainerRef.current;
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 380;

    const scene = new THREE.Scene();
    const hasMount = Boolean(champion?.equipMount && champion.equipMount !== 'mount_none');
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.set(0, hasMount ? 2.85 : 2.35, hasMount ? 7.8 : 6.4);
    camera.lookAt(0, hasMount ? 1.65 : 1.35, 0);

    const qCfg = getQualityConfig(qualityMode);
    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const hemi = new THREE.HemisphereLight(0xfef08a, 0x334155, 0.75);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfffbeb, 1.35);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    const cShadowSize = Math.min(1024, qCfg.shadowMapSize);
    key.shadow.mapSize.set(cShadowSize, cShadowSize);
    scene.add(key);

    // Stone & Gold Champion Pedestal
    const pedGroup = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.65, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
    );
    base.position.y = -0.22;
    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.32, 0.06, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.03;
    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.38 })
    );
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 0.02;
    pedGroup.add(base, goldRing, glowDisc);
    scene.add(pedGroup);

    const charParts = champion
      ? buildCharacterMesh({
          colorHex: champion.colorHex || '#F8FAFC',
          accessory: 'none',
          bandColor: champion.bandColor || '#FACC15',
          bellyScale: champion.bellyScale ?? champion.bmiBellyScale ?? 1,
          muscleScale: champion.muscleScale ?? 1,
          showDumbbells: champion.goalType === 'muscle_gain',
          species: champion.breed || champion.species || 'bunny',
          equipHat: champion.equipHat || 'none',
          equipFace: champion.equipFace || 'face_none',
          equipArmor: champion.equipArmor || 'armor_none',
          equipWeapon: champion.equipWeapon || 'weapon_none',
          equipWings: champion.equipWings || 'wings_none',
          equipAura: champion.equipAura || 'aura_none',
          equipMount: champion.equipMount || 'mount_none',
          propColors: champion.propColors,
          animMode: 'cheer',
        })
      : buildCharacterMesh({
          colorHex: '#F8FAFC',
          accessory: 'headband',
          bandColor: '#FACC15',
          bellyScale: 1,
          species: 'bunny',
          equipHat: 'hat_tiara',
          equipFace: 'face_none',
          equipArmor: 'armor_snow_dress',
          equipWeapon: 'weapon_light_sword',
          equipWings: 'wings_gold_archangel',
          equipAura: 'aura_stars',
          animMode: 'cheer',
        });
    charParts.rootGroup.rotation.y = -Math.PI / 2 + 0.35;

    const champPetType = champion
      ? champion.equipPetGear && champion.equipPetGear !== 'pet_none'
        ? champion.equipPetGear
        : champion.petType || 'none'
      : 'none';
    const petParts = buildPetMesh(champPetType, champion?.propColors?.pet);
    if (petParts) {
      charParts.rootGroup.add(petParts.petGroup);
      if (petParts.leashMesh) charParts.rootGroup.add(petParts.leashMesh);
    }

    scene.add(charParts.rootGroup);

    let frameId = 0;
    const clock = new THREE.Clock();
    let t = 0;
    const propColorsSig = JSON.stringify(champion?.propColors || {});
    void propColorsSig;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.05, clock.getDelta());
      t += delta;
      charParts.rootGroup.rotation.y = -Math.PI / 2 + 0.35 + Math.sin(t * 0.9) * 0.25;
      charParts.mixer?.update(delta);
      petParts?.mixer?.update(delta);
      if (charParts.auraSpinGroup) {
        charParts.auraSpinGroup.rotation.y = t * 1.45;
      }
      if (petParts) {
        animatePetMotion(petParts, charParts, champPetType, false, t, 0);
      }
      if (hasMount) {
        syncCharacterMountPose(charParts, t, 0, true, false);
      } else {
        charParts.bounceGroup.position.y = charParts.mixer ? 0 : Math.abs(Math.sin(t * 2.8)) * 0.08;
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      charParts.rootGroup.userData.disposed = true;
      if (petParts) petParts.petGroup.userData.disposed = true;
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [
    isOpen,
    qualityMode,
    champion?.id,
    champion?.breed,
    champion?.species,
    champion?.colorHex,
    champion?.bandColor,
    champion?.bellyScale,
    champion?.bmiBellyScale,
    champion?.muscleScale,
    champion?.goalType,
    champion?.equipHat,
    champion?.equipFace,
    champion?.equipArmor,
    champion?.equipWeapon,
    champion?.equipWings,
    champion?.equipAura,
    champion?.equipPetGear,
    champion?.petType,
    champion?.equipMount,
    JSON.stringify(champion?.propColors || {}),
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-[1120px] grid grid-cols-1 lg:grid-cols-12 gap-5 items-center my-auto">
        {/* LEFT HALF: 3D #1 Champion Showcase */}
        <div className="lg:col-span-5 flex flex-col items-center text-center">
          <h1 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-4xl font-extrabold tracking-wide rpg-gold-title mb-1">
            ศึกชิงบัลลังก์เอวเอส 3D
          </h1>
          <div
            ref={champContainerRef}
            className="w-full h-[180px] sm:h-[280px] lg:h-[340px] flex items-center justify-center"
          />
          <div className="rpg-stone-frame rounded-2xl px-5 py-2.5 -mt-3 max-w-xs w-full relative">
            <StoneFrameCorners />
            <div className="text-[11px] font-bold text-amber-200">
              👑 แชมป์อันดับ 1 ปัจจุบัน
            </div>
            <div className="font-[family-name:var(--font-kanit)] text-lg sm:text-xl font-extrabold text-amber-300 truncate mt-0.5">
              {champion ? `${champion.emoji} ${champion.name}` : '🐰 สโนว์-ไวท์สายกิน'}
            </div>
            {champion && champion.role !== 'spectator' && (
              <div className="text-[11px] font-bold text-emerald-300">
                ความคืบหน้า {champion.progressPct ?? 0}%
              </div>
            )}
          </div>
        </div>

        {/* RIGHT HALF: Carved Stone & Gold Login Gate */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full rpg-stone-frame rounded-2xl p-4 sm:p-5 space-y-3 relative">
            <StoneFrameCorners />
            <div className="rpg-ribbon-header rounded-xl py-2 px-4 text-center">
              <div className="font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base text-amber-200">
                🚪 ประตูเข้าสู่อารีน่า (Login Gate)
              </div>
              <div className="text-[11px] font-bold text-amber-100/85">
                ศึกชิงบัลลังก์เอวเอส 3D • ชายหาดมหาสนุก
              </div>
            </div>

            {/* 2 Mode Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLoginTab('existing')}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold border-2 cursor-pointer transition ${
                  loginTab === 'existing'
                    ? 'rpg-btn-gold'
                    : 'bg-slate-900/85 text-amber-100 border-amber-700 hover:border-amber-400'
                }`}
              >
                🚪 เข้าสู่สนาม (ผู้เล่นเก่า)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginTab('new');
                  onOpenCreate();
                }}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold border-2 cursor-pointer transition ${
                  loginTab === 'new'
                    ? 'rpg-btn-gold'
                    : 'bg-emerald-800/80 text-emerald-100 border-emerald-500 hover:brightness-110'
                }`}
              >
                ➕ สร้างตัวละครใหม่
              </button>
            </div>

            {/* Existing Players 2-Column RPG Grid */}
            {players.length > 0 && (
              filteredPlayers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[215px] overflow-y-auto pr-1">
                  {filteredPlayers.map((pl) => {
                    const isSel = signInUsername.trim().toLowerCase() === pl.name.trim().toLowerCase();
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => {
                          if (!signInUsername) setFilterQuery('');
                          setSignInUsername(pl.name);
                          setSignInError('');
                        }}
                        className={`p-2 rounded-xl text-left transition cursor-pointer flex items-center gap-2.5 ${
                          isSel ? 'rpg-card-item-active' : 'rpg-card-item'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-xl border-2 shadow-inner"
                          style={{
                            backgroundColor: `${pl.colorHex || '#F8FAFC'}33`,
                            borderColor: pl.colorHex || '#FACC15',
                          }}
                        >
                          {pl.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-extrabold text-amber-100 truncate">
                            {pl.name}
                          </div>
                          <div className="text-[10px] font-bold text-amber-300/90 truncate">
                            {`👟 ความคืบหน้า ${pl.progressPct ?? 0}%`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-700/40 bg-slate-950/60 py-6 px-4 text-center text-xs font-bold text-amber-200/80">
                  ไม่พบชื่อผู้กล้าที่ตรงกับ &ldquo;{filterQuery.trim()}&rdquo; — กดปุ่มด้านล่างเพื่อสร้างตัวละครชื่อนี้ได้เลย!
                </div>
              )
            )}

            <form onSubmit={onSubmitSignIn} className="space-y-2.5 pt-1 border-t border-amber-700/40">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    required
                    value={signInUsername}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSignInUsername(val);
                      setFilterQuery(val);
                      if (signInError) setSignInError('');
                    }}
                    placeholder="พิมพ์ชื่อผู้กล้าเพื่อค้นหา หรือคลิกเลือกด้านบน..."
                    className="w-full bg-stone-950/90 text-amber-100 border-2 border-amber-500 rounded-xl pl-3 pr-8 py-2 font-bold text-sm placeholder:text-slate-400"
                  />
                  {signInUsername && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignInUsername('');
                        setFilterQuery('');
                        if (signInError) setSignInError('');
                      }}
                      title="ล้างข้อความ"
                      className="absolute right-2.5 text-slate-400 hover:text-amber-200 text-xs font-extrabold cursor-pointer px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={signingIn}
                  className="rpg-btn-gold px-5 py-2.5 rounded-xl font-[family-name:var(--font-kanit)] font-extrabold text-sm cursor-pointer shrink-0"
                >
                  {signingIn ? 'กำลังตรวจสอบ...' : '🚪 เปิดประตูเข้าสู่อารีน่า'}
                </button>
              </div>

              {signInError && (
                <div className="bg-rose-700/90 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                  {signInError}
                </div>
              )}
            </form>
          </div>

          <button
            type="button"
            onClick={onSpectateGuest}
            className="mt-3 rpg-ribbon-header px-5 py-2 rounded-full text-xs font-extrabold cursor-pointer hover:brightness-110 transition"
          >
            👀 เข้าชมในโหมดผู้ชม (Spectator Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
