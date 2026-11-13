import type { SourceId } from './knowledge';
export interface ReadingEvidence {
  rule: string;
  fact: string;
  branches: number[];
  stars: string[];
  sources: SourceId[];
  relation: 'own' | 'opposite' | 'related' | 'period' | 'structure';
}
export type AdviceTopic = 'personality' | 'career' | 'wealth' | 'relationships';
export interface ReadingRecommendation {
  topic: AdviceTopic;
  text: string;
  evidence: ReadingEvidence;
}
export interface ReadingSection {
  id: string;
  title: string;
  summary: string;
  paragraphs: string[];
  evidence: ReadingEvidence[];
  advice: string[];
  recommendations?: ReadingRecommendation[];
  generalAdvice?: string[];
  limitations: string[];
}
export interface ChartReading {
  version: string;
  status: 'ready' | 'unavailable';
  warnings: string[];
  sections: ReadingSection[];
  palaces: ReadingSection[];
  periods: ReadingSection[];
  currentPeriodId: string | null;
  snapshotAge: number | null;
  unsupported: string[];
  coverage: { rules: string[]; stars: string[]; unmodeledStars: string[] };
}
