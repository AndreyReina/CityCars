<!--
Presenta indicadores calculados a partir de los datos reales del panel.
Capa: Vista / presentación. Relación: ../../api.js, ./presentacion.js
-->
<script>
  import { money } from '../../api.js';
  import { metrics, alerts, estadoReserva, serieIngresos, estadoVehiculo } from './presentacion.js';
  let { data, view, navigate } = $props();
  const m = $derived(metrics(data, view));
  const reminders = $derived(
    alerts(data).filter((a) => !view.vehicle || a.vehicle_id === Number(view.vehicle)),
  );
  const available = $derived(
    m.vehicles.filter(
      (v) =>
        v.status === 'APROBADO' &&
        !v.paused &&
        !v.archived &&
        !v.blocked &&
        !v.document_blocked &&
        !data.reservations.some(
          (r) => r.vehicle_id === v.id && estadoReserva(r, data.today) === 'ACTIVA',
        ) &&
        !data.maintenance.some(
          (x) =>
            x.vehicle_id === v.id &&
            x.status === 'PROGRAMADO' &&
            x.start_date <= data.today &&
            x.end_date > data.today,
        ),
    ).length,
  );
  const month = $derived(data.today.slice(0, 7));
  const monthly = $derived(
    metrics(data, { vehicle: view.vehicle, from: month + '-01', to: data.today }),
  );
  const lifetime = $derived(metrics(data, { vehicle: view.vehicle, from: '', to: '' }));
  const series = $derived(serieIngresos(m.entries, 'MENSUAL'));
  const max = $derived(Math.max(1, ...series.map((s) => s.value)));
</script>

<div class="admin-metrics">
  {#each [['Vehículos publicados', m.vehicles.filter((v) => !v.archived).length, 'vehiculos'], ['Publicaciones activas', m.vehicles.filter((v) => v.status === 'APROBADO' && !v.paused && !v.archived && !v.blocked && !v.document_blocked).length, 'vehiculos'], ['Pausadas / pendientes', m.vehicles.filter((v) => v.paused && !v.archived).length + ' / ' + m.vehicles.filter((v) => v.status === 'PENDIENTE_APROBACION' && !v.archived).length, 'vehiculos'], ['Alquilados actualmente', m.vehicles.filter( (v) => data.reservations.some((r) => r.vehicle_id === v.id && estadoReserva(r, data.today) === 'ACTIVA') ).length, 'reservas']] as [label, value, module]}
    <button class="panel owner-metric" onclick={() => navigate(module)}
      ><small>{label}</small><strong>{value}</strong><span>Consultar →</span></button
    >{/each}
</div>
<div class="admin-metrics">
  {#each [['Neto registrado este mes', money(monthly.net), 'ganancias'], ['Neto registrado acumulado', money(lifetime.net), 'ganancias'], ['Kilómetros registrados', m.km.toLocaleString('es-CO'), 'kilometraje'], ['Calificación del período', m.rating ? m.rating.toFixed(1) + ' / 5' : 'Sin reseñas', 'resenas']] as [label, value, module]}<button
      class="panel owner-metric"
      onclick={() => navigate(module)}
      ><small>{label}</small><strong>{value}</strong><span>Consultar →</span></button
    >{/each}
</div>
<div class="admin-columns">
  <section class="panel">
    <h2>Prioridades de mi flota</h2>
    <p>{reminders.length} alertas documentales o de mantenimiento</p>
    {#each reminders.slice(0, 4) as a}<button
        class="owner-alert"
        onclick={() => navigate(a.module, a.vehicle_id)}
        ><strong>{a.title}</strong><small
          >{data.vehicles.find((v) => v.id === a.vehicle_id)?.brand} · {a.description}</small
        ></button
      >{:else}<p>No hay vencimientos ni mantenimientos próximos.</p>{/each}
    <button onclick={() => navigate('notificaciones')}>Ver todas las alertas</button>
    <p>
      {data.incidents.filter(
        (i) =>
          !['RESUELTA', 'CERRADA'].includes(i.status) &&
          (!view.vehicle || i.vehicle_id === Number(view.vehicle)),
      ).length} casos pendientes
    </p>
    <button onclick={() => navigate('incidencias')}>Centro de atención</button>
  </section>
  <section class="panel">
    <h2>Reservas del período</h2>
    <p>
      {available} vehículos disponibles hoy (según reservas, bloqueos y documentos registrados).
    </p>
    {#each ['ACTIVA', 'PROXIMA', 'PENDIENTE_CIERRE', 'FINALIZADA', 'CANCELADA'] as state}{@const count =
        m.reservations.filter((r) => estadoReserva(r, data.today) === state).length}
      <div class="owner-bar">
        <span>{state.replaceAll('_', ' ')} <strong>{count}</strong></span><progress
          max={Math.max(1, m.reservations.length)}
          value={count}
          aria-label={state}
        ></progress>
      </div>{/each}<button onclick={() => navigate('reservas')}>Gestionar reservas</button>
    <p>{m.days} días de uso registrados en el período, hasta hoy.</p>
  </section>
</div>
<section class="panel">
  <h2>Evolución de cobros registrados</h2>
  <p class="admin-note">
    Solo movimientos reales registrados por administración. Las reservas del flujo de pago simulado
    no se contabilizan como dinero cobrado.
  </p>
  {#each series.slice(-6) as point}<div class="owner-bar">
      <span>{point.label}<strong>{money(point.value)}</strong></span><progress
        {max}
        value={point.value}
        aria-label={'Cobros ' + point.label}
      ></progress>
    </div>{:else}<p>No hay cobros registrados para el período seleccionado.</p>{/each}<button
    onclick={() => navigate('ganancias')}>Ver detalle financiero</button
  >
</section>
