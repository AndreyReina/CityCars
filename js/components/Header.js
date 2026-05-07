const header = document.querySelector("[data-header]");

export const initOpenMenu = () => {
    if (!header) return;

    const menuButton = header.querySelector("[data-menu-trigger]");

    menuButton?.addEventListener("click", () => {
        header.classList.toggle("header--menu-opened");
    });
};

export const initHeaderScroll = () => {
    if (!header) return;

    const toggleScrollClass = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldBeScrolled = scrollTop > 0;
        header.classList.toggle("header--scroll", shouldBeScrolled);
    };

    window.addEventListener(
        "scroll",
        () => {
            toggleScrollClass();
        },
        { passive: true },
    );
    toggleScrollClass();
};
