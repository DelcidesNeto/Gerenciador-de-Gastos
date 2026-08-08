import type { CdiDailyRate } from '../../models/schemas';

export interface CdiProvider {
  readonly name: string;
  fetchRates(startDate: string, endDate: string): Promise<CdiDailyRate[]>;
}
