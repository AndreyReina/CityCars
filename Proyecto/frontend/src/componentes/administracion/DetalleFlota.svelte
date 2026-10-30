<!--
Presenta documentación, movimientos y comunicaciones relacionadas con la flota.
Capa: Vista / presentación. Relación: ../SelectorPersonalizado.svelte, ../../api.js, ../propietario/presentacion.js
-->
<script>
  import SelectorPersonalizado from '../SelectorPersonalizado.svelte';
  import { money, today } from '../../api.js';
  import { options, estadoDocumento } from '../propietario/presentacion.js';
  let { kind, record, data, busy, mutate } = $props();
  let entryKind = $state('COBRO'),
    amount = $state(''),
    reference = $state(''),
    paidOn = $state(today());
</script>

{#if kind === 'vehicle'}
  <h3>Documentación y operación</h3>
  <p>
    {record.paused ? 'Pausado por el propietario.' : ''}
    {record.archived ? 'Archivado.' : ''} Odómetro: {record.mileage ?? 'Sin registrar'} km
  </p>
  <p>
    Técnico-mecánica: {record.rtm_required ? 'declarada exigible' : 'no marcada como exigible'}.
    Fechas declaradas, no verificadas oficialmente.
  </p>
  {#each ['SOAT', ...(record.rtm_required ? ['RTM'] : [])] as type}{@const doc =
      data.documents?.find((d) => d.vehicle_id === record.id && d.kind === type)}
    <p>{type}: {estadoDocumento(doc, today())} · {doc?.expires_on || 'Sin registrar'}</p>{/each}
  <details>
    <summary>Historial de renovaciones</summary
    >{#each data.documents?.filter((d) => d.vehicle_id === record.id) || [] as d}<p>
        {d.kind} · Vence {d.expires_on} · {d.created_at.slice(0, 10)}
        {#if d.file_id}<a href={'/api/files/' + d.file_id}>Documento</a>{/if}
      </p>{:else}<p>Sin renovaciones registradas.</p>{/each}
  </details>
{:else if kind === 'reservation'}
  <h3>Movimientos financieros registrados</h3>
  {#each data.entries?.filter((e) => e.reservation_id === record.id) || [] as e}<p>
      {e.paid_on} · {e.kind} · {money(e.amount)} · {e.reference}
    </p>{:else}<p>Sin cobros ni desembolsos reales registrados.</p>{/each}
  <details>
    <summary>Registrar un movimiento documentado</summary>
    <p class="admin-note">
      Registra únicamente cobros o transferencias ya realizados fuera de la plataforma, con
      referencia comprobable. Este formulario no cobra ni transfiere dinero. No registres el pago
      simulado como un movimiento real.
    </p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        mutate('/admin/financial-entries', {
          reservationId: record.id,
          kind: entryKind,
          amount,
          reference,
          paidOn,
        });
      }}
    >
      <SelectorPersonalizado
        id="financial-entry-kind"
        label="Movimiento"
        bind:value={entryKind}
        options={options(['COBRO', 'DESEMBOLSO'])}
        disabled={busy}
      />
      <label
        >Importe COP<input
          type="number"
          required
          min="0.01"
          max="1000000000"
          step="0.01"
          bind:value={amount}
          disabled={busy}
        /></label
      >
      <label
        >Referencia del comprobante<input
          required
          minlength="5"
          maxlength="180"
          bind:value={reference}
          disabled={busy}
        /></label
      >
      <label
        >Fecha del movimiento<input
          type="date"
          required
          max={today()}
          bind:value={paidOn}
          disabled={busy}
        /></label
      >
      <button class="button" disabled={busy}>Registrar movimiento</button>
    </form>
  </details>
{:else if kind === 'incident'}
  <p>Tipo: {record.kind} · Reserva: {record.reservation_id || 'Sin vincular'}</p>
  {#if record.file_id}<a href={'/api/files/' + record.file_id}>Descargar evidencia inicial</a>{/if}
  <h3>Comunicaciones</h3>
  {#each data.messages?.filter((m) => m.incident_id === record.id) || [] as m}<article
      class="panel"
    >
      <strong>{m.author_name} · {m.author_role}</strong>
      <p>{m.body}</p>
      <small>{new Date(m.created_at).toLocaleString('es-CO')}</small>{#if m.file_id}<a
          href={'/api/files/' + m.file_id}>Adjunto</a
        >{/if}
    </article>{:else}<p>Sin mensajes registrados.</p>{/each}
{/if}
