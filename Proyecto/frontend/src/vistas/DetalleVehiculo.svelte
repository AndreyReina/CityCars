<!--
Consulta el vehículo, cotiza el intervalo y confirma una reserva con resultado de pago simulado.
Capa: Vista / presentación. Relación: svelte, ../api.js
-->
<script>
  import { onMount } from 'svelte';
  import { api, money, today } from '../api.js';
  let { id, user } = $props();
  const params = new URLSearchParams(location.search);
  let startTime = $state(params.get('startTime') || '09:00'),
    endTime = $state(params.get('endTime') || '09:00');
  let vehicle = $state(null),
    error = $state(''),
    start = $state(params.get('start') || ''),
    end = $state(params.get('end') || ''),
    quote = $state(null),
    busy = $state(false),
    success = $state('');
  onMount(() => {
    api('/vehicles/' + id)
      .then((v) => (vehicle = v))
      .catch((e) => (error = e.message));
  });
  async function preview(e) {
    e.preventDefault();
    busy = true;
    quote = null;
    error = '';
    success = '';
    try {
      quote = await api(
        '/vehicles/' + id + '/quote?' + new URLSearchParams({ start, end, startTime, endTime }),
      );
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
  async function reserve(payment) {
    busy = true;
    error = '';
    try {
      const r = await api('/reservations', {
        method: 'POST',
        body: {
          vehicleId: id,
          start,
          end,
          startTime,
          endTime,
          payment,
          expectedTotal: quote.total,
        },
      });
      success = 'Reserva #' + r.id + ' confirmada. Puedes consultarla en Mi cuenta.';
      quote = null;
    } catch (e) {
      error = e.message;
      quote = null;
    } finally {
      busy = false;
    }
  }
</script>

<section class="page">
  <a href="/carros">← Volver al catálogo</a>{#if error}<p class="error" role="alert">
      {error}
    </p>{/if}
  {#if vehicle}<div class="split">
      <div class="stack">
        <p class="eyebrow">{vehicle.city} · {vehicle.year}</p>
        <h1>{vehicle.brand} {vehicle.model}</h1>
        <img
          class="detail-image"
          src={vehicle.image || '/imagenes/vehicle-placeholder.svg'}
          alt={vehicle.brand + ' ' + vehicle.model}
        />
        <p class="lead">{vehicle.description}</p>
        {#if vehicle.features}<h2>Características</h2>
          <p>{vehicle.features}</p>{/if}
        {#if vehicle.conditions}<h2>Condiciones del alquiler</h2>
          <p>{vehicle.conditions}</p>{/if}
        {#each vehicle.photos || [] as photo}<img
            class="detail-image"
            src={photo}
            alt={'Fotografía de ' + vehicle.brand + ' ' + vehicle.model}
          />{/each}
        <p class="muted">
          Consulta la descripción, el precio y la disponibilidad antes de elegir tus fechas.
        </p>
      </div>
      <div class="panel">
        <h2>{money(vehicle.daily_price)} / día</h2>
        <form onsubmit={preview}>
          <label
            >Inicio<input
              type="date"
              min={today()}
              required
              bind:value={start}
              onchange={() => {
                quote = null;
                success = '';
              }}
            /></label
          ><label
            >Devolución<input
              type="date"
              min={start || today()}
              required
              bind:value={end}
              onchange={() => {
                quote = null;
                success = '';
              }}
            /></label
          >
          <div class="rental-time-fields">
            <label
              >Hora de recogida<input
                type="time"
                required
                bind:value={startTime}
                onchange={() => (quote = null)}
              /></label
            ><label
              >Hora de devolución<input
                type="time"
                required
                bind:value={endTime}
                onchange={() => (quote = null)}
              /></label
            >
          </div>
          <p class="muted">
            Alquiler por días de calendario, mínimo un día entre fechas. Horarios de Colombia.
          </p>
          <button class="button" disabled={busy}>Consultar disponibilidad y precio</button>
        </form>
        {#if quote}<dl>
            <dt>Días</dt>
            <dd>{quote.days}</dd>
            <dt>Total del alquiler</dt>
            <dd>{money(quote.total)}</dd>
            {#if user?.role === 'ADMINISTRADOR' || (user?.role === 'PROPIETARIO' && user.id === vehicle.owner_id)}
              <dt>Comisión de la plataforma (10 %)</dt>
              <dd>{money(quote.commission)}</dd>
            {/if}
          </dl>
          {#if user?.role === 'ARRENDATARIO'}<p>
              Pago simulado: selecciona el resultado. No hay cobros reales.
            </p>
            <button class="button" disabled={busy} onclick={() => reserve('APROBADO')}
              >Simular aprobado y reservar</button
            ><button class="button secondary" disabled={busy} onclick={() => reserve('RECHAZADO')}
              >Simular pago rechazado</button
            >{:else if !user}<a class="button" href={'/ingresar?next=/carros/' + id}
              >Ingresar para reservar</a
            >{:else}<p>Solo las cuentas de arrendatario pueden reservar.</p>{/if}{/if}
        {#if success}<p class="success" role="status">{success}</p>
          <a class="button" href="/panel#/reservas">Ver mis reservas</a>{/if}
      </div>
    </div>{:else if !error}<p>Cargando automóvil…</p>{/if}
</section>
