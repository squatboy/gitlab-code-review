import type { DiffPosition, DiffVersion, GitLabDiff, MergeRequest } from "../types.js";

interface GitLabDiscussionNote {
  body?: string;
}

interface GitLabDiscussion {
  notes?: GitLabDiscussionNote[];
}

interface DraftNote {
  id: number;
}

interface MergeRequestChanges {
  changes: GitLabDiff[];
}

export class GitLabClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly token: string,
    private readonly projectId: string,
    private readonly mergeRequestIid: string
  ) {}

  async getMergeRequest(): Promise<MergeRequest> {
    return this.request<MergeRequest>(`/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}`);
  }

  async getCurrentHeadSha(): Promise<string> {
    const mr = await this.getMergeRequest();
    return mr.sha;
  }

  async getLatestDiffVersion(): Promise<DiffVersion> {
    const versions = await this.request<DiffVersion[]>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/versions?per_page=100`
    );

    const latest = versions.sort((a, b) => b.id - a.id)[0];
    if (!latest) {
      throw new Error("No merge request diff version found");
    }
    return latest;
  }

  async listDiffs(): Promise<GitLabDiff[]> {
    const response = await this.request<MergeRequestChanges>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/changes`
    );
    return response.changes;
  }

  async hasSummaryForHead(headSha: string): Promise<boolean> {
    const marker = `<!-- ai-code-review:summary project_id=${this.projectId} mr_iid=${this.mergeRequestIid} head_sha=${headSha} -->`;
    const discussions = await this.paginatedRequest<GitLabDiscussion[]>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/discussions?per_page=100`
    );

    return discussions.some((discussion) =>
      discussion.notes?.some((note) => note.body?.includes(marker))
    );
  }

  async createDraftNote(note: string, position?: DiffPosition): Promise<number> {
    const draft = await this.request<DraftNote>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/draft_notes`,
      {
        method: "POST",
        body: JSON.stringify(position ? { note, position } : { note })
      }
    );

    return draft.id;
  }

  async deleteDraftNote(draftNoteId: number): Promise<void> {
    await this.request<void>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/draft_notes/${draftNoteId}`,
      {
        method: "DELETE"
      }
    );
  }

  async bulkPublishDraftNotes(): Promise<void> {
    await this.request<void>(
      `/projects/${this.projectId}/merge_requests/${this.mergeRequestIid}/draft_notes/bulk_publish`,
      {
        method: "POST"
      }
    );
  }

  private async paginatedRequest<T extends unknown[]>(path: string): Promise<T[number][]> {
    const results: T[number][] = [];
    let page = 1;

    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const response = await this.rawRequest(`${path}${separator}page=${page}`);
      const pageItems = (await response.json()) as T;
      results.push(...pageItems);

      const nextPage = response.headers.get("x-next-page");
      if (!nextPage) return results;
      page = Number(nextPage);
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.rawRequest(path, init);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
    const url = `${this.apiBaseUrl.replace(/\/$/, "")}${path}`;
    const headers = new Headers(init.headers);
    headers.set("PRIVATE-TOKEN", this.token);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitLab API request failed: ${response.status} ${response.statusText} ${body}`);
    }
    return response;
  }
}
