    // Picks the data source. SHEETS_DB_ID set -> the real Google Sheet.
    // Not set -> the in-memory sample data, so the app still runs with no Google setup.
    // The rest of the app depends only on the SheetsRepo interface, so nothing else changes.

    import type { SheetsRepo } from "./repo";
    import { makeSampleRepo } from "./sampleRepo";

    let cached: SheetsRepo | null = null;

    export async function getRepo(): Promise<SheetsRepo> {
      if (cached) return cached;

      if (process.env.SHEETS_DB_ID) {
        const { makeGoogleRepo } = await import("./googleRepo");
        cached = makeGoogleRepo();
      } else {
        cached = makeSampleRepo();
      }
      return cached;
    }

    /** True while the app is on sample data (SHEETS_DB_ID is not set). */
    export function usingSampleData(): boolean {
      return !process.env.SHEETS_DB_ID;
    }