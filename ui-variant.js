(function () {
    "use strict";

    const STORAGE_KEY = "testSimulatorUiVariant";
    const root = document.documentElement;
    const modeCopy = {
        test: {
            title: "Test",
            description: "Answer under timed conditions. Your work stays here until you submit the paper.",
            chip: "EXAM PRACTICE"
        },
        study: {
            title: "Study",
            description: "Read the notes, build your answer, then submit it to check your understanding.",
            chip: "STUDY MODE"
        },
        flashcards: {
            title: "Flashcards",
            description: "Try to recall the answer before flipping each card.",
            chip: "FLASHCARDS"
        },
        book: {
            title: "Book",
            description: "Read the source material alongside your practice.",
            chip: "TEXTBOOK"
        }
    };

    function isNewUi() {
        return root.dataset.uiVariant === "new";
    }

    function syncButton(button) {
        if (!button) return;
        const newUiActive = isNewUi();
        const isHeaderButton = button.id === "ui-variant-header-toggle";
        button.textContent = isHeaderButton
            ? (newUiActive ? "Classic UI" : "New UI")
            : (newUiActive ? "Use classic UI" : "Try the new UI");
        button.setAttribute("aria-pressed", String(newUiActive));
        button.setAttribute("aria-label", isHeaderButton
            ? (newUiActive ? "Switch to classic UI" : "Switch to new UI")
            : (newUiActive ? "Use classic UI" : "Try the new UI"));
        button.title = newUiActive
            ? "Switch back to the classic interface"
            : "Switch to the redesigned study workspace";
    }

    function syncButtons() {
        document.querySelectorAll("#ui-variant-toggle, #ui-variant-header-toggle")
            .forEach(syncButton);
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

    function setUiVariant(useNewUi) {
        const variant = useNewUi ? "new" : "classic";
        root.dataset.uiVariant = variant;
        try {
            localStorage.setItem(STORAGE_KEY, variant);
        } catch (error) {
            // Keep the selected layout for this page when browser storage is unavailable.
        }
        syncButtons();
    }

    function init() {
        const buttons = Array.from(document.querySelectorAll(
            "#ui-variant-toggle, #ui-variant-header-toggle"
        ));
        if (!buttons.length) return;

        try {
            root.dataset.uiVariant = localStorage.getItem(STORAGE_KEY) === "new" ? "new" : "classic";
        } catch (error) {
            root.dataset.uiVariant = "classic";
        }
        syncButtons();

        const selectedMode = document.querySelector(".mode-tab-button.active");
        updateWorkspaceHeading(selectedMode ? selectedMode.dataset.mode : "test");

        buttons.forEach(function (button) {
            button.addEventListener("click", function () {
                setUiVariant(!isNewUi());
            });
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
