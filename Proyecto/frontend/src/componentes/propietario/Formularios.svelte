<!--
Presenta formularios de publicaciones, mantenimiento, documentos, incidencias y kilometraje.
Capa: Vista / presentación. Relación: svelte, ../administracion/Dialogo.svelte, ../SelectorPersonalizado.svelte, ./Adjunto.svelte, ./FotosVehiculo.svelte, ./UbicacionPublicacion.svelte
-->
<script>
  import { untrack } from 'svelte';
  import Dialogo from '../administracion/Dialogo.svelte';
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import Adjunto from './Adjunto.svelte';
  import FotosVehiculo from './FotosVehiculo.svelte';
  import UbicacionPublicacion from './UbicacionPublicacion.svelte';
  import { errorSeleccion } from '../../datos/catalogoPublicacion.js';
  import { options, estadoVehiculo, estadoDocumento } from './presentacion.js';
  import { money, today } from '../../api.js';
  let { modal, data, busy, error, onclose, mutate, user } = $props();
  const vehicle = (id) => data.vehicles.find((v) => v.id === Number(id));
  const v = $derived(vehicle(modal.id));
  const r = $derived(data.reservations.find((r) => r.id === modal.id));
  const incident = $derived(data.incidents.find((i) => i.id === modal.id));
  const history = $derived(
    data.events.filter((e) => e.vehicle_id === modal.id && e.module === 'vehiculos'),
  );
  const carOptions = $derived(
    data.vehicles
      .filter((v) => !v.archived)
      .map((v) => ({ value: String(v.id), label: '#' + v.id + ' · ' + v.brand + ' ' + v.model })),
  );
  let form = $state(
    untrack(() =>
      modal.kind === 'vehicle' && modal.id
        ? { ...vehicle(modal.id) }
        : {
            brand: '',
            model: '',
            year: new Date().getFullYear(),
            city: '',
            daily_price: '',
            description: '',
            image: '',
            photos: [],
            photo_categories: {},
            features: '',
            conditions: '',
            mileage: '',
            rtm_required: false,
            vehicleId: modal.vehicleId ? String(modal.vehicleId) : '',
            kind:
              modal.kind === 'document' ? 'SOAT' : modal.kind === 'case' ? 'GENERAL' : 'Preventivo',
            expiresOn: '',
            dueDate: today(),
            dueKm: '',
            start: '',
            end: '',
            status: modal.kind === 'complete' ? 'COMPLETADO' : 'PROGRAMADO',
            completedDate: today(),
            cost: 0,
            priority: 'MEDIA',
            reservationId: '',
            title: '',
            phase:
              modal.kind === 'odometer' &&
              data.reservations.find((r) => r.id === modal.id)?.delivery_km != null
                ? 'DEVOLUCION'
                : 'ENTREGA',
            body: '',
            action: modal.action || '',
            fileId: null,
          },
    ),
  );
  let tab = $state('detalle'),
    uploading = $state(false);
  let catalogError = $state('');
  const disabled = $derived(busy || user.suspended || uploading);
  const title = $derived(
    {
      vehicle: modal.id ? 'Editar vehículo' : 'Nueva publicación',
      document: 'Registrar renovación',
      maintenance: 'Registrar mantenimiento',
      complete: 'Cerrar mantenimiento',
      odometer: 'Registrar kilometraje',
      case: 'Nuevo reporte',
      caseDetail: 'Caso #' + modal.id,
      state: 'Confirmar cambio de publicación',
      vehicleDetail: 'Ficha del vehículo',
      reservation: 'Reserva #' + modal.id,
      review: 'Reseña del alquiler',
      maintenanceDetail: 'Detalle del mantenimiento',
      event: 'Historial de modificación',
    }[modal.kind],
  );
  async function submit(event) {
    event.preventDefault();
    let path,
      method = 'POST',
      body = { ...form };
    if (modal.kind === 'vehicle') {
      catalogError = errorSeleccion(form, v || {});
      if (catalogError) return;
      path = '/owner/vehicles' + (modal.id ? '/' + modal.id : '');
      method = modal.id ? 'PUT' : 'POST';
    } else if (modal.kind === 'document') path = '/owner/documents';
    else if (modal.kind === 'maintenance') path = '/owner/maintenance';
    else if (modal.kind === 'complete') {
      path = '/owner/maintenance/' + modal.id;
      method = 'PUT';
    } else if (modal.kind === 'odometer') path = '/owner/reservations/' + modal.id + '/odometer';
    else if (modal.kind === 'case') path = '/owner/incidents';
    else if (modal.kind === 'caseDetail') path = '/incidents/' + modal.id + '/messages';
    else if (modal.kind === 'state') path = '/owner/vehicles/' + modal.id + '/state';
    await mutate(path, body, method);
  }
</script>

