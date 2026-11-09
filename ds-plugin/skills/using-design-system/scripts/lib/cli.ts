// Parsing mínimo de argumentos compartilhado pelos scripts.
export function parseArgs(argv = process.argv.slice(2)) {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] ?? 'true';
    else positional.push(a);
  }
  return { flags, positional };
}

export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
