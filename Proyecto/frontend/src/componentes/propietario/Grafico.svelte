<!--
Representa series agregadas mediante recursos gráficos de la vista.
Capa: Vista / presentación. Relación: ../administracion/presentacion.js
-->
<script>
  import { paginar } from '../administracion/presentacion.js';
  let { title, points = [], format = (v) => String(v), max = null } = $props();
  let page = $state(1);
  const visible = $derived(paginar(points, page, 8));
  const scale = $derived(max ?? Math.max(1, ...points.map((p) => p.value)));
</script>

<section class="panel">
  <h2>{title}</h2>
  {#each visible.rows as p}<div class="owner-bar">
      <span>{p.label}<strong>{format(p.value)}</strong></span><progress
        max={scale}
        value={p.value}
        aria-label={p.label}
      ></progress>{#if p.note}<small>{p.note}</small>{/if}
    </div>{:else}<p>No hay datos registrados para el período seleccionado.</p>{/each}
  {#if visible.pages > 1}<nav class="admin-pagination" aria-label={'Paginación de ' + title}>
      <button disabled={visible.page === 1} onclick={() => (page = visible.page - 1)}
        >Anterior</button
      ><span>{visible.page} / {visible.pages}</span><button
        disabled={visible.page === visible.pages}
        onclick={() => (page = visible.page + 1)}>Siguiente</button
      >
    </nav>{/if}
</section>
