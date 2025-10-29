javascript:(() => {
  const toStringSafe = (value) => (value == null ? "" : String(value));

  const normalizeWhitespace = (value) => {
    const text = toStringSafe(value).replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, " ");
    return text.replace(/\s+/g, " ").trim();
  };

  const fixAccents = (value) =>
    toStringSafe(value)
      .replace(/d�cembre/gi, "décembre")
      .replace(/f�vrier/gi, "février")
      .replace(/ao�t/gi, "août");

  const monthLookup = {
    janvier: "01",
    fevrier: "02",
    mars: "03",
    avril: "04",
    mai: "05",
    juin: "06",
    juillet: "07",
    aout: "08",
    septembre: "09",
    octobre: "10",
    novembre: "11",
    decembre: "12",
  };

  const removeWeekday = (value) => {
    const weekdays = [
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
      "dimanche",
    ];
    const pattern = new RegExp(
      `^(?:${weekdays.join("|")})(?:[\\s\\u00a0\\u202f\\u2009\\.,])+`,
      "i"
    );
    return toStringSafe(value).replace(pattern, "");
  };

  const normalizeMonthKey = (value) =>
    toStringSafe(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");

  const getIata = (value) => {
    const matches = normalizeWhitespace(value).match(/\b[A-Z]{3}\b/g);
    return matches ? matches[matches.length - 1] : null;
  };

  const getStationCode = (value) => {
    const match = toStringSafe(value).match(/-\s*(\d{4,5})\s*$/);
    return match ? match[1] : null;
  };

  const getTime = (value) => {
    const text = toStringSafe(value);
    const regex = /(?:^|[^0-9])(\d{1,2})\s*[:h]\s*(\d{2})(?!\d)/gi;
    let match;
    let lastMatch = null;
    while ((match = regex.exec(text)) !== null) {
      lastMatch = match;
    }
    if (!lastMatch) return null;
    const hours = String(parseInt(lastMatch[1], 10)).padStart(2, "0");
    const minutes = String(parseInt(lastMatch[2], 10)).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const getDate = (value) => {
    const cleaned = normalizeWhitespace(removeWeekday(fixAccents(value)));
    const match = cleaned.match(/(\d{1,2})\s+([a-zàâçéèêëîïôûùüÿñæœ]+)\s+(\d{4})/i);
    if (!match) return null;
    const day = String(parseInt(match[1], 10)).padStart(2, "0");
    const monthKey = normalizeMonthKey(match[2]);
    const month = monthLookup[monthKey];
    if (!month) return null;
    return `${match[3]}-${month}-${day}`;
  };

  const getSectionData = (selector, keyword) => {
    const container = document.querySelector("#infos");
    if (!container) return null;

    const title = Array.from(container.querySelectorAll(selector)).find((node) =>
      normalizeWhitespace(node.textContent || "").toLowerCase().includes(keyword)
    );

    if (!title) return null;

    const findNextTxt = (node) => {
      let current = node.nextElementSibling;
      while (current) {
        if (current.classList && current.classList.contains("txt")) {
          return current;
        }
        current = current.nextElementSibling;
      }
      return null;
    };

    const stationElement = findNextTxt(title);
    const dateElement = stationElement ? findNextTxt(stationElement) : null;

    const stationLine = stationElement ? stationElement.textContent : "";
    const boldNode = stationElement ? stationElement.querySelector("b") : null;
    const stationRaw = normalizeWhitespace(boldNode ? boldNode.textContent : "");
    const stationCode = stationElement ? getStationCode(normalizeWhitespace(stationLine)) : null;
    const iata = stationRaw ? getIata(stationRaw) : null;

    const dateRaw = normalizeWhitespace(dateElement ? dateElement.textContent : "");
    const time = dateRaw ? getTime(dateRaw) : null;
    const date = dateRaw ? getDate(dateRaw) : null;

    return {
      station: {
        raw: stationRaw || null,
        stationCode: stationCode || null,
        iata,
      },
      datetime: {
        dateRaw: dateRaw || null,
        date: date || null,
        time,
      },
    };
  };

  const pickupData = getSectionData(".tit", "prise");
  const returnData = getSectionData(".tit.top1", "retour");

  const result = {
    pickupStation: pickupData
      ? pickupData.station
      : { raw: null, stationCode: null, iata: null },
    pickup: pickupData
      ? pickupData.datetime
      : { dateRaw: null, date: null, time: null },
    returnStation: returnData
      ? returnData.station
      : { raw: null, stationCode: null, iata: null },
    return: returnData
      ? returnData.datetime
      : { dateRaw: null, date: null, time: null },
  };

  const logStructuredResult = (data) => {
    if (!data || typeof data !== "object") {
      console.warn("bspAutoBookingData is empty or invalid", data);
      return;
    }

    console.group("bspAutoBookingData (structured)");
    [
      { title: "Pickup Station", value: data.pickupStation },
      { title: "Pickup Date/Time", value: data.pickup },
      { title: "Return Station", value: data.returnStation },
      { title: "Return Date/Time", value: data.return },
    ].forEach(({ title, value }) => {
      console.group(title);
      if (value && typeof value === "object") {
        console.table([value]);
      } else {
        console.log(value);
      }
      console.groupEnd();
    });
    console.groupEnd();
  };

  const hasNonNullValue = (value) => {
    if (Array.isArray(value)) {
      return value.some(hasNonNullValue);
    }
    if (value && typeof value === "object") {
      return Object.values(value).some(hasNonNullValue);
    }
    return value != null;
  };

  if (!hasNonNullValue(result)) {
    console.warn("No BSP data found", result);
    return;
  }

  try {
    localStorage.setItem("bspAutoBookingData", JSON.stringify(result));
    console.info("bspAutoBookingData updated", result);
    logStructuredResult(result);
    const openPasteBookmarkletPage = () =>
      window.open(
        "https://www.bsp-auto.com/auto_2175bsp/tarifs.asp",
        "_blank",
        "noopener"
      );
    setTimeout(openPasteBookmarkletPage, 1000);
  } catch (error) {
    console.error("Failed to store bspAutoBookingData", error, result);
  }
})();
