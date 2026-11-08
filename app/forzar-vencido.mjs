// forzar-vencido.mjs (ad-hoc, no es parte del repo)
import { PGlite } from '@electric-sql/pglite'
const db = new PGlite('.data/pglite-dev')
const { rows } = await db.query(
  "UPDATE items_venta SET fecha_pago_prevista = CURRENT_DATE - 5 WHERE tipo_pago = 'Crédito' AND id = (SELECT id FROM items_venta WHERE tipo_pago = 'Crédito' ORDER BY id LIMIT 1) RETURNING id, venta_id"
)
console.log(rows)