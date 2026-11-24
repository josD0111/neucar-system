// src/renderer/src/components/formatoMoneda.ts
//
// Helpers compartidos para inputs monetarios en guaraníes (Gs.): formateo con
// separador de miles y preservación de cursor al editar.

/** Formatea un monto numérico o string en guaraníes con separador de miles. */
export function gs(valor: number | string): string {
  return Number(valor).toLocaleString('es-PY')
}

/**
 * Devuelve la posición dentro de `texto` que queda justo después del
 * n-ésimo dígito (ignorando puntos de miles). Permite mantener el cursor en
 * su lugar tras reformatear un input numérico.
 */
export function posicionTrasNDigitos(texto: string, n: number): number {
  if (n <= 0) return 0
  let contados = 0
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i])) {
      contados++
      if (contados === n) return i + 1
    }
  }
  return texto.length
}
