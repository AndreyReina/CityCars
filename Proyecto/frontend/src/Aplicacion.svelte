<!--
Resuelve la ruta web y la sesión; selecciona la vista pública o el panel del rol.
Capa: Vista / presentación. Relación: svelte, ./api.js, ./componentes/Encabezado.svelte, ./componentes/PiePagina.svelte, ./vistas/Inicio.svelte, ./vistas/Informacion.svelte
-->
<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import Encabezado from './componentes/Encabezado.svelte';
  import PiePagina from './componentes/PiePagina.svelte';
  import Inicio from './vistas/Inicio.svelte';
  import Informacion from './vistas/Informacion.svelte';
  import Ayuda from './vistas/Ayuda.svelte';
  import Catalogo from './vistas/Catalogo.svelte';
  import Autenticacion from './vistas/Autenticacion.svelte';
  import DetalleVehiculo from './vistas/DetalleVehiculo.svelte';
  import PanelAdministracion from './vistas/PanelAdministracion.svelte';
  import PanelPropietario from './vistas/PanelPropietario.svelte';
  import MisReservas from './vistas/MisReservas.svelte';
  import EncabezadoArrendatario from './componentes/EncabezadoArrendatario.svelte';
  import InicioArrendatario from './vistas/InicioArrendatario.svelte';
  import './componentes/arrendatario/arrendatario.css';
  const page = window.location.pathname.replace(/\/$/, '') || '/';
  const detail = page.match(/^\/carros\/(\d+)$/);
  let user = $state(null),
    ready = $state(false),
    error = $state('');
  onMount(() => {
    api('/auth/me')
      .then((v) => (user = v))
      .catch((e) => (error = e.message))
      .finally(() => (ready = true));
  });
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      location.assign('/');
    } catch (e) {
      error = e.message;
    }
  }
</script>

{#if !ready && ['/', '/carros', '/panel'].includes(page)}
  <main class="admin-session" id="contenido"><p role="status">Cargando sesión…</p></main>
{:else if page === '/panel' && error && !user}
  <main class="admin-session" id="contenido">
    <p role="alert">{error}</p>
    <a href="/panel">Reintentar</a>
  </main>
{:else if page === '/panel' && user?.role === 'ADMINISTRADOR'}
  <PanelAdministracion {user} onlogout={logout} sessionError={error} />
{:else if page === '/panel' && user?.role === 'PROPIETARIO'}
  <PanelPropietario {user} onlogout={logout} sessionError={error} />
{:else}
  {#if user?.role === 'ARRENDATARIO'}<EncabezadoArrendatario onlogout={logout} />{:else}<Encabezado
      {user}
      onlogout={logout}
    />{/if}
  {#if error && page !== '/panel'}
    <div class="session-error" role="alert">{error} <a href={page}>Reintentar</a></div>
  {/if}
  <main id="contenido">
    {#if user?.role === 'ARRENDATARIO' && ['/', '/carros', '/panel'].includes(page)}<InicioArrendatario
        {user}
      />{:else if page === '/'}<Inicio
      />{:else if ['/por-que-elegirnos', '/alquilar'].includes(page)}<Informacion
        {page}
      />{:else if page === '/ayuda'}<Ayuda />{:else if page === '/carros'}<Catalogo
      />{:else if ['/registro', '/ingresar'].includes(page)}<Autenticacion
        register={page === '/registro'}
      />{:else if detail && ready}<DetalleVehiculo
        id={Number(detail[1])}
        {user}
      />{:else if page === '/panel' && ready}{#if error}<section class="page">
          <p class="error" role="alert">{error}</p>
          <a href="/panel">Reintentar</a>
        </section>{:else}<MisReservas
          {user}
        />{/if}{:else if !ready && (detail || page === '/panel')}<section class="page">
        <p>Cargando sesión…</p>
      </section>{:else}<section class="page">
        <h1>No encontramos esta página.</h1>
        <a class="button" href="/">Volver al inicio</a>
      </section>{/if}
  </main>
  {#if user?.role !== 'ARRENDATARIO'}<PiePagina />{/if}
{/if}

<style>
  .admin-session {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: 16px;
  }
</style>
