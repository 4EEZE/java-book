// Стикеры у блоков кода и у врезок.
//
// Блок кода помечается доп. классом в info-строке ограды: ```java,does_not_compile
// mdBook отдаёт такой класс как есть, рядом с language-java.
//
// Врезка — обычная цитата, начинающаяся с жирного слова-маркера. Разметка
// остаётся markdown'ом, поэтому содержимое врезки форматируется как обычно;
// класс и картинку навешиваем уже здесь, по тексту маркера.

const CODE_MARKERS = [
  {
    cls: "does_not_compile",
    img: "clawd_detective.png",
    title: "Этот код не компилируется"
  },
  {
    cls: "throws",
    img: "clawd_dizzy.png",
    title: "Этот код падает с исключением"
  },
  {
    cls: "wrong_behavior",
    img: "clawd_with_coffe.png",
    title: "Этот код работает не так, как задумано"
  }
];

const CALLOUTS = [
  { marker: "Современный подход", cls: "modern", img: "clawd_idea_lightbulb.png" },
  { marker: "Под капотом", cls: "deep", img: "clawd_nerd.png" },
  { marker: "Получилось", cls: "praise", img: "clawd_happy.png" }
];

// Путь до корня книги mdBook кладёт в глобальную переменную: на вложенных
// страницах он будет не пустым, поэтому не зашиваем "img/" напрямую.
const imgSrc = name =>
  (typeof path_to_root === "string" ? path_to_root : "") + "img/" + name;

// Видимый размер стикера — это его ПЛОЩАДЬ, а не высота и не ширина.
// Пропорции картинок расходятся в 2.5 раза (0.68 у вертикальной лампочки
// против 1.69 у широкого с кружкой), поэтому при равной высоте лампочка
// занимает вдвое меньше места и читается как мельче остальных.
// Задаём каждой одинаковую площадь: w = sqrt(S·r), h = sqrt(S/r).
const STICKER_AREA = { code: 6.5, callout: 12, explain: 14 }; // в em²

const fitByArea = (img, kind) => {
  let area = STICKER_AREA[kind];
  let apply = () => {
    let ratio = img.naturalWidth / img.naturalHeight;
    if (!ratio || !isFinite(ratio)) return;
    img.style.width = Math.sqrt(area * ratio).toFixed(3) + "em";
    img.style.height = Math.sqrt(area / ratio).toFixed(3) + "em";
  };
  // Картинка из кеша уже готова, свежая — досчитаем по событию.
  if (img.complete && img.naturalWidth) apply();
  else img.addEventListener("load", apply, { once: true });
};

const makeSticker = (marker, kind) => {
  let img = document.createElement("img");
  img.src = imgSrc(marker.img);
  img.alt = marker.title || marker.marker;
  img.title = marker.title || marker.marker;
  img.className = "sticker sticker-" + kind;
  fitByArea(img, kind);
  return img;
};

const attachCodeStickers = () => {
  for (let marker of CODE_MARKERS) {
    for (let code of document.querySelectorAll("code." + marker.cls)) {
      let pre = code.closest("pre");
      if (!pre) continue;

      pre.classList.add("has-sticker", marker.cls);
      pre.appendChild(makeSticker(marker, "code"));
    }
  }
};

const attachCalloutStickers = () => {
  for (let quote of document.querySelectorAll(".content blockquote")) {
    let lead = quote.querySelector("strong");
    if (!lead) continue;

    let text = lead.textContent.trim().replace(/[:：]$/, "");
    let callout = CALLOUTS.find(c => c.marker === text);
    if (!callout) continue;

    quote.classList.add("callout", "callout-" + callout.cls);
    quote.insertBefore(makeSticker(callout, "callout"), quote.firstChild);
  }
};

// Стикеры в пояснительной таблице введения записаны в разметке вручную,
// но выравнивать их по площади нужно так же.
const fitExplainStickers = () => {
  for (let img of document.querySelectorAll("img.sticker-explain")) {
    fitByArea(img, "explain");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  attachCodeStickers();
  attachCalloutStickers();
  fitExplainStickers();
});
