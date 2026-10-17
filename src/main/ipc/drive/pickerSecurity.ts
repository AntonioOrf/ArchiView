function pickerGetSecretOk(reqUrl: string, sessionSecret: string): boolean {
  if (!sessionSecret) return false;
  try {
    const parsed = new URL(reqUrl, 'http://127.0.0.1:3457');
    return parsed.searchParams.get('s') === sessionSecret;
  } catch {
    return false;
  }
}

const RE_ID_DRIVE = /^[A-Za-z0-9_-]{1,200}$/;

function idDriveValido(id: unknown): boolean {
  return typeof id === 'string' && RE_ID_DRIVE.test(id);
}

function idDrive(id: unknown): string {
  if (!idDriveValido(id)) throw new Error('Id Drive non valido');
  return id as string;
}

export { pickerGetSecretOk, idDriveValido, idDrive };
