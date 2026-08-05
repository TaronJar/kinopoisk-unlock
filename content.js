const PIRATE_DOMAIN = "kinopoisk.cam";

function injectButton() {
  if (!/\/\d+\//.test(location.href)) {
    document.getElementById("pirate-watch-btn")?.remove();
    return;
  }
  if (document.getElementById("pirate-watch-btn")) return;

  const btn = document.createElement("button");
  btn.id = "pirate-watch-btn";
  btn.textContent = "Смотреть бесплатно";

  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    marginLeft: "8px",
    backgroundColor: "#ff5c00",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    fontFamily: "YS Text, sans-serif",
    transition: "background-color 0.2s",
    lineHeight: "1",
    whiteSpace: "nowrap"
  });

  btn.onmouseover = () => { btn.style.backgroundColor = "#e05200"; };
  btn.onmouseout = () => { btn.style.backgroundColor = "#ff5c00"; };

  btn.onclick = () => {
    const url = new URL(location.href);
    url.hostname = PIRATE_DOMAIN;
    window.open(url, "_blank");
  };

  const allButtons = document.querySelectorAll("button");
  let target = null;
  for (const b of allButtons) {
    if (b.textContent.trim() === "Буду смотреть") {
      target = b;
      break;
    }
  }

  if (!target) return;

  if (target.parentElement) {
    target.parentElement.insertBefore(btn, target.nextSibling);
  } else {
    target.after(btn);
  }
}

// Перехват SPA-навигации
const origPush = history.pushState;
history.pushState = function () {
  origPush.apply(this, arguments);
  setTimeout(injectButton, 300);
};
window.addEventListener("popstate", () => setTimeout(injectButton, 300));

// Первый запуск
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectButton);
} else {
  injectButton();
}
