<!--
Navegación de cuenta, cierre de sesión y menú desplegable del arrendatario.
Capa: Vista / presentación. Relación: Consumido por su página, script de ejecución o proceso de compilación.
-->
<script>
  let { onlogout } = $props();
  let opened = $state(false),
    root,
    toggle;
  const links = [
    ['favoritos', 'Mis favoritos'],
    ['reservas', 'Mis reservas'],
    ['notificaciones', 'Notificaciones'],
    ['configuracion', 'Configuración del perfil'],
  ];
</script>

<svelte:window
  onclick={(e) => {
    if (root && !root.contains(e.target)) opened = false;
  }}
  onkeydown={(e) => {
    if (e.key === 'Escape' && opened) {
      opened = false;
      toggle.focus();
    }
  }}
/>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="renter-header" bind:this={root}>
  <a href="/" aria-label="CityCars, inicio"><img src="/imagenes/Logo.svg" alt="CityCars" /></a>
  <div class="renter-header-actions">
    <a href="/panel#/cuenta">Mi cuenta</a><button onclick={onlogout}>Cerrar sesión</button><button
      class="renter-menu-button"
      bind:this={toggle}
      aria-label="Menú de navegación"
      aria-expanded={opened}
      aria-controls="renter-menu"
      onclick={() => (opened = !opened)}>☰</button
    >
  </div>
  {#if opened}<nav id="renter-menu" aria-label="Navegación del arrendatario">
      {#each links as [route, label]}<a href={'/panel#/' + route} onclick={() => (opened = false)}
          >{label}<span aria-hidden="true">↗</span></a
        >{/each}
    </nav>{/if}
</header>
