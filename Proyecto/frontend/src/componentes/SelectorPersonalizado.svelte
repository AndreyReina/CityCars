<!--
Combobox accesible con búsqueda normalizada, teclado, foco y selección controlada.
Capa: Vista / presentación. Relación: svelte
-->
<script>
  import { tick } from 'svelte';
  let {
    value = $bindable(''),
    options = [],
    disabled = false,
    id,
    label,
    placeholder = 'Selecciona una opción',
    searchPlaceholder = 'Escribe para buscar…',
    emptyLabel = null,
    emptyMessage = 'No hay opciones que coincidan.',
  } = $props();
  let open = $state(false),
    query = $state(''),
    active = $state(0),
    input = $state();
  const searchable = true;
  const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const matches = $derived(
    options.filter((option) => !searchable || normalize(option.label).includes(normalize(query))),
  );
  const choices = $derived(
    emptyLabel === null ? matches : [{ value: '', label: emptyLabel }, ...matches],
  );
  const selectedLabel = $derived(
    options.find((option) => option.value === value)?.label ||
      (value === '' ? emptyLabel || '' : ''),
  );
  $effect(() => {
    if (disabled) open = false;
  });
  function expand() {
    if (disabled || open) return;
    query = '';
    active = Math.max(
      0,
      choices.findIndex((option) => option.value === value),
    );
    open = true;
  }
  function choose(option) {
    if (!option) return;
    value = option.value;
    open = false;
    input.focus();
  }
  async function keydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    }
    if (!searchable && (event.key === ' ' || (event.key === 'Enter' && !open))) {
      event.preventDefault();
      if (open) choose(choices[active]);
      else expand();
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(choices[active]);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) expand();
      else if (choices.length)
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
      await tick();
      document.getElementById(id + '-option-' + active)?.scrollIntoView({ block: 'nearest' });
    }
  }
</script>

<div
  class="city-select"
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) open = false;
  }}
>
  <label for={id}>{label}</label>
  <div class="city-select__control">
    {#if searchable}<input
        {id}
        bind:this={input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={id + '-options'}
        aria-activedescendant={open && choices[active] ? id + '-option-' + active : undefined}
        autocomplete="off"
        {disabled}
        placeholder={open ? searchPlaceholder : placeholder}
        value={open ? query : selectedLabel}
        onclick={expand}
        onfocus={expand}
        onkeydown={keydown}
        oninput={(event) => {
          open = true;
          query = event.currentTarget.value;
          active = matches.length && emptyLabel !== null ? 1 : 0;
        }}
      />
    {:else}
      <button
        type="button"
        class="city-select__trigger"
        {id}
        bind:this={input}
        role="combobox"
        aria-expanded={open}
        aria-controls={id + '-options'}
        aria-activedescendant={open && choices[active] ? id + '-option-' + active : undefined}
        {disabled}
        onclick={() => {
          if (open) open = false;
          else expand();
        }}
        onkeydown={keydown}
      >
        <span>{selectedLabel || placeholder}</span>
        <svg
          class:rotated={open}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          ><path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
      </button>
    {/if}
    {#if searchable}
      <button
        type="button"
        class="city-select__toggle"
        onmousedown={(event) => event.preventDefault()}
        {disabled}
        tabindex="-1"
        aria-label={(open ? 'Cerrar: ' : 'Mostrar: ') + label}
        onclick={() => {
          if (open) open = false;
          else expand();
          input.focus();
        }}
      >
        <svg
          class:rotated={open}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          ><path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
      </button>
    {/if}
  </div>
  {#if open}
    <div class="city-select__dropdown">
      <div id={id + '-options'} role="listbox" aria-label={label} class="city-select__options">
        {#each choices as option, index}
          <button
            type="button"
            role="option"
            id={id + '-option-' + index}
            tabindex="-1"
            aria-selected={value === option.value}
            class:active={active === index}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => choose(option)}
          >
            <span>{option.label}</span><span aria-hidden="true"
              >{value === option.value ? '✓' : ''}</span
            >
          </button>
        {/each}
      </div>
      {#if searchable}<p class="city-select__status" role="status">
          {matches.length
            ? `${matches.length} ${matches.length === 1 ? 'opción disponible' : 'opciones disponibles'}`
            : emptyMessage}
        </p>{/if}
    </div>
  {/if}
</div>

<style>
  .city-select__trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    border: 1px solid #aaa;
    border-radius: 8px;
    background: white;
    color: #252525;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .city-select__trigger svg {
    flex-shrink: 0;
  }
  .city-select__trigger:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .city-select {
    position: relative;
    min-width: 0;
    flex: 1;
  }
  .city-select__control {
    position: relative;
  }
  .city-select__control input {
    width: 100%;
    padding-right: 44px;
  }
  .city-select__toggle {
    position: absolute;
    inset: 0 0 0 auto;
    width: 44px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  svg {
    transition: transform 180ms ease;
  }
  svg.rotated {
    transform: rotate(180deg);
  }
  .city-select__dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 20;
    background: #fafafa;
    border: 1px solid #d8d8d8;
    border-radius: 16px;
    box-shadow: 0 12px 32px #00000014;
    overflow: hidden;
  }
  .city-select__options {
    max-height: 240px;
    overflow-y: auto;
    padding: 6px;
  }
  .city-select__options button {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .city-select__options button:hover,
  .city-select__options button.active {
    background: #e8e8e8;
  }
  .city-select__options button[aria-selected='true'] {
    font-weight: 600;
  }
  .city-select__status {
    margin: 0;
    padding: 10px 16px;
    border-top: 1px solid #dedede;
    color: #555;
    font-size: 13px;
  }
  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }
</style>
