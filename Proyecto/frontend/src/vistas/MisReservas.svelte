<!--
Consulta reservas del usuario y permite cancelar o valorar según el estado y la titularidad.
Capa: Vista / presentación. Relación: svelte, ../api.js, ../componentes/SelectorPersonalizado.svelte, ../componentes/arrendatario/presentacion.js
-->
<script>
  import { onMount } from 'svelte';
  import { api, money, today } from '../api.js';
  import SelectorPersonalizado from '../componentes/SelectorPersonalizado.svelte';
  import { formatearHorario } from '../componentes/arrendatario/presentacion.js';
  let { user, selectedId = '' } = $props();
  let reservations = $state([]),
    error = $state(''),
    message = $state(''),
    busy = $state(false),
    reviewing = $state(null),
    rating = $state('5'),
    comment = $state(''),
    recommendation = $state('');
  /** Recarga los datos necesarios para la vista y presenta los errores sin ocultarlos al usuario. */
  async function load() {
    try {
      reservations = await api('/reservations');
    } catch (e) {
      error = e.message;
    }
  }
  onMount(() => {
    if (user) load();
  });
  /** Ejecuta la operación solicitada, recarga los datos y comunica éxito o error manteniendo el estado de envío. */
  async function action(path, body) {
    busy = true;
    error = '';
    message = '';
    try {
      await api(path, { method: 'POST', body });
      message = 'Operación guardada correctamente.';
      await load();
      return true;
    } catch (e) {
      error = e.message;
      return false;
    } finally {
      busy = false;
    }
  }
</script>

<section class="page">
  {#if !user}<h1>Inicia sesión para continuar.</h1>
    <a class="button" href="/ingresar">Ingresar</a>
  {:else}<p class="eyebrow">TUS VIAJES EN UN SOLO LUGAR</p>
    <h1>{selectedId ? 'Detalle de mi reserva' : 'Mis reservas'}</h1>
    {#if selectedId}<a href="/panel#/reservas">← Ver todas mis reservas</a>{/if}
    {#if user.suspended}<p class="error" role="alert">
        Tu cuenta está suspendida: {user.suspension_reason}. Puedes consultar tus reservas; las
        operaciones están restringidas.
      </p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}{#if message}<p
        class="success"
        role="status"
      >
        {message}
      </p>{/if}
    <div class="stack">
      {#each reservations.filter((r) => !selectedId || String(r.id) === selectedId) as r}<article
          class="panel"
          id={'reserva-' + r.id}
          class:reservation-selected={selectedId === String(r.id)}
        >
          <div class="actions">
            <span class="badge">{r.status}</span>
            <h3>#{r.id} · {r.brand} {r.model}</h3>
          </div>
          <p>Recogida: {formatearHorario(r.start_date, r.start_time)} · {r.city}</p>
          <p>Devolución: {formatearHorario(r.end_date, r.end_time)} · {r.days} días</p>
          <a href={'/carros/' + r.vehicle_id}>Ver vehículo ↗</a>
          <p>Total del alquiler: <strong>{money(r.total)}</strong></p>
          {#if r.status === 'CONFIRMADA' && today() < r.start_date}<button
              class="button secondary"
              disabled={busy || user.suspended}
              onclick={() => action('/reservations/' + r.id + '/cancel', {})}
              >Cancelar reserva #{r.id}</button
            >{/if}
          {#if r.status === 'FINALIZADA'}{#if r.review_rating}<p>
                Tu calificación: {r.review_rating}/5
              </p>{:else if reviewing === r.id}<form
                onsubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await action('/reservations/' + r.id + '/review', {
                      rating: Number(rating),
                      comment,
                      recommendation,
                    })
                  ) {
                    reviewing = null;
                    comment = '';
                    recommendation = '';
                  }
                }}
              >
                <SelectorPersonalizado
                  id={'review-' + r.id}
                  label="Calificación"
                  bind:value={rating}
                  options={[1, 2, 3, 4, 5].map((n) => ({
                    value: String(n),
                    label: n + ' estrellas',
                  }))}
                  disabled={busy || user.suspended}
                />
                <label
                  >Comentario<textarea required minlength="5" maxlength="2000" bind:value={comment}
                  ></textarea></label
                ><label
                  >Sugerencia (opcional)<textarea maxlength="1000" bind:value={recommendation}
                  ></textarea></label
                ><button class="button" disabled={busy || user.suspended}>Enviar reseña</button
                ><button type="button" disabled={busy} onclick={() => (reviewing = null)}
                  >Cancelar</button
                >
              </form>
            {:else}<button
                class="button secondary"
                disabled={user.suspended}
                onclick={() => {
                  reviewing = r.id;
                  comment = '';
                  recommendation = '';
                  rating = '5';
                }}>Valorar alquiler #{r.id}</button
              >{/if}{/if}
        </article>{:else}<p class="panel">Aún no hay reservas para mostrar.</p>{/each}
    </div>
    <a class="button" href="/carros">Explorar carros</a>{/if}
</section>
