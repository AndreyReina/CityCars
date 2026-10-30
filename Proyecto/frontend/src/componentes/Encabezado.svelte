<!--
Navegación pública y accesos según sesión; conserva la identidad visual.
Capa: Vista / presentación. Relación: Consumido por su página, script de ejecución o proceso de compilación.
-->
<script>
  let { user = null, onlogout = () => {} } = $props();
  let opened = $state(false);
  let scrollY = $state(0);
</script>

<svelte:window bind:scrollY />
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="header" class:header--menu-opened={opened} class:header--scroll={scrollY > 0}>
  <a class="header__logo" href="/" aria-label="CityCars, inicio"
    ><img src="/imagenes/Logo.svg" alt="CityCars" /></a
  >
  <button
    class="header__menu-toggle"
    onclick={() => (opened = !opened)}
    aria-label="Abrir o cerrar menú"
    aria-expanded={opened}>☰</button
  >
  <nav class="menu" aria-label="Principal">
    <ul class="menu__list">
      {#each [['/por-que-elegirnos', 'Por qué elegirnos'], ['/carros', 'Carros'], ['/ayuda', 'Ayuda'], ['/alquilar', 'Alquilar']] as [url, label]}<li
          class="menu__item"
        >
          <a class="menu__link" href={url}>{label}</a>
        </li>{/each}
    </ul>
    {#if user}<a class="menu__link" href="/panel">Mi cuenta</a><button
        class="button"
        onclick={onlogout}>Salir</button
      >{:else}<a class="menu__link menu__link--cta" href="/ingresar">Ingresar</a>{/if}
  </nav>
</header>
