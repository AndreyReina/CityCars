<!--
Presenta las páginas informativas de alquiler y ventajas mediante la ruta recibida.
Capa: Vista / presentación. Relación: Consumido por su página, script de ejecución o proceso de compilación.
-->
<script>
  let { page } = $props();
  const data = {
    '/por-que-elegirnos': {
      title: 'Más posibilidades para tu próximo viaje.',
      intro:
        'CityCars conecta propietarios de automóviles y personas que buscan alquilar por días. La plataforma actúa como intermediaria.',
      items: [
        [
          'Encuentra tu automóvil',
          'Explora publicaciones aprobadas, filtra por ciudad y consulta disponibilidad para tus fechas.',
        ],
        ['Un precio claro', 'Conoce los días, la tarifa y el total antes de confirmar.'],
        [
          'Gestiona desde tu cuenta',
          'Los arrendatarios consultan sus reservas. Los propietarios administran sus publicaciones y los alquileres de sus automóviles.',
        ],
      ],
    },
    '/alquilar': {
      title: 'Tu próxima ruta comienza aquí.',
      intro: 'Encuentra tu automóvil y organiza tu reserva en cuatro pasos.',
      items: [
        [
          '01 · Explora',
          'Busca un automóvil por ciudad y fechas. Solo aparecen publicaciones aprobadas y activas.',
        ],
        [
          '02 · Elige tus días',
          'La devolución no cuenta como día adicional: del 27 al 29 son dos días.',
        ],
        [
          '03 · Inicia sesión',
          'Necesitas una cuenta con rol arrendatario para reservar. Cada cuenta tiene un solo rol.',
        ],
        [
          '04 · Revisa y confirma',
          'Revisa el precio y elige un resultado de pago simulado. Solo se confirma si el pago se aprueba y las fechas siguen disponibles.',
        ],
      ],
    },
  };
</script>

<section class="page">
  <p class="eyebrow">CITYCARS · CONOCE LA PLATAFORMA</p>
  <h1>{data[page].title}</h1>
  <p class="lead">{data[page].intro}</p>
  <div class="info-grid">
    {#each data[page].items as [title, text]}<article class="panel">
        <h2>{title}</h2>
        <p>{text}</p>
      </article>{/each}
  </div>
  <div class="actions">
    <a class="button" href="/carros">Explorar carros →</a><a
      class="button secondary"
      href="/registro">Crear una cuenta</a
    >
  </div>
</section>
