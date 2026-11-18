import { apiRequest } from "./api-client";
import type { SearchQueryOptions, SearchResult } from "@/lib/workspace-types";

/**
 * Global command-palette search.
 *
 * The backend resolves accessible modules, entity descriptors and data scope
 * from the session; the client only supplies the query and an optional limit.
 */
export class SearchService {
  static async search(
    query: string,
    options: SearchQueryOptions = {},
  ): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query });
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }

    return apiRequest<SearchResult>(`/workspace/search?${params.toString()}`, {
      errorMessage: "Search failed",
      signal: options.signal,
    });
  }
}
