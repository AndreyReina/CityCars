<!--
Presenta preguntas expandibles con animación y estado accesible.
Capa: Vista / presentación. Relación: svelte, svelte/transition
-->
<script>
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  let { id, question, answer } = $props();
  let open = $state(false);
  let reducedMotion = $state(false);
  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => (reducedMotion = preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  });
</script>

<section class="panel faq">
  <h2>
    <button
      id={id + '-question'}
      class="faq__question"
      aria-expanded={open}
      aria-controls={id + '-answer'}
      onclick={() => (open = !open)}
    >
      <span>{question}</span>
      <svg
        class="faq__arrow"
        class:faq__arrow--open={open}
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </h2>
  <div id={id + '-answer'} role="region" aria-labelledby={id + '-question'} aria-hidden={!open}>
    {#if open}<div transition:slide={{ duration: reducedMotion ? 0 : 220 }}>
        <p class="faq__answer">{answer}</p>
      </div>{/if}
  </div>
</section>
