/**
 * Monta el componente Aplicacion y carga los estilos globales en el elemento app.
 * Capa: Vista / presentación.
 * Relación: svelte, ./Aplicacion.svelte, ./estilos.css
 */
import { mount } from 'svelte';
import Aplicacion from './Aplicacion.svelte';
import './estilos.css';
mount(Aplicacion, { target: document.getElementById('app') });
