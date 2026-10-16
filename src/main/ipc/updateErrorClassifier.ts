function classifyUpdateError(error: unknown): 'offline' | 'release-incomplete' | 'no-release' | 'rate-limited' | 'generic' {
  const msg = String((error && (error as any).message) || error || '');
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|net::ERR_INTERNET_DISCONNECTED|getaddrinfo/i.test(msg)) {
    return 'offline';
  }
  if (/in the latest release artifacts/i.test(msg)) {
    return 'release-incomplete';
  }
  if (/404|Not Found|no published versions|cannot find latest/i.test(msg)) {
    return 'no-release';
  }
  if (/403|rate limit/i.test(msg)) {
    return 'rate-limited';
  }
  return 'generic';
}

export { classifyUpdateError };
