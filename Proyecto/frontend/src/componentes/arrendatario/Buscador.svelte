<!--
Captura destino, fechas y horas; delega la consulta de disponibilidad a la página.
Capa: Vista / presentación. Relación: ../SelectorPersonalizado.svelte, ../../api.js
-->
<script>
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import { today } from '../../api.js';
  let {
    city = $bindable(''),
    start = $bindable(''),
    end = $bindable(''),
    startTime = $bindable('09:00'),
    endTime = $bindable('09:00'),
    cities = [],
    busy = false,
    onsubmit,
  } = $props();
</script>

<form class="rental-search" {onsubmit}>
  <div class="rental-where">
    <span class="search-number">01 / DESTINO</span><SelectorPersonalizado
      id="renter-city"
      label="¿Dónde?"
      bind:value={city}
      options={cities.map((c) => ({ value: c, label: c }))}
      emptyLabel="Todas las ciudades"
      placeholder="Elige tu destino"
    />
  </div>
  <fieldset class="rental-when">
    <legend>02 / ¿CUÁNDO?</legend>
    <div>
      <label
        >Recogida<input
          aria-label="Fecha de recogida"
          type="date"
          required={!!end}
          min={today()}
          bind:value={start}
        /></label
      ><label
        >Hora<input
          aria-label="Hora de recogida"
          type="time"
          required
          bind:value={startTime}
        /></label
      >
    </div>
  </fieldset>
  <fieldset class="rental-when">
    <legend>03 / DEVOLUCIÓN</legend>
    <div>
      <label
        >Devolución<input
          aria-label="Fecha de devolución"
          type="date"
          required={!!start}
          min={start || today()}
          bind:value={end}
        /></label
      ><label
        >Hora<input
          aria-label="Hora de devolución"
          type="time"
          required
          bind:value={endTime}
        /></label
      >
    </div>
  </fieldset>
  <button class="button rental-search-button" disabled={busy}
    >{busy ? 'Buscando…' : 'Buscar vehículos'}<span aria-hidden="true">↗</span></button
  >
</form>
