<!--
Enlaza marca, modelos dependientes y municipios con los catálogos compartidos.
Capa: Vista / presentación. Relación: ../SelectorPersonalizado.svelte, ../../datos/catalogoPublicacion.js
-->
<script>
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import {
    opcionesMarcas,
    opcionesModelos,
    opcionesCiudades,
  } from '../../datos/catalogoPublicacion.js';
  let {
    brand = $bindable(''),
    model = $bindable(''),
    city = $bindable(''),
    original = {},
    disabled = false,
  } = $props();
  const brands = $derived(opcionesMarcas(original));
  const models = $derived(opcionesModelos(brand, original));
  const locations = $derived(opcionesCiudades(original));
  function selectBrand(next) {
    if (next !== brand) {
      brand = next;
      model = '';
    }
  }
</script>

<SelectorPersonalizado
  id="publication-brand"
  label="Marca"
  options={brands}
  bind:value={() => brand, selectBrand}
  {disabled}
  placeholder="Selecciona una marca"
/>
<SelectorPersonalizado
  id="publication-model"
  label="Modelo / línea"
  options={models}
  bind:value={model}
  disabled={disabled || !brand}
  placeholder={brand ? 'Selecciona un modelo' : 'Selecciona primero la marca'}
/>
<SelectorPersonalizado
  id="publication-city"
  label="Municipio / ciudad"
  options={locations}
  bind:value={city}
  {disabled}
  placeholder="Selecciona un municipio"
  searchPlaceholder="Busca municipio o departamento…"
/>
