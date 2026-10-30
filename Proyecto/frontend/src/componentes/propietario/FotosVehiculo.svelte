<!--
Coordina imágenes principal, interiores y exteriores sin sustituir otras fotografías.
Capa: Vista / presentación. Relación: ./EspacioImagen.svelte
-->
<script>
  import EspacioImagen from './EspacioImagen.svelte';
  let {
    image = $bindable(''),
    photos = $bindable([]),
    categories = $bindable({}),
    uploading = $bindable(false),
    disabled = false,
  } = $props();
  function replace(index, url, category) {
    const previous = photos[index];
    photos = photos.map((p, i) => (i === index ? url : p));
    const next = { ...categories };
    delete next[previous];
    next[url] = category;
    categories = next;
  }
  function remove(index) {
    const previous = photos[index];
    photos = photos.filter((_, i) => i !== index);
    const next = { ...categories };
    if (!photos.includes(previous)) delete next[previous];
    categories = next;
  }
  function add(url, category) {
    if (photos.length >= 10) return;
    photos = [...photos, url];
    categories = { ...categories, [url]: category };
  }
</script>

<section class="vehicle-photos" aria-label="Fotografías del vehículo">
  <h3>Imagen principal</h3>
  <EspacioImagen
    src={image}
    label="Imagen principal"
    disabled={disabled || uploading}
    onchange={(url) => (image = url)}
    onremove={() => (image = '')}
    onbusy={(value) => (uploading = value)}
  />
  <h3>Imágenes adicionales</h3>
  <p class="admin-note">
    JPEG, PNG, WebP, GIF o AVIF. Hasta 8 MB y 24 megapíxeles por imagen; máximo 10 adicionales. Los
    cambios se aplican a la publicación al guardar. Las imágenes animadas se guardan como una
    fotografía.
  </p>
  {#each ['INTERIOR', 'EXTERIOR'] as category}<section>
      <h4>{category === 'INTERIOR' ? 'Interior del vehículo' : 'Exterior del vehículo'}</h4>
      <div class="photo-grid">
        {#each photos as url, index}{#if (categories[url] || 'EXTERIOR') === category}<div
              class="photo-item"
            >
              <EspacioImagen
                src={url}
                label={(category === 'INTERIOR' ? 'Interior' : 'Exterior') +
                  ' · Foto ' +
                  (index + 1)}
                disabled={disabled || uploading}
                onchange={(next) => replace(index, next, category)}
                onremove={() => remove(index)}
                onbusy={(value) => (uploading = value)}
              />
              <button
                type="button"
                disabled={disabled || uploading}
                onclick={() =>
                  (categories = {
                    ...categories,
                    [url]: category === 'INTERIOR' ? 'EXTERIOR' : 'INTERIOR',
                  })}>Mover a {category === 'INTERIOR' ? 'Exterior' : 'Interior'}</button
              >
            </div>{/if}{/each}
        {#if photos.length < 10}<EspacioImagen
            label={'Añadir foto de ' + (category === 'INTERIOR' ? 'interior' : 'exterior')}
            disabled={disabled || uploading}
            onchange={(url) => add(url, category)}
            onremove={() => {}}
            onbusy={(value) => (uploading = value)}
          />{/if}
      </div>
    </section>{/each}
  {#if photos.length >= 10}<p role="status">
      Has añadido las 10 imágenes adicionales permitidas.
    </p>{/if}
</section>

<style>
  .vehicle-photos,
  .vehicle-photos > section {
    display: grid;
    gap: 16px;
  }
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .photo-item {
    display: grid;
    gap: 8px;
    align-content: start;
  }
  h4 {
    font-size: 15px;
  }
  @media (max-width: 600px) {
    .photo-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
