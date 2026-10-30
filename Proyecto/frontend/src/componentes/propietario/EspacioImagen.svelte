<!--
Gestiona vista previa, selección, arrastre, validación y envío de una imagen.
Capa: Vista / presentación. Relación: svelte, ../../api.js
-->
<script>
  import { onDestroy } from 'svelte';
  import { api } from '../../api.js';
  let { src = '', label, disabled = false, onchange, onremove, onbusy } = $props();
  let input,
    preview = $state(''),
    error = $state(''),
    working = $state(false),
    dragging = $state(false),
    broken = $state(false);
  $effect(() => {
    src;
    broken = false;
  });
  onDestroy(() => {
    if (preview) URL.revokeObjectURL(preview);
  });
  async function select(files) {
    if (disabled || working) return;
    error = '';
    if (files.length !== 1) {
      error = 'Selecciona una imagen por espacio.';
      return;
    }
    const f = files[0];
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(f.type)) {
      error = 'Usa JPEG, PNG, WebP, GIF o AVIF.';
      return;
    }
    if (f.size > 8388608) {
      error = 'La imagen supera 8 MB.';
      return;
    }
    working = true;
    onbusy(true);
    try {
      const bitmap = await createImageBitmap(f);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 24000000) throw new Error('La imagen supera 24 megapíxeles.');
      preview = URL.createObjectURL(f);
      const content = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        r.readAsDataURL(f);
      });
      const result = await api('/vehicle-images', {
        method: 'POST',
        body: { mime: f.type, content },
      });
      onchange(result.url);
    } catch (e) {
      error = e.message || 'No se pudo procesar la imagen. La anterior se conserva.';
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      preview = '';
      working = false;
      onbusy(false);
      if (input) input.value = '';
    }
  }
</script>

<div
  class="photo-slot"
  class:dragging
  role="group"
  aria-label={label}
  ondragover={(e) => {
    e.preventDefault();
    if (!disabled) dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={(e) => {
    e.preventDefault();
    dragging = false;
    if (!disabled) select([...e.dataTransfer.files]);
  }}
>
  <strong>{label}</strong>
  {#if (preview || src) && !broken}<img
      src={preview || src}
      alt={label}
      onerror={() => (broken = true)}
    />{:else}<div class="photo-empty">
      {src ? 'No se pudo mostrar la imagen actual.' : 'Sin imagen'}
    </div>{/if}
  <p>Arrastra una imagen aquí o selecciónala desde tu dispositivo.</p>
  <input
    class="photo-file"
    type="file"
    tabindex="-1"
    aria-label={'Archivo para ' + label}
    bind:this={input}
    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
    {disabled}
    onchange={(e) => select([...e.currentTarget.files])}
  />
  <div class="photo-actions">
    <button type="button" disabled={disabled || working} onclick={() => input.click()}
      >{src ? 'Reemplazar imagen' : 'Subir imagen'}</button
    >{#if src}<button
        type="button"
        disabled={disabled || working}
        onclick={() => {
          error = '';
          onremove();
        }}>Eliminar imagen</button
      >{/if}
  </div>
  {#if working}<p role="status">Validando y guardando imagen…</p>{/if}{#if error}<p
      class="error"
      role="alert"
    >
      {error}
    </p>{/if}
</div>

<style>
  .photo-slot {
    border: 1px dashed #aaa;
    border-radius: 16px;
    padding: 16px;
    display: grid;
    gap: 12px;
    background: #fafafa;
    min-width: 0;
  }
  .photo-slot.dragging {
    outline: 3px solid #555;
    background: #e9e9e9;
  }
  .photo-slot img {
    width: 100%;
    height: 160px;
    object-fit: contain;
    background: #eee;
    border-radius: 10px;
  }
  .photo-empty {
    height: 120px;
    display: grid;
    place-items: center;
    background: #eee;
    border-radius: 10px;
    color: #666;
  }
  .photo-slot p {
    font-size: 12px;
  }
  .photo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .photo-file {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
