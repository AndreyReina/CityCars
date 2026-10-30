<!--
Adapta las ciudades disponibles al selector compartido.
Capa: Vista / presentación. Relación: svelte
-->
<script>
  import { tick } from 'svelte';
  let {
    value = $bindable(''),
    options = [],
    disabled = false,
    placeholder = 'Todas las ciudades',
  } = $props();
  let open = $state(false),
    query = $state(''),
    active = $state(0),
    input;
  const normalize = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const matches = $derived(
    options.filter((option) => normalize(option).includes(normalize(query))),
  );
  const choices = $derived(['', ...matches]);
  $effect(() => {
    if (disabled) open = false;
  });
  function expand() {
    if (disabled || open) return;
    query = '';
    active = Math.max(0, choices.indexOf(value));
    open = true;
  }
  function choose(option) {
    value = option;
    open = false;
    input.focus();
  }
  async function keydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(choices[active]);
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) expand();
      else
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
      await tick();
      document.getElementById('city-option-' + active)?.scrollIntoView({ block: 'nearest' });
    }
  }
</script>

<div
  class="city-select"
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) open = false;
  }}
>
  <label for="city-search">Ciudad</label>
  <div class="city-select__control">
    <input
      id="city-search"
      bind:this={input}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls="city-options"
      aria-activedescendant={open ? 'city-option-' + active : undefined}
      autocomplete="off"
      {disabled}
      placeholder={open ? 'Escribe una ciudad…' : placeholder}
      value={open ? query : value}
      onclick={expand}
      onkeydown={keydown}
      oninput={(event) => {
        open = true;
        query = event.currentTarget.value;
        active = matches.length ? 1 : 0;
      }}
    />
    <button
      type="button"
      class="city-select__toggle"
      {disabled}
      tabindex="-1"
      aria-label={open ? 'Cerrar ciudades' : 'Mostrar ciudades'}
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
  </div>
  {#if open}
    <div class="city-select__dropdown">
      <div
        id="city-options"
        role="listbox"
        aria-label="Ciudades disponibles"
        class="city-select__options"
      >
        {#each choices as option, index}
          <button
            type="button"
            role="option"
            id={'city-option-' + index}
            tabindex="-1"
            aria-selected={value === option}
            class:active={active === index}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => choose(option)}
          >
            <span>{option || 'Todas las ciudades'}</span><span aria-hidden="true"
              >{value === option ? '✓' : ''}</span
            >
          </button>
        {/each}
      </div>
      <p class="city-select__status" role="status">
        {matches.length
          ? `${matches.length} ${matches.length === 1 ? 'ciudad disponible' : 'ciudades disponibles'}`
          : 'No hay ciudades que coincidan.'}
      </p>
    </div>
  {/if}
</div>

<style>
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
