const STORAGE_KEY = "florina_cart";
const FAVORITE_KEY = "florina_favorites";

// Вставь сюда ссылку Web App из Google Apps Script.
// Ссылка должна заканчиваться на /exec
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJkdxw4CF1FHnRSaedFSI_jAje-Gvggal9avG-KEc29i22k8NUlBgrCm3m7WYatpQB/exec";

const getCart = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
const setCart = (cart) => localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));

const getFavorites = () => JSON.parse(localStorage.getItem(FAVORITE_KEY) || "[]");
const setFavorites = (favorites) => localStorage.setItem(FAVORITE_KEY, JSON.stringify(favorites));

function formatPrice(value) {
  return Number(value).toLocaleString("ru-RU") + " ₽";
}

function showToast(text) {
  let toast = document.querySelector(".toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}


async function sendToGoogleSheet(payload) {
  if (!GOOGLE_SCRIPT_URL) {
    console.warn("GOOGLE_SCRIPT_URL не указан. Данные не отправлены:", payload);
    return;
  }

  await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
}

function getInputValue(formElement, name, fallbackSelector = "") {
  const byName = formElement.querySelector(`[name="${name}"]`);
  if (byName) return byName.value.trim();

  const fallback = fallbackSelector ? formElement.querySelector(fallbackSelector) : null;
  return fallback ? fallback.value.trim() : "";
}

function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateCounters() {
  const cart = getCart();
  const favorites = getFavorites();
  const cartCount = document.querySelectorAll("#cartCount");
  const favoriteCount = document.querySelectorAll("#favoriteCount");

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  cartCount.forEach((item) => item.textContent = totalQty);
  favoriteCount.forEach((item) => item.textContent = favorites.length);
}

function initBurger() {
  const burger = document.querySelector("#burger");
  const nav = document.querySelector("#nav");

  if (!burger || !nav) return;

  burger.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

function initProductCards() {
  const cards = document.querySelectorAll(".product-card");
  const favorites = getFavorites();

  cards.forEach((card) => {
    const id = card.dataset.id;
    const likeButton = card.querySelector("[data-like]");
    const addButton = card.querySelector("[data-add]");

    if (favorites.includes(id) && likeButton) {
      likeButton.classList.add("active");
      likeButton.textContent = "♥";
    }

    if (likeButton) {
      likeButton.addEventListener("click", () => {
        let updated = getFavorites();

        if (updated.includes(id)) {
          updated = updated.filter((item) => item !== id);
          likeButton.classList.remove("active");
          likeButton.textContent = "♡";
        } else {
          updated.push(id);
          likeButton.classList.add("active");
          likeButton.textContent = "♥";
        }

        setFavorites(updated);
        updateCounters();
      });
    }

    if (addButton) {
      addButton.addEventListener("click", () => {
        const cart = getCart();
        const product = {
          id,
          title: card.dataset.title,
          price: Number(card.dataset.price),
          image: card.querySelector("img").getAttribute("src"),
          qty: 1
        };

        const existing = cart.find((item) => item.id === id);

        if (existing) {
          existing.qty += 1;
        } else {
          cart.push(product);
        }

        setCart(cart);
        updateCounters();
        showToast("Товар добавлен в корзину");
      });
    }
  });
}

function initFaq() {
  const items = document.querySelectorAll(".faq__item");

  items.forEach((item) => {
    const button = item.querySelector(".faq__question");
    const icon = button.querySelector("span");

    button.addEventListener("click", () => {
      const isActive = item.classList.contains("active");

      items.forEach((faqItem) => {
        faqItem.classList.remove("active");
        faqItem.querySelector(".faq__question span").textContent = "+";
      });

      if (!isActive) {
        item.classList.add("active");
        icon.textContent = "×";
      }
    });
  });
}

function initForms() {
  const forms = [
    { form: "#callbackForm", message: "#formMessage", text: "Заявка отправлена. Мы скоро свяжемся с вами.", type: "question" },
    { form: "#contactForm", message: "#contactMessage", text: "Сообщение отправлено. Спасибо за обращение.", type: "contact" },
    { form: "#orderForm", message: "#orderMessage", text: "Заказ оформлен. Менеджер свяжется для подтверждения.", type: "order" }
  ];

  forms.forEach(({ form, message, text, type }) => {
    const formElement = document.querySelector(form);
    const messageElement = document.querySelector(message);

    if (!formElement || !messageElement) return;

    formElement.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submitButton = formElement.querySelector("button[type='submit']");
      const oldButtonText = submitButton ? submitButton.textContent : "";

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Отправка...";
      }

      try {
        if (type === "order") {
          const cart = getCart();

          if (cart.length === 0) {
            messageElement.textContent = "Корзина пустая. Добавьте товары из каталога.";
            return;
          }

          await sendToGoogleSheet({
            type: "order",
            createdAt: new Date().toLocaleString("ru-RU"),
            name: getInputValue(formElement, "name", "input:nth-of-type(1)"),
            phone: getInputValue(formElement, "phone", "input:nth-of-type(2)"),
            address: getInputValue(formElement, "address", "input:nth-of-type(3)"),
            comment: getInputValue(formElement, "comment", "textarea"),
            items: cart,
            total: getCartTotal(cart)
          });

          messageElement.textContent = text;
          formElement.reset();
          setCart([]);
          renderCart();
          updateCounters();
          return;
        }

        await sendToGoogleSheet({
          type: type,
          createdAt: new Date().toLocaleString("ru-RU"),
          name: getInputValue(formElement, "name", "input:nth-of-type(1)"),
          phone: getInputValue(formElement, "phone", "input:nth-of-type(2)"),
          comment: getInputValue(formElement, "message", "textarea"),
          page: window.location.href
        });

        messageElement.textContent = text;
        formElement.reset();
      } catch (error) {
        console.error(error);
        messageElement.textContent = "Не удалось отправить данные. Проверьте интернет и ссылку Apps Script.";
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = oldButtonText;
        }
      }
    });
  });
}

