/* Shared learning-module registry.
   New subjects create their own modules/<id>-mastery.js file and push a
   module object with id, name, sourceFiles and chapters. Load subject files
   after this registry and before learning-engine.js. No API or AI needed. */
window.MasteryModules = window.MasteryModules || [];
