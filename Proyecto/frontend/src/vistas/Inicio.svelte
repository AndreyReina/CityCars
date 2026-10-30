<!--
Presenta el inicio público y el carrusel de marcas con datos de portada.
Capa: Vista / presentación. Relación: ../datosPortada.js
-->
<script>
  import { carData } from '../datosPortada.js';
  const cars = Object.values(carData);
  const logos = [
    'logo_honda',
    'mazda_logo',
    'Volkswagen_logo',
    'Peugeot_logo',
    'Hyundai_logo',
    'Toyota_logo',
    'Porsche_logo',
    'Mercedes_Benz_Logo',
    'BMW_logo',
  ];
  let selected = $state(0);
  let gallery = $state(0);
</script>

<section class="hero">
  <div class="hero__content">
    <h1 class="hero__title">Renta de Carros Premium en Colombia</h1>
    <p class="hero__description">
      Conecta con propietarios y encuentra el automóvil que te acompañará en tu próxima ruta por
      Colombia.
    </p>
  </div>
  <div class="hero__background"></div>
  <img src={cars[selected].src} alt={cars[selected].alt} class="hero__image" />
  <div class="hero__brands">
    {#each cars as car, i}<button
        class="hero__brand-btn"
        class:hero__brand-btn--active={selected === i}
        onclick={() => (selected = i)}
        aria-label={'Mostrar ' + car.alt}
        aria-pressed={selected === i}
        ><img
          src={'/imagenes/logos-autos/' + logos[i] + '.svg'}
          alt={car.alt}
          class="hero__brand-logo"
        /></button
      >{/each}
  </div>
</section>

<!-- ===================== GALLERY ===================== -->
<section class="gallery">
  <div class="gallery__header">
    <p class="gallery__eyebrow">INSPIRACIÓN PARA TU PRÓXIMA RUTA</p>
    <div class="gallery__intro">
      <h2 class="gallery__title">Explora posibilidades</h2>
      <p class="gallery__description">
        Encuentra el estilo que va contigo y consulta los automóviles disponibles para tu próximo
        viaje.
      </p>
    </div>
  </div>
  <div class="gallery__carousel">
    <nav class="gallery__filters" aria-label="Muestra de automóviles">
      {#each cars as car, i}<button
          class="gallery__filter-btn"
          onclick={() => (gallery = i)}
          aria-pressed={gallery === i}>{car.alt.split(' ')[0]}</button
        >{/each}
    </nav>
    <div class="gallery__carousel-body">
      <div class="gallery__slide-wrapper">
        <div class="gallery__slide">
          <button
            class="gallery__arrow gallery__arrow--prev"
            onclick={() => (gallery = (gallery + cars.length - 1) % cars.length)}
            aria-label="Automóvil anterior"
          >
            <img src="/imagenes/Left Arrow.svg" alt="Left Arrow" />
          </button>
          <figure class="gallery__image">
            <img src={cars[gallery].src} alt={cars[gallery].alt} />
            <figcaption>{cars[gallery].alt} · Imagen ilustrativa</figcaption>
          </figure>
          <button
            class="gallery__arrow gallery__arrow--next"
            onclick={() => (gallery = (gallery + 1) % cars.length)}
            aria-label="Automóvil siguiente"
          >
            <img src="/imagenes/Right Arrow.svg" alt="Right Arrow" />
          </button>
        </div>
        <div class="gallery__indicators">
          <span>{gallery + 1} / {cars.length}</span>
        </div>
      </div>
      <a href="/carros" class="gallery__cta"
        >Ver todos los modelos <img src="/imagenes/Arrow Black.svg" alt="Button Arrow" /></a
      >
    </div>
  </div>
</section>

<!-- ===================== REASONS ===================== -->
<section class="reasons">
  <div class="reasons__header">
    <p class="reasons__eyebrow">CUIDANDO DE CADA CLIENTE</p>
    <div class="reasons__intro">
      <h2 class="reasons__title">¿Por qué elegirnos?</h2>
      <p class="reasons__description">
        Explora, compara y gestiona tus reservas desde un mismo lugar. Conoce el modelo de
        intermediación de CityCars.
      </p>
    </div>
  </div>
  <ul class="reasons__list">
    <li class="reasons__item">
      <figure class="reasons__item-icon">
        <img src="/imagenes/Llaves.svg" alt="Llaves" />
      </figure>
      <p class="reasons__item-text">
        Encuentra automóviles por ciudad y consulta sus fechas disponibles.
      </p>
    </li>
    <li class="reasons__item">
      <figure class="reasons__item-icon">
        <img src="/imagenes/Text-voice.svg" alt="Text-voice" />
      </figure>
      <p class="reasons__item-text">Consulta ayuda para entender cada paso del alquiler.</p>
    </li>
    <li class="reasons__item">
      <figure class="reasons__item-icon">
        <img src="/imagenes/Candado.svg" alt="Candado" />
      </figure>
      <p class="reasons__item-text">Conoce el precio total antes de confirmar tu reserva.</p>
    </li>
    <li class="reasons__item">
      <figure class="reasons__item-icon">
        <img src="/imagenes/Manos.svg" alt="Manos" />
      </figure>
      <p class="reasons__item-text">Gestiona publicaciones y reservas según tu rol.</p>
    </li>
  </ul>
</section>

<!-- ===================== CTA ===================== -->
<section class="cta">
  <h2 class="cta__title">Reserva tu coche en minutos</h2>
  <p class="cta__description">
    Elige tu ciudad, encuentra un automóvil disponible y organiza tu próxima ruta desde un mismo
    lugar.
  </p>
  <a class="cta__btn" href="/carros">EXPLORAR CARROS →</a>
</section>
