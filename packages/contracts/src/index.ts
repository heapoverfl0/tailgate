export type ContestPhase = 'PREGAME' | 'REVEAL' | 'LIVE' | 'MAIN_EVENT' | 'FINAL';
export type PickResult = 'PENDING' | 'WIN' | 'LOSS' | 'PUSH' | 'VOID';
export type ScoringRule = { kind: 'CONFIDENCE'; value: number } | { kind: 'ATS' } | { kind: 'MAIN_EVENT' } | { kind: 'UPSET'; value: number };
export interface ContestSummary { id: string; title: string; phase: ContestPhase; version: number }
export interface ContestUpdated { type: 'contest_updated'; contestId: string; version: number }
export interface GameState { gameId: string; homeTeamId: string; awayTeamId: string; status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL' | 'CANCELED' | 'POSTPONED'; homeScore?: number; awayScore?: number; period?: number; clock?: string; possessionTeamId?: string; situation?: string; observedAt: string; providerUpdatedAt?: string }

export interface ApiError { error: { code: string; message: string; details?: unknown } }
