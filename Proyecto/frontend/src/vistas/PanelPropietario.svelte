<!--
Coordina módulos de flota, formularios, filtros y acciones del propietario.
Capa: Vista / presentación. Relación: svelte, ../api.js, ../componentes/administracion/EstructuraPanel.svelte, ../componentes/propietario/Resumen.svelte, ../componentes/propietario/Registros.svelte, ../componentes/propietario/Formularios.svelte
-->
<script>
  import { onMount, tick } from 'svelte';
  import { api } from '../api.js';
  import EstructuraPanel from '../componentes/administracion/EstructuraPanel.svelte';
  import Resumen from '../componentes/propietario/Resumen.svelte';
  import Registros from '../componentes/propietario/Registros.svelte';
  import Formularios from '../componentes/propietario/Formularios.svelte';
  import SelectorPersonalizado from '../componentes/SelectorPersonalizado.svelte';
  import { modules } from '../componentes/propietario/presentacion.js';
  import '../componentes/administracion/administracion.css';
  import '../componentes/propietario/propietario.css';
  let { user, onlogout, sessionError = '' } = $props();
  const routeName = () =>
    modules.some((m) => location.hash === '#/' + m.id) ? location.hash.slice(2) : 'resumen';
  let route = $state(routeName()),
    data = $state(null),
    error = $state(''),
    message = $state(''),
    busy = $state(false),
    modal = $state(null),
    modalError = $state(''),
    hydrated = $state(false);
  let views = $state(
    Object.fromEntries(
      modules.map((m) => [m.id, { vehicle: '', from: '', to: '', query: '', filter: '', page: 1 }]),
    ),
  );
  const current = $derived(modules.find((m) => m.id === route)),
    view = $derived(views[route]);
  const storage = $derived('citycars-owner-views-' + user.id);
  const vehicles = $derived(
    (data?.vehicles || []).map((v) => ({
      value: String(v.id),
      label: '#' + v.id + ' · ' + v.brand + ' ' + v.model,
    })),
  );
  let focus;
  $effect(() => {
    if (hydrated)
      try {
        sessionStorage.setItem(storage, JSON.stringify(views));
      } catch {}
  });
  /** Recarga los datos necesarios para la vista y presenta los errores sin ocultarlos al usuario. */
  async function load() {
    busy = true;
    error = '';
    try {
      data = await api('/owner/overview');
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storage) || '{}');
      for (const m of modules)
        for (const key of ['vehicle', 'from', 'to', 'query', 'filter'])
          if (typeof saved?.[m.id]?.[key] === 'string') views[m.id][key] = saved[m.id][key];
    } catch {}
    hydrated = true;
    if (location.hash !== '#/' + route) history.replaceState(null, '', '#/' + route);
    const change = async () => {
      route = routeName();
      modal = null;
      message = '';
      await tick();
      document.getElementById('admin-content')?.scrollTo({ top: 0 });
      document.getElementById('owner-title')?.focus();
    };
    window.addEventListener('hashchange', change);
    load();
    const timer = setInterval(() => {
      if (!modal && !busy && document.visibilityState === 'visible') load();
    }, 60000);
    return () => {
      window.removeEventListener('hashchange', change);
      clearInterval(timer);
    };
  });
  function navigate(next, vehicleId) {
    if (!modules.some((m) => m.id === next)) return;
    if (vehicleId) views[next].vehicle = String(vehicleId);
    location.hash = '/' + next;
  }
  function open(kind, id = null, extra = {}) {
    focus = document.activeElement;
    modalError = '';
    modal = { kind, id, ...extra };
  }
  async function close() {
    modal = null;
    modalError = '';
    await tick();
    focus?.isConnected && focus.focus();
  }
  async function mutate(path, body, method = 'POST') {
    if (busy) return;
    busy = true;
    error = '';
    modalError = '';
    message = '';
    try {
      await api(path, { method, body });
      await close();
      await load();
      message = 'Operación guardada correctamente.';
    } catch (e) {
      if (modal) modalError = e.message;
      else error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<EstructuraPanel {route} {modules} {user} {onlogout} {busy} area="Mi flota" roleLabel="Propietario">
  <div class="admin-page-heading">
    <div>
      <p class="eyebrow">CENTRO DEL PROPIETARIO</p>
      <h1 id="owner-title" tabindex="-1">{current.name}</h1>
      <p>{current.description}</p>
    </div>
    <button class="button secondary" onclick={load} disabled={busy}
      >{busy ? 'Actualizando…' : 'Actualizar datos'}</button
    >
  </div>
  {#if user.suspended}<p class="error" role="alert">
      Tu cuenta está suspendida: {user.suspension_reason}. Puedes consultar tu información; las
      operaciones están restringidas.
    </p>{/if}
  {#if error || sessionError}<p class="error" role="alert">
      {error || sessionError}
    </p>{/if}{#if message}<p class="success" role="status">{message}</p>{/if}
  {#if data}
    <section class="panel owner-period">
      <SelectorPersonalizado
        id="owner-vehicle-filter"
        label="Vehículo"
        bind:value={view.vehicle}
        options={vehicles}
        emptyLabel="Toda mi flota"
      /><label>Desde<input type="date" bind:value={view.from} /></label><label
        >Hasta<input type="date" min={view.from} bind:value={view.to} /></label
      >
    </section>
    {#if view.from && view.to && view.from > view.to}<p class="error">
        La fecha final debe ser igual o posterior a la inicial.
      </p>{/if}
    {#key route}{#if route === 'resumen'}<Resumen {data} {view} {navigate} />{:else}<Registros
          {data}
          module={route}
          {view}
          {open}
          {mutate}
          {navigate}
          {user}
          {busy}
        />{/if}{/key}
    {#if modal}{#key modal.kind + modal.id}<Formularios
          {modal}
          {data}
          {busy}
          {user}
          error={modalError}
          onclose={close}
          {mutate}
        />{/key}{/if}
  {:else if busy}<p role="status">Cargando tu flota…</p>{/if}
</EstructuraPanel>
