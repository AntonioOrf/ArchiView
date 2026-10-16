function pickerGetSecretOk(reqUrl: string, sessionSecret: string): boolean {
  if (!sessionSecret) return false;
  try {
    const parsed = new URL(reqUrl, 'http://127.0.0.1:3457');
    return parsed.searchParams.get('s') === sessionSecret;
  } catch {
    return false;
  }
}

export { pickerGetSecretOk };
