<!--
Presenta indicadores calculados a partir de los datos reales del panel.
Capa: Vista / presentación. Relación: ../../api.js
-->
<script>
  import { money } from '../../api.js';
  let { data, view, navigate } = $props();
</script>

<div class="admin-tabs" role="group" aria-label="Vistas del resumen">
  {#each [['operacion', 'Operación'], ['finanzas', 'Finanzas'], ['evolucion', 'Evolución mensual']] as [id, name]}<button
      aria-pressed={view.tab === id}
      onclick={() => (view.tab = id)}>{name}</button
    >{/each}
</div>
{#if view.tab === 'operacion'}
  <div class="admin-metrics">
    <article class="panel">
      <span>Publicaciones visibles</span><strong
        >{data.vehicles.filter((v) => v.status === 'APROBADO' && !v.blocked && !v.owner_suspended)
          .length}</strong
      ><small>{data.vehicles.length} vehículos registrados</small>
    </article>
    <article class="panel">
      <span>Propietarios registrados</span><strong>{data.users.owners}</strong><small
        >{data.users.suspended_owners} suspendidos</small
      >
    </article>
    <article class="panel">
      <span>Reservas totales</span><strong>{data.reservations.length}</strong><small
        >Todos los estados</small
      >
    </article>
    <article class="panel">
      <span>Sesiones vigentes</span><strong>{data.users.active_sessions}</strong><small
        >{data.users.enabled} cuentas habilitadas de {data.users.total}</small
      >
    </article>
  </div>
  <div class="admin-columns">
    <article class="panel">
      <h2>Requiere tu atención</h2>
      <div class="admin-queue">
        <div>
          <strong>{data.vehicles.filter((v) => v.status === 'PENDIENTE_APROBACION').length}</strong
          ><span>Publicaciones pendientes</span>
        </div>
        <button
          onclick={() =>
            navigate('publicaciones', { query: '', filter: 'PENDIENTE_APROBACION', page: 1 })}
          >Revisar →</button
        >
      </div>
      <div class="admin-queue">
        <div>
          <strong
            >{data.incidents.filter((i) => !['RESUELTA', 'CERRADA'].includes(i.status))
              .length}</strong
          ><span>Incidencias abiertas o en revisión</span>
        </div>
        <button onclick={() => navigate('incidencias')}>Gestionar →</button>
      </div>
      <small
        >{data.incidents.filter((i) => i.priority === 'ALTA' && i.status !== 'RESUELTA').length} incidencias
        de prioridad alta · {data.vehicles.filter((v) => v.blocked || v.owner_suspended).length} publicaciones
        restringidas.</small
      >
    </article>
    <article class="panel">
      <h2>Estado de las reservas</h2>
      {#each ['CONFIRMADA', 'FINALIZADA', 'CANCELADA'] as status}<div class="admin-bar">
          <div>
            <span>{status}</span><strong
              >{data.reservations.filter((r) => r.status === status).length}</strong
            >
          </div>
          <progress
            aria-label={'Reservas ' + status}
            max={Math.max(data.reservations.length, 1)}
            value={data.reservations.filter((r) => r.status === status).length}
          ></progress>
        </div>{/each}<small>Una sesión vigente no implica presencia en línea.</small>
    </article>
  </div>
{:else if view.tab === 'finanzas'}
  <p class="admin-note">
    Importes simulados: representan operaciones registradas, no ingresos cobrados. Se excluyen las
    reservas canceladas.
  </p>
  <div class="admin-metrics">
    {#each [['Alquileres finalizados', data.finance.completed_total], ['Comisiones de finalizados', data.finance.completed_commission], ['Alquileres confirmados', data.finance.confirmed_total], ['Comisiones de confirmados', data.finance.confirmed_commission]] as [title, value]}<article
        class="panel"
      >
        <span>{title}</span><strong>{money(value)}</strong><small>COP · Pago simulado</small>
      </article>{/each}
  </div>
  <article class="panel">
    <h2>Detalle de las operaciones</h2>
    <p>Consulta los importes por reserva y exporta el reporte de las filas filtradas.</p>
    <div>
      <button class="button" onclick={() => navigate('reservas')}>Ver reservas y reportes</button>
    </div>
  </article>
{:else}
  <article class="panel">
    <h2>Últimos seis meses</h2>
    <small>Reservas por mes de creación. Importes simulados sin canceladas.</small>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Permite desplazar la tabla con teclado.) -->
    <div class="admin-table-wrap" role="region" aria-label="Actividad mensual" tabindex="0">
      <table>
        <thead><tr><th>Mes</th><th>Reservas</th><th>Alquileres</th><th>Comisiones</th></tr></thead
        ><tbody
          >{#each data.months as m}<tr
              ><td>{m.month}</td><td>{m.reservations}</td><td>{money(m.total)}</td><td
                >{money(m.commission)}</td
              ></tr
            >{/each}</tbody
        >
      </table>
    </div>
  </article>
{/if}
