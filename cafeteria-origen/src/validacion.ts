export function validarTexto(
  valor: unknown,
  min: number,
  max: number
): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max) return null;
  return limpio;
}

export function validarEnteroEnRango(
  valor: unknown,
  min: number,
  max: number
): number | null {
  const num = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(num) || num < min || num > max) return null;
  return num;
}

export function validarId(valor: unknown): number | null {
  return validarEnteroEnRango(valor, 1, Number.MAX_SAFE_INTEGER);
}