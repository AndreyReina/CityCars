<!--
Presenta preguntas frecuentes usando el acordeón accesible.
Capa: Vista / presentación. Relación: ../componentes/Acordeon.svelte
-->
<script>
  import Acordeon from '../componentes/Acordeon.svelte';
  const questions = [
    [
      '¿Puedo explorar sin crear una cuenta?',
      'Sí. Consulta el catálogo, compara automóviles y revisa sus detalles libremente. Para reservar, crea una cuenta de arrendatario.',
    ],
    [
      '¿Cómo publico mi automóvil?',
      'Crea una cuenta de propietario, entra a Mi cuenta y completa la información del automóvil con su imagen principal. Una vez aprobada la publicación, aparecerá en el catálogo.',
    ],
    [
      '¿Cómo se cuentan los días de alquiler?',
      'La fecha de inicio se incluye y la de devolución se excluye. Por ejemplo, del 27 al 29 son dos días. El período mínimo es de un día completo.',
    ],
    [
      '¿Cómo funciona el pago?',
      'El pago disponible actualmente es simulado y no genera cobros. Puedes elegir un resultado aprobado o rechazado, sin ingresar datos bancarios.',
    ],
    [
      '¿Qué pasa si otra persona reserva primero?',
      'Comprobamos nuevamente la disponibilidad al confirmar. Si el automóvil ya está reservado para esas fechas, podrás elegir otro período o buscar una alternativa.',
    ],
    [
      '¿Puedo cancelar mi reserva?',
      'Puedes cancelar desde Mi cuenta antes de la fecha de inicio. Una vez cancelada, esas fechas vuelven a estar disponibles.',
    ],
    [
      '¿Cómo se finaliza una reserva?',
      'El propietario puede marcar la reserva como finalizada desde la fecha de devolución acordada.',
    ],
    [
      '¿Puedo publicar y reservar con la misma cuenta?',
      'Cada cuenta tiene un único rol: propietario para publicar automóviles o arrendatario para reservarlos. Elige el que corresponda a lo que necesitas.',
    ],
    [
      '¿Qué incluye el precio?',
      'El total corresponde a los días de alquiler por la tarifa diaria del automóvil. Puedes consultar el importe total antes de confirmar. No incluye seguros, asistencia vial ni entrega a domicilio.',
    ],
  ];
</script>

<section class="page">
  <p class="eyebrow">ESTAMOS PARA ORIENTARTE</p>
  <h1>¿Cómo podemos ayudarte?</h1>
  <p class="lead">Encuentra respuestas para buscar, publicar y reservar tu próximo automóvil.</p>
  <div class="stack">
    {#each questions as [question, answer], i}
      <Acordeon id={'faq-' + i} {question} {answer} />
    {/each}
  </div>
  <div class="actions">
    <a class="button" href="/carros">Explorar carros</a><a class="button secondary" href="/alquilar"
      >Cómo alquilar</a
    >
  </div>
</section>
