<!--
Presenta tablas y acciones del módulo seleccionado; comunica acciones al panel contenedor.
Capa: Vista / presentación. Relación: svelte, ./Grafico.svelte, ../SelectorPersonalizado.svelte, ../administracion/presentacion.js, ../../api.js, ./presentacion.js
-->
<script>
  import { untrack } from 'svelte';
  import Grafico from './Grafico.svelte';
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import { paginar } from '../administracion/presentacion.js';
  import { money } from '../../api.js';
  import {
    metrics,
    alerts,
    documentosRecientes,
    estadoDocumento,
    estadoMantenimiento,
    estadoVehiculo,
    estadoReserva,
    normalize,
    options,
    serieIngresos,
    download,
  } from './presentacion.js';
  let { data, module, view, open, mutate, navigate, user, busy } = $props();
  const m = $derived(metrics(data, view));
  const car = (id) => data.vehicles.find((v) => v.id === id);
  const carLabel = (id) => {
    const v = car(id);
    return v ? v.brand + ' ' + v.model + ' #' + v.id : 'General';
  };
  let insights = $state(true);
  let group = $state('MENSUAL'),
    tab = $state('actuales');
  const series = $derived(serieIngresos(m.entries, group));
  const max = $derived(Math.max(1, ...series.map((s) => s.value)));
  const rows = $derived.by(() => {
    const map = (items, fn) => items.map(fn);
    if (module === 'vehiculos')
      return map(data.vehicles, (v) => ({
        id: v.id,
        vehicle_id: v.id,
        title: v.brand + ' ' + v.model,
        detail: v.city + ' · ' + v.year + ' · ' + money(v.daily_price) + '/día',
        status: estadoVehiculo(v),
        date: v.created_at.slice(0, 10),
        record: v,
        kind: 'vehicleDetail',
      }));
    if (module === 'reservas')
      return map(data.reservations, (r) => ({
        id: r.id,
        vehicle_id: r.vehicle_id,
        title: 'Reserva #' + r.id + ' · ' + r.renter_name,
        detail:
          r.start_date +
          ' → ' +
          r.end_date +
          ' · ' +
          r.days +
          ' días · Neto contractual ' +
          money(r.total - r.commission),
        status: estadoReserva(r, data.today),
        date: r.start_date,
        endDate: r.end_date,
        record: r,
        kind: 'reservation',
      }));
    if (module === 'ganancias')
      return map(m.entries, (e) => ({
        id: e.id,
        vehicle_id: e.vehicle_id,
        title: e.kind + ' · ' + money(e.amount),
        detail: 'Reserva #' + e.reservation_id + ' · Referencia ' + e.reference,
        status: e.kind,
        date: e.paid_on,
        record: e,
      }));
    if (module === 'resenas')
      return map(data.reviews, (r) => ({
        id: r.id,
        vehicle_id: r.vehicle_id,
        title: r.rating + '/5 · ' + r.renter_name,
        detail: r.comment + ' ' + r.recommendation,
        status: r.rating + ' ESTRELLAS',
        date: r.created_at.slice(0, 10),
        kind: 'review',
      }));
    if (module === 'kilometraje')
      return map(
        data.reservations.filter((r) => r.delivery_km != null),
        (r) => ({
          id: r.id,
          vehicle_id: r.vehicle_id,
          title: 'Alquiler #' + r.id,
          detail:
            'Entrega ' +
            r.delivery_km +
            ' km → ' +
            (r.return_km ?? 'Pendiente') +
            ' km · Recorrido ' +
            (r.return_km == null ? 'pendiente' : r.return_km - r.delivery_km + ' km'),
          status: r.return_km == null ? 'EN_USO' : 'DEVUELTO',
          date: (r.returned_at || r.delivered_at).slice(0, 10),
          kind: 'reservation',
        }),
      );
    if (module === 'mantenimientos')
      return map(data.maintenance, (r) => ({
        id: r.id,
        vehicle_id: r.vehicle_id,
        title: r.kind,
        detail:
          r.description +
          ' · ' +
          (r.due_km == null ? 'Sin umbral' : r.due_km + ' km') +
          ' · ' +
          money(r.cost),
        status: estadoMantenimiento(r, data),
        date: r.due_date,
        record: r,
        kind: 'maintenanceDetail',
      }));
    if (module === 'documentos')
      return map(tab === 'historial' ? data.documents : documentosRecientes(data), (d) => ({
        id: d.id || d.vehicle_id + '-' + d.kind,
        vehicle_id: d.vehicle_id,
        title: d.kind,
        detail: 'Vencimiento ' + (d.expires_on || 'sin registrar') + ' · Declarado, no verificado',
        status: estadoDocumento(d, data.today),
        date: d.expires_on || '',
        record: d,
      }));
    if (module === 'incidencias')
      return map(data.incidents, (i) => ({
        id: i.id,
        vehicle_id: i.vehicle_id,
        title: '#' + i.id + ' · ' + i.title,
        detail: i.kind + ' · ' + i.priority + ' · ' + i.description,
        status: i.status,
        date: i.updated_at.slice(0, 10),
        kind: 'caseDetail',
      }));
    if (module === 'flota') {
      const groups = new Map();
      for (const v of m.usage) {
        const key = normalize(v.brand) + '|' + normalize(v.model);
        const current = groups.get(key) || {
          id: key,
          title: v.brand + ' ' + v.model,
          detail: '',
          status: '',
          date: '',
          count: 0,
          gross: 0,
          days: 0,
          km: 0,
          vehicles: [],
        };
        current.count++;
        current.gross += v.gross;
        current.days += v.days;
        current.km += v.km;
        current.vehicles.push(v.year + ' · ' + estadoVehiculo(v));
        groups.set(key, current);
      }
      return [...groups.values()].map((g) => ({
        ...g,
        detail:
          g.count +
          ' vehículos · ' +
          money(g.gross) +
          ' cobros · ' +
          g.days +
          ' días · ' +
          g.km +
          ' km · ' +
          g.vehicles.join(', '),
      }));
    }
    if (module === 'notificaciones')
      return tab === 'historial'
        ? map(data.events, (e) => ({
            id: e.id,
            vehicle_id: e.vehicle_id,
            title: {
              vehiculos: 'Publicación actualizada',
              reservas: 'Cambio de reserva',
              resenas: 'Nueva reseña',
              ganancias: 'Movimiento financiero',
              mantenimientos: 'Cambio de mantenimiento',
              documentos: 'Renovación documental',
              incidencias: 'Novedad en un caso',
            }[e.module],
            detail: '#' + e.record_id + ' · ' + ((e.detail.despues || e.detail).status || e.action),
            status: e.read_at ? 'LEIDA' : 'NUEVA',
            date: e.created_at.slice(0, 10),
            record: e,
          }))
        : alerts(data).map((a) => ({
            id: a.key,
            vehicle_id: a.vehicle_id,
            title: a.title,
            detail: a.description,
            status: 'ALERTA',
            date: a.date,
            record: a,
          }));
    return [];
  });
  const states = $derived([...new Set(rows.map((r) => r.status).filter(Boolean))]);
  const filtered = $derived(
    rows.filter(
      (r) =>
        (!view.vehicle || module === 'flota' || r.vehicle_id === Number(view.vehicle)) &&
        (module === 'flota' ||
          !view.from ||
          (module === 'reservas' ? r.endDate > view.from : r.date >= view.from)) &&
        (module === 'flota' || !view.to || r.date <= view.to) &&
        (!view.filter || r.status === view.filter) &&
        normalize([r.title, r.detail, carLabel(r.vehicle_id)].join(' ')).includes(
          normalize(view.query),
        ),
    ),
  );
  const page = $derived(paginar(filtered, view.page));
  let previous = untrack(() =>
    JSON.stringify([view.query, view.filter, view.from, view.to, view.vehicle, tab]),
  );
  $effect(() => {
    const signature = JSON.stringify([
      view.query,
      view.filter,
      view.from,
      view.to,
      view.vehicle,
      tab,
    ]);
    if (signature !== previous) {
      view.page = 1;
      previous = signature;
    }
  });
  function report() {
    if (module === 'ganancias') {
      download('citycars-movimientos.csv', [
        [
          'Fecha',
          'Reserva',
          'Vehículo',
          'Tipo',
          'Referencia',
          'Importe COP',
          'Comisión asignada COP',
          'Neto generado COP',
        ],
        ...filtered.map((row) => {
          const e = row.record;
          return [
            e.paid_on,
            e.reservation_id,
            carLabel(e.vehicle_id),
            e.kind,
            e.reference,
            e.amount,
            e.commission,
            e.kind === 'COBRO'
              ? (Math.round(Number(e.amount) * 100) - Math.round(e.commission * 100)) / 100
              : '',
          ];
        }),
      ]);
      return;
    }

    download('citycars-' + module + '.csv', [
      ['Registro', 'Vehículo', 'Detalle', 'Estado', 'Fecha'],
      ...filtered.map((r) => [r.title, carLabel(r.vehicle_id), r.detail, r.status, r.date]),
    ]);
  }
