<!--
Contenedor modal con gestión de cierre y accesibilidad.
Capa: Vista / presentación. Relación: svelte
-->
<script>
  import { onMount } from 'svelte';
  let { title, busy = false, onclose, children } = $props();
  let element, heading;
  onMount(() => {
    element.showModal();
    heading.focus();
    return () => element.close();
  });
</script>

<dialog
  bind:this={element}
  class="admin-dialog"
  aria-labelledby="admin-dialog-title"
  oncancel={(event) => {
    event.preventDefault();
    if (!busy) onclose();
  }}
>
  <header>
    <h2 id="admin-dialog-title" bind:this={heading} tabindex="-1">{title}</h2>
    <button type="button" aria-label="Cerrar diálogo" disabled={busy} onclick={onclose}>✕</button>
  </header>
  <div class="admin-dialog-body">{@render children()}</div>
</dialog>
