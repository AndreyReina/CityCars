<!--
Organiza sidebar, barra superior y área de contenido; adapta la navegación a móvil.
Capa: Vista / presentación. Relación: ./presentacion.js
-->
<script>
  import { modules as adminModules } from './presentacion.js';
  let {
    route,
    user,
    onlogout,
    busy,
    pending = 0,
    incidents = 0,
    modules = adminModules,
    area = 'Administración',
    roleLabel = 'Administrador',
    children,
  } = $props();
  let menuOpen = $state(false),
    menuButton;
  $effect(() => {
    route;
    menuOpen = false;
  });
  function closeMenu() {
    menuOpen = false;
    menuButton?.focus();
  }
</script>

<div class="admin-shell">
  <a
    class="admin-skip"
    href="#admin-content"
    onclick={(event) => {
      event.preventDefault();
      document.getElementById('admin-content')?.focus();
    }}>Saltar al contenido administrativo</a
  >
  <aside
    class="admin-sidebar"
    class:open={menuOpen}
    id="admin-sidebar"
    aria-label={roleLabel === 'Propietario'
      ? 'Navegación del propietario'
      : 'Navegación administrativa'}
  >
    <a class="admin-brand" href="#/resumen"
      ><img src="/imagenes/Logo.svg" alt="CityCars" /><span>{area.toUpperCase()}</span></a
    >
    <p class="admin-nav-label">ESPACIO DE TRABAJO</p>
    <nav
      aria-label={roleLabel === 'Propietario'
        ? 'Módulos del propietario'
        : 'Módulos administrativos'}
    >
      {#each modules as item, index}<a
          href={'#/' + item.id}
          aria-current={route === item.id ? 'page' : undefined}
          onclick={() => (menuOpen = false)}
          ><svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            aria-hidden="true"
            ><path
              d={[
                'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
                'M4 5h16v14H4z M7 9h10 M7 13h6',
                'M16 8a4 4 0 1 1-8 0a4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
                'M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16',
                'M12 3L2 21h20z M12 9v5 M12 17v1',
                'M4 12a8 8 0 1 0 3-6 M4 3v6h6 M12 7v5l3 2',
              ][index % 6]}
            /></svg
          ><span>{item.name}</span>{#if item.id === 'publicaciones' && pending}<span
              class="admin-count">{pending}</span
            >{:else if item.id === 'incidencias' && incidents}<span class="admin-count"
              >{incidents}</span
            >{/if}</a
        >{/each}
    </nav>
    <div class="admin-sidebar-end">
      <strong>CityCars</strong><small
        >{roleLabel === 'Propietario' ? 'Gestión de mi flota' : 'Gestión de la plataforma'}</small
      >
    </div>
  </aside>
  <div class="admin-workspace">
    <header class="admin-topbar">
      <button
        class="admin-menu-toggle"
        type="button"
        bind:this={menuButton}
        aria-label={menuOpen ? 'Cerrar menú administrativo' : 'Abrir menú administrativo'}
        aria-expanded={menuOpen}
        aria-controls="admin-sidebar"
        onclick={() => (menuOpen = !menuOpen)}>☰</button
      >
      <p class="admin-breadcrumb">
        {area} <span>/</span> <strong>{modules.find((m) => m.id === route).name}</strong>
      </p>
      <div class="admin-user">
        <span class="admin-avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
        <div>{user.name}<small>{roleLabel}</small></div>
      </div>
      <button class="button secondary" disabled={busy} onclick={onlogout}>Cerrar sesión</button>
    </header>
    <main class="admin-content" id="admin-content" tabindex="-1">{@render children()}</main>
  </div>
  {#if menuOpen}<button class="admin-backdrop" aria-label="Cerrar navegación" onclick={closeMenu}
    ></button>{/if}
</div>
<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && menuOpen) closeMenu();
  }}
/>
