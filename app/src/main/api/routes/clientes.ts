// src/main/api/routes/clientes.ts
//
// Rutas de clientes, montadas bajo /api/clientes (ver server.ts).
// Todas exigen sesión iniciada. Permisos por rol:
//   - Listar, ver, crear y editar: Administrador y Empleado (HU-09).
//   - Deshabilitar / habilitar:    solo Administrador.
//   - Saldo / créditos vencidos:   Administrador y Empleado (igual que ver).
//
//   GET   /api/clientes?q=texto&inactivos=true   → lista (con búsqueda opcional)
//   GET   /api/clientes/creditos-vencidos        → listado global de créditos vencidos (HU-10.2)
//   GET   /api/clientes/:id                      → un cliente
//   GET   /api/clientes/:id/saldo                → saldo pendiente y detalle de deudas (HU-11)
//   GET   /api/clientes/:id/saldo-pdf             → comprobante de saldo en PDF, para firma (HU-12)
//   POST  /api/clientes                          → crear
//   PUT   /api/clientes/:id                      → editar datos
//   PATCH /api/clientes/:id/estado               → { "activo": true | false }
//
// Nota de orden: "/creditos-vencidos" se declara ANTES que "/:id" — si no,
// Express probaría a interpretar "creditos-vencidos" como un id de cliente
// (y leerId lo rechazaría con un 400 que no tiene nada que ver).

import { Router, type Response } from "express";
import PDFDocument from "pdfkit";
import type { Db } from "../server";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendBadRequest, sendError, sendOk } from "../response";
import {
  actualizarCliente,
  cambiarEstadoCliente,
  crearCliente,
  listarClientes,
  obtenerCliente,
  type Resultado,
} from "../../services/clientes";
import { calcularSaldoCliente, listarCreditosVencidos } from "../../services/saldoClientes";

