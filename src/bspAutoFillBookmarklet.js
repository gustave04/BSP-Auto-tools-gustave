javascript:(async () => {
  const STORAGE_KEY = "bspAutoBookingData";
  const AUTOCOMPLETE_SELECTOR = ".ui-autocomplete.ui-front";
  const AUTOCOMPLETE_ITEM_SELECTOR =
    "li.ui-menu-item > .ui-menu-item-wrapper, .ui-menu-item-wrapper";

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFor = async (predicate, { timeout = 4000, interval = 100 } = {}) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await predicate();
      if (result) return result;
      await wait(interval);
    }
    return null;
  };

  const toStringSafe = (value) => (value == null ? "" : String(value));

  const normalizeText = (value) => toStringSafe(value).trim();

  const normalizeForMatch = (value) =>
    toStringSafe(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const isVisible = (element) => {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const typeText = async (element, text) => {
    const value = toStringSafe(text);
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const collectOptions = (itemElements) =>
    itemElements.map((el) => ({
      el,
      label: normalizeText(el.getAttribute("data-label") || el.textContent),
    }));

  const showToast = (message, { error = false } = {}) => {
    const existing = document.querySelector("#bsp-auto-toast");
    if (existing) {
      existing.remove();
    }
    const toast = document.createElement("div");
    toast.id = "bsp-auto-toast";
    toast.style.position = "fixed";
    toast.style.top = "16px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "10px 16px";
    toast.style.background = error ? "#e67e22" : "#2ecc71";
    toast.style.color = "#fff";
    toast.style.font = "14px/1.4 sans-serif";
    toast.style.borderRadius = "4px";
    toast.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    toast.style.zIndex = "2147483647";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "12px";

    const label = document.createElement("span");
    label.textContent = message;
    toast.appendChild(label);

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity 200ms ease";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 220);
    }, 4000);
  };

  const parseStorage = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      const normalizeStation = (station) => {
        if (!station) return null;
        const rawValue = normalizeText(station.raw);
        if (!rawValue) return null;

        const normalized = { raw: rawValue };

        const stationCode = normalizeText(station.stationCode);
        if (stationCode) {
          normalized.stationCode = stationCode;
        }

        const iata = normalizeText(station.iata);
        if (iata) {
          normalized.iata = iata;
        }

        return normalized;
      };

      return {
        ...parsed,
        pickupStation: normalizeStation(parsed.pickupStation),
        returnStation: normalizeStation(parsed.returnStation),
      };
    } catch (error) {
      return null;
    }
  };

  const fillAutocomplete = async ({ inputSelector, station }) => {
    const input = await waitFor(() => document.querySelector(inputSelector));
    if (!input) {
      throw new Error("Feld nicht gefunden");
    }

    const rawValue = toStringSafe(station?.raw);
    if (!normalizeText(rawValue)) {
      return false;
    }

    const normalizedRaw = normalizeForMatch(rawValue);
    const rawContainsAeroport = /aeroport/i.test(rawValue);
    const fallbackIata = normalizeText(station?.iata);
    const fallbackValue = rawContainsAeroport && fallbackIata
      ? `Aeroport ${fallbackIata}`
      : null;

    input.focus();
    await wait(30);

    const findSuggestions = () => {
      const lists = Array.from(document.querySelectorAll(AUTOCOMPLETE_SELECTOR));
      for (const list of lists) {
        if (!isVisible(list)) continue;
        const found = Array.from(list.querySelectorAll(AUTOCOMPLETE_ITEM_SELECTOR));
        if (found.length) {
          return found;
        }
      }
      return null;
    };

    const typeAndCollect = async (text) => {
      if (!normalizeText(text)) return null;
      input.focus();
      await typeText(input, text);
      await wait(150);
      const collected = await waitFor(findSuggestions, { timeout: 1000, interval: 80 });
      return collected;
    };

    let items = await typeAndCollect(rawValue);

    if (!items && fallbackValue) {
      items = await typeAndCollect(fallbackValue);
    }

    if (!items) {
      return false;
    }
    const options = collectOptions(items).map((option) => ({
      ...option,
      normalized: normalizeForMatch(option.label),
    }));
    if (!options.length) {
      return false;
    }

    const isExactMatch = (optionNormalized) =>
      optionNormalized === normalizedRaw || optionNormalized.includes(normalizedRaw);
    let candidate = options.find((option) => isExactMatch(option.normalized));
    if (!candidate) {
      candidate = options[0];
    }
    if (!candidate) {
      return false;
    }

    const target = candidate.el;
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "nearest" });
    }

    ["mouseover", "mousedown", "mouseup", "click"].forEach((type) => {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    });

    await wait(80);
    return true;
  };

  const formatIsoDateToFr = (isoDate) => {
    const targetDate = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(targetDate.getTime())) {
      throw new Error("Ungültiges Datum");
    }
    const day = String(targetDate.getDate()).padStart(2, "0");
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const year = targetDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const setDate = async (selector, isoDate) => {
    if (!isoDate) return;
    const input = await waitFor(() => document.querySelector(selector));
    if (!input) throw new Error("Datumfeld fehlt");
    const formatted = formatIsoDateToFr(isoDate);
    input.value = formatted;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const timeToMinutes = (value) => {
    const match = toStringSafe(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };

  const setTime = async (selector, timeValue) => {
    if (!timeValue) return;
    const select = await waitFor(() => document.querySelector(selector));
    if (!select) throw new Error("Zeitfeld fehlt");
    const targetMinutes = timeToMinutes(timeValue);
    const options = Array.from(select.options).filter((option) => option.value);
    if (!options.length) throw new Error("Keine Zeitoptionen");

    const sorted = options
      .map((option) => ({ option, minutes: timeToMinutes(option.value) }))
      .filter(({ minutes }) => minutes != null)
      .sort((a, b) => a.minutes - b.minutes);

    let chosen = sorted.find(({ minutes }) => minutes >= targetMinutes);
    if (!chosen) {
      chosen = sorted[sorted.length - 1];
    }
    if (!chosen) throw new Error("Zeit nicht verfügbar");

    select.value = chosen.option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const data = parseStorage();
  if (!data) {
    showToast("Keine Daten.", { error: true });
    return;
  }

  try {
    const pickupSuccess = await fillAutocomplete({
      inputSelector: "#recherche-start",
      station: data.pickupStation,
    });
    if (!pickupSuccess) {
      showToast("Startstation konnte nicht ausgewählt werden.", { error: true });
      return;
    }

    const returnSuccess = await fillAutocomplete({
      inputSelector: "#recherche-end",
      station: data.returnStation,
    });
    if (!returnSuccess) {
      showToast("Rückgabestation konnte nicht ausgewählt werden.", { error: true });
      return;
    }

    await setDate("#from", data.pickup?.date);
    await setDate("#to", data.return?.date);

    await setTime('select[name="heure_a"]', data.pickup?.time);
    await setTime('select[name="heure_d"]', data.return?.time);

    showToast("Formular ausgefüllt.");
  } catch (error) {
    showToast("Fehler beim Ausfüllen des Formulars.", { error: true });
  }
})();
