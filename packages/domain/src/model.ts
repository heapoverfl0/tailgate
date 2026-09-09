import type { ContestPhase, PickResult } from '../../contracts/src/index.js';

export type Confidence = 1 | 2 | 3 | 4 | 5 | 6;
export type Attendance = 'ON_SITE' | 'REMOTE';
export type PickCategory = 'CONFIDENCE' | 'ATS' | 'UPSET_SPECIAL' | 'MAIN_EVENT';
export interface Contest {
  id: string; name: string; timezone: string; lockAt: string; phase: ContestPhase;
  version: number; lockedAt?: string; finalizedAt?: string;
}
export interface Player { id: string; name: string }
export interface ContestParticipant {
  contestId: string; participantId: string; playerId: string; displayName: string;
  attendance: Attendance; status: 'ACTIVE' | 'NOT_PLAYING'; cardRevision: number;
  submissionStatus: 'DRAFT' | 'SUBMITTED'; submittedAt?: string;
  lastEditedBy?: 'PARTICIPANT' | 'COMMISSIONER'; lastEditedAt?: string;
}
export interface Game { id: string; homeTeamId: string; awayTeamId: string }
export type Outcome = { kind: 'TEAM'; teamId: string } | { kind: 'TOTAL_SIDE'; side: 'OVER' | 'UNDER' }
  | { kind: 'SCORE_TYPE'; scoreType: 'TOUCHDOWN' | 'FIELD_GOAL' | 'OTHER' } | { kind: 'TIE' };
export type PropositionParameters = { kind: 'STRAIGHT_UP_WINNER' } | { kind: 'FIRST_TEAM_TO_SCORE' }
  | { kind: 'FIRST_SCORE_TYPE' } | { kind: 'HALFTIME_LEADER'; allowTie: true }
  | { kind: 'AGAINST_SPREAD'; favoredTeamId: string; spread: number; source: string; capturedAt: string }
  | { kind: 'GAME_TOTAL'; total: number; source?: string; capturedAt?: string };
export interface Proposition {
  id: string; contestId: string; gameId: string; label: string;
  type: PropositionParameters['kind']; parameters: PropositionParameters;
}
// Resolution is separate from the frozen question/line. PUSH is explicit, not a selectable outcome.
export type Resolution = { status: 'UNRESOLVED' } | { status: 'VOID' }
  | { status: 'RESOLVED'; outcome: Outcome } | { status: 'PUSH' };
export type PickChoice = { id: string; kind: 'PROPOSITION_OUTCOME'; propositionId: string;
  outcome: Outcome; points?: number; moneyline?: number; source?: string; capturedAt?: string }
  | { id: string; kind: 'NO_UPSET'; points: 1 };
export interface PickSlot {
  id: string; contestId: string; category: PickCategory; order: number; label: string;
  required: boolean; choices: PickChoice[];
}
export interface ContestConfiguration {
  contestId: string; mainEventGameId: string; games: Game[]; propositions: Proposition[]; slots: PickSlot[];
}
export interface Selection { slotId: string; choiceId: string; confidence?: Confidence }
export interface ScorePrediction { home: number; away: number }
export interface PickCard { picks: Selection[]; prediction?: ScorePrediction }
export interface Pick extends Selection {
  contestId: string; participantId: string; result: PickResult; pointsAwarded?: number;
  editedBy: 'PARTICIPANT' | 'COMMISSIONER'; editedAt: string;
}
export interface SavePickCardRequest extends PickCard { expectedCardRevision: number }
export interface ValidationIssue { code: string; slotId?: string; message: string }
export interface CardValidation {
  valid: boolean; complete: boolean; issues: ValidationIssue[]; missingSlotIds: string[];
  predictionMissing: boolean; validSelections: Selection[];
}
export type Frozen<T> = T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T;
export type FrozenConfiguration = Frozen<ContestConfiguration>;
