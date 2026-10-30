<!--
Coordina módulos, filtros, diálogos y acciones del administrador mediante datos de la API.
Capa: Vista / presentación. Relación: svelte, ../api.js, ../componentes/administracion/EstructuraPanel.svelte, ../componentes/administracion/Resumen.svelte, ../componentes/administracion/Registros.svelte, ../componentes/administracion/DialogoRegistro.svelte
-->
<script>
  import { onMount, tick } from 'svelte';
  import { api } from '../api.js';
  import EstructuraPanel from '../componentes/administracion/EstructuraPanel.svelte';
  import Resumen from '../componentes/administracion/Resumen.svelte';
  import Registros from '../componentes/administracion/Registros.svelte';
  import DialogoRegistro from '../componentes/administracion/DialogoRegistro.svelte';
  import {
    modules,
    vistasIniciales,
    rutaDesdeFragmento,
  } from '../componentes/administracion/presentacion.js';
  import '../componentes/administracion/administracion.css';
  let { user, onlogout, sessionError = '' } = $props();
  let data = $state(null),
    busy = $state(false),
    error = $state(''),
    message = $state(''),
    modal = $state(null),
    modalError = $state('');
  let route = $state(rutaDesdeFragmento(location.hash)),
    views = $state(vistasIniciales()),
    hydrated = $state(false),
    lastUpdate = $state('');
  let originalFocus;
  const current = $derived(modules.find((m) => m.id === route));
  const storageKey = $derived('citycars-admin-views-' + user.id);
  $effect(() => {
    if (hydrated) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(views));
      } catch {
        /* El panel funciona también sin almacenamiento local. */
      }
    }
  });
  /** Recarga los datos necesarios para la vista y presenta los errores sin ocultarlos al usuario. */
  async function load() {
    busy = true;
    error = '';
    try {
      data = await api('/admin/overview');
      lastUpdate = new Date().toLocaleTimeString('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    try {
      views = vistasIniciales(JSON.parse(sessionStorage.getItem(storageKey) || '{}') || {});
    } catch {
      views = vistasIniciales();
    }
    hydrated = true;
    if (!modules.some((m) => location.hash === '#/' + m.id))
      history.replaceState(null, '', '#/resumen');
    const change = async () => {
      route = rutaDesdeFragmento(location.hash);
      modal = null;
      message = '';
      await tick();
      document.getElementById('admin-content')?.scrollTo({ top: 0 });
      document.getElementById('admin-page-title')?.focus();
    };
    window.addEventListener('hashchange', change);
    load();
    return () => window.removeEventListener('hashchange', change);
  });
  async function close() {
    modal = null;
    modalError = '';
    await tick();
    if (originalFocus?.isConnected) originalFocus.focus();
  }
  function open(kind, id = null, extra = {}) {
    if (!modal) originalFocus = document.activeElement;
    modalError = '';
    modal = { kind, id, ...extra };
  }
  function navigate(next, changes) {
    if (changes) Object.assign(views[next], changes);
    modal = null;
    location.hash = '/' + next;
  }
  async function mutate(path, body, method = 'POST') {
    if (busy) return;
    busy = true;
    modalError = '';
    message = '';
    try {
      await api(path, { method, body });
      await close();
      await load();
      message = 'Cambios guardados correctamente.';
    } catch (e) {
      modalError = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<EstructuraPanel
  {route}
  {user}
  {onlogout}
  {busy}
  pending={data?.vehicles.filter((v) => v.status === 'PENDIENTE_APROBACION').length || 0}
  incidents={data?.incidents.filter((i) => !['RESUELTA', 'CERRADA'].includes(i.status)).length || 0}
>
  <div class="admin-page-heading">
    <div>
      <p class="eyebrow">CENTRO DE ADMINISTRACIÓN</p>
      <h1 id="admin-page-title" tabindex="-1">{current.name}</h1>
      <p>{current.description}</p>
    </div>
    <div class="admin-update">
      <button class="button secondary" onclick={load} disabled={busy}
        >{busy ? 'Actualizando…' : 'Actualizar datos'}</button
      >{#if lastUpdate}<small>Actualizado a las {lastUpdate}</small>{/if}
    </div>
  </div>
  {#if sessionError || error}<p class="error" role="alert">
      {sessionError || error}
    </p>{/if}{#if message}<p class="success" role="status">{message}</p>{/if}
  {#if data}{#key route}{#if route === 'resumen'}<Resumen
          {data}
          view={views.resumen}
          {navigate}
        />{:else}<Registros {data} module={current} view={views[route]} {open} />{/if}{/key}
    {#if modal}{#key modal.kind + modal.id}<DialogoRegistro
          {modal}
          {data}
          {busy}
          error={modalError}
          onclose={close}
          {open}
          {mutate}
          {navigate}
        />{/key}{/if}
  {:else if busy}<div class="admin-empty" role="status">
      Cargando información administrativa…
    </div>{/if}
</EstructuraPanel>
