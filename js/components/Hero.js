import { carData } from "../utils/hero-data.js";

const heroImage = document.querySelector("[data-hero-image]");
const brandButtons = document.querySelectorAll("[data-brand-btn]");

export const prefetchImages = () => {
    Object.values(carData).forEach((car) => {
        const img = new Image();
        img.src = car.src;
    });
};

const toggleClass = (button) => {
    const isActive = button.classList.contains("hero__brand-btn--active");

    brandButtons.forEach((e) => e.classList.remove("hero__brand-btn--active"));
    if (!isActive) button.classList.add("hero__brand-btn--active");
};

export const initHandleBrandChange = () => {
    brandButtons?.forEach((button) => {
        button.addEventListener("click", async () => {
            if (!heroImage) return;
            const clickedLogoAlt = button.querySelector("img").alt;
            const selectedCar = carData[clickedLogoAlt];

            toggleClass(button);

            if (selectedCar) {
                await heroImage.animate({ opacity: [1, 0] }, { duration: 350, fill: "forwards" }).finished;

                heroImage.src = selectedCar.src;
                heroImage.alt = selectedCar.alt;

                heroImage.animate({ opacity: [0, 1] }, { duration: 350, fill: "forwards" });
            }
        });
    });
};
