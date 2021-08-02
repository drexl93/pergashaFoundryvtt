import ActorSheet5e from "./base.js";
import Actor5e from "../entity.js";

/**
 * An Actor sheet for player character type actors.
 * Extends the base ActorSheet5e class.
 * @type {ActorSheet5e}
 */
export default class ActorSheet5eCharacter extends ActorSheet5e {

  /**
   * Define default rendering options for the NPC sheet
   * @return {Object}
   */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pergashaFoundryvtt", "sheet", "actor", "character"],
      width: 720,
      height: 680
    });
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const sheetData = super.getData();

    // Temporary HP
    let hp = sheetData.data.attributes.hp;
    if (hp.temp === 0) delete hp.temp;
    if (hp.tempmax === 0) delete hp.tempmax;

    // Resources
    sheetData["resources"] = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
      const res = sheetData.data.resources[r] || {};
      res.name = r;
      res.placeholder = game.i18n.localize("PERGASHA.Resource" + r.titleCase());
      if (res && res.value === 0) delete res.value;
      if (res && res.max === 0) delete res.max;
      return arr.concat([res]);
    }, []);

    // Experience Tracking
    sheetData["disableExperience"] = game.settings.get("pergashaFoundryvtt", "disableExperienceTracking");
    sheetData["classLabels"] = this.actor.itemTypes.class.map(c => c.name).join(", ");
    sheetData["multiclassLabels"] = this.actor.itemTypes.class.map(c => {
      return [c.data.data.subclass, c.name, c.data.data.levels].filterJoin(' ')
    }).join(', ');

    // Return data for rendering
    return sheetData;
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {

    // Categorize items as inventory, spellbook, features, and classes
    const inventory = {
      weapon: { label: "PERGASHA.ItemTypeWeaponPl", items: [], dataset: { type: "weapon" } },
      equipment: { label: "PERGASHA.ItemTypeEquipmentPl", items: [], dataset: { type: "equipment" } },
      consumable: { label: "PERGASHA.ItemTypeConsumablePl", items: [], dataset: { type: "consumable" } },
      tool: { label: "PERGASHA.ItemTypeToolPl", items: [], dataset: { type: "tool" } },
      backpack: { label: "PERGASHA.ItemTypeContainerPl", items: [], dataset: { type: "backpack" } },
      loot: { label: "PERGASHA.ItemTypeLootPl", items: [], dataset: { type: "loot" } }
    };

    // Partition items by category
    let [items, spells, feats, classes, psionicPowers] = data.items.reduce((arr, item) => {

      item.img = item.img || CONST.DEFAULT_TOKEN;
      item.isStack = Number.isNumeric(item.data.quantity) && (item.data.quantity !== 1);
      item.attunement = {
        [CONFIG.PERGASHA.attunementTypes.REQUIRED]: {
          icon: "fa-sun",
          cls: "not-attuned",
          title: "PERGASHA.AttunementRequired"
        },
        [CONFIG.PERGASHA.attunementTypes.ATTUNED]: {
          icon: "fa-sun",
          cls: "attuned",
          title: "PERGASHA.AttunementAttuned"
        }
      }[item.data.attunement];

      // Item usage
      item.hasUses = item.data.uses && (item.data.uses.max > 0);
      item.isOnCooldown = item.data.recharge && !!item.data.recharge.value && (item.data.recharge.charged === false);
      item.isDepleted = item.isOnCooldown && (item.data.uses.per && (item.data.uses.value > 0));
      item.hasTarget = !!item.data.target && !(["none", ""].includes(item.data.target.type));

      // Item toggle state
      this._prepareItemToggleState(item);

      // Primary Class
      if (item.type === "class") item.isOriginalClass = (item._id === this.actor.data.data.details.originalClass);

      // Classify items into types
      if (item.type === "spell") arr[1].push(item);
      else if (item.type === "feat") arr[2].push(item);
      else if (item.type === "class") arr[3].push(item);
      else if (item.type === "psionicPower") arr[4].push(item);
      else if (Object.keys(inventory).includes(item.type)) arr[0].push(item);
      return arr;
    }, [[], [], [], [], []]);

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory);
    spells = this._filterItems(spells, this._filters.spellbook);
    psionicPowers = this._filterItems(psionicPowers, this._filters.psionics);
    feats = this._filterItems(feats, this._filters.features);

    // Organize items
    for (let i of items) {
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = (i.data.quantity * i.data.weight).toNearest(0.1);
      inventory[i.type].items.push(i);
    }

    // Organize Spellbook and count the number of prepared spells (excluding always, at will, etc...)
    const spellbook = this._prepareSpellbook(data, spells);
    const psionics = this._preparePsionics(data, psionicPowers);
    const nPrepared = spells.filter(s => {
      return (s.data.level > 0) && (s.data.preparation.mode === "prepared") && s.data.preparation.prepared;
    }).length;

    // Organize Features
    const features = {
      classes: { label: "PERGASHA.ItemTypeClassPl", items: [], hasActions: false, dataset: { type: "class" }, isClass: true },
      active: { label: "PERGASHA.FeatureActive", items: [], hasActions: true, dataset: { type: "feat", "activation.type": "action" } },
      passive: { label: "PERGASHA.FeaturePassive", items: [], hasActions: false, dataset: { type: "feat" } }
    };
    for (let f of feats) {
      if (f.data.activation.type) features.active.items.push(f);
      else features.passive.items.push(f);
    }
    classes.sort((a, b) => b.data.levels - a.data.levels);
    features.classes.items = classes;

    // Assign and return
    data.inventory = Object.values(inventory);
    data.spellbook = spellbook;
    data.preparedSpells = nPrepared;
    data.psionics = psionics;
    data.features = Object.values(features);
  }

  /* -------------------------------------------- */

  /**
   * A helper method to establish the displayed preparation state for an item
   * @param {Item} item
   * @private
   */
  _prepareItemToggleState(item) {
    if (item.type === "spell") {
      const isAlways = getProperty(item.data, "preparation.mode") === "always";
      const isPrepared = getProperty(item.data, "preparation.prepared");
      item.toggleClass = isPrepared ? "active" : "";
      if (isAlways) item.toggleClass = "fixed";
      if (isAlways) item.toggleTitle = CONFIG.PERGASHA.spellPreparationModes.always;
      else if (isPrepared) item.toggleTitle = CONFIG.PERGASHA.spellPreparationModes.prepared;
      else item.toggleTitle = game.i18n.localize("PERGASHA.SpellUnprepared");
    }
    else {
      const isActive = getProperty(item.data, "equipped");
      const isInQuickdraw = getProperty(item.data, "quickdraw");
      item.toggleQuickdraw = isInQuickdraw ? "active" : "";
      item.toggleClass = isActive ? "active" : "";
      item.toggleTitle = game.i18n.localize(isActive ? "PERGASHA.Equipped" : "PERGASHA.Unequipped");
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {jQuery}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Item State Toggling
    html.find('.item-toggle').click(this._onToggleItem.bind(this));

    // Short and Long Rest
    html.find('.short-rest').click(this._onShortRest.bind(this));
    html.find('.long-rest').click(this._onLongRest.bind(this));

    // Rollable sheet actions
    html.find(".rollable[data-action]").click(this._onSheetAction.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse click events for character sheet actions
   * @param {MouseEvent} event    The originating click event
   * @private
   */
  _onSheetAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    switch (button.dataset.action) {
      case "convertCurrency":
        return Dialog.confirm({
          title: `${game.i18n.localize("PERGASHA.CurrencyConvert")}`,
          content: `<p>${game.i18n.localize("PERGASHA.CurrencyConvertHint")}</p>`,
          yes: () => this.actor.convertCurrency()
        });
      case "rollDeathSave":
        return this.actor.rollDeathSave({ event: event });
      case "rollInitiative":
        return this.actor.rollInitiative({ createCombatants: true });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the state of an Owned Item within the Actor
   * @param {Event} event   The triggering click event
   * @private
   */
  _onToggleItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    let attr = null;
    if (event.currentTarget.attributes[0].value.includes("item-quickdraw")) attr = "data.quickdraw";
    else attr = item.data.type === "spell" ? "data.preparation.prepared" : "data.equipped";
    return item.update({ [attr]: !getProperty(item.data, attr) });
  }

  /* -------------------------------------------- */

  /**
   * Take a short rest, calling the relevant function on the Actor instance
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onShortRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.shortRest();
  }

  /* -------------------------------------------- */

  /**
   * Take a long rest, calling the relevant function on the Actor instance
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onLongRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.longRest();
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItemCreate(itemData) {

    // Increment the number of class levels a character instead of creating a new item
    if (itemData.type === "class") {
      const cls = this.actor.itemTypes.class.find(c => c.name === itemData.name);
      let priorLevel = cls?.data.data.levels ?? 0;
      if (!!cls) {
        const next = Math.min(priorLevel + 1, 20 + priorLevel - this.actor.data.data.details.level);
        if (next > priorLevel) {
          itemData.levels = next;
          return cls.update({ "data.levels": next });
        }
      }
    }

    // Default drop handling if levels were not added
    return super._onDropItemCreate(itemData);
  }
}