<Dialogo {title} busy={busy || uploading} {onclose}>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if catalogError}<p class="error" role="alert">{catalogError}</p>{/if}
  {#if ['vehicle', 'document', 'maintenance', 'complete', 'odometer', 'case', 'caseDetail', 'state'].includes(modal.kind)}
    <form onsubmit={submit}>
      <fieldset {disabled}>
        {#if modal.kind === 'vehicle'}
          <div class="owner-form-grid">
            <UbicacionPublicacion
              bind:brand={form.brand}
              bind:model={form.model}
              bind:city={form.city}
              original={v || {}}
              {disabled}
            />
            <label
              >Año<input
                type="number"
                min="1950"
                max={new Date().getFullYear() + 1}
                required
                bind:value={form.year}
              /></label
            >
            <label
              >Tarifa diaria (COP)<input
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                required
                bind:value={form.daily_price}
              /></label
            >
            <label
              >Kilometraje actual<input
                type="number"
                min={v?.mileage || 0}
                max="10000000"
                required
                bind:value={form.mileage}
              /></label
            >
          </div>
          <FotosVehiculo
            bind:image={form.image}
            bind:photos={form.photos}
            bind:categories={form.photo_categories}
            bind:uploading
            disabled={busy || user.suspended}
          />
          <label
            >Descripción<textarea
              required
              minlength="10"
              maxlength="2000"
              bind:value={form.description}></textarea></label
          >
          <label class="owner-check"
            ><input type="checkbox" bind:checked={form.rtm_required} /> La revisión técnico-mecánica es
            exigible para este vehículo</label
          >
          <p class="admin-note">
            La publicación se enviará a revisión administrativa. Las ediciones requieren no tener
            reservas vigentes o futuras. El kilometraje no puede disminuir.
          </p>
        {:else if modal.kind === 'state'}
          <p>{v?.brand} {v?.model} · {form.action}</p>
          <p>
            {form.action === 'PAUSAR'
              ? 'La pausa impide nuevas reservas y conserva las ya confirmadas.'
              : form.action === 'DESARCHIVAR'
                ? 'El vehículo volverá pausado, conservando la aprobación y las restricciones existentes. Podrás editarlo o reactivarlo cuando cumpla las condiciones.'
                : form.action === 'ARCHIVAR'
                  ? 'Se conservará el historial. No es posible archivar con reservas, casos, mantenimientos o desembolsos pendientes.'
                  : 'La reactivación requiere aprobación, documentación registrada sin vencimientos y ausencia de bloqueos de mantenimiento actuales.'}
          </p>
        {:else if modal.kind === 'document'}
          <SelectorPersonalizado
            id="document-vehicle"
            label="Vehículo"
            bind:value={form.vehicleId}
            options={carOptions}
            {disabled}
          />
          <SelectorPersonalizado
            id="document-kind"
            label="Documento"
            bind:value={form.kind}
            options={options(['SOAT', 'RTM'])}
            {disabled}
          />
          <label>Vencimiento<input type="date" required bind:value={form.expiresOn} /></label>
          <Adjunto bind:value={form.fileId} bind:uploading disabled={busy} />
          <p class="admin-note">
            Fecha declarada por el propietario, no verificada oficialmente. Un documento obligatorio
            registrado que esté vencido impide nuevas reservas; las confirmadas se conservan. La
            renovación no borra el historial.
          </p>
        {:else if ['maintenance', 'complete'].includes(modal.kind)}
          {#if modal.kind === 'maintenance'}
            <SelectorPersonalizado
              id="maintenance-vehicle"
              label="Vehículo"
              bind:value={form.vehicleId}
              options={carOptions}
              {disabled}
            />
            <label
              >Tipo de mantenimiento<input
                required
                minlength="2"
                maxlength="80"
                bind:value={form.kind}
              /></label
            ><label
              >Descripción<textarea
                required
                minlength="5"
                maxlength="2000"
                bind:value={form.description}></textarea></label
            >
            <SelectorPersonalizado
              id="maintenance-status"
              label="Registro"
              bind:value={form.status}
              options={options(['PROGRAMADO', 'COMPLETADO'])}
              {disabled}
            />
            <div class="owner-form-grid">
              <label>Fecha prevista<input type="date" required bind:value={form.dueDate} /></label
              ><label
                >Recordar a los kilómetros (opcional)<input
                  type="number"
                  min="0"
                  max="10000000"
                  bind:value={form.dueKm}
                /></label
              >
            </div>
            {#if form.status === 'PROGRAMADO'}<p>
                Bloqueo de disponibilidad opcional. La fecha final es exclusiva.
              </p>
              <div class="owner-form-grid">
                <label
                  >Inicio del bloqueo<input
                    type="date"
                    min={today()}
                    bind:value={form.start}
                  /></label
                ><label
                  >Fin del bloqueo<input
                    type="date"
                    min={form.start || today()}
                    bind:value={form.end}
                  /></label
                >
              </div>{/if}
          {:else}<SelectorPersonalizado
              id="maintenance-close"
              label="Resultado"
              bind:value={form.status}
              options={options(['COMPLETADO', 'CANCELADO'])}
              {disabled}
            />{/if}
          {#if form.status === 'COMPLETADO'}<div class="owner-form-grid">
              <label
                >Fecha realizada<input
                  type="date"
                  max={today()}
                  required
                  bind:value={form.completedDate}
                /></label
              ><label
                >Kilometraje<input
                  type="number"
                  min="0"
                  max="10000000"
                  required
                  bind:value={form.mileage}
                /></label
              ><label
                >Costo (COP)<input
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  bind:value={form.cost}
                /></label
              >
            </div>{/if}
          <Adjunto bind:value={form.fileId} bind:uploading disabled={busy} />
        {:else if modal.kind === 'odometer'}
          <p>Reserva #{r.id} · {r.start_date} → {r.end_date}</p>
          <SelectorPersonalizado
            id="odometer-phase"
            label="Momento"
            bind:value={form.phase}
            options={options(r.delivery_km == null ? ['ENTREGA'] : ['DEVOLUCION'])}
            {disabled}
          />
          <label
            >Odómetro en kilómetros<input
              type="number"
              min={vehicle(r.vehicle_id)?.mileage || 0}
              max="10000000"
              required
              bind:value={form.mileage}
            /></label
          >
          <p class="admin-note">
            Se conservará la lectura con fecha y reserva. Cada entrega y devolución se registra una
            sola vez.
          </p>
        {:else if modal.kind === 'case'}
          <SelectorPersonalizado
            id="case-vehicle"
            label="Vehículo (opcional)"
            bind:value={form.vehicleId}
            options={carOptions}
            emptyLabel="Sin vehículo"
            {disabled}
          />
          <SelectorPersonalizado
            id="case-reservation"
            label="Reserva (opcional)"
            bind:value={form.reservationId}
            options={data.reservations
              .filter((r) => r.vehicle_id === Number(form.vehicleId))
              .map((r) => ({ value: String(r.id), label: '#' + r.id + ' · ' + r.start_date }))}
            emptyLabel="Sin reserva"
            {disabled}
          />
          <SelectorPersonalizado
            id="case-kind"
            label="Tipo de reporte"
            bind:value={form.kind}
            options={options([
              'RESERVA',
              'ARRENDATARIO',
              'DANO',
              'ACCIDENTE',
              'INCUMPLIMIENTO',
              'TECNICO',
              'QUEJA',
              'RECLAMACION',
              'GENERAL',
            ])}
            {disabled}
          />
          <SelectorPersonalizado
            id="case-priority"
            label="Prioridad"
            bind:value={form.priority}
            options={options(['BAJA', 'MEDIA', 'ALTA'])}
            {disabled}
          />
          <label
            >Título<input required minlength="5" maxlength="160" bind:value={form.title} /></label
          ><label
            >Descripción<textarea
              required
              minlength="10"
              maxlength="4000"
              bind:value={form.description}></textarea></label
          >
          <Adjunto bind:value={form.fileId} bind:uploading disabled={busy} />
        {:else if modal.kind === 'caseDetail'}
          <h3>{incident.title}</h3>
          <span class="badge">{incident.status}</span>
          <p>{incident.description}</p>
          <small
            >{incident.kind} · {incident.priority} · Reserva {incident.reservation_id ||
              'sin vincular'}</small
          >
          {#if incident.file_id}<a href={'/api/files/' + incident.file_id}
              >Descargar evidencia inicial</a
            >{/if}
          <h3>Conversación</h3>
          {#each data.messages.filter((m) => m.incident_id === incident.id) as m}<article
              class="panel"
            >
              <strong>{m.author_name} · {m.author_role}</strong>
              <p>{m.body}</p>
              <small>{new Date(m.created_at).toLocaleString('es-CO')}</small>{#if m.file_id}<a
                  href={'/api/files/' + m.file_id}>Descargar adjunto</a
                >{/if}
            </article>{:else}<p>No hay respuestas todavía.</p>{/each}
          {#if !['RESUELTA', 'CERRADA'].includes(incident.status)}<label
              >Añadir información<textarea
                required
                minlength="2"
                maxlength="4000"
                bind:value={form.body}></textarea></label
            ><Adjunto bind:value={form.fileId} bind:uploading disabled={busy} />{:else}<p>
              El caso está cerrado. Puedes crear un reporte nuevo si necesitas seguimiento
              adicional.
            </p>{/if}
        {/if}
      </fieldset>
      <div class="admin-dialog-actions">
        <button type="button" disabled={busy} onclick={onclose}>Cerrar</button
        >{#if modal.kind !== 'caseDetail' || !['RESUELTA', 'CERRADA'].includes(incident.status)}<button
            class="button"
            {disabled}>Guardar</button
          >{/if}
      </div>
    </form>
  {:else if modal.kind === 'vehicleDetail'}
    <h3>{v.brand} {v.model}</h3>
    <span class="badge">{estadoVehiculo(v)}</span><img
      class="car-image"
      src={v.image || '/imagenes/vehicle-placeholder.svg'}
      alt={v.brand + ' ' + v.model}
    />
    <div class="admin-tabs" role="group" aria-label="Ficha del vehículo">
      <button aria-pressed={tab === 'detalle'} onclick={() => (tab = 'detalle')}>Detalle</button
      ><button aria-pressed={tab === 'historial'} onclick={() => (tab = 'historial')}
        >Historial</button
      >
    </div>
    {#if tab === 'detalle'}<p>{v.description}</p>
      <dl>
        <dt>Tarifa</dt>
        <dd>{money(v.daily_price)} / día</dd>
        <dt>Kilometraje</dt>
        <dd>{v.mileage ?? 'Sin registrar'} km</dd>
      </dl>
      {#each v.photos as photo}<img
          class="car-image"
          src={photo}
          alt={'Fotografía de ' + v.brand + ' ' + v.model}
        />{/each}
    {:else}{#each history as e}<details>
          <summary>{new Date(e.created_at).toLocaleString('es-CO')} · {e.action}</summary
          >{#each Object.entries(e.detail.despues || e.detail).filter(([key, value]) => !e.detail.antes || JSON.stringify(e.detail.antes[key]) !== JSON.stringify(value)) as [key, value]}<p
            >
              <strong>{key}</strong>: {JSON.stringify(e.detail.antes?.[key] ?? '—')} → {JSON.stringify(
                value,
              )}
            </p>{/each}
        </details>{:else}<p>
          No hay cambios registrados desde la incorporación del historial.
        </p>{/each}{/if}
  {:else if modal.kind === 'reservation'}
    <h3>{vehicle(r.vehicle_id)?.brand} {vehicle(r.vehicle_id)?.model}</h3>
    <p>{r.renter_name} · {r.status}</p>
    <p>{r.start_date} → {r.end_date} · {r.days} días</p>
    <dl>
      <dt>Total contractual</dt>
      <dd>{money(r.total)}</dd>
      <dt>Comisión</dt>
      <dd>{money(r.commission)}</dd>
      <dt>Neto contractual</dt>
      <dd>{money(r.total - r.commission)}</dd>
      <dt>Entrega</dt>
      <dd>{r.delivery_km ?? 'Sin registrar'} km</dd>
      <dt>Devolución</dt>
      <dd>{r.return_km ?? 'Sin registrar'} km</dd>
    </dl>
    <p class="admin-note">
      Los importes contractuales no acreditan un cobro. Consulta Ganancias para ver movimientos
      registrados.
    </p>
    <h3>Inconvenientes asociados</h3>
    {#each data.incidents.filter((i) => i.reservation_id === r.id) as i}<p>
        #{i.id} · {i.title} · {i.status}
      </p>{:else}<p>Sin reportes asociados.</p>{/each}
    <h3>Historial de la reserva</h3>
    {#each data.events.filter((e) => e.module === 'reservas' && e.record_id === r.id) as e}<p>
        {new Date(e.created_at).toLocaleString('es-CO')} · {(e.detail.despues || e.detail).status}
      </p>{:else}<p>Sin cambios registrados.</p>{/each}
  {:else if modal.kind === 'review'}{@const review = data.reviews.find((x) => x.id === modal.id)}
    <h3>{review.rating}/5 · {review.renter_name}</h3>
    <p>{review.comment}</p>
    <h3>Recomendación</h3>
    <p>{review.recommendation || 'Sin sugerencias adicionales.'}</p>
    <small>Alquiler #{review.reservation_id} · {review.created_at.slice(0, 10)}</small>
  {:else if modal.kind === 'maintenanceDetail'}{@const m = data.maintenance.find(
      (x) => x.id === modal.id,
    )}
    <h3>{m.kind}</h3>
    <p>{m.description}</p>
    <p>{m.status} · Previsto {m.due_date} · {m.due_km ?? 'Sin umbral'} km</p>
    <p>Indisponibilidad: {m.start_date || 'Sin bloqueo'} → {m.end_date || '—'}</p>
    <p>Realizado: {m.completed_date || 'Pendiente'} · {m.mileage ?? '—'} km · {money(m.cost)}</p>
    {#if m.file_id}<a href={'/api/files/' + m.file_id}>Descargar comprobante</a>{/if}
  {/if}
</Dialogo>
