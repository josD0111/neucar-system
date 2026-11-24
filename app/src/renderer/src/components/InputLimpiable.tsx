// src/renderer/src/components/InputLimpiable.tsx
//
// Campo de texto con una pequeña "✕" que aparece cuando tiene contenido y lo
// vacía de un clic, dejando el cursor dentro del campo. Acepta las mismas
// propiedades que un <input>, salvo que `onChange` recibe directamente el texto.
// No muestra la ✕ si el campo está deshabilitado o es de solo lectura.

import { useRef } from 'react'
import type { CSSProperties, InputHTMLAttributes } from 'react'

interface InputLimpiableProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'style'> {
  value: string
  onChange: (valor: string) => void
  style?: CSSProperties
}

export function InputLimpiable({
  value,
  onChange,
  style,
  disabled,
  readOnly,
  type,
  ...resto
}: InputLimpiableProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const mostrarX = value !== '' && !disabled && !readOnly
  // Los <input type="number"> dibujan sus flechitas a la derecha: la ✕ se corre
  // para no taparlas.
  const derecha = type === 'number' ? 22 : 6

  return (
    // El wrapper necesita el mismo `width` que se le pide al input: al ser
    // `inline-block` sin ancho propio, por defecto se achica al contenido
    // (shrink-to-fit). Eso hace que un `width: '100%'` en el <input> no
    // sirva de nada cuando el wrapper queda como único hijo de un
    // contenedor que no sea flex (con flex, el `align-items: stretch` por
    // defecto lo estira y "tapa" el problema sin querer) — el 100% del
    // input se calcula contra el wrapper, que mide lo mismo que el propio
    // input, no el espacio real disponible. Replicando acá el mismo
    // `width` que recibe el input, el wrapper queda con una medida
    // correcta y el porcentaje (o el px) del input se resuelve bien.
    <span style={{ position: 'relative', display: 'inline-block', width: style?.width }}>
      <input
        {...resto}
        ref={inputRef}
        type={type}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        // Espacio a la derecha para que el texto no quede debajo de la ✕.
        style={{ ...style, paddingRight: derecha + 18 }}
      />
      {mostrarX && (
        <button
          type="button"
          tabIndex={-1} // no interrumpe el recorrido con Tab
          aria-label="Limpiar campo"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          style={{
            position: 'absolute',
            right: derecha,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'none',
            padding: 0,
            lineHeight: 1,
            fontSize: 12,
            color: 'var(--color-text-muted)',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      )}
    </span>
  )
}