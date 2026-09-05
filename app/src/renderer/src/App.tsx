// src/renderer/src/App.tsx (dentro de la carpeta app/src del proyecto)
//
// Placeholder temporal: reemplaza la pantalla de bienvenida de la plantilla
// (que referenciaba electron.svg y Versions.tsx, ya eliminados). Esto
// permite correr "npm run dev" para validar la integración de la base de
// datos, sin bloquear por assets faltantes.
//
// El diseño real de la interfaz se construye en el Sprint 0.5 (prototipo
// clickeable) — ver docs/03-gestion-proyecto/plan-gestion-proyecto.md.

function App(): React.JSX.Element {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Neucar System</h1>
      <p>Placeholder temporal — revisar la consola de la terminal para ver los logs de inicialización de la base de datos.</p>
    </div>
  )
}

export default App