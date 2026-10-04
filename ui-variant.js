(function () {
    "use strict";

    const STORAGE_KEY = "testSimulatorUiVariant";
    const root = document.documentElement;

    function isNewUi() {
        return root.dataset.uiVariant === "new";
    }

    function syncButton(button) {
        const newUiActive = isNewUi();
        button.textContent = newUiActive ? "Use classic UI" : "Try the new UI";
        button.setAttribute("aria-pressed", String(newUiActive));
        button.title = newUiActive ? "Switch back to the classic interface" : "Switch to the refreshed interface";
    }

    function setUiVariant(useNewUi, button) {
        const variant = useNewUi ? "new" : "classic";
        root.dataset.uiVariant = variant;
        try {
            localStorage.setItem(STORAGE_KEY, variant);
        } catch (error) {
            // Keep this choice for the current page even when browser storage is unavailable.
        }
        syncButton(button);
    }

    function init() {
        const button = document.getElementById("ui-variant-toggle");
        if (!button) return;

        try {
            root.dataset.uiVariant = localStorage.getItem(STORAGE_KEY) === "new" ? "new" : "classic";
        } catch (error) {
            root.dataset.uiVariant = "classic";
        }
        syncButton(button);
        button.addEventListener("click", function () {
            setUiVariant(!isNewUi(), button);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
