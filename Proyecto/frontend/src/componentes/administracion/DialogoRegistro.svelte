<!--
Muestra los datos y acciones de un registro administrativo.
Capa: Vista / presentación. Relación: ./DetalleFlota.svelte, svelte, ../../api.js, ./presentacion.js, ./Dialogo.svelte, ../SelectorPersonalizado.svelte
-->
<script>
  import DetalleFlota from './DetalleFlota.svelte';
  import { untrack } from 'svelte';
  import { money } from '../../api.js';
  import { label, date, options } from './presentacion.js';
  import Dialogo from './Dialogo.svelte';
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  let { modal, data, busy, error, onclose, open, mutate, navigate } = $props();
  const record = $derived(
    modal.kind === 'vehicle'
      ? data.vehicles.find((v) => v.id === modal.id)
      : modal.kind === 'owner'
        ? data.owners.find((o) => o.id === modal.id)
        : modal.kind === 'reservation'
          ? data.reservations.find((r) => r.id === modal.id)
          : modal.kind === 'incident'
            ? data.incidents.find((i) => i.id === modal.id)
            : modal.kind === 'action'
              ? data.actions.find((a) => a.id === modal.id)
              : null,
  );
  const heading = $derived(
    modal.kind === 'restrict'
      ? (modal.restricted ? 'Suspender' : 'Reactivar') + ': ' + modal.name
      : modal.kind === 'newIncident'
        ? 'Nueva incidencia'
        : {
            vehicle: 'Publicación',
            owner: 'Ficha del propietario',
            reservation: 'Reserva',
            incident: 'Incidencia',
            action: 'Acción administrativa',
          }[modal.kind] +
          ' #' +
          modal.id,
  );
  let reason = $state(''),
    title = $state(''),
    description = $state(''),
    priority = $state('MEDIA'),
    vehicleId = $state(''),
    ownerId = $state('');
  let status = $state(untrack(() => record?.status || 'EN_REVISION')),
    resolution = $state(untrack(() => record?.resolution || '')),
    tab = $state('detalle');
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (modal.kind === 'restrict')
      await mutate('/admin/' + modal.type + '/' + modal.id + '/restriction', {
        restricted: modal.restricted,
        reason,
      });
    else if (modal.kind === 'newIncident')
      await mutate('/admin/incidents', { title, description, priority, vehicleId, ownerId });
    else await mutate('/admin/incidents/' + modal.id, { status, resolution }, 'PUT');
  }
  function restrict(type, item, restricted) {
    open('restrict', item.id, {
      type,
      restricted,
      name: type === 'owners' ? item.name : item.brand + ' ' + item.model,
    });
  }
</script>

