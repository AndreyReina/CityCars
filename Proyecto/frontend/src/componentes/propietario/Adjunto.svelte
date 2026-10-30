<!--
Selecciona y carga un comprobante privado mediante la API de archivos.
Capa: Vista / presentación. Relación: ../../api.js
-->
<script>
  import { api } from '../../api.js';
  let { value = $bindable(null), disabled = false, uploading = $bindable(false) } = $props();
  let error = $state(''),
    name = $state('');
  async function upload(event) {
    const f = event.target.files?.[0];
    if (!f) return;
    error = '';
    uploading = true;
    try {
      if (f.size > 3145728) throw new Error('El archivo supera los 3 MB.');
      const content = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        r.readAsDataURL(f);
      });
      const result = await api('/files', {
        method: 'POST',
        body: { name: f.name, mime: f.type, content },
      });
      value = result.id;
      name = result.name;
    } catch (e) {
      error = e.message;
    } finally {
      uploading = false;
    }
  }
</script>

<label
  >Adjunto (PDF o imagen, máximo 3 MB)<input
    type="file"
    accept="application/pdf,image/png,image/jpeg,image/webp"
    disabled={disabled || uploading}
    onchange={upload}
  /></label
>
{#if uploading}<p role="status">Guardando adjunto…</p>{/if}{#if error}<p class="error" role="alert">
    {error}
  </p>{/if}{#if value}<p>
    <a href={'/api/files/' + value}>Descargar {name || 'adjunto'}</a>
    <button
      type="button"
      onclick={() => {
        value = null;
        name = '';
      }}>Quitar del formulario</button
    >
  </p>{/if}
