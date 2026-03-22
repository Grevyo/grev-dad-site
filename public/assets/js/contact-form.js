// Handles the dedicated contact form page and keeps the submit flow separate from the shared header script.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const messageBox = document.getElementById("contact-message");
  if (!form || !messageBox) return;

  function showMessage(type, text) {
    messageBox.className = `alert alert-${type}`;
    messageBox.textContent = text;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = Object.fromEntries(new FormData(form).entries());
    showMessage("info", "Sending your message...");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        showMessage("error", data?.error || "We could not send your message.");
        return;
      }
      form.reset();
      showMessage("success", data.message || "Message sent.");
    } catch (error) {
      console.error("Contact form submission failed:", error);
      showMessage("error", "The message could not be sent right now.");
    }
  });
});
