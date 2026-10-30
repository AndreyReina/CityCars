<!--
Agrupa tarjetas de una ciudad con desplazamiento horizontal y enlace a todos los resultados.
Capa: Vista / presentación. Relación: ./Tarjeta.svelte
-->
<script>
  import Tarjeta from './Tarjeta.svelte';
  let { city, vehicles, query, favorites, onfavorite, disabled } = $props();
  let track;
  function move(direction) {
    track.scrollBy({
      left: direction * track.clientWidth * 0.85,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }
</script>

<section class="rental-city">
  <div class="rental-section-heading">
    <div>
      <p class="eyebrow">TU PRÓXIMA PARADA</p>
      <h2>{city}</h2>
    </div>
    <div class="rental-row-actions">
      <a
        href={'/carros?' +
          new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(query)), city })}
        >Ver todos <span aria-hidden="true">↗</span></a
      ><button onclick={() => move(-1)} aria-label={'Vehículos anteriores en ' + city}>←</button
      ><button onclick={() => move(1)} aria-label={'Vehículos siguientes en ' + city}>→</button>
    </div>
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (La región horizontal permite desplazamiento por teclado.) -->
  <div
    class="rental-track"
    bind:this={track}
    tabindex="0"
    role="region"
    aria-label={'Vehículos destacados en ' + city}
  >
    {#each vehicles.slice(0, 8) as vehicle (vehicle.id)}<Tarjeta
        {vehicle}
        {query}
        favorite={favorites.includes(vehicle.id)}
        {onfavorite}
        {disabled}
      />{/each}
  </div>
</section>
