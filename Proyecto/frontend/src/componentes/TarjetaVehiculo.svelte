<!--
Presenta los datos de un vehículo del catálogo público y enlaza su detalle.
Capa: Vista / presentación. Relación: ../api.js
-->
<script>
  import { money } from '../api.js';
  let { vehicle } = $props();
</script>

<article class="panel">
  <img
    class="car-image"
    src={vehicle.image || '/imagenes/vehicle-placeholder.svg'}
    alt={vehicle.brand + ' ' + vehicle.model}
    onerror={(e) => {
      e.currentTarget.onerror = null;
      e.currentTarget.src = '/imagenes/Logo.svg';
    }}
  /><span class="eyebrow">{vehicle.city} · {vehicle.year}</span>
  <h2>{vehicle.brand} {vehicle.model}</h2>
  <p><span class="price">{money(vehicle.daily_price)}</span> / día</p>
  <a class="button secondary" href={'/carros/' + vehicle.id}>Ver automóvil →</a>
</article>
