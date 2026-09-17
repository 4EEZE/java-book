// Проверка theme/stickers.js и theme/stickers.css на собранном HTML.
// Запуск: mdbook build && node theme/stickers.test.cjs
const fs = require("fs");
const path = require("path");
const BOOK = path.resolve(__dirname, "..");
const { JSDOM } = require(path.join(BOOK,
  "tools/mdbook-quiz-ru/js/node_modules/.pnpm/jsdom@22.1.0/node_modules/jsdom"));

const check = (name, cond) => {
  console.log((cond ? "  ok   " : "  FAIL ") + name);
  if (!cond) process.exitCode = 1;
};

// Настоящие размеры картинок — из заголовков PNG.
const dims = name => {
  const b = fs.readFileSync(path.join(BOOK, "src/img", name));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

const run = page => {
  const html = fs.readFileSync(path.join(BOOK, "book", page), "utf-8");
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const { window } = dom;
  window.eval("var path_to_root = '';");
  window.eval(fs.readFileSync(path.join(BOOK, "theme/stickers.js"), "utf-8"));
  window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

  // jsdom картинки не грузит, поэтому подставляем настоящие размеры и
  // будим обработчик load — дальше считает уже боевой код.
  for (const img of window.document.querySelectorAll("img.sticker, img.sticker-explain")) {
    const { w, h } = dims(img.src.split("/").pop());
    Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
    img.dispatchEvent(new window.Event("load"));
  }
  return window.document;
};

const em = v => parseFloat(v);
const area = img => em(img.style.width) * em(img.style.height);
const ratioOf = img => em(img.style.width) / em(img.style.height);

console.log("ch01-02-hello-world.html:");
let doc = run("ch01-02-hello-world.html");

const stickerIn = cls => {
  const pre = doc.querySelector("pre." + cls);
  return pre && pre.querySelector("img.sticker");
};

const dnc = stickerIn("does_not_compile");
const thr = stickerIn("throws");
check("блок does_not_compile получил стикер-детектив",
  dnc && dnc.src.endsWith("img/clawd_detective.png"));
check("блок throws получил стикер-dizzy",
  thr && thr.src.endsWith("img/clawd_dizzy.png"));
check("обычные блоки java стикеров не получили",
  doc.querySelectorAll("pre img.sticker").length === 2);

// Главное: равная площадь, а не равная высота.
check("у стикеров кода равная площадь",
  Math.abs(area(dnc) - area(thr)) < 0.01);
check("  при этом высоты РАЗНЫЕ (иначе площадь не сойдётся)",
  Math.abs(em(dnc.style.height) - em(thr.style.height)) > 0.1);
check("  пропорции картинок сохранены",
  Math.abs(ratioOf(dnc) - dims("clawd_detective.png").w / dims("clawd_detective.png").h) < 0.01 &&
  Math.abs(ratioOf(thr) - dims("clawd_dizzy.png").w / dims("clawd_dizzy.png").h) < 0.01);

const deep = doc.querySelector("blockquote.callout-deep");
check("врезка «Под капотом» распознана", !!deep);
check("  стикер идёт первым, текст после",
  deep && deep.firstElementChild.classList.contains("sticker-callout"));

console.log("ch00-00-introduction.html:");
doc = run("ch00-00-introduction.html");
check("врезка «Современный подход» распознана", !!doc.querySelector("blockquote.callout-modern"));
check("врезка «Получилось» распознана", !!doc.querySelector("blockquote.callout-praise"));

// Стикеры разных врезок должны выглядеть одинаково крупными.
const callouts = [...doc.querySelectorAll("img.sticker-callout")];
check("врезок со стикерами несколько", callouts.length >= 3);
const areas = callouts.map(area);
check("у всех стикеров врезок равная площадь",
  Math.max(...areas) - Math.min(...areas) < 0.01);
const bulb = callouts.find(i => i.src.endsWith("clawd_idea_lightbulb.png"));
check("  вертикальная лампочка не мельче прочих",
  bulb && Math.abs(area(bulb) - areas[0]) < 0.01);
check("  и она ВЫШЕ широких — так и должно быть при равной площади",
  bulb && em(bulb.style.height) > Math.max(...callouts
    .filter(i => i !== bulb).map(i => em(i.style.height))));
check("ширина стикера врезки помещается в колонку 4.3em",
  Math.max(...callouts.map(i => em(i.style.width))) <= 4.3);

// Таблица во введении — та, где картинки были сплющены.
const explain = [...doc.querySelectorAll("img.sticker-explain")];
check("в таблице введения три стикера", explain.length === 3);
const exAreas = explain.map(area);
check("  у них равная площадь", Math.max(...exAreas) - Math.min(...exAreas) < 0.01);
check("  пропорции не искажены", explain.every(i => {
  const { w, h } = dims(i.src.split("/").pop());
  return Math.abs(ratioOf(i) - w / h) < 0.01;
}));

console.log("ch01-01-installation.html:");
doc = run("ch01-01-installation.html");
check("врезка «Современный подход» распознана", !!doc.querySelector("blockquote.callout-modern"));
check("обычные цитаты (Примечание) врезками не стали",
  doc.querySelectorAll("blockquote").length > doc.querySelectorAll("blockquote.callout").length);

console.log("theme/stickers.css:");
const css = fs.readFileSync(path.join(BOOK, "theme/stickers.css"), "utf-8");
const rule = sel => {
  const i = css.indexOf(sel + " {");
  return i < 0 ? "" : css.slice(i, css.indexOf("}", i));
};
check("max-width снят — иначе mdBook сплющивает картинки",
  /max-width:\s*none/.test(rule(".sticker,\n.sticker-explain")));
check("врезка выложена сеткой, не обтеканием",
  /display:\s*grid/.test(rule(".content blockquote.callout")));
check("обтекания (float) не осталось нигде", !/float:/.test(css));
check("колонка стикера фиксированной ширины — текст не прыгает",
  /grid-template-columns:\s*4\.3em/.test(rule(".content blockquote.callout")));
check("текст врезки вынесен во вторую колонку",
  /grid-column:\s*2/.test(rule(".content blockquote.callout > :not(.sticker-callout)")));
check("код не заезжает под стикер", /padding-right/.test(rule("pre.has-sticker > code")));
// Фон блока кода рисует `code` (правило .hljs темы подсветки), а не `pre`, и
// своего мы не задаём вовсе — он наследуется от темы, как у обычного блока.
check("min-height убран — он давал полосу под коротким блоком",
  !/min-height/.test(rule("pre.has-sticker")));

// Фон помеченного блока наследуется от темы: своей заливки у него нет.
check("заливка блоков не переопределяется",
  !/--sticker-(bad|odd)-bg/.test(css));
check("полосы у блока кода тоже нет",
  !/border-inline-start/.test(rule("pre.does_not_compile > code")));
