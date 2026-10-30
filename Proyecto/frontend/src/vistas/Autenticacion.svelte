<!--
Captura registro o ingreso, envía credenciales y redirige tras la autenticación.
Capa: Vista / presentación. Relación: ../componentes/SelectorPersonalizado.svelte, ../api.js
-->
<script>
  import SelectorPersonalizado from '../componentes/SelectorPersonalizado.svelte';
  import { api } from '../api.js';
  let { register = false } = $props();
  let name = $state(''),
    email = $state(''),
    password = $state(''),
    role = $state('ARRENDATARIO'),
    error = $state(''),
    busy = $state(false);
  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      await api('/auth/' + (register ? 'register' : 'login'), {
        method: 'POST',
        body: { name, email, password, role },
      });
      const next = new URLSearchParams(location.search).get('next');
      location.assign(next && /^\/carros\/\d+$/.test(next) ? next : '/panel');
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="page narrow">
  <p class="eyebrow">BIENVENIDO A CITYCARS</p>
  <h1>{register ? 'Crea tu cuenta.' : 'Vuelve al camino.'}</h1>
  <form class="panel" onsubmit={submit}>
    {#if register}<label
        >Nombre<input
          bind:value={name}
          required
          minlength="2"
          maxlength="100"
          autocomplete="name"
        /></label
      >{/if}
    <label
      >Correo electrónico<input
        type="email"
        bind:value={email}
        required
        maxlength="254"
        autocomplete="email"
      /></label
    ><label
      >Contraseña<input
        type="password"
        bind:value={password}
        required
        minlength="8"
        maxlength="72"
        autocomplete={register ? 'new-password' : 'current-password'}
      /></label
    >
    {#if register}<SelectorPersonalizado
        id="account-role"
        label="Quiero usar CityCars como"
        bind:value={role}
        disabled={busy}
        options={[
          { value: 'ARRENDATARIO', label: 'Arrendatario · Reservar carros' },
          { value: 'PROPIETARIO', label: 'Propietario · Publicar carros' },
        ]}
      />
      <p class="muted">
        Elige cómo quieres usar CityCars: reserva automóviles o publica el tuyo. Cada cuenta tiene
        un único rol.
      </p>{/if}
    {#if error}<p role="alert" class="error">{error}</p>{/if}<button class="button" disabled={busy}
      >{busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Ingresar'}</button
    >
    <a href={register ? '/ingresar' : '/registro'}
      >{register ? 'Ya tengo una cuenta' : 'Crear una cuenta'}</a
    >
  </form>
</section>
