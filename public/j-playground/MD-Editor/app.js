const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");
const clearBtn = document.getElementById("clearBtn");
const toolbarButtons = document.querySelectorAll("[data-wrap], [data-prefix]");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseInlineMarkdown(text) {
  let result = escapeHtml(text);

  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  return result;
}

function markdownToHtml(markdown) {
  const lines = markdown.split("\n");
  let html = "";
  let inList = false;
  let inCodeBlock = false;
  let codeBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
        inCodeBlock = false;
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (/^###\s+/.test(line)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h3>${parseInlineMarkdown(line.replace(/^###\s+/, ""))}</h3>`;
      continue;
    }

    if (/^##\s+/.test(line)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h2>${parseInlineMarkdown(line.replace(/^##\s+/, ""))}</h2>`;
      continue;
    }

    if (/^#\s+/.test(line)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h1>${parseInlineMarkdown(line.replace(/^#\s+/, ""))}</h1>`;
      continue;
    }

    if (/^>\s+/.test(line)) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<blockquote>${parseInlineMarkdown(line.replace(/^>\s+/, ""))}</blockquote>`;
      continue;
    }

    if (/^-\s+/.test(line)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${parseInlineMarkdown(line.replace(/^-\s+/, ""))}</li>`;
      continue;
    }

    if (line.trim() === "") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${parseInlineMarkdown(line)}</p>`;
  }

  if (inList) {
    html += "</ul>";
  }

  if (inCodeBlock) {
    html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
  }

  return html;
}

function updatePreview() {
  preview.innerHTML = markdownToHtml(editor.value);
}

function wrapSelection(wrapper) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const selectedText = value.slice(start, end);
  const replacement = wrapper + selectedText + wrapper;

  editor.value = value.slice(0, start) + replacement + value.slice(end);
  editor.focus();
  editor.selectionStart = start + wrapper.length;
  editor.selectionEnd = end + wrapper.length;
  updatePreview();
}

function prefixLine(prefix) {
  const start = editor.selectionStart;
  const value = editor.value;

  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  editor.value = value.slice(0, lineStart) + prefix + value.slice(lineStart);

  editor.focus();
  editor.selectionStart = start + prefix.length;
  editor.selectionEnd = start + prefix.length;
  updatePreview();
}

toolbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const wrap = button.dataset.wrap;
    const prefix = button.dataset.prefix;

    if (wrap) {
      wrapSelection(wrap);
    } else if (prefix) {
      prefixLine(prefix);
    }
  });
});

saveBtn.addEventListener("click", () => {
  localStorage.setItem("pure-markdown-editor-content", editor.value);
  updatePreview();
  alert("Markdown saved locally.");
});

loadBtn.addEventListener("click", () => {
  const saved = localStorage.getItem("pure-markdown-editor-content");
  if (saved !== null) {
    editor.value = saved;
    updatePreview();
    alert("Markdown loaded.");
  } else {
    alert("No saved markdown found.");
  }
});

clearBtn.addEventListener("click", () => {
  editor.value = "";
  updatePreview();
});

editor.addEventListener("input", updatePreview);

updatePreview();