<Dialogo title={heading} {busy} {onclose}>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if modal.kind === 'restrict'}
    <p>
      {modal.restricted
        ? 'La suspensión oculta las publicaciones afectadas y bloquea nuevas reservas. En propietarios, también bloquea sus operaciones.'
        : 'Se retirará esta restricción. Solo serán visibles las publicaciones aprobadas sin otras suspensiones.'}
      Las reservas existentes conservan su estado.
    </p>
    <form onsubmit={submit}>
      <label
        >Motivo<textarea bind:value={reason} required minlength="5" maxlength="1000" disabled={busy}
        ></textarea></label
      >
      <div class="admin-dialog-actions">
        <button type="button" disabled={busy} onclick={onclose}>Cancelar</button><button
          class="button"
          disabled={busy}>Confirmar {modal.restricted ? 'suspensión' : 'reactivación'}</button
        >
      </div>
    </form>
  {:else if modal.kind === 'newIncident'}
    <p class="admin-note">
      Registra el caso y vincúlalo a un vehículo o propietario si corresponde.
    </p>
    <form onsubmit={submit}>
      <fieldset disabled={busy}>
        <label>Título<input bind:value={title} required minlength="5" maxlength="160" /></label
        ><label
          >Descripción<textarea bind:value={description} required minlength="10" maxlength="4000"
          ></textarea></label
        ><SelectorPersonalizado
          id="incident-priority"
          label="Prioridad"
          bind:value={priority}
          options={options(['BAJA', 'MEDIA', 'ALTA'])}
          disabled={busy}
        />
        <div class="admin-columns">
          <SelectorPersonalizado
            id="incident-vehicle"
            label="Vehículo relacionado"
            bind:value={vehicleId}
            emptyLabel="Sin vehículo"
            options={data.vehicles.map((v) => ({
              value: String(v.id),
              label: '#' + v.id + ' · ' + v.brand + ' ' + v.model,
            }))}
            disabled={busy}
          /><SelectorPersonalizado
            id="incident-owner"
            label="Propietario relacionado"
            bind:value={ownerId}
            emptyLabel="Sin propietario"
            options={data.owners.map((o) => ({
              value: String(o.id),
              label: '#' + o.id + ' · ' + o.name,
            }))}
            disabled={busy}
          />
        </div>
      </fieldset>
      <div class="admin-dialog-actions">
        <button type="button" disabled={busy} onclick={onclose}>Cancelar</button><button
          class="button"
          disabled={busy}>Guardar incidencia</button
        >
      </div>
    </form>
  {:else if record}
    {#if modal.kind === 'vehicle'}
      <div class="admin-detail-hero">
        <img
          src={record.image || '/imagenes/vehicle-placeholder.svg'}
          alt={record.brand + ' ' + record.model}
        />
        <div>
          <h3>{record.brand} {record.model}</h3>
          <p>{record.city} · {record.year}</p>
          <strong>{money(record.daily_price)} / día</strong>
        </div>
      </div>
      <span class="badge"
        >{record.blocked || record.owner_suspended ? 'SUSPENDIDA' : label(record.status)}</span
      >
      <p>{record.description}</p>
      <dl>
        <dt>Propietario</dt>
        <dd>
          <button class="admin-link" onclick={() => open('owner', record.owner_id)}
            >{record.owner_name}</button
          ><small>{record.owner_email}</small>
        </dd>
        <dt>Estado de aprobación</dt>
        <dd>{label(record.status)}</dd>
      </dl>
      {#if record.blocked}<p class="error">
          Suspensión de publicación: {record.block_reason}
        </p>{/if}{#if record.owner_suspended}<p class="error">
          El propietario está suspendido. Retirar la suspensión individual no hará visible este
          vehículo.
        </p>{/if}
      <div class="admin-dialog-actions">
        {#if record.status === 'PENDIENTE_APROBACION'}<button
            class="button"
            disabled={busy}
            onclick={() =>
              mutate('/admin/vehicles/' + record.id + '/review', { status: 'APROBADO' })}
            >Aprobar publicación</button
          ><button
            disabled={busy}
            onclick={() =>
              mutate('/admin/vehicles/' + record.id + '/review', { status: 'RECHAZADO' })}
            >Rechazar publicación</button
          >{/if}<button
          disabled={busy}
          onclick={() => restrict('vehicles', record, !record.blocked)}
          >{record.blocked ? 'Retirar suspensión' : 'Suspender publicación'}</button
        >
      </div>
      <DetalleFlota
        kind="vehicle"
        {record}
        {data}
        {busy}
        {mutate}
      />{:else if modal.kind === 'owner'}
      <h3>{record.name}</h3>
      <span class="badge">{record.suspended ? 'SUSPENDIDO' : 'HABILITADO'}</span>
      <dl>
        <dt>Correo</dt>
        <dd>{record.email}</dd>
        <dt>Registro</dt>
        <dd>{date(record.created_at)}</dd>
        <dt>Vehículos</dt>
        <dd>{record.vehicle_count}</dd>
        <dt>Reservas confirmadas</dt>
        <dd>{record.confirmed_count}</dd>
      </dl>
      {#if record.suspended}<p class="error">{record.suspension_reason}</p>{/if}
      <div class="admin-dialog-actions">
        <button
          onclick={() => navigate('publicaciones', { query: record.email, filter: '', page: 1 })}
          >Ver sus publicaciones</button
        ><button disabled={busy} onclick={() => restrict('owners', record, !record.suspended)}
          >{record.suspended ? 'Reactivar propietario' : 'Suspender propietario'}</button
        >
      </div>
    {:else if modal.kind === 'reservation'}
      <h3>{record.brand} {record.model}</h3>
      <span class="badge">{record.status}</span>
      <dl>
        <dt>Período</dt>
        <dd>{record.start_date} → {record.end_date} · {record.days} días</dd>
        <dt>Ciudad</dt>
        <dd>{record.city}</dd>
        <dt>Propietario</dt>
        <dd>{record.owner_name}<small>{record.owner_email}</small></dd>
        <dt>Arrendatario</dt>
        <dd>{record.renter_name}<small>{record.renter_email}</small></dd>
        <dt>Total</dt>
        <dd>{money(record.total)}</dd>
        <dt>Comisión</dt>
        <dd>{money(record.commission)}</dd>
      </dl>
      <p class="admin-note">Importes contractuales; no acreditan un cobro real.</p>
      <DetalleFlota kind="reservation" {record} {data} {busy} {mutate} />
    {:else if modal.kind === 'incident'}
      <h3>{record.title}</h3>
      <div class="admin-tabs" role="group" aria-label="Vistas de incidencia">
        <button aria-pressed={tab === 'detalle'} onclick={() => (tab = 'detalle')}
          >Detalle y seguimiento</button
        ><button aria-pressed={tab === 'historial'} onclick={() => (tab = 'historial')}
          >Historial</button
        >
      </div>
      {#if tab === 'detalle'}<p>{record.description}</p>
        <DetalleFlota kind="incident" {record} {data} {busy} {mutate} />
        <small
          >Prioridad: {record.priority} · Vehículo: {record.vehicle_id || 'Sin vincular'} · Propietario:
          {record.owner_id || 'Sin vincular'}</small
        ><small>{record.author_name} · {date(record.updated_at)}</small>
        <form onsubmit={submit}>
          <SelectorPersonalizado
            id="incident-status"
            label="Estado de la incidencia"
            bind:value={status}
            options={options(['ABIERTA', 'EN_REVISION', 'PENDIENTE_INFO', 'RESUELTA', 'CERRADA'])}
            disabled={busy}
          /><label
            >Nota de seguimiento o resolución<textarea
              bind:value={resolution}
              required
              minlength="5"
              maxlength="4000"
              disabled={busy}></textarea></label
          >
          <div class="admin-dialog-actions">
            <button type="button" disabled={busy} onclick={onclose}>Cerrar</button><button
              class="button"
              disabled={busy}>Guardar seguimiento</button
            >
          </div>
        </form>
      {:else}<small>Eventos incluidos en las últimas 100 acciones administrativas.</small
        >{#each data.actions.filter((a) => a.entity_type === 'INCIDENCIA' && a.entity_id === record.id) as a}<article
            class="panel"
          >
            <strong>{label(a.action)}</strong>
            <p>{a.reason}</p>
            <small>{a.admin_name} · {date(a.created_at)}</small>
          </article>{:else}<p>No hay eventos recientes para este caso.</p>{/each}{/if}
    {:else}<h3>{label(record.action)} · {record.entity_type} #{record.entity_id}</h3>
      <p>{record.reason}</p>
      <dl>
        <dt>Responsable</dt>
        <dd>{record.admin_name}</dd>
        <dt>Fecha</dt>
        <dd>{date(record.created_at)}</dd>
      </dl>{/if}
  {:else}<p>El registro ya no está disponible. Actualiza el listado.</p>{/if}
</Dialogo>
