<!--
Presenta tablas y acciones del módulo seleccionado; comunica acciones al panel contenedor.
Capa: Vista / presentación. Relación: svelte, ../../api.js, ../SelectorPersonalizado.svelte, ./presentacion.js
-->
<script>
  import { untrack } from 'svelte';
  import { money } from '../../api.js';
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import { filtrarRegistros, paginar, label, date, options, reservasCsv } from './presentacion.js';
  let { data, module, view, open } = $props();
  let last = $state(untrack(() => view.query + '|' + view.filter));
  $effect(() => {
    const signature = view.query + '|' + view.filter;
    if (last !== signature) {
      view.page = 1;
      last = signature;
    }
  });
  const rows = $derived(filtrarRegistros(data, module, view));
  const result = $derived(paginar(rows, view.page));
  /** Genera una descarga CSV local desde filas ya autorizadas; no consulta información adicional al servidor. */
  function download() {
    const url = URL.createObjectURL(
      new Blob([reservasCsv(rows)], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'citycars-reservas.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

{#if module.id === 'incidencias'}<div class="admin-list-tools">
    <p>Consulta los casos o registra una incidencia nueva.</p>
    <button class="button" onclick={() => open('newIncident')}>Nueva incidencia</button>
  </div>{/if}
<div class="admin-filters panel">
  <label
    >Buscar en {module.name.toLowerCase()}<input
      type="search"
      bind:value={view.query}
      placeholder="Nombre, ID o información relacionada"
    /></label
  >{#if module.states.length}<SelectorPersonalizado
      id={'admin-filter-' + module.id}
      label="Estado"
      bind:value={view.filter}
      emptyLabel="Todos los estados"
      options={options(module.states)}
    />{/if}<button
    disabled={!view.query && !view.filter}
    onclick={() => {
      view.query = '';
      view.filter = '';
      view.page = 1;
    }}>Limpiar filtros</button
  >
</div>
{#if module.id === 'reservas'}<div class="admin-list-tools">
    <small>Importes simulados. El CSV incluye todas las coincidencias, no solo esta página.</small
    ><button onclick={download}>Exportar reporte CSV</button>
  </div>{/if}
<section class="admin-table-card">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (Permite desplazar la tabla con teclado.) -->
  <div class="admin-table-wrap" role="region" aria-label={module.name} tabindex="0">
    <table>
      {#if module.id === 'publicaciones'}<thead
          ><tr
            ><th>Vehículo</th><th>Propietario</th><th>Ciudad / tarifa</th><th>Estado</th><th
              >Acciones</th
            ></tr
          ></thead
        ><tbody
          >{#each result.rows as v}<tr
              ><td
                ><div class="admin-vehicle">
                  <img src={v.image || '/imagenes/vehicle-placeholder.svg'} alt="" />
                  <div><strong>{v.brand} {v.model}</strong><small>#{v.id} · {v.year}</small></div>
                </div></td
              ><td
                ><button class="admin-link" onclick={() => open('owner', v.owner_id)}
                  >{v.owner_name}</button
                ><small>{v.owner_email}</small></td
              ><td>{v.city}<small>{money(v.daily_price)} / día</small></td><td
                ><span class="badge"
                  >{v.blocked || v.owner_suspended ? 'SUSPENDIDA' : label(v.status)}</span
                ></td
              ><td><button onclick={() => open('vehicle', v.id)}>Gestionar #{v.id}</button></td></tr
            >{/each}</tbody
        >
      {:else if module.id === 'propietarios'}<thead
          ><tr
            ><th>Propietario</th><th>Estado</th><th>Vehículos</th><th>Reservas confirmadas</th><th
              >Acciones</th
            ></tr
          ></thead
        ><tbody
          >{#each result.rows as o}<tr
              ><td><strong>{o.name}</strong><small>#{o.id} · {o.email}</small></td><td
                ><span class="badge">{o.suspended ? 'SUSPENDIDO' : 'HABILITADO'}</span></td
              ><td>{o.vehicle_count}</td><td>{o.confirmed_count}</td><td
                ><button onclick={() => open('owner', o.id)}>Ver ficha #{o.id}</button></td
              ></tr
            >{/each}</tbody
        >
      {:else if module.id === 'reservas'}<thead
          ><tr
            ><th>Reserva / vehículo</th><th>Arrendatario</th><th>Período</th><th>Estado</th><th
              >Total / comisión</th
            ><th>Detalle</th></tr
          ></thead
        ><tbody
          >{#each result.rows as r}<tr
              ><td><strong>#{r.id} · {r.brand} {r.model}</strong><small>{r.city}</small></td><td
                >{r.renter_name}</td
              ><td>{r.start_date}<small>→ {r.end_date}</small></td><td
                ><span class="badge">{r.status}</span></td
              ><td
                ><strong>{money(r.total)}</strong><small>{money(r.commission)} de comisión</small
                ></td
              ><td><button onclick={() => open('reservation', r.id)}>Ver #{r.id}</button></td></tr
            >{/each}</tbody
        >
      {:else if module.id === 'incidencias'}<thead
          ><tr
            ><th>Caso</th><th>Prioridad</th><th>Estado</th><th>Actualización</th><th>Acciones</th
            ></tr
          ></thead
        ><tbody
          >{#each result.rows as i}<tr
              ><td
                ><strong>#{i.id} · {i.title}</strong><small
                  >Vehículo {i.vehicle_id ? '#' + i.vehicle_id : 'sin vincular'}</small
                ></td
              ><td>{i.priority}</td><td><span class="badge">{label(i.status)}</span></td><td
                >{date(i.updated_at)}</td
              ><td><button onclick={() => open('incident', i.id)}>Gestionar #{i.id}</button></td
              ></tr
            >{/each}</tbody
        >
      {:else}<thead
          ><tr
            ><th>Fecha</th><th>Acción</th><th>Registro</th><th>Responsable</th><th>Detalle</th></tr
          ></thead
        ><tbody
          >{#each result.rows as a}<tr
              ><td>{date(a.created_at)}</td><td>{label(a.action)}</td><td
                >{a.entity_type} #{a.entity_id}</td
              ><td>{a.admin_name}</td><td
                ><button onclick={() => open('action', a.id)}>Ver motivo #{a.id}</button></td
              ></tr
            >{/each}</tbody
        >{/if}
    </table>
  </div>
  {#if !rows.length}<div class="admin-empty">
      <h2>No hay registros para esta vista</h2>
      <p>Prueba otros filtros o actualiza los datos.</p>
    </div>{/if}
  <nav class="admin-pagination" aria-label="Paginación del listado">
    <span aria-live="polite">{result.start}–{result.end} de {result.total}</span>
    <div>
      <button disabled={result.page === 1} onclick={() => (view.page = result.page - 1)}
        >Anterior</button
      ><span>Página {result.page} de {result.pages}</span><button
        disabled={result.page === result.pages}
        onclick={() => (view.page = result.page + 1)}>Siguiente</button
      >
    </div>
  </nav>
</section>
