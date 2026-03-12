async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "请求失败");
  }

  return payload;
}

const form = document.getElementById("login-form");
const message = document.getElementById("login-message");

requestJson("/admin/api/session")
  .then(() => {
    window.location.replace("/admin");
  })
  .catch(() => {});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    await requestJson("/admin/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    window.location.replace("/admin");
  } catch (error) {
    message.textContent = error.message;
  }
});
