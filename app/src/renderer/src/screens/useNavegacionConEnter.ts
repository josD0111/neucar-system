// src/renderer/src/screens/useNavegacionConEnter.ts
//
// Navegación por teclado en formularios (Sprint 2, punto 6 — feedback del
// dueño del 23/10/2026): al abrir un formulario el cursor debe quedar en el
// primer campo, y la tecla Enter debe mover el foco al campo siguiente en
// vez de intentar enviar el formulario.
//
// Uso: se llama al hook dentro del componente del formulario y se
// "esparce" el resultado sobre el contenedor de los campos:
//
//   const nav = useNavegacionConEnter(() => guardar())
//   return <div {...nav}> ...campos... </div>
//
// Se usa un único manejador en el contenedor (delegación de eventos) en
// vez de agregar un onKeyDown a cada input: así los campos nuevos que se
// agreguen a un formulario funcionan sin tocar nada más.

import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

// Campos por los que se navega con Enter. Quedan afuera los botones, los
// checkbox/radio y los inputs ocultos: no son "campos de texto" a completar.
const SELECTOR_CAMPOS =
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), select, textarea'

// Tipos de <input> en los que Enter conserva su comportamiento normal.
const TIPOS_SIN_NAVEGACION = ['button', 'submit', 'checkbox', 'radio']

// Devuelve los campos del contenedor que se pueden usar ahora mismo, en
// orden de aparición: se descartan los deshabilitados y los que no se ven
// (display: none), porque el foco no puede ir a ellos.
function camposEnfocables(contenedor: HTMLElement): HTMLElement[] {
  return Array.from(contenedor.querySelectorAll<HTMLElement>(SELECTOR_CAMPOS)).filter(
    (el) => !(el as HTMLInputElement).disabled && el.getClientRects().length > 0
  )
}

/**
 * @param alUltimo Se ejecuta cuando se presiona Enter en el ÚLTIMO campo del
 *   formulario (normalmente, la función que guarda). Si no se pasa, Enter en
 *   el último campo no hace nada.
 */
export function useNavegacionConEnter(alUltimo?: () => void): {
  ref: React.RefObject<HTMLDivElement | null>
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
} {
  const ref = useRef<HTMLDivElement>(null)

  // Foco inicial: al montarse el formulario, el cursor va al primer campo.
  useEffect(() => {
    if (ref.current) camposEnfocables(ref.current)[0]?.focus()
  }, [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key !== 'Enter') return
      // Si un campo ya manejó el Enter por su cuenta (ej. el selector con
      // buscador, que lo usa para elegir una opción de su lista), no se
      // interfiere.
      if (e.defaultPrevented) return
      // Con Shift/Ctrl/Alt/Meta o mientras se compone un carácter (IME), el
      // Enter tiene otro significado: se deja pasar.
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return
      if (e.nativeEvent.isComposing) return

      // Solo se navega desde campos <input> de texto/número/fecha. En un
      // botón, Enter debe seguir activándolo; en <textarea>, hacer salto de
      // línea; en <select>, abrir/confirmar la opción.
      const origen = e.target
      if (!(origen instanceof HTMLInputElement)) return
      if (TIPOS_SIN_NAVEGACION.includes(origen.type)) return

      const campos = camposEnfocables(e.currentTarget)
      const indice = campos.indexOf(origen)
      if (indice === -1) return

      // Se evita el envío implícito del formulario (si lo hubiera).
      e.preventDefault()

      const siguiente = campos[indice + 1]
      if (siguiente) {
        siguiente.focus()
        // Deja seleccionado el contenido (útil al editar): escribir
        // reemplaza el valor en vez de agregarse al final.
        if (siguiente instanceof HTMLInputElement) siguiente.select()
      } else {
        alUltimo?.()
      }
    },
    [alUltimo]
  )

  return { ref, onKeyDown }
}