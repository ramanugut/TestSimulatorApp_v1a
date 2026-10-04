(function () {
    "use strict";

    const STORAGE_KEY = "testSimulatorUiVariant";
    const root = document.documentElement;
    const modeCopy = {
        test: {
            title: "Practise with purpose",
            description: "Work through your paper in exam conditions. Use the controls when you are ready to start or submit.",
            chip: "TEST MODE"
        },
        study: {
            title: "Understand each question",
            description: "Read the notes, build your answer, then submit it to check your understanding.",
            chip: "STUDY MODE"
        },
        flashcards: {
            title: "Remember more, one card at a time",
            description: "Try to recall the answer before flipping each card.",
            chip: "FLASHCARDS"
        },
        book: {
            title: "Learn from your textbook",
            description: "Read the source material alongside your practice.",
            chip: "TEXTBOOK"
        }
    };

    function isNewUi() {
        return root.dataset.uiVariant === "new";
    }

    function syncButton(button) {
        const newUiActive = isNewUi();
        button.textContent = newUiActive ? "Use classic UI" : "Try the new UI";
        button.setAttribute("aria-pressed", String(newUiActive));
        button.title = newUiActive
            ? "Switch back to the classic interface"
            : "Switch to the redesigned study workspace";
    }

    function updateWorkspaceHeading(mode) {
        const copy = modeCopy[mode] || modeCopy.test;
        const title = document.getElementById("workspace-mode-title");
        const description = document.getElementById("workspace-mode-description");
        const chip = document.getElementById("workspace-mode-chip");
        if (title) title.textContent = copy.title;
        if (description) description.textContent = copy.description;
        if (chip) chip.textContent = copy.chip;
    }

    function setUiVariant(useNewUi, button) {
        const variant = useNewUi ? "new" : "classic";
        root.dataset.uiVariant = variant;
        try {
            localStorage.setItem(STORAGE_KEY, variant);
        } catch (error) {
            // Keep the selected layout for this page when browser storage is unavailable.
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

        const selectedMode = document.querySelector(".mode-tab-button.active");
        updateWorkspaceHeading(selectedMode ? selectedMode.dataset.mode : "test");

        button.addEventListener("click", function () {
            setUiVariant(!isNewUi(), button);
        });

        document.addEventListener("click", function (event) {
            const modeButton = event.target.closest(".mode-tab-button");
            if (modeButton) updateWorkspaceHeading(modeButton.dataset.mode);

            if (event.target.closest("[data-open-paper-picker]")) {
                const pickerTrigger = document.getElementById("open-paper-picker");
                if (pickerTrigger) pickerTrigger.click();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
