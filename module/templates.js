/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([

    // Shared Partials
    "systems/pergashaFoundryvtt/templates/actors/parts/active-effects.html",

    // Actor Sheet Partials
    "systems/pergashaFoundryvtt/templates/actors/parts/actor-traits.html",
    "systems/pergashaFoundryvtt/templates/actors/parts/actor-inventory.html",
    "systems/pergashaFoundryvtt/templates/actors/parts/actor-features.html",
    "systems/pergashaFoundryvtt/templates/actors/parts/actor-spellbook.html",
    "systems/pergashaFoundryvtt/templates/actors/parts/actor-psionics.html",

    // Item Sheet Partials
    "systems/pergashaFoundryvtt/templates/items/parts/item-action.html",
    "systems/pergashaFoundryvtt/templates/items/parts/item-activation.html",
    "systems/pergashaFoundryvtt/templates/items/parts/item-description.html",
    "systems/pergashaFoundryvtt/templates/items/parts/item-mountable.html"
  ]);
};
