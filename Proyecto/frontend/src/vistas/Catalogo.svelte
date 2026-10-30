<!--
Consulta vehículos y ciudades disponibles con filtros mediante la API.
Capa: Vista / presentación. Relación: svelte, ../api.js, ../componentes/SelectorCiudad.svelte, ../componentes/TarjetaVehiculo.svelte
-->
<script>
  import { onMount } from 'svelte';
  import { api, today } from '../api.js';
  import SelectorCiudad from '../componentes/SelectorCiudad.svelte';
  import TarjetaVehiculo from '../componentes/TarjetaVehiculo.svelte';
  let city = $state(''),
    start = $state(''),
    end = $state(''),
    cities = $state([]),
    vehicles = $state([]),
    busy = $state(true),
    error = $state(''),
    notice = $state('');
  let request = 0;
  const incompleteDates = $derived(Boolean(start) !== Boolean(end));
  /** Consulta catálogo y ciudades en paralelo. Descarta respuestas antiguas para que una búsqueda lenta no sustituya la más reciente. */
  async function search(event) {
    event?.preventDefault();
    const current = ++request;
    error = '';
    notice = '';
    if (incompleteDates) {
      cities = [];
      busy = false;
      return;
    }
    busy = true;
    try {
      const options = await api('/vehicle-cities?' + new URLSearchParams({ start, end }));
      if (current !== request) return;
      cities = options;
      if (city && !cities.includes(city)) {
        city = '';
        notice =
          'La ciudad seleccionada no tiene automóviles disponibles para estas fechas. Te mostramos todas las ciudades.';
      }
      const results = await api('/vehicles?' + new URLSearchParams({ city, start, end }));
      if (current !== request) return;
      vehicles = results;
    } catch (e) {
      if (current !== request) return;
      error = e.message;
      cities = [];
      vehicles = [];
    } finally {
      if (current === request) busy = false;
    }
  }
  onMount(() => {
    search();
  });
</script>

<section class="page">
  <p class="eyebrow">ENCUENTRA TU PRÓXIMO CAMINO</p>
  <h1>Carros para cada ruta.</h1>
  <p class="lead">Elige tu ciudad y encuentra un automóvil disponible para tus fechas.</p>
  <form class="filters panel" onsubmit={search}>
    <SelectorCiudad
      bind:value={city}
      options={cities}
      disabled={busy || incompleteDates || !cities.length}
      placeholder={busy
        ? 'Cargando ciudades…'
        : cities.length
          ? 'Todas las ciudades'
          : 'Sin ciudades disponibles'}
    />
    <label
      >Inicio<input
        type="date"
        min={today()}
        bind:value={start}
        required={!!end}
        onchange={search}
      /></label
    >
    <label
      >Devolución<input
        type="date"
        min={start || today()}
        bind:value={end}
        required={!!start}
        onchange={search}
      /></label
    >
    <button class="button" disabled={busy || incompleteDates}
      >{busy ? 'Buscando…' : 'Buscar carros'}</button
    >
  </form>
  {#if incompleteDates}<p role="status">
      Selecciona las dos fechas para consultar las ciudades y los automóviles disponibles.
    </p>
  {:else if error}<p class="error" role="alert">{error}</p>
  {:else if busy}<p role="status">Buscando automóviles disponibles…</p>
  {:else}
    {#if notice}<p role="status">{notice}</p>{/if}
    {#if !vehicles.length}<div class="empty panel">
        <h2>No hay carros para esta búsqueda.</h2>
        <p>Prueba otra ciudad o fechas diferentes.</p>
      </div>
    {:else}<p class="muted">
        {vehicles.length}
        {vehicles.length === 1 ? 'automóvil encontrado' : 'automóviles encontrados'}
      </p>
      <div class="cards">
        {#each vehicles as vehicle}<TarjetaVehiculo {vehicle} />{/each}
      </div>
    {/if}
  {/if}
</section>
