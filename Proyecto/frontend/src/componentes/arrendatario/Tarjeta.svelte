<!--
Presenta imagen, tarifa, ubicación y valoración real; permite alternar favorito.
Capa: Vista / presentación. Relación: ../../api.js
-->
<script>
  import { money } from '../../api.js';
  let { vehicle, query = '', favorite = false, onfavorite, disabled = false } = $props();
</script>

<article class="rental-card">
  <div class="rental-card-photo">
    <a href={'/carros/' + vehicle.id + (query ? '?' + query : '')} tabindex="-1" aria-hidden="true"
      ><img
        loading="lazy"
        src={vehicle.image || '/imagenes/vehicle-placeholder.svg'}
        alt=""
        onerror={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = '/imagenes/vehicle-placeholder.svg';
        }}
      /></a
    ><button
      class="rental-heart"
      {disabled}
      aria-label={(favorite ? 'Quitar de favoritos: ' : 'Guardar en favoritos: ') +
        vehicle.brand +
        ' ' +
        vehicle.model}
      aria-pressed={favorite}
      onclick={() => onfavorite(vehicle.id)}>{favorite ? '♥' : '♡'}</button
    >
  </div>
  <div class="rental-card-body">
    <div class="rental-card-meta">
      <span>{vehicle.city}</span><span
        >{vehicle.review_count
          ? `★ ${vehicle.rating} (${vehicle.review_count})`
          : 'Sin reseñas'}</span
      >
    </div>
    <h3>
      <a href={'/carros/' + vehicle.id + (query ? '?' + query : '')}
        >{vehicle.brand} {vehicle.model}</a
      >
    </h3>
    <p class="muted">Modelo {vehicle.year}</p>
    <div class="rental-card-bottom">
      <p><strong>{money(vehicle.daily_price)}</strong> <span>/ día</span></p>
      <a
        href={'/carros/' + vehicle.id + (query ? '?' + query : '')}
        aria-label={'Ver ' + vehicle.brand + ' ' + vehicle.model}>↗</a
      >
    </div>
  </div>
</article>
