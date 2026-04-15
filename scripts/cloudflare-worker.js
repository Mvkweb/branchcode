export default {
  async fetch(request, env, ctx) {
    const cache = caches.default;
    const cacheKey = new Request(request.url);

    // Try cache first
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    const OWNER = "Mvkweb";
    const REPO = "branchcode";

    // Fetch both in parallel
    const [actionsRes, releasesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/runs?per_page=20`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": "branchcode-updater"
        }
      }),
      fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "User-Agent": "branchcode-updater"
        }
      })
    ]);

    const actionsData = actionsRes.ok ? await actionsRes.json() : { workflow_runs: [] };
    const releasesData = releasesRes.ok ? await releasesRes.json() : [];

    // Filter successful runs only
    const successfulRuns = actionsData.workflow_runs
      .filter(run => run.conclusion === "success")
      .slice(0, 10)
      .map(run => ({
        id: run.head_sha.substring(0, 7),
        fullSha: run.head_sha,
        branch: run.head_branch,
        message: run.head_commit?.message?.split('\n')[0] || "No message",
        date: run.created_at,
        status: run.conclusion,
        url: run.html_url
      }));

    // Format releases - separate prerelease and stable
    const prerelease = releasesData
      .filter(r => r.prerelease)
      .slice(0, 5)
      .map(r => ({
        version: r.tag_name,
        message: r.body?.split('\n')[0] || "",
        date: r.published_at,
        url: r.assets?.[0]?.browser_download_url
      }));

    const stable = releasesData
      .filter(r => !r.prerelease)
      .slice(0, 5)
      .map(r => ({
        version: r.tag_name,
        message: r.body?.split('\n')[0] || "",
        date: r.published_at,
        url: r.assets?.[0]?.browser_download_url
      }));

    response = new Response(JSON.stringify({
      channels: {
        commits: successfulRuns,
        prerelease: prerelease,
        stable: stable
      }
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60" // 1 minute
      }
    });

    // Save in cache
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  }
};