function initCatalogFilters() {
  const categoryFilter = document.querySelector("#categoryFilter");
  const priceFilter = document.querySelector("#priceFilter");
  const priceValue = document.querySelector("#priceValue");
  const resetButton = document.querySelector("#resetFilters");
  const cards = document.querySelectorAll("#catalogGrid .product-card");

  if (!categoryFilter || !priceFilter || !priceValue || !cards.length) return;

  function applyFilters() {
    const selectedCategory = categoryFilter.value;
    const maxPrice = Number(priceFilter.value);

    priceValue.textContent = "до " + formatPrice(maxPrice);

    cards.forEach((card) => {
      const cardCategory = card.dataset.category;
      const cardPrice = Number(card.dataset.price);

      const categoryMatch = selectedCategory === "all" || selectedCategory === cardCategory;
      const priceMatch = cardPrice <= maxPrice;

      card.classList.toggle("hidden", !(categoryMatch && priceMatch));
    });
  }

  categoryFilter.addEventListener("change", applyFilters);
  priceFilter.addEventListener("input", applyFilters);

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      categoryFilter.value = "all";
      priceFilter.value = 8000;
      applyFilters();
    });
  }

  applyFilters();
}

function renderCart() {
  const cartList = document.querySelector("#cartList");
  const cartTotal = document.querySelector("#cartTotal");

  if (!cartList || !cartTotal) return;

  const cart = getCart();

  if (cart.length === 0) {
    cartList.innerHTML = '<p class="empty">Корзина пустая. Перейдите в каталог и добавьте товары.</p>';
    cartTotal.textContent = formatPrice(0);
    return;
  }

  cartList.innerHTML = cart.map((item) => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image}" alt="${item.title}">
      <div>
        <h3>${item.title}</h3>
        <p>${formatPrice(item.price)}</p>
      </div>
      <div class="cart-item__controls">
        <button class="qty-btn" data-minus>-</button>
        <strong>${item.qty}</strong>
        <button class="qty-btn" data-plus>+</button>
        <button class="remove-btn" data-remove>Удалить</button>
      </div>
    </div>
  `).join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  cartTotal.textContent = formatPrice(total);

  cartList.querySelectorAll(".cart-item").forEach((itemElement) => {
    const id = itemElement.dataset.id;

    itemElement.querySelector("[data-minus]").addEventListener("click", () => changeQty(id, -1));
    itemElement.querySelector("[data-plus]").addEventListener("click", () => changeQty(id, 1));
    itemElement.querySelector("[data-remove]").addEventListener("click", () => removeFromCart(id));
  });
}

function changeQty(id, delta) {
  const cart = getCart();
  const product = cart.find((item) => item.id === id);

  if (!product) return;

  product.qty += delta;

  const updated = cart.filter((item) => item.qty > 0);

  setCart(updated);
  renderCart();
  updateCounters();
}

function removeFromCart(id) {
  const updated = getCart().filter((item) => item.id !== id);

  setCart(updated);
  renderCart();
  updateCounters();
}

function initSimpleSlider() {
  const sliders = document.querySelectorAll("[data-slider]");

  sliders.forEach((slider) => {
    const track = slider.querySelector("[data-track]");
    const prev = slider.querySelector("[data-prev]");
    const next = slider.querySelector("[data-next]");

    if (!track || !prev || !next) return;

    prev.addEventListener("click", () => {
      track.scrollBy({ left: -520, behavior: "smooth" });
    });

    next.addEventListener("click", () => {
      track.scrollBy({ left: 520, behavior: "smooth" });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initBurger();
  initProductCards();
  initFaq();
  initForms();
  initCatalogFilters();
  initSimpleSlider();
  renderCart();
  updateCounters();
});

