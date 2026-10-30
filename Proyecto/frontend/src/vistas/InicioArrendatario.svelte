<!--
Coordina catálogo por ciudad, próxima reserva, favoritos, notificaciones y perfil.
Capa: Vista / presentación. Relación: svelte, ../api.js, ./MisReservas.svelte, ../componentes/arrendatario/Buscador.svelte, ../componentes/arrendatario/Tarjeta.svelte, ../componentes/arrendatario/CarruselCiudad.svelte
-->
<script>
  import { onMount, untrack } from 'svelte';
  import { api } from '../api.js';
  import MisReservas from './MisReservas.svelte';
  import Buscador from '../componentes/arrendatario/Buscador.svelte';
  import Tarjeta from '../componentes/arrendatario/Tarjeta.svelte';
  import CarruselCiudad from '../componentes/arrendatario/CarruselCiudad.svelte';
  import {
    agruparCiudades,
    proximaReserva,
    formatearHorario,
  } from '../componentes/arrendatario/presentacion.js';
  import '../componentes/arrendatario/arrendatario.css';
  let { user } = $props();
  const params = new URLSearchParams(location.search);
  const routes = ['explorar', 'favoritos', 'reservas', 'notificaciones', 'cuenta', 'configuracion'];
  const currentRoute = () =>
    routes.includes(location.hash.split('/')[1]) ? location.hash.split('/')[1] : 'explorar';
  let reservationId = $state(location.hash.split('/')[2] || ''),
    route = $state(currentRoute()),
    city = $state(params.get('city') || ''),
    start = $state(params.get('start') || ''),
    end = $state(params.get('end') || ''),
    startTime = $state(params.get('startTime') || '09:00'),
    endTime = $state(params.get('endTime') || '09:00');
  let vehicles = $state([]),
    cities = $state([]),
    reservations = $state([]),
    favorites = $state([]),
    notifications = $state([]),
    busy = $state(true),
    saving = $state(false),
    error = $state(''),
    accountError = $state(''),
    name = $state(untrack(() => user.name)),
    message = $state(''),
    applied = $state(''),
    searched = $state(location.pathname === '/carros'),
    now = $state(Date.now());
  const groups = $derived(agruparCiudades(vehicles)),
    next = $derived(proximaReserva(reservations, now));
  let generation = 0;
  /** Obtiene favoritos, avisos y reservas de la sesión para mantener actualizado el espacio del arrendatario. */
  async function account() {
    try {
      const [a, r] = await Promise.all([api('/renter/account'), api('/reservations')]);
      favorites = a.favorites;
      notifications = a.notifications;
      reservations = r;
      accountError = '';
    } catch (e) {
      accountError = e.message;
    }
  }
  /** Consulta catálogo y ciudades en paralelo. Descarta respuestas antiguas para que una búsqueda lenta no sustituya la más reciente. */
  async function search(e) {
    e?.preventDefault();
    const n = ++generation;
    busy = true;
    error = '';
    if (e) searched = true;
    try {
      const query =
        route === 'favoritos'
          ? ''
          : new URLSearchParams({ city, start, end, startTime, endTime }).toString();
      const [v, c] = await Promise.all([
        api('/vehicles?' + query),
        api('/vehicle-cities?' + new URLSearchParams({ start, end, startTime, endTime })),
      ]);
      if (n !== generation) return;
      vehicles = v;
      cities = c;
      applied = query;
      if (e) history.replaceState(null, '', location.pathname + '?' + query + location.hash);
    } catch (e) {
      if (n === generation) error = e.message;
    } finally {
      if (n === generation) busy = false;
    }
  }
  onMount(() => {
    search();
    account();
    const change = () => {
      route = currentRoute();
      reservationId = location.hash.split('/')[2] || '';
      message = '';
      error = '';
      if (route === 'explorar' || route === 'favoritos') search();
      account();
    };
    window.addEventListener('hashchange', change);
    const timer = setInterval(() => {
      now = Date.now();
      if (document.visibilityState === 'visible') account();
    }, 60000);
    return () => {
      generation++;
      clearInterval(timer);
      window.removeEventListener('hashchange', change);
    };
  });
  /** Persiste la selección privada del vehículo y actualiza la vista únicamente al confirmar la API. */
  async function favorite(id) {
    saving = true;
    error = '';
    try {
      const selected = !favorites.includes(id);
      await api('/renter/favorites/' + id, { method: 'PUT', body: { favorite: selected } });
      favorites = selected ? [...favorites, id] : favorites.filter((v) => v !== id);
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
  /** Marca una notificación propia como leída y refleja el resultado de la API. */
  async function read(n) {
    try {
      await api('/renter/notifications/' + n.id, { method: 'PUT', body: {} });
      notifications = notifications.map((x) =>
        x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
      );
    } catch (e) {
      accountError = e.message;
    }
  }
</script>

<div class="renter-app">
  {#if user.suspended}<p class="error" role="alert">
      Tu cuenta está suspendida: {user.suspension_reason}. Puedes consultar tu información.
    </p>{/if}
  {#if error}<p class="error" role="alert">
      {error} <button onclick={search}>Reintentar búsqueda</button>
    </p>{/if}
  {#if accountError}<p class="error" role="alert">
      {accountError} <button onclick={account}>Reintentar cuenta</button>
    </p>{/if}
  {#if route === 'explorar'}
    <section class="rental-hero">
      <div>
        <p class="eyebrow">TU CIUDAD. TU RITMO.</p>
        <h1>El próximo destino<br />lo eliges tú.</h1>
        <p>Encuentra el carro que va contigo y empieza una nueva ruta.</p>
      </div>
      <div class="rental-hero-aside">
        <span aria-hidden="true">↗</span>
        <p>Un camino,<br />muchas posibilidades.</p>
      </div>
    </section>
    <Buscador
      bind:city
      bind:start
      bind:end
      bind:startTime
      bind:endTime
      {cities}
      {busy}
      onsubmit={search}
    />
    <p class="rental-search-note">
      Alquiler por días de calendario. Horarios de Colombia. Selecciona ambas fechas para consultar
      disponibilidad.
    </p>
    {#if next}<aside class="rental-upcoming">
        <div class="rental-upcoming-icon" aria-hidden="true">↗</div>
        <div>
          <p class="eyebrow">TU PRÓXIMA RESERVA · CONFIRMADA</p>
          <h2>{next.brand} {next.model}</h2>
          <p>{formatearHorario(next.start_date, next.start_time)} · {next.city}</p>
        </div>
        <a class="button secondary" href={'/panel#/reservas/' + next.id}>Ver reserva</a>
      </aside>{/if}
    <div class="rental-section-heading">
      <div>
        <p class="eyebrow">ENCUENTRA TU PRÓXIMO CAMINO</p>
        <h2>{searched ? 'Vehículos para tu búsqueda' : 'Descubre por ciudad'}</h2>
        <p class="muted">
          {searched
            ? 'Disponibilidad según los criterios seleccionados.'
            : 'Primero los mejor valorados; sin reseñas, ordenados por tarifa.'}
        </p>
      </div>
      {#if searched}<button
          onclick={() => {
            city = '';
            start = '';
            end = '';
            searched = false;
            history.replaceState(null, '', location.pathname + location.hash);
            search();
          }}>Ver todas las ciudades</button
        >{/if}
    </div>
    {#if busy}<div class="rental-empty" role="status">
        Buscando tu próxima ruta…
      </div>{:else if !vehicles.length}<div class="rental-empty">
        <h3>No hay vehículos disponibles para esta búsqueda.</h3>
        <p>Prueba otras fechas o una ciudad diferente.</p>
      </div>{:else if searched}<div class="rental-grid">
        {#each vehicles as vehicle (vehicle.id)}<Tarjeta
            {vehicle}
            query={applied}
            favorite={favorites.includes(vehicle.id)}
            onfavorite={favorite}
            disabled={saving || user.suspended}
          />{/each}
      </div>{:else}{#each groups as group}<CarruselCiudad
          {...group}
          query={applied}
          {favorites}
          onfavorite={favorite}
          disabled={saving || user.suspended}
        />{/each}{/if}
  {:else if route === 'reservas'}<MisReservas {user} selectedId={reservationId} />
  {:else if route === 'favoritos'}<div class="rental-page-heading">
      <p class="eyebrow">GUARDADOS PARA TU PRÓXIMO VIAJE</p>
      <h1>Mis favoritos</h1>
      <p>Los vehículos que te gustan, en un solo lugar.</p>
    </div>
    {#if busy}<p role="status">Cargando vehículos…</p>{:else}<div class="rental-grid">
        {#each vehicles.filter((v) => favorites.includes(v.id)) as vehicle}<Tarjeta
            {vehicle}
            favorite={true}
            onfavorite={favorite}
            disabled={saving || user.suspended}
          />{:else}<div class="rental-empty">
            <h2>Tu próxima ruta empieza con un favorito.</h2>
            <p>Guarda vehículos con el corazón. Aquí aparecen los que siguen disponibles.</p>
            <a class="button" href="/">Explorar vehículos</a>
          </div>{/each}
      </div>{/if}
  {:else if route === 'notificaciones'}<div class="rental-page-heading">
      <p class="eyebrow">AL DÍA CON TUS VIAJES</p>
      <h1>Notificaciones</h1>
    </div>
    <div class="rental-notices">
      {#each notifications as n}<article class="panel" class:unread={!n.read_at}>
          <div>
            <span class="badge">{n.read_at ? 'Leída' : 'Nueva'}</span>
            <h2>Reserva #{n.reservation_id} · {n.status.toLowerCase()}</h2>
            <p>{n.brand} {n.model}</p>
            <time
              >{new Date(n.created_at).toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
              })}</time
            >
          </div>
          <div class="actions">
            <a href={'/panel#/reservas/' + n.reservation_id}>Ver reserva ↗</a
            >{#if !n.read_at}<button disabled={user.suspended} onclick={() => read(n)}
                >Marcar como leída</button
              >{/if}
          </div>
        </article>{:else}<div class="rental-empty">
          <h2>Todo está al día.</h2>
          <p>Los cambios de tus reservas aparecerán aquí.</p>
        </div>{/each}
    </div>
  {:else}<div class="rental-page-heading">
      <p class="eyebrow">TU ESPACIO EN CITYCARS</p>
      <h1>{route === 'cuenta' ? 'Mi cuenta' : 'Configuración del perfil'}</h1>
    </div>
    <section class="rental-profile panel">
      <div class="rental-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
      {#if route === 'cuenta'}<h2>{name}</h2>
        <p>{user.email}</p>
        <p>Arrendatario · {user.suspended ? 'Cuenta suspendida' : 'Cuenta activa'}</p>
        <p>{reservations.length} reservas · {favorites.length} favoritos</p>
        <a class="button" href="/">Encontrar mi próximo carro</a>{:else}<form
          onsubmit={async (e) => {
            e.preventDefault();
            saving = true;
            message = '';
            try {
              const p = await api('/renter/profile', { method: 'PUT', body: { name } });
              name = p.name;
              message = 'Perfil actualizado.';
            } catch (e) {
              accountError = e.message;
            } finally {
              saving = false;
            }
          }}
        >
          <label>Nombre<input required minlength="2" maxlength="100" bind:value={name} /></label
          ><label>Correo electrónico<input type="email" value={user.email} readonly /></label
          ><button class="button" disabled={saving || user.suspended}
            >{saving ? 'Guardando…' : 'Guardar perfil'}</button
          >{#if message}<p class="success" role="status">{message}</p>{/if}
        </form>{/if}
    </section>{/if}
</div>