// Convierte el id de la URL en número entero positivo (o null si no es válido).
function leerId(valor: string): number | null {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Traduce el Resultado de un servicio a la respuesta HTTP correspondiente.
function responder<T>(res: Response, resultado: Resultado<T>, statusExito = 200): void {
  if (resultado.ok) sendOk(res, resultado.data, statusExito);
  else sendError(res, resultado.status, resultado.mensaje);
}

export function clientesRouter(db: Db): Router {
  const router = Router();

  // Todas las rutas de este router requieren un usuario autenticado.
  router.use(requireAuth);

  // Lista de clientes. Parámetros opcionales: q (búsqueda) e inactivos=true.
  router.get("/", async (req, res, next) => {
    try {
      const busqueda = typeof req.query.q === "string" ? req.query.q : undefined;
      const incluirInactivos = req.query.inactivos === "true";
      sendOk(res, await listarClientes(db, { busqueda, incluirInactivos }));
    } catch (err) {
      next(err);
    }
  });

  // Listado global de créditos vencidos (HU-10.2). Va ANTES de "/:id" (ver
  // nota de orden al principio del archivo).
  router.get("/creditos-vencidos", async (_req, res, next) => {
    try {
      sendOk(res, await listarCreditosVencidos(db));
    } catch (err) {
      next(err);
    }
  });

  // Un cliente por id.
  router.get("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await obtenerCliente(db, id));
    } catch (err) {
      next(err);
    }
  });

  // Saldo pendiente y detalle de deudas del cliente (HU-11).
  router.get("/:id/saldo", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await calcularSaldoCliente(db, id));
    } catch (err) {
      next(err);
    }
  });

  // Comprobante de saldo en PDF, pensado para hacerlo firmar al cliente
  // (HU-12). A diferencia del resto de las rutas de este router, la
  // respuesta no sigue la convención { ok, data }: el cuerpo es el PDF en sí
  // (mismo criterio que GET /api/productos/listado-pdf).
  router.get("/:id/saldo-pdf", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");

      const resultado = await calcularSaldoCliente(db, id);
      if (!resultado.ok) return sendError(res, resultado.status, resultado.mensaje);
      const { clienteNombre, saldoTotal, deudas } = resultado.data;

      // Paleta alineada a design/tokens.css (mismo criterio que
      // routes/productos.ts, GET /listado-pdf: no se embebe la tipografía de
      // la app, Helvetica alcanza para un comprobante).
      const COLOR_TEXTO = "#22262b";
      const COLOR_TEXTO_MUTED = "#5c6570";
      const COLOR_BORDE = "#dedad2";
      const COLOR_ALERTA = "#b23b3b";

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=saldo-cliente-${id}.pdf`);

      const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
      doc.info.Title = `Comprobante de saldo — ${clienteNombre}`;
      doc.pipe(res);

      const xIzq = doc.page.margins.left;
      const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.fillColor(COLOR_TEXTO).font("Helvetica-Bold").fontSize(18).text("Comprobante de saldo pendiente");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR_TEXTO_MUTED)
        .text(`Neucar — generado el ${new Date().toLocaleString("es-PY")}`);
      doc.moveDown(1);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLOR_TEXTO).text(`Cliente: ${clienteNombre}`);
      doc.moveDown(1);

      if (deudas.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor(COLOR_TEXTO_MUTED)
          .text("Este cliente no tiene saldo pendiente a la fecha.");
      } else {
        // Encabezado de tabla.
        const anchoRef = 110;
        const anchoFecha = 85;
        const anchoPrevista = 95;
        const anchoSaldo = anchoPagina - anchoRef - anchoFecha - anchoPrevista;
        const xFecha = xIzq + anchoRef;
        const xPrevista = xFecha + anchoFecha;
        const xSaldo = xPrevista + anchoPrevista;

        const y0 = doc.y;
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR_TEXTO_MUTED);
        doc.text("Referencia", xIzq, y0, { width: anchoRef });
        doc.text("Fecha", xFecha, y0, { width: anchoFecha });
        doc.text("Pago previsto", xPrevista, y0, { width: anchoPrevista });
        doc.text("Saldo (Gs.)", xSaldo, y0, { width: anchoSaldo, align: "right" });
        doc.y = y0 + 14;
        doc.moveTo(xIzq, doc.y).lineTo(xIzq + anchoPagina, doc.y).strokeColor(COLOR_BORDE).lineWidth(1).stroke();
        doc.y += 4;

        const hoy = new Date().toISOString().slice(0, 10);
        deudas.forEach((d, i) => {
          const y = doc.y;
          const referencia = d.tipo === "venta" ? `Venta #${d.ventaId}` : `Orden #${d.ordenServicioId}`;
          const fecha = d.fecha.slice(0, 10);
          const vencido = d.fechaPagoPrevista !== null && d.fechaPagoPrevista < hoy;

          doc.font("Helvetica").fontSize(10).fillColor(COLOR_TEXTO).text(referencia, xIzq, y, { width: anchoRef });
          doc
            .font("Helvetica")
            .fillColor(COLOR_TEXTO_MUTED)
            .text(fecha, xFecha, y, { width: anchoFecha });
          doc
            .font(vencido ? "Helvetica-Bold" : "Helvetica")
            .fillColor(vencido ? COLOR_ALERTA : COLOR_TEXTO_MUTED)
            .text(d.fechaPagoPrevista ?? "—", xPrevista, y, { width: anchoPrevista });
          doc
            .font("Helvetica-Bold")
            .fillColor(COLOR_TEXTO)
            .text(d.saldoPendiente.toLocaleString("es-PY"), xSaldo, y, { width: anchoSaldo, align: "right" });

          doc.y = y + 18;
          if (i < deudas.length - 1) {
            doc.moveTo(xIzq, doc.y).lineTo(xIzq + anchoPagina, doc.y).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();
            doc.y += 4;
          }
        });
      }

      doc.moveDown(2);
      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(COLOR_TEXTO)
        .text(`Saldo total pendiente: Gs. ${saldoTotal.toLocaleString("es-PY")}`);

      // Espacio de firma (HU-12: "comprobante ... para que el cliente firme").
      doc.moveDown(4);
      const yFirma = doc.y;
      doc.moveTo(xIzq, yFirma).lineTo(xIzq + 220, yFirma).strokeColor(COLOR_TEXTO).lineWidth(1).stroke();
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(COLOR_TEXTO_MUTED)
        .text("Firma del cliente", xIzq, yFirma + 4);

      doc.end();
    } catch (err) {
      next(err);
    }
  });

  // Alta de cliente. Responde 201 (creado).
  router.post("/", async (req, res, next) => {
    try {
      responder(res, await crearCliente(db, req.body), 201);
    } catch (err) {
      next(err);
    }
  });

  // Edición de los datos de un cliente.
  router.put("/:id", async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await actualizarCliente(db, id, req.body));
    } catch (err) {
      next(err);
    }
  });

  // Deshabilitar o habilitar (solo Administrador; el Empleado recibe 403).
  router.patch("/:id/estado", requireRole("Administrador"), async (req, res, next) => {
    try {
      const id = leerId(req.params.id);
      if (id === null) return sendBadRequest(res, "Id de cliente no válido");
      responder(res, await cambiarEstadoCliente(db, id, req.body?.activo));
    } catch (err) {
      next(err);
    }
  });

  return router;
}