</script>

{#if module === 'flota'}<section class="panel">
    <h2>¿Qué muestra la composición de flota?</h2>
    <p>
      Agrupa tus vehículos por marca y modelo, reuniendo sus años y estados. Incluye los archivados
      para conservar la visión de toda tu flota.
    </p>
    <p>
      Compara cuántos vehículos tienes, sus cobros registrados, días de alquiler transcurridos y
      kilómetros medidos en el período seleccionado. Los cobros no equivalen al beneficio neto: no
      se descuentan aquí las comisiones ni los mantenimientos.
    </p>
    <p>
      Úsalo para identificar concentración en una marca, comparar demanda y decidir qué modelos
      conviene revisar, mantener o ampliar. Un grupo con más ingresos puede tener más vehículos;
      compara también sus resultados individuales en Ganancias y Uso y kilometraje.
    </p>
  </section>{/if}
{#if ['ganancias', 'resenas', 'kilometraje'].includes(module)}<div
    class="admin-tabs"
    role="group"
    aria-label="Contenido del módulo"
  >
    <button aria-pressed={insights} onclick={() => (insights = true)}>Indicadores</button><button
      aria-pressed={!insights}
      onclick={() => (insights = false)}>Registros e historial</button
    >
  </div>{/if}
{#if insights}
  {#if module === 'ganancias'}
    <button onclick={report} disabled={!filtered.length}>Descargar movimientos del período</button>
    <div class="admin-metrics">
      {#each [['Cobros registrados', m.gross], ['Comisión de cobros', m.commission], ['Neto generado', m.net], ['Desembolsos registrados', m.payouts]] as [name, value]}<article
          class="panel"
        >
          <small>{name}</small><strong>{money(value)}</strong>
        </article>{/each}
    </div>
    <p class="admin-note">
      Pendiente de desembolso de alquileres finalizados y cobrados: {money(m.pending)} (saldo acumulado).
      Las reservas con pago simulado no acreditan cobros ni generan un saldo pagadero. Aquí se muestran
      movimientos documentados por administración; no se realizan transferencias desde este panel.
    </p>
    <section class="panel">
      <h2>Evolución de cobros</h2>
      <SelectorPersonalizado
        id="income-period"
        label="Agrupar por"
        bind:value={group}
        options={options(['DIARIA', 'SEMANAL', 'MENSUAL', 'ANUAL'])}
      /><Grafico title="Cobros por período" points={series} format={money} />
    </section>
    <Grafico
      title="Cobros por vehículo"
      points={m.usage.map((v) => ({
        label: v.brand + ' ' + v.model + ' #' + v.id,
        value: v.gross,
      }))}
      format={money}
    /><Grafico
      title="Desembolsos pendientes por reserva (saldo acumulado)"
      format={money}
      points={data.reservations
        .filter(
          (r) =>
            r.status === 'FINALIZADA' && (!view.vehicle || r.vehicle_id === Number(view.vehicle)),
        )
        .map((r) => {
          const es = data.entries.filter((e) => e.reservation_id === r.id);
          const sum = (k) =>
            es
              .filter((e) => e.kind === k)
              .reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
          return {
            label: 'Reserva #' + r.id + ' · ' + carLabel(r.vehicle_id),
            value:
              sum('COBRO') === Math.round(Number(r.total) * 100)
                ? Math.max(
                    0,
                    Math.round((Number(r.total) - Number(r.commission)) * 100) - sum('DESEMBOLSO'),
                  ) / 100
                : 0,
          };
        })
        .filter((p) => p.value > 0)}
    />
  {:else if module === 'resenas'}<div class="panel">
      <h2>{m.rating ? m.rating.toFixed(1) + ' / 5' : 'Sin calificaciones'}</h2>
      <p>
        {m.reviews.length} opiniones de alquileres finalizados. Abre una reseña para consultar la recomendación.
      </p>
      {#each [5, 4, 3, 2, 1] as stars}<div class="owner-bar">
          <span
            >{stars} estrellas
            <strong>{m.reviews.filter((r) => r.rating === stars).length}</strong></span
          ><progress
            max={Math.max(1, m.reviews.length)}
            value={m.reviews.filter((r) => r.rating === stars).length}
            aria-label={stars + ' estrellas'}
          ></progress>
        </div>{/each}
    </div>
    <Grafico
      title="Calificación por vehículo"
      max={5}
      points={m.vehicles.map((v) => {
        const list = m.reviews.filter((r) => r.vehicle_id === v.id);
        return {
          label: v.brand + ' ' + v.model + ' #' + v.id,
          value: list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0,
          note: list.length + ' reseñas',
        };
      })}
      format={(n) => (n ? n.toFixed(1) + ' / 5' : 'Sin reseñas')}
    />
    <section class="panel">
      <h2>Temas mencionados en opiniones</h2>
      <p class="admin-note">
        Conteo de menciones textuales para orientar la revisión; no es una evaluación automática del
        servicio.
      </p>
      {#each ['limpieza', 'puntualidad', 'comodidad', 'consumo', 'estado'] as word}{@const count =
          m.reviews.filter((r) =>
            normalize(r.comment + ' ' + r.recommendation).includes(word),
          ).length}{#if count}<button onclick={() => (view.query = word)}
            >{word}: {count} opiniones</button
          >{/if}{/each}
      <p>Consulta las reseñas para conocer el contexto y las sugerencias completas.</p>
    </section>
  {:else if module === 'kilometraje'}<section class="panel">
      <h2>Utilización por vehículo</h2>
      <p class="admin-note">
        Días contratados no cancelados, limitados al período transcurrido hasta hoy. Kilómetros
        calculados a partir de entregas y devoluciones registradas.
      </p>
      <Grafico
        title="Utilización de la flota"
        max={100}
        points={[...m.usage]
          .sort((a, b) => b.days - a.days)
          .map((v) => ({
            label: v.brand + ' ' + v.model + ' #' + v.id,
            value: v.occupancy,
            note:
              (v.mileage ?? 'Sin registrar') +
              ' km actuales · ' +
              v.days +
              ' días · ' +
              v.km +
              ' km recorridos',
          }))}
        format={(n) => n + '%'}
      />
    </section>
    <Grafico
      title="Evolución del odómetro (selecciona un vehículo para comparar lecturas)"
      points={data.reservations
        .filter(
          (r) => r.delivery_km != null && (!view.vehicle || r.vehicle_id === Number(view.vehicle)),
        )
        .flatMap((r) => [
          {
            label: carLabel(r.vehicle_id) + ' · Entrega ' + r.delivered_at.slice(0, 10),
            date: r.delivered_at.slice(0, 10),
            value: r.delivery_km,
          },
          ...(r.return_km != null
            ? [
                {
                  label: carLabel(r.vehicle_id) + ' · Devolución ' + r.returned_at.slice(0, 10),
                  date: r.returned_at.slice(0, 10),
                  value: r.return_km,
                },
              ]
            : []),
        ])
        .filter((p) => (!view.from || p.date >= view.from) && (!view.to || p.date <= view.to))
        .sort((a, b) => a.date.localeCompare(b.date))}
      format={(n) => n.toLocaleString('es-CO') + ' km'}
    />
  {:else if module === 'documentos'}<p class="admin-note">
      Alertas a 30, 15 y 7 días, el día del vencimiento y después. Las fechas son declaradas, no
      verificadas oficialmente. La técnico-mecánica aparece entre los requisitos cuando está marcada
      como exigible en la ficha del vehículo.
    </p>
  {/if}
{/if}
{#if !['ganancias', 'resenas', 'kilometraje'].includes(module) || !insights}
  {#if ['documentos', 'notificaciones'].includes(module)}<div
      class="admin-tabs"
      role="group"
      aria-label="Vistas"
    >
      <button aria-pressed={tab === 'actuales'} onclick={() => (tab = 'actuales')}
        >{module === 'documentos' ? 'Vigencia actual' : 'Alertas pendientes'}</button
      ><button aria-pressed={tab === 'historial'} onclick={() => (tab = 'historial')}
        >{module === 'documentos' ? 'Historial de renovaciones' : 'Novedades'}</button
      >
    </div>{/if}
  <div class="admin-filters panel">
    <label
      >Buscar<input
        type="search"
        bind:value={view.query}
        placeholder="Buscar en este módulo"
      /></label
    ><SelectorPersonalizado
      id={'owner-status-' + module}
      label="Estado"
      bind:value={view.filter}
      options={options(states)}
      emptyLabel="Todos"
    /><button
      onclick={() => {
        view.query = '';
        view.filter = '';
        view.from = '';
        view.to = '';
        view.vehicle = '';
      }}>Limpiar filtros</button
    >
  </div>
  <div class="admin-list-tools">
    <p>{filtered.length} registros</p>
    <button onclick={report} disabled={!filtered.length}>Descargar CSV</button>
    {#if module === 'vehiculos'}<button
        class="button"
        disabled={user.suspended || busy}
        onclick={() => open('vehicle')}>Publicar vehículo</button
      >{:else if module === 'mantenimientos'}<button
        class="button"
        disabled={user.suspended || busy}
        onclick={() => open('maintenance')}>Registrar mantenimiento</button
      >{:else if module === 'documentos'}<button
        class="button"
        disabled={user.suspended || busy}
        onclick={() => open('document')}>Registrar renovación</button
      >{:else if module === 'incidencias'}<button
        class="button"
        disabled={user.suspended || busy}
        onclick={() => open('case')}>Crear reporte</button
      >{/if}
  </div>
  <section class="admin-table-card">
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="admin-table-wrap" role="region" tabindex="0" aria-label="Listado del módulo">
      <table class="admin-table">
        <thead
          ><tr
            ><th>Registro</th><th>Vehículo / detalle</th><th>Estado</th><th>Fecha</th><th
              >Acciones</th
            ></tr
          ></thead
        ><tbody>
          {#each page.rows as row}<tr
              ><td
                ><div class="owner-vehicle-preview">
                  {#if module === 'vehiculos'}<img
                      src={row.record.image || '/imagenes/vehicle-placeholder.svg'}
                      alt={'Imagen principal de ' + row.title}
                      loading="lazy"
                    />{/if}<strong>{row.title}</strong>
                </div></td
              ><td
                ><strong>{module === 'flota' ? 'Composición' : carLabel(row.vehicle_id)}</strong
                ><small class="owner-clamp">{row.detail}</small></td
              ><td><span class="badge">{row.status || '—'}</span></td><td>{row.date || '—'}</td><td
                ><div class="owner-row-actions">
                  {#if row.kind}<button onclick={() => open(row.kind, row.id)}>Ver #{row.id}</button
                    >{/if}
                  {#if module === 'vehiculos' && row.record.archived}<button
                      disabled={user.suspended || busy}
                      onclick={() => open('state', row.id, { action: 'DESARCHIVAR' })}
                      >Desarchivar vehículo</button
                    >{/if}
                  {#if module === 'vehiculos' && !row.record.archived}<button
                      disabled={user.suspended || busy || row.record.blocked}
                      onclick={() => open('vehicle', row.id)}>Editar</button
                    ><button
                      disabled={user.suspended || busy}
                      onclick={() =>
                        open('state', row.id, {
                          action: row.record.paused ? 'REACTIVAR' : 'PAUSAR',
                        })}>{row.record.paused ? 'Reactivar' : 'Pausar'}</button
                    ><button
                      disabled={user.suspended || busy}
                      onclick={() => open('state', row.id, { action: 'ARCHIVAR' })}>Archivar</button
                    >{/if}
                  {#if module === 'reservas' && row.record.status === 'CONFIRMADA'}{#if row.record.return_km == null}<button
                        disabled={user.suspended || busy}
                        onclick={() => open('odometer', row.id)}>Kilometraje</button
                      >{/if}{#if row.record.end_date <= data.today}<button
                        disabled={user.suspended || busy}
                        onclick={() => mutate('/reservations/' + row.id + '/finish', {})}
                        >Finalizar</button
                      >{/if}{/if}
                  {#if module === 'mantenimientos' && row.record.status === 'PROGRAMADO'}<button
                      disabled={user.suspended || busy}
                      onclick={() => open('complete', row.id)}>Completar / cancelar</button
                    >{/if}
                  {#if module === 'documentos'}<button
                      disabled={user.suspended || busy}
                      onclick={() => open('document', null, { vehicleId: row.vehicle_id })}
                      >Renovar</button
                    >{#if row.record.file_id}<a href={'/api/files/' + row.record.file_id}>Adjunto</a
                      >{/if}{/if}
                  {#if module === 'notificaciones'}<button
                      onclick={() => navigate(row.record.module, row.vehicle_id)}
                      >Ir al módulo</button
                    >{#if tab === 'historial' && !row.record.read_at}<button
                        disabled={user.suspended || busy}
                        onclick={() => mutate('/owner/events/' + row.id + '/read', {})}
                        >Marcar leída</button
                      >{/if}{/if}
                </div></td
              ></tr
            >{:else}<tr
              ><td colspan="5"
                ><div class="admin-empty">No hay registros que coincidan con los filtros.</div></td
              ></tr
            >{/each}
        </tbody>
      </table>
    </div>
    <nav class="admin-pagination" aria-label="Paginación">
      <span>{page.start}–{page.end} de {page.total}</span>
      <div>
        <button disabled={page.page === 1} onclick={() => (view.page = page.page - 1)}
          >Anterior</button
        ><span>Página {page.page} de {page.pages}</span><button
          disabled={page.page === page.pages}
          onclick={() => (view.page = page.page + 1)}>Siguiente</button
        >
      </div>
    </nav>
  </section>
{/if}
