(function () {
  "use strict";

  const editor = document.getElementById("editor");
  const charCountEl = document.getElementById("charCount");
  const clearBtn = document.getElementById("clearBtn");

  // Update the character count based on visible text length.
  function updateCharCount() {
    const text = editor.innerText || "";
    // Trim trailing newline that contenteditable can produce.
    const length = text.replace(/\n$/, "").length;
    charCountEl.textContent = length + (length === 1 ? " char" : " chars");
  }

  // Insert plain text at the current selection inside the editor.
  function insertPlainText(text) {
    if (!text) return;

    editor.focus();

    // Prefer execCommand when available so that the action stays in the
    // browser's native undo stack.
    if (document.queryCommandSupported && document.queryCommandSupported("insertText")) {
      document.execCommand("insertText", false, text);
      return;
    }

    // Fallback for browsers without execCommand("insertText").
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      editor.appendChild(document.createTextNode(text));
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // Keyboard shortcuts.
  editor.addEventListener("keydown", function (e) {
    const mod = e.ctrlKey || e.metaKey; // support both Windows/Linux and macOS.
    if (!mod) return;

    const key = e.key.toLowerCase();

    // Ctrl+Shift+V → paste as plain text.
    if (e.shiftKey && key === "v") {
      e.preventDefault();
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard
          .readText()
          .then(function (text) {
            insertPlainText(text);
          })
          .catch(function () {
            // Clipboard read can be blocked; nothing else we can do here.
          });
      }
      return;
    }

    // Bold / Italic / Underline are handled natively by the browser, but we
    // call execCommand explicitly so the behaviour is consistent everywhere.
    if (!e.shiftKey && (key === "b" || key === "i" || key === "u")) {
      e.preventDefault();
      const cmd = key === "b" ? "bold" : key === "i" ? "italic" : "underline";
      document.execCommand(cmd, false, null);
      updateCharCount();
      return;
    }

    // Ctrl+C / V / X / A and Ctrl+Z / Y are left to the browser defaults.
  });

  // When pasting normally (Ctrl+V), keep the existing rich text behaviour but
  // strip away anything other than basic text formatting tags.
  editor.addEventListener("paste", function (e) {
    const cd = e.clipboardData;
    if (!cd) return;

    const html = cd.getData("text/html");
    const text = cd.getData("text/plain");

    if (html) {
      e.preventDefault();
      const cleaned = sanitizeHtml(html);
      if (document.queryCommandSupported && document.queryCommandSupported("insertHTML")) {
        document.execCommand("insertHTML", false, cleaned);
      } else {
        insertPlainText(text || "");
      }
    }
    // If only plain text is available we let the browser handle it.
  });

  // Strip pasted HTML down to a minimal, safe set of inline tags.
  function sanitizeHtml(html) {
    const allowed = new Set(["B", "STRONG", "I", "EM", "U", "BR", "DIV", "P", "SPAN"]);
    const template = document.createElement("template");
    template.innerHTML = html;

    function walk(node) {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          if (!allowed.has(child.tagName)) {
            // Replace disallowed elements with their text content.
            const textNode = document.createTextNode(child.textContent || "");
            child.parentNode.replaceChild(textNode, child);
          } else {
            // Drop all attributes (styles, classes, scripts, etc).
            for (const attr of Array.from(child.attributes)) {
              child.removeAttribute(attr.name);
            }
            walk(child);
          }
        } else if (child.nodeType === Node.COMMENT_NODE) {
          child.parentNode.removeChild(child);
        }
      }
    }

    walk(template.content);
    return template.innerHTML;
  }

  // Live character count.
  editor.addEventListener("input", updateCharCount);

  // Clear button.
  clearBtn.addEventListener("click", function () {
    editor.innerHTML = "";
    updateCharCount();
    editor.focus();
  });

  // Initial state.
  updateCharCount();
  // Focus on load (autofocus alone is unreliable across browsers).
  setTimeout(function () {
    editor.focus();
  }, 0);
